import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createAppearanceSlice, getInitialStrokeColor } from './appearanceSlice';
import { createHistorySlice } from './historySlice';
import { createInkSlice } from './inkSlice';
import { createInteractionSlice } from './interactionSlice';
import { createLayoutSlice } from './layoutSlice';
import { createNodeRelationSlice } from './nodeRelationSlice';
import { createViewportSlice } from './viewportSlice';
import { createWorldSlice } from './worldSlice';
import type { CanvasStore } from './canvasStoreTypes';

// Re-export types for backward compatibility — other files import types from here
export type {
  CanvasStore,
  Point,
  Size,
  Viewport,
  LivingNode,
  Relation,
  RelationStyle,
  RelationshipType,
  ToolMode,
  FreeInkStroke,
  ThemePreference,
  HistorySnapshot,
  HistoryMode,
  HistoryAdapter,
} from './canvasStoreTypes';

export const useCanvasStore = create(
  subscribeWithSelector<CanvasStore>((set, get) => ({
    ...createViewportSlice(set),
    ...createNodeRelationSlice(set, get),
    ...createInkSlice(set, get),
    ...createInteractionSlice(set, getInitialStrokeColor()),
    ...createLayoutSlice(set),
    ...createAppearanceSlice(set, get),
    ...createHistorySlice(set, get),
    ...createWorldSlice(set),
  }))
);
