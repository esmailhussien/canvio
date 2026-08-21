import type { StateCreator } from 'zustand';
import type { CanvasStore } from './canvasStoreTypes';

type InteractionSlice = Pick<
  CanvasStore,
  | 'selectedNodeIds'
  | 'selectedRelationId'
  | 'selectNode'
  | 'selectNodes'
  | 'selectRelation'
  | 'clearSelection'
  | 'activeTool'
  | 'setActiveTool'
  | 'isAIAssistantOpen'
  | 'setAIAssistantOpen'
  | 'snapLines'
  | 'setSnapLines'
  | 'strokeColor'
  | 'strokeWidth'
  | 'setStrokeColor'
  | 'setStrokeWidth'
  | 'stickyColor'
  | 'setStickyColor'
  | 'relationSourceId'
  | 'relationSourcePort'
  | 'relationTargetId'
  | 'relationTargetPort'
  | 'setRelationSourceId'
  | 'setRelationSource'
  | 'setRelationTarget'
>;

type StoreSet = Parameters<StateCreator<CanvasStore>>[0];

export function createInteractionSlice(set: StoreSet, initialStrokeColor: string): InteractionSlice {
  return {
    // Selection
    selectedNodeIds: [],
    selectedRelationId: null,
    selectNode: (id, multi = false) => set((state) => ({
      selectedRelationId: null,
      selectedNodeIds: multi
        ? state.selectedNodeIds.includes(id)
          ? state.selectedNodeIds.filter((nodeId) => nodeId !== id)
          : [...state.selectedNodeIds, id]
        : [id],
    })),
    selectNodes: (ids) => set({ selectedNodeIds: ids, selectedRelationId: null }),
    selectRelation: (id) => set({ selectedRelationId: id, selectedNodeIds: [] }),
    clearSelection: () => set({ selectedNodeIds: [], selectedRelationId: null }),

    // Tool
    activeTool: 'select',
    setActiveTool: (tool) => set((state) => ({
      activeTool: tool,
      relationSourceId: tool === 'relation' ? state.relationSourceId : null,
      relationSourcePort: tool === 'relation' ? state.relationSourcePort : null,
      relationTargetId: tool === 'relation' ? state.relationTargetId : null,
      relationTargetPort: tool === 'relation' ? state.relationTargetPort : null,
    })),

    // AI Assistant Modal
    isAIAssistantOpen: false,
    setAIAssistantOpen: (open) => set({ isAIAssistantOpen: open }),

    // Smart Snapping Guides
    snapLines: null,
    setSnapLines: (snap) => set({ snapLines: snap }),

    // Drawing settings
    strokeColor: initialStrokeColor,
    strokeWidth: 3,
    setStrokeColor: (color) => set({ strokeColor: color }),
    setStrokeWidth: (width) => set({ strokeWidth: width }),

    // Sticky settings
    stickyColor: 'yellow',
    setStickyColor: (color) => set({ stickyColor: color }),

    // Relation creation helper
    relationSourceId: null,
    relationSourcePort: null,
    relationTargetId: null,
    relationTargetPort: null,
    setRelationSourceId: (id) => set({
      relationSourceId: id,
      relationSourcePort: null,
      relationTargetId: null,
      relationTargetPort: null,
    }),
    setRelationSource: (id, port = null) => set({
      relationSourceId: id,
      relationSourcePort: id ? port : null,
      relationTargetId: null,
      relationTargetPort: null,
    }),
    setRelationTarget: (id, port = null) => set({
      relationTargetId: id,
      relationTargetPort: id ? port : null,
    }),
  };
}
