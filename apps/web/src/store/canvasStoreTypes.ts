import type {
  Point,
  Size,
  Viewport,
  LivingNode,
  Relation,
  RelationStyle,
  RelationshipType,
  ToolMode,
  FreeInkStroke,
} from '@canvio/core';

export type {
  Point,
  Size,
  Viewport,
  LivingNode,
  Relation,
  RelationStyle,
  RelationshipType,
  ToolMode,
  FreeInkStroke,
};

export type ThemePreference = 'system' | 'dark' | 'light';

export type HistorySnapshot = {
  nodes: Record<string, LivingNode>;
  relations: Record<string, Relation>;
  inkStrokes: FreeInkStroke[];
};

export type HistoryMode = 'local' | 'collaboration';

export type HistoryAdapter = {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

export interface CanvasStore {
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

  // Free Ink Layer
  inkStrokes: FreeInkStroke[];
  addInkStroke: (stroke: FreeInkStroke) => void;
  removeInkStroke: (id: string) => void;
  eraseInkAt: (point: { x: number; y: number }, radius?: number) => boolean;
  clearAllInk: () => void;
  replaceInkStrokes: (strokes: FreeInkStroke[]) => void;
  convertInkToNode: (strokeIds?: string[], targetType?: 'sticky' | 'text' | 'shape') => LivingNode | null;

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
  themePreference: ThemePreference;
  canvasBackground: string | null;
  toggleTheme: () => void;
  setThemePreference: (preference: ThemePreference) => void;
  syncSystemTheme: () => void;
  setCanvasBackground: (color: string | null) => void;
  setAppearance: (appearance: { theme?: 'dark' | 'light'; canvasBackground?: string | null }) => void;

  // Undo / Redo
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  historyMode: HistoryMode;
  historyAdapter: HistoryAdapter | null;
  canUndo: boolean;
  canRedo: boolean;
  setCollaborationHistoryAdapter: (adapter: HistoryAdapter | null) => void;
  refreshHistoryAvailability: () => void;
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
    inkStrokes?: FreeInkStroke[];
    viewport?: Viewport;
    appearance?: { theme?: 'dark' | 'light'; canvasBackground?: string | null };
  }) => void;
}
