import { LivingNode, Point, Size } from '@canvio/core';

export type PortPosition = 'top' | 'right' | 'bottom' | 'left' | 'center';
const MARKER_PORT_PREFIX = 'marker:';
const MAP_CONTENT_PADDING = 16;

export interface PortPoint {
  x: number;
  y: number;
  position: PortPosition;
}

/**
 * Calculates connection ports for a node box
 */
export function getNodePorts(position: Point, size: Size): Record<PortPosition, PortPoint> {
  const { x, y } = position;
  const { width, height } = size;

  return {
    top: { x: x + width / 2, y: y, position: 'top' },
    right: { x: x + width, y: y + height / 2, position: 'right' },
    bottom: { x: x + width / 2, y: y + height, position: 'bottom' },
    left: { x: x, y: y + height / 2, position: 'left' },
    center: { x: x + width / 2, y: y + height / 2, position: 'center' }
  };
}

/**
 * Finds the closest pair of ports between two nodes
 */
export function getBestPorts(
  sourcePos: Point,
  sourceSize: Size,
  targetPos: Point,
  targetSize: Size,
  explicitSourcePort?: PortPosition,
  explicitTargetPort?: PortPosition
): { sourcePort: PortPoint; targetPort: PortPoint } {
  const sourcePorts = getNodePorts(sourcePos, sourceSize);
  const targetPorts = getNodePorts(targetPos, targetSize);

  if (explicitSourcePort && explicitTargetPort) {
    return {
      sourcePort: sourcePorts[explicitSourcePort],
      targetPort: targetPorts[explicitTargetPort]
    };
  }

  // If ports are auto, evaluate outer ports (top, right, bottom, left)
  const outerPositions: PortPosition[] = ['top', 'right', 'bottom', 'left'];
  let minDistance = Infinity;
  let bestSource = sourcePorts.center;
  let bestTarget = targetPorts.center;

  const validSourcePorts = explicitSourcePort ? [explicitSourcePort] : outerPositions;
  const validTargetPorts = explicitTargetPort ? [explicitTargetPort] : outerPositions;

  for (const sPos of validSourcePorts) {
    for (const tPos of validTargetPorts) {
      const sp = sourcePorts[sPos];
      const tp = targetPorts[tPos];
      const dist = Math.hypot(tp.x - sp.x, tp.y - sp.y);
      if (dist < minDistance) {
        minDistance = dist;
        bestSource = sp;
        bestTarget = tp;
      }
    }
  }

  return { sourcePort: bestSource, targetPort: bestTarget };
}

export function makeMarkerPort(markerId: string): string {
  return `${MARKER_PORT_PREFIX}${markerId}`;
}

export function isMarkerPort(portId?: string | null): boolean {
  return Boolean(portId?.startsWith(MARKER_PORT_PREFIX));
}

/** A short, human-readable endpoint name for relation inspectors and map links. */
export function getRelationEndpointLabel(node: LivingNode, portId?: string): string {
  const data = node.data || {};
  const rawName = data.title || data.label || data.text || data.content;
  const nodeName = typeof rawName === 'string' && rawName.trim()
    ? rawName.replace(/\s+/g, ' ').trim().slice(0, 64)
    : node.type === 'map' ? 'Living map' : `${node.type} element`;

  if (node.type !== 'map' || !isMarkerPort(portId)) return nodeName;
  const markerId = portId!.slice(MARKER_PORT_PREFIX.length);
  const markers = Array.isArray(data.markers) ? data.markers : [];
  const marker = markers.find((candidate: any) => candidate?.id === markerId) as { label?: unknown } | undefined;
  const markerLabel = typeof marker?.label === 'string' && marker.label.trim()
    ? marker.label.replace(/\s+/g, ' ').trim().slice(0, 64)
    : markerId;
  return `${nodeName} / ${markerLabel}`;
}

