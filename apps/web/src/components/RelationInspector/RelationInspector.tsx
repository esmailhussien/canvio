import React, { useEffect, useRef, useState } from 'react';
import { useCanvasStore, RelationshipType } from '../../store/canvasStore';
import {
  IconMoreHorizontal,
  IconTrash,
  IconX,
  IconContradicts,
  IconDependsOn,
  IconEnables,
  IconBasedOn,
  IconPartOf,
  IconLeadsTo,
  IconInspiredBy,
  IconRelatedTo,
  IconProps
} from '@canvio/ui';
import { getRelationEndpointLabel, resolveRelationPorts } from '../RelationRenderer/relationUtils';
import './RelationInspector.css';

const RELATION_TYPES: {
  id: RelationshipType;
  label: string;
  Icon: React.ComponentType<IconProps>;
  shortcut: string;
  color: string;
}[] = [
  { id: 'contradicts', label: 'Contradicts', Icon: IconContradicts, shortcut: '1', color: '#ef4444' },
  { id: 'depends_on', label: 'Depends on', Icon: IconDependsOn, shortcut: '2', color: '#f59e0b' },
  { id: 'enables', label: 'Enables', Icon: IconEnables, shortcut: '3', color: '#10b981' },
  { id: 'based_on', label: 'Based on', Icon: IconBasedOn, shortcut: '4', color: '#06b6d4' },
  { id: 'part_of', label: 'Part of', Icon: IconPartOf, shortcut: '5', color: '#8b5cf6' },
  { id: 'leads_to', label: 'Leads to', Icon: IconLeadsTo, shortcut: '6', color: '#3b82f6' },
  { id: 'inspired_by', label: 'Inspired by', Icon: IconInspiredBy, shortcut: '7', color: '#ec4899' },
  { id: 'explains', label: 'Explains', Icon: IconBasedOn, shortcut: '8', color: '#8b5cf6' },
  { id: 'causes', label: 'Causes', Icon: IconLeadsTo, shortcut: '9', color: '#f97316' },
  { id: 'related_to', label: 'Related to', Icon: IconRelatedTo, shortcut: '0', color: '#94a3b8' },
];

