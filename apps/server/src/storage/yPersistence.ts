import path from 'node:path';
import fsSync, { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import type { Doc } from 'yjs';
import { DATA_DIR, ensureDataDir, safeId, writeFileAtomic } from './paths.js';

// y-websocket's production server utilities load Yjs through CommonJS. Reuse
// that instance so constructor checks and document updates share one runtime.
const require = createRequire(import.meta.url);
const Y = require('yjs') as typeof import('yjs');

export type SharedDoc = Doc & {
  name?: string;
  conns?: Map<unknown, unknown>;
};

export interface FilePersistence {
  provider: { name: string };
  bindState: (docName: string, doc: SharedDoc) => Promise<void>;
  writeState: (docName: string, doc: SharedDoc) => Promise<void>;
  flushAll: () => Promise<void>;
  flushDoc?: (docName: string) => Promise<void>;
  getActiveDocs: () => number;
  getPendingWritesCount: () => number;
}

function documentPathSync(docName: string) {
  const dir = path.join(DATA_DIR, 'ydocs');
  if (!fsSync.existsSync(dir)) {
    fsSync.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, `${safeId(docName)}.bin`);
}

function readUpdateSync(docName: string): Uint8Array | null {
  try {
    const filePath = documentPathSync(docName);
    return fsSync.readFileSync(filePath);
  } catch (error: any) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function documentPath(docName: string) {
  const dir = await ensureDataDir('ydocs');
  return path.join(dir, `${safeId(docName)}.bin`);
}

async function readUpdate(docName: string) {
  try {
    return await fs.readFile(await documentPath(docName));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeSnapshot(docName: string, doc: Doc) {
  const update = Y.encodeStateAsUpdate(doc);
  const targetPath = await documentPath(docName);
  await writeFileAtomic(targetPath, update);
}

/**
 * Copies a persisted Yjs document binary from one board to another.
 * Used during board forking so the fork preserves all canvas content.
 */
export async function copyYDoc(sourceDocName: string, targetDocName: string): Promise<void> {
  const sourcePath = await documentPath(sourceDocName);
  const targetPath = await documentPath(targetDocName);
  const data = await fs.readFile(sourcePath);
  await writeFileAtomic(targetPath, data);
}

export function createFilePersistence(): FilePersistence {
  const pendingWrites = new Map<string, NodeJS.Timeout>();
  const activeDocs = new Map<string, SharedDoc>();
  const inFlightWrites = new Map<string, Promise<void>>();

  // Atomically serialize writes per doc to avoid concurrent write races
  const writeSnapshotSerialized = async (docName: string, doc: Doc): Promise<void> => {
    const previous = inFlightWrites.get(docName) || Promise.resolve();
    const current = previous
      .catch(() => {})
      .then(async () => {
        await writeSnapshot(docName, doc);
      });

    inFlightWrites.set(docName, current);
    try {
      await current;
    } finally {
      if (inFlightWrites.get(docName) === current) {
        inFlightWrites.delete(docName);
      }
    }
  };

  const scheduleWrite = (docName: string, doc: Doc) => {
    const existing = pendingWrites.get(docName);
    if (existing) clearTimeout(existing);

    pendingWrites.set(
      docName,
      setTimeout(() => {
        pendingWrites.delete(docName);
        writeSnapshotSerialized(docName, doc).catch((error) => {
          console.error('Failed to persist Yjs document snapshot', {
            docName: safeId(docName),
            error,
          });
        });
      }, 750)
    );
  };

  return {
    provider: { name: 'file' },

    bindState: async (docName: string, doc: SharedDoc) => {
      // Register doc in active docs map
      activeDocs.set(docName, doc);

      // Clean up tracking when doc is destroyed
      doc.on('destroy', () => {
        activeDocs.delete(docName);
        const pending = pendingWrites.get(docName);
        if (pending) {
          clearTimeout(pending);
          pendingWrites.delete(docName);
        }
      });

      // Synchronously restore on-disk state before getYDoc returns so initial sync frame includes all nodes
      const persisted = readUpdateSync(docName);
      if (persisted) {
        Y.applyUpdate(doc, persisted);
      }

      doc.on('update', () => scheduleWrite(docName, doc));
      scheduleWrite(docName, doc);
    },

    writeState: async (docName: string, doc: SharedDoc) => {
      const pending = pendingWrites.get(docName);
      if (pending) {
        clearTimeout(pending);
        pendingWrites.delete(docName);
      }
      try {
        await writeSnapshotSerialized(docName, doc);
      } catch (error) {
        console.error('Failed to persist Yjs document snapshot on writeState', {
          docName: safeId(docName),
          error,
        });
      }
    },

    flushDoc: async (docName: string) => {
      const pending = pendingWrites.get(docName);
      if (pending) {
        clearTimeout(pending);
        pendingWrites.delete(docName);
      }
      const doc = activeDocs.get(docName);
      if (doc) {
        await writeSnapshotSerialized(docName, doc);
      }
    },

    flushAll: async () => {
      // 1. Clear all pending debounced timers
      for (const [, timer] of pendingWrites) {
        clearTimeout(timer);
      }
      pendingWrites.clear();

      // 2. Flush all active docs in parallel (with per-doc write serialization)
      const tasks = Array.from(activeDocs.entries()).map(async ([docName, doc]) => {
        try {
          await writeSnapshotSerialized(docName, doc);
        } catch (error) {
          console.error('Failed to flush Yjs document snapshot during flushAll', {
            docName: safeId(docName),
            error,
          });
        }
      });

      await Promise.all(tasks);
    },

    getActiveDocs: () => activeDocs.size,
    getPendingWritesCount: () => pendingWrites.size,
  };
}
