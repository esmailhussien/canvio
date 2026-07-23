# Phase 4 Notes

## Completed

- Runtime configuration is now loaded from `/canvio-config.js`, so API and WebSocket URLs can be changed after the web app is built.
- The nginx Docker image writes `/canvio-config.js` at container start from `VITE_API_URL` and `VITE_WS_URL`.
- The Vite production bundle is split into React, map, collaboration, motion, and general vendor chunks.
- A smoke check script verifies production build essentials before manual QA.

## Manual Test Notes

- Create a new world from `/` and confirm the API creates board metadata.
- Refresh an existing world and confirm nodes/relations reload from persisted Yjs state.
- Open the same world in two browser tabs and confirm cursors, node edits, marker edits, and relation labels sync.
- Export JSON and PNG after adding maps, markers, images, drawings, relations, and code nodes.
- Recreate Docker containers and confirm board metadata and world content survive through the `canvio-data` volume.

## Known Follow-Ups

- Replace the current TypeScript-only lint placeholder with a real ESLint config.
- Add browser-driven E2E tests for canvas workflows.
- Add true undo coverage for drag, resize, text edits, marker edits, and relation style changes.
- Consider backing file persistence with Postgres or object storage before multi-tenant production use.
