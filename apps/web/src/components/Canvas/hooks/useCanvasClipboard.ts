import { useEffect, useCallback } from 'react';
import { getPlugin } from '@canvio/objects';
import { LivingNode } from '@canvio/core';
import { useCanvasStore } from '../../../store/canvasStore';

interface UseCanvasClipboardProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  cursorWorldPos: { x: number; y: number } | null;
  screenToWorld: (x: number, y: number) => { x: number; y: number };
}

export function useCanvasClipboard({
  canvasRef,
  cursorWorldPos,
  screenToWorld,
}: UseCanvasClipboardProps) {
  const addNode = useCanvasStore((s) => s.addNode);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const nextZIndex = useCanvasStore((s) => s.nextZIndex);
  const viewport = useCanvasStore((s) => s.viewport);

  const createNodeFromPlugin = useCallback(
    (type: string, worldPos: { x: number; y: number }, data?: Record<string, unknown>) => {
      const plugin = getPlugin(type);
      if (!plugin) return null;

      const node = plugin.create({ x: worldPos.x, y: worldPos.y });
      const positionedNode: LivingNode = {
        ...node,
        position: {
          x: worldPos.x - node.size.width / 2,
          y: worldPos.y - node.size.height / 2,
        },
        zIndex: type === 'frame' ? -1 : nextZIndex(),
        data: data ? { ...node.data, ...data } : node.data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      addNode(positionedNode);
      selectNode(positionedNode.id);
      setActiveTool('select');
      return positionedNode;
    },
    [addNode, nextZIndex, selectNode, setActiveTool]
  );

  const createImageFromFile = useCallback(
    (file: File, worldPos: { x: number; y: number }) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = () => {
        createNodeFromPlugin('image', worldPos, {
          src: reader.result as string,
          alt: file.name || 'Image',
        });
      };
      reader.readAsDataURL(file);
    },
    [createNodeFromPlugin]
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl?.isContentEditable ||
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const imageItem = Array.from(e.clipboardData?.items || []).find((item) =>
        item.type.startsWith('image/')
      );
      const file = imageItem?.getAsFile();
      if (!file) return;

      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      const target =
        cursorWorldPos ||
        (rect
          ? screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)
          : { x: -viewport.x, y: -viewport.y });
      createImageFromFile(file, target);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [canvasRef, createImageFromFile, cursorWorldPos, screenToWorld, viewport.x, viewport.y]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.items || []).some((item) => item.type.startsWith('image/'))) {
      e.preventDefault();
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      const file = Array.from(e.dataTransfer.files || []).find((item) =>
        item.type.startsWith('image/')
      );
      if (!file) return;

      e.preventDefault();
      e.stopPropagation();
      createImageFromFile(file, screenToWorld(e.clientX, e.clientY));
    },
    [createImageFromFile, screenToWorld]
  );

  return {
    createNodeFromPlugin,
    createImageFromFile,
    handleDragOver,
    handleDrop,
  };
}
