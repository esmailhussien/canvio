import React, { useMemo } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { 
  IconGrid, 
  IconLayoutAlignTop, 
  IconLayoutAlignBottom, 
  IconLayoutAlignLeft, 
  IconLayoutAlignRight,
  IconLayoutAlignMiddle,
  IconLayoutAlignCenter,
  IconTrash
} from '@canvio/ui';
import './MultiSelectionInspector.css';

export function MultiSelectionInspector() {
  const selectedNodeIds = useCanvasStore(s => s.selectedNodeIds);
  const nodes = useCanvasStore(s => s.nodes);
  const tidyUpNodes = useCanvasStore(s => s.tidyUpNodes);
  const alignNodes = useCanvasStore(s => s.alignNodes);
  const removeNodes = useCanvasStore(s => s.removeNodes);
  const snapshot = useCanvasStore(s => s.snapshot);

  const bounds = useMemo(() => {
    if (selectedNodeIds.length < 2) return null;
    const selectedNodes = selectedNodeIds.map(id => nodes[id]).filter(Boolean);
    if (selectedNodes.length < 2) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selectedNodes.forEach(n => {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + n.size.width);
      maxY = Math.max(maxY, n.position.y + n.size.height);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }, [selectedNodeIds, nodes]);

  if (!bounds) return null;

  const handleAction = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    snapshot();
    action();
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
        <div className="inspector-divider" />
        <button className="inspector-btn" onClick={handleAction(() => alignNodes('top'))} title="Align Top">
          <IconLayoutAlignTop size={16} />
        </button>
        <button className="inspector-btn" onClick={handleAction(() => alignNodes('center'))} title="Align Center (Vertical)">
          <IconLayoutAlignCenter size={16} />
        </button>
        <button className="inspector-btn" onClick={handleAction(() => alignNodes('bottom'))} title="Align Bottom">
          <IconLayoutAlignBottom size={16} />
        </button>
        <div className="inspector-divider" />
        <button className="inspector-btn" onClick={handleAction(() => alignNodes('left'))} title="Align Left">
          <IconLayoutAlignLeft size={16} />
        </button>
        <button className="inspector-btn" onClick={handleAction(() => alignNodes('middle'))} title="Align Middle (Horizontal)">
          <IconLayoutAlignMiddle size={16} />
        </button>
        <button className="inspector-btn" onClick={handleAction(() => alignNodes('right'))} title="Align Right">
          <IconLayoutAlignRight size={16} />
        </button>
        <div className="inspector-divider" />
        <button className="inspector-btn danger" onClick={handleAction(() => removeNodes(selectedNodeIds))} title="Delete Selection">
          <IconTrash size={16} />
        </button>
      </div>
    </div>
  );
}
