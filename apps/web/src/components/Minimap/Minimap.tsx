import React, { useRef, useEffect } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import './Minimap.css';

export const Minimap: React.FC = () => {
  const nodes = useCanvasStore((s) => s.nodes);
  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
  }, [nodes, viewport]);

  const handleMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Calculate map coordinates
    const nodeValues = Object.values(nodes);
    if (nodeValues.length === 0) {
      // Center viewport
      setViewport({ x: 0, y: 0, zoom: viewport.zoom });
      return;
    }

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

    const padding = 200;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    const scaleX = canvas.width / width;
    const scaleY = canvas.height / height;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (canvas.width - width * scale) / 2;
    const offsetY = (canvas.height - height * scale) / 2;

    // Convert map click back to world space
    const targetWorldX = (clickX - offsetX) / scale + minX;
    const targetWorldY = (clickY - offsetY) / scale + minY;

    // Center screen on target
    setViewport({
      x: -targetWorldX,
      y: -targetWorldY,
      zoom: viewport.zoom,
    });
  };

  return (
    <div ref={containerRef} className="minimap-container">
      <canvas
        ref={canvasRef}
        width={160}
        height={120}
        onClick={handleMapClick}
        className="minimap__canvas"
      />
    </div>
  );
};
