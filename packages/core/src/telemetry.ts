export const PRODUCT_EVENT_NAMES = [
  'board_opened',
  'board_returned',
  'first_element_created',
  'first_relation_created',
  'ai_completed',
  'share_created',
  'share_opened',
  'export_completed',
  'restore_completed',
  'runtime_issue',
] as const;

export type ProductEventName = typeof PRODUCT_EVENT_NAMES[number];

export type ProductEventProperties = {
  board_opened: {
    entry: 'direct' | 'share' | 'demo';
    nodeCount: number;
    relationCount: number;
  };
  board_returned: {
    returnAfterMinutes: number;
  };
  first_element_created: {
    elementCount: number;
    activationMs: number;
  };
  first_relation_created: {
    relationCount: number;
    activationMs: number;
  };
  ai_completed: {
    intent: 'generate' | 'summary' | 'article' | 'organize' | 'analyze' | 'challenge' | 'socratic' | 'unknown';
    usedBoardContext: boolean;
    fallback: boolean;
    provider?: 'gemini' | 'openai' | 'anthropic' | 'groq' | 'unknown';
  };
  share_created: {
    isPublic: boolean;
    collaboratorCount: number;
  };
  share_opened: Record<string, never>;
  export_completed: {
    format: 'png' | 'pdf' | 'json';
    nodeCount: number;
    relationCount: number;
  };
  restore_completed: {
    nodeCount: number;
    relationCount: number;
    warningCount: number;
  };
  runtime_issue: {
    area: 'collaboration' | 'persistence' | 'ai' | 'map' | 'share' | 'export' | 'restore';
    code: 'offline' | 'connection_failed' | 'local_save_failed' | 'server_unavailable' | 'provider_fallback' | 'tile_load_failed' | 'request_failed' | 'invalid_backup' | 'unknown';
    recoverable: boolean;
  };
};

export interface ProductEventContext {
  deviceClass: 'mobile' | 'tablet' | 'desktop';
  inputMode: 'mouse' | 'touch' | 'pen' | 'unknown';
  viewportBucket: 'compact' | 'medium' | 'wide';
  online: boolean;
}

export type ProductEventEnvelope<K extends ProductEventName = ProductEventName> = {
  schemaVersion: 1;
  eventId: string;
  sessionId: string;
  boardTraceId?: string;
  name: K;
  occurredAt: string;
  context: ProductEventContext;
  properties: ProductEventProperties[K];
};

export type ProductEventValidation =
  | { ok: true; value: ProductEventEnvelope }
  | { ok: false; reason: string };

const ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const EVENT_NAMES = new Set<string>(PRODUCT_EVENT_NAMES);
const TOP_LEVEL_KEYS = new Set(['schemaVersion', 'eventId', 'sessionId', 'boardTraceId', 'name', 'occurredAt', 'context', 'properties']);
const CONTEXT_KEYS = new Set(['deviceClass', 'inputMode', 'viewportBucket', 'online']);

const PROPERTY_KEYS: Record<ProductEventName, Set<string>> = {
  board_opened: new Set(['entry', 'nodeCount', 'relationCount']),
  board_returned: new Set(['returnAfterMinutes']),
  first_element_created: new Set(['elementCount', 'activationMs']),
  first_relation_created: new Set(['relationCount', 'activationMs']),
  ai_completed: new Set(['intent', 'usedBoardContext', 'fallback', 'provider']),
  share_created: new Set(['isPublic', 'collaboratorCount']),
  share_opened: new Set(),
  export_completed: new Set(['format', 'nodeCount', 'relationCount']),
  restore_completed: new Set(['nodeCount', 'relationCount', 'warningCount']),
  runtime_issue: new Set(['area', 'code', 'recoverable']),
};

