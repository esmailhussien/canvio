import React from 'react';
import { nanoid } from 'nanoid';
import { LivingNode, Point } from '../types';
import './ImageNode.css';

export interface ImageData {
  src: string;
  alt: string;
  objectFit: 'cover' | 'contain' | 'fill';
  opacity: number;
  borderRadius: number;
}

interface ImageNodeProps {
  node: LivingNode;
  selected?: boolean;
  onChange?: (id: string, updates: Partial<LivingNode>) => void;
}

export const ImageNode: React.FC<ImageNodeProps> = ({ node, selected, onChange }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const rawData = node.data as Partial<ImageData>;
  const data: ImageData = {
    src: typeof rawData.src === 'string' ? rawData.src : '',
    alt: typeof rawData.alt === 'string' ? rawData.alt : 'Image',
    objectFit: rawData.objectFit === 'contain' || rawData.objectFit === 'fill' ? rawData.objectFit : 'cover',
    opacity: typeof rawData.opacity === 'number' ? rawData.opacity : 1,
    borderRadius: typeof rawData.borderRadius === 'number' ? rawData.borderRadius : 8,
  };
  const src = data.src || '';
  const alt = data.alt || 'Image';
  const objectFit = data.objectFit || 'cover';
  const opacity = data.opacity ?? 1;
  const borderRadius = data.borderRadius ?? 0;

  const applyFile = (file?: File | null) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        if (onChange) {
          onChange(node.id, {
            data: {
              ...data,
              src: reader.result as string,
              alt: file.name || data.alt,
            }
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    applyFile(e.dataTransfer.files?.[0]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          applyFile(file);
        }
        break;
      }
    }
  };

  return (
    <div
      className={`image-node ${selected ? 'image-node--selected' : ''} ${!src ? 'image-node--empty' : ''}`}
      style={{
        borderRadius: `${borderRadius}px`,
        opacity,
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onPaste={handlePaste}
      onDoubleClick={(e) => {
        e.stopPropagation();
        inputRef.current?.click();
      }}
      tabIndex={0}
    >
      <input
        ref={inputRef}
        className="image-node__file-input"
        type="file"
        accept="image/*"
        onChange={(e) => {
          applyFile(e.target.files?.[0]);
          e.currentTarget.value = '';
        }}
      />
      {src ? (
        <>
          <img
            className="image-node__img"
            src={src}
            alt={alt}
            style={{
              objectFit,
              borderRadius: `${borderRadius}px`,
            }}
            draggable={false}
          />
          {selected && (
            <button
              className="image-node__replace-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Replace
            </button>
          )}
        </>
      ) : (
        <button
          className="image-node__placeholder"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          <span>Drop, paste, or choose image</span>
        </button>
      )}
    </div>
  );
};

export const imagePlugin = {
  type: 'image',
  name: 'Image',
  icon: 'image',
  category: 'core' as const,
  defaultSize: { width: 300, height: 200 },
  create: (position: Point): LivingNode => ({
    id: nanoid(),
    type: 'image',
    position,
    size: { width: 300, height: 200 },
    rotation: 0,
    zIndex: 0,
    locked: false,
    data: {
      src: '',
      alt: 'Image',
      objectFit: 'cover',
      opacity: 1,
      borderRadius: 8,
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
