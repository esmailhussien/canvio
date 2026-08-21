import { LivingNode, Relation, RelationshipType } from '../store/canvasStore';
import { GraphInsight } from '@canvio/core';

export interface ContradictionPair {
  relationId: string;
  sourceNode: LivingNode;
  targetNode: LivingNode;
  label?: string;
}

export interface DependencyChain {
  path: LivingNode[];
  relationIds: string[];
  depth: number;
  rootNode: LivingNode;
  leafNode: LivingNode;
}

export interface GraphCluster {
  id: string;
  nodeIds: string[];
  title: string;
  dominantType: string;
}

export interface ReasoningScoreFactor {
  id: 'connectedness' | 'relation_clarity' | 'grounding' | 'logic_safety' | 'depth';
  label: string;
  score: number;
  weight: number;
  description: string;
  focusNodeIds?: string[];
  focusRelationIds?: string[];
}

export interface GraphAnalysisResult {
  metrics: {
    totalNodes: number;
    totalRelations: number;
    density: number;
    orphanCount: number;
    contradictionCount: number;
    maxDependencyDepth: number;
    reasoningHealthScore: number; // 0 - 100
    scoreBreakdown: ReasoningScoreFactor[];
  };
  contradictions: ContradictionPair[];
  criticalPaths: DependencyChain[];
  cycles: string[][]; // Array of node ID paths forming cycles
  orphans: LivingNode[];
  unanchoredClaims: LivingNode[];
  evidenceNodes: LivingNode[];
  clusters: GraphCluster[];
  insights: GraphInsight[];
}

/**
 * Perform comprehensive, client-side semantic graph analysis.
 * Analyzes reasoning consistency, dependency depth, conflict pairs, and evidence grounding.
 */
