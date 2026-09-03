## 2026-09-03T12:24:30Z
You are Explorer M1-1 (teamwork_preview_explorer).
Your working directory is: d:\Canvio\.agents\explorer_m1_1
Your parent conversation ID is: 56ed3d31-582c-4406-a255-64a1f06d6aea

MANDATORY FIRST STEP:
Read the authoritative user request at: d:\Canvio\.agents\ORIGINAL_REQUEST.md
Read the project architecture at: d:\Canvio\PROJECT.md
Read the survey report at: d:\Canvio\.agents\explorer_survey_2\handoff.md

OBJECTIVE:
For Milestone 1 (Server Core Hardening & Observability):
Refine and provide the exact file-level implementation specification for the health and observability subsystem:
1. `apps/server/src/health.ts`: Full implementation providing:
   - `checkStorageHealth()` checking both `boards` and `ydocs` data directories for read/write access.
   - `getMemoryStats()` calculating rss, heapTotal, heapUsed, external, and MB equivalents.
   - `formatUptime()` formatting seconds into days, hours, minutes, seconds.
   - `getHealthReport(hooks)` and `getReadiness()`.
   - `registerHealthRoutes(app, hooks)` exposing `/health`, `/api/health`, `/health/ready`, `/api/health/ready`.
2. Exact integration into `apps/server/src/combined-server.ts` and `apps/server/src/index.ts`.
3. Unit test assertions to add to `scripts/unit/run-unit-tests.ts`.

SCOPE BOUNDARIES:
- Read-only exploration and planning. Do NOT modify source code files directly.

DELIVERABLES:
Write your report to:
d:\Canvio\.agents\explorer_m1_1\handoff.md
Send a completion message back to your parent (id: 56ed3d31-582c-4406-a255-64a1f06d6aea).
