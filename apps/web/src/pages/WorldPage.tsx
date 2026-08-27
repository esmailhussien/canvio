import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { Canvas } from '../components/Canvas/Canvas';
import { IconRedo, IconUndo, Toolbar } from '@canvio/ui';
import { Cursors } from '../components/Cursors/Cursors';
import { ShareButton } from '../components/ShareButton/ShareButton';
import { ExportMenu } from '../components/ExportMenu/ExportMenu';
import { Minimap } from '../components/Minimap/Minimap';
import { applyTemplate } from '../utils/templates';
import { useCanvasStore, type HistorySnapshot, type Viewport } from '../store/canvasStore';
import { useCollaboration } from '../hooks/useCollaboration';
import { RelationInspector } from '../components/RelationInspector/RelationInspector';
import { PenInspector } from '../components/PenInspector/PenInspector';
import { CanvioLogoIcon } from '../components/CanvioLogo/CanvioLogo';
import { fitViewportToNodes } from '../utils/viewportFit';
import { createBoard, forkBoard, touchBoard, updateBoardAppearance, BoardRecord } from '../utils/api';
import {
  markBoardTelemetryMilestone,
  startBoardTelemetry,
  trackBoardEvent,
  type BoardVisitTelemetry,
} from '../utils/productTelemetry';
import './WorldPage.css';

const TemplatePicker = lazy(() => import('../components/TemplatePicker/TemplatePicker').then((module) => ({
  default: module.TemplatePicker,
})));
const AIAssistantModal = lazy(() => import('../components/AIAssistantModal/AIAssistantModal').then((module) => ({
  default: module.AIAssistantModal,
})));
const GraphIntelligence = lazy(() => import('../components/GraphIntelligence/GraphIntelligence').then((module) => ({
  default: module.GraphIntelligence,
})));

const TOOL_GUIDANCE: Record<string, { label: string; detail: string }> = {
  select: { label: 'Select', detail: 'Tap or click an element to move it. Use two fingers to move the canvas.' },
  pan: { label: 'Pan', detail: 'Drag the canvas to move around. Pinch to zoom on touch screens.' },
  draw: { label: 'Pen', detail: 'Draw freely. Switch to Select to move the stroke afterward.' },
  highlighter: { label: 'Highlighter', detail: 'Mark an area. Switch to Select to move the highlight afterward.' },
  laser: { label: 'Laser pointer', detail: 'Point at an idea while presenting. It is temporary and never saved.' },
  arrow: { label: 'Arrow', detail: 'Draw a line and Canvio will keep its arrow head editable.' },
  text: { label: 'Text', detail: 'Tap or click anywhere to place a text block.' },
  sticky: { label: 'Sticky note', detail: 'Tap or click anywhere to place a note. Drag the handle to move it.' },
  shape: { label: 'Shape', detail: 'Tap or click anywhere to place a shape.' },
  map: { label: 'Living Map', detail: 'Tap or click to place a world map. Add pins, then connect exact locations to ideas.' },
  relation: { label: 'Relation', detail: 'Choose a side or map pin, then choose the target.' },
  eraser: { label: 'Eraser', detail: 'Tap or click an ink stroke to remove it.' },
  image: { label: 'Image', detail: 'Tap or click the canvas to place an image.' },
  frame: { label: 'Frame', detail: 'Drag an area to create a frame.' },
  code: { label: 'Code', detail: 'Tap or click anywhere to place a code block.' },
};



const BACKGROUND_SWATCHES = [
  { value: null, label: 'Use theme background', preview: 'linear-gradient(135deg, #0a0a0f 0 50%, #f5f5f7 50% 100%)', grid: null },
  { value: '#0a0a0f', label: 'Graphite background', preview: '#0a0a0f', grid: 'rgba(255,255,255,0.075)' },
  { value: '#f8fafc', label: 'Paper background', preview: '#f8fafc', grid: 'rgba(15,23,42,0.085)' },
  { value: '#102033', label: 'Deep blue background', preview: '#102033', grid: 'rgba(125,211,252,0.10)' },
  { value: '#10251e', label: 'Deep green background', preview: '#10251e', grid: 'rgba(134,239,172,0.10)' },
  { value: '#2b2138', label: 'Plum background', preview: '#2b2138', grid: 'rgba(216,180,254,0.11)' },
];

const COACH_DISMISS_KEY = 'CANVIO_STARTER_COACH_DISMISSED_V1';
const STARTER_DISMISS_KEY = 'CANVIO_STARTER_DISMISSED_V1';
const DEMO_BOARD_PREFIX = 'demo-';
const DEMO_TEMPLATE_ID = 'canvio-demo-board';

type CoachAction = 'add-note' | 'connect' | 'open-ai' | 'open-templates' | 'select-tool' | 'share';

type StarterGoal = {
  id: string;
  title: string;
  description: string;
  icon: string;
  accent: string;
  templateId: string;
};

type BoardNoticeAction = 'restore-cleared-board' | 'retry-fork';

type BoardNotice = {
  id: number;
  kind: 'success' | 'warning' | 'error' | 'info';
  text: string;
  action?: BoardNoticeAction;
  actionLabel?: string;
};

type RecoverableWorldSnapshot = HistorySnapshot & {
  viewport: Viewport;
  appearance: {
    theme: 'dark' | 'light';
    canvasBackground: string | null;
  };
};

function cloneRecoverableWorldSnapshot(snapshot: RecoverableWorldSnapshot): RecoverableWorldSnapshot {
  return typeof structuredClone === 'function'
    ? structuredClone(snapshot)
    : JSON.parse(JSON.stringify(snapshot)) as RecoverableWorldSnapshot;
}

