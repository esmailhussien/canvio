import { getApiBaseUrl } from './runtimeConfig';

const API_BASE = getApiBaseUrl();

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export interface BoardRecord {
  id: string;
  title: string;
  appearance?: {
    theme?: 'dark' | 'light';
    canvasBackground?: string | null;
  };
  createdAt: string;
  updatedAt: string;
  url?: string;
}

export async function createBoard() {
  const response = await fetch(apiUrl('/api/boards'), { method: 'POST' });
  if (!response.ok) throw new Error(`Failed to create board: ${response.status}`);
  return response.json() as Promise<BoardRecord>;
}

export async function touchBoard(id: string) {
  const response = await fetch(apiUrl(`/api/boards/${encodeURIComponent(id)}`));
  if (!response.ok) throw new Error(`Failed to load board: ${response.status}`);
  return response.json() as Promise<BoardRecord>;
}

export async function updateBoardAppearance(
  id: string,
  appearance: NonNullable<BoardRecord['appearance']>
) {
  const response = await fetch(apiUrl(`/api/boards/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appearance }),
  });
  if (!response.ok) throw new Error(`Failed to update board appearance: ${response.status}`);
  return response.json() as Promise<BoardRecord>;
}
