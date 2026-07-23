import React, { useState } from 'react';
import { generateSpatialBoard } from '../../utils/spatialAIEngine';
import { useCanvasStore } from '../../store/canvasStore';
import { fitViewportToNodes } from '../../utils/viewportFit';
import './AIAssistantModal.css';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ isOpen, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const addNode = useCanvasStore((s) => s.addNode);
  const addRelation = useCanvasStore((s) => s.addRelation);

  if (!isOpen) return null;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);

    setTimeout(() => {
      const result = generateSpatialBoard(prompt);
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

      setIsGenerating(false);
      setPrompt('');
      onClose();
    }, 600);
  };

  const QUICK_PROMPTS = [
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
        <div className="ai-modal__header">
          <div className="ai-modal__title-group">
            <span className="ai-modal__sparkle">✨</span>
            <div>
              <h3>Spatial AI Navigator</h3>
              <p>Generate a structured World with meaningful Nodes, Relations, owners, risks, and map pins when useful.</p>
            </div>
          </div>
          <button className="ai-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="ai-modal__quality-row">
          <span>Spatial layout</span>
          <span>Semantic relations</span>
          <span>Viewport fitted</span>
          <span>Map-aware when useful</span>
        </div>

        <form onSubmit={handleGenerate} className="ai-modal__form">
          <div className="ai-modal__input-wrapper">
            <input
              autoFocus
              className="ai-modal__input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the board you want to build..."
              disabled={isGenerating}
            />
            <button type="submit" className="ai-modal__generate-btn" disabled={!prompt.trim() || isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate World'}
            </button>
          </div>
        </form>

        <div className="ai-modal__quick-prompts">
          <span>High-quality starters</span>
          <div className="ai-modal__prompt-pills">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp.title}
                className="ai-prompt-pill"
                onClick={() => setPrompt(qp.prompt)}
              >
                <strong>{qp.title}</strong>
                <span>{qp.prompt}</span>
              </button>
            ))}
          </div>
        </div>
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
