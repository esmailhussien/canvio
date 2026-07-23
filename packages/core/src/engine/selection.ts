import { Point, Bounds, LivingNode } from '../types';

/**
 * Checks if a given point is within a given bounds.
 * @param point The point to check.
 * @param bounds The bounds to check against.
 * @returns True if the point is within the bounds, false otherwise.
 */
export function isPointInBounds(point: Point, bounds: Bounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
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
  
  for (const node of nodes) {
    const nodeBounds = getNodeBounds(node);
    
    // Check for intersection
    if (
      nodeBounds.x < rect.x + rect.width &&
      nodeBounds.x + nodeBounds.width > rect.x &&
      nodeBounds.y < rect.y + rect.height &&
      nodeBounds.y + nodeBounds.height > rect.y
    ) {
      selected.push(node);
    }
  }
  
  return selected;
}

/**
 * Calculates the combined bounding box of a selection of nodes.
 * @param nodes A map or iterable of all available nodes.
 * @param selectedIds A set or array of the selected node IDs.
 * @returns The combined bounds, or null if no valid nodes were selected.
 */
export function getSelectedBounds(nodes: Map<string, LivingNode>, selectedIds: Set<string> | string[]): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  for (const id of selectedIds) {
    const node = nodes.get(id);
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
