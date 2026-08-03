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
  zoomAtPoint: (
    factorOrDelta: number,
    screenPoint: Point,
    rect: { left?: number; top?: number; width: number; height: number },
    isFactor?: boolean
  ) => void;

  // Nodes
  nodes: Record<string, LivingNode>;
  addNode: (node: LivingNode) => void;
  upsertNodeRemote: (node: LivingNode) => void;
  updateNode: (id: string, updates: Partial<LivingNode>) => void;
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
  removeNode: (id: string) => void;
  removeNodes: (ids: string[]) => void;
  removeNodeRemote: (id: string) => void;
  duplicateNode: (id: string) => void;
  branchSelectionAsExperiment: () => void;
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
  
  // Auto-layout & Alignment
  alignNodes: (alignment: 'top' | 'center' | 'bottom' | 'left' | 'middle' | 'right') => void;
  tidyUpNodes: () => void;

  // Tool
  activeTool: ToolMode;
  setActiveTool: (tool: ToolMode) => void;

  // AI Assistant Modal
  isAIAssistantOpen: boolean;
  setAIAssistantOpen: (open: boolean) => void;

  // Smart Snapping Guides
  snapLines: { x?: number; y?: number } | null;
  setSnapLines: (snap: { x?: number; y?: number } | null) => void;

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
  snapshot: () => void;

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
  zoomAtPoint: (factorOrDelta, screenPoint, rect, isFactor = false) => set((s) => {
    const oldZoom = s.viewport.zoom;
    let newZoom: number;

    if (isFactor) {
      newZoom = Math.min(5, Math.max(0.1, oldZoom * factorOrDelta));
    } else {
      if (Math.abs(factorOrDelta) < 0.8) {
        newZoom = Math.min(5, Math.max(0.1, oldZoom * (1 + factorOrDelta)));
      } else {
        newZoom = Math.min(5, Math.max(0.1, oldZoom * factorOrDelta));
      }
    }

    if (Math.abs(newZoom - oldZoom) < 0.00001) return s;

    const left = rect.left ?? 0;
    const top = rect.top ?? 0;
    const dx = screenPoint.x - left - rect.width / 2;
    const dy = screenPoint.y - top - rect.height / 2;

    const zoomDiff = (1 / newZoom) - (1 / oldZoom);

    return {
      viewport: {
        x: s.viewport.x + dx * zoomDiff,
        y: s.viewport.y + dy * zoomDiff,
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
  removeNodes: (ids) => set((s) => {
    const newNodes = { ...s.nodes };
    ids.forEach(id => delete newNodes[id]);
    const cleanRelations = { ...s.relations };
    Object.keys(cleanRelations).forEach((relId) => {
      if (ids.includes(cleanRelations[relId].sourceId) || ids.includes(cleanRelations[relId].targetId)) {
        delete cleanRelations[relId];
      }
    });
    return {
      past: [...s.past.slice(-39), { nodes: s.nodes, relations: s.relations }],
      future: [],
      nodes: newNodes,
      relations: cleanRelations,
      selectedNodeIds: s.selectedNodeIds.filter(nid => !ids.includes(nid))
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
  branchSelectionAsExperiment: () => set((s) => {
    const selectedNodes = s.selectedNodeIds.map((id) => s.nodes[id]).filter(Boolean);
    if (selectedNodes.length === 0) return s;

    const minX = Math.min(...selectedNodes.map((n) => n.position.x));
    const maxX = Math.max(...selectedNodes.map((n) => n.position.x + n.size.width));
    const offset = { x: Math.max(320, maxX - minX + 140), y: 36 };
    const maxZ = Object.values(s.nodes).reduce((max, n) => Math.max(max, n.zIndex), 0);
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
        data: typeof structuredClone === 'function'
          ? structuredClone(node.data)
          : JSON.parse(JSON.stringify(node.data ?? {})),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    });

    const newRelations: Record<string, Relation> = {};
    Object.values(s.relations).forEach((relation) => {
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
      past: [...s.past.slice(-39), { nodes: s.nodes, relations: s.relations }],
      future: [],
      nodes: { ...s.nodes, ...newNodes },
      relations: { ...s.relations, ...newRelations },
      selectedNodeIds: Object.keys(newNodes),
      selectedRelationId: null,
      activeTool: 'select',
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
    const minZ = Object.values(s.nodes).reduce((min, n) => Math.min(min, n.zIndex), 0);
    return {
      nodes: {
        ...s.nodes,
        [id]: { ...existing, zIndex: minZ - 1, updatedAt: Date.now() }
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

  // Auto-layout & Alignment
  alignNodes: (alignment) => set((s) => {
    if (s.selectedNodeIds.length < 2) return s;
    const nodes = s.selectedNodeIds.map(id => s.nodes[id]).filter(Boolean);
    
    let target = 0;
    if (alignment === 'top') target = Math.min(...nodes.map(n => n.position.y));
    else if (alignment === 'bottom') target = Math.max(...nodes.map(n => n.position.y + n.size.height));
    else if (alignment === 'center') {
      const min = Math.min(...nodes.map(n => n.position.y));
      const max = Math.max(...nodes.map(n => n.position.y + n.size.height));
      target = min + (max - min) / 2;
    }
    else if (alignment === 'left') target = Math.min(...nodes.map(n => n.position.x));
    else if (alignment === 'right') target = Math.max(...nodes.map(n => n.position.x + n.size.width));
    else if (alignment === 'middle') {
      const min = Math.min(...nodes.map(n => n.position.x));
      const max = Math.max(...nodes.map(n => n.position.x + n.size.width));
      target = min + (max - min) / 2;
    }

    const newNodes = { ...s.nodes };
    nodes.forEach(n => {
      let x = n.position.x;
      let y = n.position.y;
      if (alignment === 'top') y = target;
      else if (alignment === 'bottom') y = target - n.size.height;
      else if (alignment === 'center') y = target - n.size.height / 2;
      else if (alignment === 'left') x = target;
      else if (alignment === 'right') x = target - n.size.width;
      else if (alignment === 'middle') x = target - n.size.width / 2;
      
      newNodes[n.id] = { ...n, position: { x, y } };
    });

    return {
      past: [...s.past.slice(-39), { nodes: s.nodes, relations: s.relations }],
      future: [],
      nodes: newNodes
    };
  }),

  tidyUpNodes: () => set((s) => {
    if (s.selectedNodeIds.length < 2) return s;
    const nodes = s.selectedNodeIds.map(id => s.nodes[id]).filter(Boolean);
    
    // Determine if we should lay out horizontally or vertically based on bounding box aspect ratio
    const minX = Math.min(...nodes.map(n => n.position.x));
    const maxX = Math.max(...nodes.map(n => n.position.x + n.size.width));
    const minY = Math.min(...nodes.map(n => n.position.y));
    const maxY = Math.max(...nodes.map(n => n.position.y + n.size.height));
    const isHorizontal = (maxX - minX) >= (maxY - minY);

    // Sort nodes visually
    nodes.sort((a, b) => isHorizontal ? a.position.x - b.position.x : a.position.y - b.position.y);

    const GAP = 50;
    const newNodes = { ...s.nodes };

    let currentX = minX;
    let currentY = minY;

    nodes.forEach(n => {
      newNodes[n.id] = { ...n, position: { x: isHorizontal ? currentX : n.position.x, y: isHorizontal ? n.position.y : currentY } };
      if (isHorizontal) {
        currentX += n.size.width + GAP;
      } else {
        currentY += n.size.height + GAP;
      }
    });

    return {
      past: [...s.past.slice(-39), { nodes: s.nodes, relations: s.relations }],
      future: [],
      nodes: newNodes
    };
  }),

  // Tool
  activeTool: 'select',
  setActiveTool: (tool) => set((s) => ({
    activeTool: tool,
    relationSourceId: tool === 'relation' ? s.relationSourceId : null,
    relationSourcePort: tool === 'relation' ? s.relationSourcePort : null,
    relationTargetId: tool === 'relation' ? s.relationTargetId : null,
    relationTargetPort: tool === 'relation' ? s.relationTargetPort : null,
  })),

  // AI Assistant Modal
  isAIAssistantOpen: false,
  setAIAssistantOpen: (open) => set({ isAIAssistantOpen: open }),

  // Smart Snapping Guides
  snapLines: null,
  setSnapLines: (snap) => set({ snapLines: snap }),

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
  snapshot: () => set((s) => ({
    past: [...s.past.slice(-39), { nodes: s.nodes, relations: s.relations }],
    future: [],
  })),

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