export function analyzeGraphStructure(
  nodesRecord: Record<string, LivingNode>,
  relationsRecord: Record<string, Relation>
): GraphAnalysisResult {
  const nodes = Object.values(nodesRecord);
  const relations = Object.values(relationsRecord);
  const nodeMap = new Map<string, LivingNode>(nodes.map((n) => [n.id, n]));

  // Adjacency representations
  const outEdges = new Map<string, Relation[]>();
  const inEdges = new Map<string, Relation[]>();
  const undirectedAdj = new Map<string, string[]>();

  nodes.forEach((n) => {
    outEdges.set(n.id, []);
    inEdges.set(n.id, []);
    undirectedAdj.set(n.id, []);
  });

  relations.forEach((rel) => {
    if (nodeMap.has(rel.sourceId) && nodeMap.has(rel.targetId)) {
      outEdges.get(rel.sourceId)?.push(rel);
      inEdges.get(rel.targetId)?.push(rel);

      undirectedAdj.get(rel.sourceId)?.push(rel.targetId);
      undirectedAdj.get(rel.targetId)?.push(rel.sourceId);
    }
  });

  // 1. Contradictions Detection
  const contradictions: ContradictionPair[] = [];
  relations.forEach((rel) => {
    if (rel.relationship === 'contradicts') {
      const src = nodeMap.get(rel.sourceId);
      const tgt = nodeMap.get(rel.targetId);
      if (src && tgt) {
        contradictions.push({
          relationId: rel.id,
          sourceNode: src,
          targetNode: tgt,
          label: rel.label,
        });
      }
    }
  });

  // 2. Orphan (Isolated) Nodes
  const orphans = nodes.filter((n) => {
    const outs = outEdges.get(n.id)?.length || 0;
    const ins = inEdges.get(n.id)?.length || 0;
    return outs === 0 && ins === 0;
  });

  // 3. Evidence Grounding Nodes (Maps with markers, or nodes with based_on sources)
  const evidenceNodes = nodes.filter((n) => {
    if (n.type === 'map') {
      const data = n.data as Record<string, unknown> | undefined;
      return Array.isArray(data?.markers) && data.markers.length > 0;
    }
    return false;
  });

  // 4. Unanchored Claims (Nodes proposing results or actions with no 'based_on' backing)
  const unanchoredClaims = nodes.filter((n) => {
    if (n.type === 'frame' || n.type === 'drawing') return false;
    const ins = inEdges.get(n.id) || [];
    const outs = outEdges.get(n.id) || [];
    const hasEvidence = ins.some((r) => r.relationship === 'based_on' || r.relationship === 'inspired_by');
    const hasOutcomes = outs.some((r) => r.relationship === 'leads_to' || r.relationship === 'enables' || r.relationship === 'depends_on');
    return hasOutcomes && !hasEvidence && n.type !== 'map';
  });

  // 5. Dependency Chains & Critical Paths
  const dependencyRels = new Set<RelationshipType>(['depends_on', 'leads_to', 'enables', 'based_on']);
  const allPaths: DependencyChain[] = [];

  function dfsPath(currId: string, currentPath: string[], currentRelIds: string[], visited: Set<string>) {
    if (visited.has(currId)) return; // Avoid cycles in path discovery
    visited.add(currId);

    const edges = (outEdges.get(currId) || []).filter((r) => dependencyRels.has(r.relationship));
    if (edges.length === 0 && currentPath.length > 1) {
      const pathNodes = currentPath.map((id) => nodeMap.get(id)!).filter(Boolean);
      allPaths.push({
        path: pathNodes,
        relationIds: [...currentRelIds],
        depth: pathNodes.length,
        rootNode: pathNodes[0],
        leafNode: pathNodes[pathNodes.length - 1],
      });
    } else {
      for (const edge of edges) {
        dfsPath(edge.targetId, [...currentPath, edge.targetId], [...currentRelIds, edge.id], new Set(visited));
      }
    }
  }

  // Find root nodes (no in-dependencies)
  nodes.forEach((n) => {
    const depIns = (inEdges.get(n.id) || []).filter((r) => dependencyRels.has(r.relationship));
    if (depIns.length === 0) {
      dfsPath(n.id, [n.id], [], new Set());
    }
  });

  // Sort critical paths by length
  allPaths.sort((a, b) => b.depth - a.depth);
  const criticalPaths = allPaths.slice(0, 5);
  const maxDependencyDepth = criticalPaths.length > 0 ? criticalPaths[0].depth : (nodes.length > 0 ? 1 : 0);

  // 6. Cycle Detection (Logic Deadlocks)
  const cycles: string[][] = [];
  const visitedGlobal = new Set<string>();
  const recursionStack = new Set<string>();
  const currentTrace: string[] = [];

  function detectCyclesDFS(nodeId: string) {
    visitedGlobal.add(nodeId);
    recursionStack.add(nodeId);
    currentTrace.push(nodeId);

    const edges = outEdges.get(nodeId) || [];
    for (const edge of edges) {
      if (edge.relationship === 'depends_on' || edge.relationship === 'leads_to') {
        const neighbor = edge.targetId;
        if (!visitedGlobal.has(neighbor)) {
          detectCyclesDFS(neighbor);
        } else if (recursionStack.has(neighbor)) {
          // Cycle found
          const cycleStartIndex = currentTrace.indexOf(neighbor);
          if (cycleStartIndex !== -1) {
            cycles.push(currentTrace.slice(cycleStartIndex));
          }
        }
      }
    }

    currentTrace.pop();
    recursionStack.delete(nodeId);
  }

  nodes.forEach((n) => {
    if (!visitedGlobal.has(n.id)) {
      detectCyclesDFS(n.id);
    }
  });

  // 7. Graph Connected Components / Clusters
  const clusters: GraphCluster[] = [];
  const visitedCluster = new Set<string>();

  nodes.forEach((node) => {
    if (visitedCluster.has(node.id)) return;
    const clusterNodes: string[] = [];
    const queue = [node.id];
    visitedCluster.add(node.id);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      clusterNodes.push(curr);

      const neighbors = undirectedAdj.get(curr) || [];
      neighbors.forEach((nbr) => {
        if (!visitedCluster.has(nbr)) {
          visitedCluster.add(nbr);
          queue.push(nbr);
        }
      });
    }

    if (clusterNodes.length >= 2) {
      const firstNode = nodeMap.get(clusterNodes[0]);
      const title = firstNode?.data?.title || firstNode?.data?.label || firstNode?.data?.text || `Cluster ${clusters.length + 1}`;
      clusters.push({
        id: `cluster_${clusters.length + 1}`,
        nodeIds: clusterNodes,
        title: String(title).slice(0, 32),
        dominantType: firstNode?.type || 'concept',
      });
    }
  });

  // 8. Calculate Reasoning Health Score (0 - 100)
  const nodeCount = nodes.length;
  const relCount = relations.length;
  const density = nodeCount > 1 ? Number((relCount / ((nodeCount * (nodeCount - 1)) / 2)).toFixed(3)) : 0;
  const orphanRatio = nodeCount > 0 ? orphans.length / nodeCount : 1;
  const relationCoverage = nodeCount > 1 ? Math.min(1, relCount / Math.max(1, nodeCount - 1)) : 0;
  const connectednessScore = nodeCount === 0
    ? 0
    : clampScore(Math.round((1 - orphanRatio) * 45 + relationCoverage * 55));

  const meaningfulRelations = relations.filter((rel) => {
    const label = rel.label?.trim();
    return rel.relationship !== 'related_to' || Boolean(label && label.length >= 3);
  });
  const relationClarityScore = relCount === 0 ? 0 : clampScore(Math.round((meaningfulRelations.length / relCount) * 100));

  const evidenceLinkCount = relations.filter((rel) => rel.relationship === 'based_on' || rel.relationship === 'inspired_by').length + evidenceNodes.length;
  const groundingScore = nodeCount === 0
    ? 0
    : clampScore(
      evidenceLinkCount === 0
        ? (unanchoredClaims.length > 0 ? 42 : 64)
        : 100 - Math.round((unanchoredClaims.length / Math.max(1, nodeCount)) * 70)
    );

  const logicSafetyScore = nodeCount === 0
    ? 0
    : clampScore(100 - Math.min(45, contradictions.length * 24) - Math.min(45, cycles.length * 28));

  const depthScore = nodeCount === 0
    ? 0
    : maxDependencyDepth >= 4
      ? 100
      : maxDependencyDepth === 3
        ? 82
        : maxDependencyDepth === 2
          ? 62
          : 34;

  const scoreBreakdown: ReasoningScoreFactor[] = [
    {
      id: 'connectedness',
      label: 'Connectedness',
      score: connectednessScore,
      weight: 25,
      description: 'How much of the board is connected instead of isolated.',
      focusNodeIds: orphans.map((n) => n.id),
    },
    {
      id: 'relation_clarity',
      label: 'Relation clarity',
      score: relationClarityScore,
      weight: 20,
      description: 'Whether links have meaningful types or labels the AI can read.',
      focusRelationIds: relations.filter((rel) => !meaningfulRelations.some((mr) => mr.id === rel.id)).map((rel) => rel.id),
    },
    {
      id: 'grounding',
      label: 'Evidence grounding',
      score: groundingScore,
      weight: 20,
      description: 'How well claims are backed by evidence, references, or map pins.',
      focusNodeIds: unanchoredClaims.map((n) => n.id),
    },
    {
      id: 'logic_safety',
      label: 'Logic safety',
      score: logicSafetyScore,
      weight: 25,
      description: 'Contradictions and circular dependencies reduce this score.',
      focusNodeIds: [
        ...contradictions.flatMap((c) => [c.sourceNode.id, c.targetNode.id]),
        ...cycles.flat(),
      ],
    },
    {
      id: 'depth',
      label: 'Reasoning depth',
      score: depthScore,
      weight: 10,
      description: 'Rewards clear chains from premise to outcome.',
      focusNodeIds: criticalPaths[0]?.path.map((n) => n.id) || [],
      focusRelationIds: criticalPaths[0]?.relationIds || [],
    },
  ];

  const healthScore = clampScore(Math.round(
    scoreBreakdown.reduce((sum, item) => sum + item.score * item.weight, 0) /
    scoreBreakdown.reduce((sum, item) => sum + item.weight, 0)
  ));

  // 9. Generate Actionable Insights
  const insights: GraphInsight[] = [];

  // Contradiction insights
  contradictions.forEach((c, idx) => {
    const srcName = getNodeTitle(c.sourceNode);
    const tgtName = getNodeTitle(c.targetNode);
    insights.push({
      id: `insight_contra_${idx}`,
      type: 'contradiction',
      severity: 'critical',
      title: `Contradiction: "${srcName}" ⚡ "${tgtName}"`,
      description: `These two concepts conflict. Consider adding a decision gate, reconciling assumptions, or specifying under what condition each holds true.`,
      nodeIds: [c.sourceNode.id, c.targetNode.id],
      relationIds: [c.relationId],
      suggestedAction: {
        label: 'Focus conflict',
        type: 'resolve_contradiction',
        payload: { sourceId: c.sourceNode.id, targetId: c.targetNode.id },
      },
    });
  });

  // Cycle insights
  cycles.forEach((cyc, idx) => {
    insights.push({
      id: `insight_cycle_${idx}`,
      type: 'cycle',
      severity: 'warning',
      title: `Circular Dependency Detected (${cyc.length} nodes)`,
      description: `Nodes form a circular logic loop where A depends on B depends on A. Break the loop to clarify execution sequence.`,
      nodeIds: cyc,
      suggestedAction: {
        label: 'Inspect loop',
        type: 'break_cycle',
        payload: { nodeIds: cyc },
      },
    });
  });

  // Orphan insights (if > 1)
  if (orphans.length > 1) {
    insights.push({
      id: 'insight_orphans',
      type: 'orphan',
      severity: 'info',
      title: `${orphans.length} Unconnected Thoughts`,
      description: `You have ${orphans.length} standalone elements. Connect them to your main conceptual flow with semantic relations.`,
      nodeIds: orphans.map((n) => n.id),
      suggestedAction: {
        label: 'Highlight unanchored',
        type: 'focus_nodes',
        payload: { nodeIds: orphans.map((n) => n.id) },
      },
    });
  }

  // Deep dependency chain insight
  if (criticalPaths.length > 0 && criticalPaths[0].depth >= 4) {
    const cp = criticalPaths[0];
    insights.push({
      id: 'insight_critical_path',
      type: 'dependency_chain',
      severity: 'info',
      title: `Critical Reasoning Path (Depth ${cp.depth})`,
      description: `From "${getNodeTitle(cp.rootNode)}" down to "${getNodeTitle(cp.leafNode)}". This is the longest causal chain on your board.`,
      nodeIds: cp.path.map((n) => n.id),
      relationIds: cp.relationIds,
      suggestedAction: {
        label: 'Follow path',
        type: 'focus_nodes',
        payload: { nodeIds: cp.path.map((n) => n.id) },
      },
    });
  }

  return {
    metrics: {
      totalNodes: nodeCount,
      totalRelations: relCount,
      density,
      orphanCount: orphans.length,
      contradictionCount: contradictions.length,
      maxDependencyDepth,
      reasoningHealthScore: healthScore,
      scoreBreakdown,
    },
    contradictions,
    criticalPaths,
    cycles,
    orphans,
    unanchoredClaims,
    evidenceNodes,
    clusters,
    insights,
  };
}

