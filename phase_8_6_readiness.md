# Phase 8.6 Readiness: Repeatable QA + Collaboration Proof

## Automated E2E Smoke

Run:

```bash
npm run e2e:smoke
```

This now builds the production web bundle, launches Vite preview on an isolated test port, opens a fresh world, and verifies the critical polished workflows:

- inserts the high-quality Field Operations Map template
- confirms map pins render
- creates a relation from an individual map pin to another canvas node
- verifies viewport movement and Fit to world
- exports JSON backup
- exports PNG image
- restores a JSON backup with theme/background appearance

## Manual Collaboration Proof

Use this as the collaboration gate before a release demo:

- Open the same `/w/{worldId}` in two browser windows.
- In window A, add a template and move one node.
- In window B, confirm the node appears and moves without reload.
- In window A, create a relation from a map pin to a sticky/shape node.
- In window B, confirm the relation anchors to the same pin, not only the whole map.
- In window B, change theme/background; reload both windows and confirm the world appearance persists.
- Export JSON in either window and restore it into a fresh world.

## Release Signal

Phase 8.6 is ready when `npm run e2e:smoke`, `npm run typecheck`, `npm run lint`, `npm run smoke`, and `npm run build` all pass.
