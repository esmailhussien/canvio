import { nanoid } from 'nanoid';
import { LivingNode, Point } from '../types';

export const WORLD_MAP_CENTER: [number, number] = [20, 0];
export const WORLD_MAP_ZOOM = 2;
export const DEFAULT_MAP_SIZE = { width: 520, height: 340 };

export const mapPlugin = {
  type: 'map',
  name: 'Map',
  icon: 'map',
  category: 'core' as const,
  defaultSize: DEFAULT_MAP_SIZE,
  create: (position: Point): LivingNode => ({
    id: nanoid(),
    type: 'map',
    position,
    size: DEFAULT_MAP_SIZE,
    rotation: 0,
    zIndex: 0,
    locked: false,
    data: {
      center: WORLD_MAP_CENTER,
      zoom: WORLD_MAP_ZOOM,
      tileLayer: 'satellite',
      markers: [],
      interactive: true,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }),
  getConnectionPorts: () => [
    { id: 'top', position: 'top' as const },
    { id: 'right', position: 'right' as const },
    { id: 'bottom', position: 'bottom' as const },
    { id: 'left', position: 'left' as const },
  ],
};
