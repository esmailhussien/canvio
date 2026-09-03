# Architectural Investigation & Handoff Report: Requirement R1 (Containerized Single-Node Production Deployment)

**Author**: Explorer Survey 1 (`teamwork_preview_explorer`)  
**Date**: 2026-09-03  
**Target Milestone**: Requirement R1 — Containerized Single-Node Production Deployment  
**Workspace**: `d:\Canvio`

---

## 1. Observation

Direct observations verified against the Canvio codebase:

### 1.1 Workspace Architecture & Build Pipeline
- **Monorepo Topology**: Root `package.json` (`d:\Canvio\package.json`, lines 24–27) defines workspaces `packages/*` (`@canvio/core`, `@canvio/objects`, `@canvio/ui`, `@canvio/collaboration`) and `apps/*` (`apps/server`, `apps/web`). Package manager is `npm@11.9.0` (line 28).
- **Turborepo Configuration**: `d:\Canvio\turbo.json` defines pipelines for `build`, `dev`, `lint`, `typecheck`, and `clean`. Task `build` depends on `^build` and outputs `dist/**` (lines 5–8).
- **Core Build Dependency**: `@canvio/core` is compiled via TypeScript to `packages/core/dist/` (`packages/core/package.json`, lines 15–18). Other internal packages (`@canvio/objects`, `@canvio/ui`, `@canvio/collaboration`) declare `"main": "src/index.ts"` and do not produce independent dist directories.
- **Server Build Pipeline**: `apps/server/package.json` specifies `"prebuild": "npm run build -w @canvio/core"` and `"build": "tsc"` (lines 10–11). It compiles TypeScript into `apps/server/dist/`.
- **Web Build & SSG Prerendering**: `apps/web/package.json` specifies `"build": "vite build && node ../../scripts/prerender.mjs"` (line 8).
  - Vite bundles the React 19 SPA into `apps/web/dist/` with manual chunks: `vendor-react`, `vendor-map`, `vendor-collaboration`, `vendor-motion`, and `vendor` (`apps/web/vite.config.ts`, lines 9–24).
  - `scripts/prerender.mjs` executes immediately following Vite build, generating 12 static marketing and support routes into `apps/web/dist/<route>/index.html` (e.g., `/how-it-works`, `/support`, `/updates`, `/updates/...`) and generating `sitemap.xml`.
- **Smoke Integrity Check**: `scripts/smoke-check.mjs` verifies `apps/web/dist/index.html` contains title metadata and references `/canvio-config.js` (lines 20–26), verifies `canvio-config.js`, `sitemap.xml`, `robots.txt`, asserts that all 8 prerendered SSG routes exist with valid Schema.org JSON-LD and canonical tags (lines 42–69), and verifies that split chunks exist with no JS file exceeding 500 KB (lines 74–90). Verified passing: `npm run smoke` exits 0.
- **Baseline Verification**: Ran `npm run typecheck` (all 6 packages exit 0), `npm run test:unit` (29/29 tests pass), and `npm run build` (full Turborepo build passes in ~2.5s).

### 1.2 Server Architecture (`apps/server`)
- **Multiple Entrypoints**:
  1. `apps/server/src/index.ts`: Standalone Fastify HTTP REST/AI server listening on `PORT` (default 4000). Does not mount WebSockets.
  2. `apps/server/src/ws-server.ts`: Standalone Yjs WebSocket server using Node `http.createServer` listening on `WS_PORT` (default 4001).
  3. `apps/server/src/combined-server.ts`: Pre-existing unified server script attempting to combine Fastify and WebSockets on a single port for cloud deployments (`npm run start:ws`).
- **Unified Port Binding**: In `apps/server/src/combined-server.ts`:
  - Fastify is instantiated: `const app = Fastify(FASTIFY_OPTIONS)` (line 28).
  - WebSocketServer is instantiated with `{ server: app.server, maxPayload: WS_MAX_PAYLOAD }` (line 70), binding the WebSocket `upgrade` listener directly to Fastify's underlying HTTP server.
  - Server listens on a single port: `await app.listen({ port: PORT, host: '0.0.0.0' })` (lines 124–125).
