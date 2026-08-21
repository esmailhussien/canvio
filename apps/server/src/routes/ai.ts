import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createAuthHook, createRateLimitHook, readPositiveIntEnv } from '../security.js';

type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'groq';
type RelationshipType = 'related_to' | 'leads_to' | 'based_on' | 'part_of' | 'depends_on' | 'contradicts' | 'enables' | 'explains' | 'causes' | 'example_of' | 'mitigates' | 'inspired_by' | 'same_as' | 'custom';
export type AIErrorCode =
  | 'AI_NOT_CONFIGURED'
  | 'AI_QUOTA_EXCEEDED'
  | 'AI_RATE_LIMITED'
  | 'AI_MODEL_UNAVAILABLE'
  | 'AI_TIMEOUT'
  | 'AI_INVALID_RESPONSE'
  | 'AI_REQUEST_FAILED';

interface AIContextNode {
  id?: string;
  type?: string;
  text?: string;
  title?: string;
  mapPins?: Array<{
    id?: string;
    label?: string;
    latitude?: number;
    longitude?: number;
  }>;
}

interface AIContextRelation {
  sourceId?: string;
  targetId?: string;
  label?: string;
  relationship?: string;
  sourcePort?: string;
  targetPort?: string;
  sourceLabel?: string;
  targetLabel?: string;
}

interface AIRequestBody {
  prompt?: string;
  provider?: AIProvider;
  model?: string;
  output?: 'summary' | 'article';
  context?: {
    nodes?: AIContextNode[];
    relations?: AIContextRelation[];
  };
}

interface AIStatusQuery {
  provider?: string;
}

interface RawAINode {
  id?: unknown;
  type?: unknown;
  position?: unknown;
  size?: unknown;
  data?: unknown;
}

interface RawAIRelation {
  sourceId?: unknown;
  targetId?: unknown;
  label?: unknown;
  relationship?: unknown;
  color?: unknown;
  sourcePort?: unknown;
  targetPort?: unknown;
}

const PROVIDERS: AIProvider[] = ['gemini', 'openai', 'anthropic', 'groq'];
const RELATIONSHIPS: RelationshipType[] = ['related_to', 'leads_to', 'based_on', 'part_of', 'depends_on', 'contradicts', 'enables', 'explains', 'causes', 'example_of', 'mitigates', 'inspired_by'];
const NODE_TYPES = ['sticky', 'shape', 'text', 'frame'];
const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';
const GROQ_PREFERRED_MODELS = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'qwen/qwen3-32b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
];

let groqModelsCache: { expiresAt: number; ids: string[] } | null = null;
let groqWorkingModelCache: { expiresAt: number; model: string } | null = null;

