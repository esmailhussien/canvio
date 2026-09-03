# Project: Canvio Production & Launch Hardening

## Architecture
Canvio is an enterprise-grade collaborative spatial whiteboard platform organized as a pure TypeScript monorepo managed via npm workspaces and Turborepo.

### Monorepo Workspaces:
1. `@canvio/core` (`packages/core`): Canonical spatial math, geometry (AABB, vectors), CRDT types, graph relations, layout algorithms.
2. `@canvio/objects` (`packages/objects`): Whiteboard living node definitions (stickies, text, shapes, frames, media, portals).
3. `@canvio/ui` (`packages/ui`): Reusable UI primitives, theme tokens, icons, and dialogs.
4. `@canvio/collaboration` (`packages/collaboration`): Real-time Yjs CRDT synchronization, presence/awareness protocols, and operational diff helpers.
5. `@canvio/server` (`apps/server`): Fastify HTTP API, AI endpoints, Yjs WebSocket collaboration server, atomic filesystem persistence (`data/boards`, `data/ydocs`).
6. `@canvio/web` (`apps/web`): React 19 SPA client with infinite 2.5D canvas, Leaflet map background integration, viewport culling, and 12 SSG prerendered marketing routes.

### Target Single-Node Architecture:
A single, unified Fastify + Yjs WebSocket process running under Node 20 Alpine in Docker:
- **Port**: Single unified port (default 4000).
- **HTTP/REST**: Fastify serves `/api/boards`, `/api/ai`, `/api/telemetry`.
- **Health & Observability**: `/health`, `/api/health`, `/health/ready`, `/api/health/ready`.
- **Static Assets**: `@fastify/static` serves compiled client from `apps/web/dist` with SPA fallback for `/w/*` and pre-rendered SSG route resolution.
- **Dynamic Config**: `GET /canvio-config.js` dynamically informs client of API and WebSocket URLs based on request host.
- **WebSockets**: `ws.WebSocketServer` attached to Fastify's HTTP server handles real-time Yjs CRDT sync and presence awareness on the same port.
- **Storage**: Local persistent volume mounted at `/app/data` with atomic writes to `boards/` and `ydocs/`.
- **Lifecycle**: POSIX signal handlers (`SIGINT`, `SIGTERM`) guarantee clean WebSocket close frames (code 1001), flushing pending debounced Yjs snapshots to disk, draining HTTP connections, and zero orphaned temp files.

---