- **Missing Static Asset Serving**:
  - `apps/server/src/combined-server.ts` does NOT serve static frontend files. Line 37 exposes `app.get('/', async () => ({ name: 'Canvio Combined API...', status: 'online' }))` which returns raw JSON.
  - Route requests for `/assets/*`, `/canvio-config.js`, `/how-it-works`, or SPA routes like `/w/:id` return 404 JSON errors.
  - `@fastify/static` is NOT installed in `apps/server/package.json` (lines 17–27 show only `@canvio/core`, `@fastify/cors`, `concurrently`, `dotenv`, `fastify`, `nanoid`, `ws`, `y-websocket`, `yjs`).
- **Content-Security-Policy Conflict**:
  - `apps/server/src/http.ts` registers security headers via `registerSecurityHeaders(app)` (lines 40–55).
  - Lines 47–50 set:
    ```typescript
    reply.header(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; form-action 'none'"
    );
    ```
  - This header is registered globally on Fastify `onRequest`. If static frontend HTML is served without overriding this header, browsers will block all scripts, stylesheets, fonts, inline theme initialization, and WebSocket connections.
- **WebSocket Origin Restrictions**:
  - In `apps/server/src/wsAccess.ts`, lines 19–25 check origin via `isOriginAllowed(req.headers.origin)`.
  - In `apps/server/src/security.ts`, lines 87–96 define `isOriginAllowed`:
    ```typescript
    const allowedOrigins = new Set([
      'https://canvio.space',
      'https://www.canvio.space',
      ...envList('CANVIO_ALLOWED_ORIGINS'),
    ]);
    const allowLocalDev = envBool('CANVIO_ALLOW_LOCAL_ORIGINS', process.env.NODE_ENV !== 'production');
    if (!origin) return true;
    return allowedOrigins.has(origin) || (allowLocalDev && isLocalOrigin(origin));
    ```
  - When `NODE_ENV === 'production'`, `allowLocalDev` evaluates to `false`. In a container deployed on `http://localhost:4000` or a custom internal IP/domain, browser WebSocket connections sending `Origin: http://localhost:4000` are rejected with code 1008 `Origin not allowed` unless `CANVIO_ALLOW_LOCAL_ORIGINS=true` or `CANVIO_ALLOWED_ORIGINS` is explicitly populated.
- **WebSocket Connection Limiting**:
  - `apps/server/src/combined-server.ts` line 68 enforces: `const WS_MAX_PER_IP = readPositiveIntEnv('CANVIO_WS_MAX_PER_IP', 20, 1, 1_000);`.
  - Any single client IP connecting more than 20 concurrent WebSockets is rejected with close code 1013 (`Too many connections from this address`, line 87). This directly impacts multi-client automated stress testing (Requirement R3) if running 30+ virtual peers from a single machine.
- **Missing Graceful Shutdown & Process Lifecycle**:
  - No `process.on('SIGTERM')` or `process.on('SIGINT')` hooks exist anywhere in `apps/server`.
  - In `apps/server/src/storage/yPersistence.ts`, Yjs snapshots are debounced by 750ms before writing to disk (`scheduleWrite`, lines 50–60).
  - Without graceful shutdown hooks, `docker stop` (which sends SIGTERM) terminates Node immediately, dropping pending in-memory Yjs snapshot flushes and severing active WebSocket connections abruptly without close code 1001 (Going Away).
- **Filesystem Persistence**:
  - `apps/server/src/storage/paths.ts` line 4: `export const DATA_DIR = process.env.CANVIO_DATA_DIR || path.resolve(process.cwd(), 'data');`.
  - Board records are saved as atomic JSON files (`boards/<id>.json`), and Yjs snapshots are saved as atomic binary files (`ydocs/<id>.bin`).
  - No SQL or external database is required; single-node persistence is 100% filesystem-driven.

