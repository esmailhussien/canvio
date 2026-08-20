import React, { useState, useMemo } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { analyzeGraphStructure, getNodeTitle, ContradictionPair, DependencyChain } from '../../utils/graphQueries';
import {
  analyzeGraphWithAIAsync,
  challengeBoardWithAIAsync,
  socraticInquiryWithAIAsync,
} from '../../utils/spatialAIEngine';
import { fitViewportToNodes } from '../../utils/viewportFit';
import { GraphInsight, RelationshipType } from '@canvio/core';
import './GraphIntelligence.css';

interface GraphIntelligenceProps {
  isOpen: boolean;
  onClose: () => void;
  onFocusNode?: (nodeId: string | null) => void;
}

type TabMode = 'overview' | 'challenge' | 'socratic';

export const GraphIntelligence: React.FC<GraphIntelligenceProps> = ({
  isOpen,
  onClose,
  onFocusNode,
}) => {
  const nodes = useCanvasStore((s) => s.nodes);
  const relations = useCanvasStore((s) => s.relations);
  const selectNodes = useCanvasStore((s) => s.selectNodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const addRelation = useCanvasStore((s) => s.addRelation);
  const nextZIndex = useCanvasStore((s) => s.nextZIndex);

  const [activeTab, setActiveTab] = useState<TabMode>('overview');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiCritique, setAiCritique] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<GraphInsight[]>([]);
  const [suggestedBridges, setSuggestedBridges] = useState<Array<{ sourceId: string; targetId: string; relationship: string; label: string; reason?: string }>>([]);
  const [challengeData, setChallengeData] = useState<{
    summary: string;
    items: Array<{ targetNodeId: string; critique: string; counterPerspective: string }>;
    nodes: any[];
    relations: any[];
  } | null>(null);
  const [socraticData, setSocraticData] = useState<{
    focus: string;
    questions: Array<{ id: string; question: string; relatedNodeIds?: string[]; learningGoal?: string }>;
  } | null>(null);

  // Real-time Local Semantic Graph Analysis
  const localAnalysis = useMemo(() => {
    return analyzeGraphStructure(nodes, relations);
  }, [nodes, relations]);

  if (!isOpen) return null;

  const handleFocus = (nodeIds: string[]) => {
    const targetNodes = nodeIds.map((id) => nodes[id]).filter(Boolean);
    if (targetNodes.length > 0) {
      selectNodes(nodeIds);
      fitViewportToNodes(targetNodes, { maxZoom: 1.1, minZoom: 0.5, paddingX: 180, paddingY: 180 });
      if (onFocusNode && nodeIds.length === 1) {
        onFocusNode(nodeIds[0]);
      }
    }
  };

  const handleDeepAudit = async () => {
    setIsLoadingAI(true);
    try {
      const allNodes = Object.values(nodes);
      const allRelations = Object.values(relations);
      const res = await analyzeGraphWithAIAsync(allNodes, allRelations);
      setAiCritique(res.critique);
      setAiInsights(res.insights);
      setSuggestedBridges(res.suggestedRelations);
    } catch (err) {
      console.error('Deep AI audit failed:', err);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleRunChallenge = async () => {
    setIsLoadingAI(true);
    try {
      const allNodes = Object.values(nodes);
      const allRelations = Object.values(relations);
      const res = await challengeBoardWithAIAsync(allNodes, allRelations);
      setChallengeData({
        summary: res.challengeSummary,
        items: res.challenges,
        nodes: res.challengerNodes,
        relations: res.challengerRelations,
      });
    } catch (err) {
      console.error('AI challenge failed:', err);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleRunSocratic = async () => {
    setIsLoadingAI(true);
    try {
      const allNodes = Object.values(nodes);
      const allRelations = Object.values(relations);
      const res = await socraticInquiryWithAIAsync(allNodes, allRelations);
      setSocraticData({
        focus: res.inquiryFocus,
        questions: res.questions,
      });
    } catch (err) {
      console.error('AI Socratic inquiry failed:', err);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleAddChallengerNodesToCanvas = () => {
    if (!challengeData) return;
    challengeData.nodes.forEach((n) => addNode(n));
    challengeData.relations.forEach((r) => addRelation(r));
    if (challengeData.nodes.length > 0) {
      handleFocus(challengeData.nodes.map((n) => n.id));
    }
  };

  const handleAcceptBridge = (bridge: { sourceId: string; targetId: string; relationship: string; label: string }) => {
    const rel = {
      id: Math.random().toString(36).slice(2, 11),
      sourceId: bridge.sourceId,
      targetId: bridge.targetId,
      relationship: (bridge.relationship || 'leads_to') as RelationshipType,
      label: bridge.label || 'informs',
      style: {
        type: 'orthogonal' as const,
        color: '#6366f1',
        width: 2.5,
        endArrow: 'arrow' as const,
      },
    };
    addRelation(rel);
    setSuggestedBridges((prev) => prev.filter((b) => !(b.sourceId === bridge.sourceId && b.targetId === bridge.targetId)));
    handleFocus([bridge.sourceId, bridge.targetId]);
  };

  const currentScore = localAnalysis.metrics.reasoningHealthScore;
  const scoreColor = currentScore >= 80 ? '#10b981' : currentScore >= 55 ? '#f59e0b' : '#ef4444';

  const displayedInsights = aiInsights.length > 0 ? aiInsights : localAnalysis.insights;

  return (
    <div className="graph-intelligence" onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="gi-header">
        <div className="gi-header__title-wrap">
          <span className="material-symbols-outlined gi-header__icon">psychology</span>
          <span className="gi-header__title">Visual Reasoning Partner</span>
        </div>
        <div className="gi-header__actions">
          <button type="button" className="gi-close-btn" onClick={onClose} title="Close Panel">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      </div>

      {/* Health Score Gauge */}
      <div className="gi-health-card">
        <div className="gi-health-top">
          <span className="gi-health-label">Reasoning Coherence</span>
          <span className="gi-health-score" style={{ color: scoreColor }}>
            {currentScore}<small>/100</small>
          </span>
        </div>
        <div className="gi-health-bar">
          <div className="gi-health-fill" style={{ width: `${currentScore}%`, backgroundColor: scoreColor }} />
        </div>

        <div className="gi-health-chips">
          {localAnalysis.contradictions.length > 0 && (
            <button
              type="button"
              className="gi-chip gi-chip--alert"
              onClick={() => handleFocus(localAnalysis.contradictions.flatMap((c) => [c.sourceNode.id, c.targetNode.id]))}
              title="Click to focus on conflicting ideas"
            >
              <span>⚡ {localAnalysis.contradictions.length} Contradiction{localAnalysis.contradictions.length > 1 ? 's' : ''}</span>
            </button>
          )}

          {localAnalysis.criticalPaths.length > 0 && (
            <button
              type="button"
              className="gi-chip gi-chip--warning"
              onClick={() => handleFocus(localAnalysis.criticalPaths[0].path.map((n) => n.id))}
              title="Click to follow critical causal chain"
            >
              <span>⚓ Depth {localAnalysis.metrics.maxDependencyDepth}</span>
            </button>
          )}

          {localAnalysis.orphans.length > 0 && (
            <button
              type="button"
              className="gi-chip"
              onClick={() => handleFocus(localAnalysis.orphans.map((n) => n.id))}
              title="Click to highlight unanchored ideas"
            >
              <span>💡 {localAnalysis.orphans.length} Unanchored</span>
            </button>
          )}

          {localAnalysis.evidenceNodes.length > 0 && (
            <button
              type="button"
              className="gi-chip gi-chip--success"
              onClick={() => handleFocus(localAnalysis.evidenceNodes.map((n) => n.id))}
              title="Click to view spatial map evidence"
            >
              <span>📍 {localAnalysis.evidenceNodes.length} Map Evidence</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="gi-tabs">
        <button
          type="button"
          className={`gi-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>hub</span>
          <span>Audit</span>
        </button>
        <button
          type="button"
          className={`gi-tab ${activeTab === 'challenge' ? 'active' : ''}`}
          onClick={() => setActiveTab('challenge')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>bolt</span>
          <span>Challenge</span>
        </button>
        <button
          type="button"
          className={`gi-tab ${activeTab === 'socratic' ? 'active' : ''}`}
          onClick={() => setActiveTab('socratic')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>school</span>
          <span>Socratic</span>
        </button>
      </div>

      {/* Body Content */}
      <div className="gi-body">
        {activeTab === 'overview' && (
          <>
            <button
              type="button"
              className="gi-trigger-btn"
              onClick={handleDeepAudit}
              disabled={isLoadingAI || Object.keys(nodes).length === 0}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
              <span>{isLoadingAI ? 'Analyzing Reasoning...' : 'Audit Mental Model'}</span>
            </button>

            {aiCritique && (
              <div className="gi-critique-box">
                <strong>Executive Synthesis:</strong> {aiCritique}
              </div>
            )}

            {/* Suggested Bridges */}
            {suggestedBridges.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#c0c1ff' }}>
                  Suggested Logical Bridges
                </span>
                {suggestedBridges.map((b, idx) => (
                  <div key={idx} className="gi-insight-card gi-insight-card--info">
                    <div className="gi-insight-title">
                      <span>{b.label}</span>
                      <button
                        type="button"
                        className="gi-insight-action"
                        onClick={() => handleAcceptBridge(b)}
                      >
                        + Connect Bridge
                      </button>
                    </div>
                    {b.reason && <div className="gi-insight-desc">{b.reason}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Insights List */}
            {displayedInsights.length > 0 ? (
              displayedInsights.map((ins) => (
                <div key={ins.id} className={`gi-insight-card gi-insight-card--${ins.severity}`}>
                  <div className="gi-insight-title">
                    <span>{ins.title}</span>
                    {ins.nodeIds && ins.nodeIds.length > 0 && (
                      <button
                        type="button"
                        className="gi-insight-action"
                        onClick={() => handleFocus(ins.nodeIds)}
                      >
                        Focus
                      </button>
                    )}
                  </div>
                  <div className="gi-insight-desc">{ins.description}</div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 0' }}>
                Your board structure is clean and well-connected.
              </div>
            )}
          </>
        )}

        {activeTab === 'challenge' && (
          <>
            <button
              type="button"
              className="gi-trigger-btn"
              onClick={handleRunChallenge}
              disabled={isLoadingAI || Object.keys(nodes).length === 0}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>crisis_alert</span>
              <span>{isLoadingAI ? 'Stress-testing...' : 'Challenge My Assumptions'}</span>
            </button>

            {challengeData ? (
              <>
                <div className="gi-critique-box">
                  <strong>Devil's Advocate:</strong> {challengeData.summary}
                </div>

                {challengeData.nodes && challengeData.nodes.length > 0 && (
                  <button
                    type="button"
                    className="gi-insight-action"
                    style={{ width: '100%', padding: '8px 12px', textAlign: 'center' }}
                    onClick={handleAddChallengerNodesToCanvas}
                  >
                    + Place Counter-Hypothesis on World
                  </button>
                )}

                {challengeData.items.map((item, idx) => (
                  <div key={idx} className="gi-insight-card gi-insight-card--critical">
                    <div className="gi-insight-title">
                      <span>Vulnerability #{idx + 1}</span>
                      {item.targetNodeId && (
                        <button
                          type="button"
                          className="gi-insight-action"
                          onClick={() => handleFocus([item.targetNodeId])}
                        >
                          Focus Target
                        </button>
                      )}
                    </div>
                    <div className="gi-insight-desc">
                      <strong>Assumption:</strong> {item.critique}
                    </div>
                    <div className="gi-insight-desc" style={{ color: '#fca5a5' }}>
                      <strong>Alternative:</strong> {item.counterPerspective}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 0' }}>
                Click above to have AI act as Devil's Advocate and stress-test your premises.
              </div>
            )}
          </>
        )}

        {activeTab === 'socratic' && (
          <>
            <button
              type="button"
              className="gi-trigger-btn"
              onClick={handleRunSocratic}
              disabled={isLoadingAI || Object.keys(nodes).length === 0}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>help</span>
              <span>{isLoadingAI ? 'Formulating Inquiries...' : 'Ask Socratic Questions'}</span>
            </button>

            {socraticData ? (
              <>
                <div className="gi-critique-box">
                  <strong>Inquiry Focus:</strong> {socraticData.focus}
                </div>

                {socraticData.questions.map((q, idx) => (
                  <div key={q.id || idx} className="gi-insight-card gi-insight-card--info">
                    <div className="gi-insight-title">
                      <span>Question #{idx + 1}</span>
                      {q.relatedNodeIds && q.relatedNodeIds.length > 0 && (
                        <button
                          type="button"
                          className="gi-insight-action"
                          onClick={() => handleFocus(q.relatedNodeIds!)}
                        >
                          Focus Nodes
                        </button>
                      )}
                    </div>
                    <div className="gi-insight-desc" style={{ color: '#e0e7ff', fontWeight: 500 }}>
                      {q.question}
                    </div>
                    {q.learningGoal && (
                      <div className="gi-insight-desc" style={{ fontSize: 10, opacity: 0.8 }}>
                        Goal: {q.learningGoal}
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 0' }}>
                Click above to generate deep causal questions for learning through model construction.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
