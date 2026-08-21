import React, { useMemo } from 'react';
import { getStroke } from 'perfect-freehand';
import type { FreeInkStroke } from '@canvio/core';
import { useCanvasStore } from '../../store/canvasStore';
import { getSvgPathFromStroke } from '../DrawingLayer/DrawingLayer';
import './FreeInkLayer.css';

interface FreeInkLayerProps {
  presentationMode?: boolean;
}

// Stroke objects are immutable once committed, so outlines can be cached per
// object reference. Without this, adding stroke N recomputes the geometry of
// all N-1 previous strokes (and again on every undo/redo/remote sync).
const outlineCache = new WeakMap<object, { pathData: string }>();

function getStrokePath(stroke: FreeInkStroke): string {
  const cached = outlineCache.get(stroke);
  if (cached) return cached.pathData;

  const isHighlighter = Boolean(stroke.highlighter);
  const strokeWidth = stroke.width || (isHighlighter ? 18 : 3);
  // Honor real device pressure when we recorded it; simulate only for mouse
  // input so the committed stroke matches what the user saw while drawing.
  const outline = getStroke(stroke.points as [number, number, number][], {
    size: strokeWidth,
    thinning: isHighlighter ? 0 : 0.45,
    smoothing: 0.65,
    streamline: 0.55,
    simulatePressure: !stroke.pressureSensitive,
    last: true,
  });

  const entry = { pathData: getSvgPathFromStroke(outline) };
  outlineCache.set(stroke, entry);
  return entry.pathData;
}

export const FreeInkLayer: React.FC<FreeInkLayerProps> = ({ presentationMode = false }) => {
  const inkStrokes = useCanvasStore((s) => s.inkStrokes);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const removeInkStroke = useCanvasStore((s) => s.removeInkStroke);

  const isEraser = activeTool === 'eraser' && !presentationMode;

  const renderedStrokes = useMemo(() => {
    return inkStrokes.map((stroke) => {
      const isHighlighter = Boolean(stroke.highlighter);
      const strokeWidth = stroke.width || (isHighlighter ? 18 : 3);
      return {
        id: stroke.id,
        pathData: getStrokePath(stroke),
        color: stroke.color || '#f0f0f5',
        opacity: stroke.opacity !== undefined ? stroke.opacity : (isHighlighter ? 0.35 : 1),
        isHighlighter,
        width: strokeWidth,
      };
    });
  }, [inkStrokes]);

  if (renderedStrokes.length === 0) return null;

  return (
    <svg
      className={`free-ink-layer ${isEraser ? 'free-ink-layer--eraser' : ''}`}
      style={{
        position: 'absolute',
        top: -50000,
        left: -50000,
        width: 100000,
        height: 100000,
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 35,
      }}
      viewBox="-50000 -50000 100000 100000"
      aria-label="Freehand ink annotations"
    >
      <defs>
        <filter id="ink-eraser-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ef4444" floodOpacity="0.75" />
        </filter>
      </defs>

      {renderedStrokes.map((s) => (
        <path
          key={s.id}
          d={s.pathData}
          fill={s.color}
          fillOpacity={s.opacity}
          className={`free-ink-stroke ${s.isHighlighter ? 'free-ink-stroke--highlighter' : ''} ${isEraser ? 'free-ink-stroke--erasable' : ''}`}
          style={{
            pointerEvents: isEraser ? 'auto' : 'none',
            cursor: isEraser ? 'pointer' : 'default',
          }}
          onClick={(e) => {
            if (isEraser) {
              e.stopPropagation();
              removeInkStroke(s.id);
            }
          }}
        />
      ))}
    </svg>
  );
};
