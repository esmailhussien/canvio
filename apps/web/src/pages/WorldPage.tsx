import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { Canvas } from '../components/Canvas/Canvas';
import { IconFitToWorld, IconMap, IconRedo, IconSticky, IconTheme, IconUndo, Toolbar } from '@canvio/ui';
import { Cursors } from '../components/Cursors/Cursors';
import { ShareButton } from '../components/ShareButton/ShareButton';
import { ExportMenu } from '../components/ExportMenu/ExportMenu';
import { TemplatePicker } from '../components/TemplatePicker/TemplatePicker';
import { AIAssistantModal } from '../components/AIAssistantModal/AIAssistantModal';
import { Minimap } from '../components/Minimap/Minimap';
import { applyTemplate } from '../utils/templates';
import { useCanvasStore } from '../store/canvasStore';
import { useCollaboration } from '../hooks/useCollaboration';
import { createBoard, touchBoard, updateBoardAppearance } from '../utils/api';
import { RelationInspector } from '../components/RelationInspector/RelationInspector';
import { PenInspector } from '../components/PenInspector/PenInspector';
import { CanvioLogoIcon } from '../components/CanvioLogo/CanvioLogo';
import { getPlugin } from '@canvio/objects';
import { fitViewportToNodes } from '../utils/viewportFit';
import './WorldPage.css';

const TOOL_GUIDANCE: Record<string, { label: string; detail: string }> = {
  select: { label: 'Select', detail: 'Click an element to move or edit it.' },
  pan: { label: 'Pan', detail: 'Drag the canvas to move around. Release Space to return.' },
  draw: { label: 'Pen', detail: 'Draw freely. Select the stroke afterward to move it.' },
  highlighter: { label: 'Highlighter', detail: 'Mark an area, then switch to Select to move it.' },
  arrow: { label: 'Arrow', detail: 'Draw a line and Canvio will keep its arrow head editable.' },
  text: { label: 'Text', detail: 'Click anywhere to place a text block.' },
  sticky: { label: 'Sticky note', detail: 'Click anywhere to place a note.' },
  shape: { label: 'Shape', detail: 'Click anywhere to place a shape.' },
  map: { label: 'Map', detail: 'Click anywhere to place a map. Map gestures stay inside the map.' },
  relation: { label: 'Relation', detail: 'Choose a start port, then a target port. Press Esc to cancel.' },
  eraser: { label: 'Eraser', detail: 'Click an ink stroke to remove it.' },
  image: { label: 'Image', detail: 'Click the canvas to place an image.' },
  frame: { label: 'Frame', detail: 'Drag an area to create a frame.' },
  code: { label: 'Code', detail: 'Click anywhere to place a code block.' },
};

function AISparkleIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" />
      <path d="M19 2.5C19 4.5 20.5 6 22.5 6C20.5 6 19 7.5 19 9.5C19 7.5 17.5 6 15.5 6C17.5 6 19 4.5 19 2.5Z" opacity="0.8" />
    </svg>
  );
}

const BACKGROUND_SWATCHES = [
  { value: null, label: 'Use theme background', preview: 'linear-gradient(135deg, #0a0a0f 0 50%, #f5f5f7 50% 100%)', grid: null },
  { value: '#0a0a0f', label: 'Graphite background', preview: '#0a0a0f', grid: 'rgba(255,255,255,0.075)' },
  { value: '#f8fafc', label: 'Paper background', preview: '#f8fafc', grid: 'rgba(15,23,42,0.085)' },
  { value: '#102033', label: 'Deep blue background', preview: '#102033', grid: 'rgba(125,211,252,0.10)' },
  { value: '#10251e', label: 'Deep green background', preview: '#10251e', grid: 'rgba(134,239,172,0.10)' },
  { value: '#2b2138', label: 'Plum background', preview: '#2b2138', grid: 'rgba(216,180,254,0.11)' },
];

