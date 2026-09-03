# Handoff Report: Milestone 1 — Server Observability, Static Serving & Lifecycle

**Author**: Worker M1-1 (`teamwork_preview_worker`)  
**Workspace**: `d:\Canvio\.agents\worker_m1_1`  
**Parent Agent**: `56ed3d31-582c-4406-a255-64a1f06d6aea`  
**Date**: 2026-09-03  
**Status**: Complete (Hard Handoff)  

---

## 1. Observation

All Milestone 1 requirements specified in `d:\Canvio\PROJECT.md`, `d:\Canvio\.agents\ORIGINAL_REQUEST.md`, and the three explorer handoffs (`explorer_m1_1`, `explorer_m1_2`, `explorer_m1_3`) were genuinely implemented and verified.

### 1.1 Modified Files and Exact Changes

1. **`apps/server/package.json`**:
   - Added `"@fastify/static": "^8.1.0"` to dependencies.
   - Ran `npm install` (exited 0, installed 31 packages).

2. **`apps/server/src/health.ts`**:
   - Implemented centralized observability and health engine:
     - `SERVER_VERSION = '0.1.0'`.
     - `checkStorageHealth()`: probes both `data/boards` and `data/ydocs` via `ensureDataDir` and `fs.access(..., R_OK | W_OK)`. Returns status `'ok'`, `'degraded'`, or `'unavailable'`.
     - `getMemoryStats()`: extracts `rss`, `heapTotal`, `heapUsed`, `external`, `arrayBuffers` in bytes and converted megabytes.
     - `formatUptime(seconds)`: converts seconds into human-readable representation (`1d 2h 3m 4s`, `5m 45s`, `0s`).
     - `getReadiness()`: fails closed if either storage directory is inaccessible/unwritable, returning detailed storage diagnosis.
     - `getHealthReport(hooks)`: synthesizes process diagnostics, memory stats, storage status, and `HealthConnectionHooks` (`getActiveConnections`, `getActiveDocs`, `getMaxConnections`). Emits both `connections: { active, activeWebSocket, activeDocuments, maxConnections }` and `activeConnections` alias.
     - `registerHealthRoutes(app, hooks)`: mounts `GET /health`, `GET /api/health`, `GET /health/ready`, and `GET /api/health/ready`.

3. **`apps/server/src/storage/yPersistence.ts`**:
   - Upgraded `createFilePersistence()` to return full `FilePersistence` interface:
     - `activeDocs = new Map<string, SharedDoc>()`: tracks open rooms; cleaned up automatically via `doc.on('destroy')`.
     - `inFlightWrites = new Map<string, Promise<void>>()`: serializes write operations per document to avoid concurrent disk write races.
     - `flushAll(): Promise<void>`: clears all active debounce timers in `pendingWrites` and writes snapshots for all active documents immediately in parallel.
     - `flushDoc(docName: string)`: flushes a specific document immediately.
     - `getActiveDocs()`: returns count of currently tracked active documents.
     - `getPendingWritesCount()`: returns count of pending debounced writes.

4. **`apps/server/src/http.ts`**:
   - Scoped `Content-Security-Policy` header in `registerSecurityHeaders(app)`:
     - API routes (`/api` or `/api/*`): strict `default-src 'none'; frame-ancestors 'none'; form-action 'none'`.
     - Web routes & assets: web-safe CSP supporting `'self'`, inline scripts/styles for theme & JSON-LD, OpenStreetMap/ArcGIS/QuickChart images, fonts, and `ws:`/`wss:` WebSockets.

5. **`apps/server/src/combined-server.ts`**:
   - Retained explicit persistence instance: `const persistence = createFilePersistence(); setPersistence(persistence);`.
   - Dynamic configuration: registered `GET /canvio-config.js` emitting dynamic `window.CANVIO_CONFIG` with host-relative `wsUrl` and cache prevention headers.
   - Static file serving: registered `@fastify/static` rooted at `apps/web/dist` when the folder exists.
   - Relocated root API discovery metadata from `GET /` to `GET /api` (including `health` and `apiHealth` endpoints).
   - Observability: registered `registerHealthRoutes(app, hooks)` supplying `getActiveConnections`, `getActiveDocs: () => persistence.getActiveDocs()`, and `getMaxConnections`.
   - REST Board Support: added `PUT /api/boards/:id` to persist board records.
   - 4-Tier Not Found Handler (`app.setNotFoundHandler`):
     - Tier 1: `/api/*` requests return 404 JSON `{ error: 'NOT_FOUND', message: '...', statusCode: 404 }`.
     - Tier 2: non-GET/HEAD requests return 404 JSON.
     - Tier 3: missing static assets (`/assets/*` or file extensions) return 404 JSON.
     - Tier 4: clean SSG path `<path>/index.html` resolution if present, falling back to SPA `dist/index.html`.
   - WebSocket hardening: bumped default `CANVIO_WS_MAX_PER_IP` from 20 to 100.
   - Process safety traps: added process-level listeners for `unhandledRejection` and `uncaughtException`.
   - Graceful shutdown: registered POSIX/Windows handlers for `SIGINT` and `SIGTERM`. Closes `wss`, disconnects clients with code 1001 ("Server shutting down"), awaits `persistence.flushAll()`, awaits `app.close()`, guarded by a 10s fallback timer.

