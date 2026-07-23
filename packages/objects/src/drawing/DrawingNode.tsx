import React from 'react';
import { getStroke } from 'perfect-freehand';
import { nanoid } from 'nanoid';
import { LivingNode, Point } from '../types';
import './DrawingNode.css';

export interface Stroke {
  id: string;
  points: number[][]; // [x, y, pressure]
  color: string;
  width: number;
  complete: boolean;
  opacity?: number;
  highlighter?: boolean;
}

export interface ArrowData {
  start: [number, number];
  end: [number, number];
  points?: number[][];
  color: string;
  width: number;
  opacity?: number;
}

export interface DrawingData {
  strokes: Stroke[];
  arrow?: ArrowData;
  kind?: 'freehand' | 'highlighter' | 'arrow';
}

interface DrawingNodeProps {
  node: LivingNode;
}

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke || !stroke.length) return '';

  const d = stroke.reduce(
    (acc: any[], [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );

  d.push('Z');
  return d.join(' ');
}

function getSmoothPathFromPoints(points: number[][]): string {
  const cleanPoints = getArrowRenderPoints(points);
  if (cleanPoints.length === 0) return '';
  if (cleanPoints.length === 1) return `M ${cleanPoints[0][0]} ${cleanPoints[0][1]}`;
  if (cleanPoints.length === 2) return `M ${cleanPoints[0][0]} ${cleanPoints[0][1]} L ${cleanPoints[1][0]} ${cleanPoints[1][1]}`;

  const tension = 0.18;
  const commands = [`M ${cleanPoints[0][0]} ${cleanPoints[0][1]}`];

  for (let index = 0; index < cleanPoints.length - 1; index += 1) {
    const previous = cleanPoints[index - 1] || cleanPoints[index];
    const current = cleanPoints[index];
    const next = cleanPoints[index + 1];
    const afterNext = cleanPoints[index + 2] || next;
    const cp1x = current[0] + (next[0] - previous[0]) * tension;
    const cp1y = current[1] + (next[1] - previous[1]) * tension;
    const cp2x = next[0] - (afterNext[0] - current[0]) * tension;
    const cp2y = next[1] - (afterNext[1] - current[1]) * tension;
    commands.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${next[0]} ${next[1]}`);
  }

  return commands.join(' ');
}

function getDistance(a: number[], b: number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function filterClosePoints(points: number[][], minDistance = 8) {
  if (!points || points.length <= 2) return points || [];

  const filtered = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    if (getDistance(points[index], filtered[filtered.length - 1]) >= minDistance) {
      filtered.push(points[index]);
    }
  }
  filtered.push(points[points.length - 1]);
  return filtered;
}

function getPerpendicularDistance(point: number[], lineStart: number[], lineEnd: number[]) {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  if (dx === 0 && dy === 0) return getDistance(point, lineStart);
  return Math.abs(dy * point[0] - dx * point[1] + lineEnd[0] * lineStart[1] - lineEnd[1] * lineStart[0]) / Math.hypot(dx, dy);
}

function simplifyPoints(points: number[][], tolerance = 10): number[][] {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let splitIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = getPerpendicularDistance(points[index], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = index;
    }
  }

  if (maxDistance <= tolerance) return [first, last];

  const left = simplifyPoints(points.slice(0, splitIndex + 1), tolerance);
  const right = simplifyPoints(points.slice(splitIndex), tolerance);
  return left.slice(0, -1).concat(right);
}

function getArrowRenderPoints(points: number[][]): number[][] {
  const filtered = filterClosePoints(points, 8);
  const simplified = simplifyPoints(filtered, 10);
  return simplified.length >= 2 ? simplified : filtered;
}

export const DrawingNode: React.FC<DrawingNodeProps> = ({ node }) => {
  const rawData = node.data as Partial<DrawingData>;
  const data: DrawingData = {
    strokes: Array.isArray(rawData.strokes) ? rawData.strokes : [],
    arrow: rawData.arrow,
    kind: rawData.kind,
  };
  const strokes = data.strokes || [];
  const markerId = `drawing-arrowhead-${node.id}`;
  const arrowPoints = data.arrow?.points?.length ? data.arrow.points : data.arrow ? [data.arrow.start, data.arrow.end] : [];
  const arrowPath = getSmoothPathFromPoints(arrowPoints);
  const arrowWidth = data.arrow?.width ?? 3;
  const arrowHeadSize = Math.max(10, Math.min(18, arrowWidth * 3.2));
  const arrowHeadMid = arrowHeadSize / 2;

  return (
    <div className="drawing-node">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${node.size.width} ${node.size.height}`}
        style={{ overflow: 'visible' }}
      >
        {data.arrow && arrowPath && (
          <>
            <defs>
              <marker
                id={markerId}
                markerWidth={arrowHeadSize}
                markerHeight={arrowHeadSize}
                refX={arrowHeadSize - 1}
                refY={arrowHeadMid}
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d={`M 1 1 L ${arrowHeadSize - 1} ${arrowHeadMid} L 1 ${arrowHeadSize - 1} z`} fill={data.arrow.color} fillOpacity={data.arrow.opacity ?? 1} />
              </marker>
            </defs>
            <path
              className="drawing-node__hit-path"
              d={arrowPath}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(22, data.arrow.width + 16)}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pointerEvents: 'stroke' }}
            />
            <path
              className="drawing-node__arrow-ink"
              d={arrowPath}
              fill="none"
              stroke="var(--relation-casing)"
              strokeWidth={Math.max(6, data.arrow.width + 3.5)}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.74"
              style={{ pointerEvents: 'none' }}
            />
            <path
              className="drawing-node__arrow-ink"
              d={arrowPath}
              fill="none"
              stroke={data.arrow.color}
              strokeWidth={data.arrow.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={`url(#${markerId})`}
              opacity={data.arrow.opacity ?? 1}
              style={{ pointerEvents: 'none' }}
            />
          </>
        )}
        {strokes.map((stroke) => {
          const outlinePoints = getStroke(stroke.points, {
            size: stroke.width,
            thinning: 0.58,
            smoothing: 0.68,
            streamline: 0.62,
            simulatePressure: stroke.complete,
          });
          const pathData = getSvgPathFromStroke(outlinePoints);
          const hitWidth = Math.max(18, stroke.width + 14);
          return (
            <g key={stroke.id}>
              <path
                className="drawing-node__hit-path"
                d={pathData}
                fill="none"
                stroke="transparent"
                strokeWidth={hitWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ pointerEvents: 'stroke' }}
              />
              <path
                className="drawing-node__ink-path"
                d={pathData}
                fill={stroke.color}
                fillOpacity={stroke.opacity ?? 1}
                style={{ pointerEvents: 'visiblePainted' }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const drawingPlugin = {
  type: 'drawing',
  name: 'Drawing',
  icon: 'draw',
  category: 'core' as const,
  defaultSize: { width: 800, height: 600 },
  create: (position: Point): LivingNode => ({
    id: nanoid(),
    type: 'drawing',
    position,
    size: { width: 800, height: 600 },
    rotation: 0,
    zIndex: 0,
    locked: false,
    data: { strokes: [] },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }),
  getConnectionPorts: () => [
    { id: 'top', position: 'top' as const },
    { id: 'right', position: 'right' as const },
    { id: 'bottom', position: 'bottom' as const },
    { id: 'left', position: 'left' as const },
  ],
};
