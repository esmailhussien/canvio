import React from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import './PenInspector.css';

const PEN_COLORS = [
  { value: '#f0f0f5', label: 'White' },
  { value: '#0f172a', label: 'Ink' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#22c55e', label: 'Green' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#a855f7', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
];

const HIGHLIGHT_COLORS = [
  { value: '#facc15', label: 'Yellow' },
  { value: '#fb923c', label: 'Orange' },
  { value: '#f472b6', label: 'Pink' },
  { value: '#a78bfa', label: 'Purple' },
  { value: '#60a5fa', label: 'Blue' },
  { value: '#34d399', label: 'Green' },
];

const PEN_SIZES = [
  { value: 2, label: 'Thin' },
  { value: 5, label: 'Medium' },
  { value: 10, label: 'Thick' },
  { value: 18, label: 'Marker' },
];

interface PenInspectorProps {
  autoShapeEnabled: boolean;
  onToggleAutoShape: () => void;
}

export const PenInspector: React.FC<PenInspectorProps> = ({ autoShapeEnabled, onToggleAutoShape }) => {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const strokeColor = useCanvasStore((s) => s.strokeColor);
  const strokeWidth = useCanvasStore((s) => s.strokeWidth);
  const setStrokeColor = useCanvasStore((s) => s.setStrokeColor);
  const setStrokeWidth = useCanvasStore((s) => s.setStrokeWidth);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);

  if (activeTool !== 'draw' && activeTool !== 'highlighter' && activeTool !== 'arrow') return null;

  const isHighlighter = activeTool === 'highlighter';
  const isArrow = activeTool === 'arrow';
  const colors = isHighlighter ? HIGHLIGHT_COLORS : PEN_COLORS;
  const title = isHighlighter ? 'Highlighter' : isArrow ? 'Arrow Tool' : 'Pen Tools';
  const sizes = isArrow
    ? [
        { value: 2, label: 'Thin' },
        { value: 4, label: 'Medium' },
        { value: 7, label: 'Bold' },
      ]
    : PEN_SIZES;

  return (
    <div
      className="pen-inspector canvio-toolbar-enter"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span className="pen-inspector__title">{isHighlighter ? '▰' : isArrow ? '↗' : '✏️'} {title}</span>

      {/* Color Swatches */}
      <div className="pen-inspector__colors">
        {colors.map((c) => (
          <button
            key={c.value}
            className={`pen-color-btn ${strokeColor === c.value ? 'selected' : ''}`}
            style={{ backgroundColor: c.value }}
            onClick={() => setStrokeColor(c.value)}
            title={c.label}
          />
        ))}
      </div>

      <div className="pen-inspector__divider" />

      {/* Size Buttons */}
      <div className="pen-inspector__sizes">
        {sizes.map((s) => (
          <button
            key={s.value}
            className={`pen-size-btn ${strokeWidth === s.value ? 'active' : ''}`}
            onClick={() => setStrokeWidth(s.value)}
          >
            <span
              className="pen-size-dot"
              style={{ width: Math.max(4, s.value / 2), height: Math.max(4, s.value / 2), backgroundColor: strokeColor }}
            />
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {activeTool === 'draw' && (
        <>
          <div className="pen-inspector__divider" />

          {/* Ink-to-Shape Auto Recognition Toggle */}
          <button
            className={`pen-shape-toggle ${autoShapeEnabled ? 'active' : ''}`}
            onClick={onToggleAutoShape}
            title="Auto-convert hand-drawn shapes into clean vector shapes"
          >
            ✨ Ink-to-Shape {autoShapeEnabled ? 'ON' : 'OFF'}
          </button>
        </>
      )}
    </div>
  );
};