const SUGGESTED_LABELS = [
  'explains', 'causes', 'example of', 'mitigates', 'future outcome', 'rule for', 'watch out', 'blocks', 'accelerates', 'validates', 'critical dependency', 'alternative to', 'direct consequence', 'evidenced by'
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
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const ignoreNextAdvancedClickRef = useRef(false);
  const selectedRelationId = useCanvasStore((s) => s.selectedRelationId);
  const relations = useCanvasStore((s) => s.relations);
  const nodes = useCanvasStore((s) => s.nodes);
  const viewport = useCanvasStore((s) => s.viewport);
  const updateRelation = useCanvasStore((s) => s.updateRelation);
  const snapshot = useCanvasStore((s) => s.snapshot);
  const removeRelation = useCanvasStore((s) => s.removeRelation);
  const selectRelation = useCanvasStore((s) => s.selectRelation);
  const relationSnapshotTakenRef = useRef<string | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    relationSnapshotTakenRef.current = null;
  }, [selectedRelationId]);

  // Double-clicking a relation on the canvas selects it and asks the
  // inspector to focus its label field for inline editing.
  useEffect(() => {
    const handleFocusLabel = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      if (detail?.id && detail.id === selectedRelationId) {
        window.setTimeout(() => labelInputRef.current?.select(), 0);
      }
    };
    window.addEventListener('canvio:focus-relation-label', handleFocusLabel);
    return () => window.removeEventListener('canvio:focus-relation-label', handleFocusLabel);
  }, [selectedRelationId]);

  // Keyboard shortcut listener (1-8 to pick relationship type instantly)
  useEffect(() => {
    if (!selectedRelationId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input/textarea
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;

      const matched = RELATION_TYPES.find((t) => t.shortcut === e.key);
      if (matched) {
        e.preventDefault();
        snapshot();
        updateRelation(selectedRelationId, { relationship: matched.id });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRelationId, snapshot, updateRelation]);

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
  const sourceLabel = getRelationEndpointLabel(sourceNode, relation.sourcePort);
  const targetLabel = getRelationEndpointLabel(targetNode, relation.targetPort);

  const patchRelation = (updates: Partial<typeof relation>) => {
    snapshot();
    updateRelation(relation.id, updates);
  };

  const snapshotLabelEdit = () => {
    if (relationSnapshotTakenRef.current === relation.id) return;
    snapshot();
    relationSnapshotTakenRef.current = relation.id;
  };

  const isNearTop = screenY < 440;
  const clampedX = Math.max(170, Math.min(rect.width - 170, screenX));
  const transform = isNearTop
    ? 'translate(-50%, 20px)'
    : 'translate(-50%, -100%) translateY(-20px)';

  return (
    <div
      className="relation-inspector canvio-toolbar-enter"
      style={{
        position: 'absolute',
        left: `${clampedX}px`,
        top: `${screenY}px`,
        transform,
        zIndex: 250
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="relation-inspector__header">
        <span className="relation-inspector__title">
          <span>Semantic Relation</span>
        </span>
        <div className="relation-inspector__header-actions">
          <button
            className={`relation-inspector__close ${isAdvancedOpen ? 'active' : ''}`}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              ignoreNextAdvancedClickRef.current = true;
              setIsAdvancedOpen((prev) => !prev);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (ignoreNextAdvancedClickRef.current) {
                ignoreNextAdvancedClickRef.current = false;
                return;
              }
              setIsAdvancedOpen((prev) => !prev);
            }}
            title="More relation controls"
            aria-label="More relation controls"
          >
            <IconMoreHorizontal size={14} />
          </button>
          <button
            className="relation-inspector__close"
            onClick={() => selectRelation(null)}
            title="Close inspector (Esc)"
          >
            <IconX size={14} />
          </button>
        </div>
      </div>

      <div className="relation-inspector__endpoints" aria-label={`Relation from ${sourceLabel} to ${targetLabel}`}>
        <div className="relation-inspector__endpoint">
          <span>From</span>
          <strong title={sourceLabel}>{sourceLabel}</strong>
        </div>
        <span className="relation-inspector__endpoint-arrow" aria-hidden="true">→</span>
        <div className="relation-inspector__endpoint relation-inspector__endpoint--target">
          <span>To</span>
          <strong title={targetLabel}>{targetLabel}</strong>
        </div>
      </div>

      {/* Semantic Relationship Type Selection */}
      <div className="relation-inspector__section">
        <div className="relation-inspector__label-row">
          <label className="relation-inspector__label">Semantic Type</label>
          <span className="relation-inspector__hint">Press 1-8</span>
        </div>
        <div className="relation-inspector__pills relation-inspector__pills--grid">
          {RELATION_TYPES.map((t) => {
            const isSelected = relation.relationship === t.id;
            return (
              <button
                key={t.id}
                className={`relation-inspector__pill ${isSelected ? 'active' : ''}`}
                style={{
                  borderColor: isSelected ? t.color : undefined,
                  boxShadow: isSelected ? `0 0 12px ${t.color}33` : undefined,
                }}
                onClick={() => patchRelation({ relationship: t.id })}
                title={`Press ${t.shortcut} for ${t.label}`}
              >
                <span className="relation-inspector__pill-icon" style={{ color: t.color }}>
                  <t.Icon size={14} />
                </span>
                <span className="relation-inspector__pill-text">{t.label}</span>
                <span className="relation-inspector__pill-key">{t.shortcut}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Label Input & Autocomplete Suggestions */}
      <div className="relation-inspector__section">
        <label className="relation-inspector__label">Assertion / Label</label>
        <input
          type="text"
          ref={labelInputRef}
          className="relation-inspector__input"
          placeholder="e.g. blocks rollout, requires review"
          value={relation.label || ''}
          onFocus={snapshotLabelEdit}
          onChange={(e) => updateRelation(relation.id, { label: e.target.value })}
          onBlur={() => { relationSnapshotTakenRef.current = null; }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLElement).blur();
            }
          }}
        />

        {/* Quick Autocomplete Suggestions */}
        <div className="relation-inspector__suggestions">
          {SUGGESTED_LABELS.map((sug) => (
            <button
              key={sug}
              type="button"
              className="relation-inspector__suggestion-chip"
              onClick={() => patchRelation({ label: sug })}
            >
              +{sug}
            </button>
          ))}
        </div>
      </div>

      {isAdvancedOpen && (
        <div className="relation-inspector__advanced">
          {/* Line Path Type */}
          <div className="relation-inspector__section">
            <label className="relation-inspector__label">Routing Style</label>
            <div className="relation-inspector__button-group">
              <button
                className={`relation-inspector__btn ${style.type === 'straight' ? 'active' : ''}`}
                onClick={() => patchRelation({ style: { ...style, type: 'straight' } })}
              >
                Straight
              </button>
              <button
                className={`relation-inspector__btn ${style.type === 'curved' ? 'active' : ''}`}
                onClick={() => patchRelation({ style: { ...style, type: 'curved' } })}
              >
                Curved
              </button>
              <button
                className={`relation-inspector__btn ${style.type === 'orthogonal' ? 'active' : ''}`}
                onClick={() => patchRelation({ style: { ...style, type: 'orthogonal' } })}
              >
                Smart Step
              </button>
            </div>
          </div>

          {/* Color Palette */}
          <div className="relation-inspector__section">
            <label className="relation-inspector__label">Custom Color Override</label>
            <div className="relation-inspector__colors">
              {LINE_COLORS.map((c) => (
                <button
                  key={c.value}
                  className={`relation-inspector__color-swatch ${style.color === c.value ? 'selected' : ''}`}
                  style={{ backgroundColor: c.value }}
                  onClick={() => patchRelation({ style: { ...style, color: c.value } })}
                  title={c.label}
                  aria-label={`${c.label} connection`}
                />
              ))}
            </div>
          </div>

          {/* Stroke Width */}
          <div className="relation-inspector__section">
            <label className="relation-inspector__label">Width: {style.width}px</label>
            <input
              type="range"
              min="1"
              max="8"
              value={style.width}
              onChange={(e) => patchRelation({ style: { ...style, width: parseInt(e.target.value) } })}
              className="relation-inspector__range"
            />
          </div>

          {/* Flow Animation Toggle */}
          <div className="relation-inspector__section">
            <label className="relation-inspector__checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(style.animated)}
                onChange={(e) => patchRelation({ style: { ...style, animated: e.target.checked } })}
              />
              <span>Pulse / Dynamic Flow Animation</span>
            </label>
          </div>
        </div>
      )}

      {/* Footer / Delete */}
      <div className="relation-inspector__footer">
        <button
          className="relation-inspector__delete-btn"
          onClick={() => {
            snapshot();
            removeRelation(relation.id);
          }}
          title="Delete this relation"
        >
          <IconTrash size={13} />
          <span>Delete Connection</span>
        </button>
      </div>
    </div>
  );
}
