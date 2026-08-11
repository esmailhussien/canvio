import { LivingNode, useCanvasStore } from '../store/canvasStore';

export function fitViewportToNodes(nodes: LivingNode[], options: { maxZoom?: number; minZoom?: number; paddingX?: number; paddingY?: number } = {}) {
  if (typeof window === 'undefined' || nodes.length === 0) return;

  const bounds = nodes.reduce((acc, node) => ({
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

  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const canvasRect = document.querySelector<HTMLElement>('.canvas')?.getBoundingClientRect();
  const viewportWidth = canvasRect?.width || window.innerWidth;
  const viewportHeight = canvasRect?.height || window.innerHeight;
  const availableWidth = Math.max(160, viewportWidth - (options.paddingX ?? 180));
  const availableHeight = Math.max(160, viewportHeight - (options.paddingY ?? 190));
  const zoom = Math.min(
    options.maxZoom ?? 1,
    Math.max(options.minZoom ?? 0.55, Math.min(availableWidth / width, availableHeight / height))
  );

  useCanvasStore.getState().setViewport({
    x: -((bounds.minX + bounds.maxX) / 2),
    y: -((bounds.minY + bounds.maxY) / 2),
    zoom,
  });
}

export function fitTemplateToViewport(nodes: LivingNode[]) {
  if (typeof window === 'undefined' || nodes.length === 0) return;

  const canvasRect = document.querySelector<HTMLElement>('.canvas')?.getBoundingClientRect();
  const viewportWidth = canvasRect?.width || window.innerWidth;
  const isCompact = viewportWidth <= 760;

  fitViewportToNodes(nodes, {
    maxZoom: isCompact ? 0.82 : 0.96,
    minZoom: 0.1,
    paddingX: isCompact ? 36 : 220,
    paddingY: isCompact ? 190 : 230,
  });
}
