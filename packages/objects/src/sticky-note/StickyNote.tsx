import React, { useState, useRef, useEffect, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { LivingNode, Point } from '../types';
import './StickyNote.css';

export interface StickyData {
  text: string;
  color: string;
  fontSize: number;
  direction?: 'ltr' | 'rtl' | 'auto';
  textAlign?: 'left' | 'center' | 'right';
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

const STICKY_COLORS = [
  { id: 'yellow', hex: '#fef08a', name: 'Yellow' },
  { id: 'pink', hex: '#fbcfe8', name: 'Pink' },
  { id: 'blue', hex: '#bfdbfe', name: 'Blue' },
  { id: 'green', hex: '#bbf7d0', name: 'Green' },
  { id: 'purple', hex: '#e9d5ff', name: 'Purple' },
  { id: 'orange', hex: '#fed7aa', name: 'Orange' },
];

export const StickyNote: React.FC<StickyNoteProps> = ({ node, selected, onChange }) => {
  const rawData = node.data as Partial<StickyData>;
  const data: StickyData = {
    text: typeof rawData.text === 'string' ? rawData.text : '',
    color: typeof rawData.color === 'string' ? rawData.color : 'yellow',
    fontSize: typeof rawData.fontSize === 'number' ? rawData.fontSize : 16,
    direction: rawData.direction === 'rtl' || rawData.direction === 'auto' ? rawData.direction : 'ltr',
    textAlign: rawData.textAlign === 'center' || rawData.textAlign === 'right' ? rawData.textAlign : 'left',
  };
  const [text, setText] = useState(data.text || '');
  const [isEditing, setIsEditing] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const textValRef = useRef(text);
  textValRef.current = text;
  const lastPointerTypeRef = useRef<string>('mouse');

  const baseRotation = useMemo(() => getRotationOffset(node.id), [node.id]);

  useEffect(() => {
    if (!data.text && Date.now() - node.createdAt < 1000 && textRef.current) {
      setIsEditing(true);
      textRef.current.focus();
    }
  }, [data.text, node.createdAt]);

  // Sync from props when not actively editing
  useEffect(() => {
    if (!isEditing) {
      setText(data.text || '');
    }
  }, [data.text, isEditing]);

  // Debounced auto-save so typing updates store/Yjs without cursor jumping
  useEffect(() => {
    if (!isEditing) return;
    const timer = setTimeout(() => {
      if (onChange && text !== data.text) {
        onChange(node.id, { data: { ...data, text } });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [text, isEditing, node.id, data, onChange]);

  // Flush pending edits on beforeunload or unmount so tab close never loses typed text
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isEditing && onChange && textValRef.current !== data.text) {
        onChange(node.id, { data: { ...data, text: textValRef.current } });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (isEditing && onChange && textValRef.current !== data.text) {
        onChange(node.id, { data: { ...data, text: textValRef.current } });
      }
    };
  }, [isEditing, node.id, data, onChange]);

  useEffect(() => {
    const handleEditRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeId?: string }>).detail;
      if (detail?.nodeId === node.id) {
        setIsEditing(true);
        textRef.current?.focus();
      }
    };
    window.addEventListener('canvio:edit-node', handleEditRequest);
    return () => window.removeEventListener('canvio:edit-node', handleEditRequest);
  }, [node.id]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (onChange && text !== data.text) {
      onChange(node.id, { data: { ...data, text } });
    }
  };

  // Only swallow the event if this note's textarea is already focused (mid-edit) —
  // that preserves native text selection / cursor placement while typing.
  // Otherwise let the pointerdown bubble up so NodeRenderer can decide, based on
  // whether the gesture turns into a drag or stays a stationary tap, whether to
  // move the whole note or enter edit mode. Without this, a tap anywhere on the
  // textarea (which covers almost the entire note) always ate the event and the
  // note could only ever be dragged from a tiny sliver of non-text border —
  // nearly impossible to hit accurately with a finger on mobile.
  const handlePointerDown = (e: React.PointerEvent) => {
    lastPointerTypeRef.current = e.pointerType;
    if (document.activeElement === textRef.current) {
      e.stopPropagation();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (document.activeElement === textRef.current) {
      e.stopPropagation();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const handleDragHandleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const colorClass = `sticky-note--${data.color || 'yellow'}`;

  return (
    <div 
      className={`sticky-note ${colorClass} ${selected ? 'sticky-note--selected' : ''}`}
      style={{ transform: `rotate(${baseRotation}deg)` }}
      onDoubleClick={() => textRef.current?.focus()}
      onClick={() => {
        if (lastPointerTypeRef.current !== 'touch' && lastPointerTypeRef.current !== 'pen') {
          textRef.current?.focus();
        }
      }}
    >
      <button
        type="button"
        className="sticky-note__drag-handle"
        data-node-drag-handle
        title="Move note"
        aria-label="Move sticky note"
        onClick={handleDragHandleClick}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3.5" r="1.5" />
          <circle cx="11" cy="3.5" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="12.5" r="1.5" />
          <circle cx="11" cy="12.5" r="1.5" />
        </svg>
      </button>
      <div className="sticky-note__fold"></div>
      <textarea
        ref={textRef}
        className="sticky-note__textarea"
        value={text}
        onChange={handleTextChange}
        onFocus={() => setIsEditing(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onMouseDown={handleMouseDown}
        dir={data.direction || 'ltr'}
        style={{
          fontSize: `${data.fontSize || 16}px`,
          textAlign: data.textAlign || 'left',
        }}
        placeholder="Type something..."
      />
      {selected && (
        <div
          className="sticky-note__toolbar"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {STICKY_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`sticky-note__color-btn ${data.color === c.id ? 'active' : ''}`}
              style={{ backgroundColor: c.hex }}
              title={c.name}
              onClick={() => onChange?.(node.id, { data: { ...data, color: c.id } })}
            />
          ))}
        </div>
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
