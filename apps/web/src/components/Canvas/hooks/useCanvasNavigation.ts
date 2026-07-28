import { useRef, useState, useCallback } from 'react';
import { Viewport } from '@canvio/core';
import { useCanvasStore } from '../../../store/canvasStore';

interface UseCanvasNavigationProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  viewport: Viewport;
}

export function useCanvasNavigation({ canvasRef, viewport }: UseCanvasNavigationProps) {
  const panBy = useCanvasStore((s) => s.panBy);
  const zoomAtPoint = useCanvasStore((s) => s.zoomAtPoint);

  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<{ x: number; y: number } | null>(null);

  const pinchStateRef = useRef<{ distance: number; midpoint: { x: number; y: number } } | null>(null);

  // Screen to world coordinate conversion
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (screenX - rect.width / 2) / viewport.zoom - viewport.x,
        y: (screenY - rect.height / 2) / viewport.zoom - viewport.y,
      };
    },
    [canvasRef, viewport]
  );

  // Wheel zoom & pan
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        let delta = e.deltaY;
        if (e.deltaMode === 1) delta *= 16;
        if (e.deltaMode === 2) delta *= 100;

        const clampedDelta = Math.max(-100, Math.min(100, delta));
        const factor = Math.pow(0.9975, clampedDelta);

        zoomAtPoint(
          factor,
          { x: e.clientX, y: e.clientY },
          { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          true
        );
      } else {
        panBy(-e.deltaX / viewport.zoom, -e.deltaY / viewport.zoom);
      }
    },
    [canvasRef, panBy, zoomAtPoint, viewport.zoom]
  );

  // Touch gestures (Pinch to zoom & two-finger pan)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsPanning(false);
      setLastMousePos(null);

      const a = e.touches[0];
      const b = e.touches[1];
      const distance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      const midpoint = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };

      pinchStateRef.current = { distance, midpoint };
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchStateRef.current) {
        e.preventDefault();
        const a = e.touches[0];
        const b = e.touches[1];
        const distance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        const midpoint = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
        const rect = canvasRef.current?.getBoundingClientRect();

        if (rect && pinchStateRef.current.distance > 0) {
          const factor = distance / pinchStateRef.current.distance;
          zoomAtPoint(
            factor,
            midpoint,
            { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
            true
          );

          const dx = (midpoint.x - pinchStateRef.current.midpoint.x) / viewport.zoom;
          const dy = (midpoint.y - pinchStateRef.current.midpoint.y) / viewport.zoom;
          panBy(dx, dy);
        }

        pinchStateRef.current = { distance, midpoint };
      }
    },
    [canvasRef, zoomAtPoint, panBy, viewport.zoom]
  );

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchStateRef.current = null;
    }
  }, []);

  return {
    screenToWorld,
    isPanning,
    setIsPanning,
    lastMousePos,
    setLastMousePos,
    pinchStateRef,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
