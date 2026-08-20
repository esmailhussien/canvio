import { nanoid } from 'nanoid';
import { LivingNode, Relation } from '../store/canvasStore';

export interface TemplatePreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  create: (centerX: number, centerY: number, nextZ: () => number) => { nodes: LivingNode[]; relations: Relation[] };
}

export const PRESET_TEMPLATES: TemplatePreset[] = [
  {
    id: 'mindmap',
    name: 'Mind Map',
    description: 'Central concept connected to 4 radial topic nodes',
    icon: 'hub',
    create: (cx, cy, nextZ) => {
      const mainId = nanoid(10);
      const branch1Id = nanoid(10);
      const branch2Id = nanoid(10);
      const branch3Id = nanoid(10);
      const branch4Id = nanoid(10);

      const mainNode: LivingNode = {
        id: mainId,
        type: 'shape',
        position: { x: cx - 100, y: cy - 50 },
        size: { width: 200, height: 100 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { shape: 'rectangle', fill: 'rgba(99, 102, 241, 0.25)', stroke: '#6366f1', label: 'Central Concept' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const branch1: LivingNode = {
        id: branch1Id,
        type: 'sticky',
        position: { x: cx - 320, y: cy - 180 },
        size: { width: 180, height: 140 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { text: 'Key Subtopic A', color: 'blue' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const branch2: LivingNode = {
        id: branch2Id,
        type: 'sticky',
        position: { x: cx + 140, y: cy - 180 },
        size: { width: 180, height: 140 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { text: 'Key Subtopic B', color: 'green' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const branch3: LivingNode = {
        id: branch3Id,
        type: 'sticky',
        position: { x: cx - 320, y: cy + 100 },
        size: { width: 180, height: 140 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { text: 'Key Subtopic C', color: 'pink' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const branch4: LivingNode = {
        id: branch4Id,
        type: 'sticky',
        position: { x: cx + 140, y: cy + 100 },
        size: { width: 180, height: 140 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { text: 'Key Subtopic D', color: 'purple' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const relations: Relation[] = [
        { id: nanoid(10), sourceId: mainId, targetId: branch1Id, relationship: 'related_to', style: { type: 'curved', color: '#6366f1', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: mainId, targetId: branch2Id, relationship: 'related_to', style: { type: 'curved', color: '#22c55e', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: mainId, targetId: branch3Id, relationship: 'related_to', style: { type: 'curved', color: '#f472b6', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: mainId, targetId: branch4Id, relationship: 'related_to', style: { type: 'curved', color: '#a78bfa', width: 2, endArrow: 'arrow' } },
      ];

      return { nodes: [mainNode, branch1, branch2, branch3, branch4], relations };
    },
  },
  {
    id: 'flowchart',
    name: 'Flowchart Process',
    description: 'Sequential process diagram with start, decision, and step nodes',
    icon: 'schema',
    create: (cx, cy, nextZ) => {
      const startId = nanoid(10);
      const step1Id = nanoid(10);
      const decisionId = nanoid(10);
      const endId = nanoid(10);

      const startNode: LivingNode = {
        id: startId,
        type: 'shape',
        position: { x: cx - 350, y: cy - 40 },
        size: { width: 130, height: 80 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { shape: 'circle', fill: 'rgba(34, 197, 94, 0.2)', stroke: '#22c55e', label: 'Start Process' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const step1Node: LivingNode = {
        id: step1Id,
        type: 'shape',
        position: { x: cx - 160, y: cy - 40 },
        size: { width: 140, height: 80 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { shape: 'rectangle', fill: 'rgba(99, 102, 241, 0.2)', stroke: '#6366f1', label: 'Process Data' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const decisionNode: LivingNode = {
        id: decisionId,
        type: 'shape',
        position: { x: cx + 40, y: cy - 60 },
        size: { width: 120, height: 120 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { shape: 'diamond', fill: 'rgba(245, 158, 11, 0.2)', stroke: '#f59e0b', label: 'Valid?' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const endNode: LivingNode = {
        id: endId,
        type: 'shape',
        position: { x: cx + 240, y: cy - 40 },
        size: { width: 130, height: 80 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { shape: 'circle', fill: 'rgba(239, 68, 68, 0.2)', stroke: '#ef4444', label: 'Complete' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const relations: Relation[] = [
        { id: nanoid(10), sourceId: startId, targetId: step1Id, relationship: 'leads_to', style: { type: 'orthogonal', color: '#22c55e', width: 2, endArrow: 'arrow', animated: true } },
        { id: nanoid(10), sourceId: step1Id, targetId: decisionId, relationship: 'leads_to', style: { type: 'orthogonal', color: '#6366f1', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: decisionId, targetId: endId, relationship: 'leads_to', label: 'Yes', style: { type: 'orthogonal', color: '#22c55e', width: 2, endArrow: 'arrow' } },
      ];

      return { nodes: [startNode, step1Node, decisionNode, endNode], relations };
    },
  },
  {
    id: 'cityplan',
    name: 'Location Planning Map',
    description: 'Interactive map board surrounded by planning cards',
    icon: 'map',
    create: (cx, cy, nextZ) => {
      const mapId = nanoid(10);
      const dist1Id = nanoid(10);
      const dist2Id = nanoid(10);

      const mapNode: LivingNode = {
        id: mapId,
        type: 'map',
        position: { x: cx - 250, y: cy - 180 },
        size: { width: 500, height: 360 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: {
          center: [20, 0],
          zoom: 2,
          tileLayer: 'satellite',
          markers: [],
          interactive: true,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const dist1: LivingNode = {
        id: dist1Id,
        type: 'sticky',
        position: { x: cx - 500, y: cy - 100 },
        size: { width: 200, height: 180 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { text: 'Priority Area\n- Key constraints\n- Stakeholder notes', color: 'orange' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const dist2: LivingNode = {
        id: dist2Id,
        type: 'sticky',
        position: { x: cx + 290, y: cy - 100 },
        size: { width: 200, height: 180 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { text: 'Opportunity Area\n- Field observations\n- Next actions', color: 'green' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const relations: Relation[] = [
        { id: nanoid(10), sourceId: dist1Id, targetId: mapId, relationship: 'part_of', style: { type: 'curved', color: '#fb923c', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: dist2Id, targetId: mapId, relationship: 'part_of', style: { type: 'curved', color: '#4ade80', width: 2, endArrow: 'arrow' } },
      ];

      return { nodes: [mapNode, dist1, dist2], relations };
    },
  },
  {
    id: 'a4-document',
    name: 'A4 Report Page',
    description: 'Print-ready A4 Page Frame formatted with header, summary, and sticky notes',
    icon: 'description',
    create: (cx, cy, nextZ) => {
      const pageId = nanoid(10);
      const headerId = nanoid(10);
      const sticky1Id = nanoid(10);
      const sticky2Id = nanoid(10);

      const pageFrame: LivingNode = {
        id: pageId,
        type: 'frame',
        position: { x: cx - 297, y: cy - 421 },
        size: { width: 595, height: 842 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { title: 'Executive Summary Page', color: '#6366f1', pagePreset: 'a4-portrait' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const headerText: LivingNode = {
        id: headerId,
        type: 'text',
        position: { x: cx - 250, y: cy - 370 },
        size: { width: 500, height: 60 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { content: 'Spatial Analysis Report\nPrepared for Team Briefing', fontSize: 24, fontWeight: 'bold', color: 'var(--text-primary)' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const note1: LivingNode = {
        id: sticky1Id,
        type: 'sticky',
        position: { x: cx - 250, y: cy - 270 },
        size: { width: 230, height: 160 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { text: 'Key Findings\n1. High priority zones mapped\n2. Spatial relations verified\n3. Export ready for PDF', color: 'yellow' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const note2: LivingNode = {
        id: sticky2Id,
        type: 'sticky',
        position: { x: cx + 20, y: cy - 270 },
        size: { width: 230, height: 160 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { text: 'Action Items\n- Review map coordinates\n- Share board URL with team\n- Download PDF copy', color: 'green' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      return { nodes: [pageFrame, headerText, note1, note2], relations: [] };
    },
  },
  {
    id: 'kanban-board',
    name: 'Kanban Task Board',
    description: '3 Column Agile Task Board (To Do, In Progress, Done)',
    icon: 'view_kanban',
    create: (cx, cy, nextZ) => {
      const todoFrameId = nanoid(10);
      const inProgFrameId = nanoid(10);
      const doneFrameId = nanoid(10);

      const todoFrame: LivingNode = {
        id: todoFrameId,
        type: 'frame',
        position: { x: cx - 460, y: cy - 250 },
        size: { width: 280, height: 500 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { title: '📌 To Do', color: '#f59e0b' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const inProgFrame: LivingNode = {
        id: inProgFrameId,
        type: 'frame',
        position: { x: cx - 140, y: cy - 250 },
        size: { width: 280, height: 500 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { title: '⚡ In Progress', color: '#3b82f6' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const doneFrame: LivingNode = {
        id: doneFrameId,
        type: 'frame',
        position: { x: cx + 180, y: cy - 250 },
        size: { width: 280, height: 500 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { title: '✅ Done', color: '#22c55e' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const task1: LivingNode = {
        id: nanoid(10),
        type: 'sticky',
        position: { x: cx - 430, y: cy - 180 },
        size: { width: 220, height: 120 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { text: 'Setup spatial AI prompt models', color: 'orange' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const task2: LivingNode = {
        id: nanoid(10),
        type: 'sticky',
        position: { x: cx - 110, y: cy - 180 },
        size: { width: 220, height: 120 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { text: 'Test PDF multi-page export', color: 'blue' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const task3: LivingNode = {
        id: nanoid(10),
        type: 'sticky',
        position: { x: cx + 210, y: cy - 180 },
        size: { width: 220, height: 120 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { text: 'Fix Leaflet view sync loop', color: 'green' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      return { nodes: [todoFrame, inProgFrame, doneFrame, task1, task2, task3], relations: [] };
    },
  },
  {
    id: 'english-conditionals',
    name: 'English Conditionals Master Board',
    description: 'Complete visual guide to Zero, 1st, 2nd, and 3rd Conditionals with rules, examples & quiz',
    icon: 'school',
    create: (cx, cy, nextZ) => {
      const frameId = nanoid(10);
      const centerId = nanoid(10);
      const zeroId = nanoid(10);
      const firstId = nanoid(10);
      const secondId = nanoid(10);
      const thirdId = nanoid(10);
      const pitfallsId = nanoid(10);
      const quizId = nanoid(10);

      const frameNode: LivingNode = {
        id: frameId,
        type: 'frame',
        position: { x: cx - 620, y: cy - 360 },
        size: { width: 1240, height: 720 },
        rotation: 0,
        zIndex: 0,
        locked: false,
        data: { title: '📚 English Grammar: Conditional Sentences (If Clauses)', color: '#6366f1' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const centerNode: LivingNode = {
        id: centerId,
        type: 'shape',
        position: { x: cx - 110, y: cy - 40 },
        size: { width: 220, height: 110 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { shape: 'hexagon', fill: 'rgba(99, 102, 241, 0.22)', stroke: '#6366f1', label: 'Conditionals\n(If Clauses)' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const zeroNode: LivingNode = {
        id: zeroId,
        type: 'sticky',
        position: { x: cx - 560, y: cy - 260 },
        size: { width: 250, height: 160 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: {
          color: 'blue',
          text: '0️⃣ Zero Conditional (Facts & Truths)\n\n📐 Rule: If + Present Simple, ... Present Simple\n💡 Usage: Scientific facts & universal truths\n📝 Example: "If you heat water to 100°C, it boils."',
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const firstNode: LivingNode = {
        id: firstId,
        type: 'sticky',
        position: { x: cx + 310, y: cy - 260 },
        size: { width: 250, height: 160 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: {
          color: 'green',
          text: '1️⃣ First Conditional (Real Possibility)\n\n📐 Rule: If + Present Simple, ... will + Verb\n💡 Usage: Real possibilities in the future\n📝 Example: "If it rains tomorrow, we will stay home."',
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const secondNode: LivingNode = {
        id: secondId,
        type: 'sticky',
        position: { x: cx - 560, y: cy + 100 },
        size: { width: 250, height: 160 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: {
          color: 'yellow',
          text: '2️⃣ Second Conditional (Hypothetical)\n\n📐 Rule: If + Past Simple, ... would + Verb\n💡 Usage: Imaginary present/future situations\n📝 Example: "If I won the lottery, I would travel the world."',
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const thirdNode: LivingNode = {
        id: thirdId,
        type: 'sticky',
        position: { x: cx + 310, y: cy + 100 },
        size: { width: 250, height: 160 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: {
          color: 'orange',
          text: '3️⃣ Third Conditional (Past Regrets)\n\n📐 Rule: If + Past Perfect, ... would have + V3\n💡 Usage: Impossible past conditions & regrets\n📝 Example: "If I had studied harder, I would have passed."',
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const pitfallsNode: LivingNode = {
        id: pitfallsId,
        type: 'sticky',
        position: { x: cx - 270, y: cy - 290 },
        size: { width: 250, height: 140 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: {
          color: 'pink',
          text: '⚠️ Common Pitfalls\n\n❌ "If it will rain tomorrow..."\n✅ "If it rains tomorrow..."\n💡 Never put "will" inside the if-clause!',
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const quizNode: LivingNode = {
        id: quizId,
        type: 'sticky',
        position: { x: cx + 20, y: cy - 290 },
        size: { width: 250, height: 140 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: {
          color: 'purple',
          text: '✍️ Quick Quiz Practice\n\n1. "If she _____ (call), tell her I am busy."\n2. "If I _____ (be) you, I would take the job."',
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const relations: Relation[] = [
        { id: nanoid(10), sourceId: centerId, targetId: zeroNode.id, relationship: 'explains', label: 'scientific facts', style: { type: 'orthogonal', color: '#3b82f6', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: centerId, targetId: firstNode.id, relationship: 'leads_to', label: 'future outcome', style: { type: 'orthogonal', color: '#22c55e', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: centerId, targetId: secondNode.id, relationship: 'explains', label: 'unreal present', style: { type: 'orthogonal', color: '#eab308', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: centerId, targetId: thirdNode.id, relationship: 'based_on', label: 'past regret', style: { type: 'orthogonal', color: '#f97316', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: firstNode.id, targetId: pitfallsNode.id, relationship: 'contradicts', label: 'watch out', style: { type: 'orthogonal', color: '#ec4899', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: firstNode.id, targetId: quizNode.id, relationship: 'leads_to', label: 'test skill', style: { type: 'orthogonal', color: '#a855f7', width: 2, endArrow: 'arrow' } },
      ];

      return { nodes: [frameNode, centerNode, zeroNode, firstNode, secondNode, thirdNode, pitfallsNode, quizNode], relations };
    },
  },
  {
    id: 'five-whys-root-cause',
    name: '5 Whys Root Cause Analysis',
    description: 'Trace any problem down to its core root cause and actionable mitigation',
    icon: 'troubleshoot',
    create: (cx, cy, nextZ) => {
      const frameId = nanoid(10);
      const problemId = nanoid(10);
      const w1Id = nanoid(10);
      const w2Id = nanoid(10);
      const w3Id = nanoid(10);
      const rootId = nanoid(10);
      const actionId = nanoid(10);

      const frameNode: LivingNode = {
        id: frameId,
        type: 'frame',
        position: { x: cx - 600, y: cy - 240 },
        size: { width: 1200, height: 480 },
        rotation: 0,
        zIndex: 0,
        locked: false,
        data: { title: '🔍 5 Whys Root Cause Analysis & Countermeasures', color: '#ef4444' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const problemNode: LivingNode = {
        id: problemId,
        type: 'shape',
        position: { x: cx - 560, y: cy - 60 },
        size: { width: 170, height: 120 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { shape: 'diamond', fill: 'rgba(239, 68, 68, 0.2)', stroke: '#ef4444', label: '🚨 Problem\nStatement' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const w1Node: LivingNode = {
        id: w1Id,
        type: 'sticky',
        position: { x: cx - 350, y: cy - 60 },
        size: { width: 160, height: 120 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { color: 'yellow', text: '1. Why did it happen?\nDirect symptom / trigger event.' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const w2Node: LivingNode = {
        id: w2Id,
        type: 'sticky',
        position: { x: cx - 160, y: cy - 60 },
        size: { width: 160, height: 120 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { color: 'orange', text: '2. Why was that?\nImmediate mechanism failure.' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const w3Node: LivingNode = {
        id: w3Id,
        type: 'sticky',
        position: { x: cx + 30, y: cy - 60 },
        size: { width: 160, height: 120 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { color: 'pink', text: '3. Why did that occur?\nProcess or standard operating gap.' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const rootNode: LivingNode = {
        id: rootId,
        type: 'shape',
        position: { x: cx + 220, y: cy - 60 },
        size: { width: 160, height: 120 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { shape: 'hexagon', fill: 'rgba(139, 92, 246, 0.22)', stroke: '#8b5cf6', label: '🎯 Root Cause\nSystemic Driver' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const actionNode: LivingNode = {
        id: actionId,
        type: 'sticky',
        position: { x: cx + 410, y: cy - 60 },
        size: { width: 160, height: 120 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { color: 'green', text: '🛡️ Countermeasure\nPermanent fix & safeguard to prevent recurrence.' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const relations: Relation[] = [
        { id: nanoid(10), sourceId: problemId, targetId: w1Id, relationship: 'causes', label: 'why?', style: { type: 'orthogonal', color: '#f59e0b', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: w1Id, targetId: w2Id, relationship: 'causes', label: 'why?', style: { type: 'orthogonal', color: '#f97316', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: w2Id, targetId: w3Id, relationship: 'causes', label: 'why?', style: { type: 'orthogonal', color: '#ec4899', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: w3Id, targetId: rootId, relationship: 'leads_to', label: 'uncovers', style: { type: 'orthogonal', color: '#8b5cf6', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: rootId, targetId: actionId, relationship: 'mitigates', label: 'mitigates', style: { type: 'orthogonal', color: '#22c55e', width: 2, endArrow: 'arrow' } },
      ];

      return { nodes: [frameNode, problemNode, w1Node, w2Node, w3Node, rootNode, actionNode], relations };
    },
  },
  {
    id: 'decision-tradeoff-matrix',
    name: 'Decision & Tradeoff Tree',
    description: 'Compare competing options with pros, cons, and weighted resolution',
    icon: 'alt_route',
    create: (cx, cy, nextZ) => {
      const frameId = nanoid(10);
      const decId = nanoid(10);
      const optAId = nanoid(10);
      const optBId = nanoid(10);
      const prosAId = nanoid(10);
      const consAId = nanoid(10);
      const prosBId = nanoid(10);
      const consBId = nanoid(10);
      const resolutionId = nanoid(10);

      const frameNode: LivingNode = {
        id: frameId,
        type: 'frame',
        position: { x: cx - 600, y: cy - 320 },
        size: { width: 1200, height: 640 },
        rotation: 0,
        zIndex: 0,
        locked: false,
        data: { title: '⚖️ Strategic Decision & Tradeoff Matrix', color: '#3b82f6' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const decNode: LivingNode = {
        id: decId,
        type: 'shape',
        position: { x: cx - 540, y: cy - 50 },
        size: { width: 160, height: 100 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { shape: 'diamond', fill: 'rgba(59, 130, 246, 0.22)', stroke: '#3b82f6', label: 'Core Decision\nPoint' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const optANode: LivingNode = {
        id: optAId,
        type: 'shape',
        position: { x: cx - 320, y: cy - 180 },
        size: { width: 180, height: 80 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { shape: 'rectangle', fill: 'rgba(34, 197, 94, 0.18)', stroke: '#22c55e', label: 'Option A:\nBuild In-House' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const prosANode: LivingNode = {
        id: prosAId,
        type: 'sticky',
        position: { x: cx - 110, y: cy - 240 },
        size: { width: 180, height: 110 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { color: 'green', text: '✅ Advantages\n- Full custom control\n- No vendor lock-in' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const consANode: LivingNode = {
        id: consAId,
        type: 'sticky',
        position: { x: cx - 110, y: cy - 120 },
        size: { width: 180, height: 110 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { color: 'pink', text: '❌ Tradeoffs / Risks\n- High upfront time\n- Ongoing maintenance' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const optBNode: LivingNode = {
        id: optBId,
        type: 'shape',
        position: { x: cx - 320, y: cy + 100 },
        size: { width: 180, height: 80 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { shape: 'rectangle', fill: 'rgba(245, 158, 11, 0.18)', stroke: '#f59e0b', label: 'Option B:\nIntegrate Managed API' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const prosBNode: LivingNode = {
        id: prosBId,
        type: 'sticky',
        position: { x: cx - 110, y: cy + 40 },
        size: { width: 180, height: 110 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { color: 'green', text: '✅ Advantages\n- Instant time to market\n- Managed reliability' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const consBNode: LivingNode = {
        id: consBId,
        type: 'sticky',
        position: { x: cx - 110, y: cy + 160 },
        size: { width: 180, height: 110 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { color: 'pink', text: '❌ Tradeoffs / Risks\n- API usage pricing\n- External dependency' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const resNode: LivingNode = {
        id: resolutionId,
        type: 'sticky',
        position: { x: cx + 130, y: cy - 60 },
        size: { width: 220, height: 130 },
        rotation: 0,
        zIndex: nextZ(),
        locked: false,
        data: { color: 'blue', text: '🎯 Final Recommendation\nStart with Option B for fast validation, migrate to Option A if scale demands.' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const relations: Relation[] = [
        { id: nanoid(10), sourceId: decId, targetId: optAId, relationship: 'leads_to', label: 'path 1', style: { type: 'orthogonal', color: '#22c55e', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: decId, targetId: optBId, relationship: 'leads_to', label: 'path 2', style: { type: 'orthogonal', color: '#f59e0b', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: optAId, targetId: prosANode.id, relationship: 'enables', style: { type: 'curved', color: '#22c55e', width: 1.5, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: optAId, targetId: consANode.id, relationship: 'contradicts', style: { type: 'curved', color: '#ef4444', width: 1.5, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: optBId, targetId: prosBNode.id, relationship: 'enables', style: { type: 'curved', color: '#22c55e', width: 1.5, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: optBId, targetId: consBNode.id, relationship: 'contradicts', style: { type: 'curved', color: '#ef4444', width: 1.5, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: prosANode.id, targetId: resNode.id, relationship: 'based_on', label: 'informs', style: { type: 'orthogonal', color: '#6366f1', width: 2, endArrow: 'arrow' } },
        { id: nanoid(10), sourceId: prosBNode.id, targetId: resNode.id, relationship: 'based_on', label: 'informs', style: { type: 'orthogonal', color: '#6366f1', width: 2, endArrow: 'arrow' } },
      ];

      return { nodes: [frameNode, decNode, optANode, prosANode, consANode, optBNode, prosBNode, consBNode, resNode], relations };
    },
  },
];
