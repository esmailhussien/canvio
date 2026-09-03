import { useRef, useState, useCallback, useEffect } from 'react';
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
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const setLastMousePos = useCallback((position: { x: number; y: number } | null) => {
    lastMousePosRef.current = position;
  }, []);

  const pinchStateRef = useRef<{ distance: number; midpoint: { x: number; y: number } } | null>(null);
  const pendingPanRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Screen to world coordinate conversion
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (screenX - rect.left - rect.width / 2) / viewport.zoom - viewport.x,
        y: (screenY - rect.top - rect.height / 2) / viewport.zoom - viewport.y,
      };
    },
    [canvasRef, viewport]
  );

  // Wheel zoom & pan with RAF batching for 60fps throughput
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
        // Accumulate pan deltas for 60fps RAF batching
        pendingPanRef.current.dx -= e.deltaX / viewport.zoom;
        pendingPanRef.current.dy -= e.deltaY / viewport.zoom;

        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            const { dx, dy } = pendingPanRef.current;
            if (dx !== 0 || dy !== 0) {
              pendingPanRef.current = { dx: 0, dy: 0 };
              panBy(dx, dy);
            }
          });
        }
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
    lastMousePosRef,
    setLastMousePos,
    pinchStateRef,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
