# Handoff Report: Requirement R2 — System Health & Observability Endpoints

**Author**: Explorer Survey 2 (`teamwork_preview_explorer`)  
**Parent Agent**: `56ed3d31-582c-4406-a255-64a1f06d6aea`  
**Date**: 2026-09-03  
**Status**: Complete (Hard Handoff)

---

## 1. Observation

All observations were verified directly against the Canvio codebase (`d:\Canvio`):

### 1.1 Server Entrypoints and Health Routes
1. **Health Routes in `apps/server/src/combined-server.ts`**:
   - Lines 49–58:
     ```typescript
     app.get('/health', async () => ({ status: 'healthy', timestamp: new Date().toISOString() }));

     app.get('/health/ready', async (_request, reply) => {
       try {
         return await getReadiness();
       } catch (error) {
         app.log.error({ err: error }, 'Readiness check failed');
         return reply.code(503).send({ status: 'not_ready', storage: 'unavailable' });
       }
     });
     ```
   - Current `/health` returns only `{ status: 'healthy', timestamp: '...' }`. It omits uptime, memory metrics, active WebSocket connections, and storage state.
   - Endpoint `/api/health` does **not** exist anywhere in `apps/server`. A client querying `/api/health` receives a `404 Not Found`.
   - Root discovery route at lines 37–47 announces:
     ```typescript
     endpoints: {
       boards: '/api/boards',
       ai: '/api/ai',
       telemetry: '/api/telemetry/events',
       health: '/health',
     }
     ```
     Notice `/api/health` is not listed.

2. **Duplicate Routes in `apps/server/src/index.ts`**:
   - Lines 35–46 duplicate the exact same handler logic as `combined-server.ts`.
   - Lines 22–33 omit `health` entirely from the endpoint directory.
   - Standalone API (`index.ts`) does not mount a WebSocket server; `combined-server.ts` mounts both Fastify and WebSocketServer on a single port.

3. **Plain Text Handler in `apps/server/src/ws-server.ts`**:
   - Lines 16–19:
     ```typescript
     const server = http.createServer((request, response) => {
       response.writeHead(200, { 'Content-Type': 'text/plain' });
       response.end('Yjs WebSocket Server is running.');
     });
     ```
   - Has no JSON endpoint, no health check, and no Fastify integration.

### 1.2 WebSocket Connection Tracking
1. **Connection State in `apps/server/src/combined-server.ts`**:
   - Lines 70–73:
     ```typescript
     const wss = new WebSocketServer({ server: app.server, maxPayload: WS_MAX_PAYLOAD });

     let activeConnections = 0;
     const connectionsPerIp = new Map<string, number>();
     ```
   - Lines 100–113:
     ```typescript
     activeConnections += 1;
     connectionsPerIp.set(peerIp, currentForIp + 1);
     let released = false;
     const releaseConnection = () => {
       if (released) return;
       released = true;
       activeConnections -= 1;
       const remaining = (connectionsPerIp.get(peerIp) || 1) - 1;
       if (remaining <= 0) connectionsPerIp.delete(peerIp);
       else connectionsPerIp.set(peerIp, remaining);
     };
     conn.on('close', releaseConnection);
     conn.on('error', releaseConnection);
     ```
   - `activeConnections` is stored in a module-scoped lexical variable (`let activeConnections = 0`) that is completely inaccessible outside `combined-server.ts`.
   - The underlying `ws.WebSocketServer` instance (`wss`) also maintains `wss.clients`, which is a `Set<WebSocket>` containing all sockets currently connected at the protocol level.
   - `y-websocket` maintains an internal document registry in `node_modules/y-websocket/bin/utils.cjs`:
     - Line 66: `const docs = new Map()` exported as `exports.docs = docs;`
     - Each entry is a `WSSharedDoc` extending `Y.Doc` with `doc.conns: Map<WebSocket, Set<number>>`.
     - When all connections to a document disconnect, line 228 deletes the document from `docs`. Thus, `docs.size` represents active collaborative whiteboard sessions in memory.

### 1.3 System Metric Reporting
1. **Absence of Metrics**:
   - Ripgrep search across `apps/server` for `uptime` and `memoryUsage` returned 0 matches.
   - No route or helper currently invokes `process.uptime()`, `process.memoryUsage()`, or Node runtime inspection APIs.

2. **Available Standard Node.js APIs**:
   - `process.uptime()`: Returns process execution duration in seconds (float).
   - `process.memoryUsage()`: Returns `{ rss, heapTotal, heapUsed, external, arrayBuffers }` in bytes.
   - `process.version`, `process.pid`, `process.platform`, `process.arch`: Core runtime diagnostics.

