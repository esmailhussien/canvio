# Technical Investigation Report: Requirements R3 & R4
**Milestone:** Production & Launch Hardening — Concurrency, Lifecycle, Security & Performance  
**Author:** Explorer Survey 3 (`teamwork_preview_explorer`)  
**Target Requirements:**  
- **R3:** Automated Concurrency & WebSocket Stress Testing (30+ simultaneous peers, CRDT updates, no drops/leaks)  
- **R4:** Production Hardening & Performance Validation (SIGINT/SIGTERM graceful shutdown, 60fps pan/zoom with 100+ nodes, security posture & rate limiting)

---

## 1. Observation

### 1.1 Existing Testing Setup Across All Packages
- **Root Scripts and Tools (`package.json:7-17, 18-23`)**:
  - Root scripts define:
    ```json
    "test:unit": "tsx scripts/unit/run-unit-tests.ts",
    "typecheck": "turbo typecheck",
    "build": "turbo build",
    "smoke": "node scripts/smoke-check.mjs",
    "e2e:smoke": "npm run build && node scripts/e2e-smoke.mjs"
    ```
  - Dev dependencies include `@playwright/test: ^1.61.1`, `tsx: ^4.20.0`, `turbo: ^2.5.0`, `typescript: ^5.8.0`.
  - **No Vitest or Jest**: Grep verification across all workspaces revealed zero configurations or dependencies for Vitest or Jest.
- **Unit Testing Architecture (`scripts/unit/run-unit-tests.ts:1-20, 1050-1068`)**:
  - The repository utilizes a custom, lightweight, in-house unit testing framework using Node's native `assert/strict` and executed via `tsx`.
  - `installBrowserMocks()` (`lines 20-66`) mocks minimal browser globals: `window`, `localStorage`, `document`, `matchMedia`, and `crypto`.
  - Fastify route unit tests use Fastify's built-in `app.inject()` (`lines 269-281`) to test endpoints in-process without port binding.
  - Test execution: 29 suites ran and passed in 3.9s (`Unit checks passed: 29/29`).
- **Smoke and E2E Verification**:
  - `scripts/smoke-check.mjs:17-90`: Verifies `dist/index.html`, runtime config, sitemap, robots.txt, 8 prerendered SSG marketing routes, split chunks (`vendor-react`, `vendor-map`, `vendor-collaboration`), and enforces bundle budget (< 500 KB per chunk).
  - `scripts/e2e-smoke.mjs:1-100`: Spawns a Vite preview server (`127.0.0.1:4187`), boots Chromium via `@playwright/test`, and validates starter dismissal, canvas tools, node creation, and export menus.
- **TypeScript Verification (`turbo.json:14-16`)**:
  - `npm run typecheck` runs `turbo typecheck` across all 6 packages (`@canvio/core`, `@canvio/objects`, `@canvio/ui`, `@canvio/collaboration`, `@canvio/web`, `@canvio/server`) and exits with code 0.

---

### 1.2 Collaboration Protocol Architecture
- **Server WebSocket Integration (`apps/server/src/combined-server.ts:8-25, 70-120`)**:
  - Server imports `y-websocket/bin/utils`: `const { setupWSConnection, setPersistence } = ywsUtils;`.
  - Configures file persistence via `setPersistence(createFilePersistence());`.
  - Creates WebSocket server: `const wss = new WebSocketServer({ server: app.server, maxPayload: WS_MAX_PAYLOAD });`.
  - Connection hook:
    ```typescript
    wss.on('connection', async (conn, req) => {
      // 1. Connection capacity check (WS_MAX_CONNECTIONS)
      // 2. Per-IP check (WS_MAX_PER_IP)
      // 3. Board authorization (authorizeWebSocketBoard)
      // 4. Setup Yjs connection:
      setupWSConnection(conn, req, { docName: boardId });
    });
    ```
- **CRDT Document Structure & Helper Encoding (`packages/collaboration/src/yjsHelpers.ts:1-175`)**:
  - Shared Yjs Document manages two root maps: `yNodes = doc.getMap('nodes')` and `yRelations = doc.getMap('relations')`.
  - `nodeToYMap(node: LivingNode)` decomposes properties into a `Y.Map`. Text-bearing fields in `data` (`code`, `content`, `filename`, `label`, `text`, `title`) are transformed into `Y.Text` instances (`lines 4, 77-87`), enabling fine-grained character-level operational diffing via `applyTextDiff(ytext, value)` (`lines 45-75`).
  - Viewport-derived ephemeral data (`markerAnchors`) is explicitly excluded (`EPHEMERAL_DATA_KEYS`, `lines 9-13`).