## Feature Inventory
Every requirement and technical capability surveyed across Explorers 1, 2, and 3 is inventoried and assigned below:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Health Liveness Endpoint | `GET /health` & `GET /api/health` returning JSON with uptime, memory, active WS connections, storage status | M1 | R2 |
| 2 | Health Readiness Endpoint | `GET /health/ready` & `GET /api/health/ready` verifying read/write accessibility of `data/boards` & `data/ydocs` | M1 | R2 |
| 3 | Observability Metrics Engine | Memory stats (`rss`, `heapTotal`, `heapUsed`, MBs) and formatted uptime calculations in `apps/server/src/health.ts` | M1 | R2 |
| 4 | Active WebSocket Tracking Hook | Connection provider interface querying active sockets and active Yjs shared docs | M1 | R2 |
| 5 | Storage Multi-Directory Health Check | Verification of read and write access on both `data/boards` and `data/ydocs` | M1 | R2 |
| 6 | Yjs Persistence Flush Hook | `flushAll(): Promise<void>` in `yPersistence.ts` to immediately execute pending debounced writes | M1 | R4 |
| 7 | Process Signal Graceful Shutdown | `SIGINT`/`SIGTERM` handlers in `combined-server.ts` closing WebSockets (code 1001), flushing persistence, closing Fastify | M1 | R4 |
| 8 | Process Error & Rejection Traps | `unhandledRejection` and `uncaughtException` process listeners, sanitized 404/500 JSON error responses | M1 | R4 |
| 9 | Unified Static Frontend Serving | Fastify static plugin serving `apps/web/dist`, SSG route index matching, and SPA fallback for `/w/*` | M1 | R1 |
| 10 | Scoped Content-Security-Policy | Restrict `default-src 'none'` to `/api/*`; provide web-compatible CSP for frontend HTML/assets | M1 | R1 |
| 11 | Dynamic Runtime Config Route | `GET /canvio-config.js` serving host-relative `apiUrl` and `wsUrl` for zero-configuration port binding | M1 | R1 |
| 12 | Per-IP WebSocket Concurrency Limit | Configurable `CANVIO_WS_MAX_PER_IP` defaulting to >= 100 to support high-concurrency peers | M1 | R3 |
| 13 | Root `.dockerignore` | Exclusion of `node_modules`, `.git`, `.agents`, build caches, and test artifacts from Docker context | M2 | R1 |
| 14 | Multi-Stage Production Dockerfile | 3-stage `node:20-alpine` build (`deps` -> `builder` -> `runner`) producing minimal image (<250MB) | M2 | R1 |
| 15 | Container User & Security Hardening | Execution under non-root user `node`, mounted `/app/data` volume permissions, Docker `HEALTHCHECK` | M2 | R1 |
| 16 | Canvas Touchpad/Wheel RAF Batching | Batch wheel/trackpad pan updates in `useCanvasNavigation.ts` via `requestAnimationFrame` | M3 | R4 |
| 17 | Canvas 60fps Pan/Zoom Benchmark | Automated benchmark script (`scripts/benchmark-canvas.mjs`) mounting 100+ nodes and verifying >= 55 fps | M3 | R4 |
| 18 | Automated WebSocket Concurrency Test | Standalone script (`scripts/stress-websocket.ts`) connecting 32 simultaneous peers | M4 | R3 |
| 19 | Peer Sync & Awareness Simulation | Virtual clients executing handshake, continuous cursor presence broadcasts, and viewport panning | M4 | R3 |
| 20 | Concurrent Node Creation & Text Diffing | Concurrent sticky note creation and character-level diff inserts across all 32 peers | M4 | R3 |
| 21 | State Convergence & Reconnect Persistence | Verification of identical state vectors across 32 peers and persistence validation for 33rd client | M4 | R3 |
| 22 | Root NPM Script Integrations | Scripts `test:stress` and `benchmark:canvas` wired into root `package.json` | M4 | R3, R4 |
| 23 | Full E2E Hardening Verification | 100% verification across `typecheck`, `test:unit`, `build`, `smoke`, stress test, and Docker | M5 | R1-R4 |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Server Observability, Static Serving & Lifecycle | Fastify health endpoints, WS tracking, storage checks, persistence flush, graceful shutdown, static serving, CSP scoping, dynamic config | None | PLANNED |
| M2 | Multi-Stage Production Containerization | Root `.dockerignore`, 3-stage `node:20-alpine` `Dockerfile`, single-node runner setup, non-root user, healthcheck | M1 | PLANNED |
| M3 | Client Canvas Performance & 60fps Benchmark | Touchpad/wheel RAF batching in `useCanvasNavigation.ts`, `scripts/benchmark-canvas.mjs` verifying >= 55 fps with 100+ nodes | None | PLANNED |
| M4 | Automated Concurrency & WebSocket Stress Suite | Standalone `scripts/stress-websocket.ts`, 32 simultaneous peers, CRDT updates, reconnect persistence check, `npm run test:stress` | M1 | PLANNED |
| M5 | Final Verification & Adversarial Hardening | Pass 100% of E2E and unit test suites across all 6 packages, build validation, smoke verification, adversarial stress testing | M1, M2, M3, M4 | PLANNED |

---

## Interface Contracts

### 1. Observability (`apps/server/src/health.ts` ↔ Fastify App)
```typescript
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

export function registerHealthRoutes(app: FastifyInstance, hooks?: HealthConnectionHooks): void;
export function getHealthReport(hooks?: HealthConnectionHooks): Promise<Record<string, unknown>>;
export function getReadiness(): Promise<Record<string, unknown>>;
```

### 2. Yjs Persistence Lifecycle (`yPersistence.ts` ↔ Server Entrypoint)
```typescript
export interface FilePersistence {
  bindState: (docName: string, doc: WSSharedDoc) => void;
  writeState: (docName: string, doc: WSSharedDoc) => Promise<void>;
  flushAll: () => Promise<void>;
}
```

### 3. Runtime Config Endpoint (`GET /canvio-config.js` ↔ Frontend `runtimeConfig.ts`)
```javascript
window.CANVIO_CONFIG = {
  apiUrl: string, // relative '' or configured URL
  wsUrl: string   // dynamic ws(s)://<host>:<port> or configured URL
};
```

---

## Code Layout
- `apps/server/src/health.ts`: Centralized health and observability engine.
- `apps/server/src/combined-server.ts`: Single-node unified HTTP + WebSocket server entrypoint.
- `apps/server/src/storage/yPersistence.ts`: Yjs filesystem persistence with `flushAll()`.
- `apps/server/src/http.ts`: Security headers with route-scoped CSP and sanitized error handlers.
- `apps/web/src/components/Canvas/hooks/useCanvasNavigation.ts`: Canvas navigation with RAF wheel throttling.
- `Dockerfile`: Multi-stage production container.
- `.dockerignore`: Docker build context filters.
- `scripts/stress-websocket.ts`: Automated 32-peer concurrency and stress test harness.
- `scripts/benchmark-canvas.mjs`: Automated 100+ node canvas 60fps pan/zoom benchmark.
- `scripts/unit/run-unit-tests.ts`: Unit test suite.
