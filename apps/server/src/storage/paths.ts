import path from 'node:path';
import { promises as fs } from 'node:fs';

export const DATA_DIR = process.env.CANVIO_DATA_DIR || path.resolve(process.cwd(), 'data');

export function safeId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
}

export async function ensureDataDir(...parts: string[]) {
  const dir = path.join(DATA_DIR, ...parts);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