export async function aiRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', createRateLimitHook({
    namespace: 'ai',
    windowMs: readPositiveIntEnv('CANVIO_AI_RATE_WINDOW_MS', 60000, 1000, 3_600_000),
    max: readPositiveIntEnv('CANVIO_AI_RATE_LIMIT', 20, 1, 1_000),
  }));
  fastify.addHook('onRequest', createAuthHook({ requiredEnv: 'CANVIO_REQUIRE_AI_AUTH' }));

  fastify.get('/status', async (request: FastifyRequest<{ Querystring: AIStatusQuery }>) => {
    const primaryProvider = resolveProvider(request.query?.provider);
    const fallbackProvider = resolveFallbackProvider(primaryProvider);

    return {
      status: 'ok',
      primary: providerStatus(primaryProvider),
      fallback: fallbackProvider !== primaryProvider ? providerStatus(fallbackProvider) : null,
      availableProviders: PROVIDERS.map(providerStatus),
    };
  });

  fastify.post('/generate', async (request: FastifyRequest<{ Body: AIRequestBody }>, reply: FastifyReply) => {
    const prompt = cleanText(request.body?.prompt, 4000);
    if (!prompt) return reply.code(400).send({ error: 'Prompt is required' });

    const primaryProvider = resolveProvider(request.body?.provider);
    const systemPrompt = buildBoardSystemPrompt();
    const userPrompt = `User request:\n${prompt}\n\n${buildGraphContext(request.body?.context)}`;

    try {
      const { parsed, provider, model } = await callAIWithFallback(primaryProvider, request.body?.model, systemPrompt, userPrompt);
      return {
        source: 'server-ai',
        provider,
        model,
        ...normalizeBoardPayload(parsed, prompt),
      };
    } catch (err: any) {
      const failure = createAIFailureResponse(primaryProvider, request.body?.model, err);
      fastify.log.error({ err, error: failure.error }, 'AI board generation failed');
      return reply.send({
        ...failure,
        title: '',
        nodes: [],
        relations: [],
      });
    }
  });

  fastify.post('/summarize', async (request: FastifyRequest<{ Body: AIRequestBody }>, reply: FastifyReply) => {
    const primaryProvider = resolveProvider(request.body?.provider);
    const output = request.body?.output === 'article' ? 'article' : 'summary';
    const systemPrompt = buildBoardSystemPrompt();
    const userPrompt = output === 'article'
      ? [
        'Turn this completed Canvio whiteboard into a polished, editable article draft.',
        'Create one page-like frame, a text title, and 4 to 7 readable text sections: introduction, main ideas, how the ideas connect, evidence or examples, implications or next steps, and conclusion when supported.',
        'Use only information present in the board. Do not invent facts. Translate relation labels and types into clear prose about evidence, dependency, contradiction, sequence, and exact map locations.',
        'Use text nodes for article sections, keep each section concise enough to fit, and arrange them vertically inside the frame with generous spacing.',
        buildGraphContext(request.body?.context),
      ].join('\n\n')
      : [
        'Analyze this completed Canvio whiteboard graph and create a concise visual summary board.',
        'The summary must include: core idea, key points, meaningful connections, risks or open questions, and next actions when supported by the board.',
        'Use the relation labels and relationship types to infer importance, dependencies, contradictions, flow, and exact map locations. Do not invent facts.',
        buildGraphContext(request.body?.context),
      ].join('\n\n');

    try {
      const { parsed, provider, model } = await callAIWithFallback(primaryProvider, request.body?.model, systemPrompt, userPrompt);
      return {
        source: 'server-ai',
        provider,
        model,
        ...normalizeBoardPayload(parsed, output === 'article' ? 'Board article draft' : 'Board summary'),
      };
    } catch (err: any) {
      const failure = createAIFailureResponse(primaryProvider, request.body?.model, err);
      fastify.log.error({ err, error: failure.error }, 'AI summarize failed');
      return reply.send({
        ...failure,
        title: '',
        nodes: [],
        relations: [],
      });
    }
  });

  fastify.post('/organize', async (request: FastifyRequest<{ Body: AIRequestBody }>, reply: FastifyReply) => {
    const primaryProvider = resolveProvider(request.body?.provider);
    const nodes = (request.body?.context?.nodes || []).slice(0, 80);
    if (nodes.length === 0) return { source: 'server-ai', clusters: [] };

    const systemPrompt = `You are Canvio Spatial AI. Cluster whiteboard nodes into 2 to 5 useful groups.
Return ONLY raw JSON:
{
  "clusters": [
    { "title": "Cluster title", "color": "#6366f1", "nodeIds": ["node-id"] }
  ]
}
Every input node id should appear in exactly one cluster when possible.`;
    const userPrompt = buildGraphContext(request.body?.context);

    try {
      const { parsed, provider, model } = await callAIWithFallback(primaryProvider, request.body?.model, systemPrompt, userPrompt);
      return {
        source: 'server-ai',
        provider,
        model,
        clusters: normalizeClusters(parsed, nodes),
      };
    } catch (err: any) {
      const failure = createAIFailureResponse(primaryProvider, request.body?.model, err);
      fastify.log.warn({ err, error: failure.error }, 'AI organize unavailable; client should use local clustering');
      return reply.send({
        ...failure,
        clusters: [],
      });
    }
  });

  fastify.post('/analyze-graph', async (request: FastifyRequest<{ Body: AIRequestBody }>, reply: FastifyReply) => {
    const primaryProvider = resolveProvider(request.body?.provider);
    const systemPrompt = `You are the Canvio Visual Reasoning Engine & Thinking Partner.
Your goal is to critically evaluate the user's spatial knowledge graph, analyze their mental model, identify logical inconsistencies or contradictions, find missing evidentiary links, and suggest high-value connections.
Return ONLY raw JSON with this exact schema:
{
  "critique": "A sharp, 2-3 sentence executive synthesis of the user's reasoning strengths and vulnerability points.",
  "healthScore": 85,
  "insights": [
    {
      "id": "insight_1",
      "type": "contradiction", // one of: contradiction, missing_evidence, dependency_chain, unanchored_claim, suggestion
      "severity": "critical", // one of: info, warning, critical
      "title": "Short punchy title",
      "description": "Concrete explanation of why this reasoning needs attention.",
      "nodeIds": ["node-id-1", "node-id-2"]
    }
  ],
  "suggestedRelations": [
    {
      "sourceId": "node-id-1",
      "targetId": "node-id-2",
      "relationship": "depends_on", // one of: depends_on, leads_to, enables, based_on, contradicts, part_of
      "label": "logical bridge label",
      "reason": "Why this connection strengthens the mental model"
    }
  ]
}`;

    const userPrompt = [
      'Analyze this spatial knowledge graph:',
      buildGraphContext(request.body?.context),
    ].join('\n\n');

    try {
      const { parsed, provider, model } = await callAIWithFallback(primaryProvider, request.body?.model, systemPrompt, userPrompt);
      return {
        source: 'server-ai',
        provider,
        model,
        ...parsed,
      };
    } catch (err: any) {
      const failure = createAIFailureResponse(primaryProvider, request.body?.model, err);
      fastify.log.warn({ err, error: failure.error }, 'AI graph analysis unavailable; client should use local reasoning fallback');
      return reply.send({
        ...failure,
        critique: '',
        healthScore: 0,
        insights: [],
        suggestedRelations: [],
      });
    }
  });

  fastify.post('/challenge', async (request: FastifyRequest<{ Body: AIRequestBody }>, reply: FastifyReply) => {
    const primaryProvider = resolveProvider(request.body?.provider);
    const systemPrompt = `You are a Socratic Thinking Partner and Devil's Advocate for Canvio.
Your job is NOT to blindly agree with the user's board, but to constructively stress-test their assumptions, expose blindspots, and provide steelmanned counter-arguments.
Return ONLY raw JSON with this schema:
{
  "challengeSummary": "Sharp overview of what assumptions the board is taking for granted.",
  "challenges": [
    {
      "targetNodeId": "node-id",
      "critique": "What assumption is vulnerable here?",
      "counterPerspective": "Alternative hypothesis or contrary evidence to consider."
    }
  ],
  "challengerNodes": [
    {
      "id": "challenger_1",
      "type": "sticky",
      "position": { "x": 100, "y": 100 },
      "size": { "width": 260, "height": 140 },
      "data": {
        "color": "pink",
        "text": "Counter-Hypothesis or Risk: ..."
      }
    }
  ],
  "challengerRelations": [
    {
      "sourceId": "challenger_1",
      "targetId": "target_node_id",
      "relationship": "contradicts",
      "label": "conflicts with"
    }
  ]
}`;

    const userPrompt = [
      'Stress-test and challenge this board reasoning:',
      buildGraphContext(request.body?.context),
    ].join('\n\n');

    try {
      const { parsed, provider, model } = await callAIWithFallback(primaryProvider, request.body?.model, systemPrompt, userPrompt);
      return {
        source: 'server-ai',
        provider,
        model,
        ...parsed,
      };
    } catch (err: any) {
      const failure = createAIFailureResponse(primaryProvider, request.body?.model, err);
      fastify.log.warn({ err, error: failure.error }, 'AI challenge unavailable; client should use local challenge fallback');
      return reply.send({
        ...failure,
        challengeSummary: '',
        challenges: [],
        challengerNodes: [],
        challengerRelations: [],
      });
    }
  });

  fastify.post('/socratic', async (request: FastifyRequest<{ Body: AIRequestBody }>, reply: FastifyReply) => {
    const primaryProvider = resolveProvider(request.body?.provider);
    const systemPrompt = `You are a Socratic Inquirer for Canvio, assisting the user in learning and reasoning through mental model construction.
Instead of giving direct answers or lecturing, formulate 3-5 deep, probing questions about the connections, causality, and mechanisms on their board.
Return ONLY raw JSON:
{
  "inquiryFocus": "Main theme being examined",
  "questions": [
    {
      "id": "q1",
      "question": "What causal mechanism connects Node A to Node B?",
      "relatedNodeIds": ["id1", "id2"],
      "learningGoal": "Understand mechanism vs mere correlation"
    }
  ]
}`;

    const userPrompt = [
      'Generate Socratic questions for active learning on this board:',
      buildGraphContext(request.body?.context),
    ].join('\n\n');

    try {
      const { parsed, provider, model } = await callAIWithFallback(primaryProvider, request.body?.model, systemPrompt, userPrompt);
      return {
        source: 'server-ai',
        provider,
        model,
        ...parsed,
      };
    } catch (err: any) {
      const failure = createAIFailureResponse(primaryProvider, request.body?.model, err);
      fastify.log.warn({ err, error: failure.error }, 'AI socratic unavailable; client should use local Socratic fallback');
      return reply.send({
        ...failure,
        inquiryFocus: '',
        questions: [],
      });
    }
  });
}

