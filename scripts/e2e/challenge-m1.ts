import { resolve, join } from 'node:path';
import { rmSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import {
  TestRunner,
  ServerSupervisor,
  httpRequest,
  connectRawWs,
  assert,
  assertEqual,
} from './harness.js';
import { formatUptime } from '../../apps/server/src/health.js';

export async function runChallengeM1(): Promise<void> {
  const runner = new TestRunner('Challenger M1-1: Server Health, Observability & Resilience');
  let supervisor: ServerSupervisor | null = null;

  try {
    supervisor = new ServerSupervisor();
    await supervisor.start();
    const baseUrl = supervisor.url;
    const wsBaseUrl = supervisor.wsUrl;
    const dataDir = supervisor.dataDir;

    // =========================================================================
    // Challenge 1: Memory Telemetry & Uptime Accuracy
    // =========================================================================

    runner.test('CH-1.1', 'Uptime calculation boundary testing across 0s, 59s, 60s, 1h, 1d, and negative/NaN edge cases', () => {
      assertEqual(formatUptime(0), '0s');
      assertEqual(formatUptime(59), '59s');
      assertEqual(formatUptime(60), '1m 0s');
      assertEqual(formatUptime(119), '1m 59s');
      assertEqual(formatUptime(3599), '59m 59s');
      assertEqual(formatUptime(3600), '1h 0s');
      assertEqual(formatUptime(3661), '1h 1m 1s');
      assertEqual(formatUptime(86399), '23h 59m 59s');
      assertEqual(formatUptime(86400), '1d 0s');
      assertEqual(formatUptime(90061), '1d 1h 1m 1s');
      assertEqual(formatUptime(172800), '2d 0s');
      assertEqual(formatUptime(-1), '0s');
      assertEqual(formatUptime(-1000), '0s');
      assertEqual(formatUptime(NaN), '0s');
      assertEqual(formatUptime(Infinity), '0s');
      assertEqual(formatUptime(-Infinity), '0s');
    });

    runner.test('CH-1.2', 'Live server uptime monotonically increases and matches process.uptime', async () => {
      const res1 = await httpRequest(`${baseUrl}/health`);
      assertEqual(res1.status, 200);
      const data1 = res1.json<{ uptime: number; uptimeFormatted: string }>();

      assert(typeof data1.uptime === 'number' && data1.uptime >= 0, 'Uptime must be non-negative number');
      assert(typeof data1.uptimeFormatted === 'string' && data1.uptimeFormatted.endsWith('s'), 'Formatted uptime must end with unit s');

      await new Promise((r) => setTimeout(r, 1200));

      const res2 = await httpRequest(`${baseUrl}/health`);
      assertEqual(res2.status, 200);
      const data2 = res2.json<{ uptime: number; uptimeFormatted: string }>();

      assert(data2.uptime > data1.uptime, `Expected uptime to increase: ${data2.uptime} > ${data1.uptime}`);
      const delta = data2.uptime - data1.uptime;
      assert(delta >= 1.0 && delta <= 3.0, `Expected delta ~1.2s, got ${delta}s`);
    });

    runner.test('CH-1.3', 'Memory telemetry reports byte values and converted MBs accurately', async () => {
      const res = await httpRequest(`${baseUrl}/health`);
      assertEqual(res.status, 200);
      const data = res.json<{
        memory: {
          rss: number;
          heapTotal: number;
          heapUsed: number;
          external: number;
          arrayBuffers: number;
          rssMb: number;
          heapTotalMb: number;
          heapUsedMb: number;
        };
      }>();

      const { memory } = data;
      assert(memory.rss > 0, 'rss > 0');
      assert(memory.heapTotal > 0, 'heapTotal > 0');
      assert(memory.heapUsed > 0, 'heapUsed > 0');
      assert(memory.heapTotal >= memory.heapUsed, 'heapTotal >= heapUsed');

      const expectedRssMb = Math.round((memory.rss / (1024 * 1024)) * 100) / 100;
      const expectedHeapTotalMb = Math.round((memory.heapTotal / (1024 * 1024)) * 100) / 100;
      const expectedHeapUsedMb = Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100;

      assertEqual(memory.rssMb, expectedRssMb, 'rssMb conversion precision');
      assertEqual(memory.heapTotalMb, expectedHeapTotalMb, 'heapTotalMb conversion precision');
      assertEqual(memory.heapUsedMb, expectedHeapUsedMb, 'heapUsedMb conversion precision');
    });

    // =========================================================================
    // Challenge 2: Active WebSocket Tracking Under Live Load & Churn
    // =========================================================================

    runner.test('CH-2.1', 'Baseline active WebSocket connections is exactly 0', async () => {
      const res = await httpRequest(`${baseUrl}/health`);
      assertEqual(res.status, 200);
      const data = res.json<{
        activeConnections: number;
        connections: { activeWebSocket: number; maxConnections: number };
      }>();
      assertEqual(data.activeConnections, 0, 'Baseline activeConnections must be 0');
      assertEqual(data.connections.activeWebSocket, 0, 'Baseline activeWebSocket must be 0');
    });

    runner.test('CH-2.2', 'Active connection count tracks live simultaneous sockets accurately', async () => {
      const clients: Array<Awaited<ReturnType<typeof connectRawWs>>> = [];
      const NUM_CLIENTS = 15;

      try {
        for (let i = 0; i < NUM_CLIENTS; i++) {
          const client = await connectRawWs(`${wsBaseUrl}/challenge-board-1`, {
            headers: { Origin: 'https://canvio.space' },
          });
          clients.push(client);
        }

        const res = await httpRequest(`${baseUrl}/health`);
        assertEqual(res.status, 200);
        const data = res.json<{ activeConnections: number; connections: { activeWebSocket: number } }>();

        assertEqual(data.activeConnections, NUM_CLIENTS, `Expected activeConnections === ${NUM_CLIENTS}`);
        assertEqual(data.connections.activeWebSocket, NUM_CLIENTS, `Expected activeWebSocket === ${NUM_CLIENTS}`);
      } finally {
        for (const c of clients) {
          await c.close(1000);
        }
      }

      await new Promise((r) => setTimeout(r, 200));

      const afterCloseRes = await httpRequest(`${baseUrl}/health`);
      assertEqual(afterCloseRes.status, 200);
      const afterCloseData = afterCloseRes.json<{ activeConnections: number }>();
      assertEqual(afterCloseData.activeConnections, 0, 'Active connections must return to 0 after all clients close');
    });

    runner.test('CH-2.3', 'Active connection count decrements accurately under abrupt termination (socket reset)', async () => {
      const clients: Array<Awaited<ReturnType<typeof connectRawWs>>> = [];
      const BATCH_SIZE = 10;

      for (let i = 0; i < BATCH_SIZE; i++) {
        const client = await connectRawWs(`${wsBaseUrl}/challenge-board-abrupt`, {
          headers: { Origin: 'https://canvio.space' },
        });
        clients.push(client);
      }

      const resBefore = await httpRequest(`${baseUrl}/health`);
      assertEqual(resBefore.json<{ activeConnections: number }>().activeConnections, BATCH_SIZE);

      // Abruptly terminate 5 sockets without clean close frames
      for (let i = 0; i < 5; i++) {
        clients[i].ws.terminate();
      }

      await new Promise((r) => setTimeout(r, 300));

      const resMid = await httpRequest(`${baseUrl}/health`);
      assertEqual(
        resMid.json<{ activeConnections: number }>().activeConnections,
        5,
        'Expected exactly 5 remaining connections after abrupt termination'
      );

      // Clean close remaining 5
      for (let i = 5; i < BATCH_SIZE; i++) {
        await clients[i].close(1000);
      }

      await new Promise((r) => setTimeout(r, 200));

      const resAfter = await httpRequest(`${baseUrl}/health`);
      assertEqual(
        resAfter.json<{ activeConnections: number }>().activeConnections,
        0,
        'Expected 0 active connections after all abrupt and clean closes'
      );
    });

    runner.test('CH-2.4', 'High-frequency connect/disconnect churn does not leak active connections', async () => {
      const CHURN_CYCLES = 20;

      for (let i = 0; i < CHURN_CYCLES; i++) {
        const client = await connectRawWs(`${wsBaseUrl}/challenge-churn-${i % 3}`, {
          headers: { Origin: 'https://canvio.space' },
        });
        if (i % 2 === 0) {
          await client.close(1000);
        } else {
          client.ws.terminate();
        }
      }

      await new Promise((r) => setTimeout(r, 400));

      const res = await httpRequest(`${baseUrl}/health`);
      assertEqual(res.status, 200);
      const count = res.json<{ activeConnections: number }>().activeConnections;
      assertEqual(count, 0, `Expected 0 active connections after churn, got ${count}`);
    });

    runner.test('CH-2.5', 'Rejected unauthorized connections do NOT increment active connection count', async () => {
      try {
        await connectRawWs(`${wsBaseUrl}/invalid..board..id!!`, {
          headers: { Origin: 'https://canvio.space' },
          timeoutMs: 3000,
        });
      } catch {
        // Expected rejection
      }

      await new Promise((r) => setTimeout(r, 100));

      const res = await httpRequest(`${baseUrl}/health`);
      assertEqual(res.status, 200);
      const count = res.json<{ activeConnections: number }>().activeConnections;
      assertEqual(count, 0, 'Unauthorized rejected connection must not increment activeConnections');
    });

    // =========================================================================
    // Challenge 3: Storage Degradation — Readiness 503 vs Liveness 200
    // =========================================================================

    runner.test('CH-3.1', 'Baseline readiness and liveness both return HTTP 200 with ok status', async () => {
      const liveRes = await httpRequest(`${baseUrl}/health`);
      assertEqual(liveRes.status, 200, 'Baseline liveness must be 200');
      const liveData = liveRes.json<{ status: string; storage: { status: string } }>();
      assertEqual(liveData.status, 'healthy');
      assertEqual(liveData.storage.status, 'ok');

      const readyRes = await httpRequest(`${baseUrl}/health/ready`);
      assertEqual(readyRes.status, 200, 'Baseline readiness must be 200');
      const readyData = readyRes.json<{ status: string; storage: { status: string } }>();
      assertEqual(readyData.status, 'ready');
      assertEqual(readyData.storage.status, 'ok');
    });

    runner.test('CH-3.2', 'Storage degradation in `boards` returns HTTP 503 on readiness while liveness remains HTTP 200', async () => {
      const boardsPath = join(dataDir, 'boards');

      // Degrade storage: replace boards directory with a regular file
      rmSync(boardsPath, { recursive: true, force: true });
      writeFileSync(boardsPath, 'blocking-file-to-degrade-boards-storage');

      try {
        // 1. Check readiness endpoint: MUST return HTTP 503 Service Unavailable
        const readyRes = await httpRequest(`${baseUrl}/health/ready`);
        assertEqual(readyRes.status, 503, `Expected readiness to return 503 when boards storage is degraded, got ${readyRes.status}`);
        const readyData = readyRes.json<{ status: string; storage: string; error?: string }>();
        assertEqual(readyData.status, 'not_ready');
        assertEqual(readyData.storage, 'unavailable');
        assert(Boolean(readyData.error), 'Readiness 503 response must include diagnostic error message');

        // 2. Check /api/health/ready alias: MUST also return HTTP 503
        const apiReadyRes = await httpRequest(`${baseUrl}/api/health/ready`);
        assertEqual(apiReadyRes.status, 503, `Expected /api/health/ready to return 503, got ${apiReadyRes.status}`);

        // 3. Check liveness endpoint: MUST REMAIN HTTP 200 (process is alive and running)
        const liveRes = await httpRequest(`${baseUrl}/health`);
        assertEqual(liveRes.status, 200, `Expected liveness to stay 200 even under storage degradation, got ${liveRes.status}`);
        const liveData = liveRes.json<{ status: string; storage: { status: string; accessible: boolean; writable: boolean } }>();
        assertEqual(liveData.status, 'degraded', `Expected liveness status 'degraded', got ${liveData.status}`);
        assertEqual(liveData.storage.accessible, false, 'Storage accessible must be false');
        assertEqual(liveData.storage.writable, false, 'Storage writable must be false');

        // 4. Check /api/health alias liveness: MUST ALSO REMAIN HTTP 200
        const apiLiveRes = await httpRequest(`${baseUrl}/api/health`);
        assertEqual(apiLiveRes.status, 200);
        assertEqual(apiLiveRes.json<{ status: string }>().status, 'degraded');
      } finally {
        unlinkSync(boardsPath);
        mkdirSync(boardsPath, { recursive: true });
      }

      // Verify recovery
      const recoveredReady = await httpRequest(`${baseUrl}/health/ready`);
      assertEqual(recoveredReady.status, 200, 'Readiness should immediately recover to 200 once storage is restored');
      const recoveredLive = await httpRequest(`${baseUrl}/health`);
      assertEqual(recoveredLive.json<{ status: string }>().status, 'healthy');
    });

    runner.test('CH-3.3', 'Storage degradation in `ydocs` returns HTTP 503 on readiness while liveness remains HTTP 200', async () => {
      const ydocsPath = join(dataDir, 'ydocs');

      rmSync(ydocsPath, { recursive: true, force: true });
      writeFileSync(ydocsPath, 'blocking-file-to-degrade-ydocs-storage');

      try {
        const readyRes = await httpRequest(`${baseUrl}/health/ready`);
        assertEqual(readyRes.status, 503, `Expected readiness to return 503 when ydocs is degraded, got ${readyRes.status}`);

        const liveRes = await httpRequest(`${baseUrl}/health`);
        assertEqual(liveRes.status, 200, `Expected liveness to remain 200 when ydocs is degraded, got ${liveRes.status}`);
        const liveData = liveRes.json<{ status: string; storage: { status: string } }>();
        assertEqual(liveData.status, 'degraded');
        assertEqual(liveData.storage.status, 'degraded');
      } finally {
        unlinkSync(ydocsPath);
        mkdirSync(ydocsPath, { recursive: true });
      }

      const recoveredReady = await httpRequest(`${baseUrl}/health/ready`);
      assertEqual(recoveredReady.status, 200, 'Readiness should recover to 200');
    });

    runner.test('CH-3.4', 'Total storage failure (both directories degraded) returns HTTP 503 on readiness and 200 degraded on liveness', async () => {
      const boardsPath = join(dataDir, 'boards');
      const ydocsPath = join(dataDir, 'ydocs');

      rmSync(boardsPath, { recursive: true, force: true });
      rmSync(ydocsPath, { recursive: true, force: true });
      writeFileSync(boardsPath, 'blocking-boards');
      writeFileSync(ydocsPath, 'blocking-ydocs');

      try {
        const readyRes = await httpRequest(`${baseUrl}/health/ready`);
        assertEqual(readyRes.status, 503);

        const liveRes = await httpRequest(`${baseUrl}/health`);
        assertEqual(liveRes.status, 200);
        const liveData = liveRes.json<{ status: string; storage: { status: string } }>();
        assertEqual(liveData.status, 'degraded');
        assertEqual(liveData.storage.status, 'unavailable');
      } finally {
        unlinkSync(boardsPath);
        unlinkSync(ydocsPath);
        mkdirSync(boardsPath, { recursive: true });
        mkdirSync(ydocsPath, { recursive: true });
      }

      const recoveredReady = await httpRequest(`${baseUrl}/health/ready`);
      assertEqual(recoveredReady.status, 200);
    });

    // =========================================================================
    // Execution
    // =========================================================================
    const summary = await runner.run();
    if (summary.failed > 0) {
      throw new Error(`Challenge suite failed with ${summary.failed} failure(s)`);
    }
  } finally {
    if (supervisor) {
      await supervisor.stop();
    }
  }
}

// CLI Execution Entrypoint
if (process.argv[1]?.endsWith('challenge-m1.ts') || process.argv[1]?.endsWith('challenge-m1.js')) {
  runChallengeM1().catch((err) => {
    console.error('Fatal Challenge M1 error:', err);
    process.exit(1);
  });
}
