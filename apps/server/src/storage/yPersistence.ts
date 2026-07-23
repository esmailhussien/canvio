import path from 'node:path';
import { promises as fs } from 'node:fs';
import * as Y from 'yjs';
import { ensureDataDir, safeId } from './paths.js';

type SharedDoc = Y.Doc & {
  name?: string;
};

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

async function writeSnapshot(docName: string, doc: Y.Doc) {
  const update = Y.encodeStateAsUpdate(doc);
  await fs.writeFile(await documentPath(docName), update);
}

export function createFilePersistence() {
  const pendingWrites = new Map<string, NodeJS.Timeout>();

  const scheduleWrite = (docName: string, doc: Y.Doc) => {
    const existing = pendingWrites.get(docName);
    if (existing) clearTimeout(existing);

    pendingWrites.set(docName, setTimeout(() => {
      pendingWrites.delete(docName);
      writeSnapshot(docName, doc).catch((error) => {
        console.error(`Failed to persist Yjs document "${docName}"`, error);
      });
    }, 750));
  };

  return {
    provider: { name: 'file' },
    bindState: async (docName: string, doc: SharedDoc) => {
      const persisted = await readUpdate(docName);
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
      await writeSnapshot(docName, doc);
    },
  };
}
