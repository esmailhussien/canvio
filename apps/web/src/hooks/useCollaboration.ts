import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useCanvasStore } from '../store/canvasStore';
import { getWebSocketUrl } from '../utils/runtimeConfig';
import type { LivingNode, Relation, Viewport } from '@canvio/core';

// Re-export for backward compat
export type { LivingNode, Relation };

// Custom animal names for anonymous users
const ANIMALS = ['Fox', 'Owl', 'Bear', 'Wolf', 'Eagle', 'Dolphin', 'Panda', 'Tiger', 'Falcon', 'Lynx'];
const COLORS = ['#6366f1', '#a78bfa', '#f472b6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899', '#8b5cf6'];

function getRandomName() {
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `Anonymous ${animal}`;
}

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export interface UserPresence {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  cursor?: { x: number; y: number };
  selectedNodeIds?: string[];
}

function isStoredViewport(value: unknown): value is Viewport {
  if (!value || typeof value !== 'object') return false;
  const viewport = value as Viewport;
  return Number.isFinite(viewport.x) && Number.isFinite(viewport.y) && Number.isFinite(viewport.zoom);
}

/**
 * Serializes a LivingNode to a Y.Map for Yjs storage.
 * The `data` field is JSON-stringified to avoid nested Y.Map complexity.
 */
