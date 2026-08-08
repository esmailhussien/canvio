import { promises as fs } from 'node:fs';
import { DATA_DIR, ensureDataDir } from './storage/paths.js';

export async function getReadiness() {
  const boardsDir = await ensureDataDir('boards');
  await fs.access(boardsDir, fs.constants.W_OK);

  return {
    status: 'ready',
    storage: 'ok',
    timestamp: new Date().toISOString(),
    dataDirConfigured: Boolean(DATA_DIR),
  };
}