- **Presence and Awareness Protocol (`apps/web/src/hooks/useCollaboration.ts:299-319, 527-559`)**:
  - Handled via `y-protocols/awareness` within `wsProvider.awareness`.
  - State format:
    ```typescript
    awareness.setLocalState({
      user: { name: userName, color: userColor },
      cursor: { x: worldX, y: worldY }, // or null
      selectedNodeIds: string[]
    });
    ```
  - Viewport coordinates `(viewport.x, viewport.y, viewport.zoom)` remain local to each client and are never synced to CRDT or awareness to prevent camera fighting (`lines 386-389`).
  - Cursor tracking transforms screen `(clientX, clientY)` to canvas world coordinates using current viewport offset/zoom during `pointermove` (`lines 537-546`).
- **Wire Protocol Mechanics (`node_modules/y-websocket/src/y-websocket.js:20-96`)**:
  - Binary framing using `lib0/encoding` and `lib0/decoding`.
  - `messageSync = 0`: Handshake Step 1 (state vector exchange), Step 2 (missing blocks diff), and subsequent incremental `messageYjsUpdate = 2`.
  - `messageAwareness = 1`: Ephemeral JSON presence packets.
  - `messageAuth = 2`: Authentication message.
  - `messageQueryAwareness = 3`: Awareness query.

---

### 1.3 Concurrency & Stress Testing Landscape
- **Current State**:
  - Zero load-testing or WebSocket stress-testing scripts exist in the repository (search for `*stress*` returned 0 results).
- **Critical Concurrency Constraints & Traps**:
  1. **Per-IP Connection Throttling (`apps/server/src/combined-server.ts:68, 85-89`)**:
     ```typescript
     const WS_MAX_PER_IP = readPositiveIntEnv('CANVIO_WS_MAX_PER_IP', 20, 1, 1_000);
     ...
     const currentForIp = connectionsPerIp.get(peerIp) || 0;
     if (currentForIp >= WS_MAX_PER_IP) {
       conn.close(1013, 'Too many connections from this address');
       return;
     }
     ```
     *Impact:* `WS_MAX_PER_IP` defaults to 20. If 30+ virtual clients connect from `127.0.0.1` without custom headers or environment configuration, the 21st client is abruptly closed with code 1013.
  2. **WebSocket Origin Requirement (`apps/server/src/wsAccess.ts:19-25`)**:
     ```typescript
     if (!req.headers.origin && !envBool('CANVIO_ALLOW_NO_ORIGIN_WS', false)) {
       return { ok: false as const, code: 1008, reason: 'Origin required' };
     }
     if (!isOriginAllowed(req.headers.origin)) {
       return { ok: false as const, code: 1008, reason: 'Origin not allowed' };
     }
     ```
     *Impact:* Scripted clients connecting from Node without supplying an `Origin` header (such as `http://localhost:4001` or `http://127.0.0.1:4001`) are rejected with code 1008.
  3. **Snapshot Write Debounce Window (`apps/server/src/storage/yPersistence.ts:48-60`)**:
     Document writes are scheduled with a 750ms debounce:
     ```typescript
     pendingWrites.set(docName, setTimeout(() => {
       pendingWrites.delete(docName);
       writeSnapshot(docName, doc).catch(...);
     }, 750));
     ```
     *Impact:* Stress testing disconnect/reconnect persistence must account for this 750ms debounce before verifying on-disk snapshot durability.

---

### 1.4 Process Lifecycle & Shutdown
- **Shutdown Handling (`apps/server/src/combined-server.ts:122-132`, `apps/server/src/index.ts:54-64`, `apps/server/src/ws-server.ts:41-44`)**:
  - `combined-server.ts` simply calls `app.listen(...)` and has **zero signal listeners** for `SIGINT` or `SIGTERM`.
  - Fastify HTTP server `app.close()` is never invoked.
  - WebSocket server `wss.close()` is never invoked; active client connections are killed abruptly by OS process termination without standard WebSocket close frames (`1001 Going Away`).
  - `createFilePersistence()` (`apps/server/src/storage/yPersistence.ts:47-82`) maintains an internal `pendingWrites` timer map with no exposed flush mechanism. In-flight debounced updates are lost on sudden process exit.
  - Atomic writes in `writeFileAtomic` (`apps/server/src/storage/paths.ts:36-47`) create temporary files (`.tmp-${process.pid}-${Date.now()}-...`). Abrupt termination during write leaves orphaned `.tmp` files.

