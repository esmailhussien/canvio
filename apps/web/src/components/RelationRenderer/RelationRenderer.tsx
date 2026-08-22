import { useEffect, useMemo, useRef, useState } from 'react';
import { Relation, LivingNode, useCanvasStore } from '../../store/canvasStore';
import { generateRelationPath, generateSmartRelationPath, getRelationEndpointLabel, NodeBounds, PathResult, PortPoint, resolveRelationPorts } from './relationUtils';
import './RelationRenderer.css';

interface Props {
  relations: Record<string, Relation>;
  nodes: Record<string, LivingNode>;
  presentationMode?: boolean;
  focusNodeId?: string | null;
  /**
   * 'paths' (default) renders lines/hit-areas below nodes.
   * 'pills' renders ONLY label pills — mounted above nodes by Canvas so
   * relation text never clips underneath neighbouring cards. The pills
   * layer is non-interactive; selection/erase stay on the paths layer.
   */
  layer?: 'paths' | 'pills';
}

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): string {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return '';
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  if (isNaN(d)) return '';
  if (d < 1) {
    return `${Math.round(d * 1000)} m`;
  }
  return `${d.toFixed(1)} km`;
}

function getNodeGeoCoords(node: LivingNode, portId?: string): [number, number] | null {
  if (!node || node.type !== 'map' || !node.data) return null;
  const data = node.data;
  const markers = Array.isArray(data.markers) ? data.markers as Array<{ id: string; position: [number, number] }> : [];

  if (portId && portId.startsWith('marker:')) {
    const markerId = portId.replace('marker:', '');
    const found = markers.find((m) => m.id === markerId);
    if (found && Array.isArray(found.position) && found.position.length === 2) {
      return found.position;
    }
  }

  if (markers.length > 0 && Array.isArray(markers[0].position)) {
    return markers[0].position as [number, number];
  }

  if (Array.isArray(data.center) && data.center.length === 2) {
    return data.center as [number, number];
  }

  return null;
}

function renderRelationIconPaths(relType?: string, color: string = 'currentColor') {
  switch (relType) {
    case 'contradicts':
      return <path d="M13 2L3 14h8l-1 8 11-12h-8l1-8z" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
    case 'depends_on':
      return (
        <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="3" />
          <line x1="12" y1="8" x2="12" y2="21" />
          <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
          <line x1="9" y1="12" x2="15" y2="12" />
        </g>
      );
    case 'enables':
      return (
        <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3 2.2 5.5L20 11l-5.8 2.5L12 19l-2.2-5.5L4 11l5.8-2.5L12 3z" />
          <path d="M18 4v4M16 6h4" />
        </g>
      );
    case 'based_on':
      return (
        <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="17" x2="12" y2="22" />
          <path d="M5 17h14" />
          <path d="M7 17l1.5-8h7L17 17" />
          <path d="M9 9V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5" />
        </g>
      );
    case 'part_of':
      return (
        <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6H9a5 5 0 0 0 0 10h9" />
          <line x1="4" y1="20" x2="20" y2="20" />
        </g>
      );
    case 'leads_to':
      return (
        <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
          <circle cx="5" cy="12" r="1.5" fill={color} />
        </g>
      );
    case 'inspired_by':
      return (
        <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-7 7c0 2.6 1.4 4.8 3.5 6h7c2.1-1.2 3.5-3.4 3.5-6a7 7 0 0 0-7-7z" />
          <path d="m10 9 2 2 2-2" />
        </g>
      );
    case 'related_to':
      return (
        <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="12" r="3" />
          <line x1="9" y1="12" x2="15" y2="12" />
        </g>
      );
    default:
      return null;
  }
}