function createAIFailureResponse(primaryProvider: AIProvider, requestedModel: string | undefined, error: unknown) {
  const failure = classifyAIError(error);
  return {
    source: 'local-fallback' as const,
    provider: primaryProvider,
    model: resolveModel(primaryProvider, requestedModel),
    ...failure,
    details: sanitizeAIErrorDetails(error),
  };
}

export function classifyAIError(error: unknown): { error: AIErrorCode; message: string; retryAfterSeconds?: number } {
  const rawMessage = getErrorMessage(error);
  const message = rawMessage.toLowerCase();
  const retryAfterSeconds = parseRetryAfterSeconds(rawMessage);

  if (/ai_not_configured|not configured|missing api key|api key is required|no api key/.test(message)) {
    return {
      error: 'AI_NOT_CONFIGURED',
      message: 'Server AI is not configured yet, so Canvio used local smart mode.',
    };
  }

  if (/quota|resource_exhausted|insufficient_quota|billing|current plan/.test(message)) {
    return {
      error: 'AI_QUOTA_EXCEEDED',
      message: retryAfterSeconds
        ? `AI quota is temporarily exhausted. Canvio used local smart mode; try server AI again in about ${retryAfterSeconds}s.`
        : 'AI quota is temporarily exhausted. Canvio used local smart mode.',
      retryAfterSeconds,
    };
  }

  if (/429|rate.?limit|too many requests|retry after|retry in/.test(message)) {
    return {
      error: 'AI_RATE_LIMITED',
      message: retryAfterSeconds
        ? `AI is busy right now. Canvio used local smart mode; try again in about ${retryAfterSeconds}s.`
        : 'AI is busy right now. Canvio used local smart mode.',
      retryAfterSeconds,
    };
  }

  if (/model_not_found|model .*does not exist|does not exist|do not have access|model.*not.*found|invalid_model/.test(message)) {
    return {
      error: 'AI_MODEL_UNAVAILABLE',
      message: 'The configured AI model is unavailable. Canvio used local smart mode while the model setting is updated.',
    };
  }

  if (/timeout|timed out|abort|econnreset|etimedout|network/.test(message)) {
    return {
      error: 'AI_TIMEOUT',
      message: 'AI took too long to respond. Canvio used local smart mode so you can keep working.',
    };
  }

  if (/invalid json|malformed json|expected ','|expected property|json repair|returned invalid/.test(message)) {
    return {
      error: 'AI_INVALID_RESPONSE',
      message: 'AI returned an unreadable response. Canvio used local smart mode instead.',
    };
  }

  return {
    error: 'AI_REQUEST_FAILED',
    message: 'Server AI was unavailable. Canvio used local smart mode instead.',
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function parseRetryAfterSeconds(message: string) {
  const retryIn = message.match(/retry\s+in\s+(\d+(?:\.\d+)?)\s*s/i);
  if (retryIn?.[1]) return Math.max(1, Math.ceil(Number(retryIn[1])));

  const retryDelay = message.match(/"retryDelay"\s*:\s*"(\d+)s"/i) || message.match(/retryDelay[^0-9]+(\d+)s/i);
  if (retryDelay?.[1]) return Math.max(1, Number(retryDelay[1]));

  return undefined;
}

function sanitizeAIErrorDetails(error: unknown) {
  return getErrorMessage(error).replace(/\s+/g, ' ').trim().slice(0, 700);
}

function resolveProvider(provider?: string): AIProvider {
  if (provider && PROVIDERS.includes(provider as AIProvider)) return provider as AIProvider;
  const envProvider = process.env.CANVIO_AI_PROVIDER;
  return PROVIDERS.includes(envProvider as AIProvider) ? envProvider as AIProvider : 'groq';
}

function resolveFallbackProvider(primaryProvider: AIProvider): AIProvider {
  const defaultFallback: AIProvider = primaryProvider === 'groq' ? 'gemini' : 'groq';
  const configuredFallback = process.env.CANVIO_AI_FALLBACK_PROVIDER as AIProvider | undefined;
  return configuredFallback && PROVIDERS.includes(configuredFallback) ? configuredFallback : defaultFallback;
}

function providerStatus(provider: AIProvider) {
  return {
    provider,
    configured: Boolean(resolveApiKey(provider)),
    model: resolveModel(provider, undefined),
  };
}

function resolveModel(provider: AIProvider, model?: string) {
  const cleaned = cleanText(model, 80);
  if (provider === 'groq') return cleaned || process.env.CANVIO_GROQ_MODEL || DEFAULT_GROQ_MODEL;
  if (provider === 'openai') return cleaned || process.env.CANVIO_OPENAI_MODEL || 'gpt-4o-mini';
  if (provider === 'anthropic') return cleaned || process.env.CANVIO_ANTHROPIC_MODEL || 'claude-3-5-sonnet';

  // Keep the browser on the configured Gemini model. This prevents an anonymous
  // caller from switching a free-tier deployment to a more expensive model.
  const configuredModel = cleanText(process.env.CANVIO_GEMINI_MODEL, 80) || DEFAULT_GEMINI_MODEL;
  return cleaned === configuredModel ? cleaned : configuredModel;
}

function resolveApiKey(provider: AIProvider) {
  if (provider === 'groq') return process.env.CANVIO_GROQ_API_KEY || process.env.GROQ_API_KEY || '';
  if (provider === 'openai') return process.env.CANVIO_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
  if (provider === 'anthropic') return process.env.CANVIO_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  return process.env.CANVIO_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
}

async function callAIWithFallback(
  primaryProvider: AIProvider,
  requestedModel: string | undefined,
  systemPrompt: string,
  userPrompt: string
): Promise<{ parsed: any; provider: AIProvider; model: string }> {
  const candidateProviders: AIProvider[] = [primaryProvider];
  const configuredFallback = resolveFallbackProvider(primaryProvider);

  if (!candidateProviders.includes(configuredFallback)) {
    candidateProviders.push(configuredFallback);
  }

  // Also try any other provider with a valid key as a second safety net
  for (const p of PROVIDERS) {
    if (!candidateProviders.includes(p) && resolveApiKey(p)) {
      candidateProviders.push(p);
    }
  }

  let lastError: Error | null = null;
  const providerErrors: string[] = [];
  for (const prov of candidateProviders) {
    const key = resolveApiKey(prov);
    if (!key) continue;

    const requestedProviderModel = prov === primaryProvider ? requestedModel : undefined;
    let mod = resolveModel(prov, requestedProviderModel);
    const cachedGroqModel = prov === 'groq' && !requestedProviderModel ? getCachedWorkingGroqModel() : null;
    if (cachedGroqModel) {
      mod = cachedGroqModel;
    }

    try {
      const parsed = await callProviderForJson(prov, key, mod, systemPrompt, userPrompt);
      rememberSuccessfulProviderModel(prov, mod);
      return { parsed, provider: prov, model: mod };
    } catch (err: any) {
      console.warn(`[Canvio AI Fallback Agent] Provider "${prov}" failed:`, err?.message || err);
      lastError = err instanceof Error ? err : new Error(String(err));
      providerErrors.push(formatProviderFailure(prov, mod, lastError));

      if (prov === 'groq' && isModelUnavailableError(lastError)) {
        const attemptedGroqModels = new Set<string>([mod]);

        if (mod !== DEFAULT_GROQ_MODEL) {
          try {
            console.warn(`[Canvio AI Fallback Agent] Retrying Groq with default model "${DEFAULT_GROQ_MODEL}".`);
            const parsed = await callProviderForJson(prov, key, DEFAULT_GROQ_MODEL, systemPrompt, userPrompt);
            rememberSuccessfulProviderModel(prov, DEFAULT_GROQ_MODEL);
            return { parsed, provider: prov, model: DEFAULT_GROQ_MODEL };
          } catch (fallbackErr: any) {
            console.warn(`[Canvio AI Fallback Agent] Groq default model "${DEFAULT_GROQ_MODEL}" failed:`, fallbackErr?.message || fallbackErr);
            lastError = fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr));
            attemptedGroqModels.add(DEFAULT_GROQ_MODEL);
            providerErrors.push(formatProviderFailure(prov, DEFAULT_GROQ_MODEL, lastError));
          }
        }

        if (isModelUnavailableError(lastError)) {
          const accessibleModel = await resolveAccessibleGroqModel(key, attemptedGroqModels);
          if (accessibleModel) {
            try {
              console.warn(`[Canvio AI Fallback Agent] Retrying Groq with discovered model "${accessibleModel}".`);
              const parsed = await callProviderForJson(prov, key, accessibleModel, systemPrompt, userPrompt);
              rememberSuccessfulProviderModel(prov, accessibleModel);
              return { parsed, provider: prov, model: accessibleModel };
            } catch (discoveredErr: any) {
              console.warn(`[Canvio AI Fallback Agent] Groq discovered model "${accessibleModel}" failed:`, discoveredErr?.message || discoveredErr);
              lastError = discoveredErr instanceof Error ? discoveredErr : new Error(String(discoveredErr));
              providerErrors.push(formatProviderFailure(prov, accessibleModel, lastError));
            }
          }
        }
      }
    }
  }

  if (providerErrors.length > 0) {
    throw new Error(`AI_REQUEST_FAILED: ${providerErrors.join(' | ')}`);
  }

  throw lastError || new Error('AI_NOT_CONFIGURED');
}

