## 2026-09-03T12:34:54Z
You are Worker M1-1 (teamwork_preview_worker).
Your working directory is: d:\Canvio\.agents\worker_m1_1
Your parent conversation ID is: 56ed3d31-582c-4406-a255-64a1f06d6aea

MANDATORY FIRST STEP:
Read the authoritative user request at: d:\Canvio\.agents\ORIGINAL_REQUEST.md
Read the project architecture at: d:\Canvio\PROJECT.md
Read the three explorer handoff reports:
- d:\Canvio\.agents\explorer_m1_1\handoff.md (Health & Observability subsystem)
- d:\Canvio\.agents\explorer_m1_2\handoff.md (Static Serving, CSP Scoping & Dynamic Config)
- d:\Canvio\.agents\explorer_m1_3\handoff.md (Yjs Persistence Flush & Graceful Shutdown)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE FILE OWNERSHIP:
You own and may modify:
- apps/server/package.json
- apps/server/src/health.ts
- apps/server/src/storage/yPersistence.ts
- apps/server/src/http.ts
- apps/server/src/combined-server.ts
- apps/server/src/index.ts
- scripts/unit/run-unit-tests.ts
Do NOT modify files outside this set without prior coordination.

OBJECTIVES:
Implement Milestone 1 (Server Observability, Static Serving & Lifecycle):
1. apps/server/package.json: Add "@fastify/static": "^8.1.0" to dependencies. Run npm install if necessary.
2. apps/server/src/health.ts: Implement complete health & observability engine providing checkStorageHealth() (verifying both data/boards and data/ydocs), getMemoryStats(), formatUptime(), getHealthReport(hooks), getReadiness(), and registerHealthRoutes(app, hooks) exposing /health, /api/health, /health/ready, and /api/health/ready.
3. apps/server/src/storage/yPersistence.ts: Implement activeDocs tracking with doc.on('destroy') cleanup, pendingWrites timer tracking, per-doc write serialization, flushAll(): Promise<void>, flushDoc(), getActiveDocs(), getPendingWritesCount().
4. apps/server/src/http.ts: Scope CSP headers: strict default-src 'none' for /api/*, and web-safe CSP for frontend HTML/assets (supporting self, inline scripts for theme/jsonld, inline styles, OpenStreetMap/ArcGIS/QuickChart images, fonts, and ws:/wss: WebSockets).
5. apps/server/src/combined-server.ts:
   - Retain persistence = createFilePersistence() and pass to setPersistence().
   - Register fastifyStatic pointing to apps/web/dist.
   - Register GET /canvio-config.js returning dynamic window.CANVIO_CONFIG with host-relative wsUrl.
   - Relocate root API metadata to GET /api.
   - Register registerHealthRoutes(app, hooks) with getActiveConnections, getActiveDocs, getMaxConnections.
   - Set up setNotFoundHandler with 4-tier resolution: API 404 JSON, asset 404 JSON, SSG route resolution (<path>/index.html), and SPA fallback (dist/index.html).
   - Set default CANVIO_WS_MAX_PER_IP to 100.
   - Add process traps for unhandledRejection and uncaughtException.
   - Implement graceful shutdown on SIGINT and SIGTERM: close wss listener, notify clients with close code 1001, await persistence.flushAll(), await app.close(), with 10s fallback timer.
6. apps/server/src/index.ts: Register registerHealthRoutes(app) and update endpoint directory with /api/health.
7. scripts/unit/run-unit-tests.ts: Add unit test suites for formatUptime, getMemoryStats, checkStorageHealth, getHealthReport, registerHealthRoutes injection, and yPersistence flushAll().
8. Verification:
   - Run `npm run typecheck` (must exit 0 across all 6 packages).
   - Run `npm run test:unit` (must pass 100%).
   - Run `npm run build` (must pass cleanly).
   - Run `npm run smoke` (must pass cleanly).
   - Run `npx tsx scripts/e2e/tier1-features.ts` (must pass).

DELIVERABLES:
Write a comprehensive handoff report to:
d:\Canvio\.agents\worker_m1_1\handoff.md
Follow the standard Handoff Protocol:
- Observation (what was implemented, files modified, line references)
- Logic Chain (how the solution satisfies requirements)
- Caveats (any runtime considerations)
- Conclusion (readiness for review and audit)
- Verification Method (exact commands run and verified outputs)

When done, update progress.md and send a message back to your parent (id: 56ed3d31-582c-4406-a255-64a1f06d6aea).

## 2026-09-03T12:55:26Z
**Context**: Milestone 1 Server Observability, Static Serving & Lifecycle implementation and E2E verification on Windows.
**Content**: Coordination approval GRANTED. You are authorized to edit `scripts/e2e/harness.ts` (and if needed `scripts/e2e/tier1-features.ts`) to fix the Windows process termination exit code handling and defer dataDir cleanup until after persistence assertions.
**Action**: Apply the fix in `scripts/e2e/harness.ts`, re-run `npx tsx scripts/e2e/tier1-features.ts` until 27/27 tests pass, verify typecheck and unit tests, and complete your `handoff.md`.
