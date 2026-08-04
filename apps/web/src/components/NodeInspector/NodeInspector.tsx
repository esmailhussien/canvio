import React, { useState } from 'react';
import { useCanvasStore, LivingNode } from '../../store/canvasStore';
import { expandNodeWithAIAsync } from '../../utils/spatialAIEngine';
import {
  IconCopy,
  IconLock,
  IconUnlock,
  IconArrowUp,
  IconArrowDown,
  IconTrash,
  IconPagePortrait,
  IconPageLandscape,
  IconSlideScreen,
  IconLetter,
  IconRectangle,
  IconCircle,
  IconDiamond,
  IconTriangle,
  IconHexagon,
  IconMoreHorizontal
} from '@canvio/ui';
import './NodeInspector.css';

const SHAPE_TYPES = [
  { id: 'rectangle', icon: IconRectangle, title: 'Rectangle' },
  { id: 'circle', icon: IconCircle, title: 'Circle' },
  { id: 'diamond', icon: IconDiamond, title: 'Diamond' },
  { id: 'triangle', icon: IconTriangle, title: 'Triangle' },
  { id: 'hexagon', icon: IconHexagon, title: 'Hexagon' },
];

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
  const [isExpanding, setIsExpanding] = useState(false);
  const [isFrameColorOpen, setIsFrameColorOpen] = useState(false);
  const [isFrameMoreOpen, setIsFrameMoreOpen] = useState(false);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const nodes = useCanvasStore((s) => s.nodes);
  const snapshot = useCanvasStore((s) => s.snapshot);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const sendToBack = useCanvasStore((s) => s.sendToBack);
  const toggleLockNode = useCanvasStore((s) => s.toggleLockNode);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const addNode = useCanvasStore((s) => s.addNode);
  const addRelation = useCanvasStore((s) => s.addRelation);

  const handleAIExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExpanding) return;
    setIsExpanding(true);

    try {
      const res = await expandNodeWithAIAsync(node);
      res.nodes.forEach((n) => addNode(n));
      res.relations.forEach((r) => addRelation(r));
    } catch (err) {
      console.error('AI expand failed:', err);
    } finally {
      setIsExpanding(false);
    }
  };

  const isSticky = node.type === 'sticky';
  const isText = node.type === 'text';
  const isShape = node.type === 'shape';
  const isFrame = node.type === 'frame';
  const isImage = node.type === 'image';
  const isDrawing = node.type === 'drawing';

  const setFramePagePreset = (preset: 'a4-portrait' | 'a4-landscape' | 'slide' | 'letter') => {
    let width = 500;
    let height = 350;
    let label = 'Frame';

    if (preset === 'a4-portrait') {
      width = 595;
      height = 842;
      label = 'Page (A4 Portrait)';
    } else if (preset === 'a4-landscape') {
      width = 842;
      height = 595;
      label = 'Page (A4 Landscape)';
    } else if (preset === 'slide') {
      width = 960;
      height = 540;
      label = 'Slide (16:9)';
    } else if (preset === 'letter') {
      width = 612;
      height = 792;
      label = 'Page (US Letter)';
    }

    updateNode(node.id, {
      size: { width, height },
      data: { ...node.data, title: label, pagePreset: preset },
    });
  };

  const fitFrameToBoardContent = () => {
    const contentNodes = Object.values(nodes).filter((n) => n.id !== node.id && n.type !== 'frame');
    if (contentNodes.length === 0) return;

    const marginX = 74;
    const marginTop = 82;
    const marginBottom = 74;
    const minX = Math.min(...contentNodes.map((n) => n.position.x)) - marginX;
    const minY = Math.min(...contentNodes.map((n) => n.position.y)) - marginTop;
    const maxX = Math.max(...contentNodes.map((n) => n.position.x + n.size.width)) + marginX;
    const maxY = Math.max(...contentNodes.map((n) => n.position.y + n.size.height)) + marginBottom;

    snapshot();
    updateNode(node.id, {
      position: { x: minX, y: minY },
      size: {
        width: Math.max(240, maxX - minX),
        height: Math.max(180, maxY - minY),
      },
      data: {
        ...node.data,
        pagePreset: undefined,
      },
    });
  };
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
  const currentFrameColor = (node.data?.color as string) || '#6366f1';

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

  const viewport = useCanvasStore((s) => s.viewport);
  const zoom = Math.max(0.05, viewport.zoom);
  const scaleFactor = Math.max(0.65, Math.min(2.5, 1 / zoom));

  // The node inspector lives inside the zoomed canvas, so offsets are converted
  // from screen-safe measurements back into local world coordinates.
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1000;
  const isCoarsePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const nodeScreenTop = viewportHeight / 2 + (node.position.y + viewport.y) * zoom;
  const nodeScreenBottom = nodeScreenTop + node.size.height * zoom;
  const nodeScreenHeight = node.size.height * zoom;
  const topSafe = isCoarsePointer ? 86 : 70;
  const bottomSafe = viewportHeight - (isCoarsePointer ? 150 : 118);
  const inspectorScreenHeight = isCoarsePointer ? 54 : 42;
  const gap = Math.max(36, 34 * scaleFactor);
  const screenGap = Math.max(isCoarsePointer ? 16 : 12, Math.min(44, gap * zoom));
  const hasRoomAbove = nodeScreenTop - topSafe >= inspectorScreenHeight + screenGap;
  const hasRoomBelow = bottomSafe - nodeScreenBottom >= inspectorScreenHeight + screenGap;
  const fillsViewport = nodeScreenHeight > viewportHeight * 0.52;

  const inspectorPlacement: 'above' | 'below' | 'inside' =
    hasRoomAbove
      ? 'above'
      : isFrame && fillsViewport
        ? 'inside'
        : hasRoomBelow
          ? 'below'
          : 'inside';

  const insideScreenTop = Math.min(
    Math.max(nodeScreenTop + screenGap, topSafe),
    Math.max(topSafe, bottomSafe - inspectorScreenHeight)
  );
  const insideLocalTop = (insideScreenTop - nodeScreenTop) / zoom;
  const inspectorTop =
    inspectorPlacement === 'above'
      ? -gap
      : inspectorPlacement === 'below'
        ? node.size.height + gap
        : Math.max(10 / zoom, insideLocalTop);
  const inspectorTransform =
    inspectorPlacement === 'above'
      ? `translate(-50%, -100%) scale(${scaleFactor})`
      : `translate(-50%, 0) scale(${scaleFactor})`;
  const inspectorTransformOrigin = inspectorPlacement === 'above' ? 'bottom center' : 'top center';

  return (
    <div
      className={`node-inspector node-inspector--${inspectorPlacement} canvio-toolbar-enter`}
      style={{
        top: inspectorTop,
        transform: inspectorTransform,
        transformOrigin: inspectorTransformOrigin,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
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
            {SHAPE_TYPES.map((s) => {
              const IconComp = s.icon;
              return (
                <button
                  key={s.id}
                  className={`node-inspector__shape-btn ${currentShape === s.id ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateNodeData(node.id, { shape: s.id });
                  }}
                  title={s.title}
                >
                  <IconComp size={15} />
                </button>
              );
            })}
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

      {/* Frame header color picker & Page Presets */}
      {isFrame && (
        <>
          <div className="node-inspector__segments node-inspector__segments--frame">
            <button
              className={`node-inspector__segment ${node.data?.pagePreset === 'a4-portrait' ? 'selected' : ''}`}
              onClick={(e) => { e.stopPropagation(); setFramePagePreset('a4-portrait'); }}
              title="A4 Portrait Page (595x842)"
            >
              <IconPagePortrait size={14} />
              <span>Portrait</span>
            </button>
            <button
              className={`node-inspector__segment ${node.data?.pagePreset === 'a4-landscape' ? 'selected' : ''}`}
              onClick={(e) => { e.stopPropagation(); setFramePagePreset('a4-landscape'); }}
              title="A4 Landscape Page (842x595)"
            >
              <IconPageLandscape size={14} />
              <span>Landscape</span>
            </button>
            <button
              className={`node-inspector__segment ${node.data?.pagePreset === 'slide' ? 'selected' : ''}`}
              onClick={(e) => { e.stopPropagation(); setFramePagePreset('slide'); }}
              title="16:9 Presentation Slide (960x540)"
            >
              <IconSlideScreen size={14} />
              <span>16:9</span>
            </button>
            <button
              className={`node-inspector__segment ${node.data?.pagePreset === 'letter' ? 'selected' : ''}`}
              onClick={(e) => { e.stopPropagation(); setFramePagePreset('letter'); }}
              title="US Letter Page (612x792)"
            >
              <IconLetter size={14} />
              <span>Letter</span>
            </button>
            <button
              className="node-inspector__segment node-inspector__segment--fit"
              onClick={(e) => { e.stopPropagation(); fitFrameToBoardContent(); }}
              title="Fit frame around board content"
            >
              <span className="material-symbols-outlined">fit_screen</span>
              <span>Fit</span>
            </button>
          </div>
          <div className="node-inspector__frame-color">
            <button
              className="node-inspector__color-btn node-inspector__color-btn--frame selected"
              style={{ backgroundColor: currentFrameColor }}
              onClick={(e) => {
                e.stopPropagation();
                setIsFrameColorOpen((prev) => !prev);
                setIsFrameMoreOpen(false);
              }}
              title="Frame color"
            />
            {isFrameColorOpen && (
              <div className="node-inspector__popover node-inspector__frame-color-popover" role="menu" aria-label="Frame colors">
                {SHAPE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    className={`node-inspector__color-btn ${currentFrameColor === c.stroke ? 'selected' : ''}`}
                    style={{ backgroundColor: c.stroke }}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateNodeData(node.id, { color: c.stroke });
                      setIsFrameColorOpen(false);
                    }}
                    title={`Change frame color to ${c.id}`}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="node-inspector__divider" />
          <div className="node-inspector__frame-more">
            <button
              className={`node-inspector__btn ${isFrameMoreOpen ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsFrameMoreOpen((prev) => !prev);
                setIsFrameColorOpen(false);
              }}
              title="More frame actions"
              aria-label="More frame actions"
              aria-haspopup="menu"
              aria-expanded={isFrameMoreOpen}
            >
              <IconMoreHorizontal size={15} />
            </button>
            {isFrameMoreOpen && (
              <div className="node-inspector__popover node-inspector__action-popover" role="menu" aria-label="Frame actions">
                <button
                  className="node-inspector__menu-btn"
                  onClick={(e) => { e.stopPropagation(); duplicateNode(node.id); setIsFrameMoreOpen(false); }}
                >
                  <IconCopy size={15} />
                  <span>Duplicate</span>
                </button>
                <button
                  className="node-inspector__menu-btn"
                  onClick={(e) => { e.stopPropagation(); bringToFront(node.id); setIsFrameMoreOpen(false); }}
                >
                  <IconArrowUp size={15} />
                  <span>Bring front</span>
                </button>
                <button
                  className="node-inspector__menu-btn"
                  onClick={(e) => { e.stopPropagation(); sendToBack(node.id); setIsFrameMoreOpen(false); }}
                >
                  <IconArrowDown size={15} />
                  <span>Send back</span>
                </button>
                <button
                  className="node-inspector__menu-btn"
                  onClick={(e) => { e.stopPropagation(); toggleLockNode(node.id); setIsFrameMoreOpen(false); }}
                >
                  {node.locked ? <IconLock size={15} /> : <IconUnlock size={15} />}
                  <span>{node.locked ? 'Unlock' : 'Lock'}</span>
                </button>
                <button
                  className="node-inspector__menu-btn danger"
                  onClick={(e) => { e.stopPropagation(); removeNode(node.id); setIsFrameMoreOpen(false); }}
                >
                  <IconTrash size={15} />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </>
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

      {!isFrame && (
        <div className="node-inspector__actions">
          <button
            className="node-inspector__btn node-inspector__btn--connect"
            onClick={(e) => {
              e.stopPropagation();
              useCanvasStore.getState().setRelationSourceId(node.id);
              useCanvasStore.getState().setActiveTool('relation');
            }}
            title="Connect Relation (↗) — Click any target node to create link"
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)' }}>↗</span>
          </button>

          <button
            className={`node-inspector__btn node-inspector__btn--ai ${isExpanding ? 'spinning' : ''}`}
            onClick={handleAIExpand}
            disabled={isExpanding}
            title="✨ AI Expand: Generate related sub-topics & connect with relations"
          >
            <span className="material-symbols-outlined text-sm" style={{ color: '#a855f7', fontSize: 16 }}>
              {isExpanding ? 'sync' : 'auto_awesome'}
            </span>
          </button>

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
      )}
    </div>
  );
}