function isModelUnavailableError(error: Error) {
  return /model_not_found|does not exist|do not have access/i.test(error.message);
}

function getCachedWorkingGroqModel() {
  if (!groqWorkingModelCache || groqWorkingModelCache.expiresAt <= Date.now()) {
    return null;
  }

  return groqWorkingModelCache.model;
}

function rememberSuccessfulProviderModel(provider: AIProvider, model: string) {
  if (provider !== 'groq') return;
  groqWorkingModelCache = { model, expiresAt: Date.now() + 60 * 60 * 1000 };
}

async function resolveAccessibleGroqModel(apiKey: string, attemptedModels: Set<string>) {
  const modelIds = await fetchGroqModelIds(apiKey);
  if (modelIds.length === 0) return null;

  const preferred = GROQ_PREFERRED_MODELS.find((id) => modelIds.includes(id) && !attemptedModels.has(id));
  if (preferred) return preferred;

  return modelIds.find((id) => {
    const lowered = id.toLowerCase();
    return (
      !attemptedModels.has(id) &&
      !lowered.includes('whisper') &&
      !lowered.includes('tts') &&
      !lowered.includes('guard') &&
      !lowered.includes('embed')
    );
  }) || null;
}

async function fetchGroqModelIds(apiKey: string) {
  if (groqModelsCache && groqModelsCache.expiresAt > Date.now()) {
    return groqModelsCache.ids;
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.warn(`[Canvio AI Fallback Agent] Could not list Groq models: HTTP ${response.status}: ${errBody}`);
      return [];
    }

    const payload = await response.json() as { data?: Array<{ id?: unknown }> };
    const ids = (payload.data || [])
      .map((model) => cleanText(model.id, 120))
      .filter(Boolean);
    groqModelsCache = { ids, expiresAt: Date.now() + 10 * 60 * 1000 };
    return ids;
  } catch (err: any) {
    console.warn('[Canvio AI Fallback Agent] Could not list Groq models:', err?.message || err);
    return [];
  }
}

