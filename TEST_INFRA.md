# Canvio E2E Test Infrastructure Specification

**Document Version**: 1.0.0  
**Target Platform**: Canvio Enterprise Collaborative Spatial Whiteboard  
**Scope**: Production Hardening & Launch Readiness (Requirements R1, R2, R3, R4)  
**Track**: Opaque-Box E2E Testing Track  

---

## 1. Architectural Principles & Overview

The Canvio End-to-End (E2E) test infrastructure provides a rigorous, requirement-driven, opaque-box verification framework for the single-node production deployment.

### Core Principles:
1. **Opaque-Box Network Testing**: Tests exercise the application exclusively through standard HTTP/1.1 and WebSocket (RFC 6455) wire protocols. No test relies on internal process handles, monkey-patching, or private module internals.
2. **Deterministic Isolation**: Every test run operates with isolated ephemeral server instances, dedicated temporary data directories (`CANVIO_DATA_DIR`), and dynamic port allocations. Tests do not share state, leak sockets, or depend on execution ordering.
3. **Dual Execution Modes**:
   - **Supervised Ephemeral Mode**: Test runners automatically launch, monitor, and gracefully tear down dedicated Canvio server instances with scenario-specific environment variable configurations.
   - **External Target Mode**: Test runners can target an already-running server (local or remote container) via `CANVIO_TEST_URL` (e.g. `http://127.0.0.1:4000`).
4. **4-Tier Testing Pyramid**:
   - **Tier 1 (Feature Coverage)**: >= 5 tests per primary capability (Health endpoints, Static frontend serving, Dynamic runtime config, WebSocket connections, Graceful lifecycle & shutdown).
   - **Tier 2 (Boundary & Corner Cases)**: Storage degradation, connection ceilings, IP rate limits, origin authorization, socket churn, and payload bounds.
   - **Tier 3 (Cross-Feature Interactions)**: Concurrency between REST APIs and WebSocket CRDT streaming, dynamic health monitoring under fluctuating peer loads, and host-header routing isolation.
   - **Tier 4 (Real-World Scenarios)**: 32-peer collaborative whiteboard simulation, awareness broadcasting, concurrent node/text mutations, state vector convergence, and cold-start reconnect persistence.

---

## 2. Test Environment & Prerequisites

### 2.1 System Requirements
- **Runtime**: Node.js >= 20.0.0 (Node 20 Alpine in Docker or native host)
- **TypeScript Runner**: `tsx` (included in devDependencies)
- **Core Dependencies**: `fastify`, `@fastify/cors`, `ws`, `yjs`, `y-websocket`, `y-protocols`, `lib0`
- **Operating Systems**: Windows (PowerShell/CMD with `taskkill`), Linux/macOS (POSIX signals)

### 2.2 Environment Variables

| Variable | Default | Purpose in E2E Testing |
|---|---|---|
| `PORT` / `CANVIO_TEST_PORT` | `4100` | Target HTTP and WebSocket unified listen port |
| `CANVIO_TEST_URL` | `http://127.0.0.1:<PORT>` | Explicit URL of a running server instance |
| `CANVIO_DATA_DIR` | `tmpdir()/canvio-e2e-<id>` | Isolated filesystem persistence location for boards and ydocs |
| `CANVIO_WS_MAX_CONNECTIONS` | `200` | Upper bound of simultaneous WebSocket connections |
| `CANVIO_WS_MAX_PER_IP` | `100` (or `3` in tests) | Maximum concurrent WebSockets per IP address |
| `CANVIO_WS_MAX_PAYLOAD_KB` | `2048` | Maximum WebSocket frame size before rejection |
| `CANVIO_ALLOWED_ORIGINS` | `https://canvio.space` | Allowed browser origins for CORS & WebSockets |
| `CANVIO_ALLOW_LOCAL_ORIGINS` | `true` | Permits `localhost` and `127.0.0.1` origins |
| `CANVIO_ALLOW_NO_ORIGIN_WS` | `false` | Controls whether headless clients without Origin header are accepted |

---

## 3. The 4-Tier Test Matrix