function nodeToYMap(node: LivingNode): Y.Map<any> {
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
function yMapToNode(ymap: Y.Map<any>): LivingNode {
  const obj = ymap.toJSON() as LivingNode;
  if (typeof obj.data === 'string') {
    try { obj.data = JSON.parse(obj.data as unknown as string); } catch { obj.data = {}; }
  }
  return obj;
}

/**
 * Serializes a Relation to a Y.Map for Yjs storage.
 */
function relationToYMap(relation: Relation): Y.Map<any> {
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
function yMapToRelation(ymap: Y.Map<any>): Relation {
  const obj = ymap.toJSON() as any;
  if (typeof obj.style === 'string') {
    try { obj.style = JSON.parse(obj.style); } catch { obj.style = {}; }
  }
  return obj as Relation;
}

export function useCollaboration(worldId: string) {
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);

  const upsertNodeRemote = useCanvasStore((s) => s.upsertNodeRemote);
  const removeNodeRemote = useCanvasStore((s) => s.removeNodeRemote);
  const upsertRelationRemote = useCanvasStore((s) => s.upsertRelationRemote);
  const removeRelationRemote = useCanvasStore((s) => s.removeRelationRemote);

  useEffect(() => {
    if (!worldId) return;

    // Create Yjs Doc
    const doc = new Y.Doc();
    const wsUrl = getWebSocketUrl();
    const wsProvider = new WebsocketProvider(wsUrl, worldId, doc);
    setProvider(wsProvider);
    let remoteSynced = false;

    const yNodes = doc.getMap<Y.Map<any>>('nodes');
    const yRelations = doc.getMap<Y.Map<any>>('relations');

    // ─── Remote → Local Sync ───────────────────────────────────────────
    // Handles top-level add/delete events (node created or removed)
    const handleNodesObserve = (event: Y.YMapEvent<Y.Map<any>>) => {
      if (event.transaction.origin === 'local-transaction') return;

      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add' || change.action === 'update') {
          const yNode = yNodes.get(key);
          if (yNode) {
            const node = yMapToNode(yNode);
            upsertNodeRemote(node);
          }
        } else if (change.action === 'delete') {
          removeNodeRemote(key);
        }
      });
    };

    const handleRelationsObserve = (event: Y.YMapEvent<Y.Map<any>>) => {
      if (event.transaction.origin === 'local-transaction') return;

      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add' || change.action === 'update') {
          const yRelation = yRelations.get(key);
          if (yRelation) {
            upsertRelationRemote(yMapToRelation(yRelation));
          }
        } else if (change.action === 'delete') {
          removeRelationRemote(key);
        }
      });
    };

    yNodes.observe(handleNodesObserve);
    yRelations.observe(handleRelationsObserve);

    // ─── LocalStorage Preload ──────────────────────────────────────────
    const storageKey = `canvio_world_${worldId}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.nodes) {
          Object.values(parsed.nodes).forEach((node: any) => upsertNodeRemote(node));
        }
        if (parsed.relations) {
          Object.values(parsed.relations).forEach((rel: any) => upsertRelationRemote(rel));
        }
        if (isStoredViewport(parsed.viewport)) {
          useCanvasStore.getState().setViewport({
            x: parsed.viewport.x,
            y: parsed.viewport.y,
            zoom: Math.min(5, Math.max(0.1, parsed.viewport.zoom)),
          });
        }
      }
    } catch (e) {
      console.error('Failed to load local world state', e);
    }

    // ─── Initial State Loading ─────────────────────────────────────────
    yNodes.forEach((yNode) => {
      const node = yMapToNode(yNode);
      if (node && node.id) upsertNodeRemote(node);
    });

    yRelations.forEach((yRelation) => {
      const rel = yMapToRelation(yRelation);
      if (rel && rel.id) upsertRelationRemote(rel);
    });

    // ─── Awareness (user presence) ────────────────────────────────────
    const userName = getRandomName();
    const userColor = getRandomColor();
    const awareness = wsProvider.awareness;

    awareness.setLocalState({
      user: { name: userName, color: userColor },
      cursor: null,
      selectedNodeIds: [],
    });

    const handleProviderStatus = (event: { status: string }) => {
      setConnected(event.status === 'connected');
    };

    const handleProviderSync = (synced: boolean) => {
      remoteSynced = synced;
    };

    const handleAwarenessChange = () => {
      const states = awareness.getStates();
      const activeUsers: UserPresence[] = [];

      states.forEach((state: any, clientID: number) => {
        if (clientID === doc.clientID) return; // Skip self
        if (state.user) {
          activeUsers.push({
            id: clientID.toString(),
            name: state.user.name,
            color: state.user.color,
            cursor: state.cursor,
            selectedNodeIds: state.selectedNodeIds,
          });
        }
      });

      setUsers(activeUsers);
    };

    wsProvider.on('status', handleProviderStatus);
    wsProvider.on('sync', handleProviderSync);
    awareness.on('change', handleAwarenessChange);

    // ─── Local → Remote Sync ──────────────────────────────────────────
    // FIX: Instead of updating individual keys on nested Y.Maps (which
    // does NOT trigger the parent map's observer), we replace the entire
    // Y.Map entry. This ensures remote clients receive the update via the
    // top-level yNodes.observe() handler.
    //
    // We use `updatedAt` as a cheap change-detection signal to avoid
    // replacing unchanged nodes.

    const unsubscribeNodes = useCanvasStore.subscribe(
      (s) => s.nodes,
      (nodes) => {
        doc.transact(() => {
          const localNodeIds = new Set(Object.keys(nodes));

          Object.entries(nodes).forEach(([id, node]) => {
            const existing = yNodes.get(id);

            // Only sync if node is new or has been updated
            const needsSync = !existing || existing.get('updatedAt') !== node.updatedAt;

            if (needsSync) {
              yNodes.set(id, nodeToYMap(node));
            }
          });

          if (remoteSynced) {
            // Remove nodes deleted locally only after initial remote sync.
            yNodes.forEach((_, id) => {
              if (!localNodeIds.has(id)) {
                yNodes.delete(id);
              }
            });
          }
        }, 'local-transaction');
      }
    );

    const unsubscribeRelations = useCanvasStore.subscribe(
      (s) => s.relations,
      (relations) => {
        doc.transact(() => {
          const localRelIds = new Set(Object.keys(relations));

          Object.entries(relations).forEach(([id, rel]) => {
            const existing = yRelations.get(id);

            // Always replace the entry to ensure the observer fires remotely
            if (!existing) {
              yRelations.set(id, relationToYMap(rel));
            } else {
              // Check if changed (relations don't have updatedAt, use JSON comparison)
              const currentStyle = existing.get('style');
              const currentLabel = existing.get('label');
              if (currentStyle !== JSON.stringify(rel.style) || currentLabel !== rel.label) {
                yRelations.set(id, relationToYMap(rel));
              }
            }
          });

          if (remoteSynced) {
            yRelations.forEach((_, id) => {
              if (!localRelIds.has(id)) {
                yRelations.delete(id);
              }
            });
          }
        }, 'local-transaction');
      }
    );

    // ─── Cursor Tracking ──────────────────────────────────────────────
    const handlePointerMove = (e: PointerEvent) => {
      const store = useCanvasStore.getState();
      const viewport = store.viewport;
      const rect = document.querySelector('.canvas')?.getBoundingClientRect();
      if (!rect) return;

      // Convert screen coords to world coords
      const worldX = (e.clientX - rect.left - rect.width / 2) / viewport.zoom - viewport.x;
      const worldY = (e.clientY - rect.top - rect.height / 2) / viewport.zoom - viewport.y;

      awareness.setLocalStateField('cursor', { x: worldX, y: worldY });
    };

    window.addEventListener('pointermove', handlePointerMove);

    const handleSelectionChange = () => {
      const store = useCanvasStore.getState();
      awareness.setLocalStateField('selectedNodeIds', store.selectedNodeIds);
    };

    const unsubscribeSelection = useCanvasStore.subscribe(
      (s) => s.selectedNodeIds,
      handleSelectionChange
    );

    const saveLocalState = () => {
      try {
        const store = useCanvasStore.getState();
        localStorage.setItem(storageKey, JSON.stringify({
          nodes: store.nodes,
          relations: store.relations,
          viewport: store.viewport,
          savedAt: Date.now(),
        }));
      } catch (err) {
        // Ignore storage quota errors
      }
    };

    const unsubscribeLocalSave = useCanvasStore.subscribe(saveLocalState);

    return () => {
      unsubscribeNodes();
      unsubscribeRelations();
      unsubscribeSelection();
      unsubscribeLocalSave();
      window.removeEventListener('pointermove', handlePointerMove);
      wsProvider.off('status', handleProviderStatus);
      wsProvider.off('sync', handleProviderSync);
      awareness.off('change', handleAwarenessChange);
      yNodes.unobserve(handleNodesObserve);
      yRelations.unobserve(handleRelationsObserve);
      wsProvider.destroy();
      doc.destroy();
    };
  }, [worldId]);

  return { connected, users, provider };
}