function formatProviderFailure(provider: AIProvider, model: string, error: Error) {
  const message = error.message.replace(/\s+/g, ' ').trim().slice(0, 700);
  return `${provider}:${model}: ${message}`;
}

function buildBoardSystemPrompt() {
  return `You are Spatial AI for Canvio, an infinite canvas visual thinking & knowledge workspace.
Your mission is to generate deep, highly useful, structured spatial knowledge graphs.
Avoid generic meta-placeholders (never write "Add your idea here" or "Worked example placeholder"). Instead, ALWAYS write real, concrete, high-value subject matter content: actual rules, formulas, realistic code/grammar examples, pitfalls, and actionable takeaways.

Content Guidelines:
1. For Educational/Language/Math topics: Provide the real grammatical or mathematical formulas (e.g. "If + Present Simple, will + Verb"), real-world example sentences, common pitfalls to avoid (e.g. "❌ Incorrect vs ✅ Correct"), and a quick practice quiz node.
2. For Engineering/System topics: Include actual architecture components, protocols, data flows, and failure modes.
3. For Business/Strategy topics: Provide concrete metrics, risks, competitive moats, and next milestones.

Spatial & Graph Rules:
- Relations are first-class: Use descriptive labels on arrows (e.g., "satisfies", "causes", "transforms into", "example of").
- Use visual variety: Place a central theme in a Shape (hexagon/rectangle), group topics logically with clear X/Y spacing (horizontal offset ~300px, vertical offset ~180px), use colored Stickies for sub-points, and put everything inside an overarching Frame.

Return ONLY raw JSON with this exact schema:
{
  "title": "Short descriptive board title",
  "nodes": [
    {
      "id": "node_1",
      "type": "sticky", // 'sticky' | 'shape' | 'text' | 'frame'
      "position": { "x": 0, "y": 0 },
      "size": { "width": 260, "height": 140 },
      "data": {
        "title": "Node title (for frames)",
        "color": "blue", // 'blue' | 'yellow' | 'green' | 'pink' | 'orange' | 'purple'
        "text": "Detailed content with real rules & examples",
        "label": "Shape label",
        "shape": "rectangle" // 'rectangle' | 'circle' | 'diamond' | 'hexagon'
      }
    }
  ],
  "relations": [
    {
      "sourceId": "node_1",
      "targetId": "node_2",
      "label": "descriptive relation label",
      "relationship": "leads_to", // 'depends_on' | 'leads_to' | 'enables' | 'based_on' | 'contradicts' | 'part_of' | 'explains' | 'causes' | 'example_of' | 'mitigates' | 'related_to'
      "color": "#6366f1"
    }
  ]
}
Allowed node types: sticky, shape, text, frame.
Allowed sticky colors: blue (rules/concepts), green (examples/success), yellow (warm-up/overview), pink (pitfalls/risks), purple (exercises/deep dive), orange (actions/next steps).
Keep the board focused, highly readable, visually clean, and typically between 5 to 14 nodes.`;
}

