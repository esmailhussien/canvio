import React, { useState, useRef, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { LivingNode, Point } from '../types';
import './TextNode.css';

export interface TextData {
  content: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  textAlign: 'left' | 'center' | 'right';
  color: string;
}

interface TextNodeProps {
  node: LivingNode;
  selected?: boolean;
  onChange?: (id: string, updates: Partial<LivingNode>) => void;
}

export const TextNode: React.FC<TextNodeProps> = ({ node, selected, onChange }) => {
  const rawData = node.data as Partial<TextData>;
  const data: TextData = {
    content: typeof rawData.content === 'string' ? rawData.content : '',
    fontSize: typeof rawData.fontSize === 'number' ? rawData.fontSize : 16,
    fontWeight: rawData.fontWeight === 'bold' ? 'bold' : 'normal',
    textAlign: rawData.textAlign === 'center' || rawData.textAlign === 'right' ? rawData.textAlign : 'left',
    color: typeof rawData.color === 'string' ? rawData.color : '',
  };
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(data.content || '');
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Automatically enter edit mode if the node was just created (within 1 second)
    if (!data.content && Date.now() - node.createdAt < 1000) {
      setIsEditing(true);
    }
  }, [data.content, node.createdAt]);

  // Sync local state when prop changes (e.g., from remote Yjs updates)
  useEffect(() => {
    if (!isEditing) {
      setContent(data.content || '');
    }
  }, [data.content, isEditing]);

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
      onChange(node.id, { data: { ...data, content } });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation(); // prevent canvas keyboard shortcuts
  };

  return (
    <div 
      className={`text-node ${selected ? 'text-node--selected' : ''}`}
      onDoubleClick={handleDoubleClick}
      style={{
        fontSize: `${data.fontSize || 16}px`,
        fontWeight: data.fontWeight || 'normal',
        textAlign: data.textAlign || 'left',
        color: data.color || 'var(--text-primary)',
      }}
    >
      {isEditing ? (
        <textarea
          ref={textRef}
          className="text-node__textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Type something..."
        />
      ) : (
        <div className="text-node__content">
          {data.content || ''}
        </div>
      )}
      {!isEditing && !data.content && (
        <div className="text-node__placeholder">Type something...</div>
      )}
    </div>
  );
};

export const textPlugin = {
  type: 'text',
  name: 'Text',
  icon: 'type',
  category: 'core' as const,
  defaultSize: { width: 200, height: 40 },
  create: (position: Point): LivingNode => ({
    id: nanoid(),
    type: 'text',
    position,
    size: { width: 200, height: 40 },
    rotation: 0,
    zIndex: 0,
    locked: false,
    data: { 
      content: '', 
      fontSize: 16, 
      fontWeight: 'normal', 
      textAlign: 'left',
      color: ''
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }),
  getConnectionPorts: () => [
    { id: 'left', position: 'left' as const },
    { id: 'right', position: 'right' as const },
  ],
};
