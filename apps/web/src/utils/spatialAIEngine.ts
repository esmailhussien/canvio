import { nanoid } from 'nanoid';
import { LivingNode, Relation, useCanvasStore } from '../store/canvasStore';

export interface SpatialAIResult {
  title: string;
  nodes: LivingNode[];
  relations: Relation[];
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