const DEVICE_CLASSES = new Set(['mobile', 'tablet', 'desktop']);
const INPUT_MODES = new Set(['mouse', 'touch', 'pen', 'unknown']);
const VIEWPORT_BUCKETS = new Set(['compact', 'medium', 'wide']);
const ENTRIES = new Set(['direct', 'share', 'demo']);
const AI_INTENTS = new Set(['generate', 'summary', 'article', 'organize', 'analyze', 'challenge', 'socratic', 'unknown']);
const AI_PROVIDERS = new Set(['gemini', 'openai', 'anthropic', 'groq', 'unknown']);
const EXPORT_FORMATS = new Set(['png', 'pdf', 'json']);
const ISSUE_AREAS = new Set(['collaboration', 'persistence', 'ai', 'map', 'share', 'export', 'restore']);
const ISSUE_CODES = new Set(['offline', 'connection_failed', 'local_save_failed', 'server_unavailable', 'provider_fallback', 'tile_load_failed', 'request_failed', 'invalid_backup', 'unknown']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isBoundedCount(value: unknown, max = 100_000) {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max;
}

function isEnumValue(value: unknown, allowed: Set<string>) {
  return typeof value === 'string' && allowed.has(value);
}

function validateProperties(name: ProductEventName, value: Record<string, unknown>) {
  if (!hasOnlyKeys(value, PROPERTY_KEYS[name])) return false;

  switch (name) {
    case 'board_opened':
      return isEnumValue(value.entry, ENTRIES) && isBoundedCount(value.nodeCount) && isBoundedCount(value.relationCount);
    case 'board_returned':
      return isBoundedCount(value.returnAfterMinutes, 5_256_000);
    case 'first_element_created':
      return isBoundedCount(value.elementCount) && isBoundedCount(value.activationMs, 86_400_000);
    case 'first_relation_created':
      return isBoundedCount(value.relationCount) && isBoundedCount(value.activationMs, 86_400_000);
    case 'ai_completed':
      return isEnumValue(value.intent, AI_INTENTS)
        && typeof value.usedBoardContext === 'boolean'
        && typeof value.fallback === 'boolean'
        && (value.provider === undefined || isEnumValue(value.provider, AI_PROVIDERS));
    case 'share_created':
      return typeof value.isPublic === 'boolean' && isBoundedCount(value.collaboratorCount, 10_000);
    case 'share_opened':
      return Object.keys(value).length === 0;
    case 'export_completed':
      return isEnumValue(value.format, EXPORT_FORMATS) && isBoundedCount(value.nodeCount) && isBoundedCount(value.relationCount);
    case 'restore_completed':
      return isBoundedCount(value.nodeCount) && isBoundedCount(value.relationCount) && isBoundedCount(value.warningCount, 1_000);
    case 'runtime_issue':
      return isEnumValue(value.area, ISSUE_AREAS) && isEnumValue(value.code, ISSUE_CODES) && typeof value.recoverable === 'boolean';
  }
}

export function validateProductEventEnvelope(input: unknown): ProductEventValidation {
  if (!isRecord(input) || !hasOnlyKeys(input, TOP_LEVEL_KEYS)) return { ok: false, reason: 'INVALID_ENVELOPE' };
  if (input.schemaVersion !== 1) return { ok: false, reason: 'UNSUPPORTED_SCHEMA' };
  if (typeof input.name !== 'string' || !EVENT_NAMES.has(input.name)) return { ok: false, reason: 'INVALID_EVENT_NAME' };
  if (typeof input.eventId !== 'string' || !ID_PATTERN.test(input.eventId)) return { ok: false, reason: 'INVALID_EVENT_ID' };
  if (typeof input.sessionId !== 'string' || !ID_PATTERN.test(input.sessionId)) return { ok: false, reason: 'INVALID_SESSION_ID' };
  if (input.boardTraceId !== undefined && (typeof input.boardTraceId !== 'string' || !ID_PATTERN.test(input.boardTraceId))) {
    return { ok: false, reason: 'INVALID_BOARD_TRACE_ID' };
  }
  if (typeof input.occurredAt !== 'string' || input.occurredAt.length > 40 || Number.isNaN(Date.parse(input.occurredAt))) {
    return { ok: false, reason: 'INVALID_TIMESTAMP' };
  }
  if (!isRecord(input.context) || !hasOnlyKeys(input.context, CONTEXT_KEYS)) return { ok: false, reason: 'INVALID_CONTEXT' };
  if (!isEnumValue(input.context.deviceClass, DEVICE_CLASSES)
    || !isEnumValue(input.context.inputMode, INPUT_MODES)
    || !isEnumValue(input.context.viewportBucket, VIEWPORT_BUCKETS)
    || typeof input.context.online !== 'boolean') {
    return { ok: false, reason: 'INVALID_CONTEXT' };
  }
  if (!isRecord(input.properties) || !validateProperties(input.name as ProductEventName, input.properties)) {
    return { ok: false, reason: 'INVALID_PROPERTIES' };
  }

  return { ok: true, value: input as ProductEventEnvelope };
}
