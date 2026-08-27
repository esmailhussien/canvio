import React, { useRef, useEffect, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { fitViewportToNodes } from '../../utils/viewportFit';
import './Minimap.css';

export const Minimap: React.FC = () => {
  const nodes = useCanvasStore((s) => s.nodes);
  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const zoomAtPoint = useCanvasStore((s) => s.zoomAtPoint);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCompact, setIsCompact] = useState(false);

  const renderRafRef = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 520px)');
    const sync = () => setIsCompact(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    if (isCompact) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (renderRafRef.current !== null) {
      cancelAnimationFrame(renderRafRef.current);
    }

    renderRafRef.current = requestAnimationFrame(() => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

    const nodeValues = Object.values(nodes);
    if (nodeValues.length === 0) {
      // Draw simple center crosshair when empty
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      return;
    }

    // Calculate bounding box of all nodes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodeValues.forEach((node) => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + node.size.width);
      maxY = Math.max(maxY, node.position.y + node.size.height);
    });

    // Add some padding
    const padding = 200;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    // Scaling factor to fit within canvas bounds
    const scaleX = canvas.width / width;
    const scaleY = canvas.height / height;
    const scale = Math.min(scaleX, scaleY);

    // Center the content in the canvas
    const offsetX = (canvas.width - width * scale) / 2;
    const offsetY = (canvas.height - height * scale) / 2;

    const worldToMap = (x: number, y: number) => ({
      x: (x - minX) * scale + offsetX,
      y: (y - minY) * scale + offsetY,
    });

    // Draw all nodes
    nodeValues.forEach((node) => {
      const mapPos = worldToMap(node.position.x, node.position.y);
      const mapWidth = node.size.width * scale;
      const mapHeight = node.size.height * scale;

      ctx.fillStyle = node.type === 'map' 
        ? 'rgba(99, 102, 241, 0.4)' 
        : node.type === 'sticky' 
        ? 'rgba(251, 191, 36, 0.5)'
        : 'rgba(255, 255, 255, 0.15)';
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;

      // Draw rounded rect
      ctx.beginPath();
      ctx.rect(mapPos.x, mapPos.y, mapWidth, mapHeight);
      ctx.fill();
      ctx.stroke();
    });

    // Draw viewport bounds
    // Screen dimensions
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Viewport bounds in world space
    const viewWorldWidth = screenWidth / viewport.zoom;
    const viewWorldHeight = screenHeight / viewport.zoom;
    const viewWorldX = -viewport.x - viewWorldWidth / 2;
    const viewWorldY = -viewport.y - viewWorldHeight / 2;

    const viewMapPos = worldToMap(viewWorldX, viewWorldY);
    const viewMapWidth = viewWorldWidth * scale;
    const viewMapHeight = viewWorldHeight * scale;

    ctx.strokeStyle = 'var(--accent-primary, #6366f1)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(99, 102, 241, 0.05)';
    ctx.beginPath();
      ctx.rect(viewMapPos.x, viewMapPos.y, viewMapWidth, viewMapHeight);
      ctx.fill();
      ctx.stroke();
    });

    return () => {
      if (renderRafRef.current !== null) {
        cancelAnimationFrame(renderRafRef.current);
      }
    };
  }, [isCompact, nodes, viewport]);

  const [isDragging, setIsDragging] = useState(false);

  const updateViewportFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const nodeValues = Object.values(nodes);
    if (nodeValues.length === 0) {
      setViewport({ x: 0, y: 0, zoom: viewport.zoom });
      return;
    }

    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    nodeValues.forEach((node) => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + node.size.width);
      maxY = Math.max(maxY, node.position.y + node.size.height);
    });

    const padding = 200;
    minX -= padding; minY -= padding; maxX += padding; maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;
    const scaleX = canvas.width / width;
    const scaleY = canvas.height / height;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvas.width - width * scale) / 2;
    const offsetY = (canvas.height - height * scale) / 2;

    const targetWorldX = (clickX - offsetX) / scale + minX;
    const targetWorldY = (clickY - offsetY) / scale + minY;

    setViewport({
      x: -targetWorldX,
      y: -targetWorldY,
      zoom: viewport.zoom,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateViewportFromEvent(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      updateViewportFromEvent(e);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  const handleFit = () => {
    const nodeValues = Object.values(nodes);
    if (nodeValues.length > 0) {
      fitViewportToNodes(nodeValues, { maxZoom: 1.05, minZoom: 0.35, paddingX: 220, paddingY: 220 });
      return;
    }

    setViewport({ x: 0, y: 0, zoom: 1 });
  };

  const handleZoom = (factor: number) => {
    const width = typeof window === 'undefined' ? 1200 : window.innerWidth;
    const height = typeof window === 'undefined' ? 800 : window.innerHeight;
    zoomAtPoint(
      factor,
      { x: width / 2, y: height / 2 },
      { left: 0, top: 0, width, height },
      true
    );
  };

  return (
    <div
      ref={containerRef}
      className={`minimap-container ${isCompact ? 'minimap-container--compact' : ''}`}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <canvas
        ref={canvasRef}
        width={160}
        height={120}
        onClick={undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="minimap__canvas"
        aria-hidden={isCompact}
      />
      <div className="minimap__controls" role="toolbar" aria-label="Board view controls">
        <button type="button" onClick={() => handleZoom(0.86)} aria-label="Zoom out" title="Zoom out">
          <span className="material-symbols-outlined" aria-hidden="true">remove</span>
        </button>
        <button type="button" onClick={handleFit} aria-label="Fit board" title="Fit board">
          <span className="material-symbols-outlined" aria-hidden="true">fit_screen</span>
        </button>
        <button type="button" onClick={() => handleZoom(1.16)} aria-label="Zoom in" title="Zoom in">
          <span className="material-symbols-outlined" aria-hidden="true">add</span>
        </button>
      </div>
    </div>
  );
};
