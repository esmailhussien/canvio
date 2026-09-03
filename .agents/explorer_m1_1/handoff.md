# Handoff Report: Milestone 1 — Server Health & Observability Subsystem

**Author**: Explorer M1-1 (`teamwork_preview_explorer`)  
**Parent Agent**: `56ed3d31-582c-4406-a255-64a1f06d6aea`  
**Date**: 2026-09-03  
**Status**: Complete (Hard Handoff)

---

## 1. Observation

Direct investigation of the Canvio codebase (`d:\Canvio`) revealed the following exact facts and file locations:

### 1.1 Current Minimal Implementation in `apps/server/src/health.ts`
The existing `apps/server/src/health.ts` (15 lines total) contains only a rudimentary readiness check:
```typescript
1: import { promises as fs } from 'node:fs';
2: import { DATA_DIR, ensureDataDir } from './storage/paths.js';
3: 
4: export async function getReadiness() {
5:   const boardsDir = await ensureDataDir('boards');
6:   await fs.access(boardsDir, fs.constants.W_OK);
7: 
8:   return {
9:     status: 'ready',
10:     storage: 'ok',
11:     timestamp: new Date().toISOString(),
12:     dataDirConfigured: Boolean(DATA_DIR),
13:   };
14: }
```
**Deficiencies directly observed**:
- **Single directory check**: Only `boards` is checked. The `ydocs` directory (`data/ydocs`), where all binary Yjs CRDT state snapshots are stored by `apps/server/src/storage/yPersistence.ts`, is completely unmonitored.
- **Missing functions**: `checkStorageHealth()`, `getMemoryStats()`, `formatUptime()`, `getHealthReport()`, and `registerHealthRoutes()` do not exist.
- **Missing route registration**: Health route logic is duplicated inline in server entrypoints rather than defined centrally in `health.ts`.

### 1.2 Health Route Duplication & Incomplete Payloads in Entrypoints
1. **`apps/server/src/combined-server.ts`**:
   - Lines 49–58:
     ```typescript
     49: app.get('/health', async () => ({ status: 'healthy', timestamp: new Date().toISOString() }));
     50: 
     51: app.get('/health/ready', async (_request, reply) => {
     52:   try {
     53:     return await getReadiness();
     54:   } catch (error) {
     55:     app.log.error({ err: error }, 'Readiness check failed');
     56:     return reply.code(503).send({ status: 'not_ready', storage: 'unavailable' });
     57:   }
     58: });
     ```
   - Lines 37–47 announce root discovery endpoints:
     ```typescript
     41:   endpoints: {
     42:     boards: '/api/boards',
     43:     ai: '/api/ai',
     44:     telemetry: '/api/telemetry/events',
     45:     health: '/health',
     46:   },
     ```
   - Current `/health` returns only `{ status: 'healthy', timestamp: '...' }`. It omits uptime, memory statistics, active WebSocket connections, and storage state.
   - Endpoint `/api/health` and `/api/health/ready` do **not** exist (requests result in 404).

2. **`apps/server/src/index.ts`**:
   - Lines 35–46 duplicate the exact same inline handler logic.
   - Lines 27–32 omit `health` entirely from the root discovery endpoint catalog.

### 1.3 WebSocket Connection & Room State
In `apps/server/src/combined-server.ts`:
- Line 70: `const wss = new WebSocketServer({ server: app.server, maxPayload: WS_MAX_PAYLOAD });`
- Line 72: `let activeConnections = 0;` (lexical counter updated on socket connection/close).
- Line 67: `const WS_MAX_CONNECTIONS = readPositiveIntEnv('CANVIO_WS_MAX_CONNECTIONS', 200, 10, 10_000);`
- Line 10: `import ywsUtils from 'y-websocket/bin/utils';`
- Direct runtime inspection confirmed `ywsUtils.docs` is an active `Map<string, WSSharedDoc>`. Its `.size` property reflects the count of active collaborative document rooms in memory.

### 1.4 Test Infrastructure in `scripts/unit/run-unit-tests.ts`
- Lines 1–18 define an in-memory asynchronous test runner with `assert from 'node:assert/strict'`.
- Lines 128 & 246 demonstrate in-memory Fastify HTTP endpoint testing via `app.inject()` without binding physical TCP sockets.
- No unit tests currently exist for `health.ts` or server observability endpoints.

