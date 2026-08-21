import type { LivingNode, Relation, Viewport, FreeInkStroke } from '../store/canvasStore';

export const CANVIO_BACKUP_KIND = 'canvio.workspace.backup';
export const CANVIO_BACKUP_SCHEMA_VERSION = 2;

type Appearance = {
  theme?: 'dark' | 'light';
  canvasBackground?: string | null;
};

export interface CanvioBackupDocument {
  app: 'Canvio';
  kind: typeof CANVIO_BACKUP_KIND;
  schemaVersion: number;
  minReaderSchemaVersion: number;
  version: string;
  worldId: string;
  exportedAt: string;
  appearance: Appearance;
  viewport: Viewport;
  counts: {
    nodes: number;
    relations: number;
    inkStrokes?: number;
  };
  nodes: Record<string, LivingNode>;
  relations: Record<string, Relation>;
  inkStrokes?: FreeInkStroke[];
}

export interface CanvioBackupImportResult {
  world: {
    nodes: Record<string, LivingNode>;
    relations: Record<string, Relation>;
    inkStrokes?: FreeInkStroke[];
    viewport?: Viewport;
    appearance?: Appearance;
  };
  meta: {
    schemaVersion: number;
    exportedAt?: string;
    warnings: string[];
    removedRelations: number;
  };
}

export class CanvioBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanvioBackupError';
  }
}

export function createCanvioBackupDocument(args: {
  nodes: Record<string, LivingNode>;
  relations: Record<string, Relation>;
  inkStrokes?: FreeInkStroke[];
  worldId: string;
  viewport: Viewport;
  appearance: Appearance;
}): CanvioBackupDocument {
  return {
    app: 'Canvio',
    kind: CANVIO_BACKUP_KIND,
    schemaVersion: CANVIO_BACKUP_SCHEMA_VERSION,
    minReaderSchemaVersion: 1,
    version: '2.0',
    worldId: args.worldId,
    exportedAt: new Date().toISOString(),
    appearance: args.appearance,
    viewport: args.viewport,
    counts: {
      nodes: Object.keys(args.nodes).length,
      relations: Object.keys(args.relations).length,
      inkStrokes: args.inkStrokes ? args.inkStrokes.length : 0,
    },
    nodes: args.nodes,
    relations: args.relations,
    inkStrokes: args.inkStrokes || [],
  };
}

export function parseCanvioBackup(text: string): CanvioBackupImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CanvioBackupError('Import failed: this file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CanvioBackupError('Import failed: backup must be a JSON object.');
  }

  const payload = parsed as Record<string, unknown>;
  const schemaVersion = getSchemaVersion(payload);
  validateBackupIdentity(payload, schemaVersion);

  const nodes = normalizeNodeRecord(payload.nodes);
  const relationsInput = normalizeRelationRecord(payload.relations);
  if (!nodes) {
    throw new CanvioBackupError('Import failed: backup does not contain a valid nodes record.');
  }
  if (!relationsInput) {
    throw new CanvioBackupError('Import failed: backup does not contain a valid relations record.');
  }

  const inkStrokes = normalizeInkStrokes(payload.inkStrokes);

  const { relations, removedRelations } = sanitizeRelations(relationsInput, nodes);
  const warnings = validateCounts(payload.counts, nodes, relationsInput);
  if (removedRelations > 0) {
    warnings.push(`${removedRelations} relation${removedRelations === 1 ? '' : 's'} skipped because connected nodes were missing.`);
  }

  return {
    world: {
      nodes,
      relations,
      inkStrokes,
      viewport: isViewport(payload.viewport) ? {
        x: payload.viewport.x,
        y: payload.viewport.y,
        zoom: clampNumber(payload.viewport.zoom, 0.1, 5, 1),
      } : undefined,
      appearance: isAppearance(payload.appearance) ? payload.appearance : undefined,
    },
    meta: {
      schemaVersion,
      exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : undefined,
      warnings,
      removedRelations,
    },
  };
}

