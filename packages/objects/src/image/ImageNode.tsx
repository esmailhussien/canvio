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

// Images are stored as data URLs inside the collaborative document, so an
// oversized upload would bloat Yjs updates, backups, and every peer's memory.
// Large inputs are downscaled to fit within this budget before storing.
const MAX_IMAGE_DIMENSION = 2048;
const MAX_STORED_BYTES = 3 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function normalizeImageFile(file: File): Promise<string> {
  const original = await readAsDataUrl(file);

  // Small enough already — keep the original bytes untouched.
  if (file.size <= MAX_STORED_BYTES) {
    try {
      const img = await loadImage(original);
      if (img.naturalWidth <= MAX_IMAGE_DIMENSION && img.naturalHeight <= MAX_IMAGE_DIMENSION) {
        return original;
      }
      return await downscaleImage(img);
    } catch {
      return original;
    }
  }

  try {
    const img = await loadImage(original);
    return await downscaleImage(img);
  } catch {
    throw new Error('Image could not be processed. Try a smaller file.');
  }
}

async function downscaleImage(img: HTMLImageElement): Promise<string> {
  const scale = Math.min(
    MAX_IMAGE_DIMENSION / Math.max(1, img.naturalWidth),
    MAX_IMAGE_DIMENSION / Math.max(1, img.naturalHeight),
    1
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let quality = 0.85;
  let output = canvas.toDataURL('image/jpeg', quality);
  while (output.length * 0.75 > MAX_STORED_BYTES && quality > 0.4) {
    quality -= 0.15;
    output = canvas.toDataURL('image/jpeg', quality);
  }
  return output;
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

  const triggerFileInput = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
    }
    inputRef.current?.click();
  };

  React.useEffect(() => {
    // Auto-open the picker right after a fresh node is created locally.
    // The focus guard prevents a remotely-created node syncing in quickly
    // from hijacking the file dialog on this client.
    if (!src && Date.now() - node.createdAt < 1000 && inputRef.current && document.hasFocus()) {
      inputRef.current.click();
    }
  }, [src, node.createdAt]);

  const applyFile = (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    normalizeImageFile(file)
      .then((normalizedSrc) => {
        onChange?.(node.id, {
          data: {
            ...data,
            src: normalizedSrc,
            alt: file.name || data.alt,
          }
        });
      })
      .catch((err: Error) => {
        window.alert(err.message || 'Image could not be added.');
      });
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
      onClick={(e) => {
        if (!src) {
          triggerFileInput(e);
        }
      }}
      onDoubleClick={(e) => {
        triggerFileInput(e);
      }}
      onKeyDown={(e) => {
        if (!src && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          triggerFileInput();
        }
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
                triggerFileInput(e);
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
            triggerFileInput(e);
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