const STARTER_GOALS: StarterGoal[] = [
  {
    id: 'lesson',
    title: 'Explain or learn',
    description: 'Connect the main idea, evidence, examples, and questions.',
    icon: 'school',
    accent: '#38bdf8',
    templateId: 'lesson-plan-board',
  },
  {
    id: 'project',
    title: 'Plan work',
    description: 'Clarify goals, owners, risks, milestones, and next actions.',
    icon: 'rocket_launch',
    accent: '#22c55e',
    templateId: 'launch-operating-plan',
  },
  {
    id: 'research',
    title: 'Research a question',
    description: 'Organize sources, evidence, uncertainty, and conclusions.',
    icon: 'travel_explore',
    accent: '#06b6d4',
    templateId: 'research-evidence-wall',
  },
  {
    id: 'decision',
    title: 'Make a decision',
    description: 'Compare options, tradeoffs, evidence, owners, and next action.',
    icon: 'psychology',
    accent: '#a855f7',
    templateId: 'decision-intelligence-room',
  },
];

type CoachTip = {
  step: string;
  title: string;
  body: string;
  icon: string;
  action: CoachAction;
  actionLabel: string;
};

function getCoachTip({
  activeTool,
  nodeCount,
  relationCount,
  selectedCount,
}: {
  activeTool: string;
  nodeCount: number;
  relationCount: number;
  selectedCount: number;
}): CoachTip {
  if (activeTool === 'relation') {
    return {
      step: 'Connect',
      title: nodeCount < 2 ? 'Add two ideas first' : 'Pick source, then target',
      body: nodeCount < 2
        ? 'Relations need two elements. Add another note, shape, map pin, or text block, then connect them.'
        : 'Tap an edge or map pin, then tap the element it explains. Labels make the board easier for AI to read.',
      icon: 'hub',
      action: nodeCount < 2 ? 'add-note' : 'select-tool',
      actionLabel: nodeCount < 2 ? 'Add note' : 'Back to Select',
    };
  }

  if (activeTool === 'draw' || activeTool === 'highlighter' || activeTool === 'arrow') {
    return {
      step: 'Ink',
      title: 'Draw now, edit after',
      body: 'Finish the stroke, then switch to Select to move it, resize it, or connect it with other ideas.',
      icon: activeTool === 'arrow' ? 'arrow_outward' : 'draw',
      action: 'select-tool',
      actionLabel: 'Select tool',
    };
  }

  if (activeTool === 'map') {
    return {
      step: 'Map',
      title: 'Maps are living objects',
      body: 'Place the map, add pins, then connect exact locations to notes or evidence when the place matters.',
      icon: 'map',
      action: 'select-tool',
      actionLabel: 'Select after placing',
    };
  }

  if (nodeCount === 0) {
    return {
      step: 'Start',
      title: 'Make the first idea visible',
      body: 'Add one sticky note or use AI/templates when you want Canvio to create a first structure for you.',
      icon: 'sticky_note_2',
      action: 'add-note',
      actionLabel: 'Add sticky note',
    };
  }

  if (nodeCount === 1) {
    return {
      step: 'Build',
      title: 'Add one more idea',
      body: 'A board becomes useful when there is at least one comparison, example, question, or next step.',
      icon: 'add_box',
      action: 'add-note',
      actionLabel: 'Add another note',
    };
  }

  if (nodeCount > 1 && relationCount === 0) {
    return {
      step: 'Connect',
      title: 'Show how the ideas relate',
      body: 'Use Relation to explain cause, evidence, sequence, risk, or dependency between elements.',
      icon: 'conversion_path',
      action: 'connect',
      actionLabel: 'Connect ideas',
    };
  }

  if (selectedCount > 0) {
    return {
      step: 'Refine',
      title: 'Try a safe variation',
      body: 'Use Experiment to duplicate selected elements and explore another version without damaging the original.',
      icon: 'difference',
      action: 'select-tool',
      actionLabel: 'Keep editing',
    };
  }

  return {
    step: 'Share',
    title: 'Put the connected work to use',
    body: 'Share the live board so someone can review, contribute, or continue from the same context.',
    icon: 'ios_share',
    action: 'share',
    actionLabel: 'Share board',
  };
}

