import React from 'react';
import { useCanvasStore, LivingNode } from '../../store/canvasStore';
import {
  IconCopy,
  IconLock,
  IconUnlock,
  IconArrowUp,
  IconArrowDown,
  IconTrash
} from '@canvio/ui';
import './NodeInspector.css';

const STICKY_COLORS = [
  { id: 'yellow', value: '#fbbf24' },
  { id: 'pink', value: '#f472b6' },
  { id: 'blue', value: '#60a5fa' },
  { id: 'green', value: '#4ade80' },
  { id: 'purple', value: '#a78bfa' },
  { id: 'orange', value: '#fb923c' },
];

const SHAPE_COLORS = [
  { id: 'indigo', stroke: '#6366f1', fill: 'rgba(99, 102, 241, 0.15)' },
  { id: 'red', stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.15)' },
  { id: 'green', stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.15)' },
  { id: 'amber', stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.15)' },
  { id: 'cyan', stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.15)' },
  { id: 'purple', stroke: '#a855f7', fill: 'rgba(168, 85, 247, 0.15)' },
];

const DRAWING_COLORS = [
  { id: 'white', value: '#f8fafc' },
  { id: 'ink', value: '#0f172a' },
  { id: 'red', value: '#ef4444' },
  { id: 'amber', value: '#f59e0b' },
  { id: 'green', value: '#22c55e' },
  { id: 'cyan', value: '#06b6d4' },
  { id: 'blue', value: '#3b82f6' },
  { id: 'purple', value: '#a855f7' },
];

const HIGHLIGHT_COLORS = [
  { id: 'yellow', value: '#facc15' },
  { id: 'orange', value: '#fb923c' },
  { id: 'pink', value: '#f472b6' },
  { id: 'purple', value: '#a78bfa' },
  { id: 'blue', value: '#60a5fa' },
  { id: 'green', value: '#34d399' },
];

interface NodeInspectorProps {
  node: LivingNode;
}