### 1.4 Storage Persistence and Accessibility Checks
1. **Persistence Architecture in `apps/server/src/storage/`**:
   - `paths.ts` (line 4): `export const DATA_DIR = process.env.CANVIO_DATA_DIR || path.resolve(process.cwd(), 'data');`
   - `paths.ts` (lines 36–47): Atomic disk writes via `writeFileAtomic(filePath, contents)` (writes to `.tmp-...` then renames).
   - `boards.ts` (lines 27–35): Board metadata records stored in JSON format at `${DATA_DIR}/boards/${safeId(id)}.json`.
   - `yPersistence.ts` (lines 16–34): CRDT binary document snapshots stored via custom `createFilePersistence()` at `${DATA_DIR}/ydocs/${safeId(docName)}.bin`.
   - **Conclusion on Storage Type**: Canvio uses local filesystem storage with atomic file renames. It does **not** use LevelDB, SQLite, Redis, or an external database.

2. **Current Readiness Check in `apps/server/src/health.ts`**:
   - Lines 4–14:
     ```typescript
     export async function getReadiness() {
       const boardsDir = await ensureDataDir('boards');
       await fs.access(boardsDir, fs.constants.W_OK);

       return {
         status: 'ready',
         storage: 'ok',
         timestamp: new Date().toISOString(),
         dataDirConfigured: Boolean(DATA_DIR),
       };
     }
     ```
   - **Critical Vulnerability**: Only checks `boardsDir` (`data/boards`). It completely ignores `data/ydocs`, which is where all actual whiteboard canvas drawings, sticky notes, and relations are persisted!
   - `fs.access` only tests POSIX mode permission bits, not whether the underlying storage filesystem is full (`ENOSPC`) or mounted read-only.

### 1.5 Quality and Test Baseline
- `npm run typecheck`: Passed clean across all 6 packages (`@canvio/core`, `@canvio/objects`, `@canvio/ui`, `@canvio/collaboration`, `@canvio/web`, `@canvio/server`).
- `npm run test:unit`: Passed 29/29 tests in `scripts/unit/run-unit-tests.ts`.
- Zero automated test coverage currently exists for `/health`, `/health/ready`, or any server observability routes.

---

## 2. Logic Chain

1. **Premise 1 (R2 Mandate)**:
   Requirement R2 specifies:
   *"Expose standard production monitoring and liveness/readiness healthcheck endpoints (`/health` or `/api/health`) that report server uptime, memory consumption, active WebSocket connections, and storage accessibility."*
   And acceptance criteria states:
   *"`/health` endpoint returns HTTP 200 with JSON payload detailing uptime and service status."*

2. **Premise 2 (Deficiencies Identified in Observation 1.1 & 1.3)**:
   The current `/health` handler in both `index.ts` and `combined-server.ts` returns a static `{ status: 'healthy', timestamp: '...' }` object lacking uptime, memory usage, connection statistics, and storage health. Furthermore, `/api/health` does not exist (returns 404), which breaks standard API reverse-proxy patterns that route `/api/*` to the server.

3. **Premise 3 (WebSocket Tracking Silo in Observation 1.2)**:
   `activeConnections` is scoped locally inside `combined-server.ts`. A centralized health service module (`health.ts`) cannot query this counter unless an abstraction or connection provider interface is established. Furthermore, in standalone API execution (`index.ts`), WebSockets are not enabled, so health checks must gracefully report `0` active connections without crashing.

4. **Premise 4 (Storage Verification Gap in Observation 1.4)**:
   The whiteboard persistence model depends on two distinct directories:
   - `data/boards` (JSON metadata)
   - `data/ydocs` (binary Yjs state updates)
   The existing `getReadiness()` only checks `data/boards`. A failure in `data/ydocs` permissions would allow the server to report "ready" while every canvas edit fails to persist. Additionally, dynamic verification should verify read/write accessibility on both directories.

5. **Deduction & Architectural Synthesis**:
   Therefore, to satisfy R2 with enterprise production hardening:
   - Refactor `apps/server/src/health.ts` into a robust observability engine providing:
     1. Multi-directory storage accessibility verification (`boards` and `ydocs`).
     2. Process uptime and granular memory metric collection (`rss`, `heapTotal`, `heapUsed`, `external`, `arrayBuffers`) with human-friendly MB metrics.
     3. An extensible connection provider interface accepting callbacks for `getActiveConnections()` and `getActiveDocs()`.
     4. A centralized `registerHealthRoutes(app, options)` helper that registers both `/health` and `/api/health` (liveness) as well as `/health/ready` and `/api/health/ready` (readiness).
   - Wire `registerHealthRoutes` into `combined-server.ts` (passing the WebSocket counter and `ywsUtils.docs.size`) and into `index.ts` (with defaults).
   - Update server root `/` endpoint catalogs in `combined-server.ts` and `index.ts` to reflect the new endpoints.
   - Add unit tests verifying route response codes, JSON schema fields, memory metrics, and simulated storage failure states.

---

## 3. Caveats

