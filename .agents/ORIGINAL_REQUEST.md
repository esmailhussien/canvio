# Original User Request

## 2026-09-03T12:05:45Z

Execute full production and launch hardening for Canvio, bringing the collaborative spatial whiteboard platform to an enterprise-grade, deployable release for real users.

Working directory: D:\Canvio
Integrity mode: development

## Verification Resources
- `npm run typecheck` — Turborepo TypeScript verification across all 6 packages (@canvio/core, @canvio/objects, @canvio/ui, @canvio/collaboration, @canvio/web, @canvio/server).
- `npm run test:unit` — Unit test suite verifying CRDT sync, security rate limits, layout algorithms, spatial graph reasoning, and backup serialization.
- `npm run build` — Production bundling for frontend and server, including static prerendering of 12 SSG marketing and support routes.
- `npm run smoke` — Asset and split-chunk integrity verification script (`scripts/smoke-check.mjs`).

## Requirements

### R1. Containerized Single-Node Production Deployment
Provide a production-ready, multi-stage Dockerfile and deployment configuration that packages Canvio as a self-contained single-node service. The container must serve the compiled static frontend, the Fastify REST/AI API, and the real-time Yjs WebSocket server concurrently under a unified port with graceful shutdown and process lifecycle management.

### R2. System Health & Observability Endpoints
Expose standard production monitoring and liveness/readiness healthcheck endpoints (`/health` or `/api/health`) that report server uptime, memory consumption, active WebSocket connections, and storage accessibility.

### R3. Automated Concurrency & WebSocket Stress Testing
Implement an automated load-testing verification script that simulates multiple concurrent clients (at least 30 simultaneous peers) writing, panning, and synchronizing CRDT updates simultaneously over WebSockets without connection drops, state corruption, or memory leaks.

### R4. Production Hardening & Performance Validation
Verify that the complete platform operates at peak efficiency:
- Clean shutdown on SIGINT/SIGTERM without hanging connections or orphaned files.
- Client canvas maintains smooth 60fps pan/zoom interaction with 100+ nodes mounted.
- Complete security posture validation with zero unhandled rejections, sanitized error outputs, and active rate limiting.

## Acceptance Criteria

### Deployment & Packaging
- [ ] Multi-stage `Dockerfile` successfully builds with minimal image size and runs in production mode.
- [ ] Single entrypoint cleanly launches and binds unified HTTP and WebSocket handlers.
- [ ] `/health` endpoint returns HTTP 200 with JSON payload detailing uptime and service status.

### Concurrency & Reliability
- [ ] Automated stress script connects 30+ simultaneous virtual WebSocket clients sending concurrent updates.
- [ ] Server sustains concurrent load test with 0 unhandled promise rejections and 0 dropped connections.
- [ ] In-flight edits persist reliably across disconnects and reconnections.

### Code Quality & Standards
- [ ] `npm run typecheck` exits with code 0 across all packages.
- [ ] `npm run test:unit` passes 100% of tests.
- [ ] `npm run build` produces optimized production bundles and SSG routes without warnings.
- [ ] `npm run smoke` passes asset verification.
