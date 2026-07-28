import { useState, useCallback } from 'react';
import { useCanvasStore } from '../../../store/canvasStore';

export function useCanvasMarquee() {
  const [isMarqueeActive, setIsMarqueeActive] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);

  const startMarquee = useCallback((worldPos: { x: number; y: number }) => {
    setMarqueeStart(worldPos);
    setMarqueeEnd(worldPos);
    setIsMarqueeActive(true);
    useCanvasStore.getState().clearSelection();
  }, []);

  const updateMarquee = useCallback(
    (worldPos: { x: number; y: number }) => {
      if (isMarqueeActive) {
        setMarqueeEnd(worldPos);
      }
    },
    [isMarqueeActive]
  );

  const finishMarquee = useCallback(() => {
    if (isMarqueeActive && marqueeStart && marqueeEnd) {
      const x1 = Math.min(marqueeStart.x, marqueeEnd.x);
      const y1 = Math.min(marqueeStart.y, marqueeEnd.y);
      const x2 = Math.max(marqueeStart.x, marqueeEnd.x);
      const y2 = Math.max(marqueeStart.y, marqueeEnd.y);

      if (Math.abs(x2 - x1) > 5 || Math.abs(y2 - y1) > 5) {
        const selectNodes = useCanvasStore.getState().selectNodes;
        const allNodes = useCanvasStore.getState().nodes;
        const ids = Object.values(allNodes)
          .filter((n) => {
            const nx1 = n.position.x;
            const ny1 = n.position.y;
            const nx2 = n.position.x + n.size.width;
            const ny2 = n.position.y + n.size.height;
            return nx1 < x2 && nx2 > x1 && ny1 < y2 && ny2 > y1;
          })
          .map((n) => n.id);

        if (ids.length > 0) {
          selectNodes(ids);
        }
      }
    }

    setIsMarqueeActive(false);
    setMarqueeStart(null);
    setMarqueeEnd(null);
  }, [isMarqueeActive, marqueeStart, marqueeEnd]);

  return {
    isMarqueeActive,
    marqueeStart,
    marqueeEnd,
    startMarquee,
    updateMarquee,
    finishMarquee,
  };
}
