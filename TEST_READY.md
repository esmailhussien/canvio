# Canvio E2E Test Suite Readiness & Execution Guide

**Publish Date**: 2026-09-03  
**Test Suite Status**: **READY**  
**Framework Version**: 1.0.0  
**Test Suite Location**: `scripts/e2e/`  
**Test Infrastructure Spec**: `TEST_INFRA.md`  

---

## 1. Quick Start / Runner Commands

The test suite is fully independent, self-contained, and requires zero external test runners or browser binaries. It executes natively via `tsx`.

### 1.1 Master Runner (Runs All 4 Tiers)
```bash
npx tsx scripts/e2e/run-all.ts
```

### 1.2 Individual Tier Execution Commands
```bash
# Tier 1: Core Feature Coverage (27 tests)
npx tsx scripts/e2e/tier1-features.ts

# Tier 2: Boundary & Corner Cases (8 tests)
npx tsx scripts/e2e/tier2-boundaries.ts

# Tier 3: Cross-Feature Interactions (4 tests)
npx tsx scripts/e2e/tier3-interactions.ts

# Tier 4: Real-World Scenarios (5 tests)
npx tsx scripts/e2e/tier4-scenarios.ts
```

### 1.3 Selective Tier Filtering & Target Server Modes
```bash
# Run specific tiers (e.g. Tiers 1 and 2 only)
npx tsx scripts/e2e/run-all.ts --tier=1,2

# Run against an existing running server (e.g. docker container or dev server)
npx tsx scripts/e2e/run-all.ts --url=http://127.0.0.1:4001

# Stop on first failure
npx tsx scripts/e2e/run-all.ts --bail
```

---

## 2. Test Coverage Summary

| Tier | Focus Area | Test Count | Key Features Covered |
|---|---|---|---|
| **Tier 1** | Feature Coverage | **27 tests** | Health endpoints (`/health`, `/api/health`, `/health/ready`, `/api/health/ready`), Observability metrics (`uptime`, `heapUsed`, `rss`), Static frontend serving (`/`, `/index.html`, `/assets/*`, SSG routes `/how-it-works`, `/support`, `/updates`, SPA `/w/*` fallback), Dynamic config (`/canvio-config.js`), WebSocket lifecycle (handshake, Yjs SyncStep1/2, origin checks, ping/pong), Graceful shutdown (`SIGINT`, `SIGTERM`, close code 1001, persistence flush, port unbind) |
| **Tier 2** | Boundary & Corner Cases | **8 tests** | Storage degradation (read-only filesystem -> 503), WS max connection capacity limit (code 1013), WS per-IP concurrency throttling (code 1013), Multi-client IP dispersal via `X-Forwarded-For`, Unauthorized origin rejection (code 1008), Missing origin header enforcement (code 1008), Rapid connect/disconnect churn resilience (20 sockets), Oversized payload bound rejection |
| **Tier 3** | Cross-Feature Interactions | **4 tests** | Concurrent REST traffic under active WebSocket CRDT synchronization, Real-time dynamic health report accuracy during fluctuating connection load, Static asset delivery concurrent with heavy binary CRDT sync, Dynamic runtime config isolation across concurrent multi-host requests |
| **Tier 4** | Real-World Collaboration & Persistence | **5 tests** | 32 simultaneous virtual peer whiteboard session, Ephemeral cursor awareness broadcasting (`y-protocols/awareness`), Concurrent living note creations and character-level text diffing, Complete state vector convergence across all 32 peers, Persistence across total disconnect and cold-start 33rd peer restoration |
| **Total** | **All Tiers** | **44 tests** | **100% Opaque-Box Coverage across Requirements R1, R2, R3, R4** |

---

## 3. Feature Verification Checklist

### Requirement R1: Containerized Single-Node Deployment
- [x] Fastify HTTP API and Yjs WebSocket Server unified port binding verified.
- [x] Static frontend asset serving from `apps/web/dist` with `text/html` and `application/javascript` MIME types verified.
- [x] SSG prerendered marketing and support routes (`/how-it-works`, `/support`, `/updates`) verified.
- [x] Client SPA fallback routing (`/w/:boardId`) verified.
- [x] Dynamic runtime configuration (`/canvio-config.js`) generating host-derived `wsUrl` verified.
- [x] Cache prevention headers on runtime config verified.

### Requirement R2: System Health & Observability Endpoints
- [x] Liveness endpoint `GET /health` responding HTTP 200 with status and timestamp verified.
- [x] API alias `GET /api/health` responding HTTP 200 verified.
- [x] Readiness endpoint `GET /health/ready` verifying storage directory accessibility verified.
- [x] API readiness alias `GET /api/health/ready` verified.
- [x] Process observability metrics (`process.uptime()`, `heapUsed`, `heapTotal`, `rss`) verified.
- [x] Real-time active WebSocket connection telemetry verified under live load fluctuations.

### Requirement R3: Automated Concurrency & WebSocket Stress Testing
- [x] 32 simultaneous virtual peers connecting to a single whiteboard room verified.
- [x] Continuous cursor presence awareness (`y-protocols/awareness`) broadcasting verified.
- [x] Concurrent CRDT node creation and operational character-level text diffing verified.
- [x] State vector convergence (`Y.encodeStateVector`) byte-for-byte equality verified across all peers.
- [x] On-disk binary snapshot persistence (`data/ydocs/<boardId>.bin`) verified.
- [x] Cold-start reconnection of fresh 33rd client verifying 100% state restoration verified.

### Requirement R4: Production Hardening & Performance Validation
- [x] POSIX `SIGINT` and `SIGTERM` signal traps verified with clean exit code 0.
- [x] Active WebSocket clients receiving close frame code 1001 ("Going Away") on shutdown verified.
- [x] Debounced in-memory persistence snapshots flushed to disk upon shutdown verified.
- [x] Server listen port immediately released for rebinding verified.
- [x] Connection capacity ceiling (`CANVIO_WS_MAX_CONNECTIONS`) rejecting with code 1013 verified.
- [x] Per-IP connection rate limiting (`CANVIO_WS_MAX_PER_IP`) rejecting with code 1013 verified.
- [x] Origin authorization header security (`Origin: https://canvio.space` vs malicious origin -> 1008) verified.
- [x] Storage failure gracefully degrades readiness endpoint to HTTP 503 verified.

---

## 4. Authoritative Expected Output Derivation

All assertions are derived from authoritative technical contracts:
1. **HTTP RFC 9110 & Status Codes**:
   - `200 OK`: Successful liveness, readiness, static assets, and config.
   - `404 Not Found`: Non-existent assets and routes.
   - `503 Service Unavailable`: Unwritable or inaccessible storage in readiness checks.
2. **WebSocket RFC 6455 & IANA Status Codes**:
   - `1000 Normal Closure`: Clean client/server disconnect.
   - `1001 Going Away`: Sent by server to clients during graceful shutdown (`SIGTERM`/`SIGINT`).
   - `1008 Policy Violation`: Origin mismatch, missing origin, or authorization failure.
   - `1009 Message Too Big`: Payload exceeding configured `WS_MAX_PAYLOAD`.
   - `1013 Try Again Later`: Exceeded global (`WS_MAX_CONNECTIONS`) or per-IP (`WS_MAX_PER_IP`) limit.
3. **Yjs CRDT Wire Protocol**:
   - Binary framing `messageSync = 0`, `messageAwareness = 1`.
   - State vectors derived via `Y.encodeStateVector(doc)`.
