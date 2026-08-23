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

const OVERLAP_GAP = 110;

function intersects(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x &&
    a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/**
 * Deterministic post-layout for generated boards (AI drafts): pushes nodes
 * right until they keep clean separation, keeping the author's rough row
 * order. Wider corridors give the relation router room to thread lanes
 * BETWEEN columns instead of detouring around the whole cluster.
 *
 * Frames stay anchored during resolution and act as plain obstacles, then
 * each frame is re-fit to wrap whatever nodes it originally contained — so
 * content can never end up stranded outside its frame.
 */
const MIN_NODE_SEPARATION = 110;
const FRAME_PADDING = 60;

export function resolveNodeOverlaps<T extends LivingNode>(nodes: T[], gap = MIN_NODE_SEPARATION): T[] {
  const frames = nodes.filter((n) => n.type === 'frame');
  const movable = nodes
    .filter((n) => n.type !== 'frame')
    .sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));

  // Frames are obstacles at their true size (no inflation): nodes authored
  // inside a frame must not be pushed out of it by proximity rules.
  const placed: Array<{ x: number; y: number; w: number; h: number; isFrame: boolean }> = frames.map((f) => ({
    x: f.position.x,
    y: f.position.y,
    w: f.size.width,
    h: f.size.height,
    isFrame: true,
  }));

  const finalPos = new Map<string, { x: number; y: number }>();

  for (const node of movable) {
    const w = node.size.width;
    const h = node.size.height;
    let x = node.position.x;
    const y = node.position.y;

    for (let guard = 0; guard < 300; guard += 1) {
      const hit = placed.find((p) =>
        intersects(
          { x, y, w, h },
          p.isFrame ? p : { x: p.x - gap / 2, y: p.y - gap / 2, w: p.w + gap, h: p.h + gap }
        )
      );
      if (!hit) break;
      x = hit.x + hit.w + (hit.isFrame ? gap : gap);
    }

    placed.push({ x, y, w, h, isFrame: false });
    finalPos.set(node.id, { x, y });
  }

  // Re-fit every frame around the FINAL positions of the nodes it originally
  // contained, so resolution can never strand content outside its frame.
  const fittedFrames = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const frame of frames) {
    const fx2 = frame.position.x + frame.size.width;
    const fy2 = frame.position.y + frame.size.height;
    const contained = movable.filter((node) => {
      const cx = node.position.x + node.size.width / 2;
      const cy = node.position.y + node.size.height / 2;
      return (
        cx >= frame.position.x && cx <= fx2 &&
        cy >= frame.position.y && cy <= fy2
      );
    });
    if (contained.length === 0) continue;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of contained) {
      const pos = finalPos.get(node.id) || node.position;
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + node.size.width);
      maxY = Math.max(maxY, pos.y + node.size.height);
    }
    fittedFrames.set(frame.id, {
      x: minX - FRAME_PADDING,
      y: minY - FRAME_PADDING,
      width: Math.max(320, maxX - minX + FRAME_PADDING * 2),
      height: Math.max(220, maxY - minY + FRAME_PADDING * 2),
    });
  }

  if (finalPos.size === 0 && fittedFrames.size === 0) return nodes;
  return nodes.map((node) => {
    const fit = fittedFrames.get(node.id);
    if (fit) {
      return {
        ...node,
        position: { x: fit.x, y: fit.y },
        size: { width: fit.width, height: fit.height },
      };
    }
    const pos = finalPos.get(node.id);
    return pos ? { ...node, position: pos } : node;
  });
}

/**
 * Standard pipeline for machine-generated nodes (AI Navigator, summarize,
 * expand): fit sticky text, remove intra-board overlaps, then let callers
 * run placeBoardAwayFromExisting against existing content.
 */
export function prepareGeneratedNodes<T extends LivingNode>(nodes: T[]): T[] {
  return resolveNodeOverlaps(nodes.map((node) => autoFitStickyHeight(node)));
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