---

### 1.5 Security Posture & Error Sanitization
- **HTTP Error Handling (`apps/server/src/http.ts:57-79`)**:
  - `registerErrorHandler` sanitizes status >= 500 errors to:
    ```json
    {
      "error": "INTERNAL_SERVER_ERROR",
      "message": "Canvio could not complete the request.",
      "requestId": "..."
    }
    ```
  - Logs unhandled errors using Pino serializer with redacted credentials (`authorization`, `x-canvio-api-key`, `x-canvio-share-token`, `cookie`).
  - **Gaps**:
    - No process-level `unhandledRejection` or `uncaughtException` listeners in `combined-server.ts` or `index.ts`. If an async error rejects outside Fastify route scope (e.g. in WebSocket callback or persistence timer), Node crashes.
    - No 404 `setNotFoundHandler` customization; Fastify emits raw default 404 payload.
- **Rate Limiting (`apps/server/src/security.ts:98-169`)**:
  - Sliding window memory limiter `createRateLimitHook` keys on IP or Bearer token hash (`getRequestRateLimitKey`).
  - Active on AI routes (`/api/ai/*`), board routes (`/api/boards/*`), and telemetry (`/api/telemetry/*`).
  - Global rate limiter `createGlobalRateLimitHook` acts as a second backstop.
  - WebSocket connections enforce `WS_MAX_CONNECTIONS` (default 200) and `WS_MAX_PER_IP` (default 20), but there is no rate limiting on the message frequency within an established WebSocket connection.

---

### 1.6 Client Canvas 60fps Pan/Zoom Performance (100+ Nodes)
- **Viewport Culling (`apps/web/src/components/Canvas/hooks/useViewportCulling.ts:28-74`)**:
  - Computes world-space viewport bounding box plus a 400px margin (`marginPx = 400`).
  - When `nodes.length > 15`, filters out nodes that do not intersect the viewport bounding box (unless selected or part of an active relation).
- **Component Memoization (`apps/web/src/components/NodeRenderer/NodeRenderer.tsx:786-788`)**:
  - `export const NodeRenderer = memo(NodeRendererComponent);`.
  - Node object references in Zustand store are stable during panning/zooming, allowing React to skip re-rendering node component subtrees.
- **Hardware Acceleration (`apps/web/src/components/Canvas/Canvas.css:100-110`)**:
  - Panning is applied to parent container `.canvas__world` via `transform: translate(...) scale(...)`.
  - `.canvas--panning .canvas__world { will-change: transform; }` activates GPU compositing layer.
  - Drag panning in `Canvas.tsx:133-161` batches updates using `window.requestAnimationFrame` (`panFrameRef`, `queuePan`).
- **Spatial Relation Path Caching (`apps/web/src/components/RelationRenderer/RelationRenderer.tsx:156-185`)**:
  - `allBounds` is memoized on `[nodes]`.
  - `pathCacheRef` stores computed relation routing geometry; invalidated only when `nodes` collection mutates, bypassing expensive obstacle-routing during pan/zoom.
- **Performance Gap**:
  - In `apps/web/src/components/Canvas/hooks/useCanvasNavigation.ts:36-60`, `handleWheel` invokes `panBy` directly on every wheel event without `requestAnimationFrame` batching. High-frequency touchpad events trigger rapid Zustand store dispatches.

---

## 2. Logic Chain

### 2.1 Concurrency & Stress Testing (R3)
1. **Premise**: Requirement R3 demands an automated load-testing verification script simulating at least 30 simultaneous peers writing, panning, and synchronizing CRDT updates over WebSockets without drops, corruption, or leaks.
2. **Analysis of Constraints**:
   - In `combined-server.ts:68`, `CANVIO_WS_MAX_PER_IP` defaults to 20.
   - If a test script spawns 30 clients from `127.0.0.1`, connection #21 will be terminated by the server with code 1013 (`Observation 1.3.1`).
   - In `wsAccess.ts:19-25`, non-browser WebSocket clients without an `Origin` header are rejected with code 1008 (`Observation 1.3.2`).
   - Virtual clients must therefore:
     - Connect with an explicit `Origin: http://127.0.0.1:4001` header.
     - Supply distinct `x-forwarded-for` addresses (e.g. `10.0.0.${i}`) OR the test command must run with `CANVIO_WS_MAX_PER_IP=100`.
