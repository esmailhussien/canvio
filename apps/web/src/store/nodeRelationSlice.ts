import type { StateCreator } from 'zustand';
import { nanoid } from 'nanoid';
import { recordUndoSnapshot } from './historySlice';
import type { CanvasStore, LivingNode, Relation } from './canvasStoreTypes';

type NodeRelationSlice = Pick<
  CanvasStore,
  | 'nodes'
  | 'addNode'
  | 'upsertNodeRemote'
  | 'updateNode'
  | 'updateNodePositions'
  | 'updateNodeData'
  | 'removeNode'
  | 'removeNodes'
  | 'removeNodeRemote'
  | 'duplicateNode'
  | 'branchSelectionAsExperiment'
  | 'bringToFront'
  | 'sendToBack'
  | 'toggleLockNode'
  | 'relations'
  | 'addRelation'
  | 'upsertRelationRemote'
  | 'updateRelation'
  | 'removeRelation'
  | 'removeRelationRemote'
  | 'nextZIndex'
>;

type StoreSet = Parameters<StateCreator<CanvasStore>>[0];
type StoreGet = Parameters<StateCreator<CanvasStore>>[1];

function withoutRelationsForNodes(relations: Record<string, Relation>, nodeIds: string[]): Record<string, Relation> {
  const nodeIdSet = new Set(nodeIds);
  const cleanRelations = { ...relations };
  Object.keys(cleanRelations).forEach((relId) => {
    const relation = cleanRelations[relId];
    if (nodeIdSet.has(relation.sourceId) || nodeIdSet.has(relation.targetId)) {
      delete cleanRelations[relId];
    }
  });
  return cleanRelations;
}

function cloneNodeData(data: LivingNode['data']): LivingNode['data'] {
  return typeof structuredClone === 'function'
    ? structuredClone(data)
    : JSON.parse(JSON.stringify(data ?? {}));
}

