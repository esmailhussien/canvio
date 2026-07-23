import { Point, Viewport, Bounds, Size } from '../types';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5.0;

/**
 * Clamps the zoom level between the minimum and maximum allowed values.
 * @param zoom The zoom level to clamp.
 * @returns The clamped zoom level.
 */
export function clampZoom(zoom: number): number {
  return Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
}

/**
 * Converts screen coordinates to world coordinates.
 * @param screenPoint The point in screen coordinates.
 * @param viewport The current viewport state.
 * @returns The point in world coordinates.
 */
export function screenToWorld(screenPoint: Point, viewport: Viewport): Point {
  return {
    x: (screenPoint.x - viewport.x) / viewport.zoom,
    y: (screenPoint.y - viewport.y) / viewport.zoom,
  };
}

/**
 * Converts world coordinates to screen coordinates.
 * @param worldPoint The point in world coordinates.
 * @param viewport The current viewport state.
 * @returns The point in screen coordinates.
 */
export function worldToScreen(worldPoint: Point, viewport: Viewport): Point {
  return {
    x: worldPoint.x * viewport.zoom + viewport.x,
    y: worldPoint.y * viewport.zoom + viewport.y,
  };
}

/**
 * Gets the visible bounds of the world based on the current viewport and screen size.
 * @param viewport The current viewport state.
 * @param screenSize The size of the screen or canvas element.
 * @returns The bounds of the visible area in world coordinates.
 */
export function getVisibleBounds(viewport: Viewport, screenSize: Size): Bounds {
  const topLeft = screenToWorld({ x: 0, y: 0 }, viewport);
  const bottomRight = screenToWorld({ x: screenSize.width, y: screenSize.height }, viewport);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
}

/**
 * Calculates a new viewport when zooming centered on a specific screen point.
 * @param viewport The current viewport state.
 * @param point The screen point to zoom around.
 * @param delta The zoom multiplier (e.g., 1.1 for zoom in, 0.9 for zoom out).
 * @returns The new viewport state.
 */
export function zoomAtPoint(viewport: Viewport, point: Point, delta: number): Viewport {
  const newZoom = clampZoom(viewport.zoom * delta);
  // Re-calculate the position to keep the zoom centered on the point
  const zoomRatio = newZoom / viewport.zoom;
  
  return {
    x: point.x - (point.x - viewport.x) * zoomRatio,
    y: point.y - (point.y - viewport.y) * zoomRatio,
    zoom: newZoom,
  };
}
