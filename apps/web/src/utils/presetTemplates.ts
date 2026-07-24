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
];
