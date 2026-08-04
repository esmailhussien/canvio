import React, { useEffect, useRef, useState } from 'react';
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
  IconCode,
  IconMoreHorizontal
} from '../icons';
import './Toolbar.css';

export type ToolMode = 'select' | 'pan' | 'draw' | 'highlighter' | 'arrow' | 'text' | 'sticky' | 'map' | 'relation' | 'eraser' | 'image' | 'shape' | 'frame' | 'code';

interface ToolbarProps {
  activeTool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
}

const PRIMARY_TOOLS: { id: ToolMode; icon: React.FC<any>; label: string; group?: string }[] = [
  { id: 'select', icon: IconSelect, label: 'Select (V)', group: '1' },
  { id: 'pan', icon: IconPan, label: 'Pan (Space)', group: '1' },
  { id: 'draw', icon: IconDraw, label: 'Draw (P)', group: '2' },
  { id: 'highlighter', icon: IconHighlighter, label: 'Highlighter (K)', group: '2' },
  { id: 'arrow', icon: IconArrowTool, label: 'Arrow (A)', group: '2' },
  { id: 'text', icon: IconText, label: 'Text (T)', group: '3' },
  { id: 'sticky', icon: IconSticky, label: 'Sticky (S)', group: '3' },
  { id: 'shape', icon: IconShape, label: 'Shape (R)', group: '3' },
  { id: 'relation', icon: IconRelation, label: 'Relation (L)', group: '4' }
];

const MOBILE_PRIMARY_TOOLS = new Set<ToolMode>(['select', 'draw', 'sticky', 'relation']);

const ADVANCED_TOOLS: { id: ToolMode; icon: React.FC<any>; label: string; group?: string }[] = [
  { id: 'eraser', icon: IconEraser, label: 'Eraser (E)', group: 'ink' },
  { id: 'image', icon: IconImage, label: 'Image (I)', group: '3' },
  { id: 'frame', icon: IconFrame, label: 'Frame (F)', group: '3' },
  { id: 'code', icon: IconCode, label: 'Code (C)', group: '3' },
  { id: 'map', icon: IconMap, label: 'Living Map (M)', group: '3' }
];

export const Toolbar: React.FC<ToolbarProps> = ({ activeTool, onToolChange }) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const isAdvancedActive = ADVANCED_TOOLS.some((tool) => tool.id === activeTool);
  const isMobileSecondaryActive = PRIMARY_TOOLS.some((tool) => tool.id === activeTool && !MOBILE_PRIMARY_TOOLS.has(tool.id));
  const mobileMenuTools = [
    ...PRIMARY_TOOLS.filter((tool) => !MOBILE_PRIMARY_TOOLS.has(tool.id)),
    ...ADVANCED_TOOLS,
  ];

  useEffect(() => {
    if (!isMoreOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isMoreOpen]);

  const renderToolButton = (
    tool: { id: ToolMode; icon: React.FC<any>; label: string },
    compact = false,
    className = ''
  ) => (
    <Tooltip key={`${className || 'toolbar'}-${tool.id}`} content={tool.label} position={compact ? 'right' : 'top'}>
      <button
        className={`canvio-toolbar-button ${compact ? 'canvio-toolbar-button--menu' : ''} ${className} ${activeTool === tool.id ? 'active' : ''}`}
        data-tool-id={tool.id}
        onClick={() => {
          onToolChange(tool.id);
          setIsMoreOpen(false);
        }}
        aria-label={tool.label}
        type="button"
      >
        <tool.icon size={20} />
        {compact && <span>{tool.label.replace(/\s*\(.+\)$/, '')}</span>}
      </button>
    </Tooltip>
  );

  return (
    <div className="canvio-toolbar-container canvio-toolbar-enter" ref={toolbarRef}>
      {isMoreOpen && (
        <div className="canvio-toolbar-more__menu" role="menu" aria-label="Advanced tools">
          {mobileMenuTools.map((tool) => renderToolButton(tool, true, 'canvio-toolbar-button--mobile-menu'))}
          {ADVANCED_TOOLS.map((tool) => renderToolButton(tool, true))}
        </div>
      )}

      <div className="canvio-toolbar">
        {PRIMARY_TOOLS.map((tool, index) => {
          const isNextDifferentGroup = index < PRIMARY_TOOLS.length - 1 && PRIMARY_TOOLS[index + 1].group !== tool.group;

          return (
            <React.Fragment key={tool.id}>
              {renderToolButton(tool, false, MOBILE_PRIMARY_TOOLS.has(tool.id) ? '' : 'canvio-toolbar-button--mobile-secondary')}
              {isNextDifferentGroup && <div className="canvio-toolbar-divider" />}
            </React.Fragment>
          );
        })}

        <div className="canvio-toolbar-divider" />
        <div className="canvio-toolbar-more">
          <Tooltip content="More tools" position="top">
            <button
              className={`canvio-toolbar-button ${isMoreOpen || isAdvancedActive || isMobileSecondaryActive ? 'active' : ''}`}
              onClick={() => setIsMoreOpen((prev) => !prev)}
              aria-label="More tools"
              aria-haspopup="menu"
              aria-expanded={isMoreOpen}
              type="button"
            >
              <IconMoreHorizontal size={20} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
