import React, { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { CanvioBackupError, parseCanvioBackup } from '../../utils/backupSchema';
import { exportAsJSON, exportAsPDF, exportAsPNG } from '../../utils/exportUtils';
import { PRESET_TEMPLATES } from '../../utils/presetTemplates';
import { fitTemplateToViewport } from '../../utils/viewportFit';
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
  const [exporting, setExporting] = useState<'png' | 'pdf' | 'json' | 'import' | null>(null);
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
    fitTemplateToViewport(newNodes);
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

  const handleExportPDF = async () => {
    try {
      setExporting('pdf');
      setExportError(null);
      setExportStatus(null);
      await exportAsPDF(worldId);
      setExportStatus('PDF document ready');
      onClose();
    } catch {
      setExportError('PDF export failed');
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
      const result = parseCanvioBackup(text);
      replaceWorld(result.world);
      const warningText = result.meta.warnings.length > 0 ? ` (${result.meta.warnings[0]})` : '';
      setExportStatus(`Restored ${Object.keys(result.world.nodes).length} nodes${warningText}`);
      setShowPresets(false);
      onClose();
    } catch (error) {
      setExportError(error instanceof CanvioBackupError ? error.message : 'Import failed: choose a Canvio JSON backup');
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
            onClick={handleExportPDF}
          >
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
            <span>{exporting === 'pdf' ? 'Exporting PDF...' : 'Export Document (PDF)'}</span>
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