export function getNodeTitle(node?: LivingNode): string {
  if (!node) return 'Untitled';
  const data = node.data as Record<string, unknown> | undefined;
  const raw = data?.title || data?.label || data?.text || data?.content;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().replace(/\s+/g, ' ').slice(0, 36);
  }
  return node.type === 'map' ? 'Living Map' : `${node.type.charAt(0).toUpperCase() + node.type.slice(1)}`;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Find all upstream ancestors or downstream dependencies of a specific node
 */
export function getConnectedSubgraph(
  rootId: string,
  relations: Record<string, Relation>,
  direction: 'upstream' | 'downstream' | 'both' = 'both',
  maxDepth = 10
): { nodeIds: Set<string>; relationIds: Set<string> } {
  const visitedNodes = new Set<string>([rootId]);
  const visitedRelations = new Set<string>();

  const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;

    Object.values(relations).forEach((rel) => {
      if (direction === 'downstream' || direction === 'both') {
        if (rel.sourceId === id && !visitedNodes.has(rel.targetId)) {
          visitedNodes.add(rel.targetId);
          visitedRelations.add(rel.id);
          queue.push({ id: rel.targetId, depth: depth + 1 });
        }
      }
      if (direction === 'upstream' || direction === 'both') {
        if (rel.targetId === id && !visitedNodes.has(rel.sourceId)) {
          visitedNodes.add(rel.sourceId);
          visitedRelations.add(rel.id);
          queue.push({ id: rel.sourceId, depth: depth + 1 });
        }
      }
    });
  }

  return { nodeIds: visitedNodes, relationIds: visitedRelations };
}