1. **Read-Only Investigation Scope**:
   In compliance with the Explorer role boundaries, no application code or configuration was modified during this survey. Proposed changes are presented as complete code specifications below.
2. **Cluster / Multi-Node Considerations**:
   Canvio's current production target is a containerized single-node deployment (per Requirement R1). The connection counter tracks connections within the single Node.js process. In a distributed multi-node deployment (e.g. Redis pub/sub with horizontal scaling), active connection metrics would need aggregation across nodes; for single-node container deployment, process-level tracking is authoritative.
3. **High-Frequency Health Probes vs. Disk I/O**:
   Writing and deleting a temporary probe file on disk during *every* health check call could create I/O overhead if an orchestrator (like Kubernetes) probes every 2 seconds. A lightweight permission access check (`fs.access` with `R_OK | W_OK` on both `boards` and `ydocs`) provides microsecond response times with zero disk churn, while catching unmounted or read-only volume failures. An optional cached disk-write probe can run on startup and every 60s if deep write testing is desired.

---

## 4. Conclusion & Concrete Design Recommendations

### 4.1 Target JSON Payload Schemas

#### A. Liveness Endpoint: `GET /health` and `GET /api/health`
**Response (HTTP 200 OK)**:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "2026-09-03T12:00:00.000Z",
  "uptime": 345.12,
  "uptimeFormatted": "5m 45s",
  "process": {
    "pid": 4120,
    "nodeVersion": "v20.18.0",
    "platform": "win32",
    "arch": "x64",
    "environment": "development"
  },
  "memory": {
    "rss": 58720256,
    "heapTotal": 31457280,
    "heapUsed": 22134560,
    "external": 2457812,
    "arrayBuffers": 145020,
    "rssMb": 56.0,
    "heapTotalMb": 30.0,
    "heapUsedMb": 21.11
  },
  "connections": {
    "activeWebSocket": 14,
    "activeDocuments": 2,
    "maxConnections": 200
  },
  "storage": {
    "status": "ok",
    "accessible": true,
    "writable": true,
    "dataDir": "D:\\Canvio\\data",
    "type": "filesystem"
  }
}
```

#### B. Readiness Endpoint: `GET /health/ready` and `GET /api/health/ready`
**Response (HTTP 200 OK when ready)**:
```json
{
  "status": "ready",
  "timestamp": "2026-09-03T12:00:00.000Z",
  "uptime": 345.12,
  "storage": {
    "status": "ok",
    "accessible": true,
    "writable": true,
    "dataDir": "D:\\Canvio\\data",
    "boardsDir": "D:\\Canvio\\data\\boards",
    "ydocsDir": "D:\\Canvio\\data\\ydocs"
  }
}
```

**Response (HTTP 503 Service Unavailable when storage inaccessible)**:
```json
{
  "status": "not_ready",
  "timestamp": "2026-09-03T12:00:00.000Z",
  "storage": {
    "status": "unavailable",
    "accessible": false,
    "writable": false,
    "error": "EACCES: permission denied, access 'D:\\Canvio\\data\\ydocs'"
  }
}
```

---

### 4.2 Proposed Code Implementation

#### 1. Enhanced `apps/server/src/health.ts`
Replace the minimal 14-line `health.ts` with a comprehensive observability module:

```typescript
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DATA_DIR, ensureDataDir } from './storage/paths.js';

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

export function formatUptime(seconds: number): string {
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

export function getMemoryStats(): MemoryStats {
  const mem = process.memoryUsage();
  return {
    rss: mem.rss,
    heapTotal: mem.heapTotal,
    heapUsed: mem.heapUsed,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers,
    rssMb: Math.round((mem.rss / (1024 * 1024)) * 100) / 100,
    heapTotalMb: Math.round((mem.heapTotal / (1024 * 1024)) * 100) / 100,
    heapUsedMb: Math.round((mem.heapUsed / (1024 * 1024)) * 100) / 100,
  };
}

export async function checkStorageHealth(): Promise<StorageHealth> {
  try {
    const boardsDir = await ensureDataDir('boards');
    const ydocsDir = await ensureDataDir('ydocs');

    await fs.access(boardsDir, fs.constants.R_OK | fs.constants.W_OK);
    await fs.access(ydocsDir, fs.constants.R_OK | fs.constants.W_OK);

    return {
      status: 'ok',
      accessible: true,
      writable: true,
      dataDir: DATA_DIR,
      boardsDir,
      ydocsDir,
    };
  } catch (error) {
    const err = error as Error;
    return {
      status: 'unavailable',
      accessible: false,
      writable: false,
      dataDir: DATA_DIR,
      error: err.message || 'Storage inaccessible',
    };
  }
}

export async function getReadiness(): Promise<Record<string, unknown>> {
  const storage = await checkStorageHealth();
  if (!storage.writable) {
    throw new Error(storage.error || 'Storage is not writable');
  }

  return {
    status: 'ready',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime() * 100) / 100,
    storage,
  };
}