```
                      +-------------------------------------------------------+
                      |                      TIER 4                           |
                      |            Real-World 32-Peer Collaboration           |
                      |          & Cold-Start Reconnect Persistence           |
                      +-------------------------------------------------------+
                      |                      TIER 3                           |
                      |             Cross-Feature Interactions                |
                      |         (Concurrent REST + WS, Load Metrics)          |
                      +-------------------------------------------------------+
                      |                      TIER 2                           |
                      |             Boundary & Corner Cases                   |
                      |   (Storage Failure, Limits, Origin Hardening, Churn)  |
                      +-------------------------------------------------------+
                      |                      TIER 1                           |
                      |            Core Feature Coverage (>=5/feature)        |
                      |  (Health, Static Assets, Dynamic Config, WS, Shutdown)|
                      +-------------------------------------------------------+
```

### 3.1 Tier 1: Core Feature Coverage

| ID | Feature Category | Test Case | Expected Authoritative Behavior |
|---|---|---|---|
| **T1.1.1** | Health & Observability | `GET /health` Base Liveness | Returns HTTP 200 with JSON payload `{ status: 'healthy', timestamp: ISOString }` |
| **T1.1.2** | Health & Observability | `GET /api/health` API Alias | Returns HTTP 200 with JSON payload matching `/health` specification |
| **T1.1.3** | Health & Observability | `GET /health/ready` Storage Readiness | Returns HTTP 200 with `{ status: 'ready', storage: 'ok' }` when storage dirs are writable |
| **T1.1.4** | Health & Observability | `GET /api/health/ready` Alias | Returns HTTP 200 with readiness payload matching `/health/ready` |
| **T1.1.5** | Health & Observability | Process Metric Telemetry | Health report contains valid `uptime` (seconds > 0) and `memory` (`rss`, `heapTotal`, `heapUsed`) |
| **T1.1.6** | Health & Observability | WebSocket Telemetry Field | Health report includes `activeConnections` count reflecting currently attached clients |
| **T1.2.1** | Unified Static Serving | Root Route Resolution | `GET /` returns HTTP 200 with `Content-Type: text/html` and non-empty HTML |
| **T1.2.2** | Unified Static Serving | HTML Document Integrity | `GET /` contains `<title>`, `<div id="root">`, and link/script tags |
| **T1.2.3** | Unified Static Serving | Bundled Asset Delivery | `GET /assets/<chunk>.js` returns HTTP 200 with `Content-Type: application/javascript` |
| **T1.2.4** | Unified Static Serving | Pre-rendered SSG Marketing Routes | `GET /how-it-works`, `/support`, `/updates` return HTTP 200 and prerendered HTML |
| **T1.2.5** | Unified Static Serving | SPA Client Fallback | `GET /w/<boardId>` returns HTTP 200 with `index.html` for client-side routing |
| **T1.2.6** | Unified Static Serving | Missing Asset Handling | `GET /assets/missing-chunk-404.js` returns HTTP 404 Not Found |
| **T1.3.1** | Dynamic Runtime Config | Runtime Config Route | `GET /canvio-config.js` returns HTTP 200 with `Content-Type: application/javascript` |
| **T1.3.2** | Dynamic Runtime Config | Config Object Evaluation | Script body defines `window.CANVIO_CONFIG` as an object |
| **T1.3.3** | Dynamic Runtime Config | Dynamic Host Resolution | `wsUrl` dynamically computes `ws://<host>:<port>` based on incoming `Host` header |
| **T1.3.4** | Dynamic Runtime Config | Relative API Base URL | `apiUrl` is host-relative (`''`) or matching current host domain |
| **T1.3.5** | Dynamic Runtime Config | Stale Cache Prevention | `Cache-Control` header prevents caching (`no-cache` / `no-store`) |
| **T1.4.1** | WebSocket Lifecycle | Handshake & Upgrade | HTTP GET with `Upgrade: websocket` to `/<boardId>` successfully establishes WS connection |
| **T1.4.2** | WebSocket Lifecycle | Yjs Sync Protocol Handshake | Server exchanges `SyncStep1` and `SyncStep2` binary messages upon connection |
| **T1.4.3** | WebSocket Lifecycle | Standard Allowed Origin | Handshake with `Origin: https://canvio.space` is accepted |
| **T1.4.4** | WebSocket Lifecycle | Local Development Origin | Handshake with `Origin: http://localhost:5173` is accepted when local dev enabled |
| **T1.4.5** | WebSocket Lifecycle | WebSocket Heartbeat / Ping-Pong | Server responds to client ping frames with corresponding pong frames |
| **T1.5.1** | Graceful Lifecycle & Shutdown | Clean Exit on `SIGINT` | Process exits with code 0 upon receiving `SIGINT` |
| **T1.5.2** | Graceful Lifecycle & Shutdown | Clean Exit on `SIGTERM` | Process exits with code 0 upon receiving `SIGTERM` |
| **T1.5.3** | Graceful Lifecycle & Shutdown | Going Away Close Code (1001) | Active WebSocket connections receive close frame code 1001 on shutdown |
| **T1.5.4** | Graceful Lifecycle & Shutdown | In-Memory Persistence Flush | Pending debounced Yjs updates are flushed to disk before exit |
| **T1.5.5** | Graceful Lifecycle & Shutdown | Rapid Port Unbinding | Server port is immediately available for rebinding without `EADDRINUSE` |