export function resolveRelationPorts(
  source: LivingNode,
  target: LivingNode,
  explicitSourcePort?: string,
  explicitTargetPort?: string
): { sourcePort: PortPoint; targetPort: PortPoint } {
  const sourceMarkerPort = getMapMarkerPort(source, explicitSourcePort);
  const targetMarkerPort = getMapMarkerPort(target, explicitTargetPort);

  if (sourceMarkerPort && targetMarkerPort) {
    return { sourcePort: sourceMarkerPort, targetPort: targetMarkerPort };
  }

  if (sourceMarkerPort) {
    return {
      sourcePort: sourceMarkerPort,
      targetPort: getBestNodePortToward(target, sourceMarkerPort, explicitTargetPort),
    };
  }

  if (targetMarkerPort) {
    return {
      sourcePort: getBestNodePortToward(source, targetMarkerPort, explicitSourcePort),
      targetPort: targetMarkerPort,
    };
  }

  return getBestNodePorts(
    source,
    target,
    asPortPosition(explicitSourcePort),
    asPortPosition(explicitTargetPort)
  );
}

function getBestNodePorts(
  source: LivingNode,
  target: LivingNode,
  explicitSourcePort?: PortPosition,
  explicitTargetPort?: PortPosition
): { sourcePort: PortPoint; targetPort: PortPoint } {
  const sourceCenter = getNodeCenter(source);
  const targetCenter = getNodeCenter(target);
  const sourcePorts = getNodePortsForNode(source, targetCenter);
  const targetPorts = getNodePortsForNode(target, sourceCenter);

  if (explicitSourcePort && explicitTargetPort) {
    return {
      sourcePort: sourcePorts[explicitSourcePort],
      targetPort: targetPorts[explicitTargetPort],
    };
  }

  const outerPositions: PortPosition[] = ['top', 'right', 'bottom', 'left'];
  let minDistance = Infinity;
  let bestSource = sourcePorts.center;
  let bestTarget = targetPorts.center;

  const validSourcePorts = explicitSourcePort ? [explicitSourcePort] : outerPositions;
  const validTargetPorts = explicitTargetPort ? [explicitTargetPort] : outerPositions;

  for (const sPos of validSourcePorts) {
    for (const tPos of validTargetPorts) {
      const sp = sourcePorts[sPos];
      const tp = targetPorts[tPos];
      const dist = Math.hypot(tp.x - sp.x, tp.y - sp.y);
      if (dist < minDistance) {
        minDistance = dist;
        bestSource = sp;
        bestTarget = tp;
      }
    }
  }

  return { sourcePort: bestSource, targetPort: bestTarget };
}

function getBestNodePortToward(node: LivingNode, target: Point, explicitPort?: string): PortPoint {
  const port = asPortPosition(explicitPort);
  if (port) return getNodePortsForNode(node, target)[port];

  const ports = getNodePortsForNode(node, target);
  const outerPositions: PortPosition[] = ['top', 'right', 'bottom', 'left'];
  return outerPositions
    .map((portPosition) => ports[portPosition])
    .reduce((best, candidate) => (
      Math.hypot(candidate.x - target.x, candidate.y - target.y) < Math.hypot(best.x - target.x, best.y - target.y)
        ? candidate
        : best
    ));
}

function getNodeCenter(node: LivingNode): Point {
  return {
    x: node.position.x + node.size.width / 2,
    y: node.position.y + node.size.height / 2,
  };
}

function getNodePortsForNode(node: LivingNode, toward?: Point): Record<PortPosition, PortPoint> {
  const ports = getNodePorts(node.position, node.size);
  if (node.type !== 'shape') return ports;

  const shape = typeof node.data?.shape === 'string' ? node.data.shape : 'rectangle';
  if (shape === 'rectangle') return ports;

  const center = ports.center;
  const directionTarget = toward || center;
  return {
    ...ports,
    top: getShapeBoundaryPort(node, 'top', { x: center.x, y: center.y - 1 }),
    right: getShapeBoundaryPort(node, 'right', { x: center.x + 1, y: center.y }),
    bottom: getShapeBoundaryPort(node, 'bottom', { x: center.x, y: center.y + 1 }),
    left: getShapeBoundaryPort(node, 'left', { x: center.x - 1, y: center.y }),
    center: {
      ...center,
      position: 'center',
      ...(shape === 'circle' ? projectEllipseBoundary(node, directionTarget) : {}),
    },
  };
}

function getShapeBoundaryPort(node: LivingNode, position: Exclude<PortPosition, 'center'>, target: Point): PortPoint {
  const shape = typeof node.data?.shape === 'string' ? node.data.shape : 'rectangle';
  const center = getNodeCenter(node);

  if (shape === 'circle') {
    return { ...projectEllipseBoundary(node, target), position };
  }

  const polygon = getShapePolygon(node, shape);
  const point = intersectRayWithPolygon(center, target, polygon) || getNodePorts(node.position, node.size)[position];
  return { ...point, position };
}

