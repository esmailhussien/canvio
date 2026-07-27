import { getStroke } from 'perfect-freehand';
import { LivingNode, Relation, useCanvasStore } from '../store/canvasStore';
import { generateRelationPath, generateSmartRelationPath, NodeBounds, resolveRelationPorts } from '../components/RelationRenderer/relationUtils';

type CanvasContext = CanvasRenderingContext2D;
const MAP_CONTENT_PADDING = 16;

function safeName(value: string) {
  return (value || 'canvas').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'canvas';
}

function resolveCanvasColor(value: unknown, fallback: string) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const color = value.trim();
  const cssVar = color.match(/^var\((--[^),\s]+)(?:,\s*([^)]+))?\)$/);
  if (cssVar && typeof window !== 'undefined') {
    const resolved = window.getComputedStyle(document.documentElement).getPropertyValue(cssVar[1]).trim();
    return resolved || cssVar[2]?.trim() || fallback;
  }
  if (color.includes('color-mix(')) return fallback;
  return color;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function wrapText(ctx: CanvasContext, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 6) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  let lineCount = 0;

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
      lineCount += 1;
      if (lineCount >= maxLines - 1) break;
    } else {
      line = nextLine;
    }
  }

  if (line && lineCount < maxLines) {
    ctx.fillText(line, x, y);
  }
}

function roundedRect(ctx: CanvasContext, x: number, y: number, width: number, height: number, radius: number) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawCard(
  ctx: CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string | CanvasGradient | CanvasPattern,
  stroke = 'rgba(255,255,255,0.16)'
) {
  ctx.beginPath();
  roundedRect(ctx, x, y, width, height, 10);
  ctx.fillStyle = typeof fill === 'string' ? resolveCanvasColor(fill, 'rgba(255,255,255,0.04)') : fill;
  ctx.fill();
  ctx.strokeStyle = resolveCanvasColor(stroke, 'rgba(148,163,184,0.35)');
  ctx.lineWidth = 1;
  ctx.stroke();
}

function isLightColor(color: string) {
  const match = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return false;
  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 170;
}

function drawShape(ctx: CanvasContext, node: LivingNode, x: number, y: number, textColor: string) {
  const data = node.data || {};
  const shape = data.shape as string || 'rectangle';
  const width = node.size.width;
  const height = node.size.height;
  const strokeWidth = typeof data.strokeWidth === 'number' ? data.strokeWidth : 2;
  const pad = strokeWidth / 2;

  ctx.save();
  ctx.globalAlpha = typeof data.opacity === 'number' ? data.opacity : 1;
  ctx.fillStyle = resolveCanvasColor(data.fill, 'rgba(99, 102, 241, 0.15)');
  ctx.strokeStyle = resolveCanvasColor(data.stroke, '#6366f1');
  ctx.lineWidth = strokeWidth;
  ctx.beginPath();

  if (shape === 'circle') {
    ctx.ellipse(x + width / 2, y + height / 2, Math.max(0, width / 2 - pad), Math.max(0, height / 2 - pad), 0, 0, Math.PI * 2);
  } else if (shape === 'diamond') {
    ctx.moveTo(x + width / 2, y + pad);
    ctx.lineTo(x + width - pad, y + height / 2);
    ctx.lineTo(x + width / 2, y + height - pad);
    ctx.lineTo(x + pad, y + height / 2);
    ctx.closePath();
  } else if (shape === 'triangle') {
    ctx.moveTo(x + width / 2, y + pad);
    ctx.lineTo(x + width - pad, y + height - pad);
    ctx.lineTo(x + pad, y + height - pad);
    ctx.closePath();
  } else if (shape === 'hexagon') {
    const inset = width / 4;
    ctx.moveTo(x + inset, y + pad);
    ctx.lineTo(x + width - inset, y + pad);
    ctx.lineTo(x + width - pad, y + height / 2);
    ctx.lineTo(x + width - inset, y + height - pad);
    ctx.lineTo(x + inset, y + height - pad);
    ctx.lineTo(x + pad, y + height / 2);
    ctx.closePath();
  } else {
    roundedRect(ctx, x + pad, y + pad, width - strokeWidth, height - strokeWidth, 8);
  }

  ctx.fill();
  ctx.stroke();

  const label = typeof data.label === 'string' ? data.label : '';
  if (label) {
    ctx.fillStyle = textColor;
    ctx.font = '600 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrapText(ctx, label, x + width / 2, y + height / 2, width - 24, 18, 3);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  ctx.restore();
}

type ExportPoint = [number, number];

function getDistance(a: ExportPoint, b: ExportPoint) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function filterClosePoints(points: ExportPoint[], minDistance = 8) {
  if (points.length <= 2) return points;

  const filtered = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    if (getDistance(points[index], filtered[filtered.length - 1]) >= minDistance) {
      filtered.push(points[index]);
    }
  }
  filtered.push(points[points.length - 1]);
  return filtered;
}