---

## 2. Logic Chain

1. **Premise 1 (R2 & Project Architecture Contract)**:
   Requirement R2 and `PROJECT.md` dictate exposing standard production monitoring and liveness/readiness healthcheck endpoints (`/health` and `/api/health`, `/health/ready` and `/api/health/ready`) that report server uptime, memory consumption, active WebSocket connections, and multi-directory storage accessibility.
2. **Premise 2 (Coupling & Separation of Concerns)**:
   In `combined-server.ts`, WebSockets and Fastify are co-hosted, whereas in `index.ts`, only the Fastify REST API runs. Hardcoding WebSocket references inside `health.ts` would break standalone server usage. Therefore, an extensible hooks interface (`HealthConnectionHooks`) is required so that callers can optionally supply connection counters (`getActiveConnections`, `getActiveDocs`, `getMaxConnections`).
3. **Premise 3 (Storage Integrity Boundary)**:
   Whiteboard state is divided across two directories:
   - `data/boards`: JSON board metadata
   - `data/ydocs`: Binary CRDT document snapshots
   If either directory is inaccessible or read-only, whiteboard editing and persistence degrade or fail. `checkStorageHealth()` must therefore test both `boards` and `ydocs` directories with `fs.constants.R_OK | fs.constants.W_OK`.
4. **Premise 4 (Readiness vs. Liveness Lifecycle)**:
   - **Liveness (`/health`, `/api/health`)**: Must return HTTP 200 to container orchestrators as long as the Node process is responsive. Returns detailed diagnostic payload including memory, uptime, process info, connection counts, and storage status.
   - **Readiness (`/health/ready`, `/api/health/ready`)**: Must return HTTP 200 only when storage is verified as writable and accessible; otherwise returns HTTP 503 Service Unavailable so load balancers stop forwarding traffic.
5. **Premise 5 (Verification Rigor)**:
   To prevent regressions, the unit test runner (`scripts/unit/run-unit-tests.ts`) must execute comprehensive assertions verifying:
   - `formatUptime()` time math across all boundary cases.
   - `getMemoryStats()` bytes and MB conversion accuracy.
   - `checkStorageHealth()` directory verification.
   - `getHealthReport()` hook extraction and fallback behavior.
   - Fastify route injection across all four HTTP endpoints.

---

## 3. Caveats

1. **Read-Only Explorer Constraint**:
   In strict accordance with the Teamwork Explorer rules, no production source code files have been modified. This handoff provides the exact drop-in implementation code for implementation agents.
2. **Filesystem vs. Cluster Storage**:
   Canvio utilizes local filesystem atomic writes (`data/boards` and `data/ydocs`) per Requirement R1 for single-node container deployment. If multi-node clustering is introduced in future architectures, active connection counters would need distributed pub/sub aggregation (e.g. Redis). For single-node deployment, in-process tracking is authoritative.
3. **`fs.access` vs Active Disk Write Probes**:
   `fs.access(dir, R_OK | W_OK)` verifies operating system read and write permissions without disk churn. Probing via temporary file writes on every request would generate excessive disk I/O under high-frequency orchestrator polling (e.g. every 2s).

---

## 4. Conclusion & Implementation Specifications

### 4.1 Specification 1: `apps/server/src/health.ts` (Full File Implementation)

Replace `apps/server/src/health.ts` in its entirety with the following complete, production-hardened implementation:

