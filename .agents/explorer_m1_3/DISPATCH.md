## 2026-09-03T12:24:30Z
You are Explorer M1-3 (teamwork_preview_explorer).
Your working directory is: d:\Canvio\.agents\explorer_m1_3
Your parent conversation ID is: 56ed3d31-582c-4406-a255-64a1f06d6aea

MANDATORY FIRST STEP:
Read the authoritative user request at: d:\Canvio\.agents\ORIGINAL_REQUEST.md
Read the project architecture at: d:\Canvio\PROJECT.md
Read the survey report at: d:\Canvio\.agents\explorer_survey_3\handoff.md

OBJECTIVE:
For Milestone 1 (Server Core Hardening & Observability):
Refine and provide the exact file-level implementation specification for process lifecycle and concurrency parameters:
1. `apps/server/src/storage/yPersistence.ts`:
   - Adding a tracking mechanism for active docs and pending write timers.
   - Adding `flushAll(): Promise<void>` to flush all pending writes immediately.
2. `apps/server/src/combined-server.ts`:
   - Registering `process.on('SIGINT')` and `process.on('SIGTERM')`.
   - Graceful shutdown sequence: stop HTTP/WS listeners, notify and close WebSockets with code 1001, await `persistence.flushAll()`, await `app.close()`, with a 10s fallback timer.
   - Global `process.on('unhandledRejection')` and `process.on('uncaughtException')` listeners.
   - Updating default `CANVIO_WS_MAX_PER_IP` from 20 to 100.

SCOPE BOUNDARIES:
- Read-only exploration and planning. Do NOT modify source code files directly.

DELIVERABLES:
Write your report to:
d:\Canvio\.agents\explorer_m1_3\handoff.md
Send a completion message back to your parent (id: 56ed3d31-582c-4406-a255-64a1f06d6aea).