export function createNodeRelationSlice(set: StoreSet, get: StoreGet): NodeRelationSlice {
  return {
    // Nodes
    nodes: {},
    addNode: (node) => set((state) => ({
      ...recordUndoSnapshot(state),
      nodes: { ...state.nodes, [node.id]: node },
    })),
    upsertNodeRemote: (node) => set((state) => ({
      nodes: { ...state.nodes, [node.id]: node },
    })),
    updateNode: (id, updates) => set((state) => {
      const existing = state.nodes[id];
      if (!existing) return state;
      return {
        nodes: {
          ...state.nodes,
          [id]: {
            ...existing,
            ...updates,
            data: updates.data
              ? { ...existing.data, ...updates.data }
              : existing.data,
            updatedAt: Date.now(),
          },
        },
      };
    }),
    updateNodeData: (id, data) => set((state) => {
      const existing = state.nodes[id];
      if (!existing) return state;
      return {
        nodes: {
          ...state.nodes,
          [id]: {
            ...existing,
            data: { ...existing.data, ...data },
            updatedAt: Date.now(),
          },
        },
      };
    }),
    // Applies many position updates in ONE store transaction. Dragging a
    // populated frame used to dispatch one update per child per frame —
    // N store notifications, N collaboration diffs, N subscriber cascades.
    updateNodePositions: (updates) => set((state) => {
      let nextNodes = state.nodes;
      let changed = false;
      for (const { id, position } of updates) {
        const existing = nextNodes[id];
        if (!existing) continue;
        if (existing.position.x === position.x && existing.position.y === position.y) continue;
        if (!changed) {
          nextNodes = { ...nextNodes };
          changed = true;
        }
        nextNodes[id] = {
          ...existing,
          position,
          updatedAt: Date.now(),
        };
      }
      return changed ? { nodes: nextNodes } : state;
    }),
    removeNode: (id) => set((state) => {
      const { [id]: _, ...rest } = state.nodes;
      return {
        ...recordUndoSnapshot(state),
        nodes: rest,
        relations: withoutRelationsForNodes(state.relations, [id]),
        selectedNodeIds: state.selectedNodeIds.filter((nodeId) => nodeId !== id),
      };
    }),
    removeNodes: (ids) => set((state) => {
      const nodeIdSet = new Set(ids);
      const newNodes = { ...state.nodes };
      ids.forEach((id) => delete newNodes[id]);
      return {
        ...recordUndoSnapshot(state),
        nodes: newNodes,
        relations: withoutRelationsForNodes(state.relations, ids),
        selectedNodeIds: state.selectedNodeIds.filter((nodeId) => !nodeIdSet.has(nodeId)),
      };
    }),
    removeNodeRemote: (id) => set((state) => {
      const { [id]: _, ...rest } = state.nodes;
      return {
        nodes: rest,
        relations: withoutRelationsForNodes(state.relations, [id]),
        selectedNodeIds: state.selectedNodeIds.filter((nodeId) => nodeId !== id),
      };
    }),
    duplicateNode: (id) => set((state) => {
      const existing = state.nodes[id];
      if (!existing) return state;
      const newId = nanoid(10);
      const maxZ = Object.values(state.nodes).reduce((max, node) => Math.max(max, node.zIndex), 0);
      const duplicated: LivingNode = {
        ...existing,
        id: newId,
        position: { x: existing.position.x + 30, y: existing.position.y + 30 },
        zIndex: maxZ + 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return {
        ...recordUndoSnapshot(state),
        nodes: { ...state.nodes, [newId]: duplicated },
        selectedNodeIds: [newId],
      };
    }),
    branchSelectionAsExperiment: () => set((state) => {
      const selectedNodes = state.selectedNodeIds.map((id) => state.nodes[id]).filter(Boolean);
      if (selectedNodes.length === 0) return state;

      const minX = Math.min(...selectedNodes.map((node) => node.position.x));
      const maxX = Math.max(...selectedNodes.map((node) => node.position.x + node.size.width));
      const offset = { x: Math.max(320, maxX - minX + 140), y: 36 };
      const maxZ = Object.values(state.nodes).reduce((max, node) => Math.max(max, node.zIndex), 0);
      const idMap = new Map<string, string>();
      const newNodes: Record<string, LivingNode> = {};

      selectedNodes.forEach((node, index) => {
        const newId = nanoid(10);
        idMap.set(node.id, newId);
        newNodes[newId] = {
          ...node,
          id: newId,
          position: {
            x: node.position.x + offset.x,
            y: node.position.y + offset.y,
          },
          zIndex: maxZ + index + 1,
          data: cloneNodeData(node.data),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      });

      const newRelations: Record<string, Relation> = {};
      Object.values(state.relations).forEach((relation) => {
        const sourceId = idMap.get(relation.sourceId);
        const targetId = idMap.get(relation.targetId);
        if (!sourceId || !targetId) return;
        const newId = nanoid(10);
        newRelations[newId] = {
          ...relation,
          id: newId,
          sourceId,
          targetId,
        };
      });

      return {
        ...recordUndoSnapshot(state),
        nodes: { ...state.nodes, ...newNodes },
        relations: { ...state.relations, ...newRelations },
        selectedNodeIds: Object.keys(newNodes),
        selectedRelationId: null,
        activeTool: 'select',
      };
    }),
    bringToFront: (id) => set((state) => {
      const existing = state.nodes[id];
      if (!existing) return state;
      const maxZ = Object.values(state.nodes).reduce((max, node) => Math.max(max, node.zIndex), 0);
      return {
        nodes: {
          ...state.nodes,
          [id]: { ...existing, zIndex: maxZ + 1, updatedAt: Date.now() },
        },
      };
    }),
    sendToBack: (id) => set((state) => {
      const existing = state.nodes[id];
      if (!existing) return state;
      const minZ = Object.values(state.nodes).reduce((min, node) => Math.min(min, node.zIndex), 0);
      return {
        nodes: {
          ...state.nodes,
          [id]: { ...existing, zIndex: minZ - 1, updatedAt: Date.now() },
        },
      };
    }),
    toggleLockNode: (id) => set((state) => {
      const existing = state.nodes[id];
      if (!existing) return state;
      return {
        nodes: {
          ...state.nodes,
          [id]: { ...existing, locked: !existing.locked, updatedAt: Date.now() },
        },
      };
    }),

    // Relations
    relations: {},
    addRelation: (relation) => set((state) => ({
      ...recordUndoSnapshot(state),
      relations: { ...state.relations, [relation.id]: relation },
    })),
    upsertRelationRemote: (relation) => set((state) => ({
      relations: { ...state.relations, [relation.id]: relation },
    })),
    updateRelation: (id, updates) => set((state) => ({
      relations: { ...state.relations, [id]: { ...state.relations[id], ...updates } },
    })),
    removeRelation: (id) => set((state) => {
      const { [id]: _, ...rest } = state.relations;
      return {
        ...recordUndoSnapshot(state),
        relations: rest,
      };
    }),
    removeRelationRemote: (id) => set((state) => {
      const { [id]: _, ...rest } = state.relations;
      return { relations: rest };
    }),
    nextZIndex: () => {
      const nodes = get().nodes;
      const maxZ = Object.values(nodes).reduce((max, node) => Math.max(max, node.zIndex), 0);
      return maxZ + 1;
    },
  };
}
