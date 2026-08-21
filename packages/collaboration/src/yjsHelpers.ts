import * as Y from 'yjs';
import type { LivingNode, Relation } from '@canvio/core';

const COLLABORATIVE_TEXT_DATA_KEYS = new Set(['code', 'filename', 'label', 'text', 'title']);

function relationValueToYMap(value: unknown): unknown {
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
}

function syncObjectToYMap<T extends Record<string, unknown>>(
  ymap: Y.Map<unknown>,
  value: T,
  serialize: (key: string, fieldValue: unknown) => unknown
): void {
  const activeKeys = new Set<string>();

  Object.entries(value).forEach(([key, fieldValue]) => {
    activeKeys.add(key);
    const nextValue = serialize(key, fieldValue);
    if (ymap.get(key) !== nextValue) {
      ymap.set(key, nextValue);
    }
  });

  Array.from(ymap.keys()).forEach((key) => {
    if (!activeKeys.has(key)) {
      ymap.delete(key);
    }
  });
}

function isCollaborativeTextDataField(key: string, value: unknown): value is string {
  return COLLABORATIVE_TEXT_DATA_KEYS.has(key) && typeof value === 'string';
}

function applyTextDiff(ytext: Y.Text, nextValue: string): void {
  const currentValue = ytext.toString();
  if (currentValue === nextValue) return;

  let prefixLength = 0;
  const maxPrefixLength = Math.min(currentValue.length, nextValue.length);
  while (prefixLength < maxPrefixLength && currentValue[prefixLength] === nextValue[prefixLength]) {
    prefixLength += 1;
  }

  let currentSuffixIndex = currentValue.length - 1;
  let nextSuffixIndex = nextValue.length - 1;
  while (
    currentSuffixIndex >= prefixLength &&
    nextSuffixIndex >= prefixLength &&
    currentValue[currentSuffixIndex] === nextValue[nextSuffixIndex]
  ) {
    currentSuffixIndex -= 1;
    nextSuffixIndex -= 1;
  }

  const deleteLength = currentSuffixIndex - prefixLength + 1;
  if (deleteLength > 0) {
    ytext.delete(prefixLength, deleteLength);
  }

  const insertText = nextValue.slice(prefixLength, nextSuffixIndex + 1);
  if (insertText) {
    ytext.insert(prefixLength, insertText);
  }
}

function syncTextValue(dataMap: Y.Map<unknown>, key: string, value: string): void {
  const existing = dataMap.get(key);
  const ytext = existing instanceof Y.Text ? existing : new Y.Text();

  if (!(existing instanceof Y.Text)) {
    dataMap.set(key, ytext);
  }

  applyTextDiff(ytext, value);
}

function textToYText(value: string): Y.Text {
  const ytext = new Y.Text();
  if (value) {
    ytext.insert(0, value);
  }
  return ytext;
}

function dataToYMap(data: Record<string, unknown>): Y.Map<unknown> {
  const dataMap = new Y.Map<unknown>();
  Object.entries(data).forEach(([key, value]) => {
    dataMap.set(key, isCollaborativeTextDataField(key, value) ? textToYText(value) : value);
  });
  return dataMap;
}

function syncDataToYMap(dataMap: Y.Map<unknown>, data: Record<string, unknown>): void {
  const activeKeys = new Set<string>();

  Object.entries(data).forEach(([key, value]) => {
    activeKeys.add(key);
    if (isCollaborativeTextDataField(key, value)) {
      syncTextValue(dataMap, key, value);
      return;
    }

    if (dataMap.get(key) !== value) {
      dataMap.set(key, value);
    }
  });

  Array.from(dataMap.keys()).forEach((key) => {
    if (!activeKeys.has(key)) {
      dataMap.delete(key);
    }
  });
}

/**
 * Updates an existing Y.Map in place so remote peers keep the same Yjs node
 * object while individual fields change.
 */
export function syncNodeToYMap(ymap: Y.Map<unknown>, node: LivingNode): void {
  const activeKeys = new Set<string>();

  Object.entries(node as unknown as Record<string, unknown>).forEach(([key, value]) => {
    activeKeys.add(key);

    if (key === 'data') {
      const existingData = ymap.get(key);
      const dataMap = existingData instanceof Y.Map ? existingData : new Y.Map<unknown>();
      if (!(existingData instanceof Y.Map)) {
        ymap.set(key, dataMap);
      }
      syncDataToYMap(dataMap, (value ?? {}) as Record<string, unknown>);
      return;
    }

    if (ymap.get(key) !== value) {
      ymap.set(key, value);
    }
  });

  Array.from(ymap.keys()).forEach((key) => {
    if (!activeKeys.has(key)) {
      ymap.delete(key);
    }
  });
}

/**
 * Serializes a LivingNode to a Y.Map for Yjs storage.
 * Text-like `data` fields are stored as Y.Text so collaborators can merge
 * small text edits without replacing the whole node payload.
 */
export function nodeToYMap(node: LivingNode): Y.Map<unknown> {
  const ymap = new Y.Map<unknown>();
  Object.entries(node as unknown as Record<string, unknown>).forEach(([key, value]) => {
    if (key === 'data') {
      ymap.set(key, dataToYMap((value ?? {}) as Record<string, unknown>));
      return;
    }
    ymap.set(key, value);
  });
  return ymap;
}

/**
 * Deserializes a Y.Map back to a LivingNode.
 * Supports both the current nested Y.Map data shape and old JSON-string data.
 */
export function yMapToNode(ymap: Y.Map<unknown>): LivingNode {
  const obj = ymap.toJSON() as LivingNode;
  if (typeof obj.data === 'string') {
    try {
      obj.data = JSON.parse(obj.data as unknown as string);
    } catch {
      obj.data = {};
    }
  }
  return obj;
}

/**
 * Updates an existing relation Y.Map in place.
 */
export function syncRelationToYMap(ymap: Y.Map<unknown>, relation: Relation): void {
  syncObjectToYMap(ymap, relation as unknown as Record<string, unknown>, (_key, value) => relationValueToYMap(value));
}

/**
 * Serializes a Relation to a Y.Map for Yjs storage.
 */
export function relationToYMap(relation: Relation): Y.Map<unknown> {
  const ymap = new Y.Map<unknown>();
  Object.entries(relation as unknown as Record<string, unknown>).forEach(([key, value]) => {
    ymap.set(key, relationValueToYMap(value));
  });
  return ymap;
}

/**
 * Deserializes a Y.Map back to a Relation.
 */
export function yMapToRelation(ymap: Y.Map<unknown>): Relation {
  const obj = ymap.toJSON() as any;
  if (typeof obj.style === 'string') {
    try {
      obj.style = JSON.parse(obj.style);
    } catch {
      obj.style = {};
    }
  }
  return obj as Relation;
}

export const ANIMALS = ['Fox', 'Owl', 'Bear', 'Wolf', 'Eagle', 'Dolphin', 'Panda', 'Tiger', 'Falcon', 'Lynx'];
export const PRESENCE_COLORS = ['#6366f1', '#a78bfa', '#f472b6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899', '#8b5cf6'];

export function getRandomName(): string {
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `Anonymous ${animal}`;
}

export function getRandomColor(): string {
  return PRESENCE_COLORS[Math.floor(Math.random() * PRESENCE_COLORS.length)];
}
