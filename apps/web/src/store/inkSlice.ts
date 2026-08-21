import type { StateCreator } from 'zustand';
import { nanoid } from 'nanoid';
import { recordUndoSnapshot } from './historySlice';
import type { CanvasStore, LivingNode } from './canvasStoreTypes';

type InkSlice = Pick<
  CanvasStore,
  | 'inkStrokes'
  | 'addInkStroke'
  | 'removeInkStroke'
  | 'eraseInkAt'
  | 'clearAllInk'
  | 'replaceInkStrokes'
  | 'convertInkToNode'
>;

type StoreSet = Parameters<StateCreator<CanvasStore>>[0];
type StoreGet = Parameters<StateCreator<CanvasStore>>[1];

function pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

export function createInkSlice(set: StoreSet, get: StoreGet): InkSlice {
  return {
    inkStrokes: [],
    addInkStroke: (stroke) => set((state) => ({
      ...recordUndoSnapshot(state),
      inkStrokes: [...state.inkStrokes, stroke],
    })),
    removeInkStroke: (id) => set((state) => ({
      ...recordUndoSnapshot(state),
      inkStrokes: state.inkStrokes.filter((stroke) => stroke.id !== id),
    })),
    eraseInkAt: (point, radius = 18) => {
      const state = get();
      if (state.inkStrokes.length === 0) return false;

      let hit = false;
      const remainingStrokes = state.inkStrokes.filter((stroke) => {
        const points = stroke.points;
        if (!points || points.length === 0) return true;

        const strokeRadius = Math.max(radius, (stroke.width || 3) / 2 + 8);
        for (let index = 0; index < points.length; index += 1) {
          const pointA = points[index];
          if (Math.hypot(pointA[0] - point.x, pointA[1] - point.y) <= strokeRadius) {
            hit = true;
            return false;
          }

          if (index < points.length - 1) {
            const pointB = points[index + 1];
            const distance = pointToSegmentDistance(point.x, point.y, pointA[0], pointA[1], pointB[0], pointB[1]);
            if (distance <= strokeRadius) {
              hit = true;
              return false;
            }
          }
        }
        return true;
      });

      if (!hit) return false;

      set({
        ...recordUndoSnapshot(state),
        inkStrokes: remainingStrokes,
      });
      return true;
    },
    clearAllInk: () => set((state) => ({
      ...recordUndoSnapshot(state),
      inkStrokes: [],
    })),
    replaceInkStrokes: (inkStrokes) => set({ inkStrokes }),
    convertInkToNode: (strokeIds, targetType = 'sticky') => {
      const state = get();
      const targetStrokes = strokeIds && strokeIds.length > 0
        ? state.inkStrokes.filter((stroke) => strokeIds.includes(stroke.id))
        : state.inkStrokes;

      if (targetStrokes.length === 0) return null;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      targetStrokes.forEach((stroke) => {
        stroke.points.forEach(([x, y]) => {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        });
      });

      if (!Number.isFinite(minX)) return null;

      const width = Math.max(220, maxX - minX + 50);
      const height = Math.max(160, maxY - minY + 50);
      const id = nanoid(10);
      const zIndex = state.nextZIndex();

      const newNode: LivingNode = {
        id,
        type: targetType,
        position: { x: minX - 25, y: minY - 25 },
        size: { width, height },
        rotation: 0,
        zIndex,
        locked: false,
        data: targetType === 'sticky' ? { text: '', color: state.stickyColor || 'yellow' } : { text: '' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetStrokeIdSet = new Set(targetStrokes.map((stroke) => stroke.id));
      const remainingStrokes = state.inkStrokes.filter((stroke) => !targetStrokeIdSet.has(stroke.id));

      set({
        ...recordUndoSnapshot(state),
        nodes: { ...state.nodes, [id]: newNode },
        inkStrokes: remainingStrokes,
        selectedNodeIds: [id],
        selectedRelationId: null,
      });

      return newNode;
    },
  };
}
