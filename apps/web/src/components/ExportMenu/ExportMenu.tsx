import React, { useEffect, useRef, useState } from 'react';
import { LivingNode, Relation, Viewport, useCanvasStore } from '../../store/canvasStore';
import { exportAsJSON, exportAsPNG } from '../../utils/exportUtils';
import { PRESET_TEMPLATES } from '../../utils/presetTemplates';
import './ExportMenu.css';

interface ExportMenuProps {
  worldId: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export function ExportMenu({ worldId, isOpen, onToggle, onClose, containerRef }: ExportMenuProps) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const refToUse = containerRef || localRef;
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [exporting, setExporting] = useState<'png' | 'json' | 'import' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const nodes = useCanvasStore((s) => s.nodes);
  const relations = useCanvasStore((s) => s.relations);
  const addNode = useCanvasStore((s) => s.addNode);
  const addRelation = useCanvasStore((s) => s.addRelation);
  const nextZIndex = useCanvasStore((s) => s.nextZIndex);
  const viewport = useCanvasStore((s) => s.viewport);
  const replaceWorld = useCanvasStore((s) => s.replaceWorld);

  useEffect(() => {
    if (!exportStatus && !exportError) return;
    const timeout = window.setTimeout(() => {
      setExportStatus(null);
      setExportError(null);
    }, 7000);
    return () => window.clearTimeout(timeout);
  }, [exportStatus, exportError]);

  const handleSpawnPreset = (presetId: string) => {
    const preset = PRESET_TEMPLATES.find((p) => p.id === presetId);
    if (!preset) return;

    const centerX = -viewport.x;
    const centerY = -viewport.y;

    const { nodes: newNodes, relations: newRelations } = preset.create(centerX, centerY, nextZIndex);

    newNodes.forEach((n) => addNode(n));
    newRelations.forEach((r) => addRelation(r));
    setShowPresets(false);
    onClose();
  };

  const handleExportPNG = async () => {
    try {
      setExporting('png');
      setExportError(null);
      setExportStatus(null);
      await exportAsPNG(worldId);
      setExportStatus('PNG export ready');
      onClose();
    } catch {
      setExportError('PNG export failed');
    } finally {
      setExporting(null);
    }
  };

  const handleExportJSON = () => {
    try {
      setExporting('json');
      setExportError(null);
      setExportStatus(null);
      exportAsJSON(nodes, relations, worldId);
      setExportStatus('JSON backup ready');
      onClose();
    } catch {
      setExportError('JSON export failed');
    } finally {
      setExporting(null);
    }
  };

