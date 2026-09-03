import React, { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { LivingNode, Point } from '../types';
import './ShapeNode.css';

export type ShapeType = 'rectangle' | 'circle' | 'diamond' | 'triangle' | 'hexagon';

export interface ShapeData {
  shape: ShapeType;
  fill: string;
  stroke: string;
  strokeWidth: number;
  label: string;
  opacity: number;
  direction?: 'ltr' | 'rtl' | 'auto';
  textAlign?: 'left' | 'center' | 'right';
}

interface ShapeNodeProps {
  node: LivingNode;
  selected?: boolean;
  onChange?: (id: string, updates: Partial<LivingNode>) => void;
}

const SHAPE_OPTIONS: { id: ShapeType; label: string; icon: string }[] = [
  { id: 'rectangle', label: 'Rectangle', icon: 'crop_square' },
  { id: 'circle', label: 'Circle', icon: 'radio_button_unchecked' },
  { id: 'diamond', label: 'Diamond', icon: 'diamond' },
  { id: 'triangle', label: 'Triangle', icon: 'change_history' },
  { id: 'hexagon', label: 'Hexagon', icon: 'hexagon' },
];

const COLOR_PRESETS = [
  { stroke: '#6366f1', fill: 'rgba(99, 102, 241, 0.15)', name: 'Indigo' },
  { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.15)', name: 'Emerald' },
  { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.15)', name: 'Amber' },
  { stroke: '#f43f5e', fill: 'rgba(244, 63, 94, 0.15)', name: 'Rose' },
  { stroke: '#0ea5e9', fill: 'rgba(14, 165, 233, 0.15)', name: 'Sky' },
  { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.15)', name: 'Purple' },
];

function getShapeSVG(shape: ShapeType, w: number, h: number, fill: string, stroke: string, strokeWidth: number, opacity: number): React.ReactNode {
  const pad = strokeWidth;
  const iw = Math.max(10, w - pad * 2);
  const ih = Math.max(10, h - pad * 2);

  const sharedProps = {
    fill,
    stroke,
    strokeWidth,
    opacity,
    strokeLinejoin: 'round' as const,
  };

  switch (shape) {
    case 'rectangle':
      return (
        <rect
          x={pad} y={pad}
          width={iw} height={ih}
          rx={6} ry={6}
          {...sharedProps}
        />
      );
    case 'circle':
      return (
        <ellipse
          cx={w / 2} cy={h / 2}
          rx={iw / 2} ry={ih / 2}
          {...sharedProps}
        />
      );
    case 'diamond':
      return (
        <polygon
          points={`${w / 2},${pad} ${w - pad},${h / 2} ${w / 2},${h - pad} ${pad},${h / 2}`}
          {...sharedProps}
        />
      );
    case 'triangle':
      return (
        <polygon
          points={`${w / 2},${pad} ${w - pad},${h - pad} ${pad},${h - pad}`}
          {...sharedProps}
        />
      );
    case 'hexagon': {
      const cx = w / 2;
      const cy = h / 2;
      const rx = iw / 2;
      const ry = ih / 2;
      const points = Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        return `${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`;
      }).join(' ');
      return <polygon points={points} {...sharedProps} />;
    }
    default:
      return <rect x={pad} y={pad} width={iw} height={ih} {...sharedProps} />;
  }
}

