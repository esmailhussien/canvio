import * as Y from 'yjs';
import type { LivingNode, Relation } from '@canvio/core';

/**
 * Serializes a LivingNode to a Y.Map for Yjs storage.
 * The `data` field is JSON-stringified to avoid nested Y.Map complexity.
 */
export function nodeToYMap(node: LivingNode): Y.Map<any> {
  const ymap = new Y.Map();
  Object.entries(node).forEach(([k, v]) => {
    if (k === 'data') {
      ymap.set(k, JSON.stringify(v));
    } else {
      ymap.set(k, v);
    }
  });
  return ymap;
}

/**
 * Deserializes a Y.Map back to a LivingNode.
 * Parses the `data` field from JSON string.
 */
export function yMapToNode(ymap: Y.Map<any>): LivingNode {
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
 * Serializes a Relation to a Y.Map for Yjs storage.
 */
export function relationToYMap(relation: Relation): Y.Map<any> {
  const ymap = new Y.Map();
  Object.entries(relation).forEach(([k, v]) => {
    if (typeof v === 'object' && v !== null) {
      ymap.set(k, JSON.stringify(v));
    } else {
      ymap.set(k, v);
    }
  });
  return ymap;
}

/**
 * Deserializes a Y.Map back to a Relation.
 */
export function yMapToRelation(ymap: Y.Map<any>): Relation {
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
