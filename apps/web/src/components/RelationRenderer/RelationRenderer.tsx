import { useEffect, useRef, useState } from 'react';
import { Relation, LivingNode, useCanvasStore } from '../../store/canvasStore';
import { generateRelationPath, generateSmartRelationPath, getRelationEndpointLabel, NodeBounds, resolveRelationPorts } from './relationUtils';
import './RelationRenderer.css';

interface Props {
  relations: Record<string, Relation>;
  nodes: Record<string, LivingNode>;
  presentationMode?: boolean;
  focusNodeId?: string | null;
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
  const data = node.data as any;
  const markers = Array.isArray(data.markers) ? data.markers : [];

  if (portId && portId.startsWith('marker:')) {
    const markerId = portId.replace('marker:', '');
    const found = markers.find((m: any) => m.id === markerId);
    if (found && Array.isArray(found.position) && found.position.length === 2) {
      return found.position as [number, number];
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

export function RelationRenderer({ relations, nodes, presentationMode = false, focusNodeId = null }: Props) {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const selectedRelationId = useCanvasStore((s) => s.selectedRelationId);
  const selectRelation = useCanvasStore((s) => s.selectRelation);
  const removeRelation = useCanvasStore((s) => s.removeRelation);
  const updateRelation = useCanvasStore((s) => s.updateRelation);
  const snapshot = useCanvasStore((s) => s.snapshot);
  const [hoveredRelationId, setHoveredRelationId] = useState<string | null>(null);
  const [recentRelationId, setRecentRelationId] = useState<string | null>(null);
  const previousRelationIdsRef = useRef<Set<string>>(new Set(Object.keys(relations)));

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
      </defs>

      <style>{`
        @keyframes relationFlow {
          from { stroke-dashoffset: 28; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      {Object.values(relations).map((rel) => {
        const source = nodes[rel.sourceId];
        const target = nodes[rel.targetId];
        if (!source || !target) return null;

        const isSelected = selectedRelationId === rel.id;
        const isEraser = activeTool === 'eraser';
        const isSelectTool = activeTool === 'select';
        const isFocusDimmed = Boolean(focusNodeId && rel.sourceId !== focusNodeId && rel.targetId !== focusNodeId);
        const isFocusActive = Boolean(focusNodeId && (rel.sourceId === focusNodeId || rel.targetId === focusNodeId));

        const { sourcePort, targetPort } = resolveRelationPorts(source, target, rel.sourcePort, rel.targetPort);

        const style = rel.style || { type: 'straight', color: 'var(--relation-default)', width: 2 };
        const allBounds: NodeBounds[] = Object.values(nodes)
          .filter((node) => node.type !== 'frame')
          .map((node) => ({
            id: node.id,
            x: node.position.x,
            y: node.position.y,
            width: node.size.width,
            height: node.size.height,
          }));
        const sourceBounds = allBounds.find((bound) => bound.id === source.id);
        const targetBounds = allBounds.find((bound) => bound.id === target.id);
        const pathResult = sourceBounds && targetBounds && style.type !== 'curved'
          ? generateSmartRelationPath(sourcePort, targetPort, sourceBounds, targetBounds, allBounds)
          : generateRelationPath(sourcePort, targetPort, style.type || 'straight');

        const isHovered = hoveredRelationId === rel.id;
        const lineColor = isSelected
          ? 'var(--accent-primary)'
          : style.color || 'var(--relation-default)';

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
        const endpointLabel = source.type === 'map' || target.type === 'map'
          ? `${getRelationEndpointLabel(source, rel.sourcePort).slice(0, 36)} → ${getRelationEndpointLabel(target, rel.targetPort).slice(0, 36)}`
          : '';
        const displayLabel = (endpointLabel
          ? (baseLabel ? `${baseLabel} • ${endpointLabel}` : endpointLabel)
          : baseLabel && distanceLabel
            ? `${baseLabel} • ${distanceLabel}`
            : baseLabel || distanceLabel)?.slice(0, 96);

        const lineWidth = style.width || 2;
        const shouldAnimate = style.animated || rel.relationship === 'leads_to';

        return (
          <g
            key={rel.id}
            style={{
              pointerEvents: (isEraser || isSelectTool || presentationMode) ? 'auto' : 'none',
              cursor: isEraser ? 'pointer' : isSelectTool ? 'pointer' : 'default'
            }}
            className={`relation-group ${isSelected ? 'relation-group--selected' : ''} ${isHovered ? 'relation-group--hovered' : ''} ${isEraser ? 'relation-group--eraser' : ''} ${recentRelationId === rel.id ? 'relation-group--new' : ''} ${isFocusDimmed ? 'relation-group--focus-dimmed' : ''} ${isFocusActive ? 'relation-group--focus-active' : ''}`}
            aria-label={`${getRelationEndpointLabel(source, rel.sourcePort)} ${rel.relationship || 'related to'} ${getRelationEndpointLabel(target, rel.targetPort)}`}
            onMouseEnter={() => setHoveredRelationId(rel.id)}
            onMouseLeave={() => setHoveredRelationId((id) => id === rel.id ? null : id)}
            onClick={(e) => {
              if (isEraser) {
                e.stopPropagation();
                removeRelation(rel.id);
              } else if (isSelectTool) {
                e.stopPropagation();
                selectRelation(rel.id);
              }
            }}
            onDoubleClick={(e) => {
              if (!isSelectTool || presentationMode) return;
              e.stopPropagation();
              const nextLabel = window.prompt('Relation label', rel.label || '');
              if (nextLabel !== null) {
                snapshot();
                updateRelation(rel.id, { label: nextLabel.trim() });
                selectRelation(rel.id);
              }
            }}
          >
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
                stroke="var(--accent-primary)"
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
              strokeOpacity={isSelected || isHovered ? 0.22 : 0.12}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Visible Core Path */}
            <path
              className={`relation-line-core ${shouldAnimate ? 'relation-animated' : ''}`}
              d={pathResult.pathD}
              fill="none"
              stroke={lineColor}
              strokeWidth={isSelected || isHovered ? lineWidth + 0.8 : lineWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerStart={style.startArrow === 'arrow' ? (isSelected ? 'url(#arrow-end-selected)' : 'url(#arrow-end)') : undefined}
              markerEnd={style.endArrow === 'arrow' || rel.relationship === 'leads_to' ? (isSelected ? 'url(#arrow-end-selected)' : 'url(#arrow-end)') : undefined}
              style={{ color: lineColor }}
            />

            {/* Semantic Relationship Pill Label at Midpoint */}
            {displayLabel && (
              <g
                transform={`translate(${pathResult.midPoint.x}, ${pathResult.midPoint.y})`}
                style={{ pointerEvents: isSelectTool ? 'auto' : 'none' }}
              >
                <rect
                  x={-(Math.max(displayLabel.length * 3.7, 16) + 12)}
                  y={-12}
                  width={Math.max(displayLabel.length * 7.4, 32) + 24}
                  height={24}
                  rx={12}
                  fill="var(--relation-label-bg)"
                  stroke={isSelected ? 'var(--accent-primary)' : 'var(--border-strong)'}
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="var(--text-primary)"
                  fontSize={11}
                  fontWeight={600}
                  fontFamily="var(--font-sans)"
                >
                  {displayLabel}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