3. **Execution Mechanism**:
   - Virtual peers can be implemented using `y-websocket`'s `WebsocketProvider` by supplying a custom `WebSocketPolyfill` wrapping `ws` with appropriate headers (`Observation 1.2, 1.3`).
   - Each virtual peer subscribes to the same room (`stress-board-${Date.now()}`).
   - Peers synchronize initial state, simulate panning by emitting awareness cursor updates, and simulate writing by modifying `doc.getMap('nodes')`.
   - Durability across disconnects is verified by disconnecting all peers, waiting > 750ms for persistence debounce (`Observation 1.3.3`), connecting peer #31, and asserting state equality.

### 2.2 Process Lifecycle & Graceful Shutdown (R4)
1. **Premise**: Requirement R4 requires clean shutdown on SIGINT/SIGTERM without hanging connections or orphaned files.
2. **Analysis of Current State**:
   - Zero signal handlers exist in `combined-server.ts` (`Observation 1.4`).
   - Sending `SIGTERM` terminates Node immediately.
   - Any edits made in the preceding 750ms residing in `pendingWrites` (`yPersistence.ts`) are discarded (`Observation 1.3.3`).
   - Connected WebSocket clients experience unclean socket drop (`ECONNRESET`) rather than receiving close frame 1001 (`Observation 1.4`).
3. **Remediation Logic**:
   - `yPersistence.ts` must expose a `flushAll(): Promise<void>` method that immediately clears all debounce timers and awaits all snapshot atomic writes.
   - `combined-server.ts` must register `process.on('SIGINT', shutdown)` and `process.on('SIGTERM', shutdown)`.
   - The shutdown sequence must:
     1. Stop accepting new connections (`wss.close()`).
     2. Gracefully close open client sockets with code 1001.
     3. Await `persistence.flushAll()`.
     4. Await `app.close()` to drain Fastify HTTP connections.
     5. Enforce a 10-second timeout guard to ensure the process never hangs indefinitely.

### 2.3 Security Posture Validation (R4)
1. **Premise**: Requirement R4 mandates complete security posture validation with zero unhandled rejections, sanitized error outputs, and active rate limiting.
2. **Analysis**:
   - Fastify's route-level error handler sanitizes internal 500 errors and masks database/stack trace disclosures (`Observation 1.5`).
   - Fastify routes have active sliding-window rate limiters (`Observation 1.5`).
   - However, unhandled promise rejections at the Node process level are unhandled, posing process termination hazards (`Observation 1.5`).
3. **Remediation Logic**:
   - Add global `process.on('unhandledRejection', ...)` and `process.on('uncaughtException', ...)` in `combined-server.ts`.
   - Add WebSocket connection rate limiting or per-socket message throttling to protect the WebSocket server against broadcast DoS attacks.

### 2.4 Canvas 60fps Pan/Zoom Performance Validation (R4)
1. **Premise**: Requirement R4 requires client canvas to maintain smooth 60fps pan/zoom interaction with 100+ nodes mounted.
2. **Analysis**:
   - The canvas engine already incorporates key high-performance primitives: AABB viewport culling (`useViewportCulling`), React memoization on `NodeRenderer`, CSS hardware transform layers on `.canvas__world`, drag pan RAF batching, and cached spatial relation routing (`Observation 1.6`).
   - The primary interactive risk is wheel/trackpad event flooding in `useCanvasNavigation.ts` calling `panBy` synchronously without RAF batching (`Observation 1.6`).
3. **Verification Logic**:
   - An automated Playwright script can seed a board with 100+ mixed nodes (stickies, text, shapes, frames, relations), execute continuous pan and zoom actions over 60+ frames, collect `requestAnimationFrame` intervals, and verify that average FPS >= 55 with 0 frames > 32ms.

---

