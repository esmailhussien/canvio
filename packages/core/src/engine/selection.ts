import { Point, Bounds, LivingNode } from '../types.js';

/**
 * Normalizes a Bounds object so that width and height are always non-negative.
 */
export function normalizeBounds(bounds: Bounds): Bounds {
  const x = bounds.width < 0 ? bounds.x + bounds.width : bounds.x;
  const y = bounds.height < 0 ? bounds.y + bounds.height : bounds.y;
  const width = Math.abs(bounds.width);
  const height = Math.abs(bounds.height);
  return { x, y, width, height };
}

/**
 * Checks if a given point is within a given bounds.
 * @param point The point to check.
 * @param bounds The bounds to check against.
 * @returns True if the point is within the bounds, false otherwise.
 */
export function isPointInBounds(point: Point, bounds: Bounds): boolean {
  const b = normalizeBounds(bounds);
  return (
    point.x >= b.x &&
    point.x <= b.x + b.width &&
    point.y >= b.y &&
    point.y <= b.y + b.height
  );
}

/**
 * Gets the bounding box of a node based on its position and size.
 * @param node The node to calculate bounds for.
 * @returns The bounds of the node.
 */
export function getNodeBounds(node: LivingNode): Bounds {
  return {
    x: node.position.x,
    y: node.position.y,
    width: node.size.width,
    height: node.size.height,
  };
}

/**
 * Finds all nodes that are completely or partially within a given rectangle.
 * @param nodes An iterable of nodes to check.
 * @param rect The rectangle bounds to select within.
 * @returns An array of nodes that intersect the rectangle.
 */
export function getNodesInRect(nodes: Iterable<LivingNode>, rect: Bounds): LivingNode[] {
  const selected: LivingNode[] = [];
  const r = normalizeBounds(rect);
  
  for (const node of nodes) {
    const nodeBounds = getNodeBounds(node);
    
    // Check for intersection
    if (
      nodeBounds.x < r.x + r.width &&
      nodeBounds.x + nodeBounds.width > r.x &&
      nodeBounds.y < r.y + r.height &&
      nodeBounds.y + nodeBounds.height > r.y
    ) {
      selected.push(node);
    }
  }
  
  return selected;
}

/**
 * Calculates the combined bounding box of a selection of nodes.
 * @param nodes A Map or plain Record of all available nodes.
 * @param selectedIds A set or array of the selected node IDs.
 * @returns The combined bounds, or null if no valid nodes were selected.
 */
export function getSelectedBounds(
  nodes: Map<string, LivingNode> | Record<string, LivingNode>,
  selectedIds: Set<string> | string[]
): Bounds | null {
  // Support both Map.get() and plain object bracket access
  const getNode = (id: string): LivingNode | undefined =>
    nodes instanceof Map ? nodes.get(id) : nodes[id];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  for (const id of selectedIds) {
    const node = getNode(id);
    if (node) {
      const bounds = getNodeBounds(node);
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
      found = true;
    }
  }

  if (!found) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
