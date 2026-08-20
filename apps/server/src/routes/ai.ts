import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createAuthHook, createRateLimitHook, readPositiveIntEnv } from '../security.js';

type AIProvider = 'gemini' | 'openai' | 'anthropic';
type RelationshipType = 'related_to' | 'leads_to' | 'based_on' | 'part_of' | 'depends_on' | 'contradicts' | 'enables';

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

const PROVIDERS: AIProvider[] = ['gemini', 'openai', 'anthropic'];
const RELATIONSHIPS: RelationshipType[] = ['related_to', 'leads_to', 'based_on', 'part_of', 'depends_on', 'contradicts', 'enables'];
const NODE_TYPES = ['sticky', 'shape', 'text', 'frame'];
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export async function aiRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', createRateLimitHook({
    namespace: 'ai',
    windowMs: readPositiveIntEnv('CANVIO_AI_RATE_WINDOW_MS', 60000, 1000, 3_600_000),
    max: readPositiveIntEnv('CANVIO_AI_RATE_LIMIT', 20, 1, 1_000),
  }));
  fastify.addHook('onRequest', createAuthHook({ requiredEnv: 'CANVIO_REQUIRE_AI_AUTH' }));

  fastify.post('/generate', async (request: FastifyRequest<{ Body: AIRequestBody }>, reply: FastifyReply) => {
    const prompt = cleanText(request.body?.prompt, 4000);
    if (!prompt) return reply.code(400).send({ error: 'Prompt is required' });

    const provider = resolveProvider(request.body?.provider);
    const model = resolveModel(provider, request.body?.model);
    const key = resolveApiKey(provider);
    if (!key) return reply.code(503).send({ error: 'AI_NOT_CONFIGURED', provider });

    const systemPrompt = buildBoardSystemPrompt();
    const userPrompt = `User request:\n${prompt}\n\n${buildGraphContext(request.body?.context)}`;
    const parsed = await callProviderForJson(provider, key, model, systemPrompt, userPrompt);

    return {
      source: 'server-ai',
      provider,
      model,
      ...normalizeBoardPayload(parsed, prompt),
    };
  });

  fastify.post('/summarize', async (request: FastifyRequest<{ Body: AIRequestBody }>, reply: FastifyReply) => {
    const provider = resolveProvider(request.body?.provider);
    const model = resolveModel(provider, request.body?.model);
    const key = resolveApiKey(provider);
    if (!key) return reply.code(503).send({ error: 'AI_NOT_CONFIGURED', provider });

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

    const parsed = await callProviderForJson(provider, key, model, systemPrompt, userPrompt);
    return {
      source: 'server-ai',
      provider,
      model,
      ...normalizeBoardPayload(parsed, output === 'article' ? 'Board article draft' : 'Board summary'),
    };
  });

  fastify.post('/organize', async (request: FastifyRequest<{ Body: AIRequestBody }>, reply: FastifyReply) => {
    const provider = resolveProvider(request.body?.provider);
    const model = resolveModel(provider, request.body?.model);
    const key = resolveApiKey(provider);
    if (!key) return reply.code(503).send({ error: 'AI_NOT_CONFIGURED', provider });

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
    const parsed = await callProviderForJson(provider, key, model, systemPrompt, userPrompt);

    return {
      source: 'server-ai',
      provider,
      model,
      clusters: normalizeClusters(parsed, nodes),
    };
  });

  fastify.post('/analyze-graph', async (request: FastifyRequest<{ Body: AIRequestBody }>, reply: FastifyReply) => {
    const provider = resolveProvider(request.body?.provider);
    const model = resolveModel(provider, request.body?.model);
    const key = resolveApiKey(provider);
    if (!key) return reply.code(503).send({ error: 'AI_NOT_CONFIGURED', provider });

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

    const parsed = await callProviderForJson(provider, key, model, systemPrompt, userPrompt);
    return {
      source: 'server-ai',
      provider,
      model,
      ...parsed,
    };
  });

  fastify.post('/challenge', async (request: FastifyRequest<{ Body: AIRequestBody }>, reply: FastifyReply) => {
    const provider = resolveProvider(request.body?.provider);
    const model = resolveModel(provider, request.body?.model);
    const key = resolveApiKey(provider);
    if (!key) return reply.code(503).send({ error: 'AI_NOT_CONFIGURED', provider });

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

    const parsed = await callProviderForJson(provider, key, model, systemPrompt, userPrompt);
    return {
      source: 'server-ai',
      provider,
      model,
      ...parsed,
    };
  });

  fastify.post('/socratic', async (request: FastifyRequest<{ Body: AIRequestBody }>, reply: FastifyReply) => {
    const provider = resolveProvider(request.body?.provider);
    const model = resolveModel(provider, request.body?.model);
    const key = resolveApiKey(provider);
    if (!key) return reply.code(503).send({ error: 'AI_NOT_CONFIGURED', provider });

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

    const parsed = await callProviderForJson(provider, key, model, systemPrompt, userPrompt);
    return {
      source: 'server-ai',
      provider,
      model,
      ...parsed,
    };
  });
}

