import { useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { ToolMode } from '@canvio/core';
import { useCanvasStore } from '../../../store/canvasStore';

export function useCanvasKeyboardShortcuts() {
  const previousToolRef = useRef<ToolMode | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isEditingText = Boolean(
        activeEl &&
          (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)
      );

      const isDeleteKey =
        e.key === 'Delete' || e.key === 'Backspace' || e.code === 'Delete' || e.code === 'Backspace';

      if (isDeleteKey) {
        if (isEditingText) return;
        e.preventDefault();
        e.stopPropagation();
        const store = useCanvasStore.getState();
        const selectedNodes = store.selectedNodeIds || [];
        const selectedRel = store.selectedRelationId;

        if (selectedRel) {
          store.removeRelation(selectedRel);
          store.selectRelation(null);
        }
        if (selectedNodes.length > 0) {
          store.removeNodes(selectedNodes);
          store.clearSelection();
        }
        return;
      }

      if (isEditingText) return;

      const store = useCanvasStore.getState();

      // Undo / Redo Shortcuts (Ctrl+Z, Ctrl+Y, Cmd+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        store.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        return;
      }

      // Select All (Ctrl+A / Cmd+A)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        store.selectNodes(Object.keys(store.nodes));
        return;
      }

      // Duplicate (Ctrl+D / Cmd+D)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        const selectedIds = [...store.selectedNodeIds];
        store.snapshot();
        selectedIds.forEach((id) => store.duplicateNode(id));
        return;
      }

      // Spacebar for Pan (hold or press)
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (store.activeTool !== 'pan' && !previousToolRef.current) {
          previousToolRef.current = store.activeTool;
          store.setActiveTool('pan');
        }
        return;
      }

      // Ctrl+G / Cmd+G for Grouping selected nodes into a Frame
      if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        const selectedIds = store.selectedNodeIds;
        if (selectedIds.length > 0) {
          const selectedNodes = selectedIds.map((id) => store.nodes[id]).filter(Boolean);
          const minX = Math.min(...selectedNodes.map((n) => n.position.x)) - 30;
          const minY = Math.min(...selectedNodes.map((n) => n.position.y)) - 40;
          const maxX = Math.max(...selectedNodes.map((n) => n.position.x + n.size.width)) + 30;
          const maxY = Math.max(...selectedNodes.map((n) => n.position.y + n.size.height)) + 30;

          const frameNode = {
            id: nanoid(10),
            type: 'frame',
            position: { x: minX, y: minY },
            size: { width: Math.max(200, maxX - minX), height: Math.max(150, maxY - minY) },
            rotation: 0,
            zIndex: -1,
            locked: false,
            data: {
              title: 'Grouped Frame',
              color: '#6366f1',
              fill: 'rgba(255, 255, 255, 0.02)',
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          store.addNode(frameNode);
          store.selectNode(frameNode.id);
        }
        return;
      }

      switch (e.key) {
        case 'v': case 'V': store.setActiveTool('select'); break;
        case 'a': case 'A': store.setActiveTool('arrow'); break;
        case 'k': case 'K': store.setActiveTool('highlighter'); break;
        case 'q': case 'Q': store.setActiveTool('laser'); break;
        case 'h': case 'H': store.setActiveTool('pan'); break;
        case 'd': case 'D': case 'p': case 'P': store.setActiveTool('draw'); break;
        case 't': case 'T': store.setActiveTool('text'); break;
        case 's': case 'S': case 'n': case 'N': store.setActiveTool('sticky'); break;
        case 'r': case 'R': store.setActiveTool('shape'); break;
        case 'i': case 'I': store.setActiveTool('image'); break;
        case 'c': case 'C': store.setActiveTool('code'); break;
        case 'f': case 'F': store.setActiveTool('frame'); break;
        case 'm': case 'M': store.setActiveTool('map'); break;
        case 'l': case 'L': store.setActiveTool('relation'); break;
        case 'e': case 'E': store.setActiveTool('eraser'); break;
        case 'Escape': {
          const active = document.activeElement as HTMLElement;
          if (
            active &&
            (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.contentEditable === 'true')
          ) {
            active.blur();
          } else {
            store.setRelationSourceId(null);
            store.clearSelection();
            store.setActiveTool('select');
          }
          break;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        const store = useCanvasStore.getState();
        if (previousToolRef.current) {
          store.setActiveTool(previousToolRef.current);
          previousToolRef.current = null;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
}