function getPerpendicularDistance(point: ExportPoint, lineStart: ExportPoint, lineEnd: ExportPoint) {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  if (dx === 0 && dy === 0) return getDistance(point, lineStart);
  return Math.abs(dy * point[0] - dx * point[1] + lineEnd[0] * lineStart[1] - lineEnd[1] * lineStart[0]) / Math.hypot(dx, dy);
}

function simplifyPoints(points: ExportPoint[], tolerance = 10): ExportPoint[] {
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

function getArrowRenderPoints(points: ExportPoint[]) {
  const filtered = filterClosePoints(points, 8);
  const simplified = simplifyPoints(filtered, 10);
  return simplified.length >= 2 ? simplified : filtered;
}

function drawSmoothArrowPath(ctx: CanvasContext, points: ExportPoint[]) {
  if (points.length === 0) return;

  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);

  if (points.length === 2) {
    ctx.lineTo(points[1][0], points[1][1]);
    return;
  }

  const tension = 0.18;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] || points[index];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[index + 2] || next;
    const cp1x = current[0] + (next[0] - previous[0]) * tension;
    const cp1y = current[1] + (next[1] - previous[1]) * tension;
    const cp2x = next[0] - (afterNext[0] - current[0]) * tension;
    const cp2y = next[1] - (afterNext[1] - current[1]) * tension;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, next[0], next[1]);
  }
}

