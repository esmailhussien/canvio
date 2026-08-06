import { getApiBaseUrl, getCanvioApiToken, getCanvioClientId, getCanvioShareToken } from './runtimeConfig';

const API_BASE = getApiBaseUrl();

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

function requestHeaders(json = false) {
  const headers: Record<string, string> = {
    'x-canvio-client-id': getCanvioClientId(),
  };
  const token = getCanvioApiToken();
  const shareToken = getCanvioShareToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (shareToken) headers['x-canvio-share-token'] = shareToken;
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
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

export type AIProvider = 'gemini' | 'openai' | 'anthropic';

export interface AIContextNode {
  id: string;
  type: string;
  text: string;
}

export interface AIContextRelation {
  sourceId: string;
  targetId: string;
  label?: string;
  relationship?: string;
}

export interface RawAIBoardNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  data: Record<string, unknown>;
}

export interface RawAIBoardRelation {
  sourceId: string;
  targetId: string;
  sourcePort?: string;
  targetPort?: string;
  label?: string;
  relationship?: string;
  color?: string;
}

export interface AIBoardResponse {
  source: 'server-ai';
  provider: AIProvider;
  model: string;
  title: string;
  nodes: RawAIBoardNode[];
  relations: RawAIBoardRelation[];
}

export interface AIClusterResponse {
  source: 'server-ai';
  provider: AIProvider;
  model: string;
  clusters: Array<{
    title: string;
    color: string;
    nodeIds: string[];
  }>;
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

export async function createBoard() {
  const response = await fetch(apiUrl('/api/boards'), {
    method: 'POST',
    headers: requestHeaders(),
  });
  if (!response.ok) throw new Error(`Failed to create board: ${response.status}`);
  return response.json() as Promise<BoardRecord>;
}

export async function touchBoard(id: string) {
  const response = await fetch(apiUrl(`/api/boards/${encodeURIComponent(id)}`), {
    headers: requestHeaders(),
  });
  if (!response.ok) throw new Error(`Failed to load board: ${response.status}`);
  return response.json() as Promise<BoardRecord>;
}

export async function updateBoardAppearance(
  id: string,
  appearance: NonNullable<BoardRecord['appearance']>
) {
  const response = await fetch(apiUrl(`/api/boards/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: requestHeaders(true),
    body: JSON.stringify({ appearance }),
  });
  if (!response.ok) throw new Error(`Failed to update board appearance: ${response.status}`);
  return response.json() as Promise<BoardRecord>;
}

export async function createBoardShareLink(id: string) {
  const response = await fetch(apiUrl(`/api/boards/${encodeURIComponent(id)}/share`), {
    method: 'POST',
    headers: requestHeaders(true),
    body: '{}',
  });
  if (!response.ok) throw new Error(`Failed to create share link: ${response.status}`);
  return response.json() as Promise<{ url: string; shareToken: string }>;
}

export async function generateAIBoard(request: {
  prompt: string;
  provider?: AIProvider;
  model?: string;
  context?: { nodes?: AIContextNode[]; relations?: AIContextRelation[] };
}) {
  return postAI<AIBoardResponse>('/api/ai/generate', request);
}

export async function summarizeAIBoard(request: {
  provider?: AIProvider;
  model?: string;
  context?: { nodes?: AIContextNode[]; relations?: AIContextRelation[] };
}) {
  return postAI<AIBoardResponse>('/api/ai/summarize', request);
}

export async function organizeAIClusters(request: {
  provider?: AIProvider;
  model?: string;
  context?: { nodes?: AIContextNode[]; relations?: AIContextRelation[] };
}) {
  return postAI<AIClusterResponse>('/api/ai/organize', request);
}

async function postAI<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: requestHeaders(true),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let code: string | undefined;
    try {
      const errorBody = await response.json() as { error?: string };
      code = errorBody.error;
    } catch {
      code = undefined;
    }
    throw new ApiRequestError(`AI request failed: ${response.status}`, response.status, code);
  }

  return response.json() as Promise<T>;
}