export function RelationRenderer({ relations, nodes, presentationMode = false, focusNodeId = null, layer = 'paths' }: Props) {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const selectedRelationId = useCanvasStore((s) => s.selectedRelationId);
  const selectRelation = useCanvasStore((s) => s.selectRelation);
  const removeRelation = useCanvasStore((s) => s.removeRelation);
  const [hoveredRelationId, setHoveredRelationId] = useState<string | null>(null);
  const [recentRelationId, setRecentRelationId] = useState<string | null>(null);
  const previousRelationIdsRef = useRef<Set<string>>(new Set(Object.keys(relations)));

  // Obstacle bounds are shared by every relation: build them once per node
  // change instead of once per relation per render (was O(R×N)).
  const { allBounds, boundsById } = useMemo(() => {
    const bounds: NodeBounds[] = [];
    const byId = new Map<string, NodeBounds>();
    for (const node of Object.values(nodes)) {
      if (node.type === 'frame') continue;
      const bound: NodeBounds = {
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        width: node.size.width,
        height: node.size.height,
      };
      bounds.push(bound);
      byId.set(node.id, bound);
    }
    return { allBounds: bounds, boundsById: byId };
  }, [nodes]);

  // Routing is expensive; cache per-relation results and invalidate only when
  // the nodes record changes. Hover/selection/recent-pulse re-renders then
  // reuse computed geometry instead of re-routing every path.
  const pathCacheRef = useRef<{ nodesKey: unknown; paths: Map<string, PathResult> }>({
    nodesKey: null,
    paths: new Map(),
  });
  if (pathCacheRef.current.nodesKey !== nodes) {
    pathCacheRef.current = { nodesKey: nodes, paths: new Map() };
  }
  const pathCache = pathCacheRef.current.paths;

  const routeRelation = (
    rel: Relation,
    sourcePort: PortPoint,
    targetPort: PortPoint,
    styleType: string | undefined
  ): PathResult => {
    const cacheKey = `${rel.id}|${sourcePort.x},${sourcePort.y}|${targetPort.x},${targetPort.y}|${styleType || 'straight'}`;
    const cached = pathCache.get(cacheKey);
    if (cached) return cached;

    const sourceBounds = boundsById.get(rel.sourceId);
    const targetBounds = boundsById.get(rel.targetId);
    const result = sourceBounds && targetBounds && styleType !== 'curved'
      ? generateSmartRelationPath(sourcePort, targetPort, sourceBounds, targetBounds, allBounds)
      : generateRelationPath(sourcePort, targetPort, (styleType as 'straight' | 'curved' | 'orthogonal') || 'straight');

    pathCache.set(cacheKey, result);
    return result;
  };

  useEffect(() => {
    const currentIds = new Set(Object.keys(relations));
    const addedId = [...currentIds].find((id) => !previousRelationIdsRef.current.has(id));
    previousRelationIdsRef.current = currentIds;
    if (!addedId) return;

    setRecentRelationId(addedId);
    const timer = window.setTimeout(() => {
      setRecentRelationId((id) => (id === addedId ? null : id));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [relations]);

  return (
    <svg
      className={layer === 'pills' ? 'canvas__relations-svg canvas__relations-svg--pills' : 'canvas__relations-svg'}
      style={{
        position: 'absolute',
        top: -50000,
        left: -50000,
        width: 100000,
        height: 100000,
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 10000
      }}
      viewBox="-50000 -50000 100000 100000"
    >
      {layer === 'paths' && (
      <defs>
        {/* Arrow Marker Definitions */}
        <marker
          id="arrow-end"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" />
        </marker>

        <marker
          id="arrow-end-selected"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--accent-primary)" />
        </marker>

        <marker
          id="dot-end"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
        >
          <circle cx="5" cy="5" r="4" fill="currentColor" />
        </marker>

        <marker
          id="diamond-end"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="7"
          markerHeight="7"
        >
          <path d="M 5 0 L 10 5 L 5 10 L 0 5 z" fill="currentColor" />
        </marker>
      </defs>
      )}

      {layer === 'paths' && (
      <style>{`
        @keyframes relationFlow {
          from { stroke-dashoffset: 28; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes contradictionFlash {
          0%, 100% { stroke-opacity: 0.85; filter: drop-shadow(0 0 2px #ef4444); }
          50% { stroke-opacity: 1; filter: drop-shadow(0 0 8px #ef4444); }
        }
      `}</style>
      )}

      {Object.values(relations).map((rel) => {
        const source = nodes[rel.sourceId];
        const target = nodes[rel.targetId];
        if (!source || !target) return null;

        const isSelected = selectedRelationId === rel.id;
        const isEraser = activeTool === 'eraser';
        const isSelectTool = activeTool === 'select';
        const isFocusDimmed = Boolean(focusNodeId && rel.sourceId !== focusNodeId && rel.targetId !== focusNodeId);
        const isFocusActive = Boolean(focusNodeId && (rel.sourceId === focusNodeId || rel.targetId === focusNodeId));
        const isMapRelation = source.type === 'map' || target.type === 'map';

        const { sourcePort, targetPort } = resolveRelationPorts(source, target, rel.sourcePort, rel.targetPort);

        const style = rel.style || { type: 'straight', color: 'var(--relation-default)', width: 2 };
        const pathResult = routeRelation(rel, sourcePort, targetPort, style.type);

        const isHovered = hoveredRelationId === rel.id;

        // Visual Semantics per Relationship Type
        const isContradiction = rel.relationship === 'contradicts';
        const isDependency = rel.relationship === 'depends_on';
        const isEnables = rel.relationship === 'enables';
        const isBasedOn = rel.relationship === 'based_on';
        const isPartOf = rel.relationship === 'part_of';
        const isInspiredBy = rel.relationship === 'inspired_by';

        let semanticColor = style.color || 'var(--relation-default)';
        if (!style.color || style.color === 'var(--relation-default)') {
          if (isContradiction) semanticColor = '#ef4444';
          else if (isDependency) semanticColor = '#f59e0b';
          else if (isEnables) semanticColor = '#10b981';
          else if (isBasedOn) semanticColor = '#06b6d4';
          else if (isPartOf) semanticColor = '#8b5cf6';
          else if (isInspiredBy) semanticColor = '#ec4899';
        }

        const lineColor = isSelected
          ? 'var(--accent-primary)'
          : semanticColor;

        const sourceCoords = getNodeGeoCoords(source, rel.sourcePort);
        const targetCoords = getNodeGeoCoords(target, rel.targetPort);
        let distanceLabel = '';
        if (sourceCoords && targetCoords) {
          distanceLabel = calculateHaversineDistance(
            sourceCoords[0],
            sourceCoords[1],
            targetCoords[0],
            targetCoords[1]
          );
        }



        const baseLabel = rel.label || (rel.relationship && rel.relationship !== 'related_to' ? rel.relationship.replace('_', ' ') : '');
        // Keep map-relation pills compact: full sticky text as an endpoint
        // name used to produce ~90-char pills that overlapped neighbouring nodes.
        const shortEndpoint = (node: LivingNode, port?: string) => {
          const clean = getRelationEndpointLabel(node, port).replace(/\s+/g, ' ').trim();
          return clean.length > 20 ? `${clean.slice(0, 19).trimEnd()}…` : clean;
        };
        const endpointLabel = source.type === 'map' || target.type === 'map'
          ? `${shortEndpoint(source, rel.sourcePort)} → ${shortEndpoint(target, rel.targetPort)}`
          : '';
        const rawDisplay = (endpointLabel
          ? (baseLabel ? `${baseLabel} • ${endpointLabel}` : endpointLabel)
          : baseLabel && distanceLabel
            ? `${baseLabel} • ${distanceLabel}`
            : baseLabel || distanceLabel)?.slice(0, 64);

        const hasIcon = Boolean(rel.relationship && rel.relationship !== 'related_to');
        const displayText = rawDisplay || (hasIcon ? rel.relationship?.replace('_', ' ') : '');

        let badgeStroke = 'var(--border-strong)';
        let badgeTint = 'rgba(148, 163, 184, 0.08)';
        let textColor = 'var(--text-primary)';

        if (isContradiction) {
          badgeStroke = '#ef4444';
          badgeTint = 'rgba(239, 68, 68, 0.14)';
          textColor = '#ef4444';
        } else if (isDependency) {
          badgeStroke = '#f59e0b';
          badgeTint = 'rgba(245, 158, 11, 0.14)';
          textColor = '#f59e0b';
        } else if (isEnables) {
          badgeStroke = '#10b981';
          badgeTint = 'rgba(16, 185, 129, 0.14)';
          textColor = '#10b981';
        } else if (isBasedOn) {
          badgeStroke = '#06b6d4';
          badgeTint = 'rgba(6, 182, 212, 0.14)';
          textColor = '#06b6d4';
        } else if (isPartOf) {
          badgeStroke = '#8b5cf6';
          badgeTint = 'rgba(139, 92, 246, 0.14)';
          textColor = '#8b5cf6';
        } else if (rel.relationship === 'leads_to') {
          badgeStroke = '#3b82f6';
          badgeTint = 'rgba(59, 130, 246, 0.14)';
          textColor = '#3b82f6';
        } else if (isInspiredBy) {
          badgeStroke = '#ec4899';
          badgeTint = 'rgba(236, 72, 153, 0.14)';
          textColor = '#ec4899';
        }

        const charWidth = isMapRelation ? 7.2 : 6.8;
        const iconSpace = hasIcon ? 18 : 0;
        const textWidth = displayText ? displayText.length * charWidth : 0;
        const pillWidth = Math.max(34, iconSpace + textWidth + 22);
        const pillHeight = isMapRelation ? 28 : 24;
        const pillRadius = pillHeight / 2;

        const lineWidth = (style.width || 2.5) + (isMapRelation ? 0.45 : 0);
        const shouldAnimate = style.animated || rel.relationship === 'leads_to' || isEnables;
        const strokeDashArray = isContradiction
          ? '6 4'
          : isPartOf
            ? '4 3'
            : shouldAnimate
              ? '8 6'
              : style.dash
                ? style.dash.join(' ')
                : undefined;

        return (
          <g
            key={rel.id}
            style={{
              pointerEvents: layer === 'pills' || presentationMode ? 'none' : (isEraser || isSelectTool) ? 'auto' : 'none',
              cursor: layer === 'pills' || presentationMode ? 'default' : isEraser ? 'pointer' : isSelectTool ? 'pointer' : 'default'
            }}
            className={`relation-group ${isSelected ? 'relation-group--selected' : ''} ${isHovered ? 'relation-group--hovered' : ''} ${isEraser ? 'relation-group--eraser' : ''} ${recentRelationId === rel.id ? 'relation-group--new' : ''} ${isFocusDimmed ? 'relation-group--focus-dimmed' : ''} ${isFocusActive ? 'relation-group--focus-active' : ''} ${isContradiction ? 'relation-group--contradiction' : ''}`}
            aria-label={layer === 'paths' ? `${getRelationEndpointLabel(source, rel.sourcePort)} ${rel.relationship || 'related to'} ${getRelationEndpointLabel(target, rel.targetPort)}` : undefined}
            {...(layer === 'paths' ? {
              onMouseEnter: () => setHoveredRelationId(rel.id),
              onMouseLeave: () => setHoveredRelationId((id) => id === rel.id ? null : id),
              onClick: (e: React.MouseEvent) => {
                if (isEraser) {
                  e.stopPropagation();
                  removeRelation(rel.id);
                } else if (isSelectTool) {
                  e.stopPropagation();
                  selectRelation(rel.id);
                }
              },
              onDoubleClick: (e: React.MouseEvent) => {
                if (!isSelectTool || presentationMode) return;
                e.stopPropagation();
                // Inline editing via the floating inspector instead of a
                // blocking window.prompt (product principle: no dialogs).
                selectRelation(rel.id);
                window.dispatchEvent(new CustomEvent('canvio:focus-relation-label', {
                  detail: { id: rel.id },
                }));
              },
            } : {})}
          >
            {layer === 'paths' && (
            <>
            {/* Thick transparent hit area line for easier clicking */}
            <path
              d={pathResult.pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(28, lineWidth + 20)}
            />

            {/* Selection glow highlight line */}
            {(isSelected || isHovered || recentRelationId === rel.id) && (
              <path
                className="relation-line-glow"
                d={pathResult.pathD}
                fill="none"
                stroke={isContradiction ? '#ef4444' : 'var(--accent-primary)'}
                strokeWidth={lineWidth + (isSelected ? 8 : 6)}
                strokeOpacity={isSelected ? 0.36 : 0.18}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Canvas-colored casing keeps arrows readable when they cross objects. */}
            <path
              className="relation-line-casing"
              d={pathResult.pathD}
              fill="none"
              stroke="var(--relation-casing)"
              strokeWidth={lineWidth + 6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* A thin outer rim gives crossings a professional lane-break look. */}
            <path
              className="relation-line-rim"
              d={pathResult.pathD}
              fill="none"
              stroke={lineColor}
              strokeWidth={lineWidth + 2}
              strokeOpacity={isSelected || isHovered ? 0.24 : 0.12}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Visible Core Path */}
            <path
              className={`relation-line-core ${shouldAnimate ? 'relation-animated' : ''} ${isContradiction ? 'relation-contradiction' : ''}`}
              d={pathResult.pathD}
              fill="none"
              stroke={lineColor}
              strokeWidth={isSelected || isHovered ? lineWidth + 0.8 : lineWidth}
              strokeDasharray={strokeDashArray}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerStart={style.startArrow === 'arrow' ? (isSelected ? 'url(#arrow-end-selected)' : 'url(#arrow-end)') : style.startArrow === 'diamond' ? 'url(#diamond-end)' : undefined}
              markerEnd={style.endArrow === 'arrow' || rel.relationship === 'leads_to' || isDependency || isEnables ? (isSelected ? 'url(#arrow-end-selected)' : 'url(#arrow-end)') : style.endArrow === 'diamond' ? 'url(#diamond-end)' : undefined}
              style={{ color: lineColor }}
            />
            </>
            )}

            {/* Semantic Relationship Pill Label — rendered in the pills layer
                above nodes so text never clips under neighbouring cards. */}
            {layer === 'pills' && (displayText || hasIcon) && (
              <g
                transform={`translate(${pathResult.midPoint.x}, ${pathResult.midPoint.y})`}
                style={{ pointerEvents: 'none' }}
              >
                {/* 1. Solid opaque backdrop mask: completely blocks any underlying line/glow from showing through */}
                <rect
                  x={-pillWidth / 2}
                  y={-pillHeight / 2}
                  width={pillWidth}
                  height={pillHeight}
                  rx={pillRadius}
                  fill="var(--relation-label-bg)"
                />

                {/* 2. Semantic colored glass overlay with crisp outline */}
                <rect
                  x={-pillWidth / 2}
                  y={-pillHeight / 2}
                  width={pillWidth}
                  height={pillHeight}
                  rx={pillRadius}
                  fill={badgeTint}
                  stroke={isSelected ? 'var(--accent-primary)' : badgeStroke}
                  strokeWidth={isSelected ? 1.8 : 1.2}
                />

                {/* 3. Creative Vector SVG Icon */}
                {hasIcon && (
                  <g transform={`translate(${displayText ? -pillWidth / 2 + 8 : -6.5}, -6.5) scale(0.55)`}>
                    {renderRelationIconPaths(rel.relationship, badgeStroke)}
                  </g>
                )}

                {/* 4. Crisp High-Contrast Label Text */}
                {displayText && (
                  <text
                    x={hasIcon ? -pillWidth / 2 + 24 : 0}
                    y={1}
                    textAnchor={hasIcon ? 'start' : 'middle'}
                    dominantBaseline="middle"
                    fill={textColor}
                    fontSize={isMapRelation ? 12 : 11}
                    fontWeight={650}
                    letterSpacing="0.01em"
                    fontFamily="var(--font-sans)"
                  >
                    {displayText}
                  </text>
                )}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