function resolveProvider(provider?: string): AIProvider {
  if (provider && PROVIDERS.includes(provider as AIProvider)) return provider as AIProvider;
  const envProvider = process.env.CANVIO_AI_PROVIDER;
  return PROVIDERS.includes(envProvider as AIProvider) ? envProvider as AIProvider : 'gemini';
}

function resolveModel(provider: AIProvider, model?: string) {
  const cleaned = cleanText(model, 80);
  if (provider === 'openai') return cleaned || process.env.CANVIO_OPENAI_MODEL || 'gpt-4o-mini';
  if (provider === 'anthropic') return cleaned || process.env.CANVIO_ANTHROPIC_MODEL || 'claude-3-5-sonnet';

  // Keep the browser on the configured Gemini model. This prevents an anonymous
  // caller from switching a free-tier deployment to a more expensive model.
  const configuredModel = cleanText(process.env.CANVIO_GEMINI_MODEL, 80) || DEFAULT_GEMINI_MODEL;
  return cleaned === configuredModel ? cleaned : configuredModel;
}

function resolveApiKey(provider: AIProvider) {
  if (provider === 'openai') return process.env.CANVIO_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
  if (provider === 'anthropic') return process.env.CANVIO_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  return process.env.CANVIO_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
}

function buildBoardSystemPrompt() {
  return `You are Spatial AI for Canvio, an infinite canvas knowledge workspace.
Generate a structured spatial knowledge graph for the user's request.
Relations are first-class meaning: read the existing graph before adding content, preserve useful links, and use relationship labels/types to explain flow, dependency, evidence, contradiction, and location. Map pins are individual endpoints, not just part of a map image.
Return ONLY raw JSON with this schema:
{
  "title": "Short title",
  "nodes": [
    {
      "id": "stable_local_id",
      "type": "sticky",
      "position": { "x": 0, "y": 0 },
      "size": { "width": 260, "height": 140 },
      "data": {
        "title": "Frame title",
        "color": "blue",
        "text": "Card text",
        "label": "Shape label",
        "shape": "rectangle"
      }
    }
  ],
  "relations": [
    {
      "sourceId": "stable_local_id",
      "targetId": "other_local_id",
      "label": "relationship label",
      "relationship": "depends_on",
      "color": "#6366f1"
    }
  ]
}
Allowed node types: sticky, shape, text, frame.
Sticky colors: blue, yellow, green, pink, orange, purple.
Relationships: depends_on, leads_to, enables, based_on, contradicts, part_of, related_to.
Keep the board practical, readable, and not more than 18 nodes unless the request clearly needs more.
Use visual variety for diagrams: do not make every node a sticky note. For a board with four or more nodes, include a frame when useful, use a shape for the central concept or decision, use text for a clear title, and reserve sticky notes for supporting ideas. Keep frames behind their contents and place nodes with enough spacing for labeled relations.`;
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

  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`OpenAI API HTTP ${response.status}`);
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
    if (!response.ok) throw new Error(`Anthropic API HTTP ${response.status}`);
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
          maxOutputTokens: 3500,
        },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`Gemini API HTTP ${response.status}`);
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  return JSON.parse(stripJsonFence(text));
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

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}