export function WorldPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const activeTool = useCanvasStore((s) => s.activeTool);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const nodes = useCanvasStore((s) => s.nodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const nextZIndex = useCanvasStore((s) => s.nextZIndex);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const theme = useCanvasStore((s) => s.theme);
  const toggleTheme = useCanvasStore((s) => s.toggleTheme);
  const canvasBackground = useCanvasStore((s) => s.canvasBackground);
  const setCanvasBackground = useCanvasStore((s) => s.setCanvasBackground);
  const setAppearance = useCanvasStore((s) => s.setAppearance);
  const replaceWorld = useCanvasStore((s) => s.replaceWorld);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const branchSelectionAsExperiment = useCanvasStore((s) => s.branchSelectionAsExperiment);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const isAIOpen = useCanvasStore((s) => s.isAIAssistantOpen);
  const setIsAIOpen = useCanvasStore((s) => s.setAIAssistantOpen);
  const [isCanvioMenuOpen, setIsCanvioMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isStarterDismissed, setIsStarterDismissed] = useState(false);
  const [autoShapeEnabled, setAutoShapeEnabled] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const boardAppearanceLoadedRef = useRef(false);
  const saveAppearanceTimerRef = useRef<number | null>(null);

  const activeBackground = BACKGROUND_SWATCHES.find((swatch) => swatch.value === canvasBackground);

  const isDarkCanvas = (() => {
    if (!canvasBackground || canvasBackground === 'null' || canvasBackground === 'undefined') {
      return theme !== 'light';
    }
    const bgLower = canvasBackground.toLowerCase();
    if (bgLower === '#f8fafc' || bgLower === '#ffffff' || bgLower.includes('248, 250, 252') || bgLower.includes('255, 255, 255')) {
      return false;
    }
    return true;
  })();

  const activeTheme = isDarkCanvas ? 'dark' : 'light';

  const worldStyle = {
    ...(canvasBackground ? { '--bg-canvas': canvasBackground } : {}),
    ...(activeBackground?.grid ? { '--canvas-grid-dot': activeBackground.grid } : {}),
  } as React.CSSProperties;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [activeTheme]);

  const handleFitToWorld = () => {
    const allNodes = Object.values(nodes);
    if (allNodes.length > 0) {
      fitViewportToNodes(allNodes, { maxZoom: 1.05, minZoom: 0.35, paddingX: 220, paddingY: 220 });
    } else {
      setViewport({ x: 0, y: 0, zoom: 1 });
    }
  };

  const selectedFocusNodeId = selectedNodeIds[0] || null;
  const isSelectedNodeFocused = Boolean(selectedFocusNodeId && focusNodeId === selectedFocusNodeId);

  const handleFitPresentationView = () => {
    if (focusNodeId && nodes[focusNodeId]) {
      fitViewportToNodes([nodes[focusNodeId]], { maxZoom: 1.2, minZoom: 0.45, paddingX: 260, paddingY: 220 });
      return;
    }
    handleFitToWorld();
  };

  const handleFocusSelectedNode = () => {
    if (!selectedFocusNodeId || !nodes[selectedFocusNodeId]) return;
    setFocusNodeId(selectedFocusNodeId);
    fitViewportToNodes([nodes[selectedFocusNodeId]], { maxZoom: 1.2, minZoom: 0.45, paddingX: 260, paddingY: 220 });
  };

  const handleClearFocus = () => {
    setFocusNodeId(null);
    handleFitToWorld();
  };

  const handleEnterPresentation = () => {
    setActiveTool('select');
    setIsCanvioMenuOpen(false);
    setIsExportMenuOpen(false);
    setIsTemplateOpen(false);
    setIsAIOpen(false);
    setFocusNodeId(selectedFocusNodeId && nodes[selectedFocusNodeId] ? selectedFocusNodeId : null);
    setIsPresenting(true);
    window.setTimeout(() => {
      if (selectedFocusNodeId && nodes[selectedFocusNodeId]) {
        fitViewportToNodes([nodes[selectedFocusNodeId]], { maxZoom: 1.2, minZoom: 0.45, paddingX: 260, paddingY: 220 });
      } else {
        handleFitToWorld();
      }
    }, 0);
  };

  const handleExitPresentation = () => {
    setIsPresenting(false);
    setFocusNodeId(null);
    setActiveTool('select');
  };

  const handleNewBlankBoard = () => {
    const newId = nanoid(10);
    createBoard().catch(() => {});
    setIsCanvioMenuOpen(false);
    setIsStarterDismissed(false);
    navigate(`/w/${newId}`);
  };

  const handleExperimentSelection = () => {
    if (selectedNodeIds.length === 0) return;
    branchSelectionAsExperiment();
    setActiveTool('select');
  };

  const handleClearSelectionContext = () => {
    clearSelection();
    setFocusNodeId(null);
  };

  const handleStartFromScratch = (reset = false) => {
    if (reset && Object.keys(nodes).length > 0) {
      const confirmed = window.confirm('Start with a blank canvas? Current canvas content will be cleared.');
      if (!confirmed) return;
    }

    setIsStarterDismissed(true);
    replaceWorld({
      nodes: {},
      relations: {},
      viewport: { x: 0, y: 0, zoom: 1 },
      appearance: { theme, canvasBackground },
    });
    setActiveTool('select');
    setViewport({ x: 0, y: 0, zoom: 1 });
  };

  const handleDropMap = () => {
    setIsStarterDismissed(true);
    replaceWorld({
      nodes: {},
      relations: {},
      viewport: { x: 0, y: 0, zoom: 1 },
      appearance: { theme, canvasBackground },
    });
    const mapPlugin = getPlugin('map');
    if (mapPlugin) {
      const mapNode = mapPlugin.create({ x: 0, y: 0 });
      const positionedNode = {
        ...mapNode,
        position: {
          x: -(mapNode.size.width / 2),
          y: -(mapNode.size.height / 2)
        },
        zIndex: nextZIndex(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addNode(positionedNode);
      selectNode(positionedNode.id);
      setActiveTool('select');
      setViewport({ x: 0, y: 0, zoom: 1 });
    }
  };

  const handleStartTemplate = (templateId: string) => {
    setIsStarterDismissed(true);
    applyTemplate(templateId);
    clearSelection();
    setActiveTool('select');
  };

  useEffect(() => {
    if (!worldId || !boardAppearanceLoadedRef.current) return;
    if (saveAppearanceTimerRef.current !== null) {
      window.clearTimeout(saveAppearanceTimerRef.current);
    }
    saveAppearanceTimerRef.current = window.setTimeout(() => {
      updateBoardAppearance(worldId, { theme, canvasBackground }).catch(() => { });
    }, 350);

    return () => {
      if (saveAppearanceTimerRef.current !== null) {
        window.clearTimeout(saveAppearanceTimerRef.current);
        saveAppearanceTimerRef.current = null;
      }
    };
  }, [worldId, theme, canvasBackground]);

  // Close menus when clicking anywhere outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsCanvioMenuOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setIsExportMenuOpen(false);
      }
    };
    if (isCanvioMenuOpen || isExportMenuOpen) {
      window.addEventListener('pointerdown', handleClickOutside);
    }
    return () => window.removeEventListener('pointerdown', handleClickOutside);
  }, [isCanvioMenuOpen, isExportMenuOpen]);

  // Ctrl+K shortcut for Spatial AI Navigator
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsAIOpen(!useCanvasStore.getState().isAIAssistantOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (focusNodeId && !nodes[focusNodeId]) {
      setFocusNodeId(null);
    }
  }, [focusNodeId, nodes]);

  useEffect(() => {
    if (!isPresenting) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleExitPresentation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPresenting]);

  // Connect to collaboration
  const { connected, connectionIssue, users, persistenceState, retryConnection } = useCollaboration(worldId || '');
  const toolGuidance = TOOL_GUIDANCE[activeTool] || TOOL_GUIDANCE.select;
  const saveLabel = persistenceState === 'loading'
    ? 'Restoring board'
    : persistenceState === 'saving'
      ? 'Saving locally'
      : persistenceState === 'error'
        ? 'Save needs attention'
        : connected
          ? 'Saved and live'
          : 'Saved locally';
  const saveIcon = persistenceState === 'loading'
    ? 'history'
    : persistenceState === 'saving'
      ? 'sync'
      : persistenceState === 'error'
        ? 'warning'
        : connected
          ? 'cloud_done'
          : 'cloud_off';

  return (
    <div className={`world-page ${isPresenting ? 'is-presenting' : ''}`} data-tool={activeTool} style={worldStyle}>
      <Canvas
        worldId={worldId || ''}
        autoShapeEnabled={autoShapeEnabled}
        presentationMode={isPresenting}
        focusNodeId={focusNodeId}
      />

      {Object.keys(nodes).length === 0 && !isStarterDismissed && !isPresenting && (
        <div className="world-page__empty-launcher" aria-label="Start canvas">
          {/* Subtle animated magical background for empty state */}
          <div className="world-page__empty-bg-glow"></div>
          
          <div className="world-page__empty-hero">
            <span className="world-page__empty-kicker">A simple place to think</span>
            <h1 className="world-page__empty-title">
              What are you working on?
            </h1>
            <p className="world-page__empty-subtitle">
              Choose a starting point. You can change direction at any time.
            </p>
          </div>

          <div className="world-page__starter-panel">
            <div className="world-page__starter-section">
              <span className="world-page__starter-label">Start blank</span>
              <button className="world-page__starter-card primary" onClick={() => handleStartFromScratch(false)}>
                <IconSticky size={22} />
                <span>
                  <strong>Start from scratch</strong>
                  <small>Make your own board</small>
                </span>
              </button>
            </div>
            <div className="world-page__starter-section world-page__starter-section--wide">
              <span className="world-page__starter-label">Start with a purpose</span>
              <div className="world-page__starter-grid">
                <button className="world-page__starter-card lesson-card" onClick={() => handleStartTemplate('lesson-plan-board')}>
                  <span className="material-symbols-outlined text-xl">school</span>
                  <span>
                    <strong>Teach a lesson</strong>
                    <small>Plan an explanation</small>
                  </span>
                </button>
                <button className="world-page__starter-card study-card" onClick={() => handleStartTemplate('study-concept-map')}>
                  <span className="material-symbols-outlined text-xl">neurology</span>
                  <span>
                    <strong>Study a topic</strong>
                    <small>Connect what you know</small>
                  </span>
                </button>
                <button className="world-page__starter-card map-card" onClick={handleDropMap}>
                  <IconMap size={22} />
                  <span>
                    <strong>Explore a place</strong>
                    <small>Start with a world map</small>
                  </span>
                </button>
              </div>
            </div>
            <div className="world-page__starter-actions">
              <button
                className="world-page__starter-link"
                onClick={() => {
                  setIsTemplateOpen(true);
                  setIsStarterDismissed(true);
                }}
              >
                <span className="material-symbols-outlined text-xl">space_dashboard</span>
                <span>Browse all templates</span>
              </button>
              <button
                className="world-page__starter-link world-page__starter-link--ai"
                onClick={() => {
                  setIsAIOpen(true);
                  setIsStarterDismissed(true);
                }}
              >
                <AISparkleIcon size={22} />
                <span>Ask Spatial AI</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Cursors users={users} />
      {!isPresenting && (
        <>
          <div className="world-page__tool-status" role="status" aria-live="polite">
            <span className="world-page__tool-status-main">
              <span className="material-symbols-outlined">{activeTool === 'select' ? 'near_me' : 'edit'}</span>
              <strong>{toolGuidance.label}</strong>
            </span>
            <span className="world-page__tool-status-detail">{toolGuidance.detail}</span>
            {activeTool !== 'select' && <kbd>Esc</kbd>}
          </div>
          <Toolbar activeTool={activeTool} onToolChange={setActiveTool} />
          <PenInspector
            autoShapeEnabled={autoShapeEnabled}
            onToggleAutoShape={() => setAutoShapeEnabled((prev) => !prev)}
          />
          <RelationInspector />
        </>
      )}

      {isPresenting && (
        <div className="presentation-controls" role="toolbar" aria-label="Presentation controls">
          <button className="presentation-control-btn presentation-control-btn--primary" onClick={handleExitPresentation} title="Exit presentation">
            <span className="material-symbols-outlined">close_fullscreen</span>
            <span>Exit</span>
          </button>
          <button
            className="presentation-control-btn"
            onClick={handleFocusSelectedNode}
            disabled={!selectedFocusNodeId}
            title="Focus selected element"
          >
            <span className="material-symbols-outlined">filter_center_focus</span>
            <span>Focus</span>
          </button>
          <button
            className="presentation-control-btn"
            onClick={handleClearFocus}
            disabled={!focusNodeId}
            title="Clear focus"
          >
            <span className="material-symbols-outlined">visibility</span>
            <span>All</span>
          </button>
          <button className="presentation-control-btn" onClick={handleFitPresentationView} title="Fit view">
            <span className="material-symbols-outlined">fit_screen</span>
            <span>Fit</span>
          </button>
        </div>
      )}

      {!isPresenting && selectedNodeIds.length > 0 && (
        <div className="selection-quick-actions" role="toolbar" aria-label="Selection quick actions">
          <span className="selection-quick-actions__count">
            {selectedNodeIds.length === 1 ? '1 selected' : `${selectedNodeIds.length} selected`}
          </span>
          <button
            className="selection-quick-actions__btn"
            onClick={handleExperimentSelection}
            title="Create an editable copy to try another version"
          >
            <span className="material-symbols-outlined">difference</span>
            <span>Experiment</span>
          </button>
          <button
            className="selection-quick-actions__btn"
            onClick={isSelectedNodeFocused ? handleClearFocus : handleFocusSelectedNode}
            title={isSelectedNodeFocused ? 'Show all elements' : 'Spotlight selected element'}
          >
            <span className="material-symbols-outlined">{isSelectedNodeFocused ? 'visibility' : 'filter_center_focus'}</span>
            <span>{isSelectedNodeFocused ? 'All' : 'Focus'}</span>
          </button>
          <button
            className="selection-quick-actions__btn selection-quick-actions__btn--quiet"
            onClick={handleClearSelectionContext}
            title="Clear selection"
            aria-label="Clear selection"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}

      {/* Modern Compact Top Navigation Header Bar */}
      {!isPresenting && <header className="world-header">
        {/* Left: Canvio Brand Menu & Export */}
        <div className="world-header__left" ref={menuRef}>
          <div className="canvio-brand-group" aria-label="Canvio navigation">
            <button
              className="canvio-brand-btn"
              onClick={() => navigate('/')}
              aria-label="Go to Canvio home"
              title="Go to home"
            >
              <CanvioLogoIcon size={24} />
              <span className="canvio-brand-text">Canvio</span>
            </button>
            <button
              className="canvio-brand-menu-toggle"
              onClick={() => {
                setIsCanvioMenuOpen((prev) => !prev);
                setIsExportMenuOpen(false);
              }}
              aria-label="Open Canvio workspace menu"
              aria-expanded={isCanvioMenuOpen}
              title="Workspace menu"
            >
              <span className="canvio-arrow">▾</span>
            </button>
          </div>

          {/* Canvio Dropdown Popover Menu */}
          {isCanvioMenuOpen && (
            <div className="canvio-dropdown-menu">
              <button className="canvio-menu-item" onClick={() => navigate('/')}>
                <span className="material-symbols-outlined text-sm">home</span>
                <span>All Workspaces</span>
              </button>

              <button className="canvio-menu-item" onClick={handleNewBlankBoard}>
                <span className="material-symbols-outlined text-sm">add_circle</span>
                <span>New Blank Board</span>
              </button>

              {Object.keys(nodes).length > 0 && (
                <button
                  className="canvio-menu-item canvio-menu-item--danger"
                  onClick={() => {
                    handleStartFromScratch(true);
                    setIsCanvioMenuOpen(false);
                  }}
                >
                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                  <span>Start Over This Board</span>
                </button>
              )}

              <button
                className="canvio-menu-item"
                onClick={() => {
                  setIsTemplateOpen(true);
                  setIsCanvioMenuOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-sm">space_dashboard</span>
                <span>Canvas Models & Layouts</span>
              </button>

              <button
                className="canvio-menu-item"
                onClick={() => {
                  handleFitToWorld();
                  setIsCanvioMenuOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-sm">fit_screen</span>
                <span>Fit Viewport to Canvas</span>
              </button>

              <button
                className="canvio-menu-item"
                onClick={handleEnterPresentation}
              >
                <span className="material-symbols-outlined text-sm">present_to_all</span>
                <span>Present Board</span>
              </button>

              {selectedNodeIds.length > 0 && (
                <button
                  className="canvio-menu-item"
                  onClick={() => {
                    handleExperimentSelection();
                    setIsCanvioMenuOpen(false);
                  }}
                >
                  <span className="material-symbols-outlined text-sm">difference</span>
                  <span>Experiment With Selection</span>
                </button>
              )}

              <button
                className="canvio-menu-item"
                onClick={() => {
                  navigate('/support');
                  setIsCanvioMenuOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-sm" style={{ color: '#ef4444' }}>favorite</span>
                <span>Support Canvio (Open Source)</span>
              </button>

              <div className="canvio-menu-divider" />

              <button
                className="canvio-menu-item"
                onClick={() => {
                  toggleTheme();
                }}
              >
                <span className="material-symbols-outlined text-sm">
                  {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                </span>
                <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
              </button>

              {/* Canvas Background Color Swatches */}
              <div className="canvio-menu-swatches">
                <span className="text-xs text-secondary font-medium">Canvas Background</span>
                <div className="canvas-bg-swatches mt-1">
                  {BACKGROUND_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.value || 'theme'}
                      className={`canvas-bg-swatch ${canvasBackground === swatch.value ? 'active' : ''}`}
                      style={{ background: swatch.preview }}
                      onClick={() => {
                        setCanvasBackground(swatch.value);
                        setIsCanvioMenuOpen(false);
                      }}
                      aria-label={swatch.label}
                      title={swatch.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <ExportMenu
            worldId={worldId || ''}
            isOpen={isExportMenuOpen}
            onToggle={() => {
              setIsExportMenuOpen((prev) => !prev);
              setIsCanvioMenuOpen(false);
            }}
            onClose={() => setIsExportMenuOpen(false)}
            containerRef={exportMenuRef}
          />
        </div>

        {/* Center: ✨ AI Navigator (Ctrl+K) */}
        <div className="world-header__center">
          <button
            className="ai-navigator-pill"
            onClick={() => setIsAIOpen(true)}
            aria-label="AI Navigator"
            title="Spatial AI Navigator (Ctrl+K)"
          >
            <span className="material-symbols-outlined text-base">auto_awesome</span>
            <span>AI Navigator (Ctrl+K)</span>
          </button>
        </div>

        {/* Right: Undo, Redo, Divider, Robot AI & Share */}
        <div className="world-header__right">
          <button
            className="header-icon-btn"
            onClick={() => useCanvasStore.getState().undo()}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
          >
            <IconUndo size={18} />
          </button>

          <button
            className="header-icon-btn"
            onClick={() => useCanvasStore.getState().redo()}
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
          >
            <IconRedo size={18} />
          </button>

          <div className="header-divider" />

          <button
            className="header-ai-btn"
            onClick={handleEnterPresentation}
            aria-label="Present Board"
            title="Present Board"
          >
            <span className="material-symbols-outlined text-base">present_to_all</span>
          </button>

          <button
            className="header-ai-btn"
            onClick={() => setIsAIOpen(true)}
            aria-label="Spatial AI Assistant"
            title="Open Spatial AI Assistant"
          >
            <AISparkleIcon size={19} />
          </button>

          <ShareButton worldId={worldId || ''} />

          {connectionIssue && !connected ? (
            <button
              className="connection-status connection-status--retry"
              onClick={retryConnection}
              title={`${connectionIssue}. Retry collaboration.`}
              aria-label="Retry collaboration connection"
            >
              <span className="material-symbols-outlined">refresh</span>
              <span>Retry</span>
            </button>
          ) : (
            <span
              className={`connection-status ${connected ? 'connected' : ''} connection-status--save-${persistenceState}`}
              title={`${saveLabel}. ${connected ? 'Live collaboration connected.' : 'Collaboration continues locally.'}`}
              aria-label={saveLabel}
            >
              <span className="material-symbols-outlined">{saveIcon}</span>
              <span>{saveLabel}</span>
            </span>
          )}

          {/* Overlapping Multiplayer Avatar Stack */}
          <div className="presence-avatar-stack" title={`${users.length + 1} online collaborator${users.length > 0 ? 's' : ''}`}>
            {/* Host / Current User Avatar */}
            <div className="presence-avatar" style={{ borderColor: '#8083ff', zIndex: 30 }} title="You (Host)">
              <span className="material-symbols-outlined text-sm">person</span>
            </div>

            {/* Remote Online Collaborators */}
            {users.slice(0, 2).map((u, i) => (
              <div
                key={u.id || i}
                className="presence-avatar"
                style={{ borderColor: u.color || (i === 0 ? '#4ae176' : '#ec4899'), zIndex: 20 - i }}
                title={u.name || `User ${i + 1}`}
              >
                {u.avatar ? (
                  <img src={u.avatar} alt={u.name || 'User'} className="presence-avatar__img" />
                ) : (
                  <span className="presence-avatar__initial">{(u.name || `U${i + 1}`)[0].toUpperCase()}</span>
                )}
              </div>
            ))}

            {/* Extra Users Indicator Badge */}
            {users.length > 2 && (
              <div className="presence-avatar presence-avatar--more" style={{ zIndex: 5 }}>
                <span>+{users.length - 2}</span>
              </div>
            )}
          </div>
        </div>
      </header>}

      <TemplatePicker
        isOpen={isTemplateOpen}
        onClose={() => setIsTemplateOpen(false)}
        onStartBlank={() => {
          handleStartFromScratch(true);
          setIsTemplateOpen(false);
        }}
      />

      <AIAssistantModal isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
      {!isPresenting && <Minimap />}
    </div>
  );
}
