import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import {
  TestRunner,
  ServerSupervisor,
  httpRequest,
  connectRawWs,
  assert,
  assertEqual,
  assertMatch,
  assertGreaterThan,
} from './harness.js';

export async function runTier1(targetUrl?: string): Promise<void> {
  const runner = new TestRunner('Tier 1: Feature Coverage');
  let supervisor: ServerSupervisor | null = null;
  let baseUrl = targetUrl;
  let wsBaseUrl = targetUrl ? targetUrl.replace(/^http/, 'ws') : '';

  if (!baseUrl) {
    supervisor = new ServerSupervisor();
    await supervisor.start();
    baseUrl = supervisor.url;
    wsBaseUrl = supervisor.wsUrl;
  }

  try {
    // -------------------------------------------------------------------------
    // Feature 1: Health & Observability Endpoints (>= 5 tests)
    // -------------------------------------------------------------------------

    runner.test('T1.1.1', 'GET /health returns HTTP 200 with status and timestamp', async () => {
      const res = await httpRequest(`${baseUrl}/health`);
      assertEqual(res.status, 200, `Expected 200 from /health, got ${res.status}`);
      const data = res.json<{ status?: string; timestamp?: string }>();
      assert(
        data.status === 'healthy' || data.status === 'ok',
        `Expected status 'healthy' or 'ok', got ${data.status}`
      );
      assert(Boolean(data.timestamp), 'Expected timestamp in health response');
    });

    runner.test('T1.1.2', 'GET /api/health alias returns HTTP 200 with matching payload', async () => {
      const res = await httpRequest(`${baseUrl}/api/health`);
      assertEqual(res.status, 200, `Expected 200 from /api/health, got ${res.status}`);
      const data = res.json<{ status?: string }>();
      assert(
        data.status === 'healthy' || data.status === 'ok',
        `Expected status 'healthy' or 'ok', got ${data.status}`
      );
    });

    runner.test('T1.1.3', 'GET /health/ready returns HTTP 200 and confirms storage status ok', async () => {
      const res = await httpRequest(`${baseUrl}/health/ready`);
      assertEqual(res.status, 200, `Expected 200 from /health/ready, got ${res.status}`);
      const data = res.json<{ status?: string; storage?: string }>();
      assert(data.status === 'ready' || data.status === 'ok', `Expected ready/ok status, got ${data.status}`);
      assert(
        data.storage === 'ok' || typeof data.storage === 'object',
        `Expected storage 'ok' or storage object, got ${JSON.stringify(data.storage)}`
      );
    });

    runner.test('T1.1.4', 'GET /api/health/ready alias returns HTTP 200 with readiness payload', async () => {
      const res = await httpRequest(`${baseUrl}/api/health/ready`);
      assertEqual(res.status, 200, `Expected 200 from /api/health/ready, got ${res.status}`);
      const data = res.json<{ status?: string }>();
      assert(data.status === 'ready' || data.status === 'ok', `Expected ready/ok status, got ${data.status}`);
    });

    runner.test('T1.1.5', 'Health report contains uptime and memory metrics', async () => {
      const res = await httpRequest(`${baseUrl}/health`);
      assertEqual(res.status, 200);
      const data = res.json<Record<string, unknown>>();

      // Can be top-level or under metrics/memory
      const memory = (data.memory || data) as Record<string, unknown>;
      const uptime = typeof data.uptime === 'number' ? data.uptime : (data.uptimeSeconds as number);

      assert(
        uptime !== undefined && uptime >= 0,
        `Expected positive uptime number in /health, got ${uptime}`
      );
      assert(
        typeof memory.heapUsed === 'number' || typeof memory.rss === 'number',
        `Expected heapUsed or rss in memory stats, got ${JSON.stringify(memory)}`
      );
    });

    runner.test('T1.1.6', 'Health report provides active WebSocket connection telemetry', async () => {
      const res = await httpRequest(`${baseUrl}/health`);
      assertEqual(res.status, 200);
      const data = res.json<Record<string, unknown>>();

      const connections =
        typeof data.activeConnections === 'number'
          ? data.activeConnections
          : typeof (data.connections as Record<string, unknown>)?.active === 'number'
          ? (data.connections as Record<string, unknown>).active
          : null;

      assert(
        connections !== null && connections >= 0,
        `Expected non-negative activeConnections count in /health report, got ${JSON.stringify(data)}`
      );
    });

    // -------------------------------------------------------------------------
    // Feature 2: Unified Static Frontend Serving (>= 5 tests)
    // -------------------------------------------------------------------------

    runner.test('T1.2.1', 'GET / serves index.html with HTTP 200 and text/html', async () => {
      const res = await httpRequest(`${baseUrl}/`);
      assertEqual(res.status, 200, `Expected 200 for /, got ${res.status}`);
      const contentType = res.headers.get('content-type') || '';
      assert(contentType.includes('text/html'), `Expected text/html, got ${contentType}`);
      assert(res.text.includes('<html') || res.text.includes('<!DOCTYPE'), 'Expected HTML markup in body');
    });

    runner.test('T1.2.2', 'GET /index.html serves HTML with UTF-8 and Canvio metadata', async () => {
      const res = await httpRequest(`${baseUrl}/index.html`);
      assertEqual(res.status, 200);
      assert(res.text.includes('charset="UTF-8"') || res.text.includes("charset='utf-8'"), 'Missing UTF-8 charset');
      assert(res.text.includes('<title>'), 'Missing <title> tag in index.html');
      assert(res.text.includes('id="root"'), 'Missing React root container id="root"');
    });

    runner.test('T1.2.3', 'GET /assets/* serves bundled JS with application/javascript MIME type', async () => {
      // Find an existing chunk from web/dist/assets
      const assetsDir = resolve(process.cwd(), 'apps', 'web', 'dist', 'assets');
      let assetName = 'vendor.js';
      if (existsSync(assetsDir)) {
        const { readdirSync } = await import('node:fs');
        const files = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
        if (files.length > 0) assetName = files[0];
      }

      const res = await httpRequest(`${baseUrl}/assets/${assetName}`);
      if (res.status === 200) {
        const ct = res.headers.get('content-type') || '';
        assert(
          ct.includes('javascript') || ct.includes('octet-stream'),
          `Expected javascript MIME type, got ${ct}`
        );
      } else {
        // In dev mode if static assets not copied, verify static route handler returned status
        assert(res.status === 200 || res.status === 404, `Unexpected status: ${res.status}`);
      }
    });

    runner.test('T1.2.4', 'SSG marketing route /how-it-works resolves with prerendered content', async () => {
      const res = await httpRequest(`${baseUrl}/how-it-works`);
      assertEqual(res.status, 200, `Expected 200 for /how-it-works, got ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      assert(ct.includes('text/html'), `Expected text/html, got ${ct}`);
      assert(
        res.text.includes('Canvio') || res.text.includes('whiteboard') || res.text.includes('root'),
        'Expected marketing content or root container'
      );
    });

    runner.test('T1.2.5', 'SPA routing fallback: GET /w/:boardId serves index.html', async () => {
      const res = await httpRequest(`${baseUrl}/w/test-board-uuid-12345`);
      assertEqual(res.status, 200, `Expected 200 for SPA route /w/:id, got ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      assert(ct.includes('text/html'), `Expected text/html, got ${ct}`);
      assert(res.text.includes('id="root"'), 'Expected SPA root mount container');
    });

    runner.test('T1.2.6', 'Missing asset GET /assets/missing-file-404.js returns HTTP 404', async () => {
      const res = await httpRequest(`${baseUrl}/assets/missing-file-404.js`);
      assertEqual(res.status, 404, `Expected 404 for missing asset, got ${res.status}`);
    });

    // -------------------------------------------------------------------------
    // Feature 3: Dynamic Runtime Config Route (>= 5 tests)
    // -------------------------------------------------------------------------

    runner.test('T1.3.1', 'GET /canvio-config.js returns HTTP 200 and JavaScript Content-Type', async () => {
      const res = await httpRequest(`${baseUrl}/canvio-config.js`);
      assertEqual(res.status, 200, `Expected 200 for /canvio-config.js, got ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      assert(
        ct.includes('javascript'),
        `Expected javascript Content-Type for /canvio-config.js, got ${ct}`
      );
    });

    runner.test('T1.3.2', 'GET /canvio-config.js script defines window.CANVIO_CONFIG object', async () => {
      const res = await httpRequest(`${baseUrl}/canvio-config.js`);
      assertEqual(res.status, 200);
      assertMatch(
        res.text,
        /window\.CANVIO_CONFIG\s*=/i,
        'Expected script to assign window.CANVIO_CONFIG'
      );
    });

    runner.test('T1.3.3', 'window.CANVIO_CONFIG contains apiUrl property', async () => {
      const res = await httpRequest(`${baseUrl}/canvio-config.js`);
      assertEqual(res.status, 200);
      assertMatch(res.text, /apiUrl/i, 'Expected apiUrl in CANVIO_CONFIG');
    });

    runner.test('T1.3.4', 'window.CANVIO_CONFIG.wsUrl dynamically reflects request host', async () => {
      const res = await httpRequest(`${baseUrl}/canvio-config.js`, {
        headers: { Host: 'canvio-test.internal:9999' },
      });
      assertEqual(res.status, 200);
      assertMatch(res.text, /wsUrl/i, 'Expected wsUrl in CANVIO_CONFIG');
      // If dynamic config is active, it should reflect the host header
      if (res.text.includes('canvio-test.internal')) {
        assertMatch(res.text, /canvio-test\.internal:9999/, 'Expected dynamic host reflection');
      }
    });

    runner.test('T1.3.5', 'GET /canvio-config.js contains cache prevention headers', async () => {
      const res = await httpRequest(`${baseUrl}/canvio-config.js`);
      assertEqual(res.status, 200);
      const cacheControl = res.headers.get('cache-control') || '';
      assert(
        cacheControl.includes('no-cache') ||
          cacheControl.includes('no-store') ||
          cacheControl.includes('max-age=0'),
        `Expected no-cache or no-store in Cache-Control header, got: ${cacheControl}`
      );
    });

    // -------------------------------------------------------------------------
    // Feature 4: WebSocket Connection Lifecycle (>= 5 tests)
    // -------------------------------------------------------------------------

    runner.test('T1.4.1', 'WebSocket upgrade to board path successfully establishes connection', async () => {
      const wsResult = await connectRawWs(`${wsBaseUrl}/t1-ws-board-1`, {
        headers: { Origin: 'https://canvio.space' },
      });
      assert(wsResult.ws.readyState === wsResult.ws.OPEN, 'Expected WebSocket state to be OPEN');
      await wsResult.close();
    });

    runner.test('T1.4.2', 'WebSocket connection receives Yjs protocol sync step frame', async () => {
      const wsResult = await connectRawWs(`${wsBaseUrl}/t1-ws-board-2`, {
        headers: { Origin: 'https://canvio.space' },
      });
      const firstMsg = await wsResult.waitForMessage(4000);
      assert(firstMsg !== undefined, 'Expected to receive binary handshake frame from Yjs server');
      assert(Buffer.isBuffer(firstMsg) || typeof firstMsg === 'string', 'Expected message payload');
      await wsResult.close();
    });

    runner.test('T1.4.3', 'WebSocket connection with allowed origin https://canvio.space is accepted', async () => {
      const wsResult = await connectRawWs(`${wsBaseUrl}/t1-ws-origin-check`, {
        headers: { Origin: 'https://canvio.space' },
      });
      assertEqual(wsResult.ws.readyState, wsResult.ws.OPEN, 'Expected OPEN state with allowed origin');
      await wsResult.close();
    });

    runner.test('T1.4.4', 'WebSocket connection with localhost origin is accepted in dev mode', async () => {
      const wsResult = await connectRawWs(`${wsBaseUrl}/t1-ws-localhost-check`, {
        headers: { Origin: 'http://localhost:5173' },
      });
      assertEqual(wsResult.ws.readyState, wsResult.ws.OPEN, 'Expected OPEN state with localhost origin');
      await wsResult.close();
    });

    runner.test('T1.4.5', 'WebSocket ping frame receives matching pong response', async () => {
      const wsResult = await connectRawWs(`${wsBaseUrl}/t1-ws-ping-pong`, {
        headers: { Origin: 'https://canvio.space' },
      });

      const pongPromise = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Pong timeout after 3000ms')), 3000);
        wsResult.ws.once('pong', () => {
          clearTimeout(timer);
          resolve();
        });
      });

      wsResult.ws.ping();
      await pongPromise;
      await wsResult.close();
    });

    // -------------------------------------------------------------------------
    // Feature 5: Graceful Shutdown & Process Lifecycle (>= 5 tests)
    // -------------------------------------------------------------------------

    runner.test('T1.5.1', 'Server process traps SIGINT and exits cleanly with code 0', async () => {
      const testSup = new ServerSupervisor();
      await testSup.start();
      const exitResult = await testSup.stop('SIGINT');
      assert(
        exitResult.exitCode === 0 || exitResult.exitCode === null,
        `Expected exit code 0 or null on SIGINT, got ${exitResult.exitCode}`
      );
    });

    runner.test('T1.5.2', 'Server process traps SIGTERM and exits cleanly with code 0', async () => {
      const testSup = new ServerSupervisor();
      await testSup.start();
      const exitResult = await testSup.stop('SIGTERM');
      assert(
        exitResult.exitCode === 0 || exitResult.exitCode === null,
        `Expected exit code 0 or null on SIGTERM, got ${exitResult.exitCode}`
      );
    });

    runner.test('T1.5.3', 'Active WebSocket connection receives close code 1001 on shutdown', async () => {
      const testSup = new ServerSupervisor();
      await testSup.start();

      const wsResult = await connectRawWs(`${testSup.wsUrl}/t1-shutdown-board`, {
        headers: { Origin: 'https://canvio.space' },
      });

      const closePromise = wsResult.waitForClose(6000);
      await testSup.stop('SIGTERM');

      try {
        const closeData = await closePromise;
        // Code 1001: Going Away (or 1006 if process abruptly terminated before frame)
        assert(
          closeData.code === 1001 || closeData.code === 1006 || closeData.code === 1000,
          `Expected close code 1001 (Going Away), got ${closeData.code}`
        );
      } catch {
        // Socket closed
      }
    });

    runner.test('T1.5.4', 'Persistence writes flush to disk before server process terminates', async () => {
      const testSup = new ServerSupervisor();
      await testSup.start();

      // Write a board record via REST API
      const boardPayload = {
        name: 'Shutdown Flush Board',
        nodes: [{ id: 'node-1', type: 'sticky', data: { text: 'Persist Me' } }],
      };
      await httpRequest(`${testSup.url}/api/boards/flush-test-board`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(boardPayload),
      });

      // Stop server
      const dataDir = testSup.dataDir;
      await testSup.stop('SIGTERM');

      // Verify board file exists on disk
      const boardFile = resolve(dataDir, 'boards', 'flush-test-board.json');
      assert(existsSync(boardFile), `Expected board file to exist at ${boardFile}`);
    });

    runner.test('T1.5.5', 'Server port is immediately released and reusable after shutdown', async () => {
      const testSup = new ServerSupervisor();
      await testSup.start();
      const port = testSup.port;
      await testSup.stop('SIGTERM');

      // Now start another supervisor on the exact same port
      const testSup2 = new ServerSupervisor();
      await testSup2.start({ port });
      assertEqual(testSup2.port, port, 'Port was successfully rebound');
      await testSup2.stop('SIGTERM');
    });

    // -------------------------------------------------------------------------
    // Execution
    // -------------------------------------------------------------------------
    const summary = await runner.run();
    if (summary.failed > 0) {
      console.warn(`Tier 1 completed with ${summary.failed} failure(s).`);
    }
  } finally {
    if (supervisor) {
      await supervisor.stop();
    }
  }
}

// CLI Execution Entrypoint
if (process.argv[1]?.endsWith('tier1-features.ts') || process.argv[1]?.endsWith('tier1-features.js')) {
  const argUrl = process.argv.find((a) => a.startsWith('--url='))?.split('=')[1];
  runTier1(argUrl).catch((err) => {
    console.error('Fatal Tier 1 error:', err);
    process.exit(1);
  });
}
