import { useState, useCallback, useRef, useEffect } from 'react';
import { LivingNode } from '../../store/canvasStore';
import { useCanvasStore } from '../../store/canvasStore';
import { DrawingNode, StickyNote, MapNode, TextNode, ImageNode, ShapeNode, FrameNode, CodeNode } from '@canvio/objects';
import { NodeInspector } from '../NodeInspector/NodeInspector';
import { makeMarkerPort } from '../RelationRenderer/relationUtils';
import { nanoid } from 'nanoid';
import './NodeRenderer.css';

interface Props {
  node: LivingNode;
}

export function NodeRenderer({ node }: Props) {
  const updateNode = useCanvasStore(s => s.updateNode);
  const selectedNodeIds = useCanvasStore(s => s.selectedNodeIds);
  const selectNode = useCanvasStore(s => s.selectNode);
  const isSelected = selectedNodeIds.includes(node.id);
  
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

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);

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

    if (activeTool === 'relation' && node.type === 'map' && target.closest('.leaflet-marker-icon')) {
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
    
    // Eraser Tool
    if (activeTool === 'eraser') {
      e.stopPropagation();
      removeNode(node.id);
      return;
    }

    // Relation Tool
    if (activeTool === 'relation') {
      e.stopPropagation();
      if (!relationSourceId) {
        setRelationSource(node.id);
      } else if (relationSourceId === node.id && !relationSourcePort) {
        setRelationSourceId(null);
      } else {
        completeRelationTo(relationTargetId === node.id ? relationTargetPort || undefined : undefined);
      }
      return;
    }

    // If clicking an input or textarea, let the element handle focus and selection
    const targetTag = target.tagName.toLowerCase();
    if (targetTag === 'textarea' || targetTag === 'input' || target.closest('.sticky-note__textarea')) {
      selectNode(node.id, e.shiftKey);
      return;
    }
    
    // If clicking inside an interactive map, do not start node dragging
    if (node.type === 'map' && node.data?.interactive && target.closest('.leaflet-container')) {
      // Still select the node on click
      selectNode(node.id, e.shiftKey);
      return;
    }
    
    e.stopPropagation();
    e.preventDefault();
    selectNode(node.id, e.shiftKey);
    if (!node.locked) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [node.id, node.locked, selectNode, node.type, node.data?.interactive, activeTool, relationSourceId, relationSourcePort, relationTargetId, relationTargetPort, setRelationSourceId, setRelationSource, completeRelationTo, removeNode]);

  const rafIdRef = useRef<number | null>(null);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (isDragging && dragStartRef.current) {
      const zoom = useCanvasStore.getState().viewport.zoom;
      const dx = (e.clientX - dragStartRef.current.x) / zoom;
      const dy = (e.clientY - dragStartRef.current.y) / zoom;
      dragStartRef.current = { x: e.clientX, y: e.clientY };

      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        if (node.type === 'frame') {
          const allNodes = useCanvasStore.getState().nodes;
          const fx1 = node.position.x;
          const fy1 = node.position.y;
          const fx2 = node.position.x + node.size.width;
          const fy2 = node.position.y + node.size.height;

          updateNode(node.id, {
            position: { x: node.position.x + dx, y: node.position.y + dy }
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
            position: {
              x: node.position.x + dx,
              y: node.position.y + dy
            }
          });
        }
      });
    }
  }, [isDragging, node.id, node.position.x, node.position.y, node.size.width, node.size.height, node.type, updateNode]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Resizing handlers
  const handleResizeStart = useCallback((dir: 'tl' | 'tr' | 'bl' | 'br') => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
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
  }, [node.size.width, node.size.height, node.position.x, node.position.y]);

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

  const handlePortStart = (portPos: 'top' | 'right' | 'bottom' | 'left') => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!relationSourceId) {
      setRelationSource(node.id, portPos);
    } else {
      completeRelationTo(portPos);
    }
  };

  const handleNodeEnter = () => {
    setIsHovered(true);
    updateRelationTargetForNode();
  };

  const updateRelationTargetForNode = () => {
    if (activeTool === 'relation' && relationSourceId && relationSourceId !== node.id) {
      setRelationTarget(node.id);
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

  return (
    <div
      className={`node-renderer node-type-${node.type} ${isSelected ? 'selected' : ''} ${isRelationSource ? 'relation-source' : ''} ${isRelationTarget ? 'relation-target' : ''} ${activeTool === 'relation' ? 'relation-mode' : ''} ${isInteractionBusy ? 'is-interacting' : ''}`}
      style={{
        transform: `translate(${node.position.x}px, ${node.position.y}px)`,
        width: node.size.width,
        height: node.size.height,
        zIndex: node.zIndex,
      }}
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
            relationMode={activeTool === 'relation'}
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
      {(isHovered || isSelected || activeTool === 'relation') && (
        <>
          <div className={`node-port top ${relationSourcePort === 'top' || (isRelationTarget && relationTargetPort === 'top') ? 'active' : ''}`} title="Top connection" onMouseEnter={handlePortEnter('top')} onMouseDown={handlePortStart('top')} />
          <div className={`node-port right ${relationSourcePort === 'right' || (isRelationTarget && relationTargetPort === 'right') ? 'active' : ''}`} title="Right connection" onMouseEnter={handlePortEnter('right')} onMouseDown={handlePortStart('right')} />
          <div className={`node-port bottom ${relationSourcePort === 'bottom' || (isRelationTarget && relationTargetPort === 'bottom') ? 'active' : ''}`} title="Bottom connection" onMouseEnter={handlePortEnter('bottom')} onMouseDown={handlePortStart('bottom')} />
          <div className={`node-port left ${relationSourcePort === 'left' || (isRelationTarget && relationTargetPort === 'left') ? 'active' : ''}`} title="Left connection" onMouseEnter={handlePortEnter('left')} onMouseDown={handlePortStart('left')} />
        </>
      )}

      {/* Floating Context Toolbar (NodeInspector) */}
      {isSelected && <NodeInspector node={node} />}

      {isSelected && !node.locked && (
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