```typescript
import { promises as fs } from 'node:fs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DATA_DIR, ensureDataDir } from './storage/paths.js';

export const SERVER_VERSION = '0.1.0';

export interface HealthConnectionHooks {
  getActiveConnections?: () => number;
  getActiveDocs?: () => number;
  getMaxConnections?: () => number;
}

export interface StorageHealth {
  status: 'ok' | 'degraded' | 'unavailable';
  accessible: boolean;
  writable: boolean;
  dataDir: string;
  boardsDir?: string;
  ydocsDir?: string;
  error?: string;
}

export interface MemoryStats {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  rssMb: number;
  heapTotalMb: number;
  heapUsedMb: number;
}

/**
 * Formats a duration in seconds into a human-readable string (e.g., "1d 2h 3m 4s", "5m 45s", "0s").
 */
export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0s';
  const totalSeconds = Math.floor(seconds);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

/**
 * Gathers current Node.js process memory usage in bytes and converted megabytes.
 */
export function getMemoryStats(): MemoryStats {
  const mem = process.memoryUsage();
  const toMb = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 100) / 100;
  return {
    rss: mem.rss,
    heapTotal: mem.heapTotal,
    heapUsed: mem.heapUsed,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers,
    rssMb: toMb(mem.rss),
    heapTotalMb: toMb(mem.heapTotal),
    heapUsedMb: toMb(mem.heapUsed),
  };
}

/**
 * Checks storage accessibility and write permissions across both `boards` and `ydocs` directories.
 */
export async function checkStorageHealth(): Promise<StorageHealth> {
  let boardsDir: string | undefined;
  let ydocsDir: string | undefined;
  let boardsOk = false;
  let ydocsOk = false;
  const errors: string[] = [];

  try {
    boardsDir = await ensureDataDir('boards');
    await fs.access(boardsDir, fs.constants.R_OK | fs.constants.W_OK);
    boardsOk = true;
  } catch (err) {
    const message = (err as Error).message || 'boards directory inaccessible';
    errors.push(`boards: ${message}`);
  }

  try {
    ydocsDir = await ensureDataDir('ydocs');
    await fs.access(ydocsDir, fs.constants.R_OK | fs.constants.W_OK);
    ydocsOk = true;
  } catch (err) {
    const message = (err as Error).message || 'ydocs directory inaccessible';
    errors.push(`ydocs: ${message}`);
  }

  const allOk = boardsOk && ydocsOk;
  const noneOk = !boardsOk && !ydocsOk;
  const status: StorageHealth['status'] = allOk ? 'ok' : noneOk ? 'unavailable' : 'degraded';

  return {
    status,
    accessible: allOk,
    writable: allOk,
    dataDir: DATA_DIR,
    boardsDir,
    ydocsDir,
    ...(errors.length > 0 ? { error: errors.join('; ') } : {}),
  };
}

/**
 * Readiness probe: throws an error if storage is not ready and writable.
 */
export async function getReadiness(): Promise<Record<string, unknown>> {
  const storage = await checkStorageHealth();
  if (!storage.writable || !storage.accessible) {
    const message = storage.error || 'Storage is not writable or accessible';
    const error = new Error(message);
    (error as Error & { storage?: StorageHealth }).storage = storage;
    throw error;
  }

  return {
    status: 'ready',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime() * 100) / 100,
    storage,
  };
}

/**
 * Compiles a complete health report combining uptime, process info, memory, connection hooks, and storage.
 */
export async function getHealthReport(hooks: HealthConnectionHooks = {}): Promise<Record<string, unknown>> {
  const uptimeSeconds = process.uptime();
  const memory = getMemoryStats();
  const storage = await checkStorageHealth();

  const getSafeCount = (fn?: () => number) => {
    if (typeof fn !== 'function') return 0;
    try {
      const val = fn();
      return typeof val === 'number' && Number.isFinite(val) && val >= 0 ? val : 0;
    } catch {
      return 0;
    }
  };

  const activeWebSocket = getSafeCount(hooks.getActiveConnections);
  const activeDocuments = getSafeCount(hooks.getActiveDocs);
  const maxConnections = getSafeCount(hooks.getMaxConnections);

  const isHealthy = storage.accessible && storage.writable;

  return {
    status: isHealthy ? 'healthy' : 'degraded',
    version: SERVER_VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.round(uptimeSeconds * 100) / 100,
    uptimeFormatted: formatUptime(uptimeSeconds),
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      environment: process.env.NODE_ENV || 'development',
    },
    memory,
    connections: {
      activeWebSocket,
      activeDocuments,
      maxConnections,
    },
    storage: {
      status: storage.status,
      accessible: storage.accessible,
      writable: storage.writable,
      dataDir: storage.dataDir,
      type: 'filesystem',
      ...(storage.boardsDir ? { boardsDir: storage.boardsDir } : {}),
      ...(storage.ydocsDir ? { ydocsDir: storage.ydocsDir } : {}),
      ...(storage.error ? { error: storage.error } : {}),
    },
  };
}

/**
 * Registers `/health`, `/api/health`, `/health/ready`, and `/api/health/ready` on a Fastify instance.
 */
export function registerHealthRoutes(app: FastifyInstance, hooks: HealthConnectionHooks = {}): void {
  const livenessHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
    const report = await getHealthReport(hooks);
    return reply.code(200).send(report);
  };

  const readinessHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const readyReport = await getReadiness();
      return reply.code(200).send(readyReport);
    } catch (error) {
      app.log.error({ err: error }, 'Readiness check failed');
      return reply.code(503).send({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        storage: 'unavailable',
        error: (error as Error).message || 'Storage unavailable',
      });
    }
  };

  app.get('/health', livenessHandler);
  app.get('/api/health', livenessHandler);
  app.get('/health/ready', readinessHandler);
  app.get('/api/health/ready', readinessHandler);
}
```

