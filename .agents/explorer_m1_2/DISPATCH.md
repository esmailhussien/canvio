## 2026-09-03T12:24:30Z
You are Explorer M1-2 (teamwork_preview_explorer).
Your working directory is: d:\Canvio\.agents\explorer_m1_2
Your parent conversation ID is: 56ed3d31-582c-4406-a255-64a1f06d6aea

MANDATORY FIRST STEP:
Read the authoritative user request at: d:\Canvio\.agents\ORIGINAL_REQUEST.md
Read the project architecture at: d:\Canvio\PROJECT.md
Read the survey report at: d:\Canvio\.agents\explorer_survey_1\handoff.md

OBJECTIVE:
For Milestone 1 (Server Core Hardening & Observability):
Refine and provide the exact file-level implementation specification for static frontend serving and dynamic configuration:
1. Adding `@fastify/static` to `apps/server/package.json` and registering it in `apps/server/src/combined-server.ts` pointing to `apps/web/dist`.
2. Scoping CSP headers in `apps/server/src/http.ts`: ensure `default-src 'none'` applies only to `/api/*` endpoints, while HTML and static frontend assets receive a production-safe policy allowing scripts, inline theme scripts, OpenStreetMap tiles, styles, and WebSockets.
3. Route `GET /canvio-config.js` serving dynamic JavaScript defining `window.CANVIO_CONFIG` with host-relative `wsUrl`.
4. Fastify not-found handler in `combined-server.ts`: serving SSG routes (`<route>/index.html`) or falling back to `dist/index.html` for SPA navigation, while preserving 404 JSON for `/api/*`.

SCOPE BOUNDARIES:
- Read-only exploration and planning. Do NOT modify source code files directly.

DELIVERABLES:
Write your report to:
d:\Canvio\.agents\explorer_m1_2\handoff.md
Send a completion message back to your parent (id: 56ed3d31-582c-4406-a255-64a1f06d6aea).