function buildGraphContext(context?: AIRequestBody['context']) {
  const nodes = (context?.nodes || []).slice(0, 80);
  const relations = (context?.relations || []).slice(0, 120);
  const nodeLines = nodes.map((node) => {
    const id = cleanText(node.id, 80) || 'unknown';
    const type = cleanText(node.type, 30) || 'node';
    const text = cleanText(node.text, 240) || '(empty)';
    const title = cleanText(node.title, 120);
    const pins = Array.isArray(node.mapPins)
      ? node.mapPins.slice(0, 40).map((pin) => {
        const pinId = cleanText(pin.id, 80) || 'unknown-pin';
        const label = cleanText(pin.label, 100) || 'Unnamed pin';
        const latitude = typeof pin.latitude === 'number' ? pin.latitude.toFixed(5) : '?';
        const longitude = typeof pin.longitude === 'number' ? pin.longitude.toFixed(5) : '?';
        return `${label} [${pinId} @ ${latitude}, ${longitude}]`;
      }).join('; ')
      : '';
    return `- ${title || id} (${id}) [${type}]: ${text}${pins ? ` | map pins: ${pins}` : ''}`;
  });
  const relationLines = relations.map((relation) => {
    const sourceId = cleanText(relation.sourceId, 80) || 'unknown';
    const targetId = cleanText(relation.targetId, 80) || 'unknown';
    const label = cleanText(relation.label, 120) || cleanText(relation.relationship, 80) || 'related';
    const source = cleanText(relation.sourceLabel, 120) || sourceId;
    const target = cleanText(relation.targetLabel, 120) || targetId;
    const sourcePort = cleanText(relation.sourcePort, 60);
    const targetPort = cleanText(relation.targetPort, 60);
    const relationship = cleanText(relation.relationship, 80) || 'related_to';
    return `- ${source} (${sourceId})${sourcePort ? ` [${sourcePort}]` : ''} --${label} / ${relationship}--> ${target} (${targetId})${targetPort ? ` [${targetPort}]` : ''}`;
  });

  return [
    'Existing board nodes:',
    nodeLines.length > 0 ? nodeLines.join('\n') : '- none',
    'Existing board relations:',
    relationLines.length > 0 ? relationLines.join('\n') : '- none',
    'Interpretation rule: a relation endpoint with [marker:<id>] refers to one specific map pin. Do not collapse it into a generic map-to-map connection.',
  ].join('\n');
}

