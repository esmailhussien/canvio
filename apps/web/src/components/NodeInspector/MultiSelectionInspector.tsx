import React, { useMemo } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { IconCopy, IconTrash } from '@canvio/ui';
import './MultiSelectionInspector.css';

function IconGrid({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  );
}

function IconAlignTop({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2.5" x2="14" y2="2.5" strokeWidth="2" />
      <rect x="4" y="5" width="3" height="8.5" rx="0.5" />
      <rect x="9" y="5" width="3" height="5" rx="0.5" />
    </svg>
  );
}

function IconAlignCenterVert({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="8" x2="14" y2="8" strokeDasharray="2 2" />
      <rect x="4" y="3" width="3" height="10" rx="0.5" />
      <rect x="9" y="5" width="3" height="6" rx="0.5" />
    </svg>
  );
}

function IconAlignBottom({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="13.5" x2="14" y2="13.5" strokeWidth="2" />
      <rect x="4" y="2.5" width="3" height="8.5" rx="0.5" />
      <rect x="9" y="6" width="3" height="5" rx="0.5" />
    </svg>
  );
}

function IconAlignLeft({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2.5" y1="2" x2="2.5" y2="14" strokeWidth="2" />
      <rect x="5" y="4" width="8.5" height="3" rx="0.5" />
      <rect x="5" y="9" width="5" height="3" rx="0.5" />
    </svg>
  );
}

function IconAlignMiddleHoriz({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="2" x2="8" y2="14" strokeDasharray="2 2" />
      <rect x="3" y="4" width="10" height="3" rx="0.5" />
      <rect x="5" y="9" width="6" height="3" rx="0.5" />
    </svg>
  );
}

function IconAlignRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="13.5" y1="2" x2="13.5" y2="14" strokeWidth="2" />
      <rect x="2.5" y="4" width="8.5" height="3" rx="0.5" />
      <rect x="6" y="9" width="5" height="3" rx="0.5" />
    </svg>
  );
}

export function MultiSelectionInspector() {
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const nodes = useCanvasStore((s) => s.nodes);
  const tidyUpNodes = useCanvasStore((s) => s.tidyUpNodes);
  const alignNodes = useCanvasStore((s) => s.alignNodes);
  const removeNodes = useCanvasStore((s) => s.removeNodes);
  const branchSelectionAsExperiment = useCanvasStore((s) => s.branchSelectionAsExperiment);
  const snapshot = useCanvasStore((s) => s.snapshot);

  const bounds = useMemo(() => {
    if (selectedNodeIds.length < 2) return null;
    const selectedNodes = selectedNodeIds.map((id) => nodes[id]).filter(Boolean);
    if (selectedNodes.length < 2) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selectedNodes.forEach((n) => {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + n.size.width);
      maxY = Math.max(maxY, n.position.y + n.size.height);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [selectedNodeIds, nodes]);

  if (!bounds) return null;

  const handleAction = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof snapshot === 'function') snapshot();
    if (typeof action === 'function') action();
  };

  return (
    <div
      className="multi-selection-inspector"
      style={{
        transform: `translate(${bounds.x + bounds.width / 2}px, ${bounds.y - 38}px)`,
      }}
    >
      <div className="inspector-panel" onPointerDown={(e) => e.stopPropagation()}>
        <button className="inspector-btn" onClick={handleAction(tidyUpNodes)} title="Tidy Up (Distribute Evenly)">
          <IconGrid size={16} />
        </button>
        <button className="inspector-btn" onClick={handleAction(branchSelectionAsExperiment)} title="Experiment Copy">
          <IconCopy size={16} />
        </button>
        <div className="inspector-divider" />
        <button className="inspector-btn" onClick={handleAction(() => alignNodes?.('top'))} title="Align Top">
          <IconAlignTop size={16} />
        </button>
        <button className="inspector-btn" onClick={handleAction(() => alignNodes?.('center'))} title="Align Center (Vertical)">
          <IconAlignCenterVert size={16} />
        </button>
        <button className="inspector-btn" onClick={handleAction(() => alignNodes?.('bottom'))} title="Align Bottom">
          <IconAlignBottom size={16} />
        </button>
        <div className="inspector-divider" />
        <button className="inspector-btn" onClick={handleAction(() => alignNodes?.('left'))} title="Align Left">
          <IconAlignLeft size={16} />
        </button>
        <button className="inspector-btn" onClick={handleAction(() => alignNodes?.('middle'))} title="Align Middle (Horizontal)">
          <IconAlignMiddleHoriz size={16} />
        </button>
        <button className="inspector-btn" onClick={handleAction(() => alignNodes?.('right'))} title="Align Right">
          <IconAlignRight size={16} />
        </button>
        <div className="inspector-divider" />
        <button className="inspector-btn danger" onClick={handleAction(() => removeNodes?.(selectedNodeIds))} title="Delete Selection">
          <IconTrash size={16} />
        </button>
      </div>
    </div>
  );
}
