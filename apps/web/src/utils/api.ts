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
  ownerId?: string;
  shareToken?: string;
  shareCreatedAt?: string;
  isPublic?: boolean;
  forkedFromId?: string;
  forkedFromTitle?: string;
  forkCount?: number;
  appearance?: {
    theme?: 'dark' | 'light';
    canvasBackground?: string | null;
  };
  createdAt: string;
  updatedAt: string;
  url?: string;
}

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'groq';

export interface AIContextNode {
  id: string;
  type: string;
  text: string;
  title?: string;
  mapPins?: Array<{
    id: string;
    label: string;
    latitude: number;
    longitude: number;
  }>;
}

export interface AIContextRelation {
  sourceId: string;
  targetId: string;
  label?: string;
  relationship?: string;
  sourcePort?: string;
  targetPort?: string;
  sourceLabel?: string;
  targetLabel?: string;
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
  source: 'server-ai' | 'local-fallback';
  provider?: AIProvider;
  model?: string;
  title: string;
  nodes: RawAIBoardNode[];
  relations: RawAIBoardRelation[];
  error?: 'AI_NOT_CONFIGURED' | 'AI_REQUEST_FAILED';
  details?: string;
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

export interface AIGraphInsight {
  id: string;
  type: 'contradiction' | 'missing_evidence' | 'dependency_chain' | 'unanchored_claim' | 'suggestion';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  nodeIds?: string[];
}

export interface AISuggestedRelation {
  sourceId: string;
  targetId: string;
  relationship: string;
  label: string;
  reason?: string;
}

export interface AIGraphAnalysisResponse {
  source: 'server-ai' | 'local-fallback';
  provider?: AIProvider;
  model?: string;
  critique: string;
  healthScore: number;
  insights: AIGraphInsight[];
  suggestedRelations: AISuggestedRelation[];
  error?: 'AI_NOT_CONFIGURED' | 'AI_REQUEST_FAILED';
  details?: string;
}

export interface AIChallengeResponse {
  source: 'server-ai';
  provider: AIProvider;
  model: string;
  challengeSummary: string;
  challenges: Array<{
    targetNodeId: string;
    critique: string;
    counterPerspective: string;
  }>;
  challengerNodes?: RawAIBoardNode[];
  challengerRelations?: RawAIBoardRelation[];
}

export interface AISocraticResponse {
  source: 'server-ai';
  provider: AIProvider;
  model: string;
  inquiryFocus: string;
  questions: Array<{
    id: string;
    question: string;
    relatedNodeIds?: string[];
    learningGoal?: string;
  }>;
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, code?: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function createApiRequestError(response: Response, fallback: string) {
  let body: { error?: string; message?: string; retryAfterSeconds?: number } = {};
  try {
    body = await response.json() as typeof body;
  } catch {
    // Keep the fallback when the upstream returns an empty or non-JSON error.
  }

  return new ApiRequestError(
    body.message || body.error || `${fallback}: ${response.status}`,
    response.status,
    body.error,
    body.retryAfterSeconds,
  );
}

export async function createBoard() {
  const response = await fetch(apiUrl('/api/boards'), {
    method: 'POST',
    headers: requestHeaders(),
  });
  if (!response.ok) throw await createApiRequestError(response, 'Failed to create board');
  return response.json() as Promise<BoardRecord>;
}

export async function forkBoard(id: string) {
  const response = await fetch(apiUrl(`/api/boards/${encodeURIComponent(id)}/fork`), {
    method: 'POST',
    headers: requestHeaders(true),
    body: '{}',
  });
  if (!response.ok) throw await createApiRequestError(response, 'Failed to fork board');
  return response.json() as Promise<BoardRecord>;
}

export async function listPublicBoards() {
  const response = await fetch(apiUrl('/api/boards/public'), {
    headers: requestHeaders(),
  });
  if (!response.ok) throw await createApiRequestError(response, 'Failed to list public boards');
  return response.json() as Promise<{ boards: BoardRecord[] }>;
}

export async function touchBoard(id: string) {
  const response = await fetch(apiUrl(`/api/boards/${encodeURIComponent(id)}`), {
    headers: requestHeaders(),
  });
  if (!response.ok) throw await createApiRequestError(response, 'Failed to load board');
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
  if (!response.ok) throw await createApiRequestError(response, 'Failed to update board appearance');
  return response.json() as Promise<BoardRecord>;
}

export async function updateBoardPublicStatus(id: string, isPublic: boolean) {
  const response = await fetch(apiUrl(`/api/boards/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: requestHeaders(true),
    body: JSON.stringify({ isPublic }),
  });
  if (!response.ok) throw await createApiRequestError(response, 'Failed to update board public status');
  return response.json() as Promise<BoardRecord>;
}

export async function createBoardShareLink(id: string, isPublic = false) {
  const response = await fetch(apiUrl(`/api/boards/${encodeURIComponent(id)}/share`), {
    method: 'POST',
    headers: requestHeaders(true),
    body: JSON.stringify({ isPublic }),
  });
  if (!response.ok) throw await createApiRequestError(response, 'Failed to create share link');
  return response.json() as Promise<{ url: string; shareToken: string; isPublic?: boolean }>;
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
  output?: 'summary' | 'article';
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

export async function analyzeAIGraph(request: {
  provider?: AIProvider;
  model?: string;
  context?: { nodes?: AIContextNode[]; relations?: AIContextRelation[] };
}) {
  return postAI<AIGraphAnalysisResponse>('/api/ai/analyze-graph', request);
}

export async function challengeAIBoard(request: {
  provider?: AIProvider;
  model?: string;
  context?: { nodes?: AIContextNode[]; relations?: AIContextRelation[] };
}) {
  return postAI<AIChallengeResponse>('/api/ai/challenge', request);
}

export async function socraticInquiryAI(request: {
  provider?: AIProvider;
  model?: string;
  context?: { nodes?: AIContextNode[]; relations?: AIContextRelation[] };
}) {
  return postAI<AISocraticResponse>('/api/ai/socratic', request);
}

async function postAI<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: requestHeaders(true),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await createApiRequestError(response, 'AI request failed');
  }

  return response.json() as Promise<T>;
}
