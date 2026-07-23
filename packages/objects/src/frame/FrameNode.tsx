import React, { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { LivingNode, Point } from '../types';
import './FrameNode.css';

export interface FrameData {
  title: string;
  color: string;
  fill: string;
}

interface FrameNodeProps {
  node: LivingNode;
  selected?: boolean;
  onChange?: (id: string, updates: Partial<LivingNode>) => void;
}

export const FrameNode: React.FC<FrameNodeProps> = ({ node, selected, onChange }) => {
  const rawData = node.data as Partial<FrameData>;
  const data: FrameData = {
    title: typeof rawData.title === 'string' ? rawData.title : 'Frame',
    color: typeof rawData.color === 'string' ? rawData.color : '#6366f1',
    fill: typeof rawData.fill === 'string' ? rawData.fill : 'rgba(255, 255, 255, 0.02)',
  };
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(data.title || 'Frame');

  useEffect(() => {
    if (!isEditing) {
      setTitle(data.title || 'Frame');
    }
  }, [data.title, isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (onChange) {
      onChange(node.id, { data: { ...data, title } });
    }
  };

  const accentColor = data.color || 'var(--accent-primary)';

  return (
    <div className={`frame-node ${selected ? 'frame-node--selected' : ''}`}>
      {/* Frame Header Bar */}
      <div className="frame-node__header" style={{ color: accentColor }}>
        {isEditing ? (
          <input
            autoFocus
            className="frame-node__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') handleBlur();
            }}
          />
        ) : (
          <span
            className="frame-node__title"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            {title}
          </span>
        )}
      </div>

      {/* Frame Background Container */}
      <div
        className="frame-node__body"
        style={{
          backgroundColor: data.fill || 'rgba(255, 255, 255, 0.02)',
          borderColor: selected ? accentColor : 'var(--border-default)',
        }}
      />
    </div>
  );
};

export const framePlugin = {
  type: 'frame',
  name: 'Frame',
  icon: 'frame',
  category: 'core' as const,
  defaultSize: { width: 500, height: 350 },
  create: (position: Point): LivingNode => ({
    id: nanoid(),
    type: 'frame',
    position,
    size: { width: 500, height: 350 },
    rotation: 0,
    zIndex: -1, // Render frames behind content nodes
    locked: false,
    data: {
      title: 'Frame',
      color: '#6366f1',
      fill: 'rgba(255, 255, 255, 0.02)',
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