export async function getHealthReport(hooks: HealthConnectionHooks = {}): Promise<Record<string, unknown>> {
  const uptimeSeconds = process.uptime();
  const memory = getMemoryStats();
  const storage = await checkStorageHealth();

  const activeWebSocket = hooks.getActiveConnections ? hooks.getActiveConnections() : 0;
  const activeDocuments = hooks.getActiveDocs ? hooks.getActiveDocs() : 0;
  const maxConnections = hooks.getMaxConnections ? hooks.getMaxConnections() : 0;

  const isHealthy = storage.accessible && storage.writable;

  return {
    status: isHealthy ? 'healthy' : 'degraded',
    version: '0.1.0',
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
      ...(storage.error ? { error: storage.error } : {}),
    },
  };
}

export function registerHealthRoutes(app: FastifyInstance, hooks: HealthConnectionHooks = {}) {
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
        error: (error as Error).message,
      });
    }
  };

  // Register both /health and /api/health paths
  app.get('/health', livenessHandler);
  app.get('/api/health', livenessHandler);
  app.get('/health/ready', readinessHandler);
  app.get('/api/health/ready', readinessHandler);
}
```

---

#### 2. Integration into `apps/server/src/combined-server.ts`
Refactor lines 49–58 and wire the WebSocket statistics into `registerHealthRoutes`:

```typescript
// Replace lines 49-58 with:
registerHealthRoutes(app, {
  getActiveConnections: () => activeConnections,
  getActiveDocs: () => (ywsUtils.docs ? ywsUtils.docs.size : 0),
  getMaxConnections: () => WS_MAX_CONNECTIONS,
});
```

And update root route catalog (lines 41–46):
```typescript
endpoints: {
  boards: '/api/boards',
  ai: '/api/ai',
  telemetry: '/api/telemetry/events',
  health: '/health',
  apiHealth: '/api/health',
}
```

---

#### 3. Integration into `apps/server/src/index.ts`
Refactor lines 35–46:

```typescript
// Replace lines 35-46 with:
registerHealthRoutes(app);
```

And update root catalog (lines 27–32):
```typescript
endpoints: {
  boards: '/api/boards',
  ai: '/api/ai',
  telemetry: '/api/telemetry/events',
  health: '/health',
  apiHealth: '/api/health',
}
```

---

## 5. Verification Method

Once Requirement R2 is implemented, the implementation can be verified independently as follows:

### 5.1 Static Verification
1. **TypeScript Typecheck**:
   ```bash
   npm run typecheck
   ```
   Must exit with code 0 across all 6 workspace packages without any type errors in `apps/server`.

### 5.2 Automated Unit Testing
Add unit test assertions to `scripts/unit/run-unit-tests.ts` (or create `scripts/unit/server-health.test.ts`):
```typescript
import { getHealthReport, getMemoryStats, formatUptime, checkStorageHealth } from '../../apps/server/src/health';

test('health metrics report correct memory, uptime, and storage structures', async () => {
  const report = await getHealthReport({
    getActiveConnections: () => 5,
    getActiveDocs: () => 2,
    getMaxConnections: () => 200,
  });

  assert.equal(report.status, 'healthy');
  assert.equal(typeof report.uptime, 'number');
  assert.equal(typeof report.uptimeFormatted, 'string');
  assert.equal(typeof report.memory.rss, 'number');
  assert.equal(typeof report.memory.heapUsed, 'number');
  assert.equal(report.connections.activeWebSocket, 5);
  assert.equal(report.connections.activeDocuments, 2);
  assert.equal(report.storage.accessible, true);
  assert.equal(report.storage.writable, true);
});
```
Run with:
```bash
npm run test:unit
```
Expected outcome: 100% passing tests.

### 5.3 Live HTTP Route Verification
Start the server and execute:
```bash
# Verify /health returns HTTP 200 with complete JSON
curl -i http://localhost:4001/health

# Verify /api/health alias returns HTTP 200 with identical schema
curl -i http://localhost:4001/api/health

# Verify readiness probes
curl -i http://localhost:4001/health/ready
curl -i http://localhost:4001/api/health/ready
```
Verify:
- HTTP Status is 200 OK.
- `Content-Type` is `application/json; charset=utf-8`.
- JSON contains `uptime`, `memory`, `connections`, and `storage`.

### 5.4 Invalidation Conditions
The design is invalidated if:
1. `/api/health` returns 404 Not Found.
2. `/health` omits any of the four required categories (uptime, memory, connections, storage).
3. WebSocket connections increase during a test run without incrementing `report.connections.activeWebSocket`.
4. Making `data/ydocs` read-only fails to trigger a degraded or 503 response on `/health/ready`.
