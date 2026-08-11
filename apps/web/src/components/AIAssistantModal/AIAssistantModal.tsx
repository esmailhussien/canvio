import React, { useState } from 'react';
import {
  generateSpatialBoard,
  generateSpatialBoardAsync,
  BoardDocumentFormat,
  summarizeBoardWithAIAsync,
  organizeAndClusterWithAIAsync
} from '../../utils/spatialAIEngine';
import { useCanvasStore } from '../../store/canvasStore';
import { fitTemplateToViewport, fitViewportToNodes } from '../../utils/viewportFit';
import './AIAssistantModal.css';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function GeminiLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 24C12 17.3726 17.3726 12 24 12C17.3726 12 12 6.62742 12 0C12 6.62742 6.62742 12 0 12C6.62742 12 12 17.3726 12 24Z"
        fill="url(#gemini-grad)"
      />
      <defs>
        <linearGradient id="gemini-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4285F4" />
          <stop offset="0.5" stopColor="#9B51E0" />
          <stop offset="1" stopColor="#E91E63" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function OpenAILogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#10a37f" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.04 6.04 0 0 0-6.51-2.9 6.06 6.06 0 0 0-4.87-2.33 6.06 6.06 0 0 0-5.74 4.14 6.04 6.04 0 0 0-4.3 3.12 6 6 0 0 0 .73 6.72 5.98 5.98 0 0 0 .51 4.9 6.05 6.05 0 0 0 6.52 2.9 6.05 6.05 0 0 0 4.86 2.34 6.06 6.06 0 0 0 5.75-4.14 6.04 6.04 0 0 0 4.3-3.13 6 6 0 0 0-.73-6.71zm-9.54 11.23a4.48 4.48 0 0 1-2.31-.64l.14-.08 3.84-2.22a.79.79 0 0 0 .39-.68v-5.42l1.63.94a.07.07 0 0 1 .04.06v4.75a4.5 4.5 0 0 1-3.73 3.29z" />
    </svg>
  );
}

function AnthropicLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#d97706" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M13.82 3.5h-3.64L3.5 20.5h3.64l1.68-4.2h6.36l1.68 4.2h3.64L13.82 3.5zm-3.64 9.8 1.82-4.55 1.82 4.55h-3.64z" />
    </svg>
  );
}

type AIProvider = 'gemini' | 'openai' | 'anthropic';

interface ProviderConfig {
  name: string;
  icon: React.ReactNode;
  models: string[];
}

const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  gemini: {
    name: 'Google Gemini',
    icon: <GeminiLogo size={15} />,
    models: ['gemini-2.5-flash'],
  },
  openai: {
    name: 'OpenAI',
    icon: <OpenAILogo size={15} />,
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  },
  anthropic: {
    name: 'Anthropic Claude',
    icon: <AnthropicLogo size={15} />,
    models: ['claude-3-5-sonnet', 'claude-3-5-haiku'],
  },
};

function getStoredProvider(): AIProvider {
  const stored = localStorage.getItem('CANVIO_AI_PROVIDER');
  return stored && Object.prototype.hasOwnProperty.call(PROVIDER_CONFIGS, stored)
    ? stored as AIProvider
    : 'gemini';
}

function getStoredModel(provider: AIProvider) {
  const stored = localStorage.getItem('CANVIO_AI_MODEL');
  return stored && PROVIDER_CONFIGS[provider].models.includes(stored)
    ? stored
    : PROVIDER_CONFIGS[provider].models[0];
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ isOpen, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiStatus, setAIStatus] = useState<{ kind: 'info' | 'error' | 'success'; text: string } | null>(null);

  const [provider, setProvider] = useState<AIProvider>(() => {
    return getStoredProvider();
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return getStoredModel(getStoredProvider());
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    localStorage.setItem('CANVIO_AI_PROVIDER', newProvider);
    const defaultModel = PROVIDER_CONFIGS[newProvider].models[0];
    setSelectedModel(defaultModel);
    localStorage.setItem('CANVIO_AI_MODEL', defaultModel);
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('CANVIO_AI_MODEL', model);
  };

  const currentConfig = PROVIDER_CONFIGS[provider];

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
      const result = await generateSpatialBoardAsync(prompt, provider, undefined, selectedModel);
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
            <span className="ai-modal__sparkle" title="Canvio Spatial AI">✨</span>
            <div>
              <div className="ai-modal__eyebrow">Canvio AI</div>
              <h2 className="ai-modal__title">What are you working on?</h2>
              <p className="ai-modal__subtitle">Describe it naturally. Canvio creates editable ideas and connections.</p>
            </div>
          </div>
          <div className="ai-modal__header-actions">
            <button
              type="button"
              className={`ai-modal__settings-toggle ${isSettingsOpen ? 'active' : ''}`}
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              title="Open advanced AI settings"
            >
              <span className="material-symbols-outlined text-sm">settings</span>
              <span>{isSettingsOpen ? 'Close advanced' : 'Advanced'}</span>
            </button>
            <button type="button" className="ai-modal__close" onClick={onClose} title="Close (Esc)" aria-label="Close AI assistant">✕</button>
          </div>
        </div>

        {!isSettingsOpen && (
          <>
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
                  <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
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
          </>
        )}

        {isSettingsOpen && (
          <div className="ai-modal__settings">
          <div className="ai-modal__settings-top">
            <div className="ai-modal__provider-tabs">
              {(Object.keys(PROVIDER_CONFIGS) as AIProvider[]).map((p) => {
                return (
                  <button
                    key={p}
                    type="button"
                    className={`ai-provider-tab ${provider === p ? 'active' : ''}`}
                    onClick={() => handleProviderChange(p)}
                  >
                    <span className="ai-provider-icon">{PROVIDER_CONFIGS[p].icon}</span>
                    <span className="ai-provider-name">{PROVIDER_CONFIGS[p].name}</span>
                    <span className="ai-provider-dot active" title="Server-managed provider" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ai-modal__settings-fields">
            <div className="ai-modal__field-group flex-1">
              <div className="ai-modal__settings-header">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#10b981' }}>admin_panel_settings</span>
                  <span>Private Server AI</span>
                </span>
              </div>
              <div className="ai-modal__server-note">
                Provider keys now live on the API server. If no server key is configured, Canvio uses the local smart generator automatically.
              </div>
            </div>

            <div className="ai-modal__field-group">
              <div className="ai-modal__settings-header">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#8083ff' }}>tune</span>
                  <span>Model Engine</span>
                </span>
              </div>
              <select
                className="ai-modal__model-select"
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
              >
                {currentConfig.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="ai-modal__settings-footer">
            <span className="ai-modal__settings-hint flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#10b981' }}>lock</span>
              <span>Safer by default: browser sessions do not store or transmit provider API keys.</span>
            </span>
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