function drawDrawing(ctx: CanvasContext, node: LivingNode, x: number, y: number) {
  const strokes = Array.isArray(node.data?.strokes) ? node.data.strokes : [];
  const arrow = node.data?.arrow as { start?: number[]; end?: number[]; points?: number[][]; color?: string; width?: number; opacity?: number } | undefined;

  if (arrow && Array.isArray(arrow.start) && Array.isArray(arrow.end)) {
    const rawPoints = Array.isArray(arrow.points) && arrow.points.length >= 2 ? arrow.points : [arrow.start, arrow.end];
    const points = rawPoints.map((point) => [x + Number(point[0] || 0), y + Number(point[1] || 0)] as ExportPoint);
    const renderPoints = getArrowRenderPoints(points);
    if (renderPoints.length < 2) return;

    const endX = renderPoints[renderPoints.length - 1][0];
    const endY = renderPoints[renderPoints.length - 1][1];
    const previousPoint = renderPoints.length > 1 ? renderPoints[renderPoints.length - 2] : renderPoints[0];
    const width = typeof arrow.width === 'number' ? arrow.width : 3;
    const color = resolveCanvasColor(arrow.color, '#6366f1');
    const angle = Math.atan2(endY - previousPoint[1], endX - previousPoint[0]);
    const headLength = Math.max(9, Math.min(18, width * 3.2));

    ctx.save();
    ctx.globalAlpha = typeof arrow.opacity === 'number' ? arrow.opacity : 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = resolveCanvasColor('var(--relation-casing)', 'rgba(10,10,15,0.78)');
    ctx.lineWidth = Math.max(6, width + 3.5);
    drawSmoothArrowPath(ctx, renderPoints);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    drawSmoothArrowPath(ctx, renderPoints);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  for (const stroke of strokes) {
    if (!stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) continue;

    const outline = getStroke(stroke.points, {
      size: typeof stroke.width === 'number' ? stroke.width : 3,
      thinning: 0.55,
      smoothing: 0.62,
      streamline: 0.5,
      simulatePressure: true,
    });

    if (outline.length === 0) continue;

    ctx.beginPath();
    outline.forEach(([px, py], index) => {
      if (index === 0) ctx.moveTo(x + px, y + py);
      else ctx.lineTo(x + px, y + py);
    });
    ctx.closePath();
    ctx.save();
    ctx.globalAlpha = typeof stroke.opacity === 'number' ? stroke.opacity : 1;
    ctx.fillStyle = resolveCanvasColor(stroke.color, '#f0f0f5');
    ctx.fill();
    ctx.restore();
  }
}

function drawFrame(ctx: CanvasContext, node: LivingNode, x: number, y: number) {
  const color = resolveCanvasColor(node.data?.color, '#6366f1');
  const fill = resolveCanvasColor(node.data?.fill, 'rgba(255,255,255,0.03)');
  const title = typeof node.data?.title === 'string' ? node.data.title : 'Frame';

  ctx.fillStyle = fill;
  ctx.fillRect(x, y, node.size.width, node.size.height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(x, y, node.size.width, node.size.height);
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.font = '700 13px Inter, system-ui, sans-serif';
  ctx.fillText(title, x + 10, y - 10);
}

function drawSticky(ctx: CanvasContext, node: LivingNode, x: number, y: number) {
  const colorMap: Record<string, string> = {
    yellow: '#fef08a',
    pink: '#fbcfe8',
    blue: '#bfdbfe',
    green: '#bbf7d0',
    purple: '#e9d5ff',
    orange: '#fed7aa',
  };
  const color = typeof node.data?.color === 'string' ? node.data.color : 'yellow';
  const text = typeof node.data?.text === 'string' ? node.data.text : '';
  const fontSize = typeof node.data?.fontSize === 'number' ? node.data.fontSize : 16;

  drawCard(ctx, x, y, node.size.width, node.size.height, colorMap[color] || '#fef08a', 'rgba(0,0,0,0.12)');
  ctx.fillStyle = '#1f2937';
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  wrapText(ctx, text, x + 16, y + 28, node.size.width - 32, fontSize * 1.35, Math.max(2, Math.floor((node.size.height - 32) / (fontSize * 1.35))));
}

function drawText(ctx: CanvasContext, node: LivingNode, x: number, y: number, textColor: string) {
  const content = typeof node.data?.content === 'string' ? node.data.content : '';
  const fontSize = typeof node.data?.fontSize === 'number' ? node.data.fontSize : 16;
  const fontWeight = node.data?.fontWeight === 'bold' ? '700' : '500';
  const color = resolveCanvasColor(node.data?.color, textColor);
  const align = node.data?.textAlign === 'center' || node.data?.textAlign === 'right' ? node.data.textAlign : 'left';

  ctx.fillStyle = color;
  ctx.font = `${fontWeight} ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = align;
  const textX = align === 'center' ? x + node.size.width / 2 : align === 'right' ? x + node.size.width : x;
  wrapText(ctx, content, textX, y + fontSize, node.size.width, fontSize * 1.35, Math.max(1, Math.floor(node.size.height / (fontSize * 1.35))));
  ctx.textAlign = 'left';
}

function drawCode(ctx: CanvasContext, node: LivingNode, x: number, y: number) {
  const filename = typeof node.data?.filename === 'string' ? node.data.filename : 'script.ts';
  const code = typeof node.data?.code === 'string' ? node.data.code : '';

  drawCard(ctx, x, y, node.size.width, node.size.height, '#111827', 'rgba(148,163,184,0.35)');
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x, y, node.size.width, 34);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '700 12px Inter, system-ui, sans-serif';
  ctx.fillText(filename, x + 14, y + 22);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px ui-monospace, SFMono-Regular, Consolas, monospace';
  code.split('\n').slice(0, Math.max(1, Math.floor((node.size.height - 52) / 16))).forEach((line, index) => {
    ctx.fillText(line.slice(0, 80), x + 14, y + 56 + index * 16);
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toLatLngTuple(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const lat = Number(value[0]);
  const lng = Number(value[1]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

function projectLatLng([lat, lng]: [number, number], zoom: number) {
  const scale = 256 * 2 ** zoom;
  const sinLat = Math.sin((clamp(lat, -85.05112878, 85.05112878) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function getMapMarkerAnchor(node: LivingNode, marker: Record<string, unknown>, center: [number, number], zoom: number) {
  const markerId = typeof marker.id === 'string' ? marker.id : '';
  const anchors = typeof node.data?.markerAnchors === 'object' && node.data.markerAnchors
    ? node.data.markerAnchors as Record<string, { x?: number; y?: number; visible?: boolean }>
    : {};
  const measured = markerId ? anchors[markerId] : null;
  if (measured?.visible && typeof measured.x === 'number' && typeof measured.y === 'number') {
    return {
      x: clamp(measured.x, MAP_CONTENT_PADDING, node.size.width - MAP_CONTENT_PADDING),
      y: clamp(measured.y, MAP_CONTENT_PADDING, node.size.height - MAP_CONTENT_PADDING),
    };
  }

  const position = toLatLngTuple(marker.position);
  if (!position) return null;

  const contentWidth = Math.max(1, node.size.width - MAP_CONTENT_PADDING * 2);
  const contentHeight = Math.max(1, node.size.height - MAP_CONTENT_PADDING * 2);
  const centerWorld = projectLatLng(center, zoom);
  const markerWorld = projectLatLng(position, zoom);

  return {
    x: clamp(MAP_CONTENT_PADDING + contentWidth / 2 + (markerWorld.x - centerWorld.x), MAP_CONTENT_PADDING, node.size.width - MAP_CONTENT_PADDING),
    y: clamp(MAP_CONTENT_PADDING + contentHeight / 2 + (markerWorld.y - centerWorld.y), MAP_CONTENT_PADDING, node.size.height - MAP_CONTENT_PADDING),
  };
}

function drawMapMarker(ctx: CanvasContext, x: number, y: number, label: string, color: string) {
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.35)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - 10, 10, 0, Math.PI * 2);
  ctx.moveTo(x - 7, y - 3);
  ctx.quadraticCurveTo(x, y + 12, x + 7, y - 3);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y - 10, 3.5, 0, Math.PI * 2);
  ctx.fill();

  if (label) {
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    const labelWidth = Math.min(160, ctx.measureText(label).width + 16);
    drawCard(ctx, x + 12, y - 23, labelWidth, 22, 'rgba(15,23,42,0.74)', 'rgba(255,255,255,0.18)');
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label.slice(0, 24), x + 20, y - 8);
  }
  ctx.restore();
}

async function drawMapNode(ctx: CanvasContext, node: LivingNode, x: number, y: number) {
  const center = Array.isArray(node.data?.center) ? node.data.center : [20, 0];
  const zoom = typeof node.data?.zoom === 'number' ? Math.round(node.data.zoom) : 4;
  const safeCenter = toLatLngTuple(center) || [20, 0];
  const tileLayerType = node.data?.tileLayer === 'hybrid' ? 'hybrid' : 'satellite';
  const urlTemplate = tileLayerType === 'hybrid'
    ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
    : 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';

  const width = node.size.width;
  const height = node.size.height;

  ctx.save();
  ctx.beginPath();
  roundedRect(ctx, x, y, width, height, 10);
  ctx.clip();

  // Dark slate base fill
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, width, height);

  // Web Mercator Tile Calculation
  const scale = 256 * (2 ** zoom);
  const lat = clamp(safeCenter[0], -85.05112878, 85.05112878);
  const lng = safeCenter[1];
  const sinLat = Math.sin((lat * Math.PI) / 180);

  const worldX = ((lng + 180) / 360) * scale;
  const worldY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;

  const originX = worldX - width / 2;
  const originY = worldY - height / 2;

  const minTileX = Math.floor(originX / 256);
  const maxTileX = Math.floor((originX + width) / 256);
  const minTileY = Math.floor(originY / 256);
  const maxTileY = Math.floor((originY + height) / 256);

  const tilePromises: Promise<{ img: HTMLImageElement | null; tx: number; ty: number }>[] = [];

  for (let tx = minTileX; tx <= maxTileX; tx += 1) {
    for (let ty = minTileY; ty <= maxTileY; ty += 1) {
      const tileUrl = urlTemplate
        .replace('{x}', String(tx))
        .replace('{y}', String(ty))
        .replace('{z}', String(zoom));
      tilePromises.push(
        loadImage(tileUrl).then((img) => ({ img, tx, ty }))
      );
    }
  }

  const loadedTiles = await Promise.all(tilePromises);
  for (const { img, tx, ty } of loadedTiles) {
    if (img) {
      const destX = x + (tx * 256 - originX);
      const destY = y + (ty * 256 - originY);
      ctx.drawImage(img, destX, destY, 256, 256);
    }
  }

  // Border frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  // Map markers
  const markers = Array.isArray(node.data?.markers) ? node.data.markers as Record<string, unknown>[] : [];
  markers.forEach((marker, index) => {
    const anchor = getMapMarkerAnchor(node, marker, safeCenter, zoom);
    if (!anchor) return;
    const label = typeof marker.label === 'string' ? marker.label : `Marker ${index + 1}`;
    drawMapMarker(
      ctx,
      x + anchor.x,
      y + anchor.y,
      label,
      resolveCanvasColor(marker.color, '#38bdf8')
    );
  });

  ctx.restore();
}

function drawRelations(ctx: CanvasContext, relations: Relation[], nodes: Record<string, LivingNode>, minX: number, minY: number, casingColor: string, labelBg: string, labelText: string) {
  const allBounds: NodeBounds[] = Object.values(nodes).map((node) => ({
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width: node.size.width,
    height: node.size.height,
  }));

  for (const relation of relations) {
    const source = nodes[relation.sourceId];
    const target = nodes[relation.targetId];
    if (!source || !target) continue;

    const { sourcePort, targetPort } = resolveRelationPorts(source, target, relation.sourcePort, relation.targetPort);
    const style = relation.style || { color: '#94a3b8', width: 2, type: 'straight' };
    const sourceBounds = allBounds.find((bound) => bound.id === source.id);
    const targetBounds = allBounds.find((bound) => bound.id === target.id);
    const pathResult = sourceBounds && targetBounds && style.type !== 'curved'
      ? generateSmartRelationPath(sourcePort, targetPort, sourceBounds, targetBounds, allBounds)
      : generateRelationPath(sourcePort, targetPort, style.type || 'straight');
    const path = new Path2D(pathResult.pathD);

    ctx.save();
    ctx.translate(-minX, -minY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = casingColor;
    ctx.lineWidth = (style.width || 2) + 6;
    ctx.stroke(path);

    if (style.dash || style.animated) ctx.setLineDash(style.dash || [8, 6]);
    const relationColor = resolveCanvasColor(style.color, '#94a3b8');
    ctx.strokeStyle = relationColor;
    ctx.lineWidth = style.width || 2;
    ctx.stroke(path);

    if (style.endArrow === 'arrow' || relation.relationship === 'leads_to') {
      const angle = Math.atan2(targetPort.y - sourcePort.y, targetPort.x - sourcePort.x);
      ctx.fillStyle = relationColor;
      ctx.beginPath();
      ctx.moveTo(targetPort.x, targetPort.y);
      ctx.lineTo(targetPort.x - 12 * Math.cos(angle - Math.PI / 6), targetPort.y - 12 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(targetPort.x - 12 * Math.cos(angle + Math.PI / 6), targetPort.y - 12 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    const label = relation.label || (relation.relationship !== 'related_to' ? relation.relationship.replace(/_/g, ' ') : '');
    if (label) {
      const mx = pathResult.midPoint.x - minX;
      const my = pathResult.midPoint.y - minY;
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      const labelWidth = ctx.measureText(label).width + 18;
      drawCard(ctx, mx - labelWidth / 2, my - 12, labelWidth, 22, labelBg, 'rgba(148,163,184,0.45)');
      ctx.fillStyle = labelText;
      ctx.textAlign = 'center';
      ctx.fillText(label, mx, my + 4);
      ctx.textAlign = 'left';
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Export current canvas state as a formatted JSON document.
 */
export function exportAsJSON(nodes: Record<string, LivingNode>, relations: Record<string, Relation>, worldId: string) {
  const store = useCanvasStore.getState();
  const exportData = {
    version: '1.0',
    worldId,
    exportedAt: new Date().toISOString(),
    appearance: {
      theme: store.theme,
      canvasBackground: store.canvasBackground,
    },
    viewport: store.viewport,
    counts: {
      nodes: Object.keys(nodes).length,
      relations: Object.keys(relations).length,
    },
    nodes,
    relations,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, `canvio-workspace-${safeName(worldId)}.json`);
}

/**
 * Export canvas elements as a high-resolution PNG image.
 */
export async function exportAsPNG(worldId: string) {
  const store = useCanvasStore.getState();
  const nodes = store.nodes || {};
  const relations = store.relations || {};
  const allNodes = Object.values(nodes).sort((a, b) => a.zIndex - b.zIndex);
  const allRelations = Object.values(relations);
  const canvasBackground = store.canvasBackground || (store.theme === 'light' ? '#f5f5f7' : '#0a0a0f');
  const lightCanvas = isLightColor(canvasBackground);
  const gridColor = lightCanvas ? 'rgba(15, 23, 42, 0.085)' : 'rgba(255, 255, 255, 0.075)';
  const textColor = lightCanvas ? '#111827' : '#f8fafc';
  const casingColor = lightCanvas ? 'rgba(245, 245, 247, 0.92)' : 'rgba(10, 10, 15, 0.86)';
  const labelBg = lightCanvas ? 'rgba(255,255,255,0.95)' : 'rgba(17,24,39,0.94)';

  const canvasEl = document.querySelector('.canvas') as HTMLElement;
  if (!canvasEl) return;

  let minX = 0;
  let minY = 0;
  let maxX = canvasEl.clientWidth;
  let maxY = canvasEl.clientHeight;

  if (allNodes.length > 0) {
    minX = Math.min(...allNodes.map(n => n.position.x)) - 90;
    minY = Math.min(...allNodes.map(n => n.position.y)) - 90;
    maxX = Math.max(...allNodes.map(n => n.position.x + n.size.width)) + 90;
    maxY = Math.max(...allNodes.map(n => n.position.y + n.size.height)) + 90;
  }

  const exportWidth = Math.ceil(Math.max(800, maxX - minX));
  const exportHeight = Math.ceil(Math.max(600, maxY - minY));
  const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

  const canvas = document.createElement('canvas');
  canvas.width = exportWidth * scale;
  canvas.height = exportHeight * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);
  ctx.fillStyle = canvasBackground;
  ctx.fillRect(0, 0, exportWidth, exportHeight);

  ctx.fillStyle = gridColor;
  const grid = 24;
  const gridOffsetX = ((-minX % grid) + grid) % grid;
  const gridOffsetY = ((-minY % grid) + grid) % grid;
  for (let x = gridOffsetX; x < exportWidth; x += grid) {
    for (let y = gridOffsetY; y < exportHeight; y += grid) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRelations(ctx, allRelations, nodes, minX, minY, casingColor, labelBg, textColor);

  for (const node of allNodes) {
    const x = node.position.x - minX;
    const y = node.position.y - minY;

    if (node.type === 'frame') drawFrame(ctx, node, x, y);
    else if (node.type === 'drawing') drawDrawing(ctx, node, x, y);
    else if (node.type === 'sticky') drawSticky(ctx, node, x, y);
    else if (node.type === 'text') drawText(ctx, node, x, y, textColor);
    else if (node.type === 'shape') drawShape(ctx, node, x, y, textColor);
    else if (node.type === 'code') drawCode(ctx, node, x, y);
    else if (node.type === 'map') await drawMapNode(ctx, node, x, y);
    else if (node.type === 'image') {
      const src = typeof node.data?.src === 'string' ? node.data.src : '';
      const img = await loadImage(src);
      if (img) {
        ctx.save();
        ctx.beginPath();
        roundedRect(ctx, x, y, node.size.width, node.size.height, typeof node.data?.borderRadius === 'number' ? node.data.borderRadius : 8);
        ctx.clip();
        ctx.globalAlpha = typeof node.data?.opacity === 'number' ? node.data.opacity : 1;
        ctx.drawImage(img, x, y, node.size.width, node.size.height);
        ctx.restore();
      } else {
        drawCard(ctx, x, y, node.size.width, node.size.height, '#111827', 'rgba(148,163,184,0.35)');
        ctx.fillStyle = '#94a3b8';
        ctx.font = '600 13px Inter, system-ui, sans-serif';
        ctx.fillText('Image unavailable', x + 16, y + 30);
      }
    }
  }

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Unable to create PNG export'));
        return;
      }
      downloadBlob(blob, `canvio-${safeName(worldId)}.png`);
      resolve();
    }, 'image/png');
  });
}

/**
 * Convert canvas to JPEG byte array for PDF embedding.
 */
async function canvasToJpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Pure TypeScript PDF 1.4 binary document builder.
 */
function buildPdfBlob(pages: { jpegBytes: Uint8Array; widthPx: number; heightPx: number; widthPt: number; heightPt: number }[]): Blob {
  const encoder = new TextEncoder();
  const chunks: BlobPart[] = [];
  const xrefOffsets: number[] = [];
  let currentOffset = 0;

  function writeString(str: string) {
    const bytes = encoder.encode(str);
    chunks.push(new Uint8Array(bytes).buffer);
    currentOffset += bytes.length;
  }

  function writeBytes(bytes: Uint8Array) {
    chunks.push(new Uint8Array(bytes).buffer);
    currentOffset += bytes.length;
  }

  writeString("%PDF-1.4\n%\u00FF\u00FF\u00FF\u00FF\n");

  const totalPages = pages.length;
  const pageObjectIds: number[] = [];
  for (let i = 0; i < totalPages; i++) {
    pageObjectIds.push(3 + i * 3);
  }

  xrefOffsets[1] = currentOffset;
  writeString("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  xrefOffsets[2] = currentOffset;
  const kidsStr = pageObjectIds.map(id => `${id} 0 R`).join(' ');
  writeString(`2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${totalPages} >>\nendobj\n`);

  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const pageObjId = 3 + i * 3;
    const imgObjId = 4 + i * 3;
    const contentObjId = 5 + i * 3;

    xrefOffsets[pageObjId] = currentOffset;
    writeString(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.widthPt.toFixed(2)} ${page.heightPt.toFixed(2)}] /Resources << /XObject << /I${i} ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`
    );

    xrefOffsets[imgObjId] = currentOffset;
    writeString(
      `${imgObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.widthPx} /Height ${page.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`
    );
    writeBytes(page.jpegBytes);
    writeString("\nendstream\nendobj\n");

    const contentCmd = `q\n${page.widthPt.toFixed(2)} 0 0 ${page.heightPt.toFixed(2)} 0 0 cm\n/I${i} Do\nQ\n`;
    const contentCmdBytes = encoder.encode(contentCmd);

    xrefOffsets[contentObjId] = currentOffset;
    writeString(`${contentObjId} 0 obj\n<< /Length ${contentCmdBytes.length} >>\nstream\n`);
    writeBytes(contentCmdBytes);
    writeString("\nendstream\nendobj\n");
  }

  const startXref = currentOffset;
  const totalObjects = 2 + totalPages * 3;
  writeString(`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`);

  for (let id = 1; id <= totalObjects; id++) {
    const offsetStr = (xrefOffsets[id] || 0).toString().padStart(10, '0');
    writeString(`${offsetStr} 00000 n \n`);
  }

  writeString(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`
  );

  return new Blob(chunks, { type: 'application/pdf' });
}

/**
 * Render a sub-region of the canvas to an HTMLCanvasElement for export.
 */
async function renderRegionToCanvas(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): Promise<{ canvas: HTMLCanvasElement; widthPx: number; heightPx: number; widthPt: number; heightPt: number } | null> {
  const store = useCanvasStore.getState();
  const nodes = store.nodes || {};
  const relations = store.relations || {};
  const allNodes = Object.values(nodes).sort((a, b) => a.zIndex - b.zIndex);
  const allRelations = Object.values(relations);
  const canvasBackground = store.canvasBackground || (store.theme === 'light' ? '#ffffff' : '#0a0a0f');
  const lightCanvas = isLightColor(canvasBackground);
  const gridColor = lightCanvas ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)';
  const textColor = lightCanvas ? '#111827' : '#f8fafc';
  const casingColor = lightCanvas ? 'rgba(245, 245, 247, 0.92)' : 'rgba(10, 10, 15, 0.86)';
  const labelBg = lightCanvas ? 'rgba(255,255,255,0.95)' : 'rgba(17,24,39,0.94)';

  const exportWidth = Math.ceil(Math.max(100, maxX - minX));
  const exportHeight = Math.ceil(Math.max(100, maxY - minY));
  const scale = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1.5));

  const canvas = document.createElement('canvas');
  canvas.width = exportWidth * scale;
  canvas.height = exportHeight * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(scale, scale);
  ctx.fillStyle = canvasBackground;
  ctx.fillRect(0, 0, exportWidth, exportHeight);

  ctx.fillStyle = gridColor;
  const grid = 24;
  const gridOffsetX = ((-minX % grid) + grid) % grid;
  const gridOffsetY = ((-minY % grid) + grid) % grid;
  for (let x = gridOffsetX; x < exportWidth; x += grid) {
    for (let y = gridOffsetY; y < exportHeight; y += grid) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRelations(ctx, allRelations, nodes, minX, minY, casingColor, labelBg, textColor);

  for (const node of allNodes) {
    if (
      node.position.x + node.size.width < minX ||
      node.position.x > maxX ||
      node.position.y + node.size.height < minY ||
      node.position.y > maxY
    ) {
      continue;
    }

    const x = node.position.x - minX;
    const y = node.position.y - minY;

    if (node.type === 'frame') drawFrame(ctx, node, x, y);
    else if (node.type === 'drawing') drawDrawing(ctx, node, x, y);
    else if (node.type === 'sticky') drawSticky(ctx, node, x, y);
    else if (node.type === 'text') drawText(ctx, node, x, y, textColor);
    else if (node.type === 'shape') drawShape(ctx, node, x, y, textColor);
    else if (node.type === 'code') drawCode(ctx, node, x, y);
    else if (node.type === 'map') await drawMapNode(ctx, node, x, y);
    else if (node.type === 'image') {
      const src = typeof node.data?.src === 'string' ? node.data.src : '';
      const img = await loadImage(src);
      if (img) {
        ctx.save();
        ctx.beginPath();
        roundedRect(ctx, x, y, node.size.width, node.size.height, typeof node.data?.borderRadius === 'number' ? node.data.borderRadius : 8);
        ctx.clip();
        ctx.globalAlpha = typeof node.data?.opacity === 'number' ? node.data.opacity : 1;
        ctx.drawImage(img, x, y, node.size.width, node.size.height);
        ctx.restore();
      } else {
        drawCard(ctx, x, y, node.size.width, node.size.height, '#111827', 'rgba(148,163,184,0.35)');
      }
    }
  }

  const widthPt = exportWidth * 0.75;
  const heightPt = exportHeight * 0.75;

  return { canvas, widthPx: canvas.width, heightPx: canvas.height, widthPt, heightPt };
}

/**
 * Export canvas elements or Page Frames as a formatted PDF document.
 */
export async function exportAsPDF(worldId: string) {
  const store = useCanvasStore.getState();
  const nodes = store.nodes || {};
  const allNodes = Object.values(nodes);
  const frames = allNodes.filter((n) => n.type === 'frame').sort((a, b) => {
    if (Math.abs(a.position.y - b.position.y) > 50) {
      return a.position.y - b.position.y;
    }
    return a.position.x - b.position.x;
  });

  const pageData: { jpegBytes: Uint8Array; widthPx: number; heightPx: number; widthPt: number; heightPt: number }[] = [];

  if (frames.length > 0) {
    // Multi-page export based on Frame pages
    for (const frame of frames) {
      const minX = frame.position.x;
      const minY = frame.position.y;
      const maxX = frame.position.x + frame.size.width;
      const maxY = frame.position.y + frame.size.height;

      const rendered = await renderRegionToCanvas(minX, minY, maxX, maxY);
      if (rendered) {
        const jpegBytes = await canvasToJpegBytes(rendered.canvas);
        pageData.push({
          jpegBytes,
          widthPx: rendered.widthPx,
          heightPx: rendered.heightPx,
          widthPt: rendered.widthPt,
          heightPt: rendered.heightPt,
        });
      }
    }
  } else {
    // Single page export of the whole active canvas
    const canvasEl = document.querySelector('.canvas') as HTMLElement;
    let minX = 0;
    let minY = 0;
    let maxX = canvasEl ? canvasEl.clientWidth : 1200;
    let maxY = canvasEl ? canvasEl.clientHeight : 800;

    if (allNodes.length > 0) {
      minX = Math.min(...allNodes.map((n) => n.position.x)) - 60;
      minY = Math.min(...allNodes.map((n) => n.position.y)) - 60;
      maxX = Math.max(...allNodes.map((n) => n.position.x + n.size.width)) + 60;
      maxY = Math.max(...allNodes.map((n) => n.position.y + n.size.height)) + 60;
    }

    const rendered = await renderRegionToCanvas(minX, minY, maxX, maxY);
    if (rendered) {
      const jpegBytes = await canvasToJpegBytes(rendered.canvas);
      pageData.push({
        jpegBytes,
        widthPx: rendered.widthPx,
        heightPx: rendered.heightPx,
        widthPt: rendered.widthPt,
        heightPt: rendered.heightPt,
      });
    }
  }

  if (pageData.length === 0) return;

  const pdfBlob = buildPdfBlob(pageData);
  downloadBlob(pdfBlob, `canvio-document-${safeName(worldId)}.pdf`);
}
