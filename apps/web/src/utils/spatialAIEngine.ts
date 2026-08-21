import { nanoid } from 'nanoid';
import { LivingNode, Relation, useCanvasStore } from '../store/canvasStore';
import {
  ApiRequestError,
  AIProvider,
  generateAIBoard,
  organizeAIClusters,
  RawAIBoardNode,
  RawAIBoardRelation,
  summarizeAIBoard,
  analyzeAIGraph,
  challengeAIBoard,
  socraticInquiryAI,
  AIGraphAnalysisResponse,
  AIChallengeResponse,
  AISocraticResponse,
} from './api';
import { analyzeGraphStructure, getNodeTitle } from './graphQueries';
import type { GraphInsight } from '@canvio/core';

export interface SpatialAIResult {
  title: string;
  nodes: LivingNode[];
  relations: Relation[];
  source?: 'server' | 'local';
  message?: string;
}

export type BoardDocumentFormat = 'summary' | 'article';

export async function generateSpatialBoardAsync(
  prompt: string,
  provider?: string,
  _apiKey?: string,
  model?: string
): Promise<SpatialAIResult> {
  try {
    const result = await generateAIBoard({
      prompt,
      provider: normalizeProvider(provider),
      model,
      context: buildAIContext(),
    });
    return normalizeServerBoardResult(result.title, result.nodes, result.relations, prompt, 'server');
  } catch (err) {
    console.warn('Server AI generation unavailable. Falling back to local spatial template.', err);
    return {
      ...generateSpatialBoard(prompt),
      source: 'local',
      message: getAIFallbackMessage(err),
    };
  }
}

