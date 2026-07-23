import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type {
  Point, Size, Viewport, LivingNode, Relation, RelationStyle,
  RelationshipType, ToolMode
} from '@canvio/core';

// Re-export types for backward compatibility — other files import types from here
export type { Point, Size, Viewport, LivingNode, Relation, RelationStyle, RelationshipType, ToolMode };

interface CanvasStore {
  // Viewport
  viewport: Viewport;
  setViewport: (v: Viewport) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAtPoint: (delta: number, screenPoint: Point, screenSize: Size) => void;

  // Nodes
  nodes: Record<string, LivingNode>;
  addNode: (node: LivingNode) => void;
  upsertNodeRemote: (node: LivingNode) => void;
  updateNode: (id: string, updates: Partial<LivingNode>) => void;
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
  removeNode: (id: string) => void;
  removeNodeRemote: (id: string) => void;
  duplicateNode: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  toggleLockNode: (id: string) => void;

  // Relations
  relations: Record<string, Relation>;
  addRelation: (relation: Relation) => void;
  upsertRelationRemote: (relation: Relation) => void;
  updateRelation: (id: string, updates: Partial<Relation>) => void;
  removeRelation: (id: string) => void;
  removeRelationRemote: (id: string) => void;

  // Selection
  selectedNodeIds: string[];
  selectedRelationId: string | null;
  selectNode: (id: string, multi?: boolean) => void;
  selectNodes: (ids: string[]) => void;
  selectRelation: (id: string | null) => void;
  clearSelection: () => void;

  // Tool
  activeTool: ToolMode;
  setActiveTool: (tool: ToolMode) => void;

  // Drawing settings
  strokeColor: string;
  strokeWidth: number;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;

  // Sticky settings
  stickyColor: string;
  setStickyColor: (color: string) => void;

  // Theme
  theme: 'dark' | 'light';
  canvasBackground: string | null;
  toggleTheme: () => void;
  setCanvasBackground: (color: string | null) => void;
  setAppearance: (appearance: { theme?: 'dark' | 'light'; canvasBackground?: string | null }) => void;

  // Undo / Redo
  past: Array<{ nodes: Record<string, LivingNode>; relations: Record<string, Relation> }>;
  future: Array<{ nodes: Record<string, LivingNode>; relations: Record<string, Relation> }>;
  undo: () => void;
  redo: () => void;

  // Relation creation helper
  relationSourceId: string | null;
  relationSourcePort: string | null;
  relationTargetId: string | null;
  relationTargetPort: string | null;
  setRelationSourceId: (id: string | null) => void;
  setRelationSource: (id: string | null, port?: string | null) => void;
  setRelationTarget: (id: string | null, port?: string | null) => void;

  // Max zIndex tracker
  nextZIndex: () => number;

  // Whole-world restore
  replaceWorld: (world: {
    nodes: Record<string, LivingNode>;
    relations: Record<string, Relation>;
    viewport?: Viewport;
    appearance?: { theme?: 'dark' | 'light'; canvasBackground?: string | null };
  }) => void;
}

const getInitialTheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem('canvio-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
};

const getInitialCanvasBackground = (): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('canvio-canvas-background');
};

