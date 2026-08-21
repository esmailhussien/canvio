import type { StateCreator } from 'zustand';
import type { CanvasStore, HistorySnapshot } from './canvasStoreTypes';

type HistoryCarrier = HistorySnapshot & {
  past: HistorySnapshot[];
  historyAdapter?: CanvasStore['historyAdapter'];
};

type HistorySlice = Pick<
  CanvasStore,
  | 'past'
  | 'future'
  | 'historyMode'
  | 'historyAdapter'
  | 'canUndo'
  | 'canRedo'
  | 'setCollaborationHistoryAdapter'
  | 'refreshHistoryAvailability'
  | 'undo'
  | 'redo'
  | 'snapshot'
>;

type StoreSet = Parameters<StateCreator<CanvasStore>>[0];
type StoreGet = Parameters<StateCreator<CanvasStore>>[1];

const MAX_HISTORY_ENTRIES = 40;
const LARGE_CANVAS_HISTORY_LIMIT = 24;
const HUGE_CANVAS_HISTORY_LIMIT = 12;

function estimateSnapshotWeight(snapshot: HistorySnapshot): number {
  const nodeCount = Object.keys(snapshot.nodes).length;
  const relationCount = Object.keys(snapshot.relations).length;
  const inkPointCount = snapshot.inkStrokes.reduce((total, stroke) => total + (stroke.points?.length ?? 0), 0);
  return nodeCount + relationCount * 0.5 + snapshot.inkStrokes.length * 2 + inkPointCount / 120;
}

function getHistoryLimit(snapshot?: HistorySnapshot): number {
  if (!snapshot) return MAX_HISTORY_ENTRIES;
  const weight = estimateSnapshotWeight(snapshot);
  if (weight >= 1200) return HUGE_CANVAS_HISTORY_LIMIT;
  if (weight >= 500) return LARGE_CANVAS_HISTORY_LIMIT;
  return MAX_HISTORY_ENTRIES;
}

function createHistorySnapshot(state: HistorySnapshot): HistorySnapshot {
  return {
    nodes: state.nodes,
    relations: state.relations,
    inkStrokes: state.inkStrokes,
  };
}

export function trimPastHistory(past: HistorySnapshot[], basis?: HistorySnapshot): HistorySnapshot[] {
  return past.slice(-getHistoryLimit(basis ?? past[past.length - 1]));
}

export function trimFutureHistory(future: HistorySnapshot[], basis?: HistorySnapshot): HistorySnapshot[] {
  return future.slice(0, getHistoryLimit(basis ?? future[0]));
}

function pushHistory(past: HistorySnapshot[], state: HistorySnapshot): HistorySnapshot[] {
  const snapshot = createHistorySnapshot(state);
  return trimPastHistory([...past, snapshot], snapshot);
}

export function recordUndoSnapshot(state: HistoryCarrier): {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;
} {
  if (state.historyAdapter) {
    return {
      past: state.past,
      future: [],
      canUndo: state.historyAdapter.canUndo(),
      canRedo: false,
    };
  }

  const past = pushHistory(state.past, state);
  return {
    past,
    future: [],
    canUndo: past.length > 0,
    canRedo: false,
  };
}

export function createHistorySlice(set: StoreSet, get: StoreGet): HistorySlice {
  return {
    past: [],
    future: [],
    historyMode: 'local',
    historyAdapter: null,
    canUndo: false,
    canRedo: false,
    setCollaborationHistoryAdapter: (historyAdapter) => set((state) => ({
      historyAdapter,
      historyMode: historyAdapter ? 'collaboration' : 'local',
      past: historyAdapter ? [] : state.past,
      future: historyAdapter ? [] : state.future,
      canUndo: historyAdapter ? historyAdapter.canUndo() : state.past.length > 0,
      canRedo: historyAdapter ? historyAdapter.canRedo() : state.future.length > 0,
    })),
    refreshHistoryAvailability: () => set((state) => ({
      canUndo: state.historyAdapter ? state.historyAdapter.canUndo() : state.past.length > 0,
      canRedo: state.historyAdapter ? state.historyAdapter.canRedo() : state.future.length > 0,
    })),
    undo: () => {
      const historyAdapter = get().historyAdapter;
      if (historyAdapter) {
        if (historyAdapter.canUndo()) historyAdapter.undo();
        get().refreshHistoryAvailability();
        return;
      }

      set((state) => {
        if (state.past.length === 0) return state;
        const previous = state.past[state.past.length - 1];
        const newPast = state.past.slice(0, state.past.length - 1);
        const current = { nodes: state.nodes, relations: state.relations, inkStrokes: state.inkStrokes };
        const future = trimFutureHistory([current, ...state.future], current);
        return {
          past: newPast,
          future,
          canUndo: newPast.length > 0,
          canRedo: future.length > 0,
          nodes: previous.nodes,
          relations: previous.relations,
          inkStrokes: previous.inkStrokes || [],
        };
      });
    },
    redo: () => {
      const historyAdapter = get().historyAdapter;
      if (historyAdapter) {
        if (historyAdapter.canRedo()) historyAdapter.redo();
        get().refreshHistoryAvailability();
        return;
      }

      set((state) => {
        if (state.future.length === 0) return state;
        const next = state.future[0];
        const newFuture = state.future.slice(1);
        const current = { nodes: state.nodes, relations: state.relations, inkStrokes: state.inkStrokes };
        const past = trimPastHistory([...state.past, current], current);
        return {
          past,
          future: newFuture,
          canUndo: past.length > 0,
          canRedo: newFuture.length > 0,
          nodes: next.nodes,
          relations: next.relations,
          inkStrokes: next.inkStrokes || [],
        };
      });
    },
    snapshot: () => set((state) => ({
      ...recordUndoSnapshot(state),
    })),
  };
}