### 1.3 Containerization Audit (Existing Docker Configurations)
- **No Root Dockerfile or .dockerignore**: Root directory contains no `Dockerfile` and no `.dockerignore`.
- **Existing Docker Configurations** in `docker/`:
  1. `docker/Dockerfile.server`: 2-stage Alpine build compiling `@canvio/core` and `apps/server`. Exposes ports 4000 and 4001, running `npm run start -w apps/server` (which launches `concurrently` with two separate Node processes). Does not build or package `apps/web`.
  2. `docker/Dockerfile.web`: 2-stage Nginx Alpine build compiling `apps/web` and serving it via Nginx on port 80. Relies on `docker/web-entrypoint.sh` to generate `canvio-config.js` at runtime from `VITE_API_URL` and `VITE_WS_URL`.
  3. `docker/Dockerfile.ws`: Standalone Yjs server container on port 4001.
  4. `docker/docker-compose.yml`: Multi-container composition orchestrating separate `web` (port 5173:80) and `server` (ports 4000 & 4001) containers with a shared volume `canvio-data`.
- **Missing Container Capabilities**:
  - No single-node multi-stage container packaging both frontend and backend.
  - No `.dockerignore`, causing `docker build` to transfer `node_modules/`, `.git/`, `.turbo/`, and temporary build artifacts into the Docker daemon context.
  - No Docker container healthcheck (`HEALTHCHECK` directive).
  - `Dockerfile.server` executes via `npm run start` instead of direct `node`, preventing Node from receiving POSIX signals directly as PID 1.

### 1.4 Frontend Dynamic Configuration (`canvio-config.js`)
- In `apps/web/src/utils/runtimeConfig.ts`:
  - Line 21: `getApiBaseUrl()` returns `getRuntimeConfig().apiUrl || env.VITE_API_URL || ''`. When empty string `''`, the frontend makes relative requests (`/api/...`), resolving cleanly on any origin/port.
  - Line 61: `getWebSocketUrl()`:
    ```typescript
    if (getRuntimeConfig().wsUrl) return getRuntimeConfig().wsUrl!.replace(/\/$/, '');
    const env = getViteEnv();
    const configuredWsUrl = typeof env.VITE_WS_URL === 'string' ? env.VITE_WS_URL : '';
    if (configuredWsUrl) return configuredWsUrl.replace(/\/$/, '');
    
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || env.DEV)) {
      const hostname = window.location.hostname || 'localhost';
      return `ws://${hostname}:4001`;
    }
    return 'wss://canvio-l3bk.onrender.com';
    ```
  - Crucial finding: If `canvio-config.js` does NOT specify `wsUrl`, `getWebSocketUrl()` falls back to port `4001` on localhost, or `wss://canvio-l3bk.onrender.com` on any other domain. If the unified server runs on port 4000, WebSockets fail unless `canvio-config.js` provides `wsUrl` matching the current host and port.

---

## 2. Logic Chain

From the direct observations above, the technical rationale for R1 implementation follows step-by-step:

### Step 1: Why a Single Unified Server Entrypoint is Required
- *Observation*: `combined-server.ts` already binds `WebSocketServer` to `app.server` on a single port (`PORT`, default 4000 or 4001), but currently returns raw JSON on `GET /` and has no static file serving.
- *Reasoning*: To fulfill Requirement R1 ("serve the compiled static frontend, the Fastify REST/AI API, and the real-time Yjs WebSocket server concurrently under a unified port"), Fastify must serve static files from `apps/web/dist` directly, eliminating the need for Nginx or a multi-container proxy.
- *Inference*: By extending `combined-server.ts` (or introducing a dedicated production entrypoint) with `@fastify/static`, Fastify can simultaneously handle:
  1. WebSocket upgrades on `/` or `/:boardId` (handled by `ws.WebSocketServer` on the underlying `http.Server`).
  2. REST API endpoints on `/api/*`.
  3. Health endpoints on `/health` and `/health/ready`.
  4. Static frontend files (`/assets/*`, `/logo.png`, `/robots.txt`, `/sitemap.xml`).
  5. SSG prerendered marketing routes (`/how-it-works`, `/support`, `/updates/*`).
  6. SPA fallback (`dist/index.html`) for dynamic canvas routes (`/w/:worldId`, `/w/new`).

