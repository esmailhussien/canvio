# Phase 1: Connectors, Shapes & Imagery

With Phase 0 complete and robust, it is time to build the features that make Canvio a true spatial thinking tool. Phase 1 transforms scattered nodes into a connected network of ideas.

## User Review Required

> [!IMPORTANT]
> **Please review the proposed features below.** Once you approve this plan, I will begin writing the code to implement these systems.

## Open Questions

1. **Relation Styling:** Should arrows be straight lines, elegantly curved bezier curves, or orthogonal (right-angled step lines like circuit boards)?
2. **Image Uploading:** For this phase, is it acceptable to store images as Base64 data directly inside the canvas file/database, or do you want to implement a dedicated image upload service (like AWS S3) right away? (Base64 is much faster to build, but takes up more database storage).

## Proposed Changes

### 1. Smart Connectors (The Relations Engine)
The most important part of Phase 1. We will bring the `Relation` tool to life.
- **Connection Ports:** Every node (Maps, Text, Sticky Notes) will have invisible magnetic "ports" on their edges (Top, Bottom, Left, Right).
- **Interactive Dragging:** Selecting the Relation tool will let you click a port on Node A and drag a live, curving arrow to a port on Node B.
- **Dynamic Routing:** When you move a connected node, the arrows will automatically stay attached and smoothly reroute themselves in real-time.
- **Meaningful Labels:** You will be able to double-click any arrow to type a label (e.g., "Supports," "Contradicts," "Flows to") directly on the line.

### 2. Basic Shapes Node (`ShapeNode.tsx`)
We need primitive objects to build flowcharts and diagrams.
- Add support for Rectangles, Circles, Diamonds, and Triangles.
- Allow users to double-click inside any shape to type text.
- Add theming options (border color, fill color).

### 3. Image Node (`ImageNode.tsx`)
A canvas isn't complete without visual media.
- Create an `ImageNode` that can be dropped onto the World.
- Support for pasting images directly from the clipboard (`Ctrl+V`), which instantly spawns an Image Node at your cursor.
- Images will be fully resizable and can be connected to other nodes (e.g., drawing an arrow from a Map location to an Image of that location).

## Verification Plan

### Automated & Manual Testing
- Verify that drawing a Relation between two moving nodes perfectly updates the SVG path without freezing the CRDT sync engine.
- Ensure that Base64 images sync across WebSocket connections correctly and render instantly for remote users.
- Confirm that Shapes snap cleanly to the grid and integrate perfectly with the Selection engine.