export const ShapeNode: React.FC<ShapeNodeProps> = ({ node, selected, onChange }) => {
  const rawData = node.data as Partial<ShapeData>;
  const data: ShapeData = {
    shape: rawData.shape === 'circle' || rawData.shape === 'diamond' || rawData.shape === 'triangle' || rawData.shape === 'hexagon'
      ? rawData.shape
      : 'rectangle',
    fill: typeof rawData.fill === 'string' ? rawData.fill : 'rgba(99, 102, 241, 0.15)',
    stroke: typeof rawData.stroke === 'string' ? rawData.stroke : 'var(--accent-primary)',
    strokeWidth: typeof rawData.strokeWidth === 'number' ? rawData.strokeWidth : 2,
    label: typeof rawData.label === 'string' ? rawData.label : '',
    opacity: typeof rawData.opacity === 'number' ? rawData.opacity : 1,
    direction: rawData.direction === 'rtl' || rawData.direction === 'auto' ? rawData.direction : 'ltr',
    textAlign: rawData.textAlign === 'left' || rawData.textAlign === 'right' ? rawData.textAlign : 'center',
  };
  const shape = data.shape || 'rectangle';
  const fill = data.fill || 'rgba(99, 102, 241, 0.15)';
  const stroke = data.stroke || 'var(--accent-primary)';
  const strokeWidth = data.strokeWidth ?? 2;
  const opacity = data.opacity ?? 1;

  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setLabel(data.label || '');
    }
  }, [data.label, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const handleEditRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeId?: string }>).detail;
      if (detail?.nodeId === node.id) {
        setIsEditing(true);
      }
    };
    window.addEventListener('canvio:edit-node', handleEditRequest);
    return () => window.removeEventListener('canvio:edit-node', handleEditRequest);
  }, [node.id]);

  const handleBlur = () => {
    setIsEditing(false);
    if (onChange && label !== data.label) {
      onChange(node.id, { data: { ...data, label } });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      setIsEditing(false);
      setLabel(data.label || '');
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
  };

  const w = node.size.width;
  const h = node.size.height;

  return (
    <div
      className={`shape-node ${selected ? 'shape-node--selected' : ''}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
    >
      <svg
        className="shape-node__svg"
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
      >
        {getShapeSVG(shape, w, h, fill, stroke, strokeWidth, opacity)}
      </svg>
      {isEditing ? (
        <textarea
          ref={textareaRef}
          className="shape-node__textarea"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          dir={data.direction || 'ltr'}
          style={{ textAlign: data.textAlign || 'center' }}
          placeholder="Type text..."
        />
      ) : (
        <div
          className={`shape-node__label ${!label ? 'shape-node__label--empty' : ''}`}
          dir={data.direction || 'ltr'}
          style={{ textAlign: data.textAlign || 'center' }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
        >
          {label || (selected ? 'Type text...' : '')}
        </div>
      )}
      {selected && !isEditing && (
        <div
          className="shape-node__toolbar"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shape-node__toolbar-group">
            {SHAPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`shape-node__tool-btn ${shape === opt.id ? 'active' : ''}`}
                title={opt.label}
                onClick={() => onChange?.(node.id, { data: { ...data, shape: opt.id } })}
              >
                <span className="material-symbols-outlined">{opt.icon}</span>
              </button>
            ))}
          </div>
          <div className="shape-node__toolbar-divider" />
          <div className="shape-node__toolbar-group">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className={`shape-node__color-btn ${stroke === preset.stroke ? 'active' : ''}`}
                style={{ backgroundColor: preset.stroke }}
                title={preset.name}
                onClick={() => onChange?.(node.id, { data: { ...data, stroke: preset.stroke, fill: preset.fill } })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const shapePlugin = {
  type: 'shape',
  name: 'Shape',
  icon: 'square',
  category: 'core' as const,
  defaultSize: { width: 200, height: 140 },
  create: (position: Point): LivingNode => ({
    id: nanoid(),
    type: 'shape',
    position,
    size: { width: 200, height: 140 },
    rotation: 0,
    zIndex: 0,
    locked: false,
    data: {
      shape: 'rectangle',
      fill: 'rgba(99, 102, 241, 0.15)',
      stroke: '#6366f1',
      strokeWidth: 2,
      label: '',
      opacity: 1,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }),
  getConnectionPorts: () => [
    { id: 'top', position: 'top' as const },
    { id: 'right', position: 'right' as const },
    { id: 'bottom', position: 'bottom' as const },
    { id: 'left', position: 'left' as const },
  ],
};
