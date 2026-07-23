import { ShapeType } from '@canvio/objects';

export interface DetectedShape {
  type: ShapeType;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export function detectGeometricShape(points: number[][]): DetectedShape | null {
  if (!points || points.length < 8) return null;

  const strokePoints = points.map(([x, y]) => ({ x, y }));
  const xs = strokePoints.map((p) => p.x);
  const ys = strokePoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  if (width < 30 || height < 30) return null;

  const maxDim = Math.max(width, height);
  const start = strokePoints[0];
  const end = strokePoints[strokePoints.length - 1];
  const closureDist = distance(start, end);
  const turn = Math.abs(totalTurn(strokePoints));
  const isClosed = closureDist < maxDim * 0.35 || turn >= 4.5;
  if (!isClosed) return null;

  const closedPoints = closureDist < maxDim * 0.12
    ? strokePoints
    : [...strokePoints, start];
  const simplified = simplifyPoints(closedPoints, Math.max(6, maxDim * 0.04));
  const vertices = pruneVertices(removeClosingDuplicate(simplified), maxDim);
  const cornerCount = vertices.length;
  const area = Math.abs(polygonArea(closedPoints));
  const perimeter = polylineLength(closedPoints);
  const circularity = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;
  const aspect = width / Math.max(1, height);

  const cornerRadius = Math.min(width, height) * 0.2;
  const boxCornersTouched = [
    strokePoints.some((p) => distance(p, { x: minX, y: minY }) < cornerRadius),
    strokePoints.some((p) => distance(p, { x: maxX, y: minY }) < cornerRadius),
    strokePoints.some((p) => distance(p, { x: maxX, y: maxY }) < cornerRadius),
    strokePoints.some((p) => distance(p, { x: minX, y: maxY }) < cornerRadius),
  ].filter(Boolean).length;

  let detectedType: ShapeType = 'circle';

  if (cornerCount === 3 || (cornerCount === 4 && boxCornersTouched <= 2 && circularity < 0.7)) {
    detectedType = 'triangle';
  } else if ((cornerCount >= 4 && cornerCount <= 5 && boxCornersTouched >= 3) || (cornerCount === 4 && circularity < 0.76)) {
    detectedType = 'rectangle';
  } else if (cornerCount >= 5 && cornerCount <= 7 && circularity < 0.86) {
    detectedType = 'hexagon';
  } else if (circularity > 0.68 && aspect > 0.55 && aspect < 1.8) {
    detectedType = 'circle';
  } else if (cornerCount <= 4) {
    detectedType = cornerCount <= 3 ? 'triangle' : 'rectangle';
  }

  return {
    type: detectedType,
    position: { x: minX, y: minY },
    size: { width: Math.max(40, width), height: Math.max(40, height) },
  };
}

type SimplePoint = { x: number; y: number };

function distance(a: SimplePoint, b: SimplePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function totalTurn(points: SimplePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
    total += Math.atan2(Math.sin(angle2 - angle1), Math.cos(angle2 - angle1));
  }
  return total;
}

function simplifyPoints(points: SimplePoint[], tolerance: number): SimplePoint[] {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const currentDistance = perpendicularDistance(points[i], start, end);
    if (currentDistance > maxDistance) {
      maxDistance = currentDistance;
      index = i;
    }
  }

  if (maxDistance <= tolerance) return [start, end];

  const left = simplifyPoints(points.slice(0, index + 1), tolerance);
  const right = simplifyPoints(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

function perpendicularDistance(point: SimplePoint, lineStart: SimplePoint, lineEnd: SimplePoint): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  if (dx === 0 && dy === 0) return distance(point, lineStart);

  return Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) /
    Math.hypot(dx, dy);
}

function removeClosingDuplicate(points: SimplePoint[]): SimplePoint[] {
  if (points.length > 1 && distance(points[0], points[points.length - 1]) < 1) {
    return points.slice(0, -1);
  }
  return points;
}

function pruneVertices(points: SimplePoint[], maxDim: number): SimplePoint[] {
  if (points.length <= 3) return points;

  return points.filter((point, index) => {
    const prev = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    if (distance(prev, point) < maxDim * 0.06 || distance(point, next) < maxDim * 0.06) {
      return false;
    }

    const angle = cornerAngle(prev, point, next);
    return angle < 2.62;
  });
}

function cornerAngle(prev: SimplePoint, point: SimplePoint, next: SimplePoint): number {
  const a1 = Math.atan2(prev.y - point.y, prev.x - point.x);
  const a2 = Math.atan2(next.y - point.y, next.x - point.x);
  let diff = Math.abs(a2 - a1);
  if (diff > Math.PI) diff = 2 * Math.PI - diff;
  return diff;
}

function polygonArea(points: SimplePoint[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    area += points[i].x * next.y - next.x * points[i].y;
  }
  return area / 2;
}

function polylineLength(points: SimplePoint[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += distance(points[i - 1], points[i]);
  }
  return length;
}

export interface DetectedArrow {
  sourceId: string;
  targetId: string;
}

/**
 * Detects if a hand-drawn stroke connects Node A to Node B.
 */
export function detectGestureArrow(
  points: number[][],
  nodes: Record<string, any>
): DetectedArrow | null {
  if (!points || points.length < 5) return null;

  const start = points[0];
  const end = points[points.length - 1];

  const strokeDist = Math.hypot(end[0] - start[0], end[1] - start[1]);
  if (strokeDist < 50) return null;

  const allNodes = Object.values(nodes);
  if (allNodes.length < 2) return null;

  const findClosestNode = (pt: number[]) => {
    let closestNode: any = null;
    let minDistance = 70;

    allNodes.forEach((node) => {
      const nx = Math.max(node.position.x, Math.min(pt[0], node.position.x + node.size.width));
      const ny = Math.max(node.position.y, Math.min(pt[1], node.position.y + node.size.height));
      const dist = Math.hypot(pt[0] - nx, pt[1] - ny);

      if (dist < minDistance) {
        minDistance = dist;
        closestNode = node;
      }
    });

    return closestNode;
  };

  const sourceNode = findClosestNode(start);
  const targetNode = findClosestNode(end);

  if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
    return {
      sourceId: sourceNode.id,
      targetId: targetNode.id,
    };
  }

  return null;
}
