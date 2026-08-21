import type { StateCreator } from 'zustand';
import { getSystemTheme, persistCanvasBackground } from './appearanceSlice';
import { recordUndoSnapshot } from './historySlice';
import type { CanvasStore } from './canvasStoreTypes';

type WorldSlice = Pick<CanvasStore, 'replaceWorld'>;

type StoreSet = Parameters<StateCreator<CanvasStore>>[0];

const applyDocumentTheme = (theme: 'dark' | 'light'): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
};

export function createWorldSlice(set: StoreSet): WorldSlice {
  return {
    replaceWorld: ({ nodes, relations, inkStrokes, viewport, appearance }) => set((state) => {
      const theme = state.themePreference === 'system' ? getSystemTheme() : state.themePreference;
      const canvasBackground = appearance?.canvasBackground === undefined
        ? state.canvasBackground
        : appearance.canvasBackground;

      applyDocumentTheme(theme);
      persistCanvasBackground(canvasBackground);

      return {
        ...recordUndoSnapshot(state),
        nodes,
        relations,
        inkStrokes: inkStrokes || [],
        viewport: viewport || state.viewport,
        theme,
        canvasBackground,
        selectedNodeIds: [],
        selectedRelationId: null,
        relationSourceId: null,
        relationSourcePort: null,
        relationTargetId: null,
        relationTargetPort: null,
        activeTool: 'select',
      };
    }),
  };
}
