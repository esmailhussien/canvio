import type { StateCreator } from 'zustand';
import { getSystemTheme, persistCanvasBackground } from './appearanceSlice';
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

      // A world replacement is a board switch, not an editable step: carrying
      // the previous board's content into this board's undo stack would let
      // Ctrl+Z resurrect foreign nodes here (offline mode never attaches a
      // collaboration adapter to wipe history).
      const historyReset = state.historyAdapter
        ? { past: state.past, future: [] as typeof state.future, canUndo: state.historyAdapter.canUndo(), canRedo: false }
        : { past: [] as typeof state.past, future: [] as typeof state.future, canUndo: false, canRedo: false };

      return {
        ...historyReset,
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