export function WorldPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const activeTool = useCanvasStore((s) => s.activeTool);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const nodeCount = useCanvasStore((s) => Object.keys(s.nodes).length);
  const relationCount = useCanvasStore((s) => Object.keys(s.relations).length);
  const canUndo = useCanvasStore((s) => s.canUndo);
  const canRedo = useCanvasStore((s) => s.canRedo);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const theme = useCanvasStore((s) => s.theme);
  const themePreference = useCanvasStore((s) => s.themePreference);
  const toggleTheme = useCanvasStore((s) => s.toggleTheme);
  const setThemePreference = useCanvasStore((s) => s.setThemePreference);
  const canvasBackground = useCanvasStore((s) => s.canvasBackground);
  const setCanvasBackground = useCanvasStore((s) => s.setCanvasBackground);
  const setAppearance = useCanvasStore((s) => s.setAppearance);
  const replaceWorld = useCanvasStore((s) => s.replaceWorld);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const branchSelectionAsExperiment = useCanvasStore((s) => s.branchSelectionAsExperiment);

  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const isAIOpen = useCanvasStore((s) => s.isAIAssistantOpen);
  const setIsAIOpen = useCanvasStore((s) => s.setAIAssistantOpen);
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const [boardRecord, setBoardRecord] = useState<BoardRecord | null>(null);
  const [isForking, setIsForking] = useState(false);
  const [isCanvioMenuOpen, setIsCanvioMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isStarterDismissed, setIsStarterDismissed] = useState(false);
  const [boardNotice, setBoardNotice] = useState<BoardNotice | null>(null);
  const [shareNameFocusSignal, setShareNameFocusSignal] = useState(0);
  const [hasLoadedCoachPreference, setHasLoadedCoachPreference] = useState(false);
  const [isCoachDismissed, setIsCoachDismissed] = useState(false);
  const [autoShapeEnabled, setAutoShapeEnabled] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const boardAppearanceLoadedRef = useRef(false);
  const saveAppearanceTimerRef = useRef<number | null>(null);
  const seededDemoWorldRef = useRef<string | null>(null);
  const recoveredWorldRef = useRef<RecoverableWorldSnapshot | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const boardVisitTelemetryRef = useRef<BoardVisitTelemetry | null>(null);
  const boardVisitWorldRef = useRef<string | null>(null);
  const telemetryOpenedWorldRef = useRef<string | null>(null);
  const telemetryInitialEmptyRef = useRef(false);
  const telemetryInitialRelationCountRef = useRef(0);
  const lastRuntimeIssueRef = useRef('');

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
    try {
      setIsStarterDismissed(window.localStorage.getItem(STARTER_DISMISS_KEY) === '1');
    } catch {
      setIsStarterDismissed(false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [activeTheme, theme]);

  useEffect(() => {
    try {
      setIsCoachDismissed(window.localStorage.getItem(COACH_DISMISS_KEY) === '1');
    } catch {
      setIsCoachDismissed(false);
    } finally {
      setHasLoadedCoachPreference(true);
    }
  }, []);

  useEffect(() => {
    setIsPresenting(false);
    setFocusNodeId(null);
    telemetryOpenedWorldRef.current = null;
    telemetryInitialEmptyRef.current = false;
    telemetryInitialRelationCountRef.current = 0;
    lastRuntimeIssueRef.current = '';
    if (worldId && boardVisitWorldRef.current !== worldId) {
      boardVisitWorldRef.current = worldId;
      boardVisitTelemetryRef.current = startBoardTelemetry(worldId);
    }
  }, [worldId]);

  useEffect(() => () => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
  }, []);

  const showBoardNotice = useCallback((notice: Omit<BoardNotice, 'id'>, timeoutMs = 5200) => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }

    setBoardNotice({ ...notice, id: Date.now() });

    if (timeoutMs > 0 && !notice.action) {
      noticeTimerRef.current = window.setTimeout(() => {
        setBoardNotice(null);
        noticeTimerRef.current = null;
      }, timeoutMs);
    }
  }, []);

  const dismissStarter = useCallback((persist = true) => {
    setIsStarterDismissed(true);
    if (!persist) return;
    try {
      window.localStorage.setItem(STARTER_DISMISS_KEY, '1');
    } catch {
      // Ignore storage errors; the starter still closes for this session.
    }
  }, []);

  const handleRestoreClearedBoard = useCallback(() => {
    const snapshot = recoveredWorldRef.current;
    if (!snapshot) return;
    replaceWorld(snapshot);
    setViewport(snapshot.viewport);
    showBoardNotice({
      kind: 'success',
      text: 'Board restored.'
    }, 2800);
  }, [replaceWorld, setViewport, showBoardNotice]);

  // One-time hint that right-click opens the Quick-add radial menu — the
  // feature is invisible otherwise (its label is hidden on desktop).
  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem('CANVIO_RADIAL_HINT_SEEN_V1') === '1';
    } catch {
      seen = false;
    }
    if (seen) return;

    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem('CANVIO_RADIAL_HINT_SEEN_V1', '1');
      } catch {
        // Storage blocked: showing the tip once per visit is fine.
      }
      showBoardNotice({
        kind: 'info',
        text: 'Tip: right-click the canvas for Quick add',
      }, 6000);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [showBoardNotice]);

  const handleFitToWorld = () => {
    const allNodes = Object.values(useCanvasStore.getState().nodes);
    if (allNodes.length > 0) {
      fitViewportToNodes(allNodes, { maxZoom: 1.05, minZoom: 0.35, paddingX: 220, paddingY: 220 });
    } else {
      setViewport({ x: 0, y: 0, zoom: 1 });
    }
  };

  const selectedFocusNodeId = selectedNodeIds[0] || null;
  const isSelectedNodeFocused = Boolean(selectedFocusNodeId && focusNodeId === selectedFocusNodeId);

  const handleFitPresentationView = () => {
    const focusedNode = focusNodeId ? useCanvasStore.getState().nodes[focusNodeId] : null;
    if (focusedNode) {
      fitViewportToNodes([focusedNode], { maxZoom: 1.2, minZoom: 0.45, paddingX: 260, paddingY: 220 });
      return;
    }
    handleFitToWorld();
  };

  const handleFocusSelectedNode = () => {
    if (!selectedFocusNodeId) return;
    const selectedNode = useCanvasStore.getState().nodes[selectedFocusNodeId];
    if (!selectedNode) return;
    setFocusNodeId(selectedFocusNodeId);
    fitViewportToNodes([selectedNode], { maxZoom: 1.2, minZoom: 0.45, paddingX: 260, paddingY: 220 });
  };

  const handleClearFocus = () => {
    setFocusNodeId(null);
    handleFitToWorld();
  };

  const handleEnterPresentation = () => {
    const selectedNode = selectedFocusNodeId
      ? useCanvasStore.getState().nodes[selectedFocusNodeId]
      : null;
    setActiveTool('select');
    setIsCanvioMenuOpen(false);
    setIsExportMenuOpen(false);
    setIsTemplateOpen(false);
    setIsAIOpen(false);
    setFocusNodeId(selectedNode ? selectedFocusNodeId : null);
    setIsPresenting(true);
    window.setTimeout(() => {
      if (selectedNode) {
        fitViewportToNodes([selectedNode], { maxZoom: 1.2, minZoom: 0.45, paddingX: 260, paddingY: 220 });
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

  const handleTogglePresentationLaser = () => {
    setActiveTool(activeTool === 'laser' ? 'select' : 'laser');
  };

  const handleNewBlankBoard = () => {
    const newId = nanoid(10);
    createBoard().catch(() => {});
    setIsCanvioMenuOpen(false);
    // Explicit "new board" intent re-arms the starter so the goal picker is
    // reachable again. Matches HomePage's Start-a-blank-board behavior.
    try {
      window.localStorage.removeItem(STARTER_DISMISS_KEY);
    } catch {}
    setIsStarterDismissed(false);
    navigate(`/w/${newId}`);
  };

  const handleOpenSampleBoard = () => {
    setIsCanvioMenuOpen(false);
    setIsTemplateOpen(false);
    setIsExportMenuOpen(false);
    navigate(`/w/${DEMO_BOARD_PREFIX}${nanoid(8)}`);
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

  const handleDismissCoach = () => {
    setIsCoachDismissed(true);
    try {
      window.localStorage.setItem(COACH_DISMISS_KEY, '1');
    } catch {
      // Ignore storage errors; the visible state still updates for this session.
    }
  };

  const handleShowCoach = () => {
    setIsCoachDismissed(false);
    dismissStarter();
    setIsCanvioMenuOpen(false);
    setIsExportMenuOpen(false);
    try {
      window.localStorage.removeItem(COACH_DISMISS_KEY);
    } catch {
      // Ignore storage errors; the guide still opens for this session.
    }
  };

  const handleCoachAction = (action: CoachAction) => {
    if (action === 'add-note') {
      setActiveTool('sticky');
      return;
    }
    if (action === 'connect') {
      setActiveTool('relation');
      return;
    }
    if (action === 'open-ai') {
      setIsAIOpen(true);
      return;
    }
    if (action === 'open-templates') {
      setIsTemplateOpen(true);
      return;
    }
    if (action === 'share') {
      setShareNameFocusSignal(Date.now());
      return;
    }
    setActiveTool('select');
  };

  const handleStartFromScratch = (reset = false) => {
    const store = useCanvasStore.getState();
    const hasContent = Object.keys(store.nodes).length > 0 || Object.keys(store.relations).length > 0 || store.inkStrokes.length > 0;
    if (reset && hasContent) {
      recoveredWorldRef.current = cloneRecoverableWorldSnapshot({
        nodes: store.nodes,
        relations: store.relations,
        inkStrokes: store.inkStrokes,
        viewport: store.viewport,
        appearance: { theme, canvasBackground },
      });
    }

    dismissStarter();
    replaceWorld({
      nodes: {},
      relations: {},
      viewport: { x: 0, y: 0, zoom: 1 },
      appearance: { theme, canvasBackground },
    });
    setActiveTool('select');
    setViewport({ x: 0, y: 0, zoom: 1 });

    if (reset && hasContent) {
      showBoardNotice({
        kind: 'warning',
        text: 'Board cleared. You can restore the previous version.',
        action: 'restore-cleared-board',
        actionLabel: 'Restore'
      }, 0);
    }
  };

  const handleStartTemplate = (templateId: string) => {
    dismissStarter();
    applyTemplate(templateId);
    clearSelection();
    setActiveTool('select');
  };

  useEffect(() => {
    if (!worldId) return;
    // Ensure a server-side board record exists for this world and unlock the
    // appearance autosave effect below once the initial load settles.
    let cancelled = false;
    touchBoard(worldId)
      .then(() => {
        if (!cancelled) boardAppearanceLoadedRef.current = true;
      })
      .catch(() => {
        // Offline or server unreachable: keep autosave disabled so theme
        // changes remain local-only instead of erroring in the background.
      });
    return () => {
      cancelled = true;
    };
  }, [worldId]);

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

  const handleForkWorld = async () => {
    if (!worldId || isForking) return;
    setIsForking(true);
    setBoardNotice(null);
    try {
      const forked = await forkBoard(worldId);
      if (forked?.url) {
        navigate(forked.url);
      }
    } catch (err) {
      console.error('Failed to fork world:', err);
      showBoardNotice({
        kind: 'error',
        text: 'Unable to remix board. Check your connection and try again.',
        action: 'retry-fork',
        actionLabel: 'Retry'
      }, 0);
    } finally {
      setIsForking(false);
    }
  };

  const handleBoardNoticeAction = () => {
    if (!boardNotice?.action) return;
    if (boardNotice.action === 'restore-cleared-board') {
      handleRestoreClearedBoard();
      return;
    }
    if (boardNotice.action === 'retry-fork') {
      handleForkWorld();
    }
  };

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

  // Ctrl+K opens Canvio AI; Ctrl+Shift+R opens the Reasoning Partner.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsAIOpen(!useCanvasStore.getState().isAIAssistantOpen);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setIsReasoningOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!focusNodeId) return;
    if (!useCanvasStore.getState().nodes[focusNodeId]) {
      setFocusNodeId(null);
      return;
    }

    return useCanvasStore.subscribe((state) => {
      if (!state.nodes[focusNodeId]) setFocusNodeId(null);
    });
  }, [focusNodeId]);

  useEffect(() => {
    if (!isPresenting) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        handleExitPresentation();
        return;
      }
      if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setActiveTool(useCanvasStore.getState().activeTool === 'laser' ? 'select' : 'laser');
        return;
      }
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleFitPresentationView();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPresenting, focusNodeId]);

  useEffect(() => {
    if (!isPresenting) return;
    let fitTimer: number | null = null;
    const handlePresentationResize = () => {
      if (fitTimer !== null) window.clearTimeout(fitTimer);
      fitTimer = window.setTimeout(handleFitPresentationView, 120);
    };
    window.addEventListener('resize', handlePresentationResize);
    return () => {
      window.removeEventListener('resize', handlePresentationResize);
      if (fitTimer !== null) window.clearTimeout(fitTimer);
    };
  }, [isPresenting, focusNodeId]);

  // Connect to collaboration
  const { connected, connectionIssue, users, persistenceState, retryConnection } = useCollaboration(worldId || '');
  const isDemoWorld = Boolean(worldId?.startsWith(DEMO_BOARD_PREFIX));
  const toolGuidance = TOOL_GUIDANCE[activeTool] || TOOL_GUIDANCE.select;
  const showStarter = nodeCount === 0 && !isStarterDismissed && !isPresenting;

  useEffect(() => {
    if (!worldId || telemetryOpenedWorldRef.current === worldId) return;
    if (persistenceState === 'loading' && !connectionIssue) return;

    // Route changes can render once with the previous board's persistence
    // state. A short settling window lets collaboration reset and hydrate.
    const timer = window.setTimeout(() => {
      if (telemetryOpenedWorldRef.current === worldId) return;
      const currentStore = useCanvasStore.getState();
      const settledNodeCount = Object.keys(currentStore.nodes).length;
      const settledRelationCount = Object.keys(currentStore.relations).length;
      telemetryOpenedWorldRef.current = worldId;
      telemetryInitialEmptyRef.current = settledNodeCount === 0;
      telemetryInitialRelationCountRef.current = settledRelationCount;
      const visit = boardVisitTelemetryRef.current || startBoardTelemetry(worldId);
      const hasShareToken = new URLSearchParams(window.location.search).has('share');
      trackBoardEvent(worldId, 'board_opened', {
        entry: isDemoWorld ? 'demo' : hasShareToken ? 'share' : 'direct',
        nodeCount: settledNodeCount,
        relationCount: settledRelationCount,
      });
      if (visit.isReturn) {
        trackBoardEvent(worldId, 'board_returned', { returnAfterMinutes: visit.returnAfterMinutes });
      }
      if (hasShareToken) {
        trackBoardEvent(worldId, 'share_opened', {});
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [worldId, persistenceState, connectionIssue, isDemoWorld, nodeCount, relationCount]);

  useEffect(() => {
    if (!worldId || telemetryOpenedWorldRef.current !== worldId || !telemetryInitialEmptyRef.current || nodeCount === 0) return;
    if (!markBoardTelemetryMilestone(worldId, 'first-element')) return;
    const openedAt = boardVisitTelemetryRef.current?.openedAt || Date.now();
    trackBoardEvent(worldId, 'first_element_created', {
      elementCount: nodeCount,
      activationMs: Math.min(86_400_000, Math.max(0, Date.now() - openedAt)),
    });
  }, [worldId, nodeCount]);

  useEffect(() => {
    if (!worldId || telemetryOpenedWorldRef.current !== worldId || telemetryInitialRelationCountRef.current > 0 || relationCount === 0) return;
    if (!markBoardTelemetryMilestone(worldId, 'first-relation')) return;
    const openedAt = boardVisitTelemetryRef.current?.openedAt || Date.now();
    trackBoardEvent(worldId, 'first_relation_created', {
      relationCount,
      activationMs: Math.min(86_400_000, Math.max(0, Date.now() - openedAt)),
    });
  }, [worldId, relationCount]);

  useEffect(() => {
    if (!worldId || !connectionIssue) return;
    const issueKey = `collaboration:${connectionIssue}`;
    if (lastRuntimeIssueRef.current === issueKey) return;
    lastRuntimeIssueRef.current = issueKey;
    trackBoardEvent(worldId, 'runtime_issue', {
      area: 'collaboration',
      code: connectionIssue.toLowerCase().includes('offline') ? 'offline' : 'connection_failed',
      recoverable: true,
    });
  }, [worldId, connectionIssue]);

  useEffect(() => {
    if (!worldId || persistenceState !== 'error') return;
    const issueKey = 'persistence:local-save';
    if (lastRuntimeIssueRef.current === issueKey) return;
    lastRuntimeIssueRef.current = issueKey;
    trackBoardEvent(worldId, 'runtime_issue', {
      area: 'persistence',
      code: 'local_save_failed',
      recoverable: true,
    });
  }, [worldId, persistenceState]);

  useEffect(() => {
    if (!worldId) return;
    const handleRuntimeIssue = (event: Event) => {
      const detail = (event as CustomEvent<{ area?: string; code?: string }>).detail;
      if (detail?.area !== 'map' || detail.code !== 'tile_load_failed') return;
      trackBoardEvent(worldId, 'runtime_issue', {
        area: 'map',
        code: 'tile_load_failed',
        recoverable: true,
      });
    };
    window.addEventListener('canvio:runtime-issue', handleRuntimeIssue);
    return () => window.removeEventListener('canvio:runtime-issue', handleRuntimeIssue);
  }, [worldId]);

  useEffect(() => {
    if (!showStarter) return;

    const handleStarterKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      dismissStarter();
    };

    window.addEventListener('keydown', handleStarterKeyDown);
    return () => window.removeEventListener('keydown', handleStarterKeyDown);
  }, [showStarter, dismissStarter]);

  const coachTip = getCoachTip({
    activeTool,
    nodeCount,
    relationCount,
    selectedCount: selectedNodeIds.length,
  });
  const showCoach = hasLoadedCoachPreference && !isCoachDismissed && !showStarter && !isPresenting && !isDemoWorld;
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
  const saveShortLabel = persistenceState === 'loading'
    ? 'Restoring'
    : persistenceState === 'saving'
      ? 'Saving'
      : persistenceState === 'error'
        ? 'Attention'
        : connected
          ? 'Live'
          : 'Local';

  const seedDemoBoardIfEmpty = useCallback(() => {
    if (!worldId || seededDemoWorldRef.current === worldId) return;
    const store = useCanvasStore.getState();
    if (Object.keys(store.nodes).length > 0 || Object.keys(store.relations).length > 0) {
      seededDemoWorldRef.current = worldId;
      dismissStarter();
      return;
    }

    seededDemoWorldRef.current = worldId;
    dismissStarter();
    applyTemplate(DEMO_TEMPLATE_ID);
    useCanvasStore.getState().clearSelection();
    setActiveTool('select');
  }, [worldId, dismissStarter, setActiveTool]);

  useEffect(() => {
    if (!isDemoWorld || persistenceState === 'loading' && !connectionIssue) return;
    seedDemoBoardIfEmpty();
  }, [isDemoWorld, persistenceState, connectionIssue, seedDemoBoardIfEmpty]);

  useEffect(() => {
    if (!isDemoWorld) return;
    const timer = window.setTimeout(seedDemoBoardIfEmpty, 1300);
    return () => window.clearTimeout(timer);
  }, [isDemoWorld, seedDemoBoardIfEmpty]);

  return (
    <div className={`world-page ${isPresenting ? 'is-presenting' : ''}`} data-tool={activeTool} style={worldStyle}>
      <Canvas
        worldId={worldId || ''}
        autoShapeEnabled={autoShapeEnabled}
        presentationMode={isPresenting}
        focusNodeId={focusNodeId}
      />

      {showStarter && (
        <div
          className="world-page__empty-launcher"
          role="dialog"
          aria-modal="true"
          aria-labelledby="starter-title"
          onClick={() => dismissStarter()}
        >
          {/* Subtle animated magical background for empty state */}
          <div className="world-page__empty-bg-glow"></div>
          
          <div className="world-page__empty-hero" onClick={(e) => e.stopPropagation()}>
            <span className="world-page__empty-kicker">A simple place to think</span>
            <h1 id="starter-title" className="world-page__empty-title">
              What are you working on?
            </h1>
            <p className="world-page__empty-subtitle">
              Start clean or choose the result you need. Everything stays editable.
            </p>
          </div>

          <div className="world-page__starter-panel" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="world-page__starter-close"
              onClick={() => dismissStarter()}
              aria-label="Close starter and use blank canvas"
              title="Close starter"
            >
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
            <div className="world-page__starter-section">
              <span className="world-page__starter-label">Clean start</span>
              <button
                className="world-page__starter-card world-page__starter-card--blank"
                onClick={() => handleStartFromScratch(false)}
                aria-label="Start from scratch"
              >
                <span className="world-page__starter-card-icon material-symbols-outlined" aria-hidden="true">edit_note</span>
                <span className="world-page__starter-card-copy">
                  <strong>Start from scratch</strong>
                  <small>Open a clean board and build freely.</small>
                </span>
              </button>
            </div>
            <div className="world-page__starter-section world-page__starter-section--wide">
              <span className="world-page__starter-label">Start with an outcome</span>
              <div className="world-page__starter-grid">
                {STARTER_GOALS.map((goal) => (
                  <button
                    key={goal.id}
                    className="world-page__starter-card world-page__starter-card--goal"
                    style={{ '--starter-accent': goal.accent } as React.CSSProperties}
                    onClick={() => handleStartTemplate(goal.templateId)}
                    aria-label={`Start with ${goal.title.toLowerCase()}`}
                  >
                    <span className="world-page__starter-card-icon material-symbols-outlined" aria-hidden="true">
                      {goal.icon}
                    </span>
                    <span className="world-page__starter-card-copy">
                      <strong>{goal.title}</strong>
                      <small>{goal.description}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="world-page__starter-actions">
              <button
                className="world-page__starter-link world-page__starter-link--sample"
                onClick={handleOpenSampleBoard}
              >
                <span className="material-symbols-outlined text-xl">preview</span>
                <span>Sample board</span>
              </button>
              <button
                className="world-page__starter-link"
                onClick={() => {
                  setIsTemplateOpen(true);
                  dismissStarter();
                }}
              >
                <span className="material-symbols-outlined text-xl">space_dashboard</span>
                <span>Templates</span>
              </button>
              <button
                className="world-page__starter-link world-page__starter-link--ai"
                onClick={() => {
                  setIsAIOpen(true);
                  dismissStarter();
                }}
              >
                <span className="material-symbols-outlined text-xl">auto_awesome</span>
                <span>Ask AI</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {!showStarter && nodeCount === 0 && !isPresenting && !isDemoWorld && !showCoach && persistenceState !== 'loading' && (
        <div className="world-page__empty-hint" role="status" aria-live="polite">
          <span>Board is empty —</span>
          <button type="button" onClick={() => setActiveTool('sticky')}>
            Add note
          </button>
          <span>or press</span>
          <kbd>T</kbd>
          <span>or right-click for Quick add</span>
          <span className="world-page__empty-hint-sep">·</span>
          <button
            type="button"
            className="world-page__empty-hint-link"
            onClick={() => {
              try {
                window.localStorage.removeItem(STARTER_DISMISS_KEY);
              } catch {}
              setIsStarterDismissed(false);
            }}
          >
            Show starter
          </button>
        </div>
      )}

      <Cursors users={users} />
      {showCoach && (
        <aside className="world-page__coach" aria-label="Canvio guide" aria-live="polite">
          <div className="world-page__coach-top">
            <span className="world-page__coach-step">
              <span className="material-symbols-outlined" aria-hidden="true">{coachTip.icon}</span>
              {coachTip.step}
            </span>
            <button
              type="button"
              className="world-page__coach-close"
              onClick={handleDismissCoach}
              aria-label="Hide Canvio guide"
              title="Hide guide"
            >
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>
          <strong>{coachTip.title}</strong>
          <p>{coachTip.body}</p>
          <div className="world-page__coach-actions">
            <button
              type="button"
              className="world-page__coach-primary"
              onClick={() => handleCoachAction(coachTip.action)}
            >
              {coachTip.actionLabel}
            </button>
            <button
              type="button"
              className="world-page__coach-secondary"
              onClick={handleDismissCoach}
            >
              Got it
            </button>
          </div>
        </aside>
      )}
      {boardNotice && !isPresenting && (
        <div
          className={`world-page__notice world-page__notice--${boardNotice.kind}`}
          role="status"
          aria-live="polite"
        >
          <span className="world-page__notice-icon material-symbols-outlined" aria-hidden="true">
            {boardNotice.kind === 'error' ? 'error' : boardNotice.kind === 'warning' ? 'restart_alt' : 'check_circle'}
          </span>
          <span className="world-page__notice-text">{boardNotice.text}</span>
          {boardNotice.action && boardNotice.actionLabel && (
            <button
              type="button"
              className="world-page__notice-action"
              onClick={handleBoardNoticeAction}
            >
              {boardNotice.actionLabel}
            </button>
          )}
          <button
            type="button"
            className="world-page__notice-close"
            onClick={() => setBoardNotice(null)}
            aria-label="Dismiss notice"
            title="Dismiss"
          >
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
      )}
      {!isPresenting && (
        <>
          {!showStarter && (
            <div className="world-page__tool-status" role="status" aria-live="polite">
              <span className="world-page__tool-status-main">
                <span className="material-symbols-outlined">{activeTool === 'select' ? 'near_me' : 'edit'}</span>
                <strong>{toolGuidance.label}</strong>
              </span>
              <span className="world-page__tool-status-detail">{toolGuidance.detail}</span>
              {activeTool !== 'select' && <kbd>Esc</kbd>}
              {nodeCount > 0 && (
                <button
                  type="button"
                  className="world-page__tool-status-fit"
                  onClick={handleFitToWorld}
                  title="Fit board to view (F)"
                  aria-label="Fit board to view"
                >
                  <span className="material-symbols-outlined">fit_screen</span>
                  Fit
                </button>
              )}
            </div>
          )}
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
          <button
            className="presentation-control-btn presentation-control-btn--primary"
            onClick={handleExitPresentation}
            title="Exit presentation (Esc)"
            aria-label="Exit presentation"
          >
            <span className="material-symbols-outlined">close_fullscreen</span>
            <span>Exit</span>
          </button>
          <button
            className={`presentation-control-btn ${activeTool === 'laser' ? 'is-active' : ''}`}
            onClick={handleTogglePresentationLaser}
            title={activeTool === 'laser' ? 'Return to board navigation (L)' : 'Use laser pointer (L)'}
            aria-label={activeTool === 'laser' ? 'Return to board navigation' : 'Use laser pointer'}
            aria-pressed={activeTool === 'laser'}
          >
            <span className="material-symbols-outlined">{activeTool === 'laser' ? 'pan_tool' : 'flare'}</span>
            <span>{activeTool === 'laser' ? 'Pan' : 'Laser'}</span>
          </button>
          <button
            className="presentation-control-btn"
            onClick={handleFocusSelectedNode}
            disabled={!selectedFocusNodeId}
            title="Focus selected element"
            aria-label="Focus selected element"
          >
            <span className="material-symbols-outlined">filter_center_focus</span>
            <span>Focus</span>
          </button>
          <button
            className="presentation-control-btn"
            onClick={handleClearFocus}
            disabled={!focusNodeId}
            title="Clear focus"
            aria-label="Show all elements"
          >
            <span className="material-symbols-outlined">visibility</span>
            <span>All</span>
          </button>
          <button
            className="presentation-control-btn"
            onClick={handleFitPresentationView}
            title="Fit view (F)"
            aria-label="Fit presentation view"
          >
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
            aria-label="Create experiment from selected elements"
          >
            <span className="material-symbols-outlined">difference</span>
            <span>Experiment</span>
          </button>
          <button
            className="selection-quick-actions__btn"
            onClick={isSelectedNodeFocused ? handleClearFocus : handleFocusSelectedNode}
            title={isSelectedNodeFocused ? 'Show all elements' : 'Spotlight selected element'}
            aria-label={isSelectedNodeFocused ? 'Show all elements' : 'Focus selected element'}
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

              <button className="canvio-menu-item" onClick={handleOpenSampleBoard}>
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                <span>Open Sample Board</span>
              </button>

              {nodeCount > 0 && (
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
                  setIsExportMenuOpen(true);
                  setIsCanvioMenuOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-sm">ios_share</span>
                <span>Export or Restore</span>
              </button>

              <button
                className="canvio-menu-item"
                onClick={() => {
                  setIsTemplateOpen(true);
                  setIsCanvioMenuOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-sm">space_dashboard</span>
                <span>Templates</span>
              </button>

              <button
                className="canvio-menu-item"
                onClick={handleShowCoach}
              >
                <span className="material-symbols-outlined text-sm">help</span>
                <span>Show Canvio Guide</span>
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
                  setIsCanvioMenuOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-sm">
                  {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                </span>
                <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
              </button>

              <button
                className="canvio-menu-item"
                onClick={() => {
                  setThemePreference('system');
                  setIsCanvioMenuOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-sm">devices</span>
                <span>Use Device Theme</span>
                {themePreference === 'system' && (
                  <span className="material-symbols-outlined text-sm" style={{ marginLeft: 'auto' }}>check</span>
                )}
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

          <button
            className="world-header__surface-btn"
            onClick={() => {
              setIsTemplateOpen(true);
              setIsCanvioMenuOpen(false);
              setIsExportMenuOpen(false);
            }}
            aria-label="Templates"
            aria-haspopup="dialog"
            aria-expanded={isTemplateOpen}
            title="Open templates"
          >
            <span className="material-symbols-outlined" aria-hidden="true">space_dashboard</span>
            <span className="world-header__surface-btn-label">Templates</span>
          </button>
        </div>

        {/* Center: direct access to board-aware AI. */}
        <div className="world-header__center">
          <button
            className="ai-navigator-pill"
            onClick={() => setIsAIOpen(true)}
            aria-label="Open Canvio AI"
            title="Ask Canvio (Ctrl+K)"
          >
            <span className="material-symbols-outlined text-base">auto_awesome</span>
            <span>Ask Canvio</span>
          </button>
        </div>

        {/* Right: Undo, Redo, Divider, Robot AI & Share */}
        <div className="world-header__right">
          <button
            className={`header-ai-btn header-ai-btn--guide ${showCoach ? 'active' : ''}`}
            onClick={handleShowCoach}
            aria-label="Show Canvio Guide"
            aria-pressed={showCoach}
            title="Show Canvio guide"
          >
            <span className="material-symbols-outlined text-base">help</span>
          </button>

          <button
            className="header-icon-btn"
            onClick={() => useCanvasStore.getState().undo()}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
          >
            <IconUndo size={18} />
          </button>

          <button
            className="header-icon-btn header-icon-btn--redo"
            onClick={() => useCanvasStore.getState().redo()}
            disabled={!canRedo}
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
            className={`header-ai-btn header-ai-btn--reasoning ${isReasoningOpen ? 'active' : ''}`}
            onClick={() => setIsReasoningOpen((prev) => !prev)}
            aria-label="Visual Reasoning Partner & Graph Health"
            title="Visual Reasoning Partner & Graph Health (Ctrl+Shift+R)"
          >
            <span className="material-symbols-outlined text-base">psychology</span>
          </button>

          <button
            className="header-ai-btn header-ai-btn--mobile-ai"
            onClick={() => setIsAIOpen(true)}
            aria-label="Open Canvio AI"
            title="Ask Canvio (Ctrl+K)"
          >
            <span className="material-symbols-outlined text-base">auto_awesome</span>
          </button>

          <ShareButton worldId={worldId || ''} focusNameSignal={shareNameFocusSignal} collaboratorCount={users.length} />

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
              <span>{saveShortLabel}</span>
            </span>
          )}

          {/* Overlapping Multiplayer Avatar Stack */}
          <div className="presence-avatar-stack" title={`${users.length + 1} online collaborator${users.length > 0 ? 's' : ''}`}>
            {/* Host / Current User Avatar — click to set your display name */}
            <button
              type="button"
              className="presence-avatar presence-avatar--self"
              style={{ borderColor: '#8083ff', zIndex: 30 }}
              title="Change your display name"
              aria-label="Change your display name"
              onClick={() => setShareNameFocusSignal(Date.now())}
            >
              <span className="material-symbols-outlined text-sm">person</span>
            </button>

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

      {isTemplateOpen && (
        <Suspense fallback={<div className="world-page__panel-loading" role="status">Opening templates...</div>}>
          <TemplatePicker
            isOpen
            onClose={() => setIsTemplateOpen(false)}
            onStartBlank={() => {
              handleStartFromScratch(true);
              setIsTemplateOpen(false);
            }}
          />
        </Suspense>
      )}

      {isAIOpen && (
        <Suspense fallback={<div className="world-page__panel-loading" role="status">Opening Canvio AI...</div>}>
          <AIAssistantModal isOpen onClose={() => setIsAIOpen(false)} />
        </Suspense>
      )}

      {isReasoningOpen && (
        <Suspense fallback={<div className="world-page__panel-loading" role="status">Opening Reasoning Partner...</div>}>
          <GraphIntelligence
            isOpen
            onClose={() => setIsReasoningOpen(false)}
            onFocusNode={setFocusNodeId}
          />
        </Suspense>
      )}

      {!isPresenting && <Minimap />}
    </div>
  );
}
