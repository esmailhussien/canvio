import { useState } from 'react';
import { Relation, LivingNode, useCanvasStore } from '../../store/canvasStore';
import { generateRelationPath, generateSmartRelationPath, NodeBounds, resolveRelationPorts } from './relationUtils';
import './RelationRenderer.css';

interface Props {
  relations: Record<string, Relation>;
  nodes: Record<string, LivingNode>;
}

export function RelationRenderer({ relations, nodes }: Props) {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const selectedRelationId = useCanvasStore((s) => s.selectedRelationId);
  const selectRelation = useCanvasStore((s) => s.selectRelation);
  const removeRelation = useCanvasStore((s) => s.removeRelation);
  const updateRelation = useCanvasStore((s) => s.updateRelation);
  const [hoveredRelationId, setHoveredRelationId] = useState<string | null>(null);

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

        const { sourcePort, targetPort } = resolveRelationPorts(source, target, rel.sourcePort, rel.targetPort);

        const style = rel.style || { type: 'straight', color: 'var(--relation-default)', width: 2 };
        const allBounds: NodeBounds[] = Object.values(nodes).map((node) => ({
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

        const displayLabel = rel.label || (rel.relationship && rel.relationship !== 'related_to' ? rel.relationship.replace('_', ' ') : '');
        const lineWidth = style.width || 2;
        const shouldAnimate = style.animated || rel.relationship === 'leads_to';

        return (
          <g
            key={rel.id}
            style={{
              pointerEvents: (isEraser || isSelectTool) ? 'auto' : 'none',
              cursor: isEraser ? 'pointer' : isSelectTool ? 'pointer' : 'default'
            }}
            className={`relation-group ${isSelected ? 'relation-group--selected' : ''} ${isHovered ? 'relation-group--hovered' : ''} ${isEraser ? 'relation-group--eraser' : ''}`}
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
              if (!isSelectTool) return;
              e.stopPropagation();
              const nextLabel = window.prompt('Relation label', rel.label || '');
              if (nextLabel !== null) {
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
              strokeWidth={Math.max(18, lineWidth + 14)}
            />

            {/* Selection glow highlight line */}
            {(isSelected || isHovered) && (
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
                  x={-(displayLabel.length * 4 + 10)}
                  y={-10}
                  width={displayLabel.length * 8 + 20}
                  height={20}
                  rx={10}
                  fill="var(--relation-label-bg)"
                  stroke={isSelected ? 'var(--accent-primary)' : 'var(--border-strong)'}
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={4}
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize={11}
                  fontWeight={500}
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