## 3. Caveats
1. **Port Conflicts in Local Environments**: Automated stress tests spawning a server on port 4001 could collide if a development server is already running. The test runner should support dynamic ports or test against an already running server if healthy.
2. **OS Differences in Process Signaling**: On Windows, sending POSIX signals (`SIGINT`/`SIGTERM`) to child processes differs from Linux containers. In Windows CMD/PowerShell, child processes often require taskkill. Graceful shutdown tests should invoke the server shutdown hook cleanly or test in cross-platform Node child processes using IPC or Node signal triggers.
3. **Single-IP Rate Limiting in Production**: In production behind a reverse proxy (e.g. Render/Docker), `trustProxy` configuration determines whether `req.ip` is correctly parsed from `x-forwarded-for`. If proxy hops are misconfigured, all clients appear to share one IP and may hit `WS_MAX_PER_IP`.
4. **No Vitest/Jest Assumption**: All new tests must conform to the project's existing testing convention (`tsx` runner scripts with `node:assert/strict` or Playwright runner scripts) rather than introducing external test frameworks.

---

## 4. Conclusion & Concrete Recommendations

### 4.1 Concrete Recommendations for R3 (Automated Concurrency & WebSocket Stress Testing)
1. **Create Automated Stress Script (`scripts/stress-websocket.ts`)**:
   - Implement a standalone Node script runnable via `npm run test:stress` or `tsx scripts/stress-websocket.ts`.
   - **Scale**: Connects **32 simultaneous virtual peers** (exceeding the 30-peer requirement) to a dedicated board `stress-board-${Date.now()}`.
   - **Virtual Peer Implementation**:
     - Wrap `ws.WebSocket` to provide headers:
       ```typescript
       headers: {
         Origin: 'http://127.0.0.1:4001',
         'x-forwarded-for': `10.0.0.${peerIndex + 1}`
       }
       ```
     - Initialize `WebsocketProvider` with `doc = new Y.Doc()`.
   - **Simulation Workflow**:
     1. **Connect & Handshake**: Stagger connect by 20ms. Wait for all 32 peers to emit `'sync'` (true). Assert 0 connection errors.
     2. **Simulate Presence & Panning**: Concurrently broadcast awareness updates (cursor coordinates, selected nodes) at 10 updates/sec per peer for 3 seconds.
     3. **Simulate Concurrent Writing**: Each peer creates 2 sticky nodes with `Y.Text` content and performs concurrent character inserts into a shared document node.
     4. **Validate Convergence**: Wait 1 second for sync quiescence. Verify that `Y.encodeStateVector(doc)` or node counts and text values across all 32 peers are byte-identical.
     5. **Validate Persistence Across Reconnect**: Disconnect all 32 peers. Wait 1000ms (exceeding the 750ms persistence debounce). Connect peer #33 to the board. Assert that peer #33 receives all created nodes and relations.
     6. **Assert Zero Drops & Leaks**: Assert connection errors = 0, dropped connections = 0, and log memory delta.
2. **Server Configuration Adjustment**:
   - In `apps/server/src/combined-server.ts:68`, increase the default `CANVIO_WS_MAX_PER_IP` from 20 to 100 (or set `CANVIO_WS_MAX_PER_IP=100` in the test execution environment) to support high-concurrency local tests.

### 4.2 Concrete Recommendations for R4 (Production Hardening & Performance Validation)
1. **Graceful Shutdown & Persistence Flush**:
   - **In `apps/server/src/storage/yPersistence.ts`**:
     - Track active `SharedDoc` instances and pending timers in a registry.
     - Add `flushAll(): Promise<void>`:
       ```typescript
       flushAll: async () => {
         for (const [docName, timer] of pendingWrites) {
           clearTimeout(timer);
         }
         pendingWrites.clear();
         const writes: Promise<void>[] = [];
         for (const [docName, doc] of activeDocs) {
           writes.push(writeSnapshot(docName, doc));
         }
         await Promise.all(writes);
       }
       ```
   - **In `apps/server/src/combined-server.ts`**:
     - Register `process.on('SIGINT', shutdown)` and `process.on('SIGTERM', shutdown)`.
     - Implement clean shutdown:
       ```typescript
       let shuttingDown = false;
       async function shutdown(signal: string) {
         if (shuttingDown) return;
         shuttingDown = true;
         console.log(`[Lifecycle] Received ${signal}. Initiating graceful shutdown...`);
         
         const forceTimer = setTimeout(() => {
           console.error('[Lifecycle] Shutdown timed out. Forcing exit.');
           process.exit(1);
         }, 10000).unref();

         // 1. Close WebSocket server and notify clients
         wss.close(() => console.log('[Lifecycle] WebSocket server closed.'));
         for (const client of wss.clients) {
           if (client.readyState === 1 /* OPEN */) {
             client.close(1001, 'Server shutting down');
           }
         }

         // 2. Flush in-flight persistence writes
         await persistence.flushAll();
         console.log('[Lifecycle] Yjs persistence flushed.');

         // 3. Close Fastify HTTP server
         await app.close();
         console.log('[Lifecycle] Fastify closed.');

         clearTimeout(forceTimer);
         process.exit(0);
       }
       ```