---

### 4.2 Specification 2: Integration into `apps/server/src/combined-server.ts`

1. **Update Imports (Line 19)**:
   ```typescript
   // BEFORE:
   import { getReadiness } from './health.js';

   // AFTER:
   import { registerHealthRoutes } from './health.js';
   ```

2. **Update Root Catalog (Lines 41–46)**:
   ```typescript
   // BEFORE:
     endpoints: {
       boards: '/api/boards',
       ai: '/api/ai',
       telemetry: '/api/telemetry/events',
       health: '/health',
     },

   // AFTER:
     endpoints: {
       boards: '/api/boards',
       ai: '/api/ai',
       telemetry: '/api/telemetry/events',
       health: '/health',
       apiHealth: '/api/health',
     },
   ```

3. **Replace Inline Routes (Lines 49–58) with Hooked Route Registration**:
   Remove the inline `/health` and `/health/ready` routes from lines 49–58.
   Place `registerHealthRoutes` immediately after the WebSocket setup (lines 70–73):
   ```typescript
   const wss = new WebSocketServer({ server: app.server, maxPayload: WS_MAX_PAYLOAD });

   let activeConnections = 0;
   const connectionsPerIp = new Map<string, number>();

   registerHealthRoutes(app, {
     getActiveConnections: () => activeConnections,
     getActiveDocs: () => (ywsUtils?.docs instanceof Map ? ywsUtils.docs.size : 0),
     getMaxConnections: () => WS_MAX_CONNECTIONS,
   });
   ```

---

### 4.3 Specification 3: Integration into `apps/server/src/index.ts`

1. **Update Imports (Line 9)**:
   ```typescript
   // BEFORE:
   import { getReadiness } from './health.js';

   // AFTER:
   import { registerHealthRoutes } from './health.js';
   ```

2. **Update Root Catalog (Lines 27–32)**:
   ```typescript
   // BEFORE:
       endpoints: {
         boards: '/api/boards',
         ai: '/api/ai',
         telemetry: '/api/telemetry/events',
       },

   // AFTER:
       endpoints: {
         boards: '/api/boards',
         ai: '/api/ai',
         telemetry: '/api/telemetry/events',
         health: '/health',
         apiHealth: '/api/health',
       },
   ```

3. **Replace Lines 35–46**:
   ```typescript
   // BEFORE:
   app.get('/health', async () => {
     return { status: 'healthy', timestamp: new Date().toISOString() };
   });

   app.get('/health/ready', async (_request, reply) => {
     try {
       return await getReadiness();
     } catch (error) {
       app.log.error({ err: error }, 'Readiness check failed');
       return reply.code(503).send({ status: 'not_ready', storage: 'unavailable' });
     }
   });

   // AFTER:
   registerHealthRoutes(app);
   ```

---

### 4.4 Specification 4: Unit Test Assertions for `scripts/unit/run-unit-tests.ts`

Add the following assertions inside `scripts/unit/run-unit-tests.ts`:

1. **Add Dynamic Import (around line 146)**:
   ```typescript
   const {
     checkStorageHealth,
     formatUptime,
     getHealthReport,
     getMemoryStats,
     getReadiness,
     registerHealthRoutes,
   } = await import('../../apps/server/src/health');
   ```