function validateBackupIdentity(payload: Record<string, unknown>, schemaVersion: number) {
  const kind = typeof payload.kind === 'string' ? payload.kind : '';
  const app = typeof payload.app === 'string' ? payload.app : '';

  if (schemaVersion >= 2 && (kind !== CANVIO_BACKUP_KIND || app !== 'Canvio')) {
    throw new CanvioBackupError('Import failed: this is not a Canvio workspace backup.');
  }

  if (schemaVersion > CANVIO_BACKUP_SCHEMA_VERSION) {
    throw new CanvioBackupError(`Import failed: backup schema v${schemaVersion} is newer than this Canvio version supports.`);
  }
}

function getSchemaVersion(payload: Record<string, unknown>) {
  if (Number.isInteger(payload.schemaVersion)) return payload.schemaVersion as number;
  if (payload.version === '1.0' || payload.nodes || payload.relations) return 1;
  return CANVIO_BACKUP_SCHEMA_VERSION + 1;
}

// Ephemeral UI state (e.g. viewport-derived map marker anchors) is recomputed
// at runtime and must not bloat backups.
const EPHEMERAL_NODE_DATA_KEYS = new Set(['markerAnchors']);

function sanitizeNodeData(data: Record<string, unknown>) {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (EPHEMERAL_NODE_DATA_KEYS.has(key)) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

function normalizeNodeRecord(value: unknown): Record<string, LivingNode> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result: Record<string, LivingNode> = {};

  for (const [id, rawNode] of Object.entries(value)) {
    if (!id || !rawNode || typeof rawNode !== 'object' || Array.isArray(rawNode)) return null;
    const node = rawNode as Partial<LivingNode>;
    const nodeId = typeof node.id === 'string' && node.id ? node.id : id;
    if (nodeId !== id || typeof node.type !== 'string' || !isPoint(node.position) || !isSize(node.size)) return null;

    result[id] = {
      id,
      type: node.type,
      position: { x: node.position.x, y: node.position.y },
      size: {
        width: clampNumber(node.size.width, 8, 12000, 240),
        height: clampNumber(node.size.height, 8, 12000, 140),
      },
      rotation: Number.isFinite(node.rotation) ? Number(node.rotation) : 0,
      zIndex: Number.isFinite(node.zIndex) ? Number(node.zIndex) : 0,
      locked: typeof node.locked === 'boolean' ? node.locked : false,
      data: sanitizeNodeData(
        node.data && typeof node.data === 'object' && !Array.isArray(node.data) ? node.data : {}
      ),
      createdAt: Number.isFinite(node.createdAt) ? Number(node.createdAt) : Date.now(),
      updatedAt: Number.isFinite(node.updatedAt) ? Number(node.updatedAt) : Date.now(),
    };
  }

  return result;
}

function normalizeRelationRecord(value: unknown): Record<string, Relation> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result: Record<string, Relation> = {};

  for (const [id, rawRelation] of Object.entries(value)) {
    if (!id || !rawRelation || typeof rawRelation !== 'object' || Array.isArray(rawRelation)) return null;
    const relation = rawRelation as Partial<Relation>;
    const relationId = typeof relation.id === 'string' && relation.id ? relation.id : id;
    if (relationId !== id || typeof relation.sourceId !== 'string' || typeof relation.targetId !== 'string') return null;

    result[id] = {
      id,
      sourceId: relation.sourceId,
      sourcePort: typeof relation.sourcePort === 'string' ? relation.sourcePort : undefined,
      targetId: relation.targetId,
      targetPort: typeof relation.targetPort === 'string' ? relation.targetPort : undefined,
      relationship: normalizeRelationship(relation.relationship),
      label: typeof relation.label === 'string' ? relation.label : undefined,
      style: normalizeRelationStyle(relation.style),
    };
  }

  return result;
}

