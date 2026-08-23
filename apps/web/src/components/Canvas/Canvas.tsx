import { useRef, useCallback, useState, useEffect } from 'react';
import { LivingNode, Relation, useCanvasStore } from '../../store/canvasStore';
import { NodeRenderer } from '../NodeRenderer/NodeRenderer';
import { MultiSelectionInspector } from '../NodeInspector/MultiSelectionInspector';
import { RelationRenderer } from '../RelationRenderer/RelationRenderer';
import { generateRelationPath, generateSmartRelationPath, NodeBounds, resolveRelationPorts } from '../RelationRenderer/relationUtils';
import { DrawingLayer } from '../DrawingLayer/DrawingLayer';
import { FreeInkLayer } from '../FreeInkLayer/FreeInkLayer';
import { nanoid } from 'nanoid';
import {
  IconSticky,
  IconText,
  IconShape,
  IconMap,
  IconFrame,
  IconSparkles,
  IconX,
} from '@canvio/ui';
import { useViewportCulling } from './hooks/useViewportCulling';
import { useCanvasNavigation } from './hooks/useCanvasNavigation';
import { useCanvasDrawingSession } from './hooks/useCanvasDrawingSession';
import { useCanvasMarquee } from './hooks/useCanvasMarquee';
import { useCanvasKeyboardShortcuts } from './hooks/useCanvasKeyboardShortcuts';
import { useCanvasClipboard } from './hooks/useCanvasClipboard';
import './Canvas.css';

interface CanvasProps {
  worldId: string;
  autoShapeEnabled?: boolean;
  presentationMode?: boolean;
  focusNodeId?: string | null;
}

function getPointerPressure(event: PointerEvent | React.PointerEvent<HTMLDivElement>) {
  const pressureSensitive = event.pointerType === 'pen' && event.pressure > 0;
  return {
    pressure: pressureSensitive ? Math.max(0.05, Math.min(1, event.pressure)) : 0.5,
    pressureSensitive,
  };
}

// Shared hit radius so pointerdown and pointermove erasing behave identically.
const ERASER_RADIUS = 22;

