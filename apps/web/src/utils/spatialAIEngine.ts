import { nanoid } from 'nanoid';
import { LivingNode, Relation, useCanvasStore } from '../store/canvasStore';

export interface SpatialAIResult {
  title: string;
  nodes: LivingNode[];
  relations: Relation[];
}

export async function generateSpatialBoardAsync(
  prompt: string,
  provider?: string,
  apiKey?: string,
  model?: string
): Promise<SpatialAIResult> {
  if (!apiKey || !apiKey.trim()) {
    return generateSpatialBoard(prompt);
  }

  try {
    const existingNodes = Object.values(useCanvasStore.getState().nodes);
    let boardContext = '';
    if (existingNodes.length > 0) {
      boardContext = `\n\nExisting Canvas Board Context:\n` + existingNodes.map((n) => {
        const d = n.data as Record<string, any> | undefined;
        const text = String(d?.text || d?.content || d?.title || d?.label || '');
        return `- [${n.type.toUpperCase()}] "${text.slice(0, 150)}"`;
      }).join('\n');
    }

    const fullUserPrompt = `User Request: ${prompt}${boardContext}`;

    const systemPrompt = `You are Spatial AI for Canvio, an infinite canvas knowledge workspace.
Generate a structured spatial knowledge graph for the given user request.
Return ONLY raw JSON with this exact schema (no markdown block wrapper):
{
  "title": "Short title",
  "nodes": [
    {
      "id": "node1",
      "type": "sticky",
      "position": { "x": 0, "y": 0 },
      "size": { "width": 260, "height": 140 },
      "data": {
        "title": "Title (if frame)",
        "color": "blue",
        "text": "Card text content...",
        "label": "Shape label...",
        "shape": "rectangle"
      }
    }
  ],
  "relations": [
    {
      "sourceId": "node1",
      "targetId": "node2",
      "label": "relationship label",
      "relationship": "depends_on"
    }
  ]
}
Types allowed: "sticky", "shape", "text", "frame".
Sticky colors: "blue", "yellow", "green", "pink", "orange", "purple".
Relationships: "depends_on", "leads_to", "enables", "based_on", "contradicts", "part_of", "related_to".
Arrange nodes spatially with sensible X/Y offsets (e.g. 280px apart horizontally, 180px vertically).`;

    let jsonText = '';

    if (provider === 'gemini') {
      const targetModel = model || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey.trim()}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt },
                { text: fullUserPrompt }
              ]
            }
          ]
        })
      });

      if (!resp.ok) throw new Error(`Gemini API HTTP ${resp.status}`);
      const data = await resp.json();
      jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (provider === 'openai') {
      const targetModel = model || 'gpt-4o-mini';
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fullUserPrompt }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (!resp.ok) throw new Error(`OpenAI API HTTP ${resp.status}`);
      const data = await resp.json();
      jsonText = data.choices?.[0]?.message?.content || '';
    } else if (provider === 'anthropic') {
      const targetModel = model || 'claude-3-5-sonnet';
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true'
        },
        body: JSON.stringify({
          model: targetModel,
          max_tokens: 2500,
          system: systemPrompt,
          messages: [{ role: 'user', content: fullUserPrompt }]
        })
      });

      if (!resp.ok) throw new Error(`Anthropic API HTTP ${resp.status}`);
      const data = await resp.json();
      jsonText = data.content?.[0]?.text || '';
    }

    const cleanJson = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    const createdAt = Date.now();
    const formattedNodes: LivingNode[] = (parsed.nodes || []).map((n: any, idx: number) => ({
      id: n.id || nanoid(10),
      type: n.type || 'sticky',
      position: n.position || { x: (idx % 3) * 280, y: Math.floor(idx / 3) * 180 },
      size: n.size || { width: 260, height: 140 },
      rotation: 0,
      zIndex: idx + 1,
      locked: false,
      data: {
        color: n.data?.color || 'blue',
        text: n.data?.text || n.data?.label || '',
        title: n.data?.title || '',
        label: n.data?.label || '',
        shape: n.data?.shape || 'rectangle',
        fill: n.data?.fill || 'rgba(128, 131, 255, 0.12)',
        stroke: n.data?.stroke || '#8083ff',
      },
      createdAt,
      updatedAt: createdAt,
    }));

    const formattedRelations: Relation[] = (parsed.relations || []).map((r: any) => ({
      id: nanoid(10),
      sourceId: r.sourceId,
      targetId: r.targetId,
      label: r.label || 'relates to',
      color: '#8083ff',
      relationship: r.relationship || 'related_to',
    }));

    return {
      title: parsed.title || `AI World: ${prompt.slice(0, 24)}`,
      nodes: formattedNodes,
      relations: formattedRelations,
    };
  } catch (err) {
    console.warn('Real AI generation failed or key was invalid. Falling back to spatial heuristic template.', err);
    return generateSpatialBoard(prompt);
  }
}