### Step 2: Resolving the Content-Security-Policy Conflict
- *Observation*: `apps/server/src/http.ts` sets `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; form-action 'none'` globally on all requests.
- *Reasoning*: While appropriate for headless JSON APIs, this policy prevents browsers from loading JS bundles, CSS, fonts, Leaflet map tiles, and WebSockets.
- *Inference*: CSP must be scoped. The strict `default-src 'none'` policy should apply only to `/api/*` routes. For HTML and frontend asset requests, a production-safe CSP must permit:
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline'` (for inline theme preference toggle in `index.html`)
  - `style-src 'self' 'unsafe-inline'`
  - `font-src 'self' data:`
  - `img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org` (for Leaflet interactive map tiles)
  - `connect-src 'self' ws: wss: https:` (for Yjs WebSockets and external AI APIs)
  - `frame-ancestors 'none'`

### Step 3: Self-Configuring WebSocket URL via Dynamic `canvio-config.js`
- *Observation*: In `apps/web/src/utils/runtimeConfig.ts`, missing `wsUrl` in `window.CANVIO_CONFIG` results in hardcoded `ws://localhost:4001` or fallback to Render.
- *Reasoning*: In a unified container, the HTTP port and WS port are identical, but the host/port could be arbitrary (e.g. Docker port mapping `-p 8080:4000` or custom domain).
- *Inference*: Fastify should serve `GET /canvio-config.js` dynamically:
  ```javascript
  window.CANVIO_CONFIG = {
    apiUrl: process.env.VITE_API_URL || '',
    wsUrl: process.env.VITE_WS_URL || ((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host)
  };
  ```
  This guarantees that regardless of external port mapping, reverse proxy, or SSL termination, the client seamlessly connects WebSockets back to the unified container without manual environment variable plumbing.

### Step 4: Graceful Process Lifecycle & Yjs Data Integrity
- *Observation*: Yjs updates are debounced by 750ms in `createFilePersistence()`. Currently no SIGTERM/SIGINT handlers exist.
- *Reasoning*: When a container orchestrator (Docker, Kubernetes) stops a container, it sends `SIGTERM`, waits a grace period (default 10s), then sends `SIGKILL`. If the process terminates without flushing, the last 750ms of user canvas edits can be lost.
- *Inference*: The server entrypoint must attach `process.on('SIGTERM')` and `process.on('SIGINT')` to:
  1. Stop accepting new HTTP/WS connections (`app.close()`, `wss.close()`).
  2. Flush all active and pending Yjs document snapshots to disk via atomic write.
  3. Close active WebSocket connections with clean status code 1001 (Going Away).
  4. Force exit after a safe timeout (e.g. 5–10s) if operations hang.

### Step 5: Multi-Stage Dockerfile Optimization
- *Observation*: Canvio has 6 packages, pure TypeScript/JavaScript codebase, no native C++ bindings, and produces build artifacts in `packages/core/dist`, `apps/server/dist`, and `apps/web/dist`.
- *Reasoning*: A 3-stage Dockerfile (`deps` -> `builder` -> `runner`) ensures build tools (Vite, TypeScript, Playwright) and devDependencies are excluded from the runtime image.
- *Inference*:
  - Base: `node:20-alpine` (minimal CVE surface, ~130 MB base).
  - Builder stage installs all dependencies and runs `npm run build` (triggering Turborepo build for core, web, and server + SSG prerendering).
  - Runner stage copies only production dependencies (`npm ci --omit=dev`), the compiled `dist/` outputs, and runs as unprivileged user `node`.
  - Data directory `/app/data` is mounted as a `VOLUME` and owned by `node:node`.
  - Container image size will remain under ~220 MB total.

