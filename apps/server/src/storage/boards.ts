import path from 'node:path';
import { promises as fs } from 'node:fs';
import { ensureDataDir, safeId } from './paths.js';

export interface BoardRecord {
  id: string;
  title: string;
  appearance?: {
    theme?: 'dark' | 'light';
    canvasBackground?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

function boardPath(id: string) {
  return path.join('boards', `${safeId(id)}.json`);
}

async function absoluteBoardPath(id: string) {
  const dir = await ensureDataDir('boards');
  return path.join(dir, `${safeId(id)}.json`);
}

export async function saveBoard(board: BoardRecord) {
  const filePath = await absoluteBoardPath(board.id);
  await fs.writeFile(filePath, JSON.stringify(board, null, 2), 'utf8');
  return board;
}

export async function getBoard(id: string) {
  try {
    const filePath = await absoluteBoardPath(id);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as BoardRecord;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return null;
    throw error;
  }
}

export async function upsertBoard(id: string, title = `Board ${id}`) {
  const existing = await getBoard(id);
  const now = new Date().toISOString();

  if (existing) {
    return saveBoard({ ...existing, updatedAt: now });
  }

  return saveBoard({
    id,
    title,
    createdAt: now,
    updatedAt: now,
  });
}

export async function listBoards() {
  const dir = await ensureDataDir('boards');
  const files = await fs.readdir(dir);
  const boards: BoardRecord[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await fs.readFile(path.join(dir, file), 'utf8');
      boards.push(JSON.parse(content) as BoardRecord);
    } catch {
      // Skip malformed records; a single bad file should not break the API.
    }
  }

  return boards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export { boardPath };
