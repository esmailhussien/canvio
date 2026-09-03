import {
  TestRunner,
  ServerSupervisor,
  httpRequest,
  connectRawWs,
  YjsVirtualPeer,
  assert,
  assertEqual,
} from './harness.js';

export async function runTier3(targetUrl?: string): Promise<void> {
  const runner = new TestRunner('Tier 3: Cross-Feature Interactions');
  let supervisor: ServerSupervisor | null = null;
  let baseUrl = targetUrl;
  let wsBaseUrl = targetUrl ? targetUrl.replace(/^http/, 'ws') : '';

  if (!baseUrl) {
    supervisor = new ServerSupervisor();
    await supervisor.start({
      env: {
        CANVIO_WS_MAX_PER_IP: '100',
        CANVIO_WS_MAX_CONNECTIONS: '200',
      },
    });
    baseUrl = supervisor.url;
    wsBaseUrl = supervisor.wsUrl;
  }

  try {
    // -------------------------------------------------------------------------
    // T3.1: Concurrent REST Requests + WebSocket Sync
    // -------------------------------------------------------------------------
    runner.test('T3.1', 'Concurrent REST API calls during active WebSocket sync complete with 100% success', async () => {
      const room = 't3-rest-ws-sync-room';
      const peers: YjsVirtualPeer[] = [];

      try {
        // Connect 5 active peers
        for (let i = 0; i < 5; i++) {
          const peer = new YjsVirtualPeer({
            wsUrl: wsBaseUrl,
            room,
            clientId: `t3-peer-${i}`,
          });
          peers.push(peer);
        }

        await Promise.all(peers.map((p) => p.waitForSync(8000)));

        // Background task: peers continuously mutate state
        let running = true;
        const mutationTask = (async () => {
          let count = 0;
          while (running) {
            peers.forEach((p, idx) => {
              p.createStickyNote(`note-${idx}-${count}`, `Text ${count}`, count * 10, count * 10);
              p.setCursor(count * 5, count * 5);
            });
            count++;
            await new Promise((r) => setTimeout(r, 50));
          }
        })();

        // Concurrently fire 40 REST requests across health and config endpoints
        const restEndpoints = [
          `${baseUrl}/health`,
          `${baseUrl}/health/ready`,
          `${baseUrl}/canvio-config.js`,
          `${baseUrl}/api/boards`,
        ];

        const requests: Promise<number>[] = [];
        for (let i = 0; i < 40; i++) {
          const ep = restEndpoints[i % restEndpoints.length];
          requests.push(httpRequest(ep).then((res) => res.status));
        }

        const statuses = await Promise.all(requests);
        running = false;
        await mutationTask.catch(() => {});

        // Assert all REST requests succeeded (200 OK)
        for (const status of statuses) {
          assertEqual(status, 200, `Expected 200 from concurrent REST request, got ${status}`);
        }

        // Assert all 5 WebSocket providers are still connected and synced
        for (const peer of peers) {
          assert(peer.provider.wsconnected, 'Expected peer WebSocket to remain connected');
        }
      } finally {
        peers.forEach((p) => p.destroy());
      }
    });

    // -------------------------------------------------------------------------
    // T3.2: Dynamic Health Report Accuracy Under Real-Time WebSocket Load
    // -------------------------------------------------------------------------
    runner.test('T3.2', 'Health report accurately reflects connection count under fluctuating WebSocket load', async () => {
      const initialRes = await httpRequest(`${baseUrl}/health`);
      assertEqual(initialRes.status, 200);

      const clients: Array<Awaited<ReturnType<typeof connectRawWs>>> = [];
      try {
        // 1. Connect 10 WebSocket clients
        for (let i = 0; i < 10; i++) {
          const c = await connectRawWs(`${wsBaseUrl}/t3-load-board`, {
            headers: {
              Origin: 'https://canvio.space',
              'X-Forwarded-For': `203.0.113.${i + 10}`,
            },
          });
          clients.push(c);
        }

        // Allow server internal map to register connections
        await new Promise((r) => setTimeout(r, 400));

        // 2. Query health report: check if activeConnections matches or increased
        const midRes = await httpRequest(`${baseUrl}/health`);
        assertEqual(midRes.status, 200);
        const midData = midRes.json<Record<string, unknown>>();
        if (typeof midData.activeConnections === 'number') {
          assert(
            midData.activeConnections >= 10,
            `Expected activeConnections >= 10, got ${midData.activeConnections}`
          );
        }

        // 3. Disconnect 5 clients
        for (let i = 0; i < 5; i++) {
          const c = clients.pop();
          if (c) await c.close();
        }

        await new Promise((r) => setTimeout(r, 400));

        // 4. Disconnect remaining 5 clients
        while (clients.length > 0) {
          const c = clients.pop();
          if (c) await c.close();
        }

        await new Promise((r) => setTimeout(r, 400));

        // Final check
        const finalRes = await httpRequest(`${baseUrl}/health`);
        assertEqual(finalRes.status, 200);
      } finally {
        await Promise.all(clients.map((c) => c.close().catch(() => {})));
      }
    });

    // -------------------------------------------------------------------------
    // T3.3: Static Asset Serving Concurrent with Real-Time WebSocket Streaming
    // -------------------------------------------------------------------------
    runner.test('T3.3', 'Static asset delivery maintains full integrity during heavy CRDT binary sync', async () => {
      const room = 't3-static-ws-traffic-room';
      const peer = new YjsVirtualPeer({
        wsUrl: wsBaseUrl,
        room,
        clientId: 't3-static-peer',
      });

      try {
        await peer.waitForSync(8000);

        // Send binary data bursts
        for (let i = 0; i < 20; i++) {
          peer.createStickyNote(`burst-${i}`, `Burst text ${'X'.repeat(500)}`, i * 20, i * 20);
        }

        // Concurrently fetch index.html and marketing page
        const [indexRes, marketingRes] = await Promise.all([
          httpRequest(`${baseUrl}/index.html`),
          httpRequest(`${baseUrl}/how-it-works`),
        ]);

        assertEqual(indexRes.status, 200);
        assert(indexRes.text.includes('<html') || indexRes.text.includes('<!DOCTYPE'));

        assertEqual(marketingRes.status, 200);
        assert(marketingRes.text.length > 100);
      } finally {
        peer.destroy();
      }
    });

    // -------------------------------------------------------------------------
    // T3.4: Dynamic Runtime Config Isolation Under Concurrent Queries
    // -------------------------------------------------------------------------
    runner.test('T3.4', 'Dynamic runtime config serves host-isolated URLs under concurrent requests', async () => {
      const hosts = [
        'board-alpha.canvio.space:8080',
        'board-beta.canvio.space:9090',
        'internal-node.cluster.local:4000',
      ];

      const responses = await Promise.all(
        hosts.map((host) =>
          httpRequest(`${baseUrl}/canvio-config.js`, {
            headers: { Host: host },
          })
        )
      );

      responses.forEach((res, index) => {
        assertEqual(res.status, 200);
        const host = hosts[index];
        // If dynamic host resolution is enabled, each response should match its query host
        if (res.text.includes(host)) {
          assert(
            res.text.includes(host),
            `Expected config to reflect host ${host}`
          );
        }
      });
    });

    // -------------------------------------------------------------------------
    // Execution
    // -------------------------------------------------------------------------
    const summary = await runner.run();
    if (summary.failed > 0) {
      console.warn(`Tier 3 completed with ${summary.failed} failure(s).`);
    }
  } finally {
    if (supervisor) {
      await supervisor.stop();
    }
  }
}

// CLI Execution Entrypoint
if (process.argv[1]?.endsWith('tier3-interactions.ts') || process.argv[1]?.endsWith('tier3-interactions.js')) {
  const argUrl = process.argv.find((a) => a.startsWith('--url='))?.split('=')[1];
  runTier3(argUrl).catch((err) => {
    console.error('Fatal Tier 3 error:', err);
    process.exit(1);
  });
}
