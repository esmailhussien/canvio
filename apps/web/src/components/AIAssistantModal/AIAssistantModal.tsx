import React, { useState } from 'react';
import {
  generateSpatialBoard,
  generateSpatialBoardAsync,
  summarizeBoardWithAIAsync,
  organizeAndClusterWithAIAsync
} from '../../utils/spatialAIEngine';
import { useCanvasStore } from '../../store/canvasStore';
import { fitViewportToNodes } from '../../utils/viewportFit';
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
  link: string;
  placeholder: string;
  models: string[];
}

const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  gemini: {
    name: 'Google Gemini',
    icon: <GeminiLogo size={15} />,
    link: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AIzaSy...',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash'],
  },
  openai: {
    name: 'OpenAI',
    icon: <OpenAILogo size={15} />,
    link: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-proj-...',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  },
  anthropic: {
    name: 'Anthropic Claude',
    icon: <AnthropicLogo size={15} />,
    link: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-...',
    models: ['claude-3-5-sonnet', 'claude-3-5-haiku'],
  },
};

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ isOpen, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [provider, setProvider] = useState<AIProvider>(() => {
    return (localStorage.getItem('CANVIO_AI_PROVIDER') as AIProvider) || 'gemini';
  });

  const [keys, setKeys] = useState<Record<AIProvider, string>>(() => ({
    gemini: localStorage.getItem('CANVIO_GEMINI_KEY') || '',
    openai: localStorage.getItem('CANVIO_OPENAI_KEY') || localStorage.getItem('CANVIO_AI_API_KEY') || '',
    anthropic: localStorage.getItem('CANVIO_ANTHROPIC_KEY') || '',
  }));

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('CANVIO_AI_MODEL') || 'gemini-2.5-flash';
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const addNode = useCanvasStore((s) => s.addNode);
  const addRelation = useCanvasStore((s) => s.addRelation);

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

  const handleKeyChange = (val: string) => {
    const updated = { ...keys, [provider]: val };
    setKeys(updated);
    const storageKey = provider === 'gemini' ? 'CANVIO_GEMINI_KEY' : provider === 'openai' ? 'CANVIO_OPENAI_KEY' : 'CANVIO_ANTHROPIC_KEY';
    localStorage.setItem(storageKey, val);
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('CANVIO_AI_MODEL', model);
  };

  const currentConfig = PROVIDER_CONFIGS[provider];
  const currentKey = keys[provider];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);

    try {
      const result = await generateSpatialBoardAsync(prompt, provider, currentKey, selectedModel);
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
      fitViewportToNodes(placedNodes, { minZoom: 0.58 });

      setPrompt('');
      onClose();
    } catch (err) {
      console.error('Failed to generate spatial board:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSummarizeBoard = async () => {
    setIsGenerating(true);
    try {
      const allNodes = Object.values(useCanvasStore.getState().nodes);
      const allRelations = Object.values(useCanvasStore.getState().relations);
      const res = await summarizeBoardWithAIAsync(allNodes, allRelations);
      res.nodes.forEach((n) => addNode(n));
      res.relations.forEach((r) => addRelation(r));
      fitViewportToNodes(res.nodes, { minZoom: 0.5 });
      onClose();
    } catch (err) {
      console.error('Summarize board failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOrganizeCluster = async () => {
    setIsGenerating(true);
    try {
      const allNodes = Object.values(useCanvasStore.getState().nodes);
      const updateNode = useCanvasStore.getState().updateNode;
      await organizeAndClusterWithAIAsync(allNodes, updateNode, addNode);
      fitViewportToNodes(Object.values(useCanvasStore.getState().nodes), { minZoom: 0.5 });
      onClose();
    } catch (err) {
      console.error('Organize cluster failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const QUICK_PROMPTS = [
    {
      title: '🎓 Academic Research Summary',
      prompt: 'Write a comprehensive research paper summary of this board with Abstract, Methodology, Key Findings, Risks, and Academic Conclusion',
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
        <div className="ai-modal__header-row">
          <span className="ai-modal__sparkle" title="Canvio Spatial AI">✨</span>
          <form onSubmit={handleGenerate} className="ai-modal__form flex-1" style={{ flex: 1, margin: 0 }}>
            <div className="ai-modal__input-wrapper">
              <input
                autoFocus
                className="ai-modal__input"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask AI to generate a World, summarize, or organize... (Ctrl+K)"
                disabled={isGenerating}
              />
              <button type="submit" className="ai-modal__generate-btn" disabled={!prompt.trim() || isGenerating}>
                {isGenerating ? 'Running...' : 'Generate'}
              </button>
            </div>
          </form>
          <div className="ai-modal__header-actions">
            <button
              type="button"
              className={`ai-modal__settings-toggle ${isSettingsOpen ? 'active' : ''}`}
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              title="Toggle API Key & Model Settings"
            >
              <span className="material-symbols-outlined text-sm">settings</span>
              <span>{isSettingsOpen ? 'Hide' : 'Settings'}</span>
            </button>
            <button className="ai-modal__close" onClick={onClose} title="Close (Esc)">✕</button>
          </div>
        </div>

        {!isSettingsOpen && (
          <>
            <div className="ai-modal__quick-actions">
              <button type="button" className="ai-action-btn" onClick={handleSummarizeBoard} disabled={isGenerating}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#8083ff' }}>summarize</span>
                <span>✨ Summarize Board</span>
              </button>
              <button type="button" className="ai-action-btn" onClick={handleOrganizeCluster} disabled={isGenerating}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#22c55e' }}>grid_view</span>
                <span>✨ Organize & Cluster</span>
              </button>
            </div>

            {!prompt.trim() && (
              <div className="ai-modal__quick-prompts">
                <span className="ai-modal__prompts-label">Suggested Starters</span>
                <div className="ai-modal__prompt-pills">
                  {QUICK_PROMPTS.slice(0, 3).map((qp) => (
                    <button
                      key={qp.title}
                      className="ai-prompt-pill"
                      onClick={() => setPrompt(qp.prompt)}
                    >
                      <strong>{qp.title}:</strong> <span>{qp.prompt}</span>
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
                const hasKey = Boolean(keys[p]?.trim());
                return (
                  <button
                    key={p}
                    type="button"
                    className={`ai-provider-tab ${provider === p ? 'active' : ''}`}
                    onClick={() => handleProviderChange(p)}
                  >
                    <span className="ai-provider-icon">{PROVIDER_CONFIGS[p].icon}</span>
                    <span className="ai-provider-name">{PROVIDER_CONFIGS[p].name}</span>
                    <span className={`ai-provider-dot ${hasKey ? 'active' : ''}`} title={hasKey ? 'Key configured' : 'No key added'} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ai-modal__settings-fields">
            <div className="ai-modal__field-group flex-1">
              <div className="ai-modal__settings-header">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#f59e0b' }}>key</span>
                  <span>API Key ({currentConfig.name})</span>
                </span>
                <a href={currentConfig.link} target="_blank" rel="noreferrer" className="ai-modal__key-link">
                  Get Key ↗
                </a>
              </div>
              <div className="ai-modal__key-input-wrapper">
                <input
                  type={showKey ? 'text' : 'password'}
                  className="ai-modal__api-key-input"
                  placeholder={currentConfig.placeholder}
                  value={currentKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                />
                <button
                  type="button"
                  className="ai-modal__toggle-key-btn"
                  onClick={() => setShowKey((prev) => !prev)}
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {showKey ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
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
              <span>Local & Private: Your key stays in your browser's local storage and is sent directly to {currentConfig.name}.</span>
            </span>
          </div>
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