async function callProviderForJson(provider: AIProvider, apiKey: string, model: string, systemPrompt: string, userPrompt: string) {
  let text = '';

  if (provider === 'openai' || provider === 'groq') {
    const endpoint = getOpenAICompatibleEndpoint(provider);
    const jsonSystemPrompt = `${stripJsonLineComments(systemPrompt)}\n\nReturn one valid JSON object only. Do not include markdown, comments, trailing commas, or prose outside JSON.`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: jsonSystemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 3500,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`${provider.toUpperCase()} API HTTP ${response.status}: ${errBody}`);
    }
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    text = data.choices?.[0]?.message?.content || '';
  } else if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 3500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Anthropic API HTTP ${response.status}: ${errBody}`);
    }
    const data = await response.json() as { content?: Array<{ text?: string }> };
    text = data.content?.[0]?.text || '';
  } else {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }, { text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
        },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Gemini API HTTP ${response.status}: ${errBody}`);
    }
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  try {
    return parseProviderJson(text, provider, model);
  } catch (err) {
    if (provider !== 'openai' && provider !== 'groq') throw err;

    console.warn(`[Canvio AI Fallback Agent] Provider "${provider}" returned malformed JSON; attempting same-provider repair.`);
    const repairedText = await repairOpenAICompatibleJson(provider, apiKey, model, text);
    return parseProviderJson(repairedText, provider, `${model}:repair`);
  }
}

function getOpenAICompatibleEndpoint(provider: AIProvider) {
  return provider === 'groq'
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
}

async function repairOpenAICompatibleJson(provider: AIProvider, apiKey: string, model: string, rawText: string) {
  const response = await fetch(getOpenAICompatibleEndpoint(provider), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You repair malformed JSON. Return exactly one valid JSON object. Preserve the original keys and useful content. Do not include markdown or explanations.',
        },
        {
          role: 'user',
          content: rawText.slice(0, 12000),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 3500,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`${provider.toUpperCase()} JSON repair HTTP ${response.status}: ${errBody}`);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content || '';
}

function normalizeBoardPayload(raw: unknown, fallbackTitle: string) {
  const payload = raw && typeof raw === 'object' ? raw as { title?: unknown; nodes?: unknown; relations?: unknown } : {};
  const rawNodes = Array.isArray(payload.nodes) ? payload.nodes.slice(0, 24) as RawAINode[] : [];
  const safeOriginalIds = new Set<string>();
  const nodes = rawNodes.map((node, index) => {
    const originalId = cleanText(node.id, 80) || `node_${index + 1}`;
    safeOriginalIds.add(originalId);
    return {
      id: originalId,
      type: NODE_TYPES.includes(String(node.type)) ? String(node.type) : 'sticky',
      position: normalizePoint(node.position, { x: (index % 4) * 300, y: Math.floor(index / 4) * 190 }),
      size: normalizeSize(node.size, { width: 260, height: 140 }),
      data: normalizeNodeData(node.data),
    };
  });

  const relations = (Array.isArray(payload.relations) ? payload.relations as RawAIRelation[] : [])
    .slice(0, 40)
    .filter((relation) => safeOriginalIds.has(cleanText(relation.sourceId, 80)) && safeOriginalIds.has(cleanText(relation.targetId, 80)))
    .map((relation) => ({
      sourceId: cleanText(relation.sourceId, 80),
      targetId: cleanText(relation.targetId, 80),
      sourcePort: cleanText(relation.sourcePort, 40) || undefined,
      targetPort: cleanText(relation.targetPort, 40) || undefined,
      label: cleanText(relation.label, 80) || 'relates to',
      relationship: normalizeRelationship(relation.relationship),
      color: normalizeColor(relation.color),
    }));

  return {
    title: cleanText(payload.title, 80) || `AI Board: ${fallbackTitle.slice(0, 32)}`,
    nodes,
    relations,
  };
}