export function Canvas({ worldId, autoShapeEnabled = false, presentationMode = false, focusNodeId = null }: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewport = useCanvasStore((s) => s.viewport);
  const nodes = useCanvasStore((s) => s.nodes);
  const relations = useCanvasStore((s) => s.relations);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const panBy = useCanvasStore((s) => s.panBy);
  const addNode = useCanvasStore((s) => s.addNode);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const strokeColor = useCanvasStore((s) => s.strokeColor);
  const strokeWidth = useCanvasStore((s) => s.strokeWidth);
  const stickyColor = useCanvasStore((s) => s.stickyColor);
  const snapLines = useCanvasStore((s) => s.snapLines);

  const relationSourceId = useCanvasStore((s) => s.relationSourceId);
  const relationSourcePort = useCanvasStore((s) => s.relationSourcePort);
  const relationTargetId = useCanvasStore((s) => s.relationTargetId);
  const relationTargetPort = useCanvasStore((s) => s.relationTargetPort);
  const setRelationSourceId = useCanvasStore((s) => s.setRelationSourceId);
  const eraseInkAt = useCanvasStore((s) => s.eraseInkAt);

  const [cursorWorldPos, setCursorWorldPos] = useState<{ x: number; y: number } | null>(null);
  const [laserPointer, setLaserPointer] = useState<{ x: number; y: number } | null>(null);
  const [radialMenu, setRadialMenu] = useState<{ screenX: number; screenY: number; worldPos: { x: number; y: number } } | null>(null);
  const touchPanStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const activeDrawingPointerIdRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const isInkTool = activeTool === 'draw' || activeTool === 'highlighter' || activeTool === 'arrow';

  // Drag-to-Create Frame state
  const [isDrawingFrame, setIsDrawingFrame] = useState(false);
  const [frameStartPos, setFrameStartPos] = useState<{ x: number; y: number } | null>(null);
  const [frameCurrentPos, setFrameCurrentPos] = useState<{ x: number; y: number } | null>(null);

  // Custom Navigation Hook
  const {
    screenToWorld,
    isPanning,
    setIsPanning,
    lastMousePos,
    setLastMousePos,
    pinchStateRef,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useCanvasNavigation({ canvasRef, viewport });

  // Custom Drawing Session Hook
  const {
    isDrawing,
    currentStroke,
    pressureSensitive,
    startDrawing,
    updateStrokePoints,
    finishDrawing,
    cancelDrawing,
  } = useCanvasDrawingSession({
    activeTool,
    autoShapeEnabled,
    strokeColor,
    strokeWidth,
  });

  // Custom Marquee Hook
  const {
    isMarqueeActive,
    marqueeStart,
    marqueeEnd,
    startMarquee,
    updateMarquee,
    finishMarquee,
  } = useCanvasMarquee();

  // Custom Keyboard Shortcuts Hook
  useCanvasKeyboardShortcuts();

  // Custom Clipboard & Drag-Drop Hook
  const { createNodeFromPlugin, handleDragOver, handleDrop } = useCanvasClipboard({
    canvasRef,
    cursorWorldPos,
    screenToWorld,
  });

  // Viewport Culling Hook for 10x Performance Boost on Large Canvases
  const visibleNodes = useViewportCulling({
    nodes,
    viewport,
    canvasRef,
    selectedNodeIds,
    relationSourceId,
    relationTargetId,
  });

  // Pointer Down
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isInkTool) {
        if (pinchStateRef.current || activeDrawingPointerIdRef.current !== null || e.button !== 0) return;
      } else if (!e.isPrimary || pinchStateRef.current) {
        return;
      }
      if (radialMenu) setRadialMenu(null);
      const target = e.target as HTMLElement;
      const isCanvasSurface =
        target === canvasRef.current ||
        target.classList.contains('canvas__world') ||
        target.classList.contains('canvas__grid');
      if (!isCanvasSurface) return;

      e.currentTarget.setPointerCapture?.(e.pointerId);
      const worldPos = screenToWorld(e.clientX, e.clientY);

      if (presentationMode) {
        e.preventDefault();
        if (activeTool === 'laser') return;
        touchPanStartRef.current = { x: e.clientX, y: e.clientY, moved: false };
        setIsPanning(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
        return;
      }

      if (activeTool === 'pan' || e.button === 1) {
        e.preventDefault();
        setIsPanning(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
        return;
      }

      if (activeTool === 'relation') {
        setRelationSourceId(null);
        return;
      }

      if (activeTool === 'laser') {
        e.preventDefault();
        return;
      }

      if (activeTool === 'eraser') {
        eraseInkAt(worldPos, ERASER_RADIUS);
        return;
      }

      if (isInkTool) {
        e.preventDefault();
        activeDrawingPointerIdRef.current = e.pointerId;
        const pointer = getPointerPressure(e);
        startDrawing({ ...worldPos, pressure: pointer.pressure }, pointer.pressureSensitive);
        return;
      }

      if (activeTool === 'sticky') { createNodeFromPlugin('sticky', worldPos, { color: stickyColor }); return; }
      if (activeTool === 'map') { createNodeFromPlugin('map', worldPos); return; }
      if (activeTool === 'text') { createNodeFromPlugin('text', worldPos, { color: 'var(--text-primary)' }); return; }
      if (activeTool === 'image') { createNodeFromPlugin('image', worldPos); return; }
      if (activeTool === 'shape') { createNodeFromPlugin('shape', worldPos); return; }
      if (activeTool === 'code') { createNodeFromPlugin('code', worldPos); return; }

      if (activeTool === 'frame') {
        e.preventDefault();
        setIsDrawingFrame(true);
        setFrameStartPos(worldPos);
        setFrameCurrentPos(worldPos);
        return;
      }

      if (activeTool === 'select') {
        e.preventDefault();
        if (e.pointerType === 'touch') {
          touchPanStartRef.current = { x: e.clientX, y: e.clientY, moved: false };
          setIsPanning(true);
          setLastMousePos({ x: e.clientX, y: e.clientY });
          return;
        }
        startMarquee(worldPos);
      }
    },
    [
      activeTool,
      createNodeFromPlugin,
      isInkTool,
      presentationMode,
      pinchStateRef,
      radialMenu,
      screenToWorld,
      setIsPanning,
      setLastMousePos,
      setRelationSourceId,
      startDrawing,
      startMarquee,
      stickyColor,
    ]
  );

  // Pointer Move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const isActiveDrawingPointer = activeDrawingPointerIdRef.current === e.pointerId;
      if (isDrawing && !isActiveDrawingPointer) return;
      if (!isActiveDrawingPointer && (!e.isPrimary || pinchStateRef.current)) return;
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setCursorWorldPos(worldPos);

      if (isPanning && lastMousePos) {
        // After a long-press opens Quick add, the finger is still down —
        // don't pan the board behind the open menu.
        if (radialMenu) return;
        if (touchPanStartRef.current) {
          const totalDx = e.clientX - touchPanStartRef.current.x;
          const totalDy = e.clientY - touchPanStartRef.current.y;
          if (Math.hypot(totalDx, totalDy) > 12) {
            touchPanStartRef.current.moved = true;
          }
        }
        const dx = (e.clientX - lastMousePos.x) / viewport.zoom;
        const dy = (e.clientY - lastMousePos.y) / viewport.zoom;
        panBy(dx, dy);
        setLastMousePos({ x: e.clientX, y: e.clientY });
        return;
      }

      if (isDrawing) {
        const nativeEvent = e.nativeEvent;
        const events = nativeEvent.getCoalescedEvents?.() || [nativeEvent];
        const samples = events.map((event) => {
          const point = screenToWorld(event.clientX, event.clientY);
          const pointer = getPointerPressure(event);
          return { ...point, pressure: pointer.pressure };
        });
        updateStrokePoints(samples, nativeEvent.pointerType === 'pen');
      }

      // buttons === 1 only: some pens report pressure > 0 while hovering,
      // which would erase without touching the surface.
      if (activeTool === 'eraser' && e.buttons === 1) {
        eraseInkAt(worldPos, ERASER_RADIUS);
      }

      if (isMarqueeActive) {
        updateMarquee(worldPos);
      }

      if (isDrawingFrame) {
        setFrameCurrentPos(worldPos);
      }
    },
    [
      isDrawing,
      isDrawingFrame,
      isMarqueeActive,
      isPanning,
      lastMousePos,
      panBy,
      pinchStateRef,
      radialMenu,
      screenToWorld,
      setLastMousePos,
      updateMarquee,
      updateStrokePoints,
      viewport.zoom,
    ]
  );

  // Pointer Up
  const handlePointerUp = useCallback(
    (e?: React.PointerEvent<HTMLDivElement>) => {
      const isActiveDrawingPointer = Boolean(e && activeDrawingPointerIdRef.current === e.pointerId);
      if (isDrawing && e && !isActiveDrawingPointer) return;
      if (e && !e.isPrimary && !isActiveDrawingPointer) return;
      if (e?.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }

      if (isPanning) {
        if (touchPanStartRef.current && !touchPanStartRef.current.moved) {
          clearSelection();
        }
        touchPanStartRef.current = null;
        setIsPanning(false);
        setLastMousePos(null);
      }

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

      if (isDrawing) {
        finishDrawing();
      }
      if (isActiveDrawingPointer) activeDrawingPointerIdRef.current = null;

      if (isMarqueeActive) {
        finishMarquee();
      }
    },
    [
      addNode,
      finishDrawing,
      finishMarquee,
      frameCurrentPos,
      frameStartPos,
      isDrawing,
      isDrawingFrame,
      isMarqueeActive,
      isPanning,
      selectNode,
      setActiveTool,
      clearSelection,
      setIsPanning,
      setLastMousePos,
    ]
  );

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activeDrawingPointerIdRef.current === e.pointerId) {
      cancelDrawing();
      activeDrawingPointerIdRef.current = null;
    }
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    touchPanStartRef.current = null;
    setIsPanning(false);
    setLastMousePos(null);
    // A canceled gesture must abort in-progress marquee/frame-drawing too,
    // otherwise the ghost selection keeps following later hover moves.
    if (isMarqueeActive) {
      finishMarquee();
    }
    if (isDrawingFrame) {
      setIsDrawingFrame(false);
      setFrameStartPos(null);
      setFrameCurrentPos(null);
    }
  }, [cancelDrawing, finishMarquee, isDrawingFrame, isMarqueeActive, setIsPanning, setFrameCurrentPos, setFrameStartPos, setIsDrawingFrame, setLastMousePos]);

  const handleCanvasTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && isDrawing) {
      cancelDrawing();
      activeDrawingPointerIdRef.current = null;
    }
    handleTouchStart(e);

    // Long-press radial on touch: single finger hold 520ms opens Quick add.
    // Gated to the bare canvas surface — holding a note or mid-stroke must
    // not pop the menu.
    if (e.touches.length === 1 && !radialMenu) {
      const target = e.target as HTMLElement;
      const isCanvasSurface =
        target === canvasRef.current ||
        target.classList.contains('canvas__world') ||
        target.classList.contains('canvas__grid');
      const touch = e.touches[0];
      if (isCanvasSurface) {
        longPressOriginRef.current = { x: touch.clientX, y: touch.clientY };
        if (longPressTimerRef.current !== null) {
          window.clearTimeout(longPressTimerRef.current);
        }
        longPressTimerRef.current = window.setTimeout(() => {
          const origin = longPressOriginRef.current;
          if (!origin) return;
          const worldPos = screenToWorld(origin.x, origin.y);
          setRadialMenu({ screenX: origin.x, screenY: origin.y, worldPos });
          longPressOriginRef.current = null;
          longPressTimerRef.current = null;
        }, 520);
      } else {
        if (longPressTimerRef.current !== null) {
          window.clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        longPressOriginRef.current = null;
      }
    } else {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      longPressOriginRef.current = null;
    }
  }, [cancelDrawing, handleTouchStart, isDrawing, radialMenu, screenToWorld]);

  const handleTouchMoveWithLongPress = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (longPressOriginRef.current && e.touches.length === 1) {
        const dx = e.touches[0].clientX - longPressOriginRef.current.x;
        const dy = e.touches[0].clientY - longPressOriginRef.current.y;
        if (Math.hypot(dx, dy) > 10) {
          if (longPressTimerRef.current !== null) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          longPressOriginRef.current = null;
        }
      }
      handleTouchMove(e);
    },
    [handleTouchMove]
  );

  const handleTouchEndWithLongPress = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      longPressOriginRef.current = null;
      handleTouchEnd(e);
    },
    [handleTouchEnd]
  );

  useEffect(() => () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
    }
  }, []);

  // Radial Menu Context Handler
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!e.clientX && !e.clientY) return;
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setRadialMenu({ screenX: e.clientX, screenY: e.clientY, worldPos });
    },
    [screenToWorld]
  );

  useEffect(() => {
    if (!radialMenu) return;
    const handleCloseRadial = (e: Event) => {
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return;
      const target = e.target as HTMLElement;
      if (e.type !== 'keydown' && target.closest('.canvas__radial-ring')) return;
      setRadialMenu(null);
    };
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handleCloseRadial, true);
      window.addEventListener('click', handleCloseRadial, true);
      window.addEventListener('keydown', handleCloseRadial, true);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handleCloseRadial, true);
      window.removeEventListener('click', handleCloseRadial, true);
      window.removeEventListener('keydown', handleCloseRadial, true);
    };
  }, [radialMenu]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const prevent: EventListener = (e) => e.preventDefault();
    el.addEventListener('wheel', prevent, { passive: false });
    return () => {
      el.removeEventListener('wheel', prevent);
    };
  }, []);

  // The laser follows the screen pointer instead of the world transform, so
  // it remains a precise presentation cue while the board is zoomed or panned.
  useEffect(() => {
    if (activeTool !== 'laser') {
      setLaserPointer(null);
      return;
    }

    const handleLaserPointerMove = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const isInsideCanvas =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      setLaserPointer(
        isInsideCanvas
          ? { x: event.clientX - rect.left, y: event.clientY - rect.top }
          : null
      );
    };

    window.addEventListener('pointermove', handleLaserPointerMove);
    return () => window.removeEventListener('pointermove', handleLaserPointerMove);
  }, [activeTool]);

  const transform = `translate(${viewport.x * viewport.zoom}px, ${viewport.y * viewport.zoom}px) scale(${viewport.zoom})`;
  const relationStateClass =
    !presentationMode && activeTool === 'relation'
      ? relationSourceId
        ? relationTargetId
          ? 'canvas--relation-snapped'
          : 'canvas--relation-aiming'
        : 'canvas--relation-ready'
      : '';
  const relationGuideText =
    activeTool !== 'relation'
      ? ''
      : relationSourceId
        ? relationTargetId
          ? 'Tap to connect'
          : 'Choose the target side'
        : 'Choose a start side';

  return (
    <div
      ref={canvasRef}
      className={`canvas ${relationStateClass} ${activeTool === 'laser' ? 'canvas--laser' : ''} ${isInkTool ? 'canvas--inking' : ''} ${presentationMode ? 'canvas--presenting' : ''} ${focusNodeId ? 'canvas--focus-active' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onTouchStart={handleCanvasTouchStart}
      onTouchMove={handleTouchMoveWithLongPress}
      onTouchEnd={handleTouchEndWithLongPress}
      onTouchCancel={handleTouchEndWithLongPress}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div 
        className="canvas__grid" 
        style={{
          backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
          backgroundPosition: `calc(50% + ${viewport.x * viewport.zoom}px) calc(50% + ${viewport.y * viewport.zoom}px)`
        }} 
      />

      {!presentationMode && activeTool === 'relation' && (
        <div className={`canvas__relation-guide ${relationSourceId ? 'is-aiming' : 'is-ready'} ${relationTargetId ? 'is-snapped' : ''}`}>
          <span className="canvas__relation-guide-dot" />
          <span>{relationGuideText}</span>
        </div>
      )}

      <div className="canvas__world" style={{ transform }}>
        {/* Relation preview line */}
        {!presentationMode && relationSourceId && cursorWorldPos && (() => {
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
          const allBounds: NodeBounds[] = Object.values(nodes)
            .filter((node) => node.type !== 'frame')
            .map((node) => ({
              id: node.id,
              x: node.position.x,
              y: node.position.y,
              width: node.size.width,
              height: node.size.height,
            }));
          const sourceBounds = allBounds.find((bound) => bound.id === sourceNode.id);
          const targetBounds = snapTarget ? allBounds.find((bound) => bound.id === snapTarget.id) : undefined;
          const pathResult =
            sourceBounds && targetBounds
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

        {/* Relations are board content, so keep them below nodes and editing controls. */}
        <div className="canvas__relations-layer">
          <RelationRenderer relations={relations} nodes={nodes} presentationMode={presentationMode} focusNodeId={focusNodeId} />
        </div>

        {/* Nodes layer (Virtualization / Viewport Culled for high performance) */}
        <div
          className="canvas__nodes-layer"
          style={{ pointerEvents: presentationMode || activeTool === 'select' || activeTool === 'relation' || activeTool === 'eraser' ? 'auto' : 'none' }}
        >
          {visibleNodes.map((node) => (
            <NodeRenderer key={node.id} node={node} presentationMode={presentationMode} focusNodeId={focusNodeId} />
          ))}
        </div>

        {/* Relation label pills float ABOVE nodes so text never clips under
            neighbouring cards. Non-interactive: selection/erase stay on the
            paths layer below. */}
        <div className="canvas__relation-pills-layer">
          <RelationRenderer relations={relations} nodes={nodes} presentationMode={presentationMode} focusNodeId={focusNodeId} layer="pills" />
        </div>

        {/* Free Ink Layer (Freehand annotations & highlighter overlay rendered above nodes) */}
        <FreeInkLayer presentationMode={presentationMode} />

        {/* Smart Snapping Guides */}
        {snapLines && (
          <div style={{ pointerEvents: 'none', position: 'absolute', top: 0, left: 0, width: 0, height: 0, overflow: 'visible', zIndex: 9999 }}>
            {snapLines.x !== undefined && (
              <div style={{
                position: 'absolute',
                left: snapLines.x,
                top: -50000,
                width: 1,
                height: 100000,
                background: '#ef4444',
                opacity: 0.7,
              }} />
            )}
            {snapLines.y !== undefined && (
              <div style={{
                position: 'absolute',
                left: -50000,
                top: snapLines.y,
                width: 100000,
                height: 1,
                background: '#ef4444',
                opacity: 0.7,
              }} />
            )}
          </div>
        )}

        {/* Multi-selection layout tools */}
        {!presentationMode && <MultiSelectionInspector />}

        {/* Marquee Selection Box */}
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

        {/* Drag-to-Create Frame Preview Box */}
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

      {activeTool === 'laser' && laserPointer && (
        <div
          className="canvas__laser-pointer"
          style={{ left: laserPointer.x, top: laserPointer.y }}
          aria-hidden="true"
        >
          <span className="canvas__laser-pointer-dot" />
          <span className="canvas__laser-pointer-halo" />
        </div>
      )}

      {/* Drawing Preview Layer */}
      {isDrawing && currentStroke && (
        <DrawingLayer
          points={currentStroke}
          color={strokeColor}
          width={
            activeTool === 'highlighter'
              ? Math.max(10, strokeWidth * 3)
              : activeTool === 'arrow'
              ? Math.max(2.5, strokeWidth)
              : strokeWidth
          }
          mode={activeTool === 'highlighter' ? 'highlighter' : activeTool === 'arrow' ? 'arrow' : 'draw'}
          opacity={activeTool === 'highlighter' ? 0.34 : 1}
          viewport={viewport}
          pressureSensitive={pressureSensitive}
        />
      )}

      {/* Radial Menu */}
      {radialMenu && (() => {
        const RADIAL_ITEMS = [
          {
            id: 'sticky',
            label: 'Sticky Note',
            icon: IconSticky,
            action: (pos: { x: number; y: number }) => createNodeFromPlugin('sticky', pos, { color: stickyColor }),
          },
          {
            id: 'text',
            label: 'Text Node',
            icon: IconText,
            action: (pos: { x: number; y: number }) => createNodeFromPlugin('text', pos, { color: 'var(--text-primary)' }),
          },
          {
            id: 'shape',
            label: 'Vector Shape',
            icon: IconShape,
            action: (pos: { x: number; y: number }) => createNodeFromPlugin('shape', pos),
          },
          {
            id: 'map',
            label: 'Living Map',
            icon: IconMap,
            action: (pos: { x: number; y: number }) => createNodeFromPlugin('map', pos),
          },
          {
            id: 'frame',
            label: 'Frame Page',
            icon: IconFrame,
            action: (pos: { x: number; y: number }) => createNodeFromPlugin('frame', pos),
          },
          {
            id: 'ai',
            label: 'AI Prompt',
            icon: IconSparkles,
            isAI: true,
            action: () => useCanvasStore.getState().setAIAssistantOpen(true),
          },
        ];

        return (
          <div
            className="canvas__radial-ring"
            style={{ left: radialMenu.screenX, top: radialMenu.screenY }}
            // Without this, Canvas's pointerdown handler closes the menu the
            // moment you press an item — the button unmounts before its click
            // can fire, so Quick add silently does nothing.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="canvas__radial-title">Quick add</span>
            <button
              type="button"
              className="canvas__radial-center"
              onClick={() => setRadialMenu(null)}
              title="Close (Esc)"
              aria-label="Close quick add"
            >
              <IconX size={15} />
            </button>

            {RADIAL_ITEMS.map((item, index) => {
              const angleDeg = index * (360 / RADIAL_ITEMS.length) - 90;
              const angleRad = (angleDeg * Math.PI) / 180;
              const radius = 62;
              const x = Math.round(radius * Math.cos(angleRad));
              const y = Math.round(radius * Math.sin(angleRad));

              const handleTrigger = (e: React.SyntheticEvent) => {
                e.preventDefault();
                e.stopPropagation();
                item.action(radialMenu.worldPos);
                setRadialMenu(null);
              };

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`canvas__radial-circle-item ${item.isAI ? 'ai-item' : ''}`}
                  style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                  onClick={handleTrigger}
                  title={item.label}
                  aria-label={`Add ${item.label}`}
                >
                  <item.icon size={20} />
                  <span className="canvas__radial-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
