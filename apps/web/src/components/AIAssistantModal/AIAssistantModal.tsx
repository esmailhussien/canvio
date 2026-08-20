import React, { useState } from 'react';
import {
  generateSpatialBoardAsync,
  BoardDocumentFormat,
  summarizeBoardWithAIAsync,
  organizeAndClusterWithAIAsync,
  generateSpatialBoard,
} from '../../utils/spatialAIEngine';
import { useCanvasStore } from '../../store/canvasStore';
import { fitTemplateToViewport, fitViewportToNodes } from '../../utils/viewportFit';
import './AIAssistantModal.css';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ isOpen, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiStatus, setAIStatus] = useState<{ kind: 'info' | 'error' | 'success'; text: string } | null>(null);

  const addNode = useCanvasStore((s) => s.addNode);
  const addRelation = useCanvasStore((s) => s.addRelation);
  const nodeCount = useCanvasStore((s) => Object.keys(s.nodes).length);
  const relationCount = useCanvasStore((s) => Object.keys(s.relations).length);
  const hasBoardContent = nodeCount > 0;

  // Close on Escape key press
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const closeWithAIStatus = (result: { message?: string; source?: string }) => {
    setAIStatus({
      kind: result.source === 'local' ? 'info' : 'success',
      text: result.source === 'local'
        ? result.message || 'Done with Canvio smart mode. Everything is editable.'
        : 'Done. Your board is ready to edit.',
    });
    window.setTimeout(onClose, result.source === 'local' ? 1500 : 900);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setAIStatus({ kind: 'info', text: 'Building a structured board...' });

    try {
      const result = await generateSpatialBoardAsync(prompt);
      const createdAt = Date.now();
      const taggedNodes = result.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          aiGenerated: true,
          aiPrompt: prompt,
          aiWorldTitle: result.title,
        },
        updatedAt: createdAt,
      }));
      const placedNodes = placeBoardAwayFromExisting(taggedNodes, Object.values(useCanvasStore.getState().nodes));

      // Add generated nodes and relations to the store
      placedNodes.forEach((node) => addNode(node));
      result.relations.forEach((rel) => addRelation(rel));
      fitViewportToNodes(placedNodes, { maxZoom: 0.95, minZoom: 0.42, paddingX: 220, paddingY: 240 });

      setPrompt('');
      closeWithAIStatus(result);
    } catch (err) {
      console.error('Failed to generate spatial board:', err);
      setAIStatus({ kind: 'error', text: 'AI generation failed. Please try again or switch to a local template.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBoardDocument = async (output: BoardDocumentFormat) => {
    if (!hasBoardContent) {
      setAIStatus({ kind: 'info', text: 'Add a note, shape, or drawing first. Then Canvio can explain the board.' });
      return;
    }
    setIsGenerating(true);
    setAIStatus({
      kind: 'info',
      text: output === 'article'
        ? 'Reading the board and writing an editable article draft...'
        : 'Reading the board graph and building a concise summary...',
    });
    try {
      const allNodes = Object.values(useCanvasStore.getState().nodes);
      const allRelations = Object.values(useCanvasStore.getState().relations);
      const res = await summarizeBoardWithAIAsync(allNodes, allRelations, output);
      const placedNodes = placeBoardAwayFromExisting(res.nodes, allNodes);
      placedNodes.forEach((n) => addNode(n));
      res.relations.forEach((r) => addRelation(r));
      fitTemplateToViewport(placedNodes);
      closeWithAIStatus(res);
    } catch (err) {
      console.error(`Board ${output} failed:`, err);
      setAIStatus({ kind: 'error', text: `${output === 'article' ? 'Article' : 'Summary'} failed. Please try again.` });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOrganizeCluster = async () => {
    if (!hasBoardContent) {
      setAIStatus({ kind: 'info', text: 'Add a few elements first. Then Canvio can group them into clear areas.' });
      return;
    }
    setIsGenerating(true);
    setAIStatus({ kind: 'info', text: 'Grouping related elements into clearer clusters...' });
    try {
      const allNodes = Object.values(useCanvasStore.getState().nodes);
      const updateNode = useCanvasStore.getState().updateNode;
      const result = await organizeAndClusterWithAIAsync(allNodes, updateNode, addNode);
      fitViewportToNodes(Object.values(useCanvasStore.getState().nodes), { minZoom: 0.5 });
      setAIStatus({
        kind: result.source === 'local' ? 'info' : 'success',
        text: result.message || 'Board organized into readable clusters.',
      });
      window.setTimeout(onClose, result.source === 'local' ? 1100 : 700);
    } catch (err) {
      console.error('Organize cluster failed:', err);
      setAIStatus({ kind: 'error', text: 'Organize failed. Please try again after selecting fewer elements.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const QUICK_PROMPTS = [
    {
      title: 'Lesson Board',
      prompt: 'Create a teacher-ready lesson board with learning goal, warm-up, explanation, student activity, check for understanding, and exit ticket',
    },
    {
      title: 'Study Guide',
      prompt: 'Turn this topic into a student study board with definition, examples, common mistakes, key facts, practice task, and review questions',
    },
    {
      title: 'Quiz Me',
      prompt: 'Create a quiz and revision board with 5 questions, answer checks, misconception notes, and a short study plan',
    },
    {
      title: 'Research Summary',
      prompt: 'Write a comprehensive research summary of this board with abstract, key findings, evidence, risks, and conclusion',
    },
    {
      title: 'Field Ops',
      prompt: 'Create a field operations board with map pins, teams, resources, evidence, risks, and decision flow',
    },
    {
      title: 'Architecture Review',
      prompt: 'Create a production web application architecture board with client, API, workers, database, observability, and risk notes',
    },
    {
      title: 'Product Discovery',
      prompt: 'Create a product discovery sprint board with research inputs, user problems, hypotheses, experiments, metrics, and decisions',
    },
    {
      title: 'Decision Room',
      prompt: 'Create a decision intelligence room with evidence, options, risks, owner, decision gate, and next action',
    },
    {
      title: 'Launch Plan',
      prompt: 'Create a launch operating plan with scope, QA, comms, metrics, risks, owners, code checklist, and launch gate',
    },
  ];

  return (
    <div className="ai-modal__overlay" onClick={onClose}>
      <div className="ai-modal__content" onClick={(e) => e.stopPropagation()}>
        <div className="ai-modal__topbar">
          <div className="ai-modal__title-wrap">
            <span className="ai-modal__sparkle" title="Canvio AI"><span className="material-symbols-outlined">auto_awesome</span></span>
            <div>
              <div className="ai-modal__eyebrow">Canvio AI</div>
              <h2 className="ai-modal__title">What are you working on?</h2>
              <p className="ai-modal__subtitle">Describe it naturally. Canvio builds structured nodes and relations for you.</p>
            </div>
          </div>
          <div className="ai-modal__header-actions">
            <button type="button" className="ai-modal__close" onClick={onClose} title="Close (Esc)" aria-label="Close AI modal">✕</button>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="ai-modal__form">
          <label className="ai-modal__input-label" htmlFor="canvio-ai-prompt">Tell Canvio what to make</label>
          <div className="ai-modal__input-wrapper">
            <textarea
              id="canvio-ai-prompt"
              autoFocus
              rows={2}
              className="ai-modal__input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: Make a study board about photosynthesis..."
              disabled={isGenerating}
            />
            <button type="submit" className="ai-modal__generate-btn" disabled={!prompt.trim() || isGenerating}>
              <span className="material-symbols-outlined" aria-hidden="true">lightbulb</span>
              <span>{isGenerating ? 'Working...' : 'Create board'}</span>
            </button>
          </div>
        </form>

        <div className="ai-modal__section-heading">
          <span>Work with this board</span>
          <span className="ai-modal__count">{hasBoardContent ? `${nodeCount} ${nodeCount === 1 ? 'element' : 'elements'} · ${relationCount} ${relationCount === 1 ? 'connection' : 'connections'}` : 'Nothing here yet'}</span>
        </div>
        <div className="ai-modal__quick-actions">
          <button type="button" className="ai-action-btn" onClick={() => handleBoardDocument('summary')} disabled={isGenerating || !hasBoardContent} title={hasBoardContent ? 'Create a concise summary from this board' : 'Add something to the board first'}>
            <span className="ai-action-btn__icon ai-action-btn__icon--purple"><span className="material-symbols-outlined" aria-hidden="true">summarize</span></span>
            <span className="ai-action-btn__copy"><strong>Summarize</strong><small>Key ideas, connections, and next steps</small></span>
          </button>
          <button type="button" className="ai-action-btn" onClick={() => handleBoardDocument('article')} disabled={isGenerating || !hasBoardContent} title={hasBoardContent ? 'Turn this board into an editable article draft' : 'Add something to the board first'}>
            <span className="ai-action-btn__icon ai-action-btn__icon--blue"><span className="material-symbols-outlined" aria-hidden="true">article</span></span>
            <span className="ai-action-btn__copy"><strong>Write article</strong><small>Build a structured draft from the board</small></span>
          </button>
          <button type="button" className="ai-action-btn" onClick={handleOrganizeCluster} disabled={isGenerating || !hasBoardContent} title={hasBoardContent ? 'Group related elements into clear areas' : 'Add something to the board first'}>
            <span className="ai-action-btn__icon ai-action-btn__icon--green"><span className="material-symbols-outlined" aria-hidden="true">grid_view</span></span>
            <span className="ai-action-btn__copy"><strong>Tidy</strong><small>Group related ideas together</small></span>
          </button>
        </div>

        {!hasBoardContent && (
          <div className="ai-modal__board-note">
            <span className="material-symbols-outlined" aria-hidden="true">lightbulb</span>
            <span>Start with a prompt above, or add a note to the canvas first.</span>
          </div>
        )}

        {!prompt.trim() && (
          <div className="ai-modal__quick-prompts">
            <div className="ai-modal__section-heading">
              <span>Try an example</span>
              <span className="ai-modal__count">Tap to edit it</span>
            </div>
            <div className="ai-modal__prompt-pills">
              {QUICK_PROMPTS.slice(0, 3).map((qp) => (
                <button
                  key={qp.title}
                  type="button"
                  className="ai-prompt-pill"
                  onClick={() => setPrompt(qp.prompt)}
                >
                  <strong>{qp.title}</strong>
                  <span>{qp.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {aiStatus && (
          <div className={`ai-modal__status ai-modal__status--${aiStatus.kind}`} role="status">
            {aiStatus.text}
          </div>
        )}
      </div>
    </div>
  );
};

function placeBoardAwayFromExisting(generatedNodes: ReturnType<typeof generateSpatialBoard>['nodes'], existingNodes: ReturnType<typeof generateSpatialBoard>['nodes']) {
  if (generatedNodes.length === 0 || existingNodes.length === 0) return generatedNodes;

  const generatedBounds = getBounds(generatedNodes);
  const existingBounds = getBounds(existingNodes);
  const intersects = !(
    generatedBounds.maxX < existingBounds.minX ||
    generatedBounds.minX > existingBounds.maxX ||
    generatedBounds.maxY < existingBounds.minY ||
    generatedBounds.minY > existingBounds.maxY
  );

  if (!intersects) return generatedNodes;

  const offsetX = existingBounds.maxX - generatedBounds.minX + 180;
  const offsetY = existingBounds.minY - generatedBounds.minY;
  return generatedNodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + offsetX,
      y: node.position.y + offsetY,
    },
  }));
}

function getBounds(nodes: ReturnType<typeof generateSpatialBoard>['nodes']) {
  return nodes.reduce((acc, node) => ({
    minX: Math.min(acc.minX, node.position.x),
    minY: Math.min(acc.minY, node.position.y),
    maxX: Math.max(acc.maxX, node.position.x + node.size.width),
    maxY: Math.max(acc.maxY, node.position.y + node.size.height),
  }), {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  });
}
