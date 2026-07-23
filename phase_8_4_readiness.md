# Phase 8.4 Product Readiness QA

## Vision Alignment

Canvio is now strongest around the core promise from `product_bible.md`: one spatial world where maps, notes, shapes, AI output, and relations stay connected. The latest work supports the main magic moments:

- First relation: relations snap to nodes, ports, shapes, and individual map pins.
- Living map: map nodes support editable markers and marker-level relation anchors.
- Return: local world state now persists nodes, relations, appearance, and viewport.
- Spatial AI: AI creates real nodes and relations instead of plain text.

## Completed In This Pass

- Verified a representative site-visit board with map pins, notes, a summary shape, and relations.
- Improved PNG export color handling for CSS variables such as `var(--relation-default)`.
- Improved PNG map export so map markers render visibly inside exported map placeholders.
- Added durable export success/error feedback after the export menu closes.
- Confirmed JSON and PNG export success feedback in the live UI.

## Remaining Gaps

- PNG export still uses a styled map placeholder rather than real satellite tiles. This is safer and reliable, but not a pixel-perfect map export.
- There is no formal import flow for exported JSON backups yet.
- Collaboration could use a two-browser/manual QA pass for live remote cursors and edits.
- Export download events from blob URLs are not surfaced by the in-app browser test runtime, so UI success state is the verified signal.

## Recommended Next

Do a focused **Phase 8.5 release hardening** pass:

- Add JSON import/restore.
- Add a lightweight E2E test script for template, relation, persistence, and export UI states.
- Add an in-app "fit to world" command for quick recovery after heavy panning/zooming.
- Run one true two-client collaboration QA session.