2. **Security Posture & Unhandled Rejections**:
   - In `apps/server/src/combined-server.ts`, register process-level rejection handlers:
     ```typescript
     process.on('unhandledRejection', (reason) => {
       app.log.error({ err: reason }, 'Unhandled promise rejection');
     });
     process.on('uncaughtException', (error) => {
       app.log.fatal({ err: error }, 'Uncaught exception');
       process.exit(1);
     });
     ```
   - Add Fastify custom 404 handler via `app.setNotFoundHandler` to return `{ error: 'NOT_FOUND', message: 'Resource not found', requestId: request.id }`.
3. **Canvas 60fps Pan/Zoom Performance Hardening**:
   - In `apps/web/src/components/Canvas/hooks/useCanvasNavigation.ts:36-60`, wrap wheel pan updates in `requestAnimationFrame` (matching the drag pan pattern in `Canvas.tsx:133-161`) to avoid unthrottled Zustand updates during high-frequency touchpad scrolling.
   - Implement an automated Playwright benchmark (`scripts/benchmark-canvas.mjs`) that mounts 100+ nodes, executes 60 frames of programmatic pan/zoom, measures RAF frame times, and asserts average FPS >= 55.

---

## 5. Verification Method

### 5.1 Verifying Concurrency & WebSocket Stress Testing (R3)
- **Command**:
  ```bash
  npm run test:stress
  ```
  *(or `npx tsx scripts/stress-websocket.ts`)*
- **Pass Conditions**:
  1. Spawns 32 simultaneous virtual WebSocket peers connecting to the combined server.
  2. 32 peers complete Yjs sync handshake with 0 dropped connections (`exitCode === 0`).
  3. All 32 peers concurrently write 64+ node updates and 100+ cursor/awareness updates.
  4. CRDT states converge identically across all 32 peers (state vectors match).
  5. Reconnection of a 33rd client after disconnect retrieves all persisted nodes and text without corruption.
  6. Zero unhandled promise rejections logged during the run.

### 5.2 Verifying Graceful Shutdown (R4)
- **Command / Test Script**:
  ```bash
  npx tsx scripts/test-shutdown.ts
  ```
- **Test Sequence**:
  1. Spawn combined server child process.
  2. Connect a WebSocket client and send in-flight edits to a board.
  3. Send `SIGTERM` (or `SIGINT`) to the server process.
  4. Observe WebSocket client receives close code 1001 ("Server shutting down").
  5. Observe server exits with code 0 within < 3 seconds.
  6. Read `data/ydocs/<board>.bin` from disk and verify the in-flight edits are persisted and no `.tmp-*` files remain.

### 5.3 Verifying Security Posture & Rate Limiting (R4)
- **Command**:
  ```bash
  npm run test:unit
  ```
- **Verification**:
  1. Verify existing security tests in `scripts/unit/run-unit-tests.ts`:
     - Test 22: Unsafe board IDs rejected.
     - Test 23: Board access honors ownership and share tokens.
     - Test 24: Rate limiting ignores client-supplied identity rotation.
  2. Add unit check verifying Fastify sanitized error handling on forced 500 error and 404 handler sanitization.

### 5.4 Verifying 60fps Canvas Pan/Zoom with 100+ Nodes (R4)
- **Command**:
  ```bash
  node scripts/benchmark-canvas.mjs
  ```
- **Verification**:
  1. Playwright opens Chromium with 100+ living nodes (stickies, text, shapes, frames, relations) mounted on the canvas.
  2. Measures frame-to-frame delta via `performance.now()` in a `requestAnimationFrame` loop during 3 seconds of continuous pan and zoom.
  3. Asserts:
     - Average FPS >= 55 fps.
     - 95th percentile frame time < 20 ms.
     - Max dropped frame count (> 33.3 ms) <= 2 frames during initial warmup.

### 5.5 Repository Gate Baseline
Run full repository gates to guarantee zero regressions:
```bash
npm run typecheck    # Exits 0 across all 6 packages
npm run test:unit    # Passes 100% of unit checks (29/29)
npm run build        # Builds web and server bundles + 12 SSG routes
npm run smoke        # Passes bundle and asset verification
```
