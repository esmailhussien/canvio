import { useRef, useCallback, useState, useEffect } from 'react';
import { LivingNode, Relation, useCanvasStore, ToolMode } from '../../store/canvasStore';
import { detectGeometricShape, detectGestureArrow } from '../../utils/shapeDetection';
import { NodeRenderer } from '../NodeRenderer/NodeRenderer';
import { RelationRenderer } from '../RelationRenderer/RelationRenderer';
import { generateRelationPath, generateSmartRelationPath, NodeBounds, resolveRelationPorts } from '../RelationRenderer/relationUtils';
import { DrawingLayer } from '../DrawingLayer/DrawingLayer';
import { nanoid } from 'nanoid';
import { getPlugin } from '@canvio/objects';
import './Canvas.css';

interface CanvasProps {
  worldId: string;
  autoShapeEnabled?: boolean;
}

export function Canvas({ worldId, autoShapeEnabled = false }: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewport = useCanvasStore((s) => s.viewport);
  const nodes = useCanvasStore((s) => s.nodes);
  const relations = useCanvasStore((s) => s.relations);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const panBy = useCanvasStore((s) => s.panBy);
  const zoomAtPoint = useCanvasStore((s) => s.zoomAtPoint);
  const addNode = useCanvasStore((s) => s.addNode);
  const addRelation = useCanvasStore((s) => s.addRelation);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const nextZIndex = useCanvasStore((s) => s.nextZIndex);
  const strokeColor = useCanvasStore((s) => s.strokeColor);
  const strokeWidth = useCanvasStore((s) => s.strokeWidth);
  const stickyColor = useCanvasStore((s) => s.stickyColor);

  const relationSourceId = useCanvasStore((s) => s.relationSourceId);
  const relationSourcePort = useCanvasStore((s) => s.relationSourcePort);
  const relationTargetId = useCanvasStore((s) => s.relationTargetId);
  const relationTargetPort = useCanvasStore((s) => s.relationTargetPort);
  const setRelationSourceId = useCanvasStore((s) => s.setRelationSourceId);

  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<number[][] | null>(null);

  const [cursorWorldPos, setCursorWorldPos] = useState<{ x: number, y: number } | null>(null);

  // Marquee selection state
  const [isMarqueeActive, setIsMarqueeActive] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);

  // Drag-to-Create Frame state
  const [isDrawingFrame, setIsDrawingFrame] = useState(false);
  const [frameStartPos, setFrameStartPos] = useState<{ x: number; y: number } | null>(null);
  const [frameCurrentPos, setFrameCurrentPos] = useState<{ x: number; y: number } | null>(null);

  // Screen to world coordinate conversion
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (screenX - rect.width / 2) / viewport.zoom - viewport.x,
      y: (screenY - rect.height / 2) / viewport.zoom - viewport.y,
    };
  }, [viewport]);

  const createNodeFromPlugin = useCallback((type: string, worldPos: { x: number; y: number }, data?: Record<string, unknown>) => {
    const plugin = getPlugin(type);
    if (!plugin) return null;

    const node = plugin.create({ x: worldPos.x, y: worldPos.y });
    const positionedNode: LivingNode = {
      ...node,
      position: {
        x: worldPos.x - node.size.width / 2,
        y: worldPos.y - node.size.height / 2,
      },
      zIndex: type === 'frame' ? -1 : nextZIndex(),
      data: data ? { ...node.data, ...data } : node.data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    addNode(positionedNode);
    selectNode(positionedNode.id);
    setActiveTool('select');
    return positionedNode;
  }, [addNode, nextZIndex, selectNode, setActiveTool]);

  const createImageFromFile = useCallback((file: File, worldPos: { x: number; y: number }) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      createNodeFromPlugin('image', worldPos, {
        src: reader.result as string,
        alt: file.name || 'Image',
      });
    };
    reader.readAsDataURL(file);
  }, [createNodeFromPlugin]);

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Note: e.preventDefault() is handled by the native listener with { passive: false }
    if (e.ctrlKey || e.metaKey) {
      // Pinch zoom
      const delta = -e.deltaY * 0.01;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        zoomAtPoint(delta, { x: e.clientX, y: e.clientY }, { width: rect.width, height: rect.height });
      }
    } else {
      // Pan
      panBy(-e.deltaX / viewport.zoom, -e.deltaY / viewport.zoom);
    }
  }, [panBy, zoomAtPoint, viewport.zoom]);

  // Handle pointer down
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary) return;
    const target = e.target as HTMLElement;
    const isCanvasSurface =
      target === canvasRef.current ||
      target.classList.contains('canvas__world') ||
      target.classList.contains('canvas__grid');
    if (!isCanvasSurface) return;

    e.currentTarget.setPointerCapture?.(e.pointerId);
    const worldPos = screenToWorld(e.clientX, e.clientY);

    if (activeTool === 'pan' || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (activeTool === 'relation') {
      // Clicked background in relation mode -> clear connection source
      setRelationSourceId(null);
      return;
    }

    if (activeTool === 'draw' || activeTool === 'highlighter' || activeTool === 'arrow') {
      e.preventDefault();
      setIsDrawing(true);
      setCurrentStroke([[worldPos.x, worldPos.y, 0.5]]);
      return;
    }

    if (activeTool === 'sticky') {
      createNodeFromPlugin('sticky', worldPos, { color: stickyColor });
      return;
    }

    if (activeTool === 'map') {
      createNodeFromPlugin('map', worldPos);
      return;
    }

    if (activeTool === 'text') {
      createNodeFromPlugin('text', worldPos, { color: 'var(--text-primary)' });
      return;
    }

    if (activeTool === 'image') {
      createNodeFromPlugin('image', worldPos);
      return;
    }

    if (activeTool === 'shape') {
      createNodeFromPlugin('shape', worldPos);
      return;
    }

    if (activeTool === 'code') {
      createNodeFromPlugin('code', worldPos);
      return;
    }

    if (activeTool === 'frame') {
      e.preventDefault();
      setIsDrawingFrame(true);
      setFrameStartPos(worldPos);
      setFrameCurrentPos(worldPos);
      return;
    }

    if (activeTool === 'select') {
      e.preventDefault();
      // Start marquee selection
      setMarqueeStart(worldPos);
      setMarqueeEnd(worldPos);
      setIsMarqueeActive(true);
      clearSelection();
    }
  }, [activeTool, screenToWorld, clearSelection, stickyColor, setRelationSourceId, createNodeFromPlugin]);

  // Pointer move for panning and drawing
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary) return;
    const worldPos = screenToWorld(e.clientX, e.clientY);
    setCursorWorldPos(worldPos);

    if (isPanning && lastMousePos) {
      const dx = (e.clientX - lastMousePos.x) / viewport.zoom;
      const dy = (e.clientY - lastMousePos.y) / viewport.zoom;
      panBy(dx, dy);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (isDrawing && currentStroke) {
      setCurrentStroke(prev => {
        const points = prev || [];
        const last = points[points.length - 1];
        if (last && Math.hypot(worldPos.x - last[0], worldPos.y - last[1]) < Math.max(0.75, strokeWidth * 0.2)) {
          return points;
        }
        return [...points, [worldPos.x, worldPos.y, 0.5]];
      });
    }

    if (isMarqueeActive) {
      setMarqueeEnd(worldPos);
    }

    if (isDrawingFrame) {
      setFrameCurrentPos(worldPos);
    }
  }, [activeTool, isPanning, lastMousePos, isDrawing, currentStroke, isMarqueeActive, isDrawingFrame, viewport.zoom, panBy, screenToWorld, strokeWidth]);

  // Pointer up
  const handlePointerUp = useCallback((e?: React.PointerEvent<HTMLDivElement>) => {
    if (e && !e.isPrimary) return;
    if (e?.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (isPanning) {
      setIsPanning(false);
      setLastMousePos(null);
    }

    // Finish Frame Creation
    if (isDrawingFrame && frameStartPos && frameCurrentPos) {
      const minX = Math.min(frameStartPos.x, frameCurrentPos.x);
      const minY = Math.min(frameStartPos.y, frameCurrentPos.y);
      const width = Math.max(80, Math.abs(frameCurrentPos.x - frameStartPos.x));
      const height = Math.max(60, Math.abs(frameCurrentPos.y - frameStartPos.y));

      const node = {
        id: nanoid(10),
        type: 'frame',
        position: { x: minX, y: minY },
        size: { width, height },
        rotation: 0,
        zIndex: -1,
        locked: false,
        data: {
          title: 'Frame Section',
          color: '#6366f1',
          fill: 'rgba(255, 255, 255, 0.02)',
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addNode(node);
      selectNode(node.id);
      setActiveTool('select');
      setIsDrawingFrame(false);
      setFrameStartPos(null);
      setFrameCurrentPos(null);
    }

    if (isDrawing && currentStroke && currentStroke.length > 1) {
      if (activeTool === 'arrow') {
        const start = currentStroke[0];
        const end = currentStroke[currentStroke.length - 1];
        const distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
        if (distance > 10) {
          const arrowWidth = Math.max(2.5, strokeWidth);
          const padding = Math.max(28, arrowWidth * 8);
          const minX = Math.min(...currentStroke.map((point) => point[0]));
          const minY = Math.min(...currentStroke.map((point) => point[1]));
          const maxX = Math.max(...currentStroke.map((point) => point[0]));
          const maxY = Math.max(...currentStroke.map((point) => point[1]));
          const normalizedPoints = currentStroke.map(([x, y, p]) => [
            x - minX + padding,
            y - minY + padding,
            p,
          ]);
          const node: LivingNode = {
            id: nanoid(10),
            type: 'drawing',
            position: { x: minX - padding, y: minY - padding },
            size: {
              width: Math.max(1, maxX - minX) + padding * 2,
              height: Math.max(1, maxY - minY) + padding * 2,
            },
            rotation: 0,
            zIndex: nextZIndex(),
            locked: false,
            data: {
              kind: 'arrow',
              strokes: [],
              arrow: {
                start: [start[0] - minX + padding, start[1] - minY + padding],
                end: [end[0] - minX + padding, end[1] - minY + padding],
                points: normalizedPoints,
                color: strokeColor || '#6366f1',
                width: arrowWidth,
              },
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          addNode(node);
          selectNode(node.id);
          setActiveTool('select');
        }
        setIsDrawing(false);
        setCurrentStroke(null);
        return;
      }

      if (activeTool === 'highlighter') {
        const minX = Math.min(...currentStroke.map(p => p[0]));
        const minY = Math.min(...currentStroke.map(p => p[1]));
        const maxX = Math.max(...currentStroke.map(p => p[0]));
        const maxY = Math.max(...currentStroke.map(p => p[1]));
        const highlightWidth = Math.max(10, strokeWidth * 3);
        const padding = Math.max(24, highlightWidth * 2);
        const normalizedPoints = currentStroke.map(([x, y, p]) => [
          x - minX + padding,
          y - minY + padding,
          p,
        ]);

        const node: LivingNode = {
          id: nanoid(10),
          type: 'drawing',
          position: { x: minX - padding, y: minY - padding },
          size: { width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 },
          rotation: 0,
          zIndex: nextZIndex(),
          locked: false,
          data: {
            kind: 'highlighter',
            strokes: [{
              id: nanoid(6),
              points: normalizedPoints,
              color: strokeColor || '#f59e0b',
              width: highlightWidth,
              opacity: 0.34,
              highlighter: true,
              complete: true,
            }],
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        addNode(node);
        selectNode(node.id);
        setActiveTool('select');
        setIsDrawing(false);
        setCurrentStroke(null);
        return;
      }

      // 1. Check if user drew a stroke connecting Node A -> Node B (Gesture Arrow)
      const gestureArrow = autoShapeEnabled ? detectGestureArrow(currentStroke, nodes) : null;

      if (gestureArrow) {
        const relation: Relation = {
          id: nanoid(10),
          sourceId: gestureArrow.sourceId,
          targetId: gestureArrow.targetId,
          relationship: 'leads_to',
          label: '',
          style: {
            type: 'orthogonal',
            color: strokeColor || '#6366f1',
            width: 2,
            endArrow: 'arrow',
          },
        };
        addRelation(relation);
        setIsDrawing(false);
        setCurrentStroke(null);
        setActiveTool('select');
        return;
      }

      // 2. Check if user drew a closed shape (Circle, Rectangle, Triangle, Hexagon)
      const detected = autoShapeEnabled ? detectGeometricShape(currentStroke) : null;

      if (detected) {
        const shapeNode: LivingNode = {
          id: nanoid(10),
          type: 'shape',
          position: detected.position,
          size: detected.size,
          rotation: 0,
          zIndex: nextZIndex(),
          locked: false,
          data: {
            shape: detected.type,
            fill: 'rgba(99, 102, 241, 0.15)',
            stroke: strokeColor,
            strokeWidth: Math.max(2, Math.round(strokeWidth / 2)),
            label: '',
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        addNode(shapeNode);
        selectNode(shapeNode.id);
        setActiveTool('select');
      } else {
        // Standard Freehand Stroke
        const minX = Math.min(...currentStroke.map(p => p[0]));
        const minY = Math.min(...currentStroke.map(p => p[1]));
        const maxX = Math.max(...currentStroke.map(p => p[0]));
        const maxY = Math.max(...currentStroke.map(p => p[1]));
        const padding = 20;

        const normalizedPoints = currentStroke.map(([x, y, p]) => [
          x - minX + padding,
          y - minY + padding,
          p
        ]);

        const node = {
          id: nanoid(10),
          type: 'drawing',
          position: { x: minX - padding, y: minY - padding },
          size: { width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 },
          rotation: 0,
          zIndex: nextZIndex(),
          locked: false,
          data: {
            kind: 'freehand',
            strokes: [{
              id: nanoid(6),
              points: normalizedPoints,
              color: strokeColor,
              width: strokeWidth,
              complete: true,
            }]
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        addNode(node);
        selectNode(node.id);
      }
    }

    setIsDrawing(false);
    setCurrentStroke(null);

    // Finish marquee selection
    if (isMarqueeActive && marqueeStart && marqueeEnd) {
      const x1 = Math.min(marqueeStart.x, marqueeEnd.x);
      const y1 = Math.min(marqueeStart.y, marqueeEnd.y);
      const x2 = Math.max(marqueeStart.x, marqueeEnd.x);
      const y2 = Math.max(marqueeStart.y, marqueeEnd.y);

      // Only select if the marquee is large enough (not just a click)
      if (Math.abs(x2 - x1) > 5 || Math.abs(y2 - y1) > 5) {
        const selectNodes = useCanvasStore.getState().selectNodes;
        const allNodes = useCanvasStore.getState().nodes;
        const ids = Object.values(allNodes)
          .filter(n => {
            const nx1 = n.position.x;
            const ny1 = n.position.y;
            const nx2 = n.position.x + n.size.width;
            const ny2 = n.position.y + n.size.height;
            // AABB intersection test
            return nx1 < x2 && nx2 > x1 && ny1 < y2 && ny2 > y1;
          })
          .map(n => n.id);
        if (ids.length > 0) {
          selectNodes(ids);
        }
      }
    }
    setIsMarqueeActive(false);
    setMarqueeStart(null);
    setMarqueeEnd(null);
  }, [activeTool, isPanning, isDrawing, currentStroke, isMarqueeActive, marqueeStart, marqueeEnd, isDrawingFrame, frameStartPos, frameCurrentPos, addNode, selectNode, setActiveTool, nextZIndex, strokeColor, strokeWidth, autoShapeEnabled, nodes, addRelation]);

  // Prevent default context menu
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', prevent);
    el.addEventListener('wheel', prevent as any, { passive: false });
    return () => {
      el.removeEventListener('contextmenu', prevent);
      el.removeEventListener('wheel', prevent as any);
    };
  }, []);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl?.isContentEditable ||
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const imageItem = Array.from(e.clipboardData?.items || []).find((item) => item.type.startsWith('image/'));
      const file = imageItem?.getAsFile();
      if (!file) return;

      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      const target = cursorWorldPos || (
        rect
          ? screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)
          : { x: -viewport.x, y: -viewport.y }
      );
      createImageFromFile(file, target);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [createImageFromFile, cursorWorldPos, screenToWorld, viewport.x, viewport.y]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.items || []).some((item) => item.type.startsWith('image/'))) {
      e.preventDefault();
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    const file = Array.from(e.dataTransfer.files || []).find((item) => item.type.startsWith('image/'));
    if (!file) return;

    e.preventDefault();
    e.stopPropagation();
    createImageFromFile(file, screenToWorld(e.clientX, e.clientY));
  }, [createImageFromFile, screenToWorld]);

  // Temporary pan state for Spacebar holding
  const previousToolRef = useRef<ToolMode | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.closest('input, textarea, [contenteditable], .text-node__editor, .shape-node__input, .sticky-node__textarea')
      ) {
        return;
      }

      const store = useCanvasStore.getState();

      // Undo / Redo Shortcuts (Ctrl+Z, Ctrl+Y, Cmd+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        store.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        return;
      }

      // Spacebar for Pan (hold or press)
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (store.activeTool !== 'pan' && !previousToolRef.current) {
          previousToolRef.current = store.activeTool;
          store.setActiveTool('pan');
        }
        return;
      }

      // Ctrl+G / Cmd+G for Grouping selected nodes into a Frame
      if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        const selectedIds = store.selectedNodeIds;
        if (selectedIds.length > 0) {
          const selectedNodes = selectedIds.map(id => store.nodes[id]).filter(Boolean);
          const minX = Math.min(...selectedNodes.map(n => n.position.x)) - 30;
          const minY = Math.min(...selectedNodes.map(n => n.position.y)) - 40;
          const maxX = Math.max(...selectedNodes.map(n => n.position.x + n.size.width)) + 30;
          const maxY = Math.max(...selectedNodes.map(n => n.position.y + n.size.height)) + 30;

          const frameNode = {
            id: nanoid(10),
            type: 'frame',
            position: { x: minX, y: minY },
            size: { width: Math.max(200, maxX - minX), height: Math.max(150, maxY - minY) },
            rotation: 0,
            zIndex: -1,
            locked: false,
            data: {
              title: 'Grouped Frame',
              color: '#6366f1',
              fill: 'rgba(255, 255, 255, 0.02)',
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          store.addNode(frameNode);
          store.selectNode(frameNode.id);
        }
        return;
      }

      switch (e.key) {
        case 'v': case 'V': store.setActiveTool('select'); break;
        case 'a': case 'A': store.setActiveTool('arrow'); break;
        case 'k': case 'K': store.setActiveTool('highlighter'); break;
        case 'h': case 'H': store.setActiveTool('pan'); break;
        case 'd': case 'D': case 'p': case 'P': store.setActiveTool('draw'); break;
        case 't': case 'T': store.setActiveTool('text'); break;
        case 's': case 'S': case 'n': case 'N': store.setActiveTool('sticky'); break;
        case 'r': case 'R': store.setActiveTool('shape'); break;
        case 'i': case 'I': store.setActiveTool('image'); break;
        case 'c': case 'C': store.setActiveTool('code'); break;
        case 'f': case 'F': store.setActiveTool('frame'); break;
        case 'm': case 'M': store.setActiveTool('map'); break;
        case 'l': case 'L': store.setActiveTool('relation'); break;
        case 'e': case 'E': store.setActiveTool('eraser'); break;
        case 'Delete': case 'Backspace':
          store.selectedNodeIds.forEach(id => store.removeNode(id));
          break;
        case 'Escape': {
          // If editing text, blur the element instead of switching tool
          const activeEl = document.activeElement as HTMLElement;
          if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT' || activeEl.contentEditable === 'true')) {
            activeEl.blur();
          } else {
            store.setRelationSourceId(null);
            store.clearSelection();
            store.setActiveTool('select');
          }
          break;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        const store = useCanvasStore.getState();
        if (previousToolRef.current) {
          store.setActiveTool(previousToolRef.current);
          previousToolRef.current = null;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const transform = `translate(${viewport.x * viewport.zoom}px, ${viewport.y * viewport.zoom}px) scale(${viewport.zoom})`;
  const relationStateClass = activeTool === 'relation'
    ? relationSourceId
      ? relationTargetId
        ? 'canvas--relation-snapped'
        : 'canvas--relation-aiming'
      : 'canvas--relation-ready'
    : '';

  return (
    <div
      ref={canvasRef}
      className={`canvas ${relationStateClass}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Grid background */}
      <div className="canvas__grid" />

      {/* Transformed world container */}
      <div className="canvas__world" style={{ transform }}>
        {/* Relation preview line */}
        {activeTool === 'relation' && relationSourceId && cursorWorldPos && (() => {
          const sourceNode = nodes[relationSourceId];
          if (!sourceNode) return null;
          const hasSnapTarget = Boolean(
            relationTargetId &&
            (relationTargetId !== relationSourceId || relationTargetPort !== relationSourcePort)
          );
          const snapTarget = hasSnapTarget && relationTargetId ? nodes[relationTargetId] : null;
          const previewTarget: LivingNode = snapTarget || {
            ...sourceNode,
            id: '__relation_preview__',
            type: 'preview',
            position: cursorWorldPos,
            size: { width: 1, height: 1 },
            zIndex: 0,
            locked: false,
            data: {},
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          const { sourcePort, targetPort } = resolveRelationPorts(
            sourceNode,
            previewTarget,
            relationSourcePort || undefined,
            snapTarget ? relationTargetPort || undefined : undefined
          );
          const allBounds: NodeBounds[] = Object.values(nodes).map((node) => ({
            id: node.id,
            x: node.position.x,
            y: node.position.y,
            width: node.size.width,
            height: node.size.height,
          }));
          const sourceBounds = allBounds.find((bound) => bound.id === sourceNode.id);
          const targetBounds = snapTarget ? allBounds.find((bound) => bound.id === snapTarget.id) : undefined;
          const pathResult = sourceBounds && targetBounds
            ? generateSmartRelationPath(sourcePort, targetPort, sourceBounds, targetBounds, allBounds)
            : generateRelationPath(sourcePort, { ...targetPort, x: cursorWorldPos.x, y: cursorWorldPos.y }, 'curved');
          return (
            <svg
              style={{
                position: 'absolute',
                top: -50000,
                left: -50000,
                width: 100000,
                height: 100000,
                overflow: 'visible',
                pointerEvents: 'none',
                zIndex: 10001,
              }}
              viewBox="-50000 -50000 100000 100000"
            >
              <path
                d={pathResult.pathD}
                fill="none"
                stroke="var(--relation-casing)"
                strokeWidth={8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={pathResult.pathD}
                fill="none"
                stroke="var(--relation-active)"
                strokeWidth={snapTarget ? 3 : 2.5}
                strokeDasharray={snapTarget ? undefined : '7 6'}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx={sourcePort.x}
                cy={sourcePort.y}
                r={snapTarget ? 5 : 4}
                fill="var(--relation-active)"
                stroke="var(--relation-casing)"
                strokeWidth={3}
              />
              <circle
                cx={targetPort.x}
                cy={targetPort.y}
                r={snapTarget ? 6 : 4}
                fill="var(--relation-active)"
                stroke="var(--relation-casing)"
                strokeWidth={3}
              />
            </svg>
          );
        })()}

        {/* Nodes layer */}
        <div style={{ pointerEvents: (activeTool === 'draw' || activeTool === 'highlighter' || activeTool === 'arrow' || activeTool === 'pan') ? 'none' : 'auto' }}>
          {Object.values(nodes).map((node) => (
            <NodeRenderer key={node.id} node={node} />
          ))}
        </div>

        {/* Relations layer (SVG) */}
        <RelationRenderer relations={relations} nodes={nodes} />

        {/* Marquee Selection Rectangle */}
        {isMarqueeActive && marqueeStart && marqueeEnd && (
          <div
            className="canvas__marquee"
            style={{
              position: 'absolute',
              left: Math.min(marqueeStart.x, marqueeEnd.x),
              top: Math.min(marqueeStart.y, marqueeEnd.y),
              width: Math.abs(marqueeEnd.x - marqueeStart.x),
              height: Math.abs(marqueeEnd.y - marqueeStart.y),
              border: '1.5px dashed var(--accent-primary)',
              background: 'rgba(99, 102, 241, 0.08)',
              borderRadius: 3,
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          />
        )}

        {/* Drag-to-Create Frame Preview Rectangle */}
        {isDrawingFrame && frameStartPos && frameCurrentPos && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(frameStartPos.x, frameCurrentPos.x),
              top: Math.min(frameStartPos.y, frameCurrentPos.y),
              width: Math.abs(frameCurrentPos.x - frameStartPos.x),
              height: Math.abs(frameCurrentPos.y - frameStartPos.y),
              border: '2px dashed #6366f1',
              background: 'rgba(99, 102, 241, 0.08)',
              borderRadius: 8,
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          />
        )}
      </div>

      {/* Drawing preview layer (for current stroke being drawn) */}
      {isDrawing && currentStroke && (
        <DrawingLayer
          points={currentStroke}
          color={strokeColor}
          width={activeTool === 'highlighter' ? Math.max(10, strokeWidth * 3) : activeTool === 'arrow' ? Math.max(2.5, strokeWidth) : strokeWidth}
          mode={activeTool === 'highlighter' ? 'highlighter' : activeTool === 'arrow' ? 'arrow' : 'draw'}
          opacity={activeTool === 'highlighter' ? 0.34 : 1}
          viewport={viewport}
        />
      )}
    </div>
  );
}
