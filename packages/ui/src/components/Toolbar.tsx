import React from 'react';
import { Tooltip } from './Tooltip';
import {
  IconSelect,
  IconPan,
  IconDraw,
  IconHighlighter,
  IconArrowTool,
  IconText,
  IconSticky,
  IconMap,
  IconRelation,
  IconEraser,
  IconImage,
  IconShape,
  IconFrame,
  IconCode
} from '../icons';
import './Toolbar.css';

export type ToolMode = 'select' | 'pan' | 'draw' | 'highlighter' | 'arrow' | 'text' | 'sticky' | 'map' | 'relation' | 'eraser' | 'image' | 'shape' | 'frame' | 'code';

interface ToolbarProps {
  activeTool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
}

const TOOLS: { id: ToolMode; icon: React.FC<any>; label: string; group?: string }[] = [
  { id: 'select', icon: IconSelect, label: 'Select (V)', group: '1' },
  { id: 'pan', icon: IconPan, label: 'Pan (Space)', group: '1' },
  { id: 'draw', icon: IconDraw, label: 'Draw (P)', group: '2' },
  { id: 'highlighter', icon: IconHighlighter, label: 'Highlighter (K)', group: '2' },
  { id: 'arrow', icon: IconArrowTool, label: 'Arrow (A)', group: '2' },
  { id: 'eraser', icon: IconEraser, label: 'Eraser (E)', group: '2' },
  { id: 'text', icon: IconText, label: 'Text (T)', group: '3' },
  { id: 'sticky', icon: IconSticky, label: 'Sticky (S)', group: '3' },
  { id: 'shape', icon: IconShape, label: 'Shape (R)', group: '3' },
  { id: 'image', icon: IconImage, label: 'Image (I)', group: '3' },
  { id: 'frame', icon: IconFrame, label: 'Frame (F)', group: '3' },
  { id: 'code', icon: IconCode, label: 'Code (C)', group: '3' },
  { id: 'map', icon: IconMap, label: 'Map (M)', group: '3' },
  { id: 'relation', icon: IconRelation, label: 'Relation (L)' }
];

export const Toolbar: React.FC<ToolbarProps> = ({ activeTool, onToolChange }) => {
  return (
    <div className="canvio-toolbar-container canvio-toolbar-enter">
      <div className="canvio-toolbar">
        {TOOLS.map((tool, index) => {
          const isNextDifferentGroup = index < TOOLS.length - 1 && TOOLS[index + 1].group !== tool.group;
          
          return (
            <React.Fragment key={tool.id}>
              <Tooltip content={tool.label} position="top">
                <button
                  className={`canvio-toolbar-button ${activeTool === tool.id ? 'active' : ''}`}
                  onClick={() => onToolChange(tool.id)}
                  aria-label={tool.label}
                  type="button"
                >
                  <tool.icon size={20} />
                </button>
              </Tooltip>
              {isNextDifferentGroup && <div className="canvio-toolbar-divider" />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
