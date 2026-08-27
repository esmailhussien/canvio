import {
  type ProductEventContext,
  type ProductEventEnvelope,
  type ProductEventName,
  type ProductEventProperties,
  validateProductEventEnvelope,
} from '@canvio/core';
import { getApiBaseUrl } from './runtimeConfig';

const SESSION_STORAGE_KEY = 'CANVIO_TELEMETRY_SESSION_V1';
const BOARD_STORAGE_PREFIX = 'CANVIO_TELEMETRY_BOARD_V1:';
const TELEMETRY_OPTOUT_KEY = 'CANVIO_TELEMETRY_DISABLED';
const RETURN_VISIT_THRESHOLD_MS = 30 * 60 * 1_000;

type BoardTelemetryState = {
  traceId: string;
  lastVisitedAt: number;
  milestones: string[];
};

export interface BoardVisitTelemetry {
  boardTraceId: string;
  isReturn: boolean;
  returnAfterMinutes: number;
  openedAt: number;
}

let volatileSessionId = '';
let lastInputMode: ProductEventContext['inputMode'] = 'unknown';
let inputListenerInstalled = false;

function randomId(prefix: string) {
  const value = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
}

function getSessionId() {
  if (volatileSessionId) return volatileSessionId;
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      volatileSessionId = existing;
      return existing;
    }
    volatileSessionId = randomId('session');
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, volatileSessionId);
  } catch {
    volatileSessionId = randomId('session');
  }
  return volatileSessionId;
}

function boardStorageKey(worldId: string) {
  return `${BOARD_STORAGE_PREFIX}${worldId}`;
}

function readBoardState(worldId: string): BoardTelemetryState | null {
  try {
    const raw = window.localStorage.getItem(boardStorageKey(worldId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BoardTelemetryState>;
    if (typeof parsed.traceId !== 'string' || typeof parsed.lastVisitedAt !== 'number' || !Array.isArray(parsed.milestones)) return null;
    return {
      traceId: parsed.traceId,
      lastVisitedAt: parsed.lastVisitedAt,
      milestones: parsed.milestones.filter((item): item is string => typeof item === 'string'),
    };
  } catch {
    return null;
  }
}

function writeBoardState(worldId: string, state: BoardTelemetryState) {
  try {
    window.localStorage.setItem(boardStorageKey(worldId), JSON.stringify(state));
  } catch {
    // Telemetry must never block the board when storage is unavailable.
  }
}

function getOrCreateBoardState(worldId: string) {
  return readBoardState(worldId) || {
    traceId: randomId('board'),
    lastVisitedAt: 0,
    milestones: [],
  };
}

function installInputModeListener() {
  if (inputListenerInstalled || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  inputListenerInstalled = true;
  window.addEventListener('pointerdown', (event) => {
    lastInputMode = event.pointerType === 'pen'
      ? 'pen'
      : event.pointerType === 'touch'
        ? 'touch'
        : event.pointerType === 'mouse'
          ? 'mouse'
          : 'unknown';
  }, { capture: true, passive: true });
}

function getEventContext(): ProductEventContext {
  installInputModeListener();
  const width = typeof window !== 'undefined' && Number.isFinite(window.innerWidth) ? window.innerWidth : 1024;
  const touchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0;
  const deviceClass = width < 600 ? 'mobile' : width < 1024 || touchPoints > 0 ? 'tablet' : 'desktop';
  const viewportBucket = width < 600 ? 'compact' : width < 1280 ? 'medium' : 'wide';
  const inferredInput = lastInputMode !== 'unknown'
    ? lastInputMode
    : touchPoints > 0
      ? 'touch'
      : 'mouse';

  return {
    deviceClass,
    inputMode: inferredInput,
    viewportBucket,
    online: typeof navigator === 'undefined' || navigator.onLine !== false,
  };
}

function telemetryAllowed() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.localStorage.getItem(TELEMETRY_OPTOUT_KEY) === '1') return false;
  } catch {
    // Storage being unavailable is not itself an opt-out signal.
  }
  return typeof navigator === 'undefined' || navigator.doNotTrack !== '1';
}

export function createProductEventEnvelope<K extends ProductEventName>(
  name: K,
  properties: ProductEventProperties[K],
  boardTraceId?: string,
): ProductEventEnvelope<K> | null {
  const envelope: ProductEventEnvelope<K> = {
    schemaVersion: 1,
    eventId: randomId('event'),
    sessionId: getSessionId(),
    boardTraceId,
    name,
    occurredAt: new Date().toISOString(),
    context: getEventContext(),
    properties,
  };
  const validation = validateProductEventEnvelope(envelope);
  return validation.ok ? envelope : null;
}

export function trackProductEvent<K extends ProductEventName>(
  name: K,
  properties: ProductEventProperties[K],
  boardTraceId?: string,
) {
  if (!telemetryAllowed()) return;
  const envelope = createProductEventEnvelope(name, properties, boardTraceId);
  if (!envelope) return;

  const baseUrl = getApiBaseUrl();
  void fetch(`${baseUrl}/api/telemetry/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
    credentials: 'omit',
    keepalive: true,
  }).catch(() => {
    // Product telemetry is best effort and must never surface as a user error.
  });
}

export function startBoardTelemetry(worldId: string): BoardVisitTelemetry {
  const now = Date.now();
  const state = getOrCreateBoardState(worldId);
  const elapsed = state.lastVisitedAt > 0 ? now - state.lastVisitedAt : 0;
  const visit = {
    boardTraceId: state.traceId,
    isReturn: elapsed >= RETURN_VISIT_THRESHOLD_MS,
    returnAfterMinutes: elapsed > 0 ? Math.round(elapsed / 60_000) : 0,
    openedAt: now,
  };
  writeBoardState(worldId, { ...state, lastVisitedAt: now });
  return visit;
}

export function getBoardTraceId(worldId: string) {
  const state = getOrCreateBoardState(worldId);
  writeBoardState(worldId, state);
  return state.traceId;
}

export function markBoardTelemetryMilestone(worldId: string, milestone: 'first-element' | 'first-relation') {
  const state = getOrCreateBoardState(worldId);
  if (state.milestones.includes(milestone)) return false;
  state.milestones.push(milestone);
  writeBoardState(worldId, state);
  return true;
}

export function trackBoardEvent<K extends ProductEventName>(
  worldId: string,
  name: K,
  properties: ProductEventProperties[K],
) {
  trackProductEvent(name, properties, getBoardTraceId(worldId));
}
