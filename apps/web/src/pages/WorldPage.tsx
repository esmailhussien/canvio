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
import { useCanvasStore } from '../store/canvasStore';
import { useCollaboration } from '../hooks/useCollaboration';
import { touchBoard, updateBoardAppearance } from '../utils/api';
import { RelationInspector } from '../components/RelationInspector/RelationInspector';
import { PenInspector } from '../components/PenInspector/PenInspector';
import { CanvioLogoIcon } from '../components/CanvioLogo/CanvioLogo';
import { fitViewportToNodes } from '../utils/viewportFit';
import './WorldPage.css';

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
  const nextZIndex = useCanvasStore((s) => s.nextZIndex);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const theme = useCanvasStore((s) => s.theme);
  const toggleTheme = useCanvasStore((s) => s.toggleTheme);
  const canvasBackground = useCanvasStore((s) => s.canvasBackground);
  const setCanvasBackground = useCanvasStore((s) => s.setCanvasBackground);
  const setAppearance = useCanvasStore((s) => s.setAppearance);
  const replaceWorld = useCanvasStore((s) => s.replaceWorld);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isCanvioMenuOpen, setIsCanvioMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isStarterDismissed, setIsStarterDismissed] = useState(false);
  const [autoShapeEnabled, setAutoShapeEnabled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const boardAppearanceLoadedRef = useRef(false);
  const saveAppearanceTimerRef = useRef<number | null>(null);

  const activeBackground = BACKGROUND_SWATCHES.find((swatch) => swatch.value === canvasBackground);

  const isDarkCanvas = !canvasBackground
    ? theme === 'dark'
    : ['#0a0a0f', '#102033', '#10251e', '#2b2138'].includes(canvasBackground);

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

  const handleStartFromScratch = (reset = false) => {
    setIsStarterDismissed(true);
    if (reset && Object.keys(nodes).length > 0) {
      const confirmed = window.confirm('Start with a blank canvas? Current canvas content will be cleared.');
      if (!confirmed) return;
    }

    replaceWorld({
      nodes: {},
      relations: {},
      viewport: { x: 0, y: 0, zoom: 1 },
      appearance: { theme, canvasBackground },
    });
    setActiveTool('select');
    setViewport({ x: 0, y: 0, zoom: 1 });
  };

  useEffect(() => {
    if (!worldId || !boardAppearanceLoadedRef.current) return;
    if (saveAppearanceTimerRef.current !== null) {
      window.clearTimeout(saveAppearanceTimerRef.current);
    }
    saveAppearanceTimerRef.current = window.setTimeout(() => {
      updateBoardAppearance(worldId, { theme, canvasBackground }).catch(() => {});
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
        setIsAIOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Connect to collaboration
  const { connected, users } = useCollaboration(worldId || '');

  return (
    <div className="world-page" data-tool={activeTool} style={worldStyle}>
      <Canvas worldId={worldId || ''} autoShapeEnabled={autoShapeEnabled} />

      {Object.keys(nodes).length === 0 && !isStarterDismissed && (
        <div className="world-page__empty-launcher" aria-label="Start canvas">
          <div className="world-page__starter-panel">
            <button className="world-page__starter-card primary" onClick={() => handleStartFromScratch(false)}>
              <IconSticky size={22} />
              <span>Start from scratch</span>
            </button>
            <button
              className="world-page__starter-card"
              onClick={() => {
                setIsTemplateOpen(true);
                setIsStarterDismissed(true);
              }}
            >
              <IconMap size={22} />
              <span>Choose a model</span>
            </button>
            <button
              className="world-page__starter-card"
              onClick={() => {
                setIsAIOpen(true);
                setIsStarterDismissed(true);
              }}
            >
              <span aria-hidden="true">✨</span>
              <span>Ask AI</span>
            </button>
          </div>
        </div>
      )}

      <Cursors users={users} />
      <Toolbar activeTool={activeTool} onToolChange={setActiveTool} />
      <PenInspector
        autoShapeEnabled={autoShapeEnabled}
        onToggleAutoShape={() => setAutoShapeEnabled((prev) => !prev)}
      />
      <RelationInspector />

      {/* Modern Compact Top Navigation Header Bar */}
      <header className="world-header">
        {/* Left: Canvio Brand Menu & Export */}
        <div className="world-header__left" ref={menuRef}>
          <button
            className="canvio-brand-btn"
            onClick={() => {
              setIsCanvioMenuOpen((prev) => !prev);
              setIsExportMenuOpen(false);
            }}
            aria-label="Canvio Workspace Menu"
          >
            <CanvioLogoIcon size={24} />
            <span className="canvio-brand-text">Canvio</span>
            <span className="canvio-arrow">▾</span>
          </button>

          {/* Canvio Dropdown Popover Menu */}
          {isCanvioMenuOpen && (
            <div className="canvio-dropdown-menu">
              <button className="canvio-menu-item" onClick={() => navigate('/')}>
                <span className="material-symbols-outlined text-sm">home</span>
                <span>All Workspaces</span>
              </button>

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
            onClick={() => setIsAIOpen(true)}
            aria-label="Spatial AI Assistant"
            title="Open Spatial AI Assistant"
          >
            <AISparkleIcon size={19} />
          </button>

          <ShareButton worldId={worldId || ''} />

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
      </header>

      <TemplatePicker
        isOpen={isTemplateOpen}
        onClose={() => setIsTemplateOpen(false)}
        onStartBlank={() => {
          handleStartFromScratch(true);
          setIsTemplateOpen(false);
        }}
      />

      <AIAssistantModal isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
      <Minimap />
    </div>
  );
}