2. **Add Test Cases (before line 1049 `let passed = 0;`)**:
   ```typescript
   test('formatUptime correctly formats seconds across zero, minute, hour, and day boundaries', () => {
     assert.equal(formatUptime(0), '0s');
     assert.equal(formatUptime(45), '45s');
     assert.equal(formatUptime(60), '1m 0s');
     assert.equal(formatUptime(345), '5m 45s');
     assert.equal(formatUptime(3600), '1h 0s');
     assert.equal(formatUptime(3665), '1h 1m 5s');
     assert.equal(formatUptime(86400), '1d 0s');
     assert.equal(formatUptime(90061), '1d 1h 1m 1s');
     assert.equal(formatUptime(-10), '0s');
     assert.equal(formatUptime(Number.NaN), '0s');
   });

   test('getMemoryStats returns positive byte and megabyte metrics', () => {
     const mem = getMemoryStats();
     assert.equal(typeof mem.rss, 'number');
     assert.equal(typeof mem.heapTotal, 'number');
     assert.equal(typeof mem.heapUsed, 'number');
     assert.equal(typeof mem.external, 'number');
     assert.equal(typeof mem.arrayBuffers, 'number');
     assert.equal(typeof mem.rssMb, 'number');
     assert.equal(typeof mem.heapTotalMb, 'number');
     assert.equal(typeof mem.heapUsedMb, 'number');

     assert.ok(mem.rss > 0, 'rss should be positive');
     assert.ok(mem.heapTotal > 0, 'heapTotal should be positive');
     assert.ok(mem.heapUsed > 0, 'heapUsed should be positive');
     assert.ok(mem.rssMb > 0, 'rssMb should be positive');
     assert.ok(mem.heapTotalMb > 0, 'heapTotalMb should be positive');
     assert.ok(mem.heapUsedMb > 0, 'heapUsedMb should be positive');

     const expectedRssMb = Math.round((mem.rss / (1024 * 1024)) * 100) / 100;
     assert.equal(mem.rssMb, expectedRssMb);
   });

   test('checkStorageHealth verifies both boards and ydocs directories', async () => {
     const storage = await checkStorageHealth();
     assert.equal(storage.status, 'ok');
     assert.equal(storage.accessible, true);
     assert.equal(storage.writable, true);
     assert.equal(typeof storage.dataDir, 'string');
     assert.ok(storage.boardsDir && storage.boardsDir.includes('boards'), 'boardsDir must contain boards');
     assert.ok(storage.ydocsDir && storage.ydocsDir.includes('ydocs'), 'ydocsDir must contain ydocs');
     assert.equal(storage.error, undefined);
   });

   test('getHealthReport integrates connection hooks, process diagnostics, and storage status', async () => {
     const reportWithHooks = await getHealthReport({
       getActiveConnections: () => 24,
       getActiveDocs: () => 5,
       getMaxConnections: () => 200,
     });

     assert.equal(reportWithHooks.status, 'healthy');
     assert.equal(reportWithHooks.version, '0.1.0');
     assert.equal(typeof reportWithHooks.timestamp, 'string');
     assert.equal(typeof reportWithHooks.uptime, 'number');
     assert.equal(typeof reportWithHooks.uptimeFormatted, 'string');

     const proc = reportWithHooks.process as Record<string, unknown>;
     assert.equal(typeof proc.pid, 'number');
     assert.equal(typeof proc.nodeVersion, 'string');
     assert.equal(typeof proc.platform, 'string');

     const conns = reportWithHooks.connections as Record<string, number>;
     assert.equal(conns.activeWebSocket, 24);
     assert.equal(conns.activeDocuments, 5);
     assert.equal(conns.maxConnections, 200);

     const stor = reportWithHooks.storage as Record<string, unknown>;
     assert.equal(stor.status, 'ok');
     assert.equal(stor.accessible, true);
     assert.equal(stor.writable, true);
     assert.equal(stor.type, 'filesystem');

     const defaultReport = await getHealthReport();
     const defaultConns = defaultReport.connections as Record<string, number>;
     assert.equal(defaultConns.activeWebSocket, 0);
     assert.equal(defaultConns.activeDocuments, 0);
     assert.equal(defaultConns.maxConnections, 0);

     const readiness = await getReadiness();
     assert.equal(readiness.status, 'ready');
     assert.equal(typeof readiness.uptime, 'number');
     const readStor = readiness.storage as Record<string, unknown>;
     assert.equal(readStor.status, 'ok');
     assert.equal(readStor.writable, true);
   });

   test('registerHealthRoutes mounts /health, /api/health, and readiness endpoints with accurate responses', async () => {
     const app = Fastify({ logger: false });
     registerHealthRoutes(app, {
       getActiveConnections: () => 8,
       getActiveDocs: () => 3,
       getMaxConnections: () => 100,
     });

     // 1. GET /health
     const resLiveness = await app.inject({ method: 'GET', url: '/health' });
     assert.equal(resLiveness.statusCode, 200);
     assert.match(resLiveness.headers['content-type'] || '', /application\/json/);
     const liveBody = JSON.parse(resLiveness.payload);
     assert.equal(liveBody.status, 'healthy');
     assert.equal(liveBody.connections.activeWebSocket, 8);
     assert.equal(liveBody.connections.activeDocuments, 3);
     assert.equal(liveBody.connections.maxConnections, 100);
     assert.equal(liveBody.storage.status, 'ok');

     // 2. GET /api/health (alias)
     const resApiLiveness = await app.inject({ method: 'GET', url: '/api/health' });
     assert.equal(resApiLiveness.statusCode, 200);
     const apiLiveBody = JSON.parse(resApiLiveness.payload);
     assert.equal(apiLiveBody.status, 'healthy');
     assert.equal(apiLiveBody.connections.activeWebSocket, 8);

     // 3. GET /health/ready
     const resReadiness = await app.inject({ method: 'GET', url: '/health/ready' });
     assert.equal(resReadiness.statusCode, 200);
     const readyBody = JSON.parse(resReadiness.payload);
     assert.equal(readyBody.status, 'ready');
     assert.equal(readyBody.storage.accessible, true);
     assert.equal(readyBody.storage.writable, true);

     // 4. GET /api/health/ready (alias)
     const resApiReadiness = await app.inject({ method: 'GET', url: '/api/health/ready' });
     assert.equal(resApiReadiness.statusCode, 200);
     const apiReadyBody = JSON.parse(resApiReadiness.payload);
     assert.equal(apiReadyBody.status, 'ready');

     await app.close();
   });
   ```