export const useCanvasStore = create(
  subscribeWithSelector<CanvasStore>((set, get) => ({
  // Viewport
  viewport: { x: 0, y: 0, zoom: 1 },
  setViewport: (viewport) => set({ viewport }),
  panBy: (dx, dy) => set((s) => ({
    viewport: { ...s.viewport, x: s.viewport.x + dx, y: s.viewport.y + dy }
  })),
  zoomAtPoint: (delta, screenPoint, screenSize) => set((s) => {
    const oldZoom = s.viewport.zoom;
    const newZoom = Math.min(5, Math.max(0.1, oldZoom * (1 + delta)));
    const ratio = newZoom / oldZoom;
    // Zoom centered on the mouse position
    const worldX = (screenPoint.x - screenSize.width / 2) / oldZoom - s.viewport.x;
    const worldY = (screenPoint.y - screenSize.height / 2) / oldZoom - s.viewport.y;
    return {
      viewport: {
        x: s.viewport.x - worldX * (ratio - 1),
        y: s.viewport.y - worldY * (ratio - 1),
        zoom: newZoom,
      }
    };
  }),

  // Nodes
  nodes: {},
  addNode: (node) => set((s) => ({
    past: [...s.past.slice(-39), { nodes: s.nodes, relations: s.relations }],
    future: [],
    nodes: { ...s.nodes, [node.id]: node }
  })),
  upsertNodeRemote: (node) => set((s) => ({
    nodes: { ...s.nodes, [node.id]: node }
  })),
  updateNode: (id, updates) => set((s) => {
    const existing = s.nodes[id];
    if (!existing) return s;
    return {
      nodes: {
        ...s.nodes,
        [id]: {
          ...existing,
          ...updates,
          data: updates.data
            ? { ...existing.data, ...updates.data }
            : existing.data,
          updatedAt: Date.now(),
        }
      }
    };
  }),
  updateNodeData: (id, data) => set((s) => {
    const existing = s.nodes[id];
    if (!existing) return s;
    return {
      nodes: {
        ...s.nodes,
        [id]: {
          ...existing,
          data: { ...existing.data, ...data },
          updatedAt: Date.now(),
        }
      }
    };
  }),
  removeNode: (id) => set((s) => {
    const { [id]: _, ...rest } = s.nodes;
    const cleanRelations = { ...s.relations };
    Object.keys(cleanRelations).forEach((relId) => {
      if (cleanRelations[relId].sourceId === id || cleanRelations[relId].targetId === id) {
        delete cleanRelations[relId];
      }
    });
    return {
      past: [...s.past.slice(-39), { nodes: s.nodes, relations: s.relations }],
      future: [],
      nodes: rest,
      relations: cleanRelations,
      selectedNodeIds: s.selectedNodeIds.filter(nid => nid !== id)
    };
  }),
  removeNodeRemote: (id) => set((s) => {
    const { [id]: _, ...rest } = s.nodes;
    const cleanRelations = { ...s.relations };
    Object.keys(cleanRelations).forEach((relId) => {
      if (cleanRelations[relId].sourceId === id || cleanRelations[relId].targetId === id) {
        delete cleanRelations[relId];
      }
    });
    return {
      nodes: rest,
      relations: cleanRelations,
      selectedNodeIds: s.selectedNodeIds.filter(nid => nid !== id)
    };
  }),
  duplicateNode: (id) => set((s) => {
    const existing = s.nodes[id];
    if (!existing) return s;
    const newId = nanoid(10);
    const maxZ = Object.values(s.nodes).reduce((max, n) => Math.max(max, n.zIndex), 0);
    const duplicated: LivingNode = {
      ...existing,
      id: newId,
      position: { x: existing.position.x + 30, y: existing.position.y + 30 },
      zIndex: maxZ + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return {
      past: [...s.past.slice(-39), { nodes: s.nodes, relations: s.relations }],
      future: [],
      nodes: { ...s.nodes, [newId]: duplicated },
      selectedNodeIds: [newId]
    };
  }),
  bringToFront: (id) => set((s) => {
    const existing = s.nodes[id];
    if (!existing) return s;
    const maxZ = Object.values(s.nodes).reduce((max, n) => Math.max(max, n.zIndex), 0);
    return {
      nodes: {
        ...s.nodes,
        [id]: { ...existing, zIndex: maxZ + 1, updatedAt: Date.now() }
      }
    };
  }),
  sendToBack: (id) => set((s) => {
    const existing = s.nodes[id];
    if (!existing) return s;
    const minZ = Object.values(s.nodes).reduce((min, n) => Math.min(min, n.zIndex), 1);
    return {
      nodes: {
        ...s.nodes,
        [id]: { ...existing, zIndex: Math.max(1, minZ - 1), updatedAt: Date.now() }
      }
    };
  }),
  toggleLockNode: (id) => set((s) => {
    const existing = s.nodes[id];
    if (!existing) return s;
    return {
      nodes: {
        ...s.nodes,
        [id]: { ...existing, locked: !existing.locked, updatedAt: Date.now() }
      }
    };
  }),

  // Relations
  relations: {},
  addRelation: (relation) => set((s) => ({
    past: [...s.past.slice(-39), { nodes: s.nodes, relations: s.relations }],
    future: [],
    relations: { ...s.relations, [relation.id]: relation }
  })),
  upsertRelationRemote: (relation) => set((s) => ({
    relations: { ...s.relations, [relation.id]: relation }
  })),
  updateRelation: (id, updates) => set((s) => ({
    relations: { ...s.relations, [id]: { ...s.relations[id], ...updates } }
  })),
  removeRelation: (id) => set((s) => {
    const { [id]: _, ...rest } = s.relations;
    return {
      past: [...s.past.slice(-39), { nodes: s.nodes, relations: s.relations }],
      future: [],
      relations: rest
    };
  }),
  removeRelationRemote: (id) => set((s) => {
    const { [id]: _, ...rest } = s.relations;
    return { relations: rest };
  }),

  // Selection
  selectedNodeIds: [],
  selectedRelationId: null,
  selectNode: (id, multi = false) => set((s) => ({
    selectedRelationId: null,
    selectedNodeIds: multi
      ? s.selectedNodeIds.includes(id)
        ? s.selectedNodeIds.filter(nid => nid !== id)
        : [...s.selectedNodeIds, id]
      : [id]
  })),
  selectNodes: (ids) => set({ selectedNodeIds: ids, selectedRelationId: null }),
  selectRelation: (id) => set({ selectedRelationId: id, selectedNodeIds: [] }),
  clearSelection: () => set({ selectedNodeIds: [], selectedRelationId: null }),

  // Tool
  activeTool: 'select',
  setActiveTool: (tool) => set((s) => ({
    activeTool: tool,
    relationSourceId: tool === 'relation' ? s.relationSourceId : null,
    relationSourcePort: tool === 'relation' ? s.relationSourcePort : null,
    relationTargetId: tool === 'relation' ? s.relationTargetId : null,
    relationTargetPort: tool === 'relation' ? s.relationTargetPort : null,
  })),

  // Drawing settings
  strokeColor: '#f0f0f5',
  strokeWidth: 3,
  setStrokeColor: (color) => set({ strokeColor: color }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),

  // Sticky
  stickyColor: 'yellow',
  setStickyColor: (color) => set({ stickyColor: color }),

  // Theme
  theme: getInitialTheme(),
  canvasBackground: getInitialCanvasBackground(),
  toggleTheme: () => set((s) => {
    const newTheme = s.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    window.localStorage.setItem('canvio-theme', newTheme);
    return { theme: newTheme };
  }),
  setCanvasBackground: (canvasBackground) => {
    if (canvasBackground) {
      window.localStorage.setItem('canvio-canvas-background', canvasBackground);
    } else {
      window.localStorage.removeItem('canvio-canvas-background');
    }
    set({ canvasBackground });
  },
  setAppearance: (appearance) => set((s) => {
    const theme = appearance.theme || s.theme;
    const canvasBackground = appearance.canvasBackground === undefined ? s.canvasBackground : appearance.canvasBackground;
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('canvio-theme', theme);
    if (canvasBackground) {
      window.localStorage.setItem('canvio-canvas-background', canvasBackground);
    } else {
      window.localStorage.removeItem('canvio-canvas-background');
    }
    return { theme, canvasBackground };
  }),

  // Undo / Redo
  past: [],
  future: [],
  undo: () => set((s) => {
    if (s.past.length === 0) return s;
    const previous = s.past[s.past.length - 1];
    const newPast = s.past.slice(0, s.past.length - 1);
    const current = { nodes: s.nodes, relations: s.relations };
    return {
      past: newPast,
      future: [current, ...s.future],
      nodes: previous.nodes,
      relations: previous.relations,
    };
  }),
  redo: () => set((s) => {
    if (s.future.length === 0) return s;
    const next = s.future[0];
    const newFuture = s.future.slice(1);
    const current = { nodes: s.nodes, relations: s.relations };
    return {
      past: [...s.past, current],
      future: newFuture,
      nodes: next.nodes,
      relations: next.relations,
    };
  }),

  // Relation creation helper
  relationSourceId: null,
  relationSourcePort: null,
  relationTargetId: null,
  relationTargetPort: null,
  setRelationSourceId: (id) => set({ relationSourceId: id, relationSourcePort: null, relationTargetId: null, relationTargetPort: null }),
  setRelationSource: (id, port = null) => set({ relationSourceId: id, relationSourcePort: id ? port : null, relationTargetId: null, relationTargetPort: null }),
  setRelationTarget: (id, port = null) => set({ relationTargetId: id, relationTargetPort: id ? port : null }),

  // Z-index
  nextZIndex: () => {
    const nodes = get().nodes;
    const maxZ = Object.values(nodes).reduce((max, n) => Math.max(max, n.zIndex), 0);
    return maxZ + 1;
  },

  replaceWorld: ({ nodes, relations, viewport, appearance }) => set((s) => {
    const theme = appearance?.theme || s.theme;
    const canvasBackground = appearance?.canvasBackground === undefined ? s.canvasBackground : appearance.canvasBackground;
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('canvio-theme', theme);
    if (canvasBackground) {
      window.localStorage.setItem('canvio-canvas-background', canvasBackground);
    } else {
      window.localStorage.removeItem('canvio-canvas-background');
    }

    return {
      past: [...s.past.slice(-39), { nodes: s.nodes, relations: s.relations }],
      future: [],
      nodes,
      relations,
      viewport: viewport || s.viewport,
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
})));
