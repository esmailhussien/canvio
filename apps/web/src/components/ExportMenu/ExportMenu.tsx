import React, { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { CanvioBackupError, parseCanvioBackup } from '../../utils/backupSchema';
import { exportAsJSON, exportAsPDF, exportAsPNG } from '../../utils/exportUtils';
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
  const [exporting, setExporting] = useState<'png' | 'pdf' | 'json' | 'import' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const nodes = useCanvasStore((s) => s.nodes);
  const relations = useCanvasStore((s) => s.relations);
  const inkStrokes = useCanvasStore((s) => s.inkStrokes);
  const viewport = useCanvasStore((s) => s.viewport);
  const theme = useCanvasStore((s) => s.theme);
  const canvasBackground = useCanvasStore((s) => s.canvasBackground);
  const replaceWorld = useCanvasStore((s) => s.replaceWorld);
  const setViewport = useCanvasStore((s) => s.setViewport);

  // replaceWorld clears local undo history, so recovery uses an explicit
  // pre-import snapshot instead of the history stack.
  const preImportSnapshotRef = useRef<{
    nodes: typeof nodes;
    relations: typeof relations;
    inkStrokes: typeof inkStrokes;
    viewport: typeof viewport;
    appearance: { theme: 'dark' | 'light'; canvasBackground: string | null };
  } | null>(null);

  useEffect(() => {
    if (!exportStatus && !exportError) return;
    // Restore statuses carry an Undo action — keep them until acted on
    // (matches the cleared-board notice pattern) instead of auto-clearing.
    if (exportStatus?.startsWith('Restored') && !exportError) return;
    const timeout = window.setTimeout(() => {
      setExportStatus(null);
      setExportError(null);
    }, 7000);
    return () => window.clearTimeout(timeout);
  }, [exportStatus, exportError]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

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
      preImportSnapshotRef.current = {
        nodes,
        relations,
        inkStrokes,
        viewport,
        appearance: { theme, canvasBackground },
      };
      replaceWorld(result.world);
      const warningText = result.meta.warnings.length > 0 ? ` (${result.meta.warnings[0]})` : '';
      setExportStatus(`Restored ${Object.keys(result.world.nodes).length} nodes${warningText}`);
      onClose();
    } catch (error) {
      setExportError(error instanceof CanvioBackupError ? error.message : 'Import failed: choose a Canvio JSON backup');
    } finally {
      setExporting(null);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleUndoImport = () => {
    const snapshot = preImportSnapshotRef.current;
    if (!snapshot) return;
    replaceWorld(snapshot);
    setViewport(snapshot.viewport);
    preImportSnapshotRef.current = null;
    setExportStatus('Import undone');
    setExportError(null);
  };

  return (
    <div className="export-menu-container" ref={refToUse}>
      <button
        className="export-menu__trigger-btn"
        onClick={onToggle}
        title="Export & Import Options"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Export and import options"
      >
        <span className="material-symbols-outlined text-sm">ios_share</span>
        <span>Export</span>
      </button>

      {(exportStatus || exportError) && (
        <div className={`export-menu__status-chip ${exportError ? 'export-menu__status-chip--error' : ''}`} role="status">
          <span>{exportError || exportStatus}</span>
          {exportStatus?.startsWith('Restored') && preImportSnapshotRef.current && (
            <button
              type="button"
              className="export-menu__status-chip-action"
              onClick={handleUndoImport}
              aria-label="Undo import"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {isOpen && (
        <div className="canvio-dropdown-menu export-menu__popover" role="menu" aria-label="Export and import">
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