export async function expandNodeWithAIAsync(
  targetNode: LivingNode,
): Promise<SpatialAIResult> {
  const provider = (localStorage.getItem('CANVIO_AI_PROVIDER') as string) || 'gemini';
  const keyStorageKey = provider === 'gemini' ? 'CANVIO_GEMINI_KEY' : provider === 'openai' ? 'CANVIO_OPENAI_KEY' : 'CANVIO_ANTHROPIC_KEY';
  const apiKey = localStorage.getItem(keyStorageKey) || localStorage.getItem('CANVIO_AI_API_KEY') || '';
  const model = localStorage.getItem('CANVIO_AI_MODEL') || '';

  const targetData = targetNode.data as Record<string, any> | undefined;
  const nodeContent = String(targetData?.text || targetData?.content || targetData?.title || targetData?.label || 'Concept');
  const prompt = `Given this central node idea: "${nodeContent}", generate 3 distinct sub-topics or logical next steps. Connect each new sub-topic node to this central node (sourceId: "${targetNode.id}").`;

  if (apiKey && apiKey.trim()) {
    try {
      const res = await generateSpatialBoardAsync(prompt, provider, apiKey, model);
      if (res.nodes.length > 0) {
        // Adjust positions relative to target node
        const cx = targetNode.position.x;
        const cy = targetNode.position.y;
        res.nodes.forEach((n, idx) => {
          n.position = {
            x: cx + 320,
            y: cy + (idx - 1) * 160,
          };
        });

        // Ensure relations link back to targetNode.id
        res.nodes.forEach((n) => {
          if (!res.relations.some((r) => r.sourceId === targetNode.id && r.targetId === n.id)) {
            res.relations.push(relation(targetNode.id, n.id, 'expands into', '#8083ff', 'leads_to'));
          }
        });
      }
      return res;
    } catch {
      // Fallback below
    }
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
  relations: Relation[]
): Promise<SpatialAIResult> {
  const provider = (localStorage.getItem('CANVIO_AI_PROVIDER') as string) || 'gemini';
  const keyStorageKey = provider === 'gemini' ? 'CANVIO_GEMINI_KEY' : provider === 'openai' ? 'CANVIO_OPENAI_KEY' : 'CANVIO_ANTHROPIC_KEY';
  const apiKey = localStorage.getItem(keyStorageKey) || localStorage.getItem('CANVIO_AI_API_KEY') || '';
  const model = localStorage.getItem('CANVIO_AI_MODEL') || '';

  const viewport = useCanvasStore.getState().viewport;
  const zoom = viewport.zoom || 1;
  const cx = -viewport.x / zoom + (window.innerWidth / (2 * zoom));
  const cy = -viewport.y / zoom + (window.innerHeight / (2 * zoom));

  const graphSummary = nodes.map((n) => {
    const d = n.data as Record<string, any> | undefined;
    const text = String(d?.text || d?.content || d?.title || d?.label || '');
    return `- [${n.type.toUpperCase()}] "${text.slice(0, 80)}"`;
  }).join('\n');

  const prompt = `Analyze this entire canvas whiteboard graph:\n${graphSummary}\n\nGenerate an executive AI Summary Board with 4 summary cards covering: 1. Core Summary, 2. Key Decisions, 3. Critical Risks, 4. Action Plan.`;

  if (apiKey && apiKey.trim()) {
    try {
      const res = await generateSpatialBoardAsync(prompt, provider, apiKey, model);
      if (res.nodes.length > 0) {
        // Offset generated summary nodes to current viewport center
        res.nodes.forEach((n, idx) => {
          n.position = {
            x: cx - 400 + (idx % 2) * 420,
            y: cy - 200 + Math.floor(idx / 2) * 200,
          };
        });
      }
      return res;
    } catch {
      // Fallback below
    }
  }

  // Fallback heuristic summary
  const frameId = nanoid(10);
  const s1 = nanoid(10);
  const s2 = nanoid(10);
  const s3 = nanoid(10);
  const s4 = nanoid(10);

  const firstNodeData = nodes[0]?.data as Record<string, any> | undefined;
  const firstText = String(firstNodeData?.text || 'Central whiteboard overview and key goals.');

  return {
    title: '✨ AI Executive Summary',
    nodes: [
      frame(frameId, cx - 450, cy - 250, 900, 500, '✨ AI Executive Canvas Summary', '#8083ff'),
      sticky(s1, cx - 410, cy - 180, 400, 180, '📌 Core Vision & Context\n' + firstText, 'purple', 2),
      sticky(s2, cx + 20, cy - 180, 400, 180, '⚡ Key Decisions & Milestones\nIdentified high-impact trade-offs and approvals.', 'green', 3),
      sticky(s3, cx - 410, cy + 30, 400, 180, '🚨 Critical Risks & Dependencies\nOperational bottlenecks and quality gates to monitor.', 'pink', 4),
      sticky(s4, cx + 20, cy + 30, 400, 180, '🎯 Next Action Plan\nAssigned owners, immediate deliverables, and review dates.', 'blue', 5),
    ],
    relations: [
      relation(s1, s2, 'leads to', '#8b5cf6', 'leads_to'),
      relation(s3, s2, 'constrains', '#ef4444', 'contradicts'),
      relation(s2, s4, 'enables', '#22c55e', 'enables'),
    ],
  };
}

export async function organizeAndClusterWithAIAsync(
  nodes: LivingNode[],
  updateNode: (id: string, patch: Partial<LivingNode>) => void,
  addNode: (node: LivingNode) => void
): Promise<{ clustersCount: number }> {
  if (nodes.length === 0) return { clustersCount: 0 };

  const provider = (localStorage.getItem('CANVIO_AI_PROVIDER') as string) || 'gemini';
  const keyStorageKey = provider === 'gemini' ? 'CANVIO_GEMINI_KEY' : provider === 'openai' ? 'CANVIO_OPENAI_KEY' : 'CANVIO_ANTHROPIC_KEY';
  const apiKey = localStorage.getItem(keyStorageKey) || localStorage.getItem('CANVIO_AI_API_KEY') || '';

  // Group nodes into 3 columns (clusters)
  const CLUSTER_PRESETS = [
    { title: '💡 Strategy & Ideas', color: '#8b5cf6', stickyColor: 'purple' },
    { title: '⚡ Execution & Tasks', color: '#22c55e', stickyColor: 'green' },
    { title: '🚨 Risks & Review', color: '#f59e0b', stickyColor: 'orange' },
  ];

  const total = nodes.length;
  const nodesPerCluster = Math.ceil(total / 3);

  nodes.forEach((n, idx) => {
    const clusterIdx = Math.min(2, Math.floor(idx / nodesPerCluster));
    const inClusterPos = idx % nodesPerCluster;
    const colX = (clusterIdx - 1) * 380;
    const rowY = inClusterPos * 180;

    updateNode(n.id, {
      position: { x: colX, y: rowY },
      ...(n.type === 'sticky' ? { data: { ...n.data, color: CLUSTER_PRESETS[clusterIdx].stickyColor } } : {}),
    });
  });

  // Create 3 Frame clusters around them
  CLUSTER_PRESETS.forEach((cp, idx) => {
    const colX = (idx - 1) * 380 - 20;
    const frameNode = frame(
      nanoid(10),
      colX,
      -60,
      340,
      Math.max(300, nodesPerCluster * 180 + 80),
      cp.title,
      cp.color
    );
    addNode(frameNode);
  });

  return { clustersCount: 3 };
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

function textBlock(id: string, x: number, y: number, width: number, height: number, content: string, zIndex: number, fontSize = 20): LivingNode {
  return {
    id,
    type: 'text',
    position: { x, y },
    size: { width, height },
    rotation: 0,
    zIndex,
    locked: false,
    data: { content, fontSize, fontWeight: 'bold', textAlign: 'left', color: 'var(--text-primary)' },
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
