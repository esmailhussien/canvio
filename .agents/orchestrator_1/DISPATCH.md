# Dispatch Log

## 2026-09-03T12:07:00Z
You are the Project Orchestrator for the Canvio project.

Your working directory is: d:\Canvio\.agents\orchestrator_1
The project workspace root is: d:\Canvio
The authoritative original user request is recorded at: d:\Canvio\.agents\ORIGINAL_REQUEST.md

Task:
Execute full production and launch hardening for Canvio, bringing the collaborative spatial whiteboard platform to an enterprise-grade, deployable release for real users.

Integrity mode: development

Requirements:
- R1. Containerized Single-Node Production Deployment: Multi-stage Dockerfile and deployment configuration packaging Canvio as a self-contained single-node service (serving static frontend, Fastify REST/AI API, real-time Yjs WebSocket server concurrently under unified port with graceful shutdown).
- R2. System Health & Observability Endpoints: Standard monitoring and liveness/readiness healthcheck endpoints (/health or /api/health) reporting uptime, memory consumption, active WebSocket connections, and storage accessibility.
- R3. Automated Concurrency & WebSocket Stress Testing: Automated load-testing script simulating at least 30 simultaneous peers writing, panning, synchronizing CRDT updates over WebSockets without drops, corruption, or leaks.
- R4. Production Hardening & Performance Validation: Clean shutdown on SIGINT/SIGTERM, client canvas smooth 60fps pan/zoom with 100+ nodes, security posture validation (zero unhandled rejections, sanitized error outputs, active rate limiting).

Acceptance Criteria & Verification Resources:
- Multi-stage Dockerfile successfully builds with minimal image size and runs in production mode.
- Single entrypoint cleanly launches and binds unified HTTP and WebSocket handlers.
- /health endpoint returns HTTP 200 with JSON payload detailing uptime and service status.
- Automated stress script connects 30+ simultaneous virtual WebSocket clients sending concurrent updates.
- Server sustains concurrent load test with 0 unhandled promise rejections and 0 dropped connections.
- In-flight edits persist reliably across disconnects and reconnections.
- `npm run typecheck` exits with code 0 across all 6 packages (@canvio/core, @canvio/objects, @canvio/ui, @canvio/collaboration, @canvio/web, @canvio/server).
- `npm run test:unit` passes 100% of tests.
- `npm run build` produces optimized production bundles and SSG routes without warnings.
- `npm run smoke` passes asset verification (`scripts/smoke-check.mjs`).

Coordination & Working Memory:
- Maintain your `BRIEFING.md`, `plan.md`, and update `progress.md` regularly in your working directory `d:\Canvio\.agents\orchestrator_1`.
- Follow the subagent convention: create designated directories under `d:\Canvio\.agents/` for any specialists you spawn.
- When all requirements and acceptance criteria are completely implemented and verified, report completion with a structured victory claim and handoff back to the Sentinel.
