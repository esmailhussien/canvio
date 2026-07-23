import { LivingNode, useCanvasStore } from '../store/canvasStore';

/**
 * Automatically arranges all nodes (or selected nodes) into a clean, neat grid.
 */
export function tidyGrid(selectedOnly = false) {
  const store = useCanvasStore.getState();
  const allNodes = Object.values(store.nodes);
  const targetNodes = selectedOnly && store.selectedNodeIds.length > 0
    ? allNodes.filter(n => store.selectedNodeIds.includes(n.id))
    : allNodes;

  if (targetNodes.length === 0) return;

  const PADDING = 40;
  const columns = Math.ceil(Math.sqrt(targetNodes.length));
  
  // Calculate average size
  const maxW = Math.max(...targetNodes.map(n => n.size.width));
  const maxH = Math.max(...targetNodes.map(n => n.size.height));
  const cellW = maxW + PADDING;
  const cellH = maxH + PADDING;

  // Center around current nodes centroid
  const avgX = targetNodes.reduce((acc, n) => acc + n.position.x, 0) / targetNodes.length;
  const avgY = targetNodes.reduce((acc, n) => acc + n.position.y, 0) / targetNodes.length;

  const startX = avgX - ((columns * cellW) / 2) + cellW / 2;

  targetNodes.forEach((node, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const newX = Math.round(startX + col * cellW);
    const newY = Math.round(avgY + row * cellH);

    store.updateNode(node.id, {
      position: { x: newX, y: newY }
    });
  });
}

/**
 * Automatically arranges nodes into a clean horizontal/vertical process flow.
 */
export function tidyFlow(selectedOnly = false) {
  const store = useCanvasStore.getState();
  const allNodes = Object.values(store.nodes);
  const targetNodes = selectedOnly && store.selectedNodeIds.length > 0
    ? allNodes.filter(n => store.selectedNodeIds.includes(n.id))
    : allNodes;

  if (targetNodes.length === 0) return;

  const GAP = 80;
  let currentX = Math.min(...targetNodes.map(n => n.position.x));
  const avgY = targetNodes.reduce((acc, n) => acc + n.position.y, 0) / targetNodes.length;

  // Sort nodes left-to-right
  const sorted = [...targetNodes].sort((a, b) => a.position.x - b.position.x);

  sorted.forEach((node) => {
    store.updateNode(node.id, {
      position: { x: currentX, y: Math.round(avgY) }
    });
    currentX += node.size.width + GAP;
  });
}
