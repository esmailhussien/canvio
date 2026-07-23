import { nanoid } from 'nanoid';
import { LivingNode, Relation, useCanvasStore } from '../store/canvasStore';
import { fitViewportToNodes } from './viewportFit';

export interface CanvasTemplate {
  id: string;
  name: string;
  description: string;
  outcome: string;
  category: string;
  icon: string;
  accent: string;
  nodes: number;
  relations: number;
  preview: 'spatial' | 'flow' | 'radial' | 'system' | 'wall';
  generate: () => { nodes: LivingNode[]; relations: Relation[] };
}

const now = () => Date.now();
const markerPort = (id: string) => `marker:${id}`;

function shape(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  data: Record<string, unknown>,
  zIndex: number
): LivingNode {
  return {
    id,
    type: 'shape',
    position: { x, y },
    size: { width, height },
    rotation: 0,
    zIndex,
    locked: false,
    data,
    createdAt: now(),
    updatedAt: now(),
  };
}

function sticky(id: string, x: number, y: number, text: string, color: string, zIndex: number): LivingNode {
  return {
    id,
    type: 'sticky',
    position: { x, y },
    size: { width: 220, height: 132 },
    rotation: 0,
    zIndex,
    locked: false,
    data: { color, text },
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
  fontSize = 18
): LivingNode {
  return {
    id,
    type: 'text',
    position: { x, y },
    size: { width, height },
    rotation: 0,
    zIndex,
    locked: false,
    data: {
      content,
      fontSize,
      fontWeight: 'bold',
      textAlign: 'left',
      color: 'var(--text-primary)',
    },
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
    data: {
      language: 'typescript',
      filename,
      code,
    },
    createdAt: now(),
    updatedAt: now(),
  };
}

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

export const TEMPLATES: CanvasTemplate[] = [
  {
    id: 'site-visit-map',
    name: 'Field Operations Map',
    description: 'A global map with field pins, issue notes, evidence, and semantic relations attached to exact locations.',
    outcome: 'Best for site visits, logistics, inspections, emergency response, and field coordination.',
    category: 'Maps & field work',
    icon: 'map-pin',
    accent: '#38bdf8',
    nodes: 5,
    relations: 4,
    preview: 'spatial',
    generate: () => {
      const mapId = nanoid(10);
      const markerA = nanoid(8);
      const markerB = nanoid(8);
      const riskId = nanoid(10);
      const actionId = nanoid(10);
      const evidenceId = nanoid(10);
      const summaryId = nanoid(10);

      const nodes: LivingNode[] = [
        {
          id: mapId,
          type: 'map',
          position: { x: -420, y: -190 },
          size: { width: 520, height: 360 },
          rotation: 0,
          zIndex: 2,
          locked: false,
          data: {
            center: [20, 0],
            zoom: 2,
            tileLayer: 'satellite',
            markers: [
              { id: markerA, label: 'Inspection point', position: [40.7128, -74.0060] },
              { id: markerB, label: 'Logistics hub', position: [51.5074, -0.1278] },
            ],
            interactive: true,
          },
          createdAt: now(),
          updatedAt: now(),
        },
        sticky(riskId, 160, -170, 'Risk note\n- Access constraints\n- Weather or site conditions\n- Needs field confirmation', 'orange', 3),
        sticky(actionId, 160, 10, 'Action plan\n- Assign owner\n- Document before/after evidence\n- Update status on schedule', 'green', 4),
        sticky(evidenceId, -420, 210, 'Evidence log\nPhotos, reports, and sensor readings collected near the marked locations.', 'blue', 5),
        shape(summaryId, 160, 190, 240, 92, {
          shape: 'rectangle',
          fill: 'rgba(56, 189, 248, 0.16)',
          stroke: '#38bdf8',
          strokeWidth: 2,
          label: 'Field Summary',
        }, 6),
      ];

      const relations: Relation[] = [
        relation(mapId, riskId, 'observed at', '#ef4444', 'based_on', markerPort(markerA)),
        relation(mapId, actionId, 'coordinated at', '#22c55e', 'leads_to', markerPort(markerB)),
        relation(riskId, summaryId, 'rolls up to', '#f59e0b', 'part_of'),
        relation(evidenceId, summaryId, 'supports', '#38bdf8', 'based_on'),
      ];

      return { nodes, relations };
    },
  },
  {
    id: 'emergency-response',
    name: 'Incident Response Board',
    description: 'Map, status cards, incident notes, and response flow arranged as an operations-room board.',
    outcome: 'Best for live incidents, risk response, command centers, and planning drills.',
    category: 'Operations',
    icon: 'activity',
    accent: '#ef4444',
    nodes: 7,
    relations: 5,
    preview: 'spatial',
    generate: () => {
      const fId = nanoid(10);
      const mapId = nanoid(10);
      const pinA = nanoid(8);
      const statusId = nanoid(10);
      const teamId = nanoid(10);
      const resourceId = nanoid(10);
      const commsId = nanoid(10);
      const decisionId = nanoid(10);

      const nodes: LivingNode[] = [
        frame(fId, -480, -250, 880, 520, 'Incident Response World', '#ef4444'),
        {
          id: mapId,
          type: 'map',
          position: { x: -440, y: -190 },
          size: { width: 380, height: 300 },
          rotation: 0,
          zIndex: 2,
          locked: false,
          data: {
            center: [20, 0],
            zoom: 2,
            tileLayer: 'hybrid',
            markers: [{ id: pinA, label: 'Critical incident zone', position: [34.0522, -118.2437] }],
            interactive: true,
          },
          createdAt: now(),
          updatedAt: now(),
        },
        sticky(statusId, 0, -190, 'Current status\nSeverity: High\nEvacuation: 80%\nRoad access: Limited', 'yellow', 3),
        sticky(teamId, 260, -190, 'Teams\nAlpha: field survey\nBravo: pump station\nMedical: standby', 'pink', 4),
        sticky(resourceId, 0, 20, 'Resources\n- 4 pumps\n- 2 transport vehicles\n- Mobile power unit', 'green', 5),
        sticky(commsId, 260, 20, 'Comms cadence\nOps sync every 30 min\nPublic update every 2 hours', 'blue', 6),
        shape(decisionId, -245, 155, 220, 90, {
          shape: 'diamond',
          fill: 'rgba(239, 68, 68, 0.16)',
          stroke: '#ef4444',
          strokeWidth: 2,
          label: 'Escalate?',
        }, 7),
      ];

      const relations = [
        relation(mapId, statusId, 'critical zone', '#ef4444', 'leads_to', markerPort(pinA)),
        relation(statusId, teamId, 'assigns', '#a855f7', 'enables'),
        relation(teamId, resourceId, 'needs', '#22c55e', 'depends_on'),
        relation(resourceId, decisionId, 'capacity check', '#f59e0b', 'based_on'),
        relation(decisionId, commsId, 'public update', '#38bdf8', 'leads_to'),
      ];

      return { nodes, relations };
    },
  },
  {
    id: 'product-discovery',
    name: 'Product Discovery Sprint',
    description: 'Research, problems, hypotheses, experiments, and decisions connected into a fast product strategy map.',
    outcome: 'Best for product teams, founders, consultants, and UX discovery workshops.',
    category: 'Strategy',
    icon: 'target',
    accent: '#8b5cf6',
    nodes: 7,
    relations: 6,
    preview: 'radial',
    generate: () => {
      const rootId = nanoid(10);
      const researchId = nanoid(10);
      const problemId = nanoid(10);
      const hypoId = nanoid(10);
      const experimentId = nanoid(10);
      const metricId = nanoid(10);
      const decisionId = nanoid(10);

      const nodes = [
        shape(rootId, -110, -70, 220, 110, { shape: 'hexagon', fill: 'rgba(139, 92, 246, 0.18)', stroke: '#8b5cf6', strokeWidth: 2, label: 'Discovery Sprint' }, 5),
        sticky(researchId, -420, -190, 'Research inputs\nInterviews, analytics, support tickets, and competitive signals.', 'blue', 1),
        sticky(problemId, -420, 60, 'Priority problem\nWhat user pain is urgent, frequent, and valuable to solve?', 'orange', 2),
        sticky(hypoId, 190, -190, 'Hypothesis\nIf we reduce setup time, more teams will invite collaborators.', 'purple', 3),
        sticky(experimentId, 190, 60, 'Experiment\nPrototype the 1-click share flow and observe first-session behavior.', 'green', 4),
        shape(metricId, -110, 180, 220, 90, { shape: 'rectangle', fill: 'rgba(34, 197, 94, 0.14)', stroke: '#22c55e', strokeWidth: 2, label: 'Activation metric' }, 6),
        shape(decisionId, 190, 210, 220, 90, { shape: 'rectangle', fill: 'rgba(245, 158, 11, 0.14)', stroke: '#f59e0b', strokeWidth: 2, label: 'Ship / Iterate' }, 7),
      ];

      return {
        nodes,
        relations: [
          relation(researchId, rootId, 'informs', '#3b82f6', 'based_on'),
          relation(problemId, rootId, 'defines', '#f59e0b', 'part_of'),
          relation(rootId, hypoId, 'creates', '#8b5cf6', 'leads_to'),
          relation(hypoId, experimentId, 'tested by', '#22c55e', 'depends_on'),
          relation(experimentId, metricId, 'measured by', '#22c55e', 'based_on'),
          relation(metricId, decisionId, 'decision gate', '#f59e0b', 'leads_to'),
        ],
      };
    },
  },
  {
    id: 'system-architecture',
    name: 'System Architecture Map',
    description: 'Client, API, workers, database, and observability nodes connected with labeled technical dependencies.',
    outcome: 'Best for engineering diagrams, implementation planning, and architecture reviews.',
    category: 'Engineering',
    icon: 'network',
    accent: '#22c55e',
    nodes: 6,
    relations: 5,
    preview: 'system',
    generate: () => {
      const frameId = nanoid(10);
      const clientId = nanoid(10);
      const apiId = nanoid(10);
      const workerId = nanoid(10);
      const dbId = nanoid(10);
      const obsId = nanoid(10);

      const nodes = [
        frame(frameId, -430, -210, 820, 420, 'Production Architecture', '#22c55e'),
        shape(clientId, -380, -70, 180, 110, { shape: 'rectangle', fill: 'rgba(59, 130, 246, 0.15)', stroke: '#3b82f6', strokeWidth: 2, label: 'Web Client' }, 1),
        shape(apiId, -90, -80, 220, 130, { shape: 'rectangle', fill: 'rgba(99, 102, 241, 0.16)', stroke: '#6366f1', strokeWidth: 2, label: 'API Gateway' }, 2),
        shape(workerId, 220, -150, 180, 110, { shape: 'rectangle', fill: 'rgba(245, 158, 11, 0.16)', stroke: '#f59e0b', strokeWidth: 2, label: 'Workers' }, 3),
        shape(dbId, 220, 70, 180, 110, { shape: 'hexagon', fill: 'rgba(34, 197, 94, 0.16)', stroke: '#22c55e', strokeWidth: 2, label: 'Database' }, 4),
        sticky(obsId, -90, 120, 'Observability\nLogs, traces, metrics, alerts, and deployment health.', 'blue', 5),
      ];

      return {
        nodes,
        relations: [
          relation(clientId, apiId, 'HTTPS / WSS', '#3b82f6', 'leads_to'),
          relation(apiId, workerId, 'jobs', '#f59e0b', 'leads_to'),
          relation(apiId, dbId, 'reads/writes', '#22c55e', 'depends_on'),
          relation(workerId, dbId, 'updates', '#22c55e', 'depends_on'),
          relation(apiId, obsId, 'emits telemetry', '#38bdf8', 'based_on'),
        ],
      };
    },
  },
  {
    id: 'decision-intelligence-room',
    name: 'Decision Intelligence Room',
    description: 'A structured decision board with options, evidence, tradeoffs, risks, owner, and next action.',
    outcome: 'Best for executive decisions, product calls, investment reviews, and high-stakes prioritization.',
    category: 'Decision work',
    icon: 'decision',
    accent: '#f59e0b',
    nodes: 8,
    relations: 7,
    preview: 'flow',
    generate: () => {
      const frameId = nanoid(10);
      const titleId = nanoid(10);
      const decisionId = nanoid(10);
      const optionAId = nanoid(10);
      const optionBId = nanoid(10);
      const evidenceId = nanoid(10);
      const riskId = nanoid(10);
      const ownerId = nanoid(10);
      const actionId = nanoid(10);

      const nodes: LivingNode[] = [
        frame(frameId, -500, -280, 1000, 560, 'Decision Intelligence Room', '#f59e0b'),
        textBlock(titleId, -455, -250, 380, 58, 'What decision must be made now?', 1, 22),
        shape(decisionId, -120, -80, 240, 120, {
          shape: 'diamond',
          fill: 'rgba(245, 158, 11, 0.16)',
          stroke: '#f59e0b',
          strokeWidth: 2,
          label: 'Decision Gate',
        }, 4),
        sticky(optionAId, -450, -110, 'Option A\nMove fast with a focused release and limited scope.', 'yellow', 2),
        sticky(optionBId, -450, 90, 'Option B\nDelay release and solve the enterprise gaps first.', 'orange', 3),
        sticky(evidenceId, 190, -200, 'Evidence\n- 7 user calls\n- Support themes\n- Activation data\n- Competitive pressure', 'blue', 5),
        sticky(riskId, 190, 0, 'Risk register\n- Trust damage if export fails\n- UX friction in live workshops\n- Unclear ownership after decision', 'pink', 6),
        shape(ownerId, -120, 150, 220, 82, {
          shape: 'rectangle',
          fill: 'rgba(139, 92, 246, 0.14)',
          stroke: '#8b5cf6',
          strokeWidth: 2,
          label: 'Accountable Owner',
        }, 7),
        sticky(actionId, 190, 165, 'Next action\nRun a 48-hour prototype review, decide by Friday, publish decision log.', 'green', 8),
      ];

      return {
        nodes,
        relations: [
          relation(optionAId, decisionId, 'candidate', '#f59e0b', 'part_of'),
          relation(optionBId, decisionId, 'candidate', '#f59e0b', 'part_of'),
          relation(evidenceId, decisionId, 'supports', '#38bdf8', 'based_on'),
          relation(riskId, decisionId, 'constrains', '#ef4444', 'contradicts'),
          relation(decisionId, ownerId, 'owned by', '#8b5cf6', 'enables'),
          relation(ownerId, actionId, 'commits to', '#22c55e', 'leads_to'),
          relation(evidenceId, riskId, 'qualifies', '#6366f1', 'related_to'),
        ],
      };
    },
  },
  {
    id: 'research-evidence-wall',
    name: 'Research Evidence Wall',
    description: 'A synthesis wall that turns raw signals into insights, opportunities, confidence, and decisions.',
    outcome: 'Best for UX research, market discovery, customer development, and workshop synthesis.',
    category: 'Research',
    icon: 'research',
    accent: '#06b6d4',
    nodes: 9,
    relations: 8,
    preview: 'wall',
    generate: () => {
      const frameId = nanoid(10);
      const interviewsId = nanoid(10);
      const analyticsId = nanoid(10);
      const supportId = nanoid(10);
      const insightId = nanoid(10);
      const opportunityId = nanoid(10);
      const confidenceId = nanoid(10);
      const decisionId = nanoid(10);
      const backlogId = nanoid(10);
      const quoteId = nanoid(10);

      const nodes: LivingNode[] = [
        frame(frameId, -520, -285, 1040, 570, 'Research Evidence Wall', '#06b6d4'),
        sticky(interviewsId, -470, -215, 'Interviews\nUsers need a faster way to explain relationships during live calls.', 'blue', 1),
        sticky(analyticsId, -470, -20, 'Analytics\nDrop-off happens after users add 6+ objects but before sharing.', 'green', 2),
        sticky(supportId, -470, 175, 'Support tickets\nExport reliability and contrast are repeated trust blockers.', 'orange', 3),
        shape(insightId, -120, -95, 250, 110, {
          shape: 'hexagon',
          fill: 'rgba(6, 182, 212, 0.14)',
          stroke: '#06b6d4',
          strokeWidth: 2,
          label: 'Core Insight',
        }, 4),
        sticky(opportunityId, 185, -215, 'Opportunity\nMake relations feel effortless and presentation-ready.', 'purple', 5),
        shape(confidenceId, 205, -25, 230, 88, {
          shape: 'rectangle',
          fill: 'rgba(34, 197, 94, 0.14)',
          stroke: '#22c55e',
          strokeWidth: 2,
          label: 'Confidence: Medium',
        }, 6),
        shape(decisionId, 185, 150, 250, 100, {
          shape: 'diamond',
          fill: 'rgba(245, 158, 11, 0.14)',
          stroke: '#f59e0b',
          strokeWidth: 2,
          label: 'Prioritize Polish',
        }, 7),
        sticky(backlogId, -120, 165, 'Backlog slice\n- Relation QA\n- Theme contrast\n- Template upgrades\n- Export proof', 'yellow', 8),
        textBlock(quoteId, -110, 55, 270, 54, '"I need the board to explain itself in the meeting."', 9, 15),
      ];

      return {
        nodes,
        relations: [
          relation(interviewsId, insightId, 'signal', '#38bdf8', 'based_on'),
          relation(analyticsId, insightId, 'signal', '#22c55e', 'based_on'),
          relation(supportId, insightId, 'signal', '#f59e0b', 'based_on'),
          relation(insightId, opportunityId, 'reveals', '#06b6d4', 'leads_to'),
          relation(opportunityId, confidenceId, 'validated by', '#22c55e', 'based_on'),
          relation(confidenceId, decisionId, 'decision gate', '#f59e0b', 'leads_to'),
          relation(decisionId, backlogId, 'creates', '#8b5cf6', 'leads_to'),
          relation(quoteId, insightId, 'human proof', '#38bdf8', 'based_on'),
        ],
      };
    },
  },
  {
    id: 'launch-operating-plan',
    name: 'Launch Operating Plan',
    description: 'A launch command board with milestones, risks, owners, comms, metrics, and implementation notes.',
    outcome: 'Best for go-to-market launches, internal rollouts, delivery planning, and release readiness.',
    category: 'Execution',
    icon: 'launch',
    accent: '#22c55e',
    nodes: 9,
    relations: 8,
    preview: 'flow',
    generate: () => {
      const frameId = nanoid(10);
      const scopeId = nanoid(10);
      const buildId = nanoid(10);
      const qaId = nanoid(10);
      const commsId = nanoid(10);
      const metricsId = nanoid(10);
      const riskId = nanoid(10);
      const ownerId = nanoid(10);
      const codeId = nanoid(10);
      const goId = nanoid(10);

      const nodes: LivingNode[] = [
        frame(frameId, -540, -290, 1080, 580, 'Launch Operating Plan', '#22c55e'),
        sticky(scopeId, -485, -205, 'Scope\nCritical workflows only. No new surface area after freeze.', 'blue', 1),
        shape(buildId, -190, -205, 210, 92, {
          shape: 'rectangle',
          fill: 'rgba(99, 102, 241, 0.14)',
          stroke: '#6366f1',
          strokeWidth: 2,
          label: 'Build Freeze',
        }, 2),
        shape(qaId, 110, -205, 210, 92, {
          shape: 'rectangle',
          fill: 'rgba(6, 182, 212, 0.14)',
          stroke: '#06b6d4',
          strokeWidth: 2,
          label: 'Visual QA',
        }, 3),
        sticky(commsId, 340, -55, 'Comms\nDemo script, release notes, onboarding checklist, founder narrative.', 'purple', 4),
        sticky(metricsId, 110, 115, 'Metrics\nActivation, export success, template use, relation creation completion.', 'green', 5),
        sticky(riskId, -485, 70, 'Risks\nTheme contrast, broken exports, confusing relation creation, weak templates.', 'pink', 6),
        shape(ownerId, -190, 90, 210, 92, {
          shape: 'hexagon',
          fill: 'rgba(245, 158, 11, 0.14)',
          stroke: '#f59e0b',
          strokeWidth: 2,
          label: 'Owner Review',
        }, 7),
        codeBlock(codeId, -485, 205, 360, 150, 'release-checklist.ts', 'const gates = [\n  "exports-pass",\n  "contrast-pass",\n  "relations-pass",\n  "templates-pass"\n];', 8),
        shape(goId, 340, 145, 180, 88, {
          shape: 'diamond',
          fill: 'rgba(34, 197, 94, 0.16)',
          stroke: '#22c55e',
          strokeWidth: 2,
          label: 'Launch',
        }, 9),
      ];

      return {
        nodes,
        relations: [
          relation(scopeId, buildId, 'locks', '#3b82f6', 'leads_to'),
          relation(buildId, qaId, 'ready for', '#06b6d4', 'leads_to'),
          relation(qaId, commsId, 'unblocks', '#8b5cf6', 'enables'),
          relation(riskId, ownerId, 'reviewed by', '#ef4444', 'depends_on'),
          relation(ownerId, qaId, 'approves', '#f59e0b', 'enables'),
          relation(codeId, ownerId, 'checklist', '#38bdf8', 'based_on'),
          relation(metricsId, goId, 'success proof', '#22c55e', 'based_on'),
          relation(commsId, goId, 'go to market', '#22c55e', 'leads_to'),
        ],
      };
    },
  },
  {
    id: 'agile-kanban-flow',
    name: 'Agile Sprint Kanban Board',
    description: 'Backlog, To Do, In Progress, Review, and Done swimlanes with task stickies and dependency relations.',
    outcome: 'Best for engineering teams, sprint planning, task tracking, and cross-functional agile workflows.',
    category: 'Operations & Execution',
    icon: 'view_kanban',
    accent: '#a855f7',
    nodes: 10,
    relations: 4,
    preview: 'flow',
    generate: () => {
      const f1 = frame(nanoid(10), -580, -260, 220, 520, 'Backlog', '#94a3b8');
      const f2 = frame(nanoid(10), -340, -260, 220, 520, 'To Do', '#38bdf8');
      const f3 = frame(nanoid(10), -100, -260, 220, 520, 'In Progress', '#f59e0b');
      const f4 = frame(nanoid(10), 140, -260, 220, 520, 'In Review', '#a855f7');
      const f5 = frame(nanoid(10), 380, -260, 220, 520, 'Done', '#22c55e');

      const t1 = sticky(nanoid(10), -560, -190, 'User auth flow\n- OAuth login\n- JWT refresh', 'blue', 1);
      const t2 = sticky(nanoid(10), -320, -190, 'Canvas export fix\n- PDF generation\n- Hi-DPI PNG', 'yellow', 2);
      const t3 = sticky(nanoid(10), -80, -190, 'Multiplayer sync\n- Yjs provider\n- Cursor latency', 'orange', 3);
      const t4 = sticky(nanoid(10), 160, -190, 'Template library redesign\n- Category filters\n- Theme toggle', 'purple', 4);
      const t5 = sticky(nanoid(10), 400, -190, 'Dark mode polish\n- Contrast audit\n- CSS variables', 'green', 5);

      return {
        nodes: [f1, f2, f3, f4, f5, t1, t2, t3, t4, t5],
        relations: [
          relation(t1.id, t2.id, 'blocks', '#ef4444', 'depends_on'),
          relation(t2.id, t3.id, 'next in line', '#f59e0b', 'leads_to'),
          relation(t3.id, t4.id, 'submits to', '#a855f7', 'leads_to'),
          relation(t4.id, t5.id, 'merged to', '#22c55e', 'leads_to'),
        ],
      };
    },
  },
  {
    id: 'brainstorming-mind-map',
    name: 'Brainstorming Mind Map',
    description: 'Central core theme radiating into 4 thematic cluster frames with sticky notes and directional relations.',
    outcome: 'Best for team ideation workshops, feature brainstorming, problem solving, and creative strategy.',
    category: 'Strategy & Brainstorming',
    icon: 'lightbulb',
    accent: '#38bdf8',
    nodes: 9,
    relations: 4,
    preview: 'radial',
    generate: () => {
      const coreId = nanoid(10);
      const fUser = frame(nanoid(10), -460, -260, 320, 240, 'User Needs & Pain Points', '#38bdf8');
      const fTech = frame(nanoid(10), 140, -260, 320, 240, 'Technical Feasibility', '#22c55e');
      const fMarket = frame(nanoid(10), -460, 50, 320, 240, 'Market Differentiation', '#a855f7');
      const fRisk = frame(nanoid(10), 140, 50, 320, 240, 'Risks & Dependencies', '#ef4444');

      const cCenter = shape(coreId, -110, -50, 220, 100, {
        shape: 'ellipse',
        fill: 'rgba(56, 189, 248, 0.2)',
        stroke: '#38bdf8',
        strokeWidth: 2.5,
        label: 'Core Strategy Theme',
      }, 5);

      const s1 = sticky(nanoid(10), -440, -190, 'Instant sharing without signup', 'blue', 1);
      const s2 = sticky(nanoid(10), 160, -190, 'Local-first offline sync', 'green', 2);
      const s3 = sticky(nanoid(10), -440, 120, 'Open source canvas engine', 'purple', 3);
      const s4 = sticky(nanoid(10), 160, 120, 'Performance at 10k nodes', 'pink', 4);

      return {
        nodes: [fUser, fTech, fMarket, fRisk, cCenter, s1, s2, s3, s4],
        relations: [
          relation(coreId, s1.id, 'user drive', '#38bdf8', 'leads_to'),
          relation(coreId, s2.id, 'tech pillar', '#22c55e', 'leads_to'),
          relation(coreId, s3.id, 'growth edge', '#a855f7', 'leads_to'),
          relation(coreId, s4.id, 'risk check', '#ef4444', 'leads_to'),
        ],
      };
    },
  },
  {
    id: 'swot-strategic-canvas',
    name: 'SWOT Strategic Matrix',
    description: '4 quadrant frames (Strengths, Weaknesses, Opportunities, Threats) linked to a central Action Plan node.',
    outcome: 'Best for quarterly business reviews, competitive analysis, strategic planning, and leadership syncs.',
    category: 'Strategy & Brainstorming',
    icon: 'grid_view',
    accent: '#f59e0b',
    nodes: 9,
    relations: 4,
    preview: 'wall',
    generate: () => {
      const fS = frame(nanoid(10), -460, -260, 320, 240, 'Strengths (Internal)', '#22c55e');
      const fW = frame(nanoid(10), 140, -260, 320, 240, 'Weaknesses (Internal)', '#ef4444');
      const fO = frame(nanoid(10), -460, 50, 320, 240, 'Opportunities (External)', '#38bdf8');
      const fT = frame(nanoid(10), 140, 50, 320, 240, 'Threats (External)', '#f59e0b');

      const actionId = nanoid(10);
      const cAction = shape(actionId, -120, -50, 240, 100, {
        shape: 'hexagon',
        fill: 'rgba(245, 158, 11, 0.2)',
        stroke: '#f59e0b',
        strokeWidth: 2.5,
        label: 'Strategic Action Plan',
      }, 5);

      const sS = sticky(nanoid(10), -440, -190, 'High UX speed & spatial clarity', 'green', 1);
      const sW = sticky(nanoid(10), 160, -190, 'Mobile touch optimization needed', 'pink', 2);
      const sO = sticky(nanoid(10), -440, 120, 'Expand AI spatial navigator', 'blue', 3);
      const sT = sticky(nanoid(10), 160, 120, 'Rapid competitor feature cloning', 'yellow', 4);

      return {
        nodes: [fS, fW, fO, fT, cAction, sS, sW, sO, sT],
        relations: [
          relation(sS.id, actionId, 'leverages', '#22c55e', 'enables'),
          relation(sW.id, actionId, 'mitigates', '#ef4444', 'depends_on'),
          relation(sO.id, actionId, 'captures', '#38bdf8', 'leads_to'),
          relation(sT.id, actionId, 'defends against', '#f59e0b', 'contradicts'),
        ],
      };
    },
  },
  {
    id: 'user-journey-map',
    name: 'Customer Journey & UX Map',
    description: 'Multi-phase journey steps (Awareness, Onboarding, Core Use, Retention) with user touchpoints and friction notes.',
    outcome: 'Best for UX designers, product managers, customer success, and service design mapping.',
    category: 'Research & UX',
    icon: 'map',
    accent: '#06b6d4',
    nodes: 9,
    relations: 4,
    preview: 'flow',
    generate: () => {
      const f1 = frame(nanoid(10), -580, -220, 220, 440, '1. Discovery & Arrival', '#38bdf8');
      const f2 = frame(nanoid(10), -340, -220, 220, 440, '2. First Board Created', '#a855f7');
      const f3 = frame(nanoid(10), -100, -220, 220, 440, '3. Deep Collaboration', '#22c55e');
      const f4 = frame(nanoid(10), 140, -220, 220, 440, '4. Daily Retention', '#f59e0b');

      const s1 = sticky(nanoid(10), -560, -150, 'Lands on home page\n- Reads value prop\n- Clicks Create World', 'blue', 1);
      const s2 = sticky(nanoid(10), -320, -150, 'Creates sticky notes\n- Uses template picker\n- Invites teammate', 'purple', 2);
      const s3 = sticky(nanoid(10), -80, -150, 'Live multiplayer call\n- Real-time cursors\n- Spatial AI queries', 'green', 3);
      const s4 = sticky(nanoid(10), 160, -150, 'Exports board output\n- Shares URL link\n- Returns weekly', 'yellow', 4);

      const friction = sticky(nanoid(10), -320, 70, 'Friction point\nFirst time users need a 10-second interactive guided hint.', 'pink', 5);

      return {
        nodes: [f1, f2, f3, f4, s1, s2, s3, s4, friction],
        relations: [
          relation(s1.id, s2.id, 'transitions to', '#38bdf8', 'leads_to'),
          relation(s2.id, s3.id, 'expands to', '#a855f7', 'leads_to'),
          relation(s3.id, s4.id, 'retains as', '#22c55e', 'leads_to'),
          relation(friction.id, s2.id, 'blocks onboarding', '#ef4444', 'contradicts'),
        ],
      };
    },
  },
  {
    id: 'spatial-ai-research-lab',
    name: 'Spatial AI & RAG Pipeline Hub',
    description: 'Prompt Inputs, Vector Knowledge Base, Model Inference, and Output evaluation nodes for AI engineering.',
    outcome: 'Best for AI developers, prompt engineers, LLM product teams, and spatial AI architecture.',
    category: 'Decision & Spatial AI',
    icon: 'psychology',
    accent: '#6366f1',
    nodes: 6,
    relations: 4,
    preview: 'system',
    generate: () => {
      const f1 = frame(nanoid(10), -480, -240, 960, 480, 'Spatial AI Knowledge Pipeline', '#6366f1');
      const inputId = nanoid(10);
      const ragId = nanoid(10);
      const modelId = nanoid(10);
      const evalId = nanoid(10);
      const outputId = nanoid(10);

      const nInput = sticky(inputId, -430, -150, 'User Prompt\n"Summarize key decision risks on this canvas map."', 'blue', 1);
      const nRag = shape(ragId, -150, -150, 220, 110, {
        shape: 'hexagon',
        fill: 'rgba(99, 102, 241, 0.18)',
        stroke: '#6366f1',
        strokeWidth: 2,
        label: 'Vector Store RAG',
      }, 2);
      const nModel = shape(modelId, 140, -150, 220, 110, {
        shape: 'rectangle',
        fill: 'rgba(168, 85, 247, 0.18)',
        stroke: '#a855f7',
        strokeWidth: 2,
        label: 'Spatial LLM Model',
      }, 3);
      const nEval = sticky(evalId, -150, 70, 'Eval Metrics\n- Relevance: 94%\n- Latency: 320ms\n- Token cost: $0.002', 'green', 4);
      const nOut = sticky(outputId, 140, 70, 'Canvas Action\nGenerates structured summary note & highlights risk nodes.', 'purple', 5);

      return {
        nodes: [f1, nInput, nRag, nModel, nEval, nOut],
        relations: [
          relation(inputId, ragId, 'queries context', '#38bdf8', 'leads_to'),
          relation(ragId, modelId, 'injects embeddings', '#6366f1', 'enables'),
          relation(modelId, nOut.id, 'streams response', '#a855f7', 'leads_to'),
          relation(ragId, evalId, 'logs benchmark', '#22c55e', 'based_on'),
        ],
      };
    },
  },
];

export function applyTemplate(templateId: string) {
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) return;

  const { nodes, relations } = template.generate();
  const store = useCanvasStore.getState();
  const cx = Math.round(-store.viewport.x);
  const cy = Math.round(-store.viewport.y);
  const nextZ = store.nextZIndex();
  const insertedNodes: LivingNode[] = [];

  nodes.forEach((node, index) => {
    const insertedNode = {
      ...node,
      position: {
        x: node.position.x + cx,
        y: node.position.y + cy,
      },
      zIndex: node.type === 'frame' ? node.zIndex : nextZ + index,
    };
    insertedNodes.push(insertedNode);
    store.addNode(insertedNode);
  });
  relations.forEach((r) => store.addRelation(r));

  fitViewportToNodes(insertedNodes);
}
