import React from 'react';
import { useCanvasStore, RelationshipType } from '../../store/canvasStore';
import {
  IconTrash,
  IconX
} from '@canvio/ui';
import { resolveRelationPorts } from '../RelationRenderer/relationUtils';
import './RelationInspector.css';

const RELATION_TYPES: { id: RelationshipType; label: string }[] = [
  { id: 'related_to', label: 'Related to' },
  { id: 'leads_to', label: 'Leads to' },
  { id: 'depends_on', label: 'Depends on' },
  { id: 'contradicts', label: 'Contradicts' },
  { id: 'enables', label: 'Enables' },
  { id: 'part_of', label: 'Part of' },
  { id: 'inspired_by', label: 'Inspired by' },
  { id: 'based_on', label: 'Based on' }
];

const LINE_COLORS = [
  { value: 'var(--relation-default)', label: 'Default' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#ef4444', label: 'Red' },
  { value: '#22c55e', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#06b6d4', label: 'Cyan' }
];

export function RelationInspector() {
  const selectedRelationId = useCanvasStore((s) => s.selectedRelationId);
  const relations = useCanvasStore((s) => s.relations);
  const nodes = useCanvasStore((s) => s.nodes);
  const viewport = useCanvasStore((s) => s.viewport);
  const updateRelation = useCanvasStore((s) => s.updateRelation);
  const removeRelation = useCanvasStore((s) => s.removeRelation);
  const selectRelation = useCanvasStore((s) => s.selectRelation);

  if (!selectedRelationId) return null;
  const relation = relations[selectedRelationId];
  if (!relation) return null;

  const sourceNode = nodes[relation.sourceId];
  const targetNode = nodes[relation.targetId];
  if (!sourceNode || !targetNode) return null;

  // Screen coordinates for positioning floating inspector above midpoint
  const { sourcePort, targetPort } = resolveRelationPorts(sourceNode, targetNode, relation.sourcePort, relation.targetPort);
  const worldMidX = (sourcePort.x + targetPort.x) / 2;
  const worldMidY = (sourcePort.y + targetPort.y) / 2;

  const canvasEl = document.querySelector('.canvas');
  const rect = canvasEl ? canvasEl.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
  const screenX = rect.width / 2 + (worldMidX + viewport.x) * viewport.zoom;
  const screenY = rect.height / 2 + (worldMidY + viewport.y) * viewport.zoom;

  const style = relation.style || { type: 'straight', color: 'var(--relation-default)', width: 2, startArrow: 'none', endArrow: 'none' };

  return (
    <div
      className="relation-inspector canvio-toolbar-enter"
      style={{
        position: 'absolute',
        left: `${screenX}px`,
        top: `${screenY}px`,
        transform: 'translate(-50%, -100%) translateY(-20px)',
        zIndex: 250
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="relation-inspector__header">
        <span className="relation-inspector__title">Relation Options</span>
        <button
          className="relation-inspector__close"
          onClick={() => selectRelation(null)}
          title="Close inspector"
        >
          <IconX size={14} />
        </button>
      </div>

      {/* Relationship Type Selection */}
      <div className="relation-inspector__section">
        <label className="relation-inspector__label">Type</label>
        <div className="relation-inspector__pills">
          {RELATION_TYPES.map((t) => (
            <button
              key={t.id}
              className={`relation-inspector__pill ${relation.relationship === t.id ? 'active' : ''}`}
              onClick={() => updateRelation(relation.id, { relationship: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Label Input */}
      <div className="relation-inspector__section">
        <label className="relation-inspector__label">Custom Label</label>
        <input
          type="text"
          className="relation-inspector__input"
          placeholder="e.g. 50% flow"
          value={relation.label || ''}
          onChange={(e) => updateRelation(relation.id, { label: e.target.value })}
        />
      </div>

      {/* Line Path Type */}
      <div className="relation-inspector__section">
        <label className="relation-inspector__label">Routing Style</label>
        <div className="relation-inspector__button-group">
          <button
            className={`relation-inspector__btn ${style.type === 'straight' ? 'active' : ''}`}
            onClick={() => updateRelation(relation.id, { style: { ...style, type: 'straight' } })}
          >
            Straight
          </button>
          <button
            className={`relation-inspector__btn ${style.type === 'curved' ? 'active' : ''}`}
            onClick={() => updateRelation(relation.id, { style: { ...style, type: 'curved' } })}
          >
            Curved
          </button>
          <button
            className={`relation-inspector__btn ${style.type === 'orthogonal' ? 'active' : ''}`}
            onClick={() => updateRelation(relation.id, { style: { ...style, type: 'orthogonal' } })}
          >
            Step
          </button>
        </div>
      </div>

      {/* Arrow Heads Control (Start & End) */}
      <div className="relation-inspector__section">
        <label className="relation-inspector__label">Arrow Heads</label>
        <div className="relation-inspector__button-group">
          <button
            className={`relation-inspector__btn ${style.startArrow === 'none' && style.endArrow === 'none' ? 'active' : ''}`}
            onClick={() => updateRelation(relation.id, { style: { ...style, startArrow: 'none', endArrow: 'none' } })}
          >
            None
          </button>
          <button
            className={`relation-inspector__btn ${style.startArrow === 'none' && style.endArrow === 'arrow' ? 'active' : ''}`}
            onClick={() => updateRelation(relation.id, { style: { ...style, startArrow: 'none', endArrow: 'arrow' } })}
          >
            End ➔
          </button>
          <button
            className={`relation-inspector__btn ${style.startArrow === 'arrow' && style.endArrow === 'none' ? 'active' : ''}`}
            onClick={() => updateRelation(relation.id, { style: { ...style, startArrow: 'arrow', endArrow: 'none' } })}
          >
            Start
          </button>
          <button
            className={`relation-inspector__btn ${style.startArrow === 'arrow' && style.endArrow === 'arrow' ? 'active' : ''}`}
            onClick={() => updateRelation(relation.id, { style: { ...style, startArrow: 'arrow', endArrow: 'arrow' } })}
          >
            Both
          </button>
        </div>
      </div>

      {/* Animation Flow Toggle */}
      <div className="relation-inspector__section relation-inspector__row">
        <button
          className={`relation-inspector__toggle ${style.animated ? 'active' : ''}`}
          onClick={() => updateRelation(relation.id, {
            style: { ...style, animated: !style.animated }
          })}
        >
          Animated Flow
        </button>
      </div>

      {/* Color Palette */}
      <div className="relation-inspector__section">
        <label className="relation-inspector__label">Color</label>
        <div className="relation-inspector__colors">
          {LINE_COLORS.map((c) => (
            <button
              key={c.value}
              className={`relation-inspector__color-btn ${style.color === c.value ? 'selected' : ''}`}
              style={{ backgroundColor: c.value }}
              onClick={() => updateRelation(relation.id, { style: { ...style, color: c.value } })}
              title={c.label}
            />
          ))}
        </div>
      </div>

      {/* Delete Action */}
      <div className="relation-inspector__footer">
        <button
          className="relation-inspector__delete-btn"
          onClick={() => {
            removeRelation(relation.id);
            selectRelation(null);
          }}
        >
          <IconTrash size={14} /> Delete Relation
        </button>
      </div>
    </div>
  );
}
