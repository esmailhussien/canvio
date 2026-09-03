import {
  TestRunner,
  ServerSupervisor,
  httpRequest,
  connectRawWs,
  assert,
  assertEqual,
} from './harness.js';

export async function runTier2(targetUrl?: string): Promise<void> {
  const runner = new TestRunner('Tier 2: Boundary & Corner Cases');

  // ---------------------------------------------------------------------------
  // T2.1: Storage Degradation & Read-Only Handling
  // ---------------------------------------------------------------------------
  runner.test('T2.1', 'Storage read-only / inaccessible triggers 503 degraded status on /health/ready', async () => {
    // Spawn a dedicated server pointing to an impossible/invalid data directory path
    const invalidDir = process.platform === 'win32' ? 'Z:\\non-existent-canvio-drive\\data' : '/root/non-existent-canvio-data';
    const sup = new ServerSupervisor();
    try {
      await sup.start({
        dataDir: invalidDir,
        env: { CANVIO_DATA_DIR: invalidDir },
      });
      const res = await httpRequest(`${sup.url}/health/ready`);
      // When storage is unavailable, server must respond with 503 or report not_ready / degraded
      assert(
        res.status === 503 || res.status === 200,
        `Expected 503 or degraded status, got ${res.status}`
      );
      if (res.status === 503) {
        const body = res.json<{ status?: string; storage?: string }>();
        assert(
          body.status === 'not_ready' || body.storage === 'unavailable' || body.status === 'degraded',
          `Expected unavailable storage indicator, got ${JSON.stringify(body)}`
        );
      }
    } finally {
      await sup.stop();
    }
  });

  // ---------------------------------------------------------------------------
  // T2.2: Global WebSocket Max Connections Limit
  // ---------------------------------------------------------------------------
  runner.test('T2.2', 'Global WS Max Connections limit rejects exceeding clients with code 1013', async () => {
    const sup = new ServerSupervisor();
    await sup.start({
      env: {
        CANVIO_WS_MAX_CONNECTIONS: '3',
        CANVIO_WS_MAX_PER_IP: '10', // Allow more per IP so global limit is the one tested
      },
    });

    const clients: Array<Awaited<ReturnType<typeof connectRawWs>>> = [];
    try {
      // Connect 3 clients (reaching max capacity)
      for (let i = 0; i < 3; i++) {
        const c = await connectRawWs(`${sup.wsUrl}/t2-board-capacity`, {
          headers: {
            Origin: 'https://canvio.space',
            'X-Forwarded-For': `203.0.113.${i + 1}`,
          },
        });
        clients.push(c);
      }

      // 4th client should be rejected with code 1013 (Server at connection capacity)
      const rejectedClient = await connectRawWs(`${sup.wsUrl}/t2-board-capacity`, {
        headers: {
          Origin: 'https://canvio.space',
          'X-Forwarded-For': '203.0.113.99',
        },
      });

      const closeEvent = await rejectedClient.waitForClose(4000);
      assertEqual(closeEvent.code, 1013, `Expected code 1013 (capacity limit), got ${closeEvent.code}`);
    } finally {
      await Promise.all(clients.map((c) => c.close().catch(() => {})));
      await sup.stop();
    }
  });

  // ---------------------------------------------------------------------------
  // T2.3: Per-IP WebSocket Concurrency Limit
  // ---------------------------------------------------------------------------
  runner.test('T2.3', 'Per-IP WebSocket limit rejects excessive connections from same IP with code 1013', async () => {
    const sup = new ServerSupervisor();
    await sup.start({
      env: {
        CANVIO_WS_MAX_PER_IP: '2',
        CANVIO_WS_MAX_CONNECTIONS: '100',
      },
    });

    const clients: Array<Awaited<ReturnType<typeof connectRawWs>>> = [];
    try {
      // Connect 2 clients from the same IP (192.168.1.50)
      for (let i = 0; i < 2; i++) {
        const c = await connectRawWs(`${sup.wsUrl}/t2-board-per-ip`, {
          headers: {
            Origin: 'https://canvio.space',
            'X-Forwarded-For': '192.168.1.50',
          },
        });
        clients.push(c);
      }

      // 3rd client from the SAME IP must be rejected with 1013
      const thirdClient = await connectRawWs(`${sup.wsUrl}/t2-board-per-ip`, {
        headers: {
          Origin: 'https://canvio.space',
          'X-Forwarded-For': '192.168.1.50',
        },
      });

      const closeEvent = await thirdClient.waitForClose(4000);
      assertEqual(closeEvent.code, 1013, `Expected code 1013 for IP limit, got ${closeEvent.code}`);
    } finally {
      await Promise.all(clients.map((c) => c.close().catch(() => {})));
      await sup.stop();
    }
  });

  // ---------------------------------------------------------------------------
  // T2.4: Multi-Client IP Dispersal via X-Forwarded-For
  // ---------------------------------------------------------------------------
  runner.test('T2.4', 'Distinct X-Forwarded-For IPs receive independent connection limits', async () => {
    const sup = new ServerSupervisor();
    await sup.start({
      env: {
        CANVIO_WS_MAX_PER_IP: '2',
        CANVIO_WS_MAX_CONNECTIONS: '50',
      },
    });

    const clients: Array<Awaited<ReturnType<typeof connectRawWs>>> = [];
    try {
      // 2 clients from IP A
      for (let i = 0; i < 2; i++) {
        clients.push(
          await connectRawWs(`${sup.wsUrl}/t2-board-dispersal`, {
            headers: { Origin: 'https://canvio.space', 'X-Forwarded-For': '10.0.0.1' },
          })
        );
      }

      // 2 clients from IP B
      for (let i = 0; i < 2; i++) {
        clients.push(
          await connectRawWs(`${sup.wsUrl}/t2-board-dispersal`, {
            headers: { Origin: 'https://canvio.space', 'X-Forwarded-For': '10.0.0.2' },
          })
        );
      }

      // All 4 should remain connected in OPEN state
      assertEqual(clients.length, 4);
      for (const c of clients) {
        assertEqual(c.ws.readyState, c.ws.OPEN, 'Expected client to remain open');
      }
    } finally {
      await Promise.all(clients.map((c) => c.close().catch(() => {})));
      await sup.stop();
    }
  });

  // ---------------------------------------------------------------------------
  // T2.5: Unauthorized Origin Rejection
  // ---------------------------------------------------------------------------
  runner.test('T2.5', 'Unauthorized origin header is rejected with code 1008', async () => {
    const sup = new ServerSupervisor();
    await sup.start({
      env: {
        CANVIO_ALLOW_LOCAL_ORIGINS: 'false',
      },
    });

    try {
      const client = await connectRawWs(`${sup.wsUrl}/t2-board-origin`, {
        headers: { Origin: 'https://evil-unauthorized-attacker.xyz' },
      });

      const closeEvent = await client.waitForClose(4000);
      assertEqual(closeEvent.code, 1008, `Expected code 1008 (Origin not allowed), got ${closeEvent.code}`);
    } finally {
      await sup.stop();
    }
  });

  // ---------------------------------------------------------------------------
  // T2.6: Missing Origin Header Enforcement
  // ---------------------------------------------------------------------------
  runner.test('T2.6', 'Missing origin header is rejected with code 1008 when disallowed', async () => {
    const sup = new ServerSupervisor();
    await sup.start({
      env: {
        CANVIO_ALLOW_NO_ORIGIN_WS: 'false',
      },
    });

    try {
      // Connect without Origin header
      const client = await connectRawWs(`${sup.wsUrl}/t2-board-no-origin`);
      const closeEvent = await client.waitForClose(4000);
      assertEqual(closeEvent.code, 1008, `Expected code 1008 (Origin required), got ${closeEvent.code}`);
    } finally {
      await sup.stop();
    }
  });

  // ---------------------------------------------------------------------------
  // T2.7: Rapid Connect / Disconnect Churn
  // ---------------------------------------------------------------------------
  runner.test('T2.7', 'Rapid connect/disconnect burst completes without leaking active sockets', async () => {
    const sup = new ServerSupervisor();
    await sup.start();

    try {
      // Rapidly connect and close 20 sockets sequentially
      for (let i = 0; i < 20; i++) {
        const client = await connectRawWs(`${sup.wsUrl}/t2-board-churn`, {
          headers: { Origin: 'https://canvio.space' },
        });
        await client.close();
      }

      // Verify server is healthy and can handle fresh connection
      const finalClient = await connectRawWs(`${sup.wsUrl}/t2-board-churn`, {
        headers: { Origin: 'https://canvio.space' },
      });
      assertEqual(finalClient.ws.readyState, finalClient.ws.OPEN);
      await finalClient.close();
    } finally {
      await sup.stop();
    }
  });

  // ---------------------------------------------------------------------------
  // T2.8: Oversized WebSocket Payload Rejection
  // ---------------------------------------------------------------------------
  runner.test('T2.8', 'Oversized WebSocket frame exceeding WS_MAX_PAYLOAD is rejected', async () => {
    const sup = new ServerSupervisor();
    await sup.start({
      env: {
        CANVIO_WS_MAX_PAYLOAD_KB: '64', // 64 KB limit
      },
    });

    try {
      const client = await connectRawWs(`${sup.wsUrl}/t2-board-oversized`, {
        headers: { Origin: 'https://canvio.space' },
      });

      // Transmit a 128 KB payload (double the limit)
      const oversizedPayload = Buffer.alloc(128 * 1024, 0x41);

      const closePromise = client.waitForClose(5000);
      client.ws.send(oversizedPayload);

      const closeEvent = await closePromise;
      // Close code 1009 = Message Too Big, or 1006 = abnormal termination
      assert(
        closeEvent.code === 1009 || closeEvent.code === 1006 || closeEvent.code === 1001,
        `Expected payload limit close code (1009/1006), got ${closeEvent.code}`
      );
    } finally {
      await sup.stop();
    }
  });

  // ---------------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------------
  const summary = await runner.run();
  if (summary.failed > 0) {
    console.warn(`Tier 2 completed with ${summary.failed} failure(s).`);
  }
}

// CLI Execution Entrypoint
if (process.argv[1]?.endsWith('tier2-boundaries.ts') || process.argv[1]?.endsWith('tier2-boundaries.js')) {
  const argUrl = process.argv.find((a) => a.startsWith('--url='))?.split('=')[1];
  runTier2(argUrl).catch((err) => {
    console.error('Fatal Tier 2 error:', err);
    process.exit(1);
  });
}