export function NodeInspector({ node }: NodeInspectorProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const sendToBack = useCanvasStore((s) => s.sendToBack);
  const toggleLockNode = useCanvasStore((s) => s.toggleLockNode);
  const removeNode = useCanvasStore((s) => s.removeNode);

  const isSticky = node.type === 'sticky';
  const isText = node.type === 'text';
  const isShape = node.type === 'shape';
  const isFrame = node.type === 'frame';
  const isImage = node.type === 'image';
  const isDrawing = node.type === 'drawing';
  const drawingKind = (node.data?.kind as string) || 'freehand';
  const drawingStrokes = Array.isArray(node.data?.strokes) ? node.data.strokes as Array<Record<string, any>> : [];
  const drawingArrow = node.data?.arrow as Record<string, any> | undefined;
  const isArrowDrawing = isDrawing && drawingKind === 'arrow' && Boolean(drawingArrow);
  const isHighlightDrawing = isDrawing && drawingKind === 'highlighter';
  const currentColor = (node.data?.color as string) || 'yellow';
  const currentShape = (node.data?.shape as string) || 'rectangle';
  const currentStroke = (node.data?.stroke as string) || '#6366f1';
  const currentObjectFit = (node.data?.objectFit as string) || 'cover';
  const currentTextAlign = (node.data?.textAlign as string) || 'left';
  const currentFontWeight = (node.data?.fontWeight as string) || 'normal';
  const currentFontSize = typeof node.data?.fontSize === 'number' ? node.data.fontSize : (isSticky ? 16 : 18);
  const currentDrawingColor = isArrowDrawing
    ? (drawingArrow?.color as string) || '#6366f1'
    : (drawingStrokes[0]?.color as string) || '#f8fafc';
  const currentDrawingWidth = isArrowDrawing
    ? Number(drawingArrow?.width || 3)
    : Number(drawingStrokes[0]?.width || 3);
  const currentDrawingOpacity = isArrowDrawing
    ? Number(drawingArrow?.opacity ?? 1)
    : Number(drawingStrokes[0]?.opacity ?? 1);

  const updateDrawingColor = (color: string) => {
    if (isArrowDrawing && drawingArrow) {
      updateNodeData(node.id, { arrow: { ...drawingArrow, color } });
      return;
    }
    updateNodeData(node.id, {
      strokes: drawingStrokes.map((stroke) => ({ ...stroke, color })),
    });
  };

  const updateDrawingWidth = (width: number) => {
    if (isArrowDrawing && drawingArrow) {
      updateNodeData(node.id, { arrow: { ...drawingArrow, width } });
      return;
    }
    updateNodeData(node.id, {
      strokes: drawingStrokes.map((stroke) => ({ ...stroke, width })),
    });
  };

  const updateDrawingOpacity = (opacity: number) => {
    if (isArrowDrawing && drawingArrow) {
      updateNodeData(node.id, { arrow: { ...drawingArrow, opacity } });
      return;
    }
    updateNodeData(node.id, {
      strokes: drawingStrokes.map((stroke) => ({ ...stroke, opacity })),
    });
  };

  const SHAPE_TYPES = [
    { id: 'rectangle', label: '▭' },
    { id: 'circle', label: '○' },
    { id: 'diamond', label: '◇' },
    { id: 'triangle', label: '△' },
    { id: 'hexagon', label: '⬡' },
  ];

  return (
    <div
      className="node-inspector canvio-toolbar-enter"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Color picker for sticky notes */}
      {isSticky && (
        <>
          <div className="node-inspector__colors">
            {STICKY_COLORS.map((c) => (
              <button
                key={c.id}
                className={`node-inspector__color-btn ${currentColor === c.id || currentColor === c.value ? 'selected' : ''}`}
                style={{ backgroundColor: c.value }}
                onClick={(e) => {
                  e.stopPropagation();
                  updateNodeData(node.id, { color: c.id });
                }}
                title={`Change color to ${c.id}`}
              />
            ))}
          </div>
          <label className="node-inspector__mini-control" title="Font size">
            <span>A</span>
            <input
              type="range"
              min="12"
              max="24"
              step="1"
              value={currentFontSize}
              onChange={(e) => updateNodeData(node.id, { fontSize: Number(e.target.value) })}
            />
          </label>
          <div className="node-inspector__divider" />
        </>
      )}

      {isText && (
        <>
          <div className="node-inspector__segments">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                className={`node-inspector__segment node-inspector__segment--tight ${currentTextAlign === align ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  updateNodeData(node.id, { textAlign: align });
                }}
                title={`Align ${align}`}
              >
                {align[0].toUpperCase()}
              </button>
            ))}
            <button
              className={`node-inspector__segment node-inspector__segment--tight ${currentFontWeight === 'bold' ? 'selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                updateNodeData(node.id, { fontWeight: currentFontWeight === 'bold' ? 'normal' : 'bold' });
              }}
              title="Bold"
            >
              B
            </button>
          </div>
          <label className="node-inspector__mini-control" title="Font size">
            <span>A</span>
            <input
              type="range"
              min="12"
              max="42"
              step="1"
              value={currentFontSize}
              onChange={(e) => updateNodeData(node.id, { fontSize: Number(e.target.value) })}
            />
          </label>
          <div className="node-inspector__divider" />
        </>
      )}

      {/* Shape type & color picker */}
      {isShape && (
        <>
          <div className="node-inspector__shapes">
            {SHAPE_TYPES.map((s) => (
              <button
                key={s.id}
                className={`node-inspector__shape-btn ${currentShape === s.id ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  updateNodeData(node.id, { shape: s.id });
                }}
                title={s.id}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="node-inspector__colors">
            {SHAPE_COLORS.map((c) => (
              <button
                key={c.id}
                className={`node-inspector__color-btn ${currentStroke === c.stroke ? 'selected' : ''}`}
                style={{ backgroundColor: c.stroke }}
                onClick={(e) => {
                  e.stopPropagation();
                  updateNodeData(node.id, { stroke: c.stroke, fill: c.fill });
                }}
                title={`Change color to ${c.id}`}
              />
            ))}
            <div className="node-inspector__divider" />
          </div>
          <label className="node-inspector__mini-control" title="Stroke width">
            <span>W</span>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={typeof node.data?.strokeWidth === 'number' ? node.data.strokeWidth : 2}
              onChange={(e) => updateNodeData(node.id, { strokeWidth: Number(e.target.value) })}
            />
          </label>
          <label className="node-inspector__mini-control" title="Opacity">
            <span>O</span>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.05"
              value={typeof node.data?.opacity === 'number' ? node.data.opacity : 1}
              onChange={(e) => updateNodeData(node.id, { opacity: Number(e.target.value) })}
            />
          </label>
          <div className="node-inspector__divider" />
        </>
      )}

      {/* Frame header color picker */}
      {isFrame && (
        <div className="node-inspector__colors">
          {SHAPE_COLORS.map((c) => (
            <button
              key={c.id}
              className={`node-inspector__color-btn ${(node.data?.color as string) === c.stroke ? 'selected' : ''}`}
              style={{ backgroundColor: c.stroke }}
              onClick={(e) => {
                e.stopPropagation();
                updateNodeData(node.id, { color: c.stroke });
              }}
              title={`Change frame color to ${c.id}`}
            />
          ))}
          <div className="node-inspector__divider" />
        </div>
      )}

      {isImage && (
        <>
          <div className="node-inspector__segments">
            {(['cover', 'contain', 'fill'] as const).map((fit) => (
              <button
                key={fit}
                className={`node-inspector__segment ${currentObjectFit === fit ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  updateNodeData(node.id, { objectFit: fit });
                }}
                title={`Image fit: ${fit}`}
              >
                {fit}
              </button>
            ))}
          </div>
          <input
            className="node-inspector__range"
            type="range"
            min="0.2"
            max="1"
            step="0.05"
            value={typeof node.data?.opacity === 'number' ? node.data.opacity : 1}
            onChange={(e) => updateNodeData(node.id, { opacity: Number(e.target.value) })}
            title="Image opacity"
          />
          <div className="node-inspector__divider" />
        </>
      )}

      {isDrawing && (
        <>
          <div className="node-inspector__colors">
            {(isHighlightDrawing ? HIGHLIGHT_COLORS : DRAWING_COLORS).map((c) => (
              <button
                key={c.id}
                className={`node-inspector__color-btn ${currentDrawingColor === c.value ? 'selected' : ''}`}
                style={{ backgroundColor: c.value }}
                onClick={(e) => {
                  e.stopPropagation();
                  updateDrawingColor(c.value);
                }}
                title={`Change ${isArrowDrawing ? 'arrow' : isHighlightDrawing ? 'highlight' : 'ink'} color to ${c.id}`}
              />
            ))}
          </div>
          <label className="node-inspector__mini-control" title={isArrowDrawing ? 'Arrow width' : 'Stroke width'}>
            <span>W</span>
            <input
              type="range"
              min={isHighlightDrawing ? 8 : 2}
              max={isHighlightDrawing ? 42 : 12}
              step="1"
              value={currentDrawingWidth}
              onChange={(e) => updateDrawingWidth(Number(e.target.value))}
            />
          </label>
          <label className="node-inspector__mini-control" title="Opacity">
            <span>O</span>
            <input
              type="range"
              min="0.15"
              max="1"
              step="0.05"
              value={currentDrawingOpacity}
              onChange={(e) => updateDrawingOpacity(Number(e.target.value))}
            />
          </label>
          <div className="node-inspector__divider" />
        </>
      )}

      {/* Action Buttons */}
      <div className="node-inspector__actions">
        <button
          className="node-inspector__btn"
          onClick={(e) => { e.stopPropagation(); duplicateNode(node.id); }}
          title="Duplicate (Ctrl+D)"
        >
          <IconCopy size={15} />
        </button>

        <button
          className="node-inspector__btn"
          onClick={(e) => { e.stopPropagation(); bringToFront(node.id); }}
          title="Bring to Front"
        >
          <IconArrowUp size={15} />
        </button>

        <button
          className="node-inspector__btn"
          onClick={(e) => { e.stopPropagation(); sendToBack(node.id); }}
          title="Send to Back"
        >
          <IconArrowDown size={15} />
        </button>

        <button
          className={`node-inspector__btn ${node.locked ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleLockNode(node.id); }}
          title={node.locked ? 'Unlock Node' : 'Lock Node'}
        >
          {node.locked ? <IconLock size={15} /> : <IconUnlock size={15} />}
        </button>

        <button
          className="node-inspector__btn danger"
          onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
          title="Delete Node (Del)"
        >
          <IconTrash size={15} />
        </button>
      </div>
    </div>
  );
}
