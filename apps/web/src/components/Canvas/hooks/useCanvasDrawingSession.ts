import { useRef, useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { LivingNode, Relation, ToolMode } from '@canvio/core';
import { useCanvasStore } from '../../../store/canvasStore';
import { detectGeometricShape, detectGestureArrow } from '../../../utils/shapeDetection';

interface DrawingSample {
  x: number;
  y: number;
  pressure: number;
}

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
  const addRelation = useCanvasStore((s) => s.addRelation);
  const addInkStroke = useCanvasStore((s) => s.addInkStroke);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const nextZIndex = useCanvasStore((s) => s.nextZIndex);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<number[][] | null>(null);
  const pressureSensitiveRef = useRef(false);

  const resetDrawing = useCallback(() => {
    setIsDrawing(false);
    setCurrentStroke(null);
    pressureSensitiveRef.current = false;
  }, []);

  useEffect(() => {
    if (activeTool !== 'draw' && activeTool !== 'highlighter' && activeTool !== 'arrow' && isDrawing) {
      resetDrawing();
    }
  }, [activeTool, isDrawing, resetDrawing]);

  const startDrawing = useCallback((worldPos: DrawingSample, pressureSensitive = false) => {
    pressureSensitiveRef.current = pressureSensitive;
    setIsDrawing(true);
    setCurrentStroke([[worldPos.x, worldPos.y, worldPos.pressure]]);
  }, []);

  const updateStrokePoints = useCallback(
    (samples: DrawingSample[], pressureSensitive = false) => {
      if (!isDrawing) return;
      pressureSensitiveRef.current = pressureSensitiveRef.current || pressureSensitive;
      setCurrentStroke((prev) => {
        if (samples.length === 0) return prev;
        const points = prev ? [...prev] : [];
        let changed = false;

        samples.forEach((sample) => {
          const last = points[points.length - 1];
          if (last && Math.hypot(sample.x - last[0], sample.y - last[1]) < Math.max(0.5, strokeWidth * 0.14)) {
            return;
          }
          points.push([sample.x, sample.y, sample.pressure]);
          changed = true;
        });

        if (!changed) {
          return prev;
        }
        return points;
      });
    },
    [isDrawing, strokeWidth]
  );

  const finishDrawing = useCallback(() => {
    if (!isDrawing || !currentStroke || currentStroke.length === 0) {
      resetDrawing();
      return;
    }

    // 1. Arrow Tool (Creates editable arrow node)
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
      resetDrawing();
      return;
    }

    // 2. Highlighter Tool -> Free Ink Layer
    if (activeTool === 'highlighter') {
      if (currentStroke.length > 0) {
        addInkStroke({
          id: nanoid(10),
          points: currentStroke,
          color: strokeColor || '#f59e0b',
          width: Math.max(14, strokeWidth * 3.5),
          opacity: 0.34,
          highlighter: true,
          createdAt: Date.now(),
        });
      }
      resetDrawing();
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
      resetDrawing();
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
      resetDrawing();
      return;
    }

    // 5. Freehand Ink Layer (Free sketch and margin annotations)
    if (currentStroke.length > 0) {
      addInkStroke({
        id: nanoid(10),
        points: currentStroke,
        color: strokeColor || '#f0f0f5',
        width: strokeWidth || 3,
        opacity: 1,
        highlighter: false,
        createdAt: Date.now(),
      });
    }

    resetDrawing();
  }, [
    activeTool,
    addInkStroke,
    addNode,
    addRelation,
    autoShapeEnabled,
    currentStroke,
    isDrawing,
    nextZIndex,
    resetDrawing,
    selectNode,
    setActiveTool,
    strokeColor,
    strokeWidth,
  ]);

  return {
    isDrawing,
    currentStroke,
    pressureSensitive: pressureSensitiveRef.current,
    startDrawing,
    updateStrokePoints,
    finishDrawing,
    cancelDrawing: resetDrawing,
  };
}