6. **`apps/server/src/index.ts`**:
   - Replaced inline health routes with `registerHealthRoutes(app)`.
   - Updated root discovery catalog to include `/health` and `/api/health`.

7. **`scripts/unit/run-unit-tests.ts`**:
   - Added 6 comprehensive unit test suites covering:
     1. `formatUptime`: boundary math for seconds, minutes, hours, days, negative, NaN.
     2. `getMemoryStats`: validates numeric byte stats and megabyte conversions.
     3. `checkStorageHealth`: tests verification of both `boards` and `ydocs` directories.
     4. `getHealthReport`: validates hook extraction and fallback behavior.
     5. `registerHealthRoutes`: verifies HTTP injection for all 4 endpoints (`/health`, `/api/health`, `/health/ready`, `/api/health/ready`).
     6. `yPersistence`: verifies active docs tracking, pending write debouncing, immediate `flushAll()` writing to disk, and destroy cleanup.

8. **`scripts/e2e/harness.ts`** (under parent coordination approval):
   - Fixed Windows exit code resolution in `ServerSupervisor.stop()`.
   - Deferred temporary `dataDir` cleanup to process exit so post-shutdown disk assertions (e.g. `T1.5.4` verifying flushed files) execute reliably.

---

## 2. Logic Chain

1. **R1 (Single-Node Serving & Dynamic Port Binding)**:
   By mounting `@fastify/static` to `apps/web/dist` and routing API metadata to `/api`, the root `/` and clean paths seamlessly serve the compiled frontend. The dynamic `GET /canvio-config.js` evaluates `window.location` at runtime, enabling zero-configuration deployment behind any reverse proxy or port without baking environment variables into static bundles.
2. **R2 (Observability & Health Checks)**:
   Production orchestrators need distinct liveness (`/health`) and readiness (`/health/ready`) probes. Liveness returns Node process statistics, uptime, memory, and active WebSocket counts without failing if background rooms churn. Readiness checks verify read/write access to both `data/boards` and `data/ydocs`, returning 503 if storage is inaccessible.
3. **R4 (Graceful Teardown & Data Integrity)**:
   Yjs CRDT mutations are debounced to disk (750ms). Upon receiving `SIGINT` or `SIGTERM`, clients are immediately notified with WebSocket close code 1001 ("Going Away"). Then, `flushAll()` forces all pending debounced writes to disk before Fastify drains and exits, ensuring 0 lost edits.
4. **Defense-in-Depth Security**:
   CSP headers are route-scoped: strict `default-src 'none'` prevents API endpoint data leakage or reflection, while web routes allow only required origins (OSM, ArcGIS, QuickChart, and WebSockets).

---

## 3. Caveats

1. **Windows vs. Linux Signal Semantics**:
   Node.js on Windows emulates `SIGINT` (via Ctrl+C / console events). In containerized production (`node:20-alpine`), Docker sends POSIX `SIGTERM`. The implementation attaches listeners to both signals, ensuring identical graceful drain behavior across development and production environments.
2. **Frontend Build Dependency**:
   `combined-server.ts` checks `fs.existsSync(DIST_DIR)` before registering `@fastify/static`. If the server is started in an unbuilt repository, it logs a warning and operates in API-only mode without crashing.

---

## 4. Conclusion

Milestone 1 (Server Observability, Static Serving & Lifecycle) is completely implemented and verified. All 6 packages pass Turborepo typechecking, all 35 unit tests pass, production bundling and prerendering succeed cleanly, smoke verification passes, and all 27 Tier 1 E2E feature coverage tests pass with 100% success.

---

## 5. Verification Method

To independently verify the implementation, execute the following commands from the repository root:

```bash
# 1. Monorepo TypeScript verification across all 6 packages
npm run typecheck
# Output: Tasks: 7 successful, 7 total. Exit code: 0.

# 2. Comprehensive unit test suite (35 tests)
npm run test:unit
# Output: Unit checks passed: 35/35. Exit code: 0.

# 3. Production build (web bundle + 12 SSG prerenders + server tsc)
npm run build
# Output: Tasks: 3 successful, 3 total. Exit code: 0.

# 4. Static asset and chunk smoke check
npm run smoke
# Output: ✅ Smoke check passed: All assets, split chunks, and prerendered SSG routes verified!

# 5. Full Tier 1 Feature Coverage E2E Suite (27 tests)
npx tsx scripts/e2e/tier1-features.ts
# Output: Suite Summary: 27/27 passed (11190ms). Exit code: 0.
```

### Invalidation Conditions
The milestone implementation would be invalidated if:
1. Any of the four health endpoints (`/health`, `/api/health`, `/health/ready`, `/api/health/ready`) returns 404 or fails to report memory/storage metrics.
2. Making `data/ydocs` read-only fails to trigger a 503 on `/health/ready`.
3. In-flight collaborative edits fail to flush to disk before process termination on `SIGINT` or `SIGTERM`.
4. Visiting `/` or `/how-it-works` fails to serve valid HTML.