---

## 5. Verification Method

To verify the implementation once applied:

### 5.1 Type Verification
Execute the monorepo-wide TypeScript typechecker:
```bash
npm run typecheck
```
**Expected outcome**: Exits with code 0 across all 6 packages (`@canvio/core`, `@canvio/objects`, `@canvio/ui`, `@canvio/collaboration`, `@canvio/web`, `@canvio/server`).

### 5.2 Unit Test Verification
Execute the test runner containing the new assertions:
```bash
npm run test:unit
```
**Expected outcome**: Exits with code 0 and passes 100% of tests (all 5 new test suites passing alongside existing 29 tests, totaling 34 passing tests).

### 5.3 Live HTTP Verification
Start the combined server (`npm run start:ws` or `tsx apps/server/src/combined-server.ts`) and execute:
```bash
# Verify liveness endpoints
curl -i http://localhost:4001/health
curl -i http://localhost:4001/api/health

# Verify readiness endpoints
curl -i http://localhost:4001/health/ready
curl -i http://localhost:4001/api/health/ready
```
**Expected outcome**:
1. All 4 endpoints respond with HTTP 200 OK and `Content-Type: application/json; charset=utf-8`.
2. `/health` and `/api/health` return payload containing `uptime`, `uptimeFormatted`, `memory` (`rss`, `heapTotal`, `heapUsed`, MBs), `connections` (`activeWebSocket`, `activeDocuments`, `maxConnections`), and `storage`.
3. `/health/ready` and `/api/health/ready` return payload containing `status: "ready"` and `storage` details with both `boardsDir` and `ydocsDir`.

### 5.4 Invalidation Conditions
The implementation is invalidated if:
1. `/api/health` or `/api/health/ready` returns 404 Not Found.
2. `/health` omits any required telemetry field (`uptime`, `memory`, `connections`, `storage`).
3. Making `data/ydocs` read-only fails to cause `/health/ready` to return HTTP 503.
4. Starting `apps/server/src/index.ts` without WebSockets throws an error during health check invocation.
