import React, { useState, useRef, useEffect, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { LivingNode, Point } from '../types';
import './StickyNote.css';

export interface StickyData {
  text: string;
  color: string;
  fontSize: number;
}

interface StickyNoteProps {
  node: LivingNode;
  selected?: boolean;
  onChange?: (id: string, updates: Partial<LivingNode>) => void;
}

// Generate a deterministic rotation based on ID string
function getRotationOffset(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const normalized = (Math.abs(hash) % 100) / 100; // 0 to 1
  return (normalized * 3) - 1.5; // -1.5 to +1.5 degrees
}

export const StickyNote: React.FC<StickyNoteProps> = ({ node, selected, onChange }) => {
  const rawData = node.data as Partial<StickyData>;
  const data: StickyData = {
    text: typeof rawData.text === 'string' ? rawData.text : '',
    color: typeof rawData.color === 'string' ? rawData.color : 'yellow',
    fontSize: typeof rawData.fontSize === 'number' ? rawData.fontSize : 16,
  };
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.text || '');
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!data.text && Date.now() - node.createdAt < 1000) {
      setIsEditing(true);
    }
  }, [data.text, node.createdAt]);

  // Sync local state when prop changes (e.g., from remote Yjs updates)
  useEffect(() => {
    if (!isEditing) {
      setText(data.text || '');
    }
  }, [data.text, isEditing]);

  const baseRotation = useMemo(() => getRotationOffset(node.id), [node.id]);

  useEffect(() => {
    if (isEditing && textRef.current) {
      textRef.current.focus();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (onChange) {
      onChange(node.id, { data: { ...data, text } });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const colorClass = `sticky-note--${data.color || 'yellow'}`;

  return (
    <div 
      className={`sticky-note ${colorClass} ${selected ? 'sticky-note--selected' : ''}`}
      style={{ transform: `rotate(${baseRotation}deg)` }}
      onDoubleClick={handleDoubleClick}
    >
      <div className="sticky-note__fold"></div>
      {isEditing ? (
        <textarea
          ref={textRef}
          className="sticky-note__textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{ fontSize: `${data.fontSize || 16}px` }}
          placeholder="Type something..."
        />
      ) : (
        <div
          className="sticky-note__text"
          style={{ fontSize: `${data.fontSize || 16}px` }}
        >
          {data.text || ''}
        </div>
      )}
      
      {!isEditing && !data.text && (
        <div className="sticky-note__placeholder">Type something...</div>
      )}
    </div>
  );
};

export const stickyPlugin = {
  type: 'sticky',
  name: 'Sticky Note',
  icon: 'sticky-note',
  category: 'core' as const,
  defaultSize: { width: 200, height: 200 },
  create: (position: Point): LivingNode => ({
    id: nanoid(),
    type: 'sticky',
    position,
    size: { width: 200, height: 200 },
    rotation: 0,
    zIndex: 0,
    locked: false,
    data: { text: '', color: 'yellow', fontSize: 16 },
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
