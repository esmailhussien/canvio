import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useCanvasStore } from '../store/canvasStore';
import { getCanvioApiToken, getCanvioClientId, getWebSocketUrl } from '../utils/runtimeConfig';
import { getStorageItem, setStorageItem } from '../utils/storageDB';
import {
  nodeToYMap,
  yMapToNode,
  relationToYMap,
  yMapToRelation,
  getRandomName,
  getRandomColor,
  type UserPresence,
} from '@canvio/collaboration';
import type { LivingNode, Relation, Viewport } from '@canvio/core';

// Re-export for backward compat
export type { LivingNode, Relation, UserPresence };

function isStoredViewport(value: unknown): value is Viewport {
  if (!value || typeof value !== 'object') return false;
  const viewport = value as Viewport;
  return Number.isFinite(viewport.x) && Number.isFinite(viewport.y) && Number.isFinite(viewport.zoom);
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
    const currentStore = useCanvasStore.getState();
    currentStore.replaceWorld({
      nodes: {},
      relations: {},
      viewport: { x: 0, y: 0, zoom: 1 },
      appearance: {
        theme: currentStore.theme,
        canvasBackground: currentStore.canvasBackground,
      },
    });

    // Create Yjs Doc
    const doc = new Y.Doc();
    const wsUrl = getWebSocketUrl();
    const wsParams: Record<string, string> = {
      clientId: getCanvioClientId(),
    };
    const apiToken = getCanvioApiToken();
    if (apiToken) wsParams.token = apiToken;
    const wsProvider = new WebsocketProvider(wsUrl, worldId, doc, {
      connect: false,
      maxBackoffTime: 30000,
      params: wsParams,
    });
    setProvider(wsProvider);

    // Delay actual connection by 150ms to bypass React StrictMode's immediate unmount sequence
    const connectTimer = window.setTimeout(() => {
      wsProvider.connect();
    }, 150);

    // ──────────────────────────────────────────────────────────────────
    // SYNC GUARDS
    // remoteSynced: true once the first Yjs handshake completes and we
    //   have the authoritative server state.
    // localPushEnabled: true once we've finished merging remote + local
    //   state and it's safe to push local changes back to Yjs.
    //   This prevents a joiner from overwriting the creator's work.
    // ──────────────────────────────────────────────────────────────────
    let remoteSynced = false;
    let localPushEnabled = false;
    let isReceivingRemote = false;

    const yNodes = doc.getMap<Y.Map<any>>('nodes');
    const yRelations = doc.getMap<Y.Map<any>>('relations');

    // ─── Remote → Local Sync ───────────────────────────────────────────
    const handleNodesObserve = (event: Y.YMapEvent<Y.Map<any>>) => {
      if (event.transaction.origin === 'local-transaction') return;

      isReceivingRemote = true;
      try {
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
      } finally {
        isReceivingRemote = false;
      }
    };

    const handleRelationsObserve = (event: Y.YMapEvent<Y.Map<any>>) => {
      if (event.transaction.origin === 'local-transaction') return;

      isReceivingRemote = true;
      try {
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
      } finally {
        isReceivingRemote = false;
      }
    };

    yNodes.observe(handleNodesObserve);
    yRelations.observe(handleRelationsObserve);

    // ─── IndexedDB Preload (offline fallback) ─────────────────────────
    // Only load IndexedDB cache if we don't have remote data yet.
    // If remote sync delivers data first, we skip the cache to avoid
    // overwriting the authoritative server state.
    const storageKey = `canvio_world_${worldId}`;
    const loadFromIndexedDB = async () => {
      // If remote already synced, skip local cache
      if (remoteSynced) return;
      
      try {
        const parsed = await getStorageItem<any>(storageKey);
        if (!parsed) return;
        
        // Double-check: if remote synced while we were awaiting IndexedDB, bail out
        if (remoteSynced) return;

        isReceivingRemote = true;
        try {
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
        } finally {
          isReceivingRemote = false;
        }
      } catch (e) {
        console.error('Failed to load local world state from IndexedDB', e);
      }
    };
    loadFromIndexedDB();

    // ─── Initial State Loading ─────────────────────────────────────────
    isReceivingRemote = true;
    try {
      yNodes.forEach((yNode) => {
        const node = yMapToNode(yNode);
        if (node && node.id) upsertNodeRemote(node);
      });

      yRelations.forEach((yRelation) => {
        const rel = yMapToRelation(yRelation);
        if (rel && rel.id) upsertRelationRemote(rel);
      });
    } finally {
      isReceivingRemote = false;
    }

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

    let hasHandledError = false;
    const handleConnectionFailure = () => {
      if (hasHandledError) return;
      hasHandledError = true;
      if (wsUrl.includes('localhost') || wsUrl.includes('127.0.0.1')) {
        wsProvider.off('connection-error', handleConnectionFailure);
        wsProvider.disconnect();
        console.info('🔌 Canvio is running in Offline-First IndexedDB mode.');
        // In offline mode, enable local push immediately so the user can work
        localPushEnabled = true;
      }
    };

    const handleProviderSync = (synced: boolean) => {
      if (synced && !remoteSynced) {
        remoteSynced = true;

        // Now load all remote state into the local store
        isReceivingRemote = true;
        try {
          yNodes.forEach((yNode) => {
            const node = yMapToNode(yNode);
            if (node && node.id) upsertNodeRemote(node);
          });
          yRelations.forEach((yRelation) => {
            const rel = yMapToRelation(yRelation);
            if (rel && rel.id) upsertRelationRemote(rel);
          });
        } finally {
          isReceivingRemote = false;
        }

        // Small delay before enabling local push to let the store settle
        window.setTimeout(() => {
          localPushEnabled = true;
          
          // CRITICAL: Push any local state that was created before sync completed.
          // The store subscription only fires on future changes, so we need to
          // manually push existing nodes/relations that were created while offline.
          const store = useCanvasStore.getState();
          const localNodes = store.nodes;
          const localRelations = store.relations;
          
          doc.transact(() => {
            // Push local nodes to Yjs
            Object.entries(localNodes).forEach(([id, node]) => {
              const existing = yNodes.get(id);
              if (!existing || existing.get('updatedAt') !== node.updatedAt) {
                yNodes.set(id, nodeToYMap(node));
              }
            });
            
            // Push local relations to Yjs
            Object.entries(localRelations).forEach(([id, rel]) => {
              if (!yRelations.has(id)) {
                yRelations.set(id, relationToYMap(rel));
              }
            });
          }, 'local-transaction');
        }, 100);
      }
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
    wsProvider.on('connection-error', handleConnectionFailure);
    awareness.on('change', handleAwarenessChange);

    // ─── Local → Remote Sync ──────────────────────────────────────────
    const unsubscribeNodes = useCanvasStore.subscribe(
      (s) => s.nodes,
      (nodes, prevNodes = {}) => {
        // CRITICAL: Don't push local state until remote sync is done
        if (isReceivingRemote || !localPushEnabled) return;

        doc.transact(() => {
          Object.entries(nodes).forEach(([id, node]) => {
            const existing = yNodes.get(id);
            // Only sync if node is new or has been updated
            const needsSync = !existing || existing.get('updatedAt') !== node.updatedAt;

            if (needsSync) {
              yNodes.set(id, nodeToYMap(node));
            }
          });

          // Only delete nodes that existed in our previous local state and were explicitly deleted
          Object.keys(prevNodes).forEach((prevId) => {
            if (!nodes[prevId] && yNodes.has(prevId)) {
              yNodes.delete(prevId);
            }
          });
        }, 'local-transaction');
      }
    );

    const unsubscribeRelations = useCanvasStore.subscribe(
      (s) => s.relations,
      (relations, prevRelations = {}) => {
        // CRITICAL: Don't push local state until remote sync is done
        if (isReceivingRemote || !localPushEnabled) return;

        doc.transact(() => {
          Object.entries(relations).forEach(([id, rel]) => {
            const existing = yRelations.get(id);
            if (!existing) {
              yRelations.set(id, relationToYMap(rel));
            } else {
              const currentStyle = existing.get('style');
              const currentLabel = existing.get('label');
              if (currentStyle !== JSON.stringify(rel.style) || currentLabel !== rel.label) {
                yRelations.set(id, relationToYMap(rel));
              }
            }
          });

          // Only delete relations that existed in our previous local state and were explicitly deleted
          Object.keys(prevRelations).forEach((prevId) => {
            if (!relations[prevId] && yRelations.has(prevId)) {
              yRelations.delete(prevId);
            }
          });
        }, 'local-transaction');
      }
    );

    // ─── Cursor Tracking ──────────────────────────────────────────────
    const handlePointerMove = (e: PointerEvent) => {
      const store = useCanvasStore.getState();
      const viewport = store.viewport;
      const rect = document.querySelector('.canvas')?.getBoundingClientRect();
      if (!rect) return;

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

    // ─── Auto-save to IndexedDB ───────────────────────────────────────
    let saveTimeout: number | null = null;
    const saveLocalState = () => {
      if (saveTimeout !== null) window.clearTimeout(saveTimeout);
      saveTimeout = window.setTimeout(() => {
        const store = useCanvasStore.getState();
        setStorageItem(storageKey, {
          nodes: store.nodes,
          relations: store.relations,
          viewport: store.viewport,
          savedAt: Date.now(),
        }).catch((err) => {
          console.warn('Failed to save state to IndexedDB', err);
        });
      }, 400);
    };

    const unsubscribeLocalSave = useCanvasStore.subscribe(saveLocalState);

    return () => {
      window.clearTimeout(connectTimer);
      if (saveTimeout !== null) window.clearTimeout(saveTimeout);
      unsubscribeNodes();
      unsubscribeRelations();
      unsubscribeSelection();
      unsubscribeLocalSave();
      window.removeEventListener('pointermove', handlePointerMove);
      wsProvider.off('status', handleProviderStatus);
      wsProvider.off('sync', handleProviderSync);
      wsProvider.off('connection-error', handleConnectionFailure);
      awareness.off('change', handleAwarenessChange);
      yNodes.unobserve(handleNodesObserve);
      yRelations.unobserve(handleRelationsObserve);
      wsProvider.destroy();
      doc.destroy();
    };
  }, [worldId]);

  return { connected, users, provider };
}
