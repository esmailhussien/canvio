import type { LivingNode } from '../store/canvasStore';

export interface NodesBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function getNodesBounds(nodes: LivingNode[]): NodesBounds {
  return nodes.reduce((acc, node) => ({
    minX: Math.min(acc.minX, node.position.x),
    minY: Math.min(acc.minY, node.position.y),
    maxX: Math.max(acc.maxX, node.position.x + node.size.width),
    maxY: Math.max(acc.maxY, node.position.y + node.size.height),
  }), {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  });
}

// Mirrors .sticky-note__text rendering: 16px font, 1.4 line-height, 16px
// padding plus a 46px tape gutter on the right.
const STICKY_LINE_HEIGHT = 22.4;
const STICKY_CHAR_WIDTH = 8;
const STICKY_PAD_X = 62;
const STICKY_PAD_Y = 32;

/**
 * Grows a sticky's height until its text fits with typing space left over.
 * Templates author content before knowing final boxes, so this guarantees no
 * clipped words regardless of copy length.
 */
export function autoFitStickyHeight<T extends LivingNode>(node: T): T {
  if (node.type !== 'sticky') return node;
  const text = typeof node.data?.text === 'string' ? node.data.text : '';
  if (!text.trim()) return node;

  const charsPerLine = Math.max(8, Math.floor((node.size.width - STICKY_PAD_X) / STICKY_CHAR_WIDTH));
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) { lines += 1; continue; }
    // The first word always occupies line 1 of the paragraph.
    let paragraphLines = 1;
    let current = words[0].length;
    for (let i = 1; i < words.length; i += 1) {
      const word = words[i];
      if (current + 1 + word.length <= charsPerLine) current += 1 + word.length;
      else { paragraphLines += 1; current = word.length; }
    }
    lines += paragraphLines;
  }

  const neededHeight = Math.ceil(lines * STICKY_LINE_HEIGHT + STICKY_PAD_Y);
  if (neededHeight <= node.size.height) return node;
  return {
    ...node,
    size: { ...node.size, height: neededHeight },
  };
}

/**
 * Shifts newly generated nodes so they land beside existing board content
 * instead of overlapping it (templates/AI drops share the same coordinates).
 * Returns input untouched when either side is empty or bounds are apart.
 */
export function placeBoardAwayFromExisting(
  newNodes: LivingNode[],
  existingNodes: LivingNode[],
  gap = 180
): LivingNode[] {
  if (newNodes.length === 0 || existingNodes.length === 0) return newNodes;

  const newBounds = getNodesBounds(newNodes);
  const existingBounds = getNodesBounds(existingNodes);
  const intersects = !(
    newBounds.maxX < existingBounds.minX ||
    newBounds.minX > existingBounds.maxX ||
    newBounds.maxY < existingBounds.minY ||
    newBounds.minY > existingBounds.maxY
  );

  if (!intersects) return newNodes;

  const offsetX = existingBounds.maxX - newBounds.minX + gap;
  const offsetY = existingBounds.minY - newBounds.minY;
  return newNodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + offsetX,
      y: node.position.y + offsetY,
    },
  }));
}