function normalizeServerBoardResult(
  title: string,
  rawNodes: RawAIBoardNode[],
  rawRelations: RawAIBoardRelation[],
  fallbackTitle: string,
  source: SpatialAIResult['source']
): SpatialAIResult {
  const createdAt = Date.now();
  const idMap = new Map<string, string>();
  const nodes: LivingNode[] = rawNodes.slice(0, 28).map((node, index) => {
    const originalId = cleanText(node.id, 80) || `node_${index + 1}`;
    const id = nanoid(10);
    idMap.set(originalId, id);
    const type = normalizeNodeType(node.type);
    const data = node.data || {};
    const color = normalizeStickyColor(data.color);
    const text = cleanText(data.text, 600) || cleanText(data.label, 180) || cleanText(data.title, 120);
    const label = cleanText(data.label, 180) || text.slice(0, 80);
    const titleText = cleanText(data.title, 120) || label || text.slice(0, 80);

    return {
      id,
      type,
      position: {
        x: clampNumber(node.position?.x, -10000, 10000, (index % 4) * 300),
        y: clampNumber(node.position?.y, -10000, 10000, Math.floor(index / 4) * 190),
      },
      size: {
        width: clampNumber(node.size?.width, 110, 1400, type === 'frame' ? 760 : 260),
        height: clampNumber(node.size?.height, 70, 1000, type === 'frame' ? 460 : 140),
      },
      rotation: 0,
      zIndex: type === 'frame' ? 0 : index + 1,
      locked: false,
      data: {
        ...data,
        color,
        text,
        content: type === 'text' ? text : cleanText(data.content, 600),
        title: type === 'frame' ? titleText : cleanText(data.title, 120),
        label: type === 'shape' ? label : cleanText(data.label, 180),
        shape: normalizeShape(data.shape),
        fill: cleanText(data.fill, 80) || 'rgba(128, 131, 255, 0.12)',
        stroke: normalizeColor(data.stroke, '#8083ff'),
      },
      createdAt,
      updatedAt: createdAt,
    };
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const relations: Relation[] = rawRelations.slice(0, 60).flatMap((relation) => {
    const sourceId = idMap.get(cleanText(relation.sourceId, 80));
    const targetId = idMap.get(cleanText(relation.targetId, 80));
    if (!sourceId || !targetId || sourceId === targetId || !nodeIds.has(sourceId) || !nodeIds.has(targetId)) return [];

    return [{
      id: nanoid(10),
      sourceId,
      sourcePort: normalizePort(relation.sourcePort),
      targetId,
      targetPort: normalizePort(relation.targetPort),
      relationship: normalizeRelationship(relation.relationship),
      label: cleanText(relation.label, 90) || 'relates to',
      style: {
        type: 'orthogonal',
        color: normalizeColor(relation.color, '#6366f1'),
        width: 2.5,
        endArrow: 'arrow',
      },
    }];
  });

  const finalTitle = cleanText(title, 120) || `AI Board: ${fallbackTitle.slice(0, 32)}`;

  return {
    title: finalTitle,
    nodes: improveAIVisualStructure(finalTitle, nodes, createdAt),
    relations,
    source,
  };
}

function improveAIVisualStructure(title: string, nodes: LivingNode[], timestamp: number) {
  if (nodes.length < 4) return nodes;

  const allSticky = nodes.every((node) => node.type === 'sticky');
  const hasFrame = nodes.some((node) => node.type === 'frame');
  let enhancedNodes = nodes;

  // A frame gives an AI-created diagram a clear boundary and keeps fitting
  // predictable when the model returns only content cards.
  if (!hasFrame) {
    const bounds = getNodeBounds(nodes);
    enhancedNodes = [
      {
        id: nanoid(10),
        type: 'frame',
        position: { x: bounds.minX - 56, y: bounds.minY - 78 },
        size: { width: bounds.maxX - bounds.minX + 112, height: bounds.maxY - bounds.minY + 134 },
        rotation: 0,
        zIndex: -1,
        locked: false,
        data: {
          title: title.slice(0, 72) || 'AI Board',
          color: '#6366f1',
          fill: 'rgba(99, 102, 241, 0.045)',
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      ...nodes,
    ];
  }

  if (!allSticky) return enhancedNodes;

  // Promote the node nearest the group centre to a readable visual anchor.
  const centre = nodes.reduce((point, node) => ({
    x: point.x + node.position.x + node.size.width / 2,
    y: point.y + node.position.y + node.size.height / 2,
  }), { x: 0, y: 0 });
  centre.x /= nodes.length;
  centre.y /= nodes.length;
  let anchorId = nodes[0].id;
  let anchorDistance = Number.POSITIVE_INFINITY;
  nodes.forEach((node) => {
    const nodeCentre = {
      x: node.position.x + node.size.width / 2,
      y: node.position.y + node.size.height / 2,
    };
    const distance = Math.hypot(nodeCentre.x - centre.x, nodeCentre.y - centre.y);
    if (distance < anchorDistance) {
      anchorDistance = distance;
      anchorId = node.id;
    }
  });

  return enhancedNodes.map((node) => {
    if (node.id !== anchorId) return node;
    const label = getNodeText(node).slice(0, 100) || 'Core idea';
    return {
      ...node,
      type: 'shape',
      data: {
        ...(node.data || {}),
        shape: 'hexagon',
        label,
        fill: 'rgba(99, 102, 241, 0.18)',
        stroke: '#6366f1',
        strokeWidth: 2,
      },
    };
  });
}

function getNodeBounds(nodes: LivingNode[]) {
  return nodes.reduce((bounds, node) => ({
    minX: Math.min(bounds.minX, node.position.x),
    minY: Math.min(bounds.minY, node.position.y),
    maxX: Math.max(bounds.maxX, node.position.x + node.size.width),
    maxY: Math.max(bounds.maxY, node.position.y + node.size.height),
  }), {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });
}

function buildAIContext(nodes = Object.values(useCanvasStore.getState().nodes), relations = Object.values(useCanvasStore.getState().relations)) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return {
    nodes: nodes.slice(0, 80).map((node) => ({
      id: node.id,
      type: node.type,
      text: getNodeText(node).slice(0, 280),
      title: getNodeDisplayName(node),
      ...(node.type === 'map' ? { mapPins: getMapPins(node) } : {}),
    })),
    relations: relations.slice(0, 140).map((relation) => ({
      id: relation.id,
      sourceId: relation.sourceId,
      targetId: relation.targetId,
      sourcePort: relation.sourcePort,
      targetPort: relation.targetPort,
      sourceLabel: getRelationEndpointName(nodeById.get(relation.sourceId), relation.sourcePort),
      targetLabel: getRelationEndpointName(nodeById.get(relation.targetId), relation.targetPort),
      label: relation.label,
      relationship: relation.relationship,
    })),
  };
}

function getNodeText(node: LivingNode) {
  const data = node.data as Record<string, unknown> | undefined;
  return String(data?.text || data?.content || data?.title || data?.label || '');
}

function getNodeDisplayName(node: LivingNode) {
  const data = node.data as Record<string, unknown> | undefined;
  const raw = data?.title || data?.label || data?.text || data?.content;
  const value = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  return value.slice(0, 120) || (node.type === 'map' ? 'Living map' : `${node.type} element`);
}

function getMapPins(node: LivingNode) {
  const data = node.data as Record<string, unknown> | undefined;
  const markers = Array.isArray(data?.markers) ? data.markers : [];
  return markers.slice(0, 40).flatMap((marker) => {
    if (!marker || typeof marker !== 'object') return [];
    const value = marker as Record<string, unknown>;
    const position = Array.isArray(value.position) ? value.position : [];
    const latitude = typeof position[0] === 'number' ? position[0] : NaN;
    const longitude = typeof position[1] === 'number' ? position[1] : NaN;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return [{
      id: String(value.id || ''),
      label: String(value.label || 'Unnamed pin').replace(/\s+/g, ' ').trim().slice(0, 100),
      latitude,
      longitude,
    }];
  });
}

function getRelationEndpointName(node: LivingNode | undefined, port?: string) {
  if (!node) return 'Unknown element';
  const nodeName = getNodeDisplayName(node);
  if (node.type !== 'map' || !port?.startsWith('marker:')) return nodeName;
  const markerId = port.slice('marker:'.length);
  const marker = getMapPins(node).find((pin) => pin.id === markerId);
  return marker ? `${nodeName} / pin: ${marker.label}` : `${nodeName} / pin: ${markerId}`;
}

function normalizeProvider(provider?: string): AIProvider | undefined {
  return provider === 'openai' || provider === 'anthropic' || provider === 'gemini' || provider === 'groq' ? provider : undefined;
}

function getClientAIProvider(): AIProvider | undefined {
  return normalizeProvider(localStorage.getItem('CANVIO_AI_PROVIDER') || '');
}

function getClientAIModel(): string | undefined {
  return cleanText(localStorage.getItem('CANVIO_AI_MODEL') || '', 80) || undefined;
}

function getAIFallbackMessage(error: unknown) {
  if (error instanceof ApiRequestError && error.code === 'AI_NOT_CONFIGURED') {
    return 'Server AI is not configured yet, so Canvio used the local smart board generator.';
  }
  return 'Server AI was unavailable, so Canvio used the local smart board generator.';
}

function isExpectedAIFallback(error: unknown) {
  return (
    error instanceof ApiRequestError &&
    error.status === 503 &&
    (error.code === 'AI_NOT_CONFIGURED' || error.code === 'AI_REQUEST_FAILED')
  );
}

function normalizeNodeType(type: unknown) {
  return type === 'shape' || type === 'text' || type === 'frame' || type === 'sticky' ? type : 'sticky';
}

function normalizeRelationship(value: unknown): Relation['relationship'] {
  const relationship = cleanText(value, 40) as Relation['relationship'];
  return ['related_to', 'leads_to', 'based_on', 'part_of', 'depends_on', 'contradicts', 'same_as', 'enables', 'inspired_by', 'custom'].includes(relationship)
    ? relationship
    : 'related_to';
}

function normalizePort(value: unknown) {
  const port = cleanText(value, 40);
  if (port === 'top' || port === 'right' || port === 'bottom' || port === 'left' || port === 'center' || port.startsWith('marker:')) return port;
  return undefined;
}

function normalizeStickyColor(value: unknown) {
  const color = cleanText(value, 24);
  return ['blue', 'yellow', 'green', 'pink', 'orange', 'purple'].includes(color) ? color : 'blue';
}

function normalizeShape(value: unknown) {
  const shape = cleanText(value, 24);
  return ['rectangle', 'circle', 'diamond', 'triangle', 'hexagon'].includes(shape) ? shape : 'rectangle';
}

function normalizeColor(value: unknown, fallback: string) {
  const color = cleanText(value, 32);
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export async function expandNodeWithAIAsync(
  targetNode: LivingNode,
): Promise<SpatialAIResult> {
  const provider = getClientAIProvider();
  const model = getClientAIModel();

  const targetData = targetNode.data as Record<string, any> | undefined;
  const nodeContent = String(targetData?.text || targetData?.content || targetData?.title || targetData?.label || 'Concept');
  const prompt = `Given this central node idea: "${nodeContent}", generate 3 distinct sub-topics or logical next steps. Connect each new sub-topic node to this central node (sourceId: "${targetNode.id}").`;

  try {
    const res = await generateSpatialBoardAsync(prompt, provider, undefined, model);
    if (res.source === 'server' && res.nodes.length > 0) {
      const cx = targetNode.position.x;
      const cy = targetNode.position.y;
      res.nodes.forEach((n, idx) => {
        n.position = {
          x: cx + 320,
          y: cy + (idx - 1) * 160,
        };
      });

      res.nodes.forEach((n) => {
        if (!res.relations.some((r) => r.sourceId === targetNode.id && r.targetId === n.id)) {
          res.relations.push(relation(targetNode.id, n.id, 'expands into', '#8083ff', 'leads_to'));
        }
      });
      return res;
    }
  } catch {
    // Fallback below
  }

  // Fallback heuristic expand
  const cx = targetNode.position.x;
  const cy = targetNode.position.y;
  const child1Id = nanoid(10);
  const child2Id = nanoid(10);
  const child3Id = nanoid(10);

  return {
    title: `Expanded: ${nodeContent.slice(0, 20)}`,
    nodes: [
      sticky(child1Id, cx + 320, cy - 140, 260, 130, `Key Insights & Analysis\nDeep dive details for ${nodeContent.slice(0, 22)}.`, 'blue', targetNode.zIndex + 1),
      sticky(child2Id, cx + 320, cy + 20, 260, 130, `Action Items & Implementation\nSteps and owner assignments.`, 'green', targetNode.zIndex + 2),
      sticky(child3Id, cx + 320, cy + 180, 260, 130, `Risks & Mitigation Plan\nPotential bottlenecks and quality gates.`, 'orange', targetNode.zIndex + 3),
    ],
    relations: [
      relation(targetNode.id, child1Id, 'informs', '#38bdf8', 'based_on'),
      relation(targetNode.id, child2Id, 'enables', '#22c55e', 'leads_to'),
      relation(targetNode.id, child3Id, 'identifies risk', '#ef4444', 'depends_on'),
    ],
  };
}

export async function summarizeBoardWithAIAsync(
  nodes: LivingNode[],
  relations: Relation[],
  output: BoardDocumentFormat = 'summary'
): Promise<SpatialAIResult> {
  const provider = getClientAIProvider();
  const model = getClientAIModel();

  try {
    const result = await summarizeAIBoard({
      provider,
      model,
      output,
      context: buildAIContext(nodes, relations),
    });
    const normalized = normalizeServerBoardResult(
      result.title,
      result.nodes,
      result.relations,
      output === 'article' ? 'Board article draft' : 'Board summary',
      'server'
    );
    return output === 'article' ? composeArticlePage(normalized) : normalized;
  } catch (err) {
    console.warn(`Server AI ${output} unavailable. Falling back to local board analysis.`, err);
  }

  const localResult = createLocalBoardDocument(nodes, relations, output);
  return output === 'article' ? composeArticlePage(localResult) : localResult;
}

function composeArticlePage(result: SpatialAIResult): SpatialAIResult {
  const timestamp = Date.now();
  const normalizedTitle = result.title.replace(/\s+/g, ' ').trim().toLowerCase();
  const sections = result.nodes
    .filter((node) => node.type !== 'frame')
    .map((node) => getNodeText(node).trim())
    .filter((content) => content && content.replace(/\s+/g, ' ').trim().toLowerCase() !== normalizedTitle)
    .slice(0, 7);
  const safeSections = sections.length > 0
    ? sections
    : ['Introduction\nAdd the main ideas from the board to develop this article draft.'];
  const bodyWidth = 800;
  const sectionGap = 22;
  const titleHeight = 92;
  const sectionHeights = safeSections.map((content) => {
    const explicitLines = content.split('\n').length;
    const wrappedLines = Math.ceil(content.length / 82);
    return Math.max(96, Math.min(320, Math.max(explicitLines, wrappedLines) * 25 + 34));
  });
  const pageHeight = 62 + titleHeight + 28 + sectionHeights.reduce((sum, height) => sum + height, 0) + sectionGap * (safeSections.length - 1) + 64;
  const pageTop = -pageHeight / 2;
  let cursorY = pageTop + 62 + titleHeight + 28;

  const articleNodes: LivingNode[] = [
    frame(nanoid(10), -450, pageTop, 900, pageHeight, 'AI Article Draft', '#8b5cf6'),
    textBlock(nanoid(10), -400, pageTop + 62, bodyWidth, titleHeight, result.title, 1, 28),
  ];

  safeSections.forEach((content, index) => {
    const height = sectionHeights[index];
    articleNodes.push(textBlock(nanoid(10), -400, cursorY, bodyWidth, height, content, index + 2, 16, 'normal'));
    cursorY += height + sectionGap;
  });

  return {
    ...result,
    nodes: articleNodes.map((node) => ({ ...node, createdAt: timestamp, updatedAt: timestamp })),
    relations: [],
  };
}

function createLocalBoardDocument(
  nodes: LivingNode[],
  relations: Relation[],
  output: BoardDocumentFormat
): SpatialAIResult {
  const sourceNodes = nodes.filter((node) => node.type !== 'frame');
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const ideas = sourceNodes
    .map((node) => getNodeText(node).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const titleSeed = sourceNodes[0] ? getNodeDisplayName(sourceNodes[0]) : 'Untitled board';
  const keyPoints = ideas.slice(0, 6);
  const connectionLines = relations.slice(0, 6).map((relation) => {
    const source = getRelationEndpointName(nodeById.get(relation.sourceId), relation.sourcePort);
    const target = getRelationEndpointName(nodeById.get(relation.targetId), relation.targetPort);
    return `${source} ${relation.label || relation.relationship.replace(/_/g, ' ')} ${target}`;
  });

  if (output === 'article') {
    const frameId = nanoid(10);
    const titleId = nanoid(10);
    const introId = nanoid(10);
    const pointsId = nanoid(10);
    const connectionsId = nanoid(10);
    const conclusionId = nanoid(10);
    const articleTitle = `Article draft: ${titleSeed.slice(0, 54)}`;
    const overview = ideas.length > 0
      ? `This board explores ${ideas.slice(0, 3).join('; ')}.`
      : 'This draft is ready for the main ideas from the board.';
    const pointText = keyPoints.length > 0
      ? `Key ideas\n${keyPoints.map((item) => `• ${item}`).join('\n')}`
      : 'Key ideas\nAdd more written elements to develop this section.';
    const relationText = connectionLines.length > 0
      ? `How the ideas connect\n${connectionLines.map((item) => `• ${item}`).join('\n')}`
      : 'How the ideas connect\nAdd labeled relations to make the argument and sequence clearer.';
    const conclusion = keyPoints.length > 1
      ? `Conclusion and next step\nThe board brings together ${keyPoints.length} key ideas. Review the connections, confirm the evidence, and turn the strongest open point into the next action.`
      : 'Conclusion and next step\nReview the draft, add missing evidence, and connect the next action to the main idea.';

    return {
      title: articleTitle,
      nodes: [
        frame(frameId, -380, -490, 760, 980, 'AI Article Draft', '#8b5cf6'),
        textBlock(titleId, -330, -430, 660, 82, articleTitle, 1, 28),
        textBlock(introId, -330, -325, 660, 130, `Introduction\n${overview}`, 2, 17, 'normal'),
        textBlock(pointsId, -330, -170, 660, 250, pointText, 3, 16, 'normal'),
        textBlock(connectionsId, -330, 95, 660, 220, relationText, 4, 16, 'normal'),
        textBlock(conclusionId, -330, 330, 660, 115, conclusion, 5, 16, 'normal'),
      ],
      relations: [],
      source: 'local',
      message: 'Server AI was unavailable, so Canvio created an editable article draft from the board content and relations.',
    };
  }

  const frameId = nanoid(10);
  const s1 = nanoid(10);
  const s2 = nanoid(10);
  const s3 = nanoid(10);
  const s4 = nanoid(10);
  const coreText = keyPoints.slice(0, 2).join('\n') || 'Add written ideas to strengthen this summary.';
  const pointsText = keyPoints.slice(2, 5).map((item) => `• ${item}`).join('\n') || 'No additional written points yet.';
  const relationsText = connectionLines.slice(0, 4).map((item) => `• ${item}`).join('\n') || 'Add labeled relations to reveal dependencies and flow.';

  return {
    title: `Board summary: ${titleSeed.slice(0, 48)}`,
    nodes: [
      frame(frameId, -450, -310, 900, 620, 'AI Board Summary', '#6366f1'),
      sticky(s1, -410, -240, 400, 210, `Core idea\n${coreText}`, 'purple', 2),
      sticky(s2, 20, -240, 400, 210, `Key points\n${pointsText}`, 'green', 3),
      sticky(s3, -410, 10, 400, 220, `Meaningful connections\n${relationsText}`, 'pink', 4),
      sticky(s4, 20, 10, 400, 220, 'Next step\nConfirm the strongest evidence, resolve open questions, and assign the next concrete action.', 'blue', 5),
    ],
    relations: [
      relation(s1, s2, 'leads to', '#8b5cf6', 'leads_to'),
      relation(s3, s2, 'constrains', '#ef4444', 'contradicts'),
      relation(s2, s4, 'enables', '#22c55e', 'enables'),
    ],
    source: 'local',
    message: 'Server AI was unavailable, so Canvio summarized the board content and relations locally.',
  };
}

export async function organizeAndClusterWithAIAsync(
  nodes: LivingNode[],
  updateNode: (id: string, patch: Partial<LivingNode>) => void,
  addNode: (node: LivingNode) => void
): Promise<{ clustersCount: number; source?: 'server' | 'local'; message?: string }> {
  if (nodes.length === 0) return { clustersCount: 0 };

  const CLUSTER_PRESETS = [
    { title: '💡 Strategy & Ideas', color: '#8b5cf6', stickyColor: 'purple' },
    { title: '⚡ Execution & Tasks', color: '#22c55e', stickyColor: 'green' },
    { title: '🚨 Risks & Review', color: '#f59e0b', stickyColor: 'orange' },
  ];
  const provider = getClientAIProvider();
  const model = getClientAIModel();

  try {
    const result = await organizeAIClusters({
      provider,
      model,
      context: buildAIContext(nodes, Object.values(useCanvasStore.getState().relations)),
    });
    if (result.clusters.length > 0) {
      applyClusterLayout(
        nodes,
        result.clusters.map((cluster, idx) => ({
          title: cluster.title,
          color: cluster.color,
          stickyColor: CLUSTER_PRESETS[idx % CLUSTER_PRESETS.length].stickyColor,
          nodeIds: cluster.nodeIds,
        })),
        updateNode,
        addNode
      );
      return { clustersCount: result.clusters.length, source: 'server' };
    }
  } catch (err) {
    console.warn('Server AI clustering unavailable. Falling back to local clustering.', err);
  }

  const nodesPerCluster = Math.ceil(nodes.length / CLUSTER_PRESETS.length);
  const localClusters = CLUSTER_PRESETS.map((preset, clusterIdx) => ({
    ...preset,
    nodeIds: nodes.slice(clusterIdx * nodesPerCluster, clusterIdx * nodesPerCluster + nodesPerCluster).map((node) => node.id),
  })).filter((cluster) => cluster.nodeIds.length > 0);

  applyClusterLayout(nodes, localClusters, updateNode, addNode);
  return {
    clustersCount: localClusters.length,
    source: 'local',
    message: 'Server AI is not configured yet, so Canvio used the local organizer.',
  };
}

export async function analyzeGraphWithAIAsync(
  nodes: LivingNode[],
  relations: Relation[]
): Promise<{
  critique: string;
  healthScore: number;
  insights: GraphInsight[];
  suggestedRelations: Array<{ sourceId: string; targetId: string; relationship: Relation['relationship']; label: string; reason?: string }>;
  source: 'server' | 'local';
}> {
  const nodesRecord = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const relationsRecord = Object.fromEntries(relations.map((r) => [r.id, r]));
  const localAnalysis = analyzeGraphStructure(nodesRecord, relationsRecord);

  const provider = getClientAIProvider();
  const model = getClientAIModel();

  try {
    const result = await analyzeAIGraph({
      provider,
      model,
      context: buildAIContext(nodes, relations),
    });

    if (result?.source === 'server-ai' && result.critique) {
      const serverInsights: GraphInsight[] = (result.insights || []).map((ins, idx) => ({
        id: ins.id || `ai_ins_${idx}`,
        type: ins.type || 'suggestion',
        severity: ins.severity || 'info',
        title: ins.title || 'Reasoning Observation',
        description: ins.description || '',
        nodeIds: Array.isArray(ins.nodeIds) ? ins.nodeIds : [],
      }));

      const mergedInsights = [...serverInsights, ...localAnalysis.insights.filter((li) => !serverInsights.some((si) => si.title === li.title))];

      return {
        critique: result.critique,
        healthScore: typeof result.healthScore === 'number' ? result.healthScore : localAnalysis.metrics.reasoningHealthScore,
        insights: mergedInsights,
        suggestedRelations: (result.suggestedRelations || []).map((sr) => ({
          sourceId: sr.sourceId,
          targetId: sr.targetId,
          relationship: normalizeRelationship(sr.relationship),
          label: sr.label || 'relates to',
          reason: sr.reason,
        })),
        source: 'server',
      };
    }
  } catch (err) {
    if (!isExpectedAIFallback(err)) {
      console.warn('Server AI graph analysis unavailable. Using local reasoning engine.', err);
    }
  }

  // Local Reasoning Synthesis
  const nodeCount = nodes.length;
  const contraCount = localAnalysis.contradictions.length;
  const orphanCount = localAnalysis.orphans.length;
  const maxDepth = localAnalysis.metrics.maxDependencyDepth;

  let critique = '';
  if (nodeCount === 0) {
    critique = 'The canvas is currently empty. Start by placing concepts, data, or field pins to build your reasoning graph.';
  } else if (contraCount > 0) {
    critique = `Found ${contraCount} active contradiction${contraCount > 1 ? 's' : ''} in your model. Reconcile conflicting premises or specify conditional boundaries between them.`;
  } else if (orphanCount > 1) {
    critique = `Your board has ${orphanCount} unanchored thoughts that aren't integrated into the main causal flow. Connect them with labeled relations to strengthen the argument.`;
  } else if (maxDepth >= 3) {
    critique = `Strong directional depth (${maxDepth} levels). Your reasoning follows a structured chain from underlying premises to final actions.`;
  } else {
    critique = `Good conceptual foundation (${nodeCount} elements). Consider linking supporting evidence or defining downstream dependencies to expand depth.`;
  }

  // Suggest local logical bridges for orphans
  const suggestedRelations: Array<{ sourceId: string; targetId: string; relationship: Relation['relationship']; label: string; reason?: string }> = [];
  if (localAnalysis.orphans.length > 0 && nodes.length > localAnalysis.orphans.length) {
    const nonOrphan = nodes.find((n) => !localAnalysis.orphans.some((o) => o.id === n.id));
    if (nonOrphan) {
      const orphan = localAnalysis.orphans[0];
      suggestedRelations.push({
        sourceId: nonOrphan.id,
        targetId: orphan.id,
        relationship: 'leads_to',
        label: 'informs',
        reason: `Connect unanchored idea "${getNodeTitle(orphan)}" to "${getNodeTitle(nonOrphan)}"`,
      });
    }
  }

  return {
    critique,
    healthScore: localAnalysis.metrics.reasoningHealthScore,
    insights: localAnalysis.insights,
    suggestedRelations,
    source: 'local',
  };
}

export async function challengeBoardWithAIAsync(
  nodes: LivingNode[],
  relations: Relation[]
): Promise<{
  challengeSummary: string;
  challenges: Array<{ targetNodeId: string; critique: string; counterPerspective: string }>;
  challengerNodes: LivingNode[];
  challengerRelations: Relation[];
  source: 'server' | 'local';
}> {
  const provider = getClientAIProvider();
  const model = getClientAIModel();

  try {
    const result = await challengeAIBoard({
      provider,
      model,
      context: buildAIContext(nodes, relations),
    });

    if (result && result.challengeSummary) {
      const normalizedResult = normalizeServerBoardResult(
        'Challenger Critique',
        result.challengerNodes || [],
        result.challengerRelations || [],
        'Challenge',
        'server'
      );

      return {
        challengeSummary: result.challengeSummary,
        challenges: result.challenges || [],
        challengerNodes: normalizedResult.nodes,
        challengerRelations: normalizedResult.relations,
        source: 'server',
      };
    }
  } catch (err) {
    console.warn('Server AI challenge unavailable. Using local devil advocate.', err);
  }

  // Local Devil's Advocate heuristic
  const targetNode = nodes.find((n) => n.type === 'sticky' || n.type === 'shape') || nodes[0];
  const targetTitle = getNodeTitle(targetNode);
  const cx = targetNode ? targetNode.position.x + 360 : 0;
  const cy = targetNode ? targetNode.position.y : 0;
  const challengerId = nanoid(10);

  return {
    challengeSummary: `Stress-testing assumption around "${targetTitle}". What edge cases or alternative explanations could falsify this reasoning?`,
    challenges: [
      {
        targetNodeId: targetNode?.id || '',
        critique: `Assumes "${targetTitle}" holds under all conditions without accounting for external dependencies or cost constraints.`,
        counterPerspective: `What happens if primary assumptions fail or resource constraints double?`,
      },
    ],
    challengerNodes: targetNode ? [
      sticky(
        challengerId,
        cx,
        cy,
        260,
        140,
        `⚡ Counter-Hypothesis:\nWhat if the premise behind "${targetTitle}" is invalid in edge cases?`,
        'pink',
        targetNode.zIndex + 1
      ),
    ] : [],
    challengerRelations: targetNode ? [
      relation(challengerId, targetNode.id, 'challenges', '#ef4444', 'contradicts'),
    ] : [],
    source: 'local',
  };
}

export async function socraticInquiryWithAIAsync(
  nodes: LivingNode[],
  relations: Relation[]
): Promise<{
  inquiryFocus: string;
  questions: Array<{ id: string; question: string; relatedNodeIds?: string[]; learningGoal?: string }>;
  source: 'server' | 'local';
}> {
  const provider = getClientAIProvider();
  const model = getClientAIModel();

  try {
    const result = await socraticInquiryAI({
      provider,
      model,
      context: buildAIContext(nodes, relations),
    });

    if (result && result.questions && result.questions.length > 0) {
      return {
        inquiryFocus: result.inquiryFocus || 'Mental Model Reflection',
        questions: result.questions,
        source: 'server',
      };
    }
  } catch (err) {
    console.warn('Server Socratic inquiry unavailable. Using local questioning engine.', err);
  }

  // Local Socratic Questioning Heuristic
  const nodesRecord = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const relationsRecord = Object.fromEntries(relations.map((r) => [r.id, r]));
  const analysis = analyzeGraphStructure(nodesRecord, relationsRecord);

  const questions: Array<{ id: string; question: string; relatedNodeIds?: string[]; learningGoal?: string }> = [];

  if (analysis.contradictions.length > 0) {
    const c = analysis.contradictions[0];
    questions.push({
      id: 'soc_contra',
      question: `How can "${getNodeTitle(c.sourceNode)}" and "${getNodeTitle(c.targetNode)}" both be true? Under what exact conditions does each apply?`,
      relatedNodeIds: [c.sourceNode.id, c.targetNode.id],
      learningGoal: 'Synthesizing conflicting ideas into higher-order mental models',
    });
  }

  if (analysis.criticalPaths.length > 0 && analysis.criticalPaths[0].depth >= 2) {
    const cp = analysis.criticalPaths[0];
    questions.push({
      id: 'soc_path',
      question: `What is the physical or logical mechanism that translates "${getNodeTitle(cp.rootNode)}" into "${getNodeTitle(cp.leafNode)}"?`,
      relatedNodeIds: [cp.rootNode.id, cp.leafNode.id],
      learningGoal: 'Uncovering causal mechanisms behind correlation',
    });
  }

  if (analysis.orphans.length > 0) {
    const orphan = analysis.orphans[0];
    questions.push({
      id: 'soc_orphan',
      question: `What fundamental idea or real-world observation gave rise to "${getNodeTitle(orphan)}"?`,
      relatedNodeIds: [orphan.id],
      learningGoal: 'Connecting isolated insights to first principles',
    });
  }

  if (questions.length === 0) {
    questions.push({
      id: 'soc_general',
      question: 'What is the single most critical assumption underpinning this entire board?',
      learningGoal: 'Identifying core dependencies',
    });
  }

  return {
    inquiryFocus: 'Mental Model & First Principles Examination',
    questions,
    source: 'local',
  };
}

function applyClusterLayout(
  nodes: LivingNode[],
  clusters: Array<{ title: string; color: string; stickyColor: string; nodeIds: string[] }>,
  updateNode: (id: string, patch: Partial<LivingNode>) => void,
  addNode: (node: LivingNode) => void
) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const clusterGap = 410;

  clusters.forEach((cluster, clusterIdx) => {
    const clusterNodes = cluster.nodeIds.map((id) => nodeById.get(id)).filter(Boolean) as LivingNode[];
    if (clusterNodes.length === 0) return;

    const colX = (clusterIdx - (clusters.length - 1) / 2) * clusterGap;
    clusterNodes.forEach((node, nodeIdx) => {
      updateNode(node.id, {
        position: { x: colX, y: nodeIdx * 180 },
        ...(node.type === 'sticky' ? { data: { ...node.data, color: cluster.stickyColor } } : {}),
      });
    });

    addNode(frame(
      nanoid(10),
      colX - 22,
      -62,
      346,
      Math.max(300, clusterNodes.length * 180 + 84),
      cluster.title,
      normalizeColor(cluster.color, '#6366f1')
    ));
  });
}

const markerPort = (id: string) => `marker:${id}`;
const now = () => Date.now();

function frame(id: string, x: number, y: number, width: number, height: number, title: string, color: string): LivingNode {
  return {
    id,
    type: 'frame',
    position: { x, y },
    size: { width, height },
    rotation: 0,
    zIndex: 0,
    locked: false,
    data: { title, color, fill: 'rgba(255, 255, 255, 0.025)' },
    createdAt: now(),
    updatedAt: now(),
  };
}

function sticky(id: string, x: number, y: number, width: number, height: number, text: string, color: string, zIndex: number): LivingNode {
  return {
    id,
    type: 'sticky',
    position: { x, y },
    size: { width, height },
    rotation: 0,
    zIndex,
    locked: false,
    data: { color, text },
    createdAt: now(),
    updatedAt: now(),
  };
}

function shape(id: string, x: number, y: number, width: number, height: number, label: string, fill: string, stroke: string, shapeType = 'rectangle', zIndex = 1): LivingNode {
  return {
    id,
    type: 'shape',
    position: { x, y },
    size: { width, height },
    rotation: 0,
    zIndex,
    locked: false,
    data: { shape: shapeType, fill, stroke, strokeWidth: 2, label },
    createdAt: now(),
    updatedAt: now(),
  };
}

function textBlock(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  content: string,
  zIndex: number,
  fontSize = 20,
  fontWeight: 'normal' | 'bold' = 'bold'
): LivingNode {
  return {
    id,
    type: 'text',
    position: { x, y },
    size: { width, height },
    rotation: 0,
    zIndex,
    locked: false,
    data: { content, fontSize, fontWeight, textAlign: 'left', color: 'var(--text-primary)' },
    createdAt: now(),
    updatedAt: now(),
  };
}

function codeBlock(id: string, x: number, y: number, width: number, height: number, filename: string, code: string, zIndex: number): LivingNode {
  return {
    id,
    type: 'code',
    position: { x, y },
    size: { width, height },
    rotation: 0,
    zIndex,
    locked: false,
    data: { language: 'typescript', filename, code },
    createdAt: now(),
    updatedAt: now(),
  };
}

function relation(
  sourceId: string,
  targetId: string,
  label: string,
  color: string,
  relationship: Relation['relationship'] = 'related_to',
  sourcePort?: string,
  targetPort?: string
): Relation {
  return {
    id: nanoid(10),
    sourceId,
    sourcePort,
    targetId,
    targetPort,
    relationship,
    label,
    style: { type: 'orthogonal', color, width: 2.5, endArrow: 'arrow' },
  };
}

export function generateSpatialBoard(prompt: string): SpatialAIResult {
  const p = prompt.toLowerCase();
  const store = useCanvasStore.getState();
  const cx = Math.round(-store.viewport.x);
  const cy = Math.round(-store.viewport.y);

  if (p.includes('pdf') || p.includes('report') || p.includes('document') || p.includes('page') || p.includes('print')) {
    const pageId = nanoid(10);
    const titleId = nanoid(10);
    const summaryId = nanoid(10);
    const findingsId = nanoid(10);
    const actionsId = nanoid(10);

    const nodes: LivingNode[] = [
      frame(pageId, cx - 297, cy - 421, 595, 842, 'AI Document Page (A4)', '#6366f1'),
      textBlock(titleId, cx - 250, cy - 370, 500, 50, prompt.slice(0, 50) || 'Spatial Executive Summary', 1, 24),
      sticky(summaryId, cx - 250, cy - 280, 230, 160, 'Executive Overview\nKey strategic insights & spatial relationships assembled for publication.', 'blue', 2),
      sticky(findingsId, cx + 20, cy - 280, 230, 160, 'Core Findings\n- Verified coordinates\n- Linked operational notes\n- Ready for PDF export', 'yellow', 3),
      sticky(actionsId, cx - 250, cy - 90, 500, 140, 'Recommended Next Actions\n1. Review spatial relations\n2. Share live collaboration URL\n3. Export multi-page PDF document', 'green', 4),
    ];

    return {
      title: 'AI Document Page World',
      nodes,
      relations: [
        relation(summaryId, findingsId, 'supports', '#3b82f6', 'based_on'),
        relation(findingsId, actionsId, 'drives', '#22c55e', 'leads_to'),
      ],
    };
  }

  // Specific Grammar & Conditionals Board
  if (p.includes('condition') || p.includes('conditional') || p.includes('grammar') || p.includes('if clause') || p.includes('english')) {
    const frameId = nanoid(10);
    const centerId = nanoid(10);
    const zeroId = nanoid(10);
    const firstId = nanoid(10);
    const secondId = nanoid(10);
    const thirdId = nanoid(10);
    const pitfallsId = nanoid(10);
    const quizId = nanoid(10);

    const nodes: LivingNode[] = [
      frame(frameId, cx - 620, cy - 350, 1240, 700, '📚 English Grammar: Conditional Sentences (If Clauses)', '#6366f1'),
      shape(centerId, cx - 110, cy - 40, 220, 110, 'English If Conditionals\n(Rules & Usage)', 'rgba(99, 102, 241, 0.2)', '#6366f1', 'hexagon', 5),
      sticky(zeroId, cx - 560, cy - 250, 250, 160, '0️⃣ Zero Conditional\n\n📐 Rule: If + Present Simple, ... Present Simple\n💡 Usage: Scientific truths & universal facts\n📝 Example: "If water reaches 100°C, it boils."', 'blue', 1),
      sticky(firstId, cx + 310, cy - 250, 250, 160, '1️⃣ First Conditional\n\n📐 Rule: If + Present Simple, ... will + Verb\n💡 Usage: Real possibilities in the future\n📝 Example: "If you study hard, you will pass the exam."', 'green', 2),
      sticky(secondId, cx - 560, cy + 90, 250, 160, '2️⃣ Second Conditional\n\n📐 Rule: If + Past Simple, ... would + Verb\n💡 Usage: Imaginary present / hypothetical situations\n📝 Example: "If I won the lottery, I would travel the world."', 'yellow', 3),
      sticky(thirdId, cx + 310, cy + 90, 250, 160, '3️⃣ Third Conditional\n\n📐 Rule: If + Past Perfect, ... would have + V3\n💡 Usage: Impossible past conditions & regrets\n📝 Example: "If I had set an alarm, I would not have been late."', 'orange', 4),
      sticky(pitfallsId, cx - 270, cy - 280, 250, 140, '⚠️ Common Pitfalls\n\n❌ "If it will rain tomorrow..."\n✅ "If it rains tomorrow..."\n💡 Never use "will" inside the if-clause!', 'pink', 6),
      sticky(quizId, cx + 20, cy - 280, 250, 140, '✍️ Quick Practice Quiz\n\n1. "If she _____ (call), tell her I will call back."\n2. "If I _____ (know) the answer, I would tell you."', 'purple', 7),
    ];

    return {
      title: 'English Conditional Sentences',
      nodes,
      relations: [
        relation(centerId, zeroId, 'explains facts', '#3b82f6', 'explains'),
        relation(centerId, firstId, 'future chances', '#22c55e', 'leads_to'),
        relation(centerId, secondId, 'unreal present', '#eab308', 'explains'),
        relation(centerId, thirdId, 'past regrets', '#f97316', 'based_on'),
        relation(firstId, pitfallsId, 'watch out', '#ec4899', 'contradicts'),
        relation(firstId, quizId, 'test your knowledge', '#a855f7', 'leads_to'),
      ],
    };
  }

  // 5 Whys Root Cause
  if (p.includes('5 why') || p.includes('root cause') || p.includes('why why')) {
    const frameId = nanoid(10);
    const probId = nanoid(10);
    const w1Id = nanoid(10);
    const w2Id = nanoid(10);
    const w3Id = nanoid(10);
    const rootId = nanoid(10);
    const mitId = nanoid(10);

    const nodes: LivingNode[] = [
      frame(frameId, cx - 600, cy - 240, 1200, 480, '🔍 5 Whys Root Cause Analysis', '#ef4444'),
      shape(probId, cx - 560, cy - 60, 170, 120, '🚨 Problem\nStatement', 'rgba(239, 68, 68, 0.2)', '#ef4444', 'diamond', 1),
      sticky(w1Id, cx - 350, cy - 60, 160, 120, '1. Why?\nDirect symptom / observable trigger event.', 'yellow', 2),
      sticky(w2Id, cx - 160, cy - 60, 160, 120, '2. Why?\nImmediate mechanism failure.', 'orange', 3),
      sticky(w3Id, cx + 30, cy - 60, 160, 120, '3. Why?\nOperating standard / procedure gap.', 'pink', 4),
      shape(rootId, cx + 220, cy - 60, 160, 120, '🎯 Root Cause\nSystemic Driver', 'rgba(139, 92, 246, 0.22)', '#8b5cf6', 'hexagon', 5),
      sticky(mitId, cx + 410, cy - 60, 160, 120, '🛡️ Safeguard\nPermanent fix & preventive action.', 'green', 6),
    ];

    return {
      title: '5 Whys Root Cause Analysis',
      nodes,
      relations: [
        relation(probId, w1Id, 'why?', '#f59e0b', 'causes'),
        relation(w1Id, w2Id, 'why?', '#f97316', 'causes'),
        relation(w2Id, w3Id, 'why?', '#ec4899', 'causes'),
        relation(w3Id, rootId, 'uncovers', '#8b5cf6', 'leads_to'),
        relation(rootId, mitId, 'mitigates', '#22c55e', 'mitigates'),
      ],
    };
  }

  if (p.includes('lesson') || p.includes('study') || p.includes('quiz') || p.includes('student') || p.includes('teacher') || p.includes('classroom') || p.includes('education')) {
    const frameId = nanoid(10);
    const topicId = nanoid(10);
    const coreRuleId = nanoid(10);
    const exampleId = nanoid(10);
    const practiceId = nanoid(10);
    const pitfallId = nanoid(10);
    const quizId = nanoid(10);

    const nodes: LivingNode[] = [
      frame(frameId, cx - 540, cy - 290, 1080, 580, `Interactive Learning: ${prompt.slice(0, 36)}`, '#38bdf8'),
      shape(topicId, cx - 110, cy - 40, 220, 110, prompt.slice(0, 36) || 'Core Subject', 'rgba(56, 189, 248, 0.18)', '#38bdf8', 'hexagon', 5),
      sticky(coreRuleId, cx - 480, cy - 220, 250, 140, '💡 Core Principle & Rules\nKey concepts, fundamental formulas, and operational definitions.', 'blue', 1),
      sticky(exampleId, cx + 230, cy - 220, 250, 140, '📝 Worked Examples\nRealistic scenario walkthrough with step-by-step resolution.', 'green', 2),
      sticky(pitfallId, cx - 480, cy + 60, 250, 140, '⚠️ Common Misconceptions\nFrequent errors to avoid and contrast between valid and invalid patterns.', 'pink', 3),
      sticky(practiceId, cx + 230, cy + 60, 250, 140, '✍️ Guided Practice\nInteractive exercises and application challenges for learners.', 'yellow', 4),
      sticky(quizId, cx - 125, cy + 130, 250, 120, '🎯 Check Understanding\n1. Explain the mechanism\n2. Solve edge case\n3. Self-evaluate', 'purple', 6),
    ];

    return {
      title: `Learning Board: ${prompt.slice(0, 32)}`,
      nodes,
      relations: [
        relation(topicId, coreRuleId, 'defines', '#38bdf8', 'explains'),
        relation(coreRuleId, exampleId, 'demonstrated by', '#22c55e', 'example_of'),
        relation(topicId, pitfallId, 'warns against', '#ec4899', 'contradicts'),
        relation(exampleId, practiceId, 'practiced in', '#eab308', 'leads_to'),
        relation(practiceId, quizId, 'evaluates', '#a855f7', 'leads_to'),
      ],
    };
  }

  if (p.includes('field') || p.includes('site') || p.includes('emergency') || p.includes('incident') || p.includes('map') || p.includes('logistics')) {
    const frameId = nanoid(10);
    const mapId = nanoid(10);
    const pinCritical = nanoid(8);
    const pinStaging = nanoid(8);
    const statusId = nanoid(10);
    const teamsId = nanoid(10);
    const evidenceId = nanoid(10);
    const decisionId = nanoid(10);
    const timelineId = nanoid(10);

    const nodes: LivingNode[] = [
      frame(frameId, cx - 520, cy - 270, 980, 560, 'AI Generated Field Operations World', '#ef4444'),
      {
        id: mapId,
        type: 'map',
        position: { x: cx - 480, y: cy - 210 },
        size: { width: 440, height: 330 },
        rotation: 0,
        zIndex: 2,
        locked: false,
        data: {
          center: [20, 0],
          zoom: 2,
          tileLayer: 'hybrid',
          markers: [
            { id: pinCritical, label: 'Priority site', position: [40.7128, -74.0060] },
            { id: pinStaging, label: 'Operations hub', position: [51.5074, -0.1278] },
          ],
          interactive: true,
        },
        createdAt: now(),
        updatedAt: now(),
      },
      sticky(statusId, cx + 10, cy - 210, 280, 130, 'Situation status\nPriority: High\nCoverage: 80%\nAccess: constrained near the priority site', 'yellow', 3),
      sticky(teamsId, cx + 320, cy - 210, 250, 130, 'Team assignments\nAlpha: field survey\nBravo: logistics\nSupport: standby', 'pink', 4),
      sticky(evidenceId, cx + 10, cy - 30, 280, 130, 'Evidence queue\nPhotos, reports, and telemetry readings tied to the marked field locations.', 'blue', 5),
      shape(decisionId, cx + 340, cy - 5, 210, 120, 'Escalate response?', 'rgba(239, 68, 68, 0.16)', '#ef4444', 'diamond', 6),
      sticky(timelineId, cx - 480, cy + 170, 420, 120, 'Next 4 hours\n00:30 ops sync\n01:00 stakeholder update\n02:00 access status review', 'green', 7),
    ];

    return {
      title: 'AI Field Operations World',
      nodes,
      relations: [
        relation(mapId, statusId, 'priority site', '#ef4444', 'leads_to', markerPort(pinCritical)),
        relation(mapId, teamsId, 'operations hub', '#22c55e', 'enables', markerPort(pinStaging)),
        relation(statusId, evidenceId, 'requires proof', '#3b82f6', 'depends_on'),
        relation(evidenceId, decisionId, 'supports decision', '#f59e0b', 'based_on'),
        relation(decisionId, timelineId, 'drives cadence', '#38bdf8', 'leads_to'),
      ],
    };
  }

  if (p.includes('architecture') || p.includes('system') || p.includes('backend') || p.includes('api') || p.includes('cloud') || p.includes('database')) {
    const frameId = nanoid(10);
    const clientId = nanoid(10);
    const apiId = nanoid(10);
    const workerId = nanoid(10);
    const dbId = nanoid(10);
    const obsId = nanoid(10);
    const riskId = nanoid(10);

    const nodes: LivingNode[] = [
      frame(frameId, cx - 500, cy - 240, 980, 500, 'AI Generated Production Architecture', '#22c55e'),
      shape(clientId, cx - 440, cy - 80, 200, 120, 'Web Client', 'rgba(59, 130, 246, 0.16)', '#3b82f6', 'rectangle', 1),
      shape(apiId, cx - 110, cy - 95, 230, 150, 'API Gateway', 'rgba(99, 102, 241, 0.18)', '#6366f1', 'rectangle', 2),
      shape(workerId, cx + 230, cy - 165, 210, 120, 'Async Workers', 'rgba(245, 158, 11, 0.16)', '#f59e0b', 'rectangle', 3),
      shape(dbId, cx + 230, cy + 80, 210, 120, 'Primary Database', 'rgba(34, 197, 94, 0.16)', '#22c55e', 'hexagon', 4),
      sticky(obsId, cx - 110, cy + 125, 230, 120, 'Observability\nLogs, traces, metrics, alert rules, and deployment health.', 'blue', 5),
      sticky(riskId, cx - 440, cy + 115, 220, 130, 'Risk register\nAuth edge cases\nQueue retries\nDatabase backpressure', 'orange', 6),
    ];

    return {
      title: 'AI Production Architecture World',
      nodes,
      relations: [
        relation(clientId, apiId, 'HTTPS / WSS', '#3b82f6', 'leads_to'),
        relation(apiId, workerId, 'background jobs', '#f59e0b', 'leads_to'),
        relation(apiId, dbId, 'queries', '#22c55e', 'depends_on'),
        relation(workerId, dbId, 'writes', '#22c55e', 'depends_on'),
        relation(apiId, obsId, 'emits telemetry', '#38bdf8', 'based_on'),
        relation(riskId, apiId, 'hardening targets', '#ef4444', 'contradicts'),
      ],
    };
  }

  if (p.includes('launch') || p.includes('release') || p.includes('go-to-market') || p.includes('rollout') || p.includes('qa')) {
    const frameId = nanoid(10);
    const scopeId = nanoid(10);
    const qaId = nanoid(10);
    const commsId = nanoid(10);
    const metricsId = nanoid(10);
    const riskId = nanoid(10);
    const ownerId = nanoid(10);
    const codeId = nanoid(10);
    const launchId = nanoid(10);

    const nodes: LivingNode[] = [
      frame(frameId, cx - 545, cy - 290, 1090, 580, 'AI Launch Operating Plan', '#22c55e'),
      sticky(scopeId, cx - 500, cy - 205, 260, 130, 'Scope\nCritical workflows only. Freeze new surface area until quality gates pass.', 'blue', 1),
      shape(qaId, cx - 150, cy - 200, 230, 100, 'Visual QA Gate', 'rgba(6, 182, 212, 0.14)', '#06b6d4', 'rectangle', 2),
      sticky(commsId, cx + 210, cy - 200, 280, 130, 'Comms\nDemo script, release notes, onboarding checklist, and founder narrative.', 'purple', 3),
      sticky(metricsId, cx + 210, cy + 5, 280, 130, 'Metrics\nActivation, export success, template usage, and relation creation completion.', 'green', 4),
      sticky(riskId, cx - 500, cy + 5, 260, 135, 'Risks\nTheme contrast, broken exports, confusing relation creation, and weak models.', 'pink', 5),
      shape(ownerId, cx - 155, cy + 20, 240, 95, 'Owner Review', 'rgba(245, 158, 11, 0.14)', '#f59e0b', 'hexagon', 6),
      codeBlock(codeId, cx - 500, cy + 205, 360, 145, 'quality-gates.ts', 'const gates = [\n  "contrast-pass",\n  "export-pass",\n  "relations-pass",\n  "model-quality-pass"\n];', 7),
      shape(launchId, cx + 240, cy + 195, 200, 95, 'Launch Gate', 'rgba(34, 197, 94, 0.16)', '#22c55e', 'diamond', 8),
    ];

    return {
      title: 'AI Launch Operating Plan',
      nodes,
      relations: [
        relation(scopeId, qaId, 'locks scope', '#3b82f6', 'leads_to'),
        relation(riskId, ownerId, 'reviewed by', '#ef4444', 'depends_on'),
        relation(codeId, ownerId, 'checklist', '#38bdf8', 'based_on'),
        relation(ownerId, qaId, 'approves', '#f59e0b', 'enables'),
        relation(qaId, commsId, 'unblocks', '#8b5cf6', 'enables'),
        relation(commsId, launchId, 'go to market', '#22c55e', 'leads_to'),
        relation(metricsId, launchId, 'success proof', '#22c55e', 'based_on'),
      ],
    };
  }

  if (p.includes('decision') || p.includes('options') || p.includes('tradeoff') || p.includes('risk') || p.includes('owner')) {
    const frameId = nanoid(10);
    const titleId = nanoid(10);
    const decisionId = nanoid(10);
    const evidenceId = nanoid(10);
    const optionAId = nanoid(10);
    const optionBId = nanoid(10);
    const riskId = nanoid(10);
    const ownerId = nanoid(10);
    const actionId = nanoid(10);

    const nodes: LivingNode[] = [
      frame(frameId, cx - 520, cy - 285, 1040, 570, 'AI Decision Intelligence Room', '#f59e0b'),
      textBlock(titleId, cx - 475, cy - 245, 430, 58, prompt.slice(0, 64) || 'Decision that needs a clear owner', 1, 22),
      sticky(evidenceId, cx - 470, cy - 115, 270, 140, 'Evidence\nCustomer signals, usage data, stakeholder input, and constraints gathered before the decision.', 'blue', 2),
      sticky(optionAId, cx - 470, cy + 95, 270, 130, 'Option A\nMove now with a tight release and explicit quality gates.', 'yellow', 3),
      sticky(optionBId, cx - 160, cy + 95, 270, 130, 'Option B\nDelay launch until reliability and workflow gaps are closed.', 'orange', 4),
      shape(decisionId, cx - 80, cy - 65, 220, 120, 'Decision Gate', 'rgba(245, 158, 11, 0.16)', '#f59e0b', 'diamond', 5),
      sticky(riskId, cx + 220, cy - 145, 270, 145, 'Risks\nAmbiguous ownership, weak export confidence, unclear relation meaning, and poor meeting readability.', 'pink', 6),
      shape(ownerId, cx + 225, cy + 60, 250, 90, 'Accountable Owner', 'rgba(139, 92, 246, 0.14)', '#8b5cf6', 'rectangle', 7),
      sticky(actionId, cx + 205, cy + 205, 290, 115, 'Next action\nRun a focused review, publish decision log, and assign the first accountable follow-up.', 'green', 8),
    ];

    return {
      title: 'AI Decision Intelligence Room',
      nodes,
      relations: [
        relation(evidenceId, decisionId, 'supports', '#38bdf8', 'based_on'),
        relation(optionAId, decisionId, 'candidate', '#f59e0b', 'part_of'),
        relation(optionBId, decisionId, 'candidate', '#f59e0b', 'part_of'),
        relation(riskId, decisionId, 'constrains', '#ef4444', 'contradicts'),
        relation(decisionId, ownerId, 'owned by', '#8b5cf6', 'enables'),
        relation(ownerId, actionId, 'commits to', '#22c55e', 'leads_to'),
      ],
    };
  }

  const rootId = nanoid(10);
  const researchId = nanoid(10);
  const problemId = nanoid(10);
  const hypothesisId = nanoid(10);
  const experimentId = nanoid(10);
  const decisionId = nanoid(10);

  const nodes: LivingNode[] = [
    shape(rootId, cx - 110, cy - 65, 220, 130, prompt.slice(0, 42) || 'AI Spatial Brief', 'rgba(139, 92, 246, 0.18)', '#8b5cf6', 'hexagon', 4),
    sticky(researchId, cx - 430, cy - 185, 240, 130, 'Research signals\nInterviews, analytics, field notes, and observed constraints.', 'blue', 1),
    sticky(problemId, cx - 430, cy + 55, 240, 130, 'Priority problem\nThe highest-value pain or operational bottleneck to solve first.', 'orange', 2),
    sticky(hypothesisId, cx + 190, cy - 185, 250, 130, 'Hypothesis\nA clear bet that can be tested with a small real-world experiment.', 'purple', 3),
    sticky(experimentId, cx + 190, cy + 55, 250, 130, 'Experiment plan\nPrototype, measure, and decide whether to ship or iterate.', 'green', 5),
    shape(decisionId, cx - 110, cy + 190, 220, 90, 'Decision Gate', 'rgba(245, 158, 11, 0.16)', '#f59e0b', 'diamond', 6),
  ];

  return {
    title: `AI World: ${prompt.slice(0, 28) || 'Spatial Brief'}`,
    nodes,
    relations: [
      relation(researchId, rootId, 'informs', '#3b82f6', 'based_on'),
      relation(problemId, rootId, 'defines', '#f59e0b', 'part_of'),
      relation(rootId, hypothesisId, 'creates', '#8b5cf6', 'leads_to'),
      relation(hypothesisId, experimentId, 'tested by', '#22c55e', 'depends_on'),
      relation(experimentId, decisionId, 'decision evidence', '#f59e0b', 'based_on'),
    ],
  };
}