function normalizeInkStrokes(value: unknown): FreeInkStroke[] {
  if (!Array.isArray(value)) return [];
  const result: FreeInkStroke[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const stroke = raw as Partial<FreeInkStroke>;
    if (typeof stroke.id !== 'string' || !Array.isArray(stroke.points) || stroke.points.length === 0) continue;
    const cleanPoints: number[][] = [];
    for (const pt of stroke.points) {
      if (Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) {
        cleanPoints.push([Number(pt[0]), Number(pt[1]), Number.isFinite(pt[2]) ? Number(pt[2]) : 0.5]);
      }
    }
    if (cleanPoints.length === 0) continue;
    result.push({
      id: stroke.id,
      points: cleanPoints,
      color: typeof stroke.color === 'string' ? stroke.color : '#f0f0f5',
      width: Number.isFinite(stroke.width) ? Number(stroke.width) : 3,
      opacity: Number.isFinite(stroke.opacity) ? Number(stroke.opacity) : undefined,
      highlighter: Boolean(stroke.highlighter),
      createdAt: Number.isFinite(stroke.createdAt) ? Number(stroke.createdAt) : Date.now(),
    });
  }
  return result;
}

function sanitizeRelations(relations: Record<string, Relation>, nodes: Record<string, LivingNode>) {
  const entries = Object.entries(relations);
  const kept = entries.filter(([, relation]) => Boolean(nodes[relation.sourceId]) && Boolean(nodes[relation.targetId]));
  return {
    relations: Object.fromEntries(kept),
    removedRelations: entries.length - kept.length,
  };
}

function validateCounts(
  counts: unknown,
  nodes: Record<string, LivingNode>,
  relations: Record<string, Relation>
) {
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return [];
  const expected = counts as { nodes?: unknown; relations?: unknown };
  const warnings: string[] = [];
  if (Number.isFinite(expected.nodes) && Number(expected.nodes) !== Object.keys(nodes).length) {
    warnings.push('Node count did not match the backup manifest.');
  }
  if (Number.isFinite(expected.relations) && Number(expected.relations) !== Object.keys(relations).length) {
    warnings.push('Relation count did not match the backup manifest.');
  }
  return warnings;
}

function normalizeRelationStyle(style: unknown): Relation['style'] {
  const value = style && typeof style === 'object' && !Array.isArray(style) ? style as Partial<Relation['style']> : {};
  const type = value.type === 'curved' || value.type === 'orthogonal' || value.type === 'straight' ? value.type : 'orthogonal';
  const width = clampNumber(value.width, 1, 16, 2);
  return {
    type,
    color: typeof value.color === 'string' && value.color.trim() ? value.color : 'var(--relation-default)',
    width,
    dash: Array.isArray(value.dash) ? value.dash.filter((part): part is number => Number.isFinite(part)).slice(0, 8) : undefined,
    startArrow: normalizeArrow(value.startArrow),
    endArrow: normalizeArrow(value.endArrow),
    animated: typeof value.animated === 'boolean' ? value.animated : undefined,
  };
}

function normalizeRelationship(value: unknown): Relation['relationship'] {
  const allowed = new Set([
    'related_to', 'leads_to', 'based_on', 'part_of', 'depends_on', 'contradicts',
    'same_as', 'enables', 'inspired_by', 'custom',
  ]);
  return typeof value === 'string' && allowed.has(value) ? value as Relation['relationship'] : 'related_to';
}

function normalizeArrow(value: unknown): Relation['style']['startArrow'] {
  return value === 'arrow' || value === 'diamond' || value === 'circle' || value === 'none' ? value : undefined;
}

function isPoint(value: unknown): value is { x: number; y: number } {
  return Boolean(value) && typeof value === 'object' &&
    Number.isFinite((value as { x?: unknown }).x) &&
    Number.isFinite((value as { y?: unknown }).y);
}

function isSize(value: unknown): value is { width: number; height: number } {
  return Boolean(value) && typeof value === 'object' &&
    Number.isFinite((value as { width?: unknown }).width) &&
    Number.isFinite((value as { height?: unknown }).height);
}

function isViewport(value: unknown): value is Viewport {
  return isPoint(value) && Number.isFinite((value as { zoom?: unknown }).zoom);
}

function isAppearance(value: unknown): value is Appearance {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const appearance = value as { theme?: unknown; canvasBackground?: unknown };
  return (
    (appearance.theme === undefined || appearance.theme === 'dark' || appearance.theme === 'light') &&
    (appearance.canvasBackground === undefined || appearance.canvasBackground === null || typeof appearance.canvasBackground === 'string')
  );
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Number(value)));
}
