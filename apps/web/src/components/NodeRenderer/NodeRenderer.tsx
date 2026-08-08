import { useState, useCallback, useRef, useEffect, type CSSProperties } from 'react';
import { LivingNode } from '../../store/canvasStore';
import { useCanvasStore } from '../../store/canvasStore';
import { DrawingNode, StickyNote, MapNode, TextNode, ImageNode, ShapeNode, FrameNode, CodeNode } from '@canvio/objects';
import { NodeInspector } from '../NodeInspector/NodeInspector';
import { makeMarkerPort } from '../RelationRenderer/relationUtils';
import { nanoid } from 'nanoid';
import './NodeRenderer.css';

interface Props {
  node: LivingNode;
  presentationMode?: boolean;
  focusNodeId?: string | null;
}

export function NodeRenderer({ node, presentationMode = false, focusNodeId = null }: Props) {
  const updateNode = useCanvasStore(s => s.updateNode);
  const snapshot = useCanvasStore(s => s.snapshot);
  const isSelected = useCanvasStore(useCallback(s => s.selectedNodeIds.includes(node.id), [node.id]));
  const isOnlySelected = useCanvasStore(useCallback(s => s.selectedNodeIds.length === 1 && s.selectedNodeIds.includes(node.id), [node.id]));
  const selectNode = useCanvasStore(s => s.selectNode);
  const viewportZoom = useCanvasStore(s => s.viewport.zoom);
  
  const activeTool = useCanvasStore(s => s.activeTool);
  const relationSourceId = useCanvasStore(s => s.relationSourceId);
  const relationSourcePort = useCanvasStore(s => s.relationSourcePort);
  const relationTargetId = useCanvasStore(s => s.relationTargetId);
  const relationTargetPort = useCanvasStore(s => s.relationTargetPort);
  const setRelationSourceId = useCanvasStore(s => s.setRelationSourceId);
  const setRelationSource = useCanvasStore(s => s.setRelationSource);
  const setRelationTarget = useCanvasStore(s => s.setRelationTarget);
  const addRelation = useCanvasStore(s => s.addRelation);
  const relations = useCanvasStore(s => s.relations);
  const selectRelation = useCanvasStore(s => s.selectRelation);
  const removeNode = useCanvasStore(s => s.removeNode);

  const isRelationSource = relationSourceId === node.id;
  const isRelationTarget = activeTool === 'relation' &&
    relationTargetId === node.id &&
    (relationSourceId !== node.id || relationTargetPort !== relationSourcePort);
  const isFocusDimmed = Boolean(focusNodeId && focusNodeId !== node.id);
  const isFocusActive = focusNodeId === node.id;
  const getNearestEdgePort = useCallback((clientX: number, clientY: number) => {
    const element = document.querySelector(`[data-node-id="${node.id}"]`) as HTMLElement | null;
    const rect = element?.getBoundingClientRect();
    if (!rect) return undefined;

    const distances = [
      { port: 'top' as const, value: Math.abs(clientY - rect.top) },
      { port: 'right' as const, value: Math.abs(rect.right - clientX) },
      { port: 'bottom' as const, value: Math.abs(rect.bottom - clientY) },
      { port: 'left' as const, value: Math.abs(clientX - rect.left) },
    ];
    distances.sort((a, b) => a.value - b.value);
    return distances[0].port;
  }, [node.id]);

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  // Fixed pointerdown origin (never mutated during the gesture) used only to
  // measure total displacement, so we can tell a real drag apart from a
  // stationary tap on a text field.
  const dragOriginRef = useRef<{ x: number, y: number } | null>(null);
  const originalNodePosRef = useRef<{ x: number, y: number } | null>(null);
  const hasExceededDragThresholdRef = useRef(false);
  // If the pointerdown landed on a text field (sticky note / text node), we hold
  // a reference to it here instead of focusing immediately. We only focus it on
  // pointerup if the gesture never turned into a drag — that's what lets you
  // grab and move a note by touching its text, instead of every tap opening the
  // keyboard and blocking the drag.
  const pendingTapEditTargetRef = useRef<HTMLElement | null>(null);
  const pendingTapShouldEditRef = useRef(false);
  const getDragThreshold = (pointerType: string) => {
    if (pointerType === 'touch') return 12;
    if (pointerType === 'pen') return 9;
    return 6;
  };

  const [resizeDir, setResizeDir] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  const resizeStartRef = useRef<{ x: number, y: number, width: number, height: number, posX: number, posY: number } | null>(null);
  const isInteractionBusy = isDragging || Boolean(resizeDir);

  const completeRelationTo = useCallback((targetPort?: string, label = '') => {
    if (!relationSourceId) {
      return;
    }

    if (relationSourceId === node.id && relationSourcePort === targetPort) return;
    const duplicate = Object.values(relations).find((relation) => (
      relation.sourceId === relationSourceId &&
      relation.targetId === node.id &&
      (relation.sourcePort || '') === (relationSourcePort || '') &&
      (relation.targetPort || '') === (targetPort || '')
    ));

    if (duplicate) {
      selectRelation(duplicate.id);
      setRelationSourceId(null);
      return;
    }

    addRelation({
      id: nanoid(10),
      sourceId: relationSourceId,
      sourcePort: relationSourcePort || undefined,
      targetId: node.id,
      targetPort,
      relationship: 'related_to',
      label,
      style: { color: targetPort?.startsWith('marker:') ? '#38bdf8' : 'var(--relation-default)', width: 2, type: 'orthogonal', startArrow: 'none', endArrow: 'arrow' }
    });
    setRelationSourceId(null);
  }, [addRelation, node.id, relationSourceId, relationSourcePort, relations, selectRelation, setRelationSourceId]);

  // Dragging handlers
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // If clicking a resize handle or connection port, do not start node dragging
    const target = e.target as HTMLElement;
    if (target.classList.contains('resize-handle') || target.classList.contains('node-port')) return;

    // Sticky notes expose a dedicated drag handle so touch users can move a
    // note without competing with the textarea's edit gesture.
    const isDedicatedDragHandle = Boolean(target.closest('[data-node-drag-handle]'));

    if (activeTool === 'relation' && node.type === 'map' && target.closest('.leaflet-marker-icon')) {
      e.stopPropagation();
      return;
    }

    // Freehand drawing nodes have padded transparent bounds. Ignore clicks on
    // the wrapper so invisible drawing boxes do not block nodes underneath.
    if (
      node.type === 'drawing' &&
      !target.closest('.drawing-node__hit-path, .drawing-node__ink-path, .drawing-node__arrow-ink')
    ) {
      return;
    }

    if (presentationMode) {
      e.preventDefault();
      e.stopPropagation();
      selectNode(node.id, e.shiftKey);
      return;
    }
    
    // Eraser Tool
    if (activeTool === 'eraser') {
      e.stopPropagation();
      removeNode(node.id);
      return;
    }

    // Relation Tool
    if (activeTool === 'relation') {
      e.stopPropagation();
      const nearestPort = getNearestEdgePort(e.clientX, e.clientY);
      if (!relationSourceId) {
        setRelationSource(node.id, nearestPort);
      } else if (relationSourceId === node.id) {
        setRelationSourceId(null);
      } else {
        completeRelationTo(relationTargetId === node.id ? relationTargetPort || nearestPort : nearestPort);
      }
      return;
    }

    if (isDedicatedDragHandle) {
      e.preventDefault();
      e.stopPropagation();
      selectNode(node.id, e.shiftKey);
      hasExceededDragThresholdRef.current = true;
      dragOriginRef.current = { x: e.clientX, y: e.clientY };
      if (!node.locked) {
        snapshot();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        originalNodePosRef.current = { x: node.position.x, y: node.position.y };
      }
      return;
    }

    // For Map nodes: The Top Header is the drag handle for the node.
    // Clicking inside the Leaflet map container allows native map tile panning.
    if (
      node.type === 'map' &&
      target.closest('.leaflet-container') &&
      !target.closest('.map-node__marker-panel')
    ) {
      selectNode(node.id, e.shiftKey);
      e.stopPropagation();
      return;
    }

    // Text fields and editable inputs:
    const targetTag = target.tagName.toLowerCase();
    const isEditingField = targetTag === 'textarea' || (targetTag === 'input' && target.getAttribute('type') !== 'file') || Boolean(target.closest('.shape-node__textarea, .sticky-note__textarea, .text-node__editor, .code-node__textarea'));
    const isStickyTextarea = Boolean(target.closest('.sticky-note__textarea'));
    const isEditableSurface = Boolean(target.closest('.sticky-note__textarea, .text-node__content, .text-node__placeholder, .shape-node__label'));
    const isClickableTarget = Boolean(target.closest('.image-node__placeholder, .image-node__replace-btn, .image-node--empty'));
    const isTouchLike = e.pointerType === 'touch' || e.pointerType === 'pen';
    const wasSelectedBeforeTap = useCanvasStore.getState().selectedNodeIds.includes(node.id);

    if (isEditingField && (!isStickyTextarea || document.activeElement === target)) {
      e.stopPropagation();
      selectNode(node.id, e.shiftKey);
      return;
    }

    if (isClickableTarget || isEditableSurface) {
      e.preventDefault();
      pendingTapEditTargetRef.current = target;
      pendingTapShouldEditRef.current = !isTouchLike || wasSelectedBeforeTap;
    } else {
      pendingTapEditTargetRef.current = null;
      pendingTapShouldEditRef.current = false;
      e.preventDefault();
    }

    e.stopPropagation();
    const active = document.activeElement as HTMLElement | null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      active.blur();
    }
    selectNode(node.id, e.shiftKey);
    hasExceededDragThresholdRef.current = false;
    dragOriginRef.current = { x: e.clientX, y: e.clientY };
    if (!node.locked) {
      snapshot();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      originalNodePosRef.current = { x: node.position.x, y: node.position.y };
    }
  }, [node.id, node.locked, selectNode, node.type, node.data?.interactive, activeTool, relationSourceId, relationTargetId, relationTargetPort, getNearestEdgePort, setRelationSourceId, setRelationSource, completeRelationTo, removeNode, snapshot, node.position, presentationMode]);

  const rafIdRef = useRef<number | null>(null);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (isDragging && dragStartRef.current) {
      if (!hasExceededDragThresholdRef.current && dragOriginRef.current) {
        const totalDx = e.clientX - dragOriginRef.current.x;
        const totalDy = e.clientY - dragOriginRef.current.y;
        if (Math.hypot(totalDx, totalDy) <= getDragThreshold(e.pointerType)) {
          // Still within tap tolerance — don't move the node yet, and don't let
          // tiny jitter nudge it before we know this is really a drag.
          return;
        }
        hasExceededDragThresholdRef.current = true;
        // The gesture turned into a real drag — cancel the pending "focus this
        // text field or click this action" action (and dismiss the mobile keyboard if it already
        // opened) so dragging a note never fights with editing/interacting.
        if (pendingTapEditTargetRef.current) {
          pendingTapEditTargetRef.current.blur?.();
          pendingTapEditTargetRef.current = null;
        }
      }

      const store = useCanvasStore.getState();
      const zoom = store.viewport.zoom;
      const totalDx = (e.clientX - dragStartRef.current.x) / zoom;
      const totalDy = (e.clientY - dragStartRef.current.y) / zoom;

      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        if (!originalNodePosRef.current) return;
        
        let targetX = originalNodePosRef.current.x + totalDx;
        let targetY = originalNodePosRef.current.y + totalDy;
        
        // Smart Snapping Logic
        const SNAP_DIST = 6 / zoom;
        let snapX: number | undefined = undefined;
        let snapY: number | undefined = undefined;

        if (node.type !== 'frame') {
          const allNodes = store.nodes;
          const currentCenterY = targetY + node.size.height / 2;
          const currentCenterX = targetX + node.size.width / 2;

          for (const other of Object.values(allNodes)) {
            if (other.id === node.id || other.type === 'frame' || other.type === 'drawing') continue;
            
            const otherCenterY = other.position.y + other.size.height / 2;
            const otherCenterX = other.position.x + other.size.width / 2;

            // Y snapping (Centers & Edges)
            if (Math.abs(currentCenterY - otherCenterY) < SNAP_DIST) {
              targetY = otherCenterY - node.size.height / 2;
              snapY = otherCenterY;
            } else if (Math.abs(targetY - other.position.y) < SNAP_DIST) {
              targetY = other.position.y;
              snapY = other.position.y;
            } else if (Math.abs(targetY + node.size.height - (other.position.y + other.size.height)) < SNAP_DIST) {
              targetY = other.position.y + other.size.height - node.size.height;
              snapY = other.position.y + other.size.height;
            }

            // X snapping (Centers & Edges)
            if (Math.abs(currentCenterX - otherCenterX) < SNAP_DIST) {
              targetX = otherCenterX - node.size.width / 2;
              snapX = otherCenterX;
            } else if (Math.abs(targetX - other.position.x) < SNAP_DIST) {
              targetX = other.position.x;
              snapX = other.position.x;
            } else if (Math.abs(targetX + node.size.width - (other.position.x + other.size.width)) < SNAP_DIST) {
              targetX = other.position.x + other.size.width - node.size.width;
              snapX = other.position.x + other.size.width;
            }
          }
          store.setSnapLines(snapX !== undefined || snapY !== undefined ? { x: snapX, y: snapY } : null);
        }

        if (node.type === 'frame') {
          const allNodes = store.nodes;
          const fx1 = node.position.x;
          const fy1 = node.position.y;
          const fx2 = node.position.x + node.size.width;
          const fy2 = node.position.y + node.size.height;

          // Note: using incremental dx/dy here for children since it's easier, 
          // but computing it from current position vs last position
          const dx = targetX - node.position.x;
          const dy = targetY - node.position.y;

          updateNode(node.id, {
            position: { x: targetX, y: targetY }
          });

          Object.values(allNodes).forEach((child) => {
            if (child.id === node.id || child.type === 'frame') return;
            const cx = child.position.x + child.size.width / 2;
            const cy = child.position.y + child.size.height / 2;
            if (cx >= fx1 && cx <= fx2 && cy >= fy1 && cy <= fy2) {
              updateNode(child.id, {
                position: { x: child.position.x + dx, y: child.position.y + dy }
              });
            }
          });
        } else {
          updateNode(node.id, {
            position: { x: targetX, y: targetY }
          });
        }
      });
    }
  }, [isDragging, node.id, node.size.width, node.size.height, node.type, node.position.x, node.position.y, updateNode]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
    dragOriginRef.current = null;
    if (!hasExceededDragThresholdRef.current && pendingTapEditTargetRef.current) {
      // A genuine stationary tap (no drag) — focus text on the second touch/pen
      // tap, while mouse users keep the immediate editing behavior.
      const target = pendingTapEditTargetRef.current;
      const targetTag = target.tagName.toLowerCase();
      if (pendingTapShouldEditRef.current) {
        if (targetTag === 'textarea' || (targetTag === 'input' && target.getAttribute('type') !== 'file')) {
          target.focus();
        } else {
          window.dispatchEvent(new CustomEvent('canvio:edit-node', { detail: { nodeId: node.id } }));
        }
      } else if (!(targetTag === 'textarea' || (targetTag === 'input' && target.getAttribute('type') !== 'file'))) {
        target.click();
      }
    }
    pendingTapEditTargetRef.current = null;
    pendingTapShouldEditRef.current = false;
    hasExceededDragThresholdRef.current = false;
    useCanvasStore.getState().setSnapLines(null);
  }, []);

  // Resizing handlers
  const handleResizeStart = useCallback((dir: 'tl' | 'tr' | 'bl' | 'br') => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    snapshot();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setResizeDir(dir);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: node.size.width,
      height: node.size.height,
      posX: node.position.x,
      posY: node.position.y
    };
  }, [node.size.width, node.size.height, node.position.x, node.position.y, snapshot]);

  const handleResizeMove = useCallback((e: PointerEvent) => {
    if (resizeDir && resizeStartRef.current) {
      const zoom = useCanvasStore.getState().viewport.zoom;
      const dx = (e.clientX - resizeStartRef.current.x) / zoom;
      const dy = (e.clientY - resizeStartRef.current.y) / zoom;
      
      let newWidth = resizeStartRef.current.width;
      let newHeight = resizeStartRef.current.height;
      let newX = resizeStartRef.current.posX;
      let newY = resizeStartRef.current.posY;
      
      const minSize = 50;

      if (resizeDir === 'br') {
        newWidth = Math.max(minSize, resizeStartRef.current.width + dx);
        newHeight = Math.max(minSize, resizeStartRef.current.height + dy);
      } else if (resizeDir === 'bl') {
        const potentialWidth = resizeStartRef.current.width - dx;
        if (potentialWidth >= minSize) {
          newWidth = potentialWidth;
          newX = resizeStartRef.current.posX + dx;
        }
        newHeight = Math.max(minSize, resizeStartRef.current.height + dy);
      } else if (resizeDir === 'tr') {
        newWidth = Math.max(minSize, resizeStartRef.current.width + dx);
        const potentialHeight = resizeStartRef.current.height - dy;
        if (potentialHeight >= minSize) {
          newHeight = potentialHeight;
          newY = resizeStartRef.current.posY + dy;
        }
      } else if (resizeDir === 'tl') {
        const potentialWidth = resizeStartRef.current.width - dx;
        const potentialHeight = resizeStartRef.current.height - dy;
        if (potentialWidth >= minSize) {
          newWidth = potentialWidth;
          newX = resizeStartRef.current.posX + dx;
        }
        if (potentialHeight >= minSize) {
          newHeight = potentialHeight;
          newY = resizeStartRef.current.posY + dy;
        }
      }

      updateNode(node.id, {
        position: { x: newX, y: newY },
        size: { width: newWidth, height: newHeight }
      });
    }
  }, [resizeDir, node.id, updateNode]);

  const handleResizeEnd = useCallback(() => {
    setResizeDir(null);
    resizeStartRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  useEffect(() => {
    if (resizeDir) {
      window.addEventListener('pointermove', handleResizeMove);
      window.addEventListener('pointerup', handleResizeEnd);
      window.addEventListener('pointercancel', handleResizeEnd);
    }
    return () => {
      window.removeEventListener('pointermove', handleResizeMove);
      window.removeEventListener('pointerup', handleResizeEnd);
      window.removeEventListener('pointercancel', handleResizeEnd);
    };
  }, [resizeDir, handleResizeMove, handleResizeEnd]);

  const [isHovered, setIsHovered] = useState(false);

  const handleMarkerRelation = useCallback((markerId: string) => {
    const markerPort = makeMarkerPort(markerId);
    if (!relationSourceId) {
      setRelationSource(node.id, markerPort);
      return;
    }

    completeRelationTo(markerPort, 'Site visit location');
  }, [completeRelationTo, node.id, relationSourceId, setRelationSource]);

  const handleMarkerRelationHover = useCallback((markerId: string | null) => {
    const markerPort = markerId ? makeMarkerPort(markerId) : null;
    if (activeTool !== 'relation' || !relationSourceId || !markerPort || (relationSourceId === node.id && relationSourcePort === markerPort)) {
      if (relationTargetId === node.id) setRelationTarget(null);
      return;
    }
    setRelationTarget(node.id, markerPort);
  }, [activeTool, node.id, relationSourceId, relationSourcePort, relationTargetId, setRelationTarget]);

  const handlePortStart = (portPos: 'top' | 'right' | 'bottom' | 'left') => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!relationSourceId) {
      setRelationSource(node.id, portPos);
    } else {
      completeRelationTo(portPos);
    }
  };

  const handleNodeEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsHovered(true);
    updateRelationTargetForNode(e);
  };

  const updateRelationTargetForNode = (e?: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'relation' && relationSourceId && relationSourceId !== node.id) {
      setRelationTarget(node.id, e ? getNearestEdgePort(e.clientX, e.clientY) : undefined);
    }
  };

  const handleNodeLeave = () => {
    setIsHovered(false);
    if (relationTargetId === node.id) {
      setRelationTarget(null);
    }
  };

  const handlePortEnter = (portPos: 'top' | 'right' | 'bottom' | 'left') => () => {
    if (activeTool === 'relation' && relationSourceId && relationSourceId !== node.id) {
      setRelationTarget(node.id, portPos);
    }
  };

  const nodeTouchScale = Math.max(1, Math.min(2.75, 1 / Math.max(0.32, viewportZoom)));
  const baseZIndex = Number.isFinite(node.zIndex) ? node.zIndex : 0;
  const shouldElevateForEditing =
    node.type !== 'frame' && (isSelected || isInteractionBusy || isRelationSource || isRelationTarget);
  const nodeStyle = {
    transform: `translate(${node.position.x}px, ${node.position.y}px)`,
    width: node.size.width,
    height: node.size.height,
    zIndex: shouldElevateForEditing ? baseZIndex + 10000 : baseZIndex,
    '--node-touch-scale': nodeTouchScale,
  } as CSSProperties;

  return (
    <div
      className={`node-renderer node-type-${node.type} ${isSelected ? 'selected' : ''} ${isRelationSource ? 'relation-source' : ''} ${isRelationTarget ? 'relation-target' : ''} ${!presentationMode && activeTool === 'relation' ? 'relation-mode' : ''} ${isInteractionBusy ? 'is-interacting' : ''} ${presentationMode ? 'presentation-mode' : ''} ${isFocusDimmed ? 'focus-dimmed' : ''} ${isFocusActive ? 'focus-active' : ''}`}
      data-node-id={node.id}
      style={nodeStyle}
      onPointerDown={handlePointerDown}
      onMouseEnter={handleNodeEnter}
      onMouseMove={updateRelationTargetForNode}
      onMouseLeave={handleNodeLeave}
    >
      {/* Type specific rendering */}
      <div className="node-content" style={{ width: '100%', height: '100%' }}>
        {node.type === 'drawing' && <DrawingNode node={node as any} />}
        {node.type === 'sticky' && <StickyNote node={node as any} selected={isSelected} onChange={updateNode as any} />}
        {node.type === 'map' && (
          <MapNode
            node={node as any}
            selected={isSelected}
            onChange={updateNode as any}
            relationMode={!presentationMode && activeTool === 'relation'}
            relationSourcePort={relationSourceId === node.id ? relationSourcePort : null}
            onMarkerRelation={handleMarkerRelation}
            onMarkerRelationHover={handleMarkerRelationHover}
          />
        )}
        {node.type === 'text' && <TextNode node={node as any} selected={isSelected} onChange={updateNode as any} />}
        {node.type === 'image' && <ImageNode node={node as any} selected={isSelected} onChange={updateNode as any} />}
        {node.type === 'shape' && <ShapeNode node={node as any} selected={isSelected} onChange={updateNode as any} />}
        {node.type === 'frame' && <FrameNode node={node as any} selected={isSelected} onChange={updateNode as any} />}
        {node.type === 'code' && <CodeNode node={node as any} selected={isSelected} onChange={updateNode as any} />}
      </div>

      {/* Interactive Connection Ports (rendered on hover, selection, or relation mode) */}
      {!presentationMode && (isHovered || isSelected || activeTool === 'relation') && (
        <>
          <div className={`node-port top ${(isRelationSource && relationSourcePort === 'top') || (isRelationTarget && relationTargetPort === 'top') ? 'active' : ''}`} title="Top connection" onMouseEnter={handlePortEnter('top')} onPointerEnter={handlePortEnter('top')} onPointerDown={handlePortStart('top')} />
          <div className={`node-port right ${(isRelationSource && relationSourcePort === 'right') || (isRelationTarget && relationTargetPort === 'right') ? 'active' : ''}`} title="Right connection" onMouseEnter={handlePortEnter('right')} onPointerEnter={handlePortEnter('right')} onPointerDown={handlePortStart('right')} />
          <div className={`node-port bottom ${(isRelationSource && relationSourcePort === 'bottom') || (isRelationTarget && relationTargetPort === 'bottom') ? 'active' : ''}`} title="Bottom connection" onMouseEnter={handlePortEnter('bottom')} onPointerEnter={handlePortEnter('bottom')} onPointerDown={handlePortStart('bottom')} />
          <div className={`node-port left ${(isRelationSource && relationSourcePort === 'left') || (isRelationTarget && relationTargetPort === 'left') ? 'active' : ''}`} title="Left connection" onMouseEnter={handlePortEnter('left')} onPointerEnter={handlePortEnter('left')} onPointerDown={handlePortStart('left')} />
        </>
      )}

      {/* Floating Context Toolbar (NodeInspector) */}
      {!presentationMode && isOnlySelected && <NodeInspector node={node} />}

      {!presentationMode && isSelected && !node.locked && (
        <>
          <div className="resize-handle tl" onPointerDown={handleResizeStart('tl')} />
          <div className="resize-handle tr" onPointerDown={handleResizeStart('tr')} />
          <div className="resize-handle bl" onPointerDown={handleResizeStart('bl')} />
          <div className="resize-handle br" onPointerDown={handleResizeStart('br')} />
        </>
      )}
    </div>
  );
}