function projectEllipseBoundary(node: LivingNode, target: Point): Point {
  const center = getNodeCenter(node);
  const rx = Math.max(1, node.size.width / 2);
  const ry = Math.max(1, node.size.height / 2);
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const scale = 1 / Math.max(0.0001, Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)));
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
}

function getShapePolygon(node: LivingNode, shape: string): Point[] {
  const x = node.position.x;
  const y = node.position.y;
  const w = node.size.width;
  const h = node.size.height;
  const cx = x + w / 2;
  const cy = y + h / 2;

  if (shape === 'diamond') {
    return [
      { x: cx, y },
      { x: x + w, y: cy },
      { x: cx, y: y + h },
      { x, y: cy },
    ];
  }

  if (shape === 'triangle') {
    return [
      { x: cx, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  }

  if (shape === 'hexagon') {
    const inset = w / 4;
    return [
      { x: x + inset, y },
      { x: x + w - inset, y },
      { x: x + w, y: cy },
      { x: x + w - inset, y: y + h },
      { x: x + inset, y: y + h },
      { x, y: cy },
    ];
  }

  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

function intersectRayWithPolygon(origin: Point, target: Point, polygon: Point[]): Point | null {
  const rayEnd = {
    x: origin.x + (target.x - origin.x) * 10000,
    y: origin.y + (target.y - origin.y) * 10000,
  };
  let best: { point: Point; distance: number } | null = null;

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const point = lineSegmentIntersection(origin, rayEnd, a, b);
    if (!point) continue;
    const hitDistance = distance(origin, point);
    if (hitDistance > 0.001 && (!best || hitDistance < best.distance)) {
      best = { point, distance: hitDistance };
    }
  }

  return best?.point || null;
}

function lineSegmentIntersection(a: Point, b: Point, c: Point, d: Point): Point | null {
  const bax = b.x - a.x;
  const bay = b.y - a.y;
  const dcx = d.x - c.x;
  const dcy = d.y - c.y;
  const denominator = bax * dcy - bay * dcx;
  if (Math.abs(denominator) < 0.0001) return null;

  const cax = c.x - a.x;
  const cay = c.y - a.y;
  const t = (cax * dcy - cay * dcx) / denominator;
  const u = (cax * bay - cay * bax) / denominator;
  if (t < 0 || u < 0 || u > 1) return null;

  return {
    x: a.x + t * bax,
    y: a.y + t * bay,
  };
}

function asPortPosition(portId?: string): PortPosition | undefined {
  return portId === 'top' || portId === 'right' || portId === 'bottom' || portId === 'left' || portId === 'center'
    ? portId
    : undefined;
}

function getMapMarkerPort(node: LivingNode, portId?: string): PortPoint | null {
  if (node.type !== 'map' || !isMarkerPort(portId)) return null;

  const markerId = portId?.slice(MARKER_PORT_PREFIX.length);
  const markers = Array.isArray(node.data.markers) ? node.data.markers : [];
  const marker = markers.find((candidate: any) => candidate.id === markerId);
  const markerPosition = toLatLngTuple(marker?.position);
  if (!markerPosition) return null;

  const measuredAnchor = getMeasuredMarkerAnchor(node, markerId);
  if (measuredAnchor?.visible) {
    return {
      x: node.position.x + measuredAnchor.x,
      y: node.position.y + measuredAnchor.y,
      position: 'center',
    };
  }

  const center = toLatLngTuple(node.data.center) || [20, 0];
  const zoom = typeof node.data.zoom === 'number' ? node.data.zoom : 4;
  const contentWidth = Math.max(1, node.size.width - MAP_CONTENT_PADDING * 2);
  const contentHeight = Math.max(1, node.size.height - MAP_CONTENT_PADDING * 2);
  const centerWorld = projectLatLng(center, zoom);
  const markerWorld = projectLatLng(markerPosition, zoom);
  const rawX = node.position.x + MAP_CONTENT_PADDING + contentWidth / 2 + (markerWorld.x - centerWorld.x);
  const rawY = node.position.y + MAP_CONTENT_PADDING + contentHeight / 2 + (markerWorld.y - centerWorld.y);

  return {
    x: clamp(rawX, node.position.x + MAP_CONTENT_PADDING, node.position.x + node.size.width - MAP_CONTENT_PADDING),
    y: clamp(rawY, node.position.y + MAP_CONTENT_PADDING, node.position.y + node.size.height - MAP_CONTENT_PADDING),
    position: 'center',
  };
}

function getMeasuredMarkerAnchor(node: LivingNode, markerId?: string): { x: number; y: number; visible: boolean } | null {
  if (!markerId || typeof node.data.markerAnchors !== 'object' || !node.data.markerAnchors) return null;
  const anchor = (node.data.markerAnchors as Record<string, unknown>)[markerId] as Record<string, unknown> | undefined;
  return typeof anchor?.x === 'number' && typeof anchor?.y === 'number' && typeof anchor?.visible === 'boolean'
    ? { x: anchor.x, y: anchor.y, visible: anchor.visible }
    : null;
}

function toLatLngTuple(value: unknown): [number, number] | null {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number'
    ? [value[0], value[1]]
    : null;
}

function projectLatLng(position: [number, number], zoom: number): Point {
  const [lat, lng] = position;
  const sin = Math.sin((clamp(lat, -85.05112878, 85.05112878) * Math.PI) / 180);
  const scale = 256 * Math.pow(2, zoom);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface PathResult {
  pathD: string;
  midPoint: Point;
  angle: number;
}

export interface NodeBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Generates SVG path data and midpoint for straight, curved, or orthogonal connections
 */
export function generateRelationPath(
  source: PortPoint,
  target: PortPoint,
  type: 'straight' | 'curved' | 'orthogonal' = 'straight'
): PathResult {
  const sx = source.x;
  const sy = source.y;
  const tx = target.x;
  const ty = target.y;

  if (type === 'straight') {
    const midPoint = { x: (sx + tx) / 2, y: (sy + ty) / 2 };
    const angle = Math.atan2(ty - sy, tx - sx) * (180 / Math.PI);
    return {
      pathD: `M ${sx} ${sy} L ${tx} ${ty}`,
      midPoint,
      angle
    };
  }

  if (type === 'curved') {
    const dist = Math.hypot(tx - sx, ty - sy);
    const curveOffset = Math.min(150, Math.max(40, dist * 0.4));

    let cp1x = sx;
    let cp1y = sy;
    let cp2x = tx;
    let cp2y = ty;

    // Normal vectors based on source port position
    if (source.position === 'top') cp1y -= curveOffset;
    else if (source.position === 'bottom') cp1y += curveOffset;
    else if (source.position === 'left') cp1x -= curveOffset;
    else if (source.position === 'right') cp1x += curveOffset;
    else cp1y -= curveOffset;

    // Normal vectors based on target port position
    if (target.position === 'top') cp2y -= curveOffset;
    else if (target.position === 'bottom') cp2y += curveOffset;
    else if (target.position === 'left') cp2x -= curveOffset;
    else if (target.position === 'right') cp2x += curveOffset;
    else cp2y += curveOffset;

    // Midpoint for cubic bezier: B(0.5) = 0.125*P0 + 0.375*P1 + 0.375*P2 + 0.125*P3
    const mx = 0.125 * sx + 0.375 * cp1x + 0.375 * cp2x + 0.125 * tx;
    const my = 0.125 * sy + 0.375 * cp1y + 0.375 * cp2y + 0.125 * ty;

    return {
      pathD: `M ${sx} ${sy} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${tx} ${ty}`,
      midPoint: { x: mx, y: my },
      angle: 0
    };
  }

  // Orthogonal (Step Path)
  const isHorizontal = Math.abs(tx - sx) > Math.abs(ty - sy);
  let pathD = '';
  let mx = (sx + tx) / 2;
  let my = (sy + ty) / 2;

  if (source.position === 'left' || source.position === 'right') {
    const midX = (sx + tx) / 2;
    pathD = `M ${sx} ${sy} H ${midX} V ${ty} H ${tx}`;
    mx = midX;
    my = (sy + ty) / 2;
  } else if (source.position === 'top' || source.position === 'bottom') {
    const midY = (sy + ty) / 2;
    pathD = `M ${sx} ${sy} V ${midY} H ${tx} V ${ty}`;
    mx = (sx + tx) / 2;
    my = midY;
  } else if (isHorizontal) {
    const midX = (sx + tx) / 2;
    pathD = `M ${sx} ${sy} H ${midX} V ${ty} H ${tx}`;
    mx = midX;
  } else {
    const midY = (sy + ty) / 2;
    pathD = `M ${sx} ${sy} V ${midY} H ${tx} V ${ty}`;
    my = midY;
  }

  return {
    pathD,
    midPoint: { x: mx, y: my },
    angle: 0
  };
}

export function generateSmartRelationPath(
  source: PortPoint,
  target: PortPoint,
  sourceBounds: NodeBounds,
  targetBounds: NodeBounds,
  allBounds: NodeBounds[]
): PathResult {
  const padding = 34;
  const stub = 28;
  const sStub = pushFromPort(source, stub);
  const tStub = pushFromPort(target, stub);

  // Expand all node bounds by padding for clearance
  const bounds = allBounds.map((bound) => expandBounds(bound, padding));

  // Only consider intermediate obstacles (not source/target themselves)
  const obstacles = bounds.filter(
    (b) => b.id !== sourceBounds.id && b.id !== targetBounds.id
  );

  const combined = getCombinedBounds([sourceBounds, targetBounds, ...allBounds], padding);
  const midX = (sStub.x + tStub.x) / 2;
  const midY = (sStub.y + tStub.y) / 2;

  // --- Base candidates (original 6) ---
  const candidates: Point[][] = [
    // Direct mid-X split
    [source, sStub, { x: midX, y: sStub.y }, { x: midX, y: tStub.y }, tStub, target],
    // Direct mid-Y split
    [source, sStub, { x: sStub.x, y: midY }, { x: tStub.x, y: midY }, tStub, target],
    // Go around top
    [source, sStub, { x: sStub.x, y: combined.top }, { x: tStub.x, y: combined.top }, tStub, target],
    // Go around bottom
    [source, sStub, { x: sStub.x, y: combined.bottom }, { x: tStub.x, y: combined.bottom }, tStub, target],
    // Go around left
    [source, sStub, { x: combined.left, y: sStub.y }, { x: combined.left, y: tStub.y }, tStub, target],
    // Go around right
    [source, sStub, { x: combined.right, y: sStub.y }, { x: combined.right, y: tStub.y }, tStub, target],
  ];

  // --- Per-obstacle bypass candidates ---
  // For each obstacle between source and target, generate routes that go around it
  for (const obs of obstacles) {
    const oLeft = obs.x;
    const oRight = obs.x + obs.width;
    const oTop = obs.y;
    const oBottom = obs.y + obs.height;

    // Route over the obstacle (top bypass)
    candidates.push(
      [source, sStub, { x: sStub.x, y: oTop }, { x: tStub.x, y: oTop }, tStub, target],
    );
    // Route under the obstacle (bottom bypass)
    candidates.push(
      [source, sStub, { x: sStub.x, y: oBottom }, { x: tStub.x, y: oBottom }, tStub, target],
    );
    // Route left of obstacle
    candidates.push(
      [source, sStub, { x: oLeft, y: sStub.y }, { x: oLeft, y: tStub.y }, tStub, target],
    );
    // Route right of obstacle
    candidates.push(
      [source, sStub, { x: oRight, y: sStub.y }, { x: oRight, y: tStub.y }, tStub, target],
    );

    // L-shape bypasses: go to obstacle corner then to target stub
    candidates.push(
      [source, sStub, { x: oLeft, y: sStub.y }, { x: oLeft, y: oTop }, { x: tStub.x, y: oTop }, tStub, target],
      [source, sStub, { x: oRight, y: sStub.y }, { x: oRight, y: oTop }, { x: tStub.x, y: oTop }, tStub, target],
      [source, sStub, { x: oLeft, y: sStub.y }, { x: oLeft, y: oBottom }, { x: tStub.x, y: oBottom }, tStub, target],
      [source, sStub, { x: oRight, y: sStub.y }, { x: oRight, y: oBottom }, { x: tStub.x, y: oBottom }, tStub, target],
    );
  }

  // Clean up duplicate consecutive points
  const cleanedCandidates = candidates.map(removeDuplicatePoints);

  const best = cleanedCandidates.reduce((winner, candidate) => (
    scorePolyline(candidate, bounds, sourceBounds.id, targetBounds.id) < scorePolyline(winner, bounds, sourceBounds.id, targetBounds.id)
      ? candidate
      : winner
  ));

  const routed = polylineHitsObstacles(best, obstacles)
    ? routeOrthogonalAroundObstacles(source, sStub, tStub, target, obstacles, combined)
    : null;
  const finalPoints = routed || best;

  return {
    pathD: roundedPolylinePath(finalPoints, 14),
    midPoint: pointAtHalfLength(finalPoints),
    angle: 0
  };
}

function pushFromPort(port: PortPoint, distance: number): Point {
  switch (port.position) {
    case 'top':
      return { x: port.x, y: port.y - distance };
    case 'right':
      return { x: port.x + distance, y: port.y };
    case 'bottom':
      return { x: port.x, y: port.y + distance };
    case 'left':
      return { x: port.x - distance, y: port.y };
    default:
      return { x: port.x, y: port.y };
  }
}

function expandBounds(bounds: NodeBounds, padding: number): NodeBounds {
  return {
    ...bounds,
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

function getCombinedBounds(bounds: NodeBounds[], padding: number) {
  const left = Math.min(...bounds.map((bound) => bound.x)) - padding;
  const right = Math.max(...bounds.map((bound) => bound.x + bound.width)) + padding;
  const top = Math.min(...bounds.map((bound) => bound.y)) - padding;
  const bottom = Math.max(...bounds.map((bound) => bound.y + bound.height)) + padding;
  return { left, right, top, bottom };
}

function routeOrthogonalAroundObstacles(
  source: Point,
  sourceStub: Point,
  targetStub: Point,
  target: Point,
  obstacles: NodeBounds[],
  combined: { left: number; right: number; top: number; bottom: number }
): Point[] | null {
  const looseEnvelope = {
    x: Math.min(sourceStub.x, targetStub.x) - 720,
    y: Math.min(sourceStub.y, targetStub.y) - 520,
    width: Math.abs(targetStub.x - sourceStub.x) + 1440,
    height: Math.abs(targetStub.y - sourceStub.y) + 1040,
  };
  const relevantObstacles = obstacles.filter((obstacle) => boundsOverlap(looseEnvelope, obstacle));
  const lanePad = 12;
  const xLanes = new Set<number>([
    sourceStub.x,
    targetStub.x,
    (sourceStub.x + targetStub.x) / 2,
    combined.left,
    combined.right,
  ]);
  const yLanes = new Set<number>([
    sourceStub.y,
    targetStub.y,
    (sourceStub.y + targetStub.y) / 2,
    combined.top,
    combined.bottom,
  ]);

  relevantObstacles.forEach((obstacle) => {
    xLanes.add(obstacle.x - lanePad);
    xLanes.add(obstacle.x + obstacle.width + lanePad);
    yLanes.add(obstacle.y - lanePad);
    yLanes.add(obstacle.y + obstacle.height + lanePad);
  });

  const sortedXs = trimLanes([...xLanes], sourceStub.x, targetStub.x, 70);
  const sortedYs = trimLanes([...yLanes], sourceStub.y, targetStub.y, 70);
  const points: Point[] = [];
  const keyToIndex = new Map<string, number>();

  const addPoint = (point: Point) => {
    const normalized = { x: roundLane(point.x), y: roundLane(point.y) };
    const key = pointKey(normalized);
    if (keyToIndex.has(key)) return keyToIndex.get(key)!;
    if (pointInsideAnyBounds(normalized, relevantObstacles)) return -1;
    const index = points.length;
    keyToIndex.set(key, index);
    points.push(normalized);
    return index;
  };

  const startIndex = addPoint(sourceStub);
  const endIndex = addPoint(targetStub);
  if (startIndex < 0 || endIndex < 0) return null;

  sortedXs.forEach((x) => {
    sortedYs.forEach((y) => addPoint({ x, y }));
  });

  const graph = new Map<number, Array<{ to: number; weight: number }>>();
  const connect = (from: number, to: number) => {
    const a = points[from];
    const b = points[to];
    if (segmentIntersectsAnyBounds(a, b, relevantObstacles)) return;
    const weight = distance(a, b);
    graph.set(from, [...(graph.get(from) || []), { to, weight }]);
    graph.set(to, [...(graph.get(to) || []), { to: from, weight }]);
  };

  const pointsByX = new Map<number, number[]>();
  const pointsByY = new Map<number, number[]>();
  points.forEach((point, index) => {
    const x = roundLane(point.x);
    const y = roundLane(point.y);
    pointsByX.set(x, [...(pointsByX.get(x) || []), index]);
    pointsByY.set(y, [...(pointsByY.get(y) || []), index]);
  });

  pointsByX.forEach((indexes) => {
    indexes.sort((a, b) => points[a].y - points[b].y);
    for (let i = 1; i < indexes.length; i++) connect(indexes[i - 1], indexes[i]);
  });
  pointsByY.forEach((indexes) => {
    indexes.sort((a, b) => points[a].x - points[b].x);
    for (let i = 1; i < indexes.length; i++) connect(indexes[i - 1], indexes[i]);
  });

  const routeIndexes = shortestPath(graph, startIndex, endIndex);
  if (!routeIndexes) return null;

  const routePoints = simplifyPolyline(routeIndexes.map((index) => points[index]));
  const candidate = removeDuplicatePoints([source, ...routePoints, target]);
  return polylineHitsObstacles(candidate, relevantObstacles) ? null : candidate;
}

function trimLanes(lanes: number[], start: number, end: number, maxLanes: number): number[] {
  const center = (start + end) / 2;
  const mandatory = new Set([roundLane(start), roundLane(end), roundLane(center)]);
  const unique = [...new Set(lanes.map(roundLane))].sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
  const trimmed = unique.slice(0, maxLanes);
  mandatory.forEach((lane) => {
    if (!trimmed.includes(lane)) trimmed.push(lane);
  });
  return trimmed.sort((a, b) => a - b);
}

function shortestPath(graph: Map<number, Array<{ to: number; weight: number }>>, start: number, end: number): number[] | null {
  const dist = new Map<number, number>([[start, 0]]);
  const prev = new Map<number, number>();
  const visited = new Set<number>();
  const queue = new Set<number>([start]);

  while (queue.size > 0) {
    let current = -1;
    let bestDistance = Infinity;
    queue.forEach((candidate) => {
      const candidateDistance = dist.get(candidate) ?? Infinity;
      if (candidateDistance < bestDistance) {
        bestDistance = candidateDistance;
        current = candidate;
      }
    });

    if (current === -1) break;
    if (current === end) break;
    queue.delete(current);
    visited.add(current);

    (graph.get(current) || []).forEach((edge) => {
      if (visited.has(edge.to)) return;
      const nextDistance = bestDistance + edge.weight;
      if (nextDistance < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nextDistance);
        prev.set(edge.to, current);
        queue.add(edge.to);
      }
    });
  }

  if (!dist.has(end)) return null;
  const path = [end];
  let cursor = end;
  while (cursor !== start) {
    const previous = prev.get(cursor);
    if (previous === undefined) return null;
    path.unshift(previous);
    cursor = previous;
  }
  return path;
}

function simplifyPolyline(points: Point[]): Point[] {
  const deduped = removeDuplicatePoints(points);
  if (deduped.length <= 2) return deduped;
  const simplified: Point[] = [deduped[0]];

  for (let i = 1; i < deduped.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const current = deduped[i];
    const next = deduped[i + 1];
    const sameHorizontal = Math.abs(prev.y - current.y) < 0.01 && Math.abs(current.y - next.y) < 0.01;
    const sameVertical = Math.abs(prev.x - current.x) < 0.01 && Math.abs(current.x - next.x) < 0.01;
    if (!sameHorizontal && !sameVertical) simplified.push(current);
  }

  simplified.push(deduped[deduped.length - 1]);
  return simplified;
}

function polylineHitsObstacles(points: Point[], obstacles: NodeBounds[]): boolean {
  for (let i = 1; i < points.length; i++) {
    if (segmentIntersectsAnyBounds(points[i - 1], points[i], obstacles)) return true;
  }
  return false;
}

function segmentIntersectsAnyBounds(start: Point, end: Point, bounds: NodeBounds[]): boolean {
  return bounds.some((bound) => segmentIntersectsBounds(start, end, bound));
}

function pointInsideAnyBounds(point: Point, bounds: NodeBounds[]): boolean {
  return bounds.some((bound) => (
    point.x > bound.x &&
    point.x < bound.x + bound.width &&
    point.y > bound.y &&
    point.y < bound.y + bound.height
  ));
}

function boundsOverlap(a: Pick<NodeBounds, 'x' | 'y' | 'width' | 'height'>, b: Pick<NodeBounds, 'x' | 'y' | 'width' | 'height'>): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

function pointKey(point: Point): string {
  return `${roundLane(point.x)},${roundLane(point.y)}`;
}

function roundLane(value: number): number {
  return Math.round(value * 100) / 100;
}

function removeDuplicatePoints(points: Point[]): Point[] {
  return points.filter((point, index) => (
    index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y
  ));
}

function scorePolyline(points: Point[], bounds: NodeBounds[], sourceId: string, targetId: string): number {
  let score = 0;
  let bends = 0;

  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1];
    const end = points[i];
    const segLen = Math.hypot(end.x - start.x, end.y - start.y);
    
    // Path length cost (prefer shorter paths)
    score += segLen;
    
    // Bend penalty (each turn adds cost, prefer simpler routes)
    if (i >= 2) {
      const prev = points[i - 2];
      const dx1 = start.x - prev.x;
      const dy1 = start.y - prev.y;
      const dx2 = end.x - start.x;
      const dy2 = end.y - start.y;
      // If direction changed, it's a bend
      if (Math.abs(dx1 * dy2 - dy1 * dx2) > 0.01) {
        bends++;
      }
    }

    for (const bound of bounds) {
      const isEndpointNode = bound.id === sourceId || bound.id === targetId;
      // Skip collision check for first/last segment with their own node
      if (isEndpointNode && (i === 1 || i === points.length - 1)) continue;
      if (segmentIntersectsBounds(start, end, bound)) {
        // Massive penalty for crossing through any node
        score += isEndpointNode ? 80000 : 50000;
      }
    }
  }
  
  // Small penalty per bend to prefer cleaner routes
  score += bends * 30;

  return score;
}

function segmentIntersectsBounds(start: Point, end: Point, bounds: NodeBounds): boolean {
  const left = bounds.x;
  const right = bounds.x + bounds.width;
  const top = bounds.y;
  const bottom = bounds.y + bounds.height;
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);

  if (maxX < left || minX > right || maxY < top || minY > bottom) return false;
  if (start.x === end.x) return start.x >= left && start.x <= right;
  if (start.y === end.y) return start.y >= top && start.y <= bottom;
  return lineIntersectsRect(start, end, left, top, right, bottom);
}

function lineIntersectsRect(start: Point, end: Point, left: number, top: number, right: number, bottom: number): boolean {
  return (
    linesIntersect(start, end, { x: left, y: top }, { x: right, y: top }) ||
    linesIntersect(start, end, { x: right, y: top }, { x: right, y: bottom }) ||
    linesIntersect(start, end, { x: right, y: bottom }, { x: left, y: bottom }) ||
    linesIntersect(start, end, { x: left, y: bottom }, { x: left, y: top })
  );
}

function linesIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const direction = (p1: Point, p2: Point, p3: Point) =>
    (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);

  const d1 = direction(c, d, a);
  const d2 = direction(c, d, b);
  const d3 = direction(a, b, c);
  const d4 = direction(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function roundedPolylinePath(points: Point[], radius: number): string {
  if (points.length < 2) return '';
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const current = points[i];
    const next = points[i + 1];
    const before = moveToward(current, prev, Math.min(radius, distance(current, prev) / 2));
    const after = moveToward(current, next, Math.min(radius, distance(current, next) / 2));
    path += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`;
  }

  const last = points[points.length - 1];
  return `${path} L ${last.x} ${last.y}`;
}

function moveToward(from: Point, to: Point, amount: number): Point {
  const length = distance(from, to);
  if (length === 0) return from;
  return {
    x: from.x + ((to.x - from.x) / length) * amount,
    y: from.y + ((to.y - from.y) / length) * amount,
  };
}

function pointAtHalfLength(points: Point[]): Point {
  const total = points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point), 0);
  let traveled = 0;
  for (let i = 1; i < points.length; i++) {
    const segmentLength = distance(points[i - 1], points[i]);
    if (traveled + segmentLength >= total / 2) {
      const ratio = (total / 2 - traveled) / Math.max(1, segmentLength);
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * ratio,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * ratio,
      };
    }
    traveled += segmentLength;
  }
  return points[Math.floor(points.length / 2)];
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