---

### 3.2 Tier 2: Boundary & Corner Cases

| ID | Boundary Scenario | Trigger Condition | Expected Behavior |
|---|---|---|---|
| **T2.1** | Storage Inaccessibility | Data directory set to read-only or invalid path | `GET /health/ready` returns HTTP 503 with status degraded/unavailable |
| **T2.2** | Global Max Connections Ceiling | Server connects past `CANVIO_WS_MAX_CONNECTIONS` | Additional client connection is immediately rejected with close code 1013 (`Server at connection capacity`) |
| **T2.3** | Per-IP Concurrency Limit | Single IP connects past `CANVIO_WS_MAX_PER_IP` | Connection is rejected with close code 1013 (`Too many connections from this address`) |
| **T2.4** | IP Dispersal via Forwarded Headers | Clients send distinct `X-Forwarded-For` IPs | Each distinct IP maintains its own connection quota |
| **T2.5** | Unauthorized Origin Rejection | Client connects with untrusted `Origin: https://attacker.com` | Connection rejected with close code 1008 (`Origin not allowed`) |
| **T2.6** | Missing Origin Rejection | Client connects with no `Origin` when `CANVIO_ALLOW_NO_ORIGIN_WS=false` | Connection rejected with close code 1008 (`Origin required`) |
| **T2.7** | Rapid Connect / Disconnect Churn | 25 rapid connect-disconnect cycles in < 1000ms | Connection counts decrement cleanly to 0 with zero socket leaks |
| **T2.8** | Oversized Payload Bound | Client transmits frame exceeding `WS_MAX_PAYLOAD` | Server terminates socket or drops frame without crashing process |

---

### 3.3 Tier 3: Cross-Feature Interactions

| ID | Interaction Scenario | Workflow | Expected Behavior |
|---|---|---|---|
| **T3.1** | Concurrent REST API + WS Sync | 5 active peers continuously syncing CRDT updates while firing 50 concurrent REST calls (`/api/health`, `/canvio-config.js`, `/health/ready`) | 100% of REST requests return 200 OK; 0 WebSocket disconnects; no latency spikes |
| **T3.2** | Real-Time Telemetry Tracking Under WS Load | Query `/health` at: 0 clients -> 10 clients -> 5 clients -> 0 clients | `activeConnections` accurately mirrors the exact count at every step |
| **T3.3** | Static Asset Delivery Under Heavy CRDT Traffic | Concurrent static file downloads (`index.html`, `/assets/...`) during continuous binary sync | Zero corrupted downloads; zero dropped CRDT frames |
| **T3.4** | Dynamic Runtime Config Host Multi-Tenancy | Parallel requests to `/canvio-config.js` with differing `Host` headers | Returned `wsUrl` matches each respective client's request host without cross-talk |

---