  const handleImportJSON = async (file: File | null) => {
    if (!file) return;

    try {
      setExporting('import');
      setExportError(null);
      setExportStatus(null);
      const text = await file.text();
      const backup = parseCanvioBackup(text);
      replaceWorld(backup);
      setExportStatus(`Restored ${Object.keys(backup.nodes).length} nodes`);
      setShowPresets(false);
      onClose();
    } catch {
      setExportError('Import failed: choose a Canvio JSON backup');
    } finally {
      setExporting(null);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  return (
    <div className="export-menu-container" ref={refToUse}>
      <button
        className="export-menu__trigger-btn"
        onClick={onToggle}
        title="Export & Import Options"
      >
        <span className="material-symbols-outlined text-sm">ios_share</span>
        <span>Export</span>
      </button>

      {(exportStatus || exportError) && (
        <div className={`export-menu__status-chip ${exportError ? 'export-menu__status-chip--error' : ''}`} role="status">
          {exportError || exportStatus}
        </div>
      )}

      {isOpen && (
        <div className="canvio-dropdown-menu export-menu__popover">
          <button
            className="canvio-menu-item"
            onClick={() => setShowPresets(!showPresets)}
          >
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            <span>Spawn Diagram Preset</span>
            <span className="material-symbols-outlined text-xs" style={{ marginLeft: 'auto' }}>
              {showPresets ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {showPresets && (
            <div className="export-menu__preset-list">
              {PRESET_TEMPLATES.map((p) => (
                <button
                  key={p.id}
                  className="export-menu__preset-item"
                  onClick={() => handleSpawnPreset(p.id)}
                >
                  <span className="material-symbols-outlined text-sm">{p.icon}</span>
                  <div className="export-menu__preset-info">
                    <div className="export-menu__preset-title">{p.name}</div>
                    <div className="export-menu__preset-desc">{p.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="canvio-menu-divider" />

          <button
            className="canvio-menu-item"
            disabled={exporting !== null}
            onClick={handleExportPNG}
          >
            <span className="material-symbols-outlined text-sm">image</span>
            <span>{exporting === 'png' ? 'Exporting PNG...' : 'Export Image (PNG)'}</span>
          </button>

          <button
            className="canvio-menu-item"
            disabled={exporting !== null}
            onClick={handleExportJSON}
          >
            <span className="material-symbols-outlined text-sm">code</span>
            <span>{exporting === 'json' ? 'Exporting JSON...' : 'Export Backup (JSON)'}</span>
          </button>

          <button
            className="canvio-menu-item"
            disabled={exporting !== null}
            onClick={() => importInputRef.current?.click()}
          >
            <span className="material-symbols-outlined text-sm">history_toggle_off</span>
            <span>{exporting === 'import' ? 'Restoring Backup...' : 'Restore Backup (JSON)'}</span>
          </button>

          <input
            ref={importInputRef}
            className="export-menu__file-input"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void handleImportJSON(event.currentTarget.files?.[0] || null)}
          />
        </div>
      )}
    </div>
  );
}

function parseCanvioBackup(text: string): {
  nodes: Record<string, LivingNode>;
  relations: Record<string, Relation>;
  viewport?: Viewport;
  appearance?: { theme?: 'dark' | 'light'; canvasBackground?: string | null };
} {
  const parsed = JSON.parse(text) as {
    nodes?: unknown;
    relations?: unknown;
    viewport?: unknown;
    appearance?: unknown;
  };
  const nodes = isNodeRecord(parsed.nodes) ? parsed.nodes : null;
  const relations = isRelationRecord(parsed.relations) ? parsed.relations : null;
  if (!nodes || !relations) {
    throw new Error('Invalid Canvio backup');
  }

  return {
    nodes,
    relations: sanitizeRelations(relations, nodes),
    viewport: isViewport(parsed.viewport) ? {
      x: parsed.viewport.x,
      y: parsed.viewport.y,
      zoom: Math.min(5, Math.max(0.1, parsed.viewport.zoom)),
    } : undefined,
    appearance: isAppearance(parsed.appearance) ? parsed.appearance : undefined,
  };
}

function isNodeRecord(value: unknown): value is Record<string, LivingNode> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([id, node]) => (
    Boolean(id) &&
    Boolean(node) &&
    typeof node === 'object' &&
    (node as LivingNode).id === id &&
    typeof (node as LivingNode).type === 'string' &&
    isPoint((node as LivingNode).position) &&
    isSize((node as LivingNode).size)
  ));
}

function isRelationRecord(value: unknown): value is Record<string, Relation> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([id, relation]) => (
    Boolean(id) &&
    Boolean(relation) &&
    typeof relation === 'object' &&
    (relation as Relation).id === id &&
    typeof (relation as Relation).sourceId === 'string' &&
    typeof (relation as Relation).targetId === 'string'
  ));
}

function sanitizeRelations(relations: Record<string, Relation>, nodes: Record<string, LivingNode>) {
  return Object.fromEntries(Object.entries(relations).filter(([, relation]) => (
    Boolean(nodes[relation.sourceId]) && Boolean(nodes[relation.targetId])
  )));
}

function isPoint(value: unknown): value is { x: number; y: number } {
  return Boolean(value) && typeof value === 'object' &&
    Number.isFinite((value as { x?: unknown }).x) &&
    Number.isFinite((value as { y?: unknown }).y);
}

function isSize(value: unknown): value is { width: number; height: number } {
  return Boolean(value) && typeof value === 'object' &&
    Number.isFinite((value as { width?: unknown }).width) &&
    Number.isFinite((value as { height?: unknown }).height);
}

function isViewport(value: unknown): value is Viewport {
  return isPoint(value) && Number.isFinite((value as { zoom?: unknown }).zoom);
}

function isAppearance(value: unknown): value is { theme?: 'dark' | 'light'; canvasBackground?: string | null } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const appearance = value as { theme?: unknown; canvasBackground?: unknown };
  return (
    (appearance.theme === undefined || appearance.theme === 'dark' || appearance.theme === 'light') &&
    (appearance.canvasBackground === undefined || appearance.canvasBackground === null || typeof appearance.canvasBackground === 'string')
  );
}