---

## 3. Caveats

1. **Ephemeral Cloud Disks vs Persistent Volumes**:
   - `DATA_DIR` defaults to `/app/data` in the container.
   - If deployed without an attached persistent volume (`docker run -v canvio-data:/app/data`), all board files and Yjs histories will be wiped on container recreation.
2. **WebSocket Per-IP Connection Limit in Load Testing**:
   - `apps/server/src/combined-server.ts` defaults `CANVIO_WS_MAX_PER_IP` to 20.
   - For Requirement R3 (automated concurrency test with 30+ simultaneous virtual clients), the test client will be rejected unless `CANVIO_WS_MAX_PER_IP=100` (or higher) is configured in the environment.
3. **Local Origins in Production Mode**:
   - In `apps/server/src/security.ts`, `isOriginAllowed` disables local dev origins when `NODE_ENV === 'production'`.
   - In production containers running on `localhost:4000` or local network IPs, `CANVIO_ALLOW_LOCAL_ORIGINS=true` or same-origin matching (`origin.host === request.headers.host`) must be enabled so WebSockets are not rejected with code 1008.
4. **SPA Fallback Order**:
   - Care must be taken in Fastify route registration: API routes (`/api/*`), observability endpoints (`/health`), and static assets (`/assets/*`, SSG routes) must be evaluated before the SPA fallback (`index.html`) is served to prevent API 404s from returning HTML.

---

## 4. Conclusion & Concrete Design Recommendations for R1

To achieve full compliance with Requirement R1, the following concrete changes and files should be implemented:

### 4.1 Root `.dockerignore`
Create `d:\Canvio\.dockerignore` containing:
```text
node_modules
.git
.gitignore
.agents
.turbo
data
dist
apps/*/dist
packages/*/dist
*.log
.env*
!**/.env.example
coverage
.vscode
.idea
scripts/tmp*
```

### 4.2 Multi-Stage Production `Dockerfile`
Create `d:\Canvio\Dockerfile` with 3 optimized stages:
```dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/objects/package.json ./packages/objects/
COPY packages/ui/package.json ./packages/ui/
COPY packages/collaboration/package.json ./packages/collaboration/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
RUN npm ci

# Stage 2: Build all workspace packages
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json turbo.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts
ENV NODE_ENV=production
RUN npm run build
# Prune to production-only dependencies
RUN npm prune --omit=dev

# Stage 3: Minimal Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV CANVIO_DATA_DIR=/app/data
ENV CANVIO_ALLOW_LOCAL_ORIGINS=true

# Prepare data directory and permissions for unprivileged node user
RUN mkdir -p /app/data && chown -R node:node /app

COPY package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=node:node /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder --chown=node:node /app/apps/server/dist ./apps/server/dist
COPY --from=builder --chown=node:node /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder --chown=node:node /app/apps/web/dist ./apps/web/dist

USER node
VOLUME ["/app/data"]
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

CMD ["node", "apps/server/dist/combined-server.js"]
```

