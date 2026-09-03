# BRIEFING — 2026-09-03T12:31:00Z

## Mission
Investigate and specify exact file-level implementation for static frontend serving, scoped CSP headers, dynamic /canvio-config.js, and SSG/SPA fallback routing in Fastify.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: d:\Canvio\.agents\explorer_m1_2
- Original parent: 56ed3d31-582c-4406-a255-64a1f06d6aea
- Milestone: M1-2 (Static Frontend Serving & Dynamic Config)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do NOT modify source code files directly
- Write reports in d:\Canvio\.agents\explorer_m1_2\
- Send completion message to parent (id: 56ed3d31-582c-4406-a255-64a1f06d6aea)

## Current Parent
- Conversation ID: 56ed3d31-582c-4406-a255-64a1f06d6aea
- Updated: 2026-09-03T12:31:00Z

## Investigation State
- **Explored paths**:
  - `apps/server/package.json`
  - `apps/server/src/combined-server.ts`
  - `apps/server/src/http.ts`
  - `apps/web/dist` build output structure and SSG routes
  - `apps/web/index.html` inline theme script and JSON-LD
  - `apps/web/src/utils/runtimeConfig.ts`
  - `packages/objects/src/map/MapNode.tsx` map tile sources
  - `scripts/prerender.mjs` and `scripts/smoke-check.mjs`
- **Key findings**:
  - Package `@fastify/static@^8.1.0` is required for Fastify 5 compatibility in `apps/server/package.json`.
  - Global CSP in `http.ts` currently sets `default-src 'none'`, blocking scripts, styles, maps, and WebSockets. Needs route scoping: `/api/*` gets strict CSP; frontend gets comprehensive policy permitting `'self'`, `'unsafe-inline'`, OpenStreetMap (`*.tile.openstreetmap.org`), ArcGIS satellite tiles (`server.arcgisonline.com`), QuickChart (`quickchart.io`), and WebSockets (`ws:`, `wss:`).
  - Dynamic `GET /canvio-config.js` must serve host-relative `wsUrl` falling back to `((window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host)` and `apiUrl` relative `''`, with no-cache headers.
  - `combined-server.ts` currently returns JSON on `GET /`. Must replace with `@fastify/static` root serving and implement custom `setNotFoundHandler` distinguishing `/api/*` 404 JSON, SSG routes (`<route>/index.html`), and SPA fallback (`index.html`) for dynamic routes (`/w/*`).
- **Unexplored areas**: None within the scope of M1-2.

## Key Decisions Made
- Scoped CSP via `request.url` path matching in Fastify `onRequest` hook.
- Designed robust SSG route resolution with directory traversal sanitization.
- Designed dynamic client-side `wsUrl` resolution for zero-config Docker port mapping.

## Artifact Index
- `d:\Canvio\.agents\explorer_m1_2\DISPATCH.md` — Dispatch instructions
- `d:\Canvio\.agents\explorer_m1_2\BRIEFING.md` — Working memory
- `d:\Canvio\.agents\explorer_m1_2\progress.md` — Liveness heartbeat
- `d:\Canvio\.agents\explorer_m1_2\handoff.md` — Final handoff report
