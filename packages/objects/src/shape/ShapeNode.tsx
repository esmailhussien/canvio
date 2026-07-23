import React from 'react';
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
}

interface ShapeNodeProps {
  node: LivingNode;
  selected?: boolean;
  onChange?: (id: string, updates: Partial<LivingNode>) => void;
}

function getShapeSVG(shape: ShapeType, w: number, h: number, fill: string, stroke: string, strokeWidth: number, opacity: number): React.ReactNode {
  const pad = strokeWidth;
  const iw = w - pad * 2;
  const ih = h - pad * 2;

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
  };
  const shape = data.shape || 'rectangle';
  const fill = data.fill || 'rgba(99, 102, 241, 0.15)';
  const stroke = data.stroke || 'var(--accent-primary)';
  const strokeWidth = data.strokeWidth ?? 2;
  const opacity = data.opacity ?? 1;

  const [isEditing, setIsEditing] = React.useState(false);
  const [label, setLabel] = React.useState(data.label || '');

  React.useEffect(() => {
    if (!isEditing) {
      setLabel(data.label || '');
    }
  }, [data.label, isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (onChange) {
      onChange(node.id, { data: { ...data, label } });
    }
  };

  const w = node.size.width;
  const h = node.size.height;

  return (
    <div
      className={`shape-node ${selected ? 'shape-node--selected' : ''}`}
      onDoubleClick={() => setIsEditing(true)}
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
        <input
          autoFocus
          className="shape-node__input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') handleBlur();
          }}
          placeholder="Shape label..."
        />
      ) : (
        <div className="shape-node__label">{label || ''}</div>
      )}
    </div>
  );
};

export const shapePlugin = {
  type: 'shape',
  name: 'Shape',
  icon: 'square',
  category: 'core' as const,
  defaultSize: { width: 150, height: 150 },
  create: (position: Point): LivingNode => ({
    id: nanoid(),
    type: 'shape',
    position,
    size: { width: 150, height: 150 },
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
