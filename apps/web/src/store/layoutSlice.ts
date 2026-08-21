import type { StateCreator } from 'zustand';
import { recordUndoSnapshot } from './historySlice';
import type { CanvasStore } from './canvasStoreTypes';

type LayoutSlice = Pick<CanvasStore, 'alignNodes' | 'tidyUpNodes'>;

type StoreSet = Parameters<StateCreator<CanvasStore>>[0];

export function createLayoutSlice(set: StoreSet): LayoutSlice {
  return {
    alignNodes: (alignment) => set((state) => {
      if (state.selectedNodeIds.length < 2) return state;
      const nodes = state.selectedNodeIds.map((id) => state.nodes[id]).filter(Boolean);

      let target = 0;
      if (alignment === 'top') target = Math.min(...nodes.map((node) => node.position.y));
      else if (alignment === 'bottom') target = Math.max(...nodes.map((node) => node.position.y + node.size.height));
      else if (alignment === 'center') {
        const min = Math.min(...nodes.map((node) => node.position.y));
        const max = Math.max(...nodes.map((node) => node.position.y + node.size.height));
        target = min + (max - min) / 2;
      } else if (alignment === 'left') target = Math.min(...nodes.map((node) => node.position.x));
      else if (alignment === 'right') target = Math.max(...nodes.map((node) => node.position.x + node.size.width));
      else if (alignment === 'middle') {
        const min = Math.min(...nodes.map((node) => node.position.x));
        const max = Math.max(...nodes.map((node) => node.position.x + node.size.width));
        target = min + (max - min) / 2;
      }

      const newNodes = { ...state.nodes };
      nodes.forEach((node) => {
        let x = node.position.x;
        let y = node.position.y;
        if (alignment === 'top') y = target;
        else if (alignment === 'bottom') y = target - node.size.height;
        else if (alignment === 'center') y = target - node.size.height / 2;
        else if (alignment === 'left') x = target;
        else if (alignment === 'right') x = target - node.size.width;
        else if (alignment === 'middle') x = target - node.size.width / 2;

        newNodes[node.id] = { ...node, position: { x, y } };
      });

      return {
        ...recordUndoSnapshot(state),
        nodes: newNodes,
      };
    }),
    tidyUpNodes: () => set((state) => {
      if (state.selectedNodeIds.length < 2) return state;
      const nodes = state.selectedNodeIds.map((id) => state.nodes[id]).filter(Boolean);

      const minX = Math.min(...nodes.map((node) => node.position.x));
      const maxX = Math.max(...nodes.map((node) => node.position.x + node.size.width));
      const minY = Math.min(...nodes.map((node) => node.position.y));
      const maxY = Math.max(...nodes.map((node) => node.position.y + node.size.height));
      const isHorizontal = (maxX - minX) >= (maxY - minY);

      nodes.sort((a, b) => isHorizontal ? a.position.x - b.position.x : a.position.y - b.position.y);

      const gap = 50;
      const newNodes = { ...state.nodes };
      let currentX = minX;
      let currentY = minY;

      nodes.forEach((node) => {
        newNodes[node.id] = {
          ...node,
          position: {
            x: isHorizontal ? currentX : node.position.x,
            y: isHorizontal ? node.position.y : currentY,
          },
        };

        if (isHorizontal) {
          currentX += node.size.width + gap;
        } else {
          currentY += node.size.height + gap;
        }
      });

      return {
        ...recordUndoSnapshot(state),
        nodes: newNodes,
      };
    }),
  };
}