function normalizeClusters(raw: unknown, nodes: AIContextNode[]) {
  const knownIds = new Set(nodes.map((node) => cleanText(node.id, 80)).filter(Boolean));
  const payload = raw && typeof raw === 'object' ? raw as { clusters?: unknown } : {};
  const rawClusters = Array.isArray(payload.clusters) ? payload.clusters.slice(0, 5) as Array<Record<string, unknown>> : [];
  const assigned = new Set<string>();

  const clusters = rawClusters.map((cluster, index) => {
    const nodeIds = Array.isArray(cluster.nodeIds)
      ? cluster.nodeIds.map((id) => cleanText(id, 80)).filter((id) => knownIds.has(id) && !assigned.has(id))
      : [];
    nodeIds.forEach((id) => assigned.add(id));
    return {
      title: cleanText(cluster.title, 60) || `Cluster ${index + 1}`,
      color: normalizeColor(cluster.color),
      nodeIds,
    };
  }).filter((cluster) => cluster.nodeIds.length > 0);

  const unassigned = [...knownIds].filter((id) => !assigned.has(id));
  if (unassigned.length > 0) {
    clusters.push({ title: 'Other', color: '#6366f1', nodeIds: unassigned });
  }

  return clusters;
}

function normalizeNodeData(data: unknown) {
  const value = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  return {
    title: cleanText(value.title, 80),
    color: normalizeStickyColor(value.color),
    text: cleanText(value.text, 420),
    label: cleanText(value.label, 120),
    shape: normalizeShape(value.shape),
    fill: cleanText(value.fill, 80) || 'rgba(128, 131, 255, 0.12)',
    stroke: normalizeColor(value.stroke),
  };
}

function normalizePoint(value: unknown, fallback: { x: number; y: number }) {
  const point = value as { x?: unknown; y?: unknown };
  return {
    x: clampNumber(point?.x, -8000, 8000, fallback.x),
    y: clampNumber(point?.y, -8000, 8000, fallback.y),
  };
}

function normalizeSize(value: unknown, fallback: { width: number; height: number }) {
  const size = value as { width?: unknown; height?: unknown };
  return {
    width: clampNumber(size?.width, 120, 1400, fallback.width),
    height: clampNumber(size?.height, 70, 1000, fallback.height),
  };
}

function normalizeStickyColor(value: unknown) {
  const color = cleanText(value, 24);
  return ['blue', 'yellow', 'green', 'pink', 'orange', 'purple'].includes(color) ? color : 'blue';
}

function normalizeShape(value: unknown) {
  const shape = cleanText(value, 24);
  return ['rectangle', 'circle', 'diamond', 'triangle', 'hexagon'].includes(shape) ? shape : 'rectangle';
}

function normalizeRelationship(value: unknown): RelationshipType {
  const relationship = cleanText(value, 40) as RelationshipType;
  return RELATIONSHIPS.includes(relationship) ? relationship : 'related_to';
}

function normalizeColor(value: unknown) {
  const color = cleanText(value, 30);
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#6366f1';
}

function stripJsonFence(value: string) {
  return value.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function stripJsonLineComments(value: string) {
  return value.replace(/[ \t]+\/\/[^\n\r]*/g, '');
}

function parseProviderJson(value: string, provider: AIProvider, model: string) {
  const candidate = extractJsonObject(stripJsonFence(value));
  try {
    return JSON.parse(candidate);
  } catch (err: any) {
    const preview = candidate
      .slice(0, 600)
      .replace(/\s+/g, ' ')
      .trim();
    throw new Error(`${provider.toUpperCase()} ${model} returned invalid JSON: ${err?.message || err}. Preview: ${preview}`);
  }
}

function extractJsonObject(value: string) {
  const start = value.indexOf('{');
  if (start === -1) return value.trim();

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = inString;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return value.slice(start, index + 1).trim();
    }
  }

  return value.slice(start).trim();
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}
