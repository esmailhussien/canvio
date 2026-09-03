import path from 'node:path';
import { promises as fs } from 'node:fs';

export const DATA_DIR = process.env.CANVIO_DATA_DIR || path.resolve(process.cwd(), 'data');

// Only identifiers that are already filesystem-safe pass. Mutating an id into
// a "safe" form (a/b -> a_b) lets distinct boards collide on one file, so we
// reject those instead.
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isSafeBoardId(id: string) {
  return typeof id === 'string' && SAFE_ID_PATTERN.test(id);
}

export function safeId(id: string) {
  if (isSafeBoardId(id)) return id;
  const collapsed = id.replace(/[^A-Za-z0-9_-]/g, '_');
  // Length-cap and suffix so distinct invalid ids cannot collapse together.
  return `${collapsed.slice(0, 48)}_${Math.abs(hashString(id)) % 1_000_000}` || 'default';
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

export async function ensureDataDir(...parts: string[]) {
  const dir = path.join(DATA_DIR, ...parts);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function writeFileAtomic(filePath: string, contents: Uint8Array | string) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await fs.writeFile(tmpPath, contents);
    let attempts = 0;
    while (true) {
      try {
        await fs.rename(tmpPath, filePath);
        break;
      } catch (err: any) {
        attempts++;
        if (attempts >= 20 || (err.code !== 'EPERM' && err.code !== 'EBUSY')) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, 25 * attempts));
      }
    }
  } catch (error) {
    await fs.rm(tmpPath, { force: true }).catch(() => {});
    throw error;
  }
}
