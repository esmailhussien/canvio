// Point, Size, Bounds, Viewport
export interface Point { x: number; y: number; }
export interface Size { width: number; height: number; }
export interface Bounds { x: number; y: number; width: number; height: number; }
export interface Viewport { x: number; y: number; zoom: number; }

// Living Node — the core object on the canvas
export interface LivingNode {
  id: string;
  type: string; // 'drawing' | 'text' | 'sticky' | 'map'
  position: Point;
  size: Size;
  rotation: number;
  zIndex: number;
  locked: boolean;
  data: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

// Relation — semantic connection between nodes
export type RelationshipType =
  | 'related_to' | 'leads_to' | 'based_on' | 'part_of'
  | 'depends_on' | 'contradicts' | 'same_as' | 'enables'
  | 'inspired_by' | 'custom';

export interface RelationStyle {
  type: 'straight' | 'curved' | 'orthogonal';
  color: string;
  width: number;
  dash?: number[];
  startArrow?: 'none' | 'arrow' | 'diamond' | 'circle';
  endArrow?: 'none' | 'arrow' | 'diamond' | 'circle';
  animated?: boolean;
}

export interface Relation {
  id: string;
  sourceId: string;
  sourcePort?: string;
  targetId: string;
  targetPort?: string;
  relationship: RelationshipType;
  label?: string;
  style: RelationStyle;
}

// Connection Port on a Node
export interface ConnectionPort {
  id: string;
  position: 'top' | 'right' | 'bottom' | 'left' | 'center';
  offset?: Point;
}

// Node Plugin interface
export interface NodePlugin<T extends Record<string, unknown> = Record<string, unknown>> {
  type: string;
  name: string;
  icon: string; // icon name/path
  category: 'core' | 'media' | 'data' | 'ai';
  defaultSize: Size;
  create(position: Point): LivingNode;
  getConnectionPorts(node: LivingNode): ConnectionPort[];
  getTextContent?(node: LivingNode): string;
  getSummary?(node: LivingNode): string;
}

// Free Ink Stroke — for freehand canvas sketching without node encapsulation
export interface FreeInkStroke {
  id: string;
  points: number[][]; // [x, y, pressure]
  color: string;
  width: number;
  opacity?: number;
  highlighter?: boolean;
  createdAt: number;
}

// Graph Reasoning Insights
export type GraphInsightType =
  | 'contradiction'
  | 'orphan'
  | 'dependency_chain'
  | 'missing_evidence'
  | 'cycle'
  | 'unanchored_claim'
  | 'suggestion';

export interface GraphInsight {
  id: string;
  type: GraphInsightType;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  nodeIds: string[];
  relationIds?: string[];
  suggestedAction?: {
    label: string;
    type: 'add_relation' | 'resolve_contradiction' | 'focus_nodes' | 'add_evidence' | 'break_cycle';
    payload?: Record<string, unknown>;
  };
}

// Tool mode
export type ToolMode =
  | 'select'
  | 'pan'
  | 'draw'
  | 'highlighter'
  | 'laser'
  | 'arrow'
  | 'text'
  | 'sticky'
  | 'map'
  | 'relation'
  | 'eraser'
  | 'image'
  | 'shape'
  | 'frame'
  | 'code'
  | 'ink'
  | 'lasso';

// User presence
export interface UserPresence {
  id: string;
  name: string;
  color: string;
  cursor?: Point;
  selectedNodeIds: string[];
}

// Canvas store state
export interface CanvasState {
  // Viewport
  viewport: Viewport;
  // Nodes
  nodes: Map<string, LivingNode>;
  // Relations
  relations: Map<string, Relation>;
  // Free ink strokes
  inkStrokes?: FreeInkStroke[];
  // Selection
  selectedNodeIds: Set<string>;
  // Tool
  activeTool: ToolMode;
  // Drawing settings
  strokeColor: string;
  strokeWidth: number;
  // Sticky note color
  stickyColor: string;
  // Theme
  theme: 'dark' | 'light';
}
