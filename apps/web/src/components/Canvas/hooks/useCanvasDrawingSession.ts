import { useRef, useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { LivingNode, Relation, ToolMode } from '@canvio/core';
import { useCanvasStore } from '../../../store/canvasStore';
import { detectGeometricShape, detectGestureArrow } from '../../../utils/shapeDetection';

const INK_SESSION_MAX_GAP_MS = 2000;
const INK_SESSION_PROXIMITY_PX = 250;

interface UseCanvasDrawingSessionProps {
  activeTool: ToolMode;
  autoShapeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
}

export function useCanvasDrawingSession({
  activeTool,
  autoShapeEnabled,
  strokeColor,
  strokeWidth,
}: UseCanvasDrawingSessionProps) {
  const addNode = useCanvasStore((s) => s.addNode);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const addRelation = useCanvasStore((s) => s.addRelation);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const nextZIndex = useCanvasStore((s) => s.nextZIndex);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<number[][] | null>(null);

  const inkSessionRef = useRef<{
    nodeId: string;
    lastEndTime: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null>(null);

  useEffect(() => {
    if (activeTool !== 'draw') {
      inkSessionRef.current = null;
    }
  }, [activeTool]);

  const startDrawing = useCallback((worldPos: { x: number; y: number }) => {
    setIsDrawing(true);
    setCurrentStroke([[worldPos.x, worldPos.y, 0.5]]);
  }, []);

  const updateStrokePoint = useCallback(
    (worldPos: { x: number; y: number }) => {
      if (!isDrawing) return;
      setCurrentStroke((prev) => {
        const points = prev || [];
        const last = points[points.length - 1];
        if (last && Math.hypot(worldPos.x - last[0], worldPos.y - last[1]) < Math.max(0.75, strokeWidth * 0.2)) {
          return points;
        }
        return [...points, [worldPos.x, worldPos.y, 0.5]];
      });
    },
    [isDrawing, strokeWidth]
  );

  const finishDrawing = useCallback(() => {
    if (!isDrawing || !currentStroke || currentStroke.length <= 1) {
      setIsDrawing(false);
      setCurrentStroke(null);
      return;
    }

    // 1. Arrow Tool
    if (activeTool === 'arrow') {
      const start = currentStroke[0];
      const end = currentStroke[currentStroke.length - 1];
      const distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
      if (distance > 10) {
        const arrowWidth = Math.max(2.5, strokeWidth);
        const padding = Math.max(28, arrowWidth * 8);
        const minX = Math.min(...currentStroke.map((p) => p[0]));
        const minY = Math.min(...currentStroke.map((p) => p[1]));
        const maxX = Math.max(...currentStroke.map((p) => p[0]));
        const maxY = Math.max(...currentStroke.map((p) => p[1]));
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

    // 2. Highlighter Tool
    if (activeTool === 'highlighter') {
      const minX = Math.min(...currentStroke.map((p) => p[0]));
      const minY = Math.min(...currentStroke.map((p) => p[1]));
      const maxX = Math.max(...currentStroke.map((p) => p[0]));
      const maxY = Math.max(...currentStroke.map((p) => p[1]));
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
          strokes: [
            {
              id: nanoid(6),
              points: normalizedPoints,
              color: strokeColor || '#f59e0b',
              width: highlightWidth,
              opacity: 0.34,
              highlighter: true,
              complete: true,
            },
          ],
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

    // 3. Gesture Arrow (Node A -> Node B connection)
    const currentNodes = useCanvasStore.getState().nodes;
    const gestureArrow = autoShapeEnabled ? detectGestureArrow(currentStroke, currentNodes) : null;
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

    // 4. Closed Geometric Shape Detection (only when autoShape is ON)
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
      // 5. Standard Freehand Stroke (Ink Session Grouping)
      // In freehand mode: DON'T select the node and DON'T switch to select tool.
      // This lets the user keep drawing naturally stroke after stroke.
      const strokeMinX = Math.min(...currentStroke.map((p) => p[0]));
      const strokeMinY = Math.min(...currentStroke.map((p) => p[1]));
      const strokeMaxX = Math.max(...currentStroke.map((p) => p[0]));
      const strokeMaxY = Math.max(...currentStroke.map((p) => p[1]));
      const padding = 20;

      const session = inkSessionRef.current;
      const now = Date.now();
      const withinTime = session ? now - session.lastEndTime <= INK_SESSION_MAX_GAP_MS : false;
      const withinProximity = session
        ? strokeMinX < session.maxX + INK_SESSION_PROXIMITY_PX &&
          strokeMaxX > session.minX - INK_SESSION_PROXIMITY_PX &&
          strokeMinY < session.maxY + INK_SESSION_PROXIMITY_PX &&
          strokeMaxY > session.minY - INK_SESSION_PROXIMITY_PX
        : false;

      const existingNode = session ? useCanvasStore.getState().nodes[session.nodeId] : null;

      if (session && existingNode && withinTime && withinProximity) {
        const combinedMinX = Math.min(session.minX, strokeMinX);
        const combinedMinY = Math.min(session.minY, strokeMinY);
        const combinedMaxX = Math.max(session.maxX, strokeMaxX);
        const combinedMaxY = Math.max(session.maxY, strokeMaxY);

        const newPosition = { x: combinedMinX - padding, y: combinedMinY - padding };
        const newSize = {
          width: combinedMaxX - combinedMinX + padding * 2,
          height: combinedMaxY - combinedMinY + padding * 2,
        };

        const shiftX = existingNode.position.x - newPosition.x;
        const shiftY = existingNode.position.y - newPosition.y;
        type InkStroke = { id: string; points: number[][]; color: string; width: number; complete: boolean };
        const priorStrokes = (existingNode.data?.strokes as InkStroke[] | undefined) || [];
        const existingStrokes = priorStrokes.map((s) => ({
          ...s,
          points: s.points.map(([x, y, p]) => [x + shiftX, y + shiftY, p]),
        }));

        const newStrokeNormalized = currentStroke.map(([x, y, p]) => [
          x - newPosition.x,
          y - newPosition.y,
          p,
        ]);

        updateNode(session.nodeId, {
          position: newPosition,
          size: newSize,
          data: {
            ...existingNode.data,
            strokes: [
              ...existingStrokes,
              {
                id: nanoid(6),
                points: newStrokeNormalized,
                color: strokeColor,
                width: strokeWidth,
                complete: true,
              },
            ],
          },
          updatedAt: now,
        });
        // Don't select, don't switch tool — keep drawing!

        inkSessionRef.current = {
          nodeId: session.nodeId,
          lastEndTime: now,
          minX: combinedMinX,
          minY: combinedMinY,
          maxX: combinedMaxX,
          maxY: combinedMaxY,
        };
      } else {
        const normalizedPoints = currentStroke.map(([x, y, p]) => [
          x - strokeMinX + padding,
          y - strokeMinY + padding,
          p,
        ]);

        const node: LivingNode = {
          id: nanoid(10),
          type: 'drawing',
          position: { x: strokeMinX - padding, y: strokeMinY - padding },
          size: { width: strokeMaxX - strokeMinX + padding * 2, height: strokeMaxY - strokeMinY + padding * 2 },
          rotation: 0,
          zIndex: nextZIndex(),
          locked: false,
          data: {
            kind: 'freehand',
            strokes: [
              {
                id: nanoid(6),
                points: normalizedPoints,
                color: strokeColor,
                width: strokeWidth,
                complete: true,
              },
            ],
          },
          createdAt: now,
          updatedAt: now,
        };
        addNode(node);
        // Don't select, don't switch tool — keep drawing!

        inkSessionRef.current = {
          nodeId: node.id,
          lastEndTime: now,
          minX: strokeMinX,
          minY: strokeMinY,
          maxX: strokeMaxX,
          maxY: strokeMaxY,
        };
      }
    }

    setIsDrawing(false);
    setCurrentStroke(null);
  }, [
    activeTool,
    addNode,
    addRelation,
    autoShapeEnabled,
    currentStroke,
    isDrawing,
    nextZIndex,
    selectNode,
    setActiveTool,
    strokeColor,
    strokeWidth,
    updateNode,
  ]);

  return {
    isDrawing,
    currentStroke,
    startDrawing,
    updateStrokePoint,
    finishDrawing,
  };
}