### 3.4 Tier 4: Real-World Scenarios

| ID | Scenario Step | Details & Simulation | Success Verification |
|---|---|---|---|
| **T4.1** | Multi-Peer Cluster Launch | 32 virtual clients connect simultaneously to room `e2e-tier4-collaboration` | All 32 clients complete handshake with 0 drops (Close code 1000 only) |
| **T4.2** | Continuous Awareness Broadcasting | All 32 peers broadcast continuous cursor positions and names via `y-protocols/awareness` | Every peer observes >= 32 active awareness states |
| **T4.3** | Concurrent Living Node Mutations | Each peer adds unique sticky notes and executes character diffs on `Y.Text` properties | All mutations apply without collision or conflict errors |
| **T4.4** | State Vector Convergence | All 32 peers wait for synchronization quiescence | State vectors (`Y.encodeStateVector`) across all 32 clients are byte-identical |
| **T4.5** | Persistence Across Reconnect | All 32 peers disconnect. Disk binary snapshot confirmed. Cold 33rd client connects | Cold client loads 100% of nodes, relations, and text content created earlier |

---

## 4. Test Suite Architecture & Directory Structure

```
d:\Canvio\
├── scripts\
│   └── e2e\
│       ├── harness.ts              # Core test runner, HTTP client, WS client & process supervisor
│       ├── tier1-features.ts        # Tier 1: 27 feature coverage tests
│       ├── tier2-boundaries.ts      # Tier 2: 8 boundary and corner case tests
│       ├── tier3-interactions.ts    # Tier 3: 4 cross-feature interaction tests
│       ├── tier4-scenarios.ts       # Tier 4: 5 real-world 32-peer collaboration tests
│       └── run-all.ts              # Master CLI orchestrator with flags & exit code handling
├── TEST_INFRA.md                   # This infrastructure specification document
└── TEST_READY.md                   # Execution readiness, verification commands & status report
```

---

## 5. Execution Guide

### 5.1 Run Full Test Suite (All 4 Tiers)
```bash
npx tsx scripts/e2e/run-all.ts
```

### 5.2 Run Individual Tiers
```bash
# Tier 1 only (Core Feature Coverage)
npx tsx scripts/e2e/tier1-features.ts

# Tier 2 only (Boundary & Corner Cases)
npx tsx scripts/e2e/tier2-boundaries.ts

# Tier 3 only (Cross-Feature Interactions)
npx tsx scripts/e2e/tier3-interactions.ts

# Tier 4 only (32-Peer Collaboration & Persistence)
npx tsx scripts/e2e/tier4-scenarios.ts
```

### 5.3 Filter by Tiers via Master Runner
```bash
# Run Tiers 1 and 2
npx tsx scripts/e2e/run-all.ts --tier=1,2

# Run against an existing running server instance
npx tsx scripts/e2e/run-all.ts --url=http://127.0.0.1:4001
```

### 5.4 Command-Line Flags
- `--tier=<1|2|3|4|all>`: Filter executed tiers (default: `all`)
- `--url=<url>`: Target external server rather than auto-spawning ephemeral server
- `--port=<port>`: Specify port for auto-spawned server (default: random free port)
- `--bail`: Stop execution immediately on the first failed test
- `--json`: Output test results in machine-readable JSON format
- `--verbose`: Enable detailed trace logging of HTTP and WebSocket frames

---

## 6. Process Lifecycle & Port Management

The test supervisor (`harness.ts:ServerSupervisor`) guarantees clean execution:
1. **Isolated Temp Persistence**: Spawns server pointing `CANVIO_DATA_DIR` to `tmpdir()/canvio-e2e-<timestamp>-<rand>`.
2. **Readiness Probe**: Polls `GET /health` with exponential backoff until HTTP 200 is confirmed (timeout: 15s).
3. **Cross-Platform Shutdown**:
   - Sends `SIGTERM` / `SIGINT`.
   - On Windows, uses `taskkill.exe /pid <pid> /t /f` to terminate entire child process tree.
4. **Cleanup Guarantee**: Temp directories are automatically purged in `finally` blocks unless test fails with `--keep-data`.
