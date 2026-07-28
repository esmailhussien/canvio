import { useMemo } from 'react';
import { LivingNode, Viewport } from '@canvio/core';

interface UseViewportCullingOptions {
  nodes: Record<string, LivingNode>;
  viewport: Viewport;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  selectedNodeIds: string[];
  relationSourceId: string | null;
  relationTargetId: string | null;
  marginPx?: number;
}

/**
 * Custom hook to calculate visible nodes in the viewport.
 * Nodes that are far outside the screen bounds are culled from DOM rendering,
 * giving substantial performance gains for large canvases with hundreds of nodes.
 */
export function useViewportCulling({
  nodes,
  viewport,
  canvasRef,
  selectedNodeIds,
  relationSourceId,
  relationTargetId,
  marginPx = 400,
}: UseViewportCullingOptions): LivingNode[] {
  return useMemo(() => {
    const allNodes = Object.values(nodes);
    if (allNodes.length <= 15) {
      // Small node count -> skip culling overhead
      return allNodes;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    const width = rect?.width || window.innerWidth;
    const height = rect?.height || window.innerHeight;

    const zoom = Math.max(0.05, viewport.zoom);
    const halfW = width / (2 * zoom);
    const halfH = height / (2 * zoom);

    // Calculate world bounding box for viewport
    const minX = -viewport.x - halfW - marginPx / zoom;
    const maxX = -viewport.x + halfW + marginPx / zoom;
    const minY = -viewport.y - halfH - marginPx / zoom;
    const maxY = -viewport.y + halfH + marginPx / zoom;

    const selectedSet = new Set(selectedNodeIds);

    return allNodes.filter((node) => {
      // Always render selected nodes or relation targets/sources
      if (
        selectedSet.has(node.id) ||
        node.id === relationSourceId ||
        node.id === relationTargetId
      ) {
        return true;
      }

      // Check AABB intersection with visible viewport bounds
      const nodeMinX = node.position.x;
      const nodeMinY = node.position.y;
      const nodeMaxX = node.position.x + node.size.width;
      const nodeMaxY = node.position.y + node.size.height;

      return (
        nodeMaxX >= minX &&
        nodeMinX <= maxX &&
        nodeMaxY >= minY &&
        nodeMinY <= maxY
      );
    });
  }, [nodes, viewport, canvasRef, selectedNodeIds, relationSourceId, relationTargetId, marginPx]);
}