### 4.3 Static Serving & Dynamic Config in `@canvio/server`
1. Add `@fastify/static` to `apps/server/package.json` (`npm i -w @canvio/server @fastify/static`).
2. In `apps/server/src/combined-server.ts`:
   - Register `@fastify/static` pointing to `process.env.CANVIO_STATIC_DIR || path.resolve(__dirname, '../../web/dist')`.
   - Register dedicated route `GET /canvio-config.js` serving dynamic JavaScript:
     ```javascript
     reply.type('application/javascript');
     return `window.CANVIO_CONFIG = {
       apiUrl: ${JSON.stringify(process.env.VITE_API_URL || '')},
       wsUrl: ${JSON.stringify(process.env.VITE_WS_URL || '')} || ((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + '//' + window.location.host)
     };`;
     ```
   - Register `setNotFoundHandler` on Fastify:
     - For `/api/*`: return 404 JSON `{ error: 'NOT_FOUND', message: 'API route not found' }`.
     - For SSG routes: check if `apps/web/dist/<pathname>/index.html` exists and serve it.
     - Otherwise: send `apps/web/dist/index.html` for SPA navigation.
3. Update `apps/server/src/http.ts`:
   - Scope strict CSP `default-src 'none'` only to `/api/*` endpoints.
   - For static HTML responses, apply frontend-compatible CSP allowing scripts, styles, OpenStreetMap map tiles, and WebSocket connections.

### 4.4 Lifecycle Management & Graceful Shutdown
In `apps/server/src/combined-server.ts`, register signal handlers:
```typescript
const shutdown = async (signal: string) => {
  console.log(`[Lifecycle] Received ${signal}, starting graceful shutdown...`);
  const hardTimeout = setTimeout(() => {
    console.error('[Lifecycle] Shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000).unref();

  try {
    // 1. Close Fastify and stop accepting new HTTP requests
    await app.close();
    // 2. Notify and close active WebSockets cleanly
    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.close(1001, 'Server shutting down');
    });
    wss.close();
    console.log('[Lifecycle] Graceful shutdown completed cleanly');
    process.exit(0);
  } catch (error) {
    console.error('[Lifecycle] Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

### 4.5 Health Endpoint Alignment (Requirement R2 Readiness)
In `apps/server/src/combined-server.ts`, enrich `/health`:
```typescript
app.get('/health', async () => {
  const readiness = await getReadiness().catch(() => ({ status: 'unavailable', storage: 'error' }));
  return {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    activeConnections,
    memory: process.memoryUsage(),
    storage: readiness.storage,
  };
});
```

---

## 5. Verification Method

Once Requirement R1 implementation changes are applied, verify via the following procedure:

### 5.1 Project Baseline Checks
Execute from workspace root:
```bash
npm run typecheck    # Must pass cleanly across all 6 packages (exit code 0)
npm run test:unit    # Must pass 29/29 unit tests (exit code 0)
npm run build        # Must compile core, server, and prerender web (exit code 0)
npm run smoke        # Must verify assets, split chunks, and SSG routes (exit code 0)
```

### 5.2 Docker Image Build Verification
```bash
# Build multi-stage production container image
docker build -t canvio:production -f Dockerfile .
```
- **Validation Criteria**: Build completes successfully; image inspect shows non-root user `node`, exposed port 4000, and image size under 300 MB.

### 5.3 Single-Node Unified Port Runtime Verification
```bash
# Launch container in detached mode with volume mount
docker run -d --name canvio-test -p 4000:4000 -e CANVIO_WS_MAX_PER_IP=100 canvio:production

# Verify health endpoint returns 200 with uptime and service status
curl -i http://localhost:4000/health

# Verify static homepage is served
curl -i http://localhost:4000/

# Verify SSG prerendered marketing route is served
curl -i http://localhost:4000/how-it-works

# Verify SPA fallback on board route
curl -i http://localhost:4000/w/test-board-id

# Verify runtime config endpoint
curl -i http://localhost:4000/canvio-config.js
```

### 5.4 WebSocket & Collaboration Connectivity
- Open browser at `http://localhost:4000/w/integration-test`.
- Open DevTools Network tab -> WS filter: verify connection to `ws://localhost:4000/integration-test` completes HTTP 101 Switching Protocols without errors.
- Verify node creation and real-time CRDT updates sync to disk under `/app/data/ydocs/`.

### 5.5 Graceful Shutdown Verification
```bash
# Issue graceful stop and observe container logs
docker stop -t 10 canvio-test
docker logs canvio-test
```
- **Validation Criteria**: Logs show `[Lifecycle] Received SIGTERM, starting graceful shutdown...` followed by `Graceful shutdown completed cleanly` with exit code 0. No unhandled promise rejections or orphaned processes.
```bash
# Cleanup
docker rm canvio-test
```
