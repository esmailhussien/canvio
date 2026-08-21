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

type AIIntent = 'create' | 'study' | 'summary' | 'article' | 'organize';

const AI_INTENTS: Array<{
  id: AIIntent;
  label: string;
  icon: string;
  helper: string;
  placeholder: string;
  submitLabel: string;
}> = [
  {
    id: 'create',
    label: 'Create',
    icon: 'auto_awesome',
    helper: 'Create a new board or extend the current one with editable notes, shapes, and relations.',
    placeholder: 'Example: Make a product discovery board for a new study app...',
    submitLabel: 'Create board',
  },
  {
    id: 'study',
    label: 'Study',
    icon: 'school',
    helper: 'Use the topic and current board context to build examples, mistakes, and practice.',
    placeholder: 'Example: Explain photosynthesis for grade 7 with examples and quiz questions...',
    submitLabel: 'Create study board',
  },
  {
    id: 'summary',
    label: 'Summary',
    icon: 'summarize',
    helper: 'Read the current board and create a concise editable summary.',
    placeholder: '',
    submitLabel: 'Summarize board',
  },
  {
    id: 'article',
    label: 'Article',
    icon: 'article',
    helper: 'Turn the current board into a structured article draft.',
    placeholder: '',
    submitLabel: 'Write article',
  },
  {
    id: 'organize',
    label: 'Tidy',
    icon: 'grid_view',
    helper: 'Group related elements and make the canvas easier to scan.',
    placeholder: '',
    submitLabel: 'Tidy board',
  },
];

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ isOpen, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [activeIntent, setActiveIntent] = useState<AIIntent>('create');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiStatus, setAIStatus] = useState<{ kind: 'info' | 'error' | 'success'; text: string } | null>(null);

  const addNode = useCanvasStore((s) => s.addNode);
  const addRelation = useCanvasStore((s) => s.addRelation);
  const nodeCount = useCanvasStore((s) => Object.keys(s.nodes).length);
  const relationCount = useCanvasStore((s) => Object.keys(s.relations).length);
  const hasBoardContent = nodeCount > 0;
  const activeIntentConfig = AI_INTENTS.find((intent) => intent.id === activeIntent) || AI_INTENTS[0];
  const isPromptIntent = activeIntent === 'create' || activeIntent === 'study';

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
    if (!isPromptIntent) {
      handleBoardIntentAction(activeIntent);
      return;
    }
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setAIStatus({ kind: 'info', text: 'Building a structured board...' });

    try {
      const result = await generateSpatialBoardAsync(buildIntentPrompt(activeIntent, prompt));
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

  const handleIntentChange = (intent: AIIntent) => {
    setActiveIntent(intent);
    setAIStatus(null);
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

  const handleBoardIntentAction = (intent: AIIntent) => {
    if (!hasBoardContent) {
      setAIStatus({ kind: 'info', text: 'Add a note, shape, map pin, or relation first. Then Canvio can use the board.' });
      return;
    }

    if (intent === 'summary') {
      void handleBoardDocument('summary');
      return;
    }

    if (intent === 'article') {
      void handleBoardDocument('article');
      return;
    }

    if (intent === 'organize') {
      void handleOrganizeCluster();
    }
  };

  const QUICK_PROMPTS = {
    create: [
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
    ],
    study: [
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
    ],
  } satisfies Record<'create' | 'study', Array<{ title: string; prompt: string }>>;

  const quickPrompts = isPromptIntent ? QUICK_PROMPTS[activeIntent] : [];

  const BOARD_ACTIONS = [
    {
      intent: 'summary' as AIIntent,
      title: 'Summarize',
      detail: 'Key ideas, connections, and next steps',
      icon: 'summarize',
      iconClass: 'ai-action-btn__icon--purple',
    },
    {
      intent: 'article' as AIIntent,
      title: 'Write article',
      detail: 'Build a structured draft from the board',
      icon: 'article',
      iconClass: 'ai-action-btn__icon--blue',
    },
    {
      intent: 'organize' as AIIntent,
      title: 'Tidy',
      detail: 'Group related ideas together',
      icon: 'grid_view',
      iconClass: 'ai-action-btn__icon--green',
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

        <div className="ai-modal__intent-grid" role="tablist" aria-label="Choose AI action">
          {AI_INTENTS.map((intent) => (
            <button
              key={intent.id}
              type="button"
              role="tab"
              aria-selected={activeIntent === intent.id}
              className={`ai-modal__intent ${activeIntent === intent.id ? 'active' : ''}`}
              onClick={() => handleIntentChange(intent.id)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{intent.icon}</span>
              <span>{intent.label}</span>
            </button>
          ))}
        </div>

        <div className="ai-modal__intent-help">
          <span className="material-symbols-outlined" aria-hidden="true">{activeIntentConfig.icon}</span>
          <span>{activeIntentConfig.helper}</span>
          {isPromptIntent && hasBoardContent && (
            <strong>{`Will use current board: ${nodeCount} ${nodeCount === 1 ? 'element' : 'elements'}, ${relationCount} ${relationCount === 1 ? 'connection' : 'connections'}`}</strong>
          )}
          {!isPromptIntent && (
            <strong>{hasBoardContent ? `Using ${nodeCount} ${nodeCount === 1 ? 'element' : 'elements'} and ${relationCount} ${relationCount === 1 ? 'connection' : 'connections'}` : 'Add board content first'}</strong>
          )}
        </div>

        {isPromptIntent ? (
          <form onSubmit={handleGenerate} className="ai-modal__form">
            <label className="ai-modal__input-label" htmlFor="canvio-ai-prompt">{activeIntent === 'study' ? 'What should learners understand?' : 'Tell Canvio what to make'}</label>
            <div className="ai-modal__input-wrapper">
              <textarea
                id="canvio-ai-prompt"
                autoFocus
                rows={2}
                className="ai-modal__input"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activeIntentConfig.placeholder}
                disabled={isGenerating}
              />
              <button type="submit" className="ai-modal__generate-btn" disabled={!prompt.trim() || isGenerating}>
                <span className="material-symbols-outlined" aria-hidden="true">lightbulb</span>
                <span>{isGenerating ? 'Working...' : activeIntentConfig.submitLabel}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="ai-modal__board-intent-card">
            <span className="ai-modal__board-intent-icon material-symbols-outlined" aria-hidden="true">{activeIntentConfig.icon}</span>
            <div>
              <strong>{activeIntentConfig.submitLabel}</strong>
              <span>{activeIntentConfig.helper}</span>
            </div>
            <button type="button" className="ai-modal__generate-btn" onClick={() => handleBoardIntentAction(activeIntent)} disabled={isGenerating || !hasBoardContent}>
              <span className="material-symbols-outlined" aria-hidden="true">{activeIntentConfig.icon}</span>
              <span>{isGenerating ? 'Working...' : activeIntentConfig.submitLabel}</span>
            </button>
          </div>
        )}

        <div className="ai-modal__section-heading">
          <span>Work with this board</span>
          <span className="ai-modal__count">{hasBoardContent ? `${nodeCount} ${nodeCount === 1 ? 'element' : 'elements'} · ${relationCount} ${relationCount === 1 ? 'connection' : 'connections'}` : 'Nothing here yet'}</span>
        </div>
        <div className="ai-modal__quick-actions">
          {BOARD_ACTIONS.map((action) => (
            <button
              key={action.intent}
              type="button"
              className={`ai-action-btn ${activeIntent === action.intent ? 'active' : ''}`}
              onClick={() => handleBoardIntentAction(action.intent)}
              disabled={isGenerating || !hasBoardContent}
              title={hasBoardContent ? action.detail : 'Add something to the board first'}
            >
              <span className={`ai-action-btn__icon ${action.iconClass}`}><span className="material-symbols-outlined" aria-hidden="true">{action.icon}</span></span>
              <span className="ai-action-btn__copy"><strong>{action.title}</strong><small>{action.detail}</small></span>
            </button>
          ))}
        </div>

        {!hasBoardContent && (
          <div className="ai-modal__board-note">
            <span className="material-symbols-outlined" aria-hidden="true">lightbulb</span>
            <span>Start with a prompt above, or add a note to the canvas first.</span>
          </div>
        )}

        {isPromptIntent && !prompt.trim() && (
          <div className="ai-modal__quick-prompts">
            <div className="ai-modal__section-heading">
              <span>Try an example</span>
              <span className="ai-modal__count">Tap to edit it</span>
            </div>
            <div className="ai-modal__prompt-pills">
              {quickPrompts.map((qp) => (
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

function buildIntentPrompt(intent: AIIntent, prompt: string) {
  const { nodes, relations } = useCanvasStore.getState();
  const nodeCount = Object.keys(nodes).length;
  const relationCount = Object.keys(relations).length;
  const boardDigest = buildBoardPromptDigest();
  const boardInstruction = nodeCount > 0
    ? `Use the existing Canvio board context as source material. Respect current node text, relation labels, relationship types, and map pins. Extend or reorganize the user's existing idea instead of starting from an unrelated blank topic. Current board has ${nodeCount} elements and ${relationCount} connections.\n\nBoard digest:\n${boardDigest}`
    : 'No existing board context is available, so create a useful standalone board from the user prompt.';

  if (intent === 'study') {
    return [
      boardInstruction,
      'Create a learner-friendly visual board with a clear core concept, definitions, examples, common mistakes, practice prompts, review questions, and labeled relations.',
      prompt,
    ].join('\n\n');
  }

  return [
    boardInstruction,
    'Create a useful visual board with varied element types, readable spacing, semantic relation labels, and a clear editable structure.',
    prompt,
  ].join('\n\n');
}

function buildBoardPromptDigest() {
  const { nodes, relations } = useCanvasStore.getState();
  const nodeList = Object.values(nodes).slice(0, 10);
  const nodeById = new Map(nodeList.map((node) => [node.id, node]));
  const nodeLines = nodeList.map((node, index) => `${index + 1}. ${getBoardNodeLabel(node)}`);
  const relationLines = Object.values(relations).slice(0, 10).map((relation, index) => {
    const source = getBoardNodeTitle(nodeById.get(relation.sourceId));
    const target = getBoardNodeTitle(nodeById.get(relation.targetId));
    const label = relation.label || relation.relationship.replace(/_/g, ' ');
    return `${index + 1}. ${source} -> ${label} -> ${target}`;
  });

  return [
    nodeLines.length > 0 ? `Elements:\n${nodeLines.join('\n')}` : 'Elements: none',
    relationLines.length > 0 ? `Connections:\n${relationLines.join('\n')}` : 'Connections: none',
  ].join('\n');
}

function getBoardNodeLabel(node: ReturnType<typeof generateSpatialBoard>['nodes'][number]) {
  const title = getBoardNodeTitle(node);
  const pinText = node.type === 'map' ? getMapPinDigest(node) : '';
  return `${node.type}: ${title}${pinText ? ` (${pinText})` : ''}`.slice(0, 220);
}

function getBoardNodeTitle(node?: ReturnType<typeof generateSpatialBoard>['nodes'][number]) {
  if (!node) return 'Unknown element';
  const data = node.data as Record<string, unknown> | undefined;
  const raw = data?.title || data?.label || data?.text || data?.content;
  return typeof raw === 'string' && raw.trim()
    ? raw.replace(/\s+/g, ' ').trim().slice(0, 120)
    : node.type === 'map' ? 'Living map' : `${node.type} element`;
}

function getMapPinDigest(node: ReturnType<typeof generateSpatialBoard>['nodes'][number]) {
  const data = node.data as Record<string, unknown> | undefined;
  const markers = Array.isArray(data?.markers) ? data.markers : [];
  const labels = markers.slice(0, 4).flatMap((marker) => {
    if (!marker || typeof marker !== 'object') return [];
    const value = marker as Record<string, unknown>;
    return [String(value.label || 'map pin').replace(/\s+/g, ' ').trim().slice(0, 50)];
  });
  return labels.length > 0 ? `pins: ${labels.join(', ')}` : '';
}
