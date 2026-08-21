import type { StateCreator } from 'zustand';
import type { CanvasStore } from './canvasStoreTypes';

type ViewportSlice = Pick<CanvasStore, 'viewport' | 'setViewport' | 'panBy' | 'zoomAtPoint'>;

type StoreSet = Parameters<StateCreator<CanvasStore>>[0];

export function createViewportSlice(set: StoreSet): ViewportSlice {
  return {
    viewport: { x: 0, y: 0, zoom: 1 },
    setViewport: (viewport) => set({ viewport }),
    panBy: (dx, dy) => set((state) => ({
      viewport: { ...state.viewport, x: state.viewport.x + dx, y: state.viewport.y + dy },
    })),
    zoomAtPoint: (factorOrDelta, screenPoint, rect, isFactor = false) => set((state) => {
      const oldZoom = state.viewport.zoom;
      let newZoom: number;

      if (isFactor) {
        newZoom = Math.min(5, Math.max(0.1, oldZoom * factorOrDelta));
      } else if (Math.abs(factorOrDelta) < 0.8) {
        newZoom = Math.min(5, Math.max(0.1, oldZoom * (1 + factorOrDelta)));
      } else {
        newZoom = Math.min(5, Math.max(0.1, oldZoom * factorOrDelta));
      }

      if (Math.abs(newZoom - oldZoom) < 0.00001) return state;

      const left = rect.left ?? 0;
      const top = rect.top ?? 0;
      const dx = screenPoint.x - left - rect.width / 2;
      const dy = screenPoint.y - top - rect.height / 2;
      const zoomDiff = (1 / newZoom) - (1 / oldZoom);

      return {
        viewport: {
          x: state.viewport.x + dx * zoomDiff,
          y: state.viewport.y + dy * zoomDiff,
          zoom: newZoom,
        },
      };
    }),
  };
}
