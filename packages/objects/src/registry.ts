import { drawingPlugin } from './drawing/DrawingNode';
import { stickyPlugin } from './sticky-note/StickyNote';
import { mapPlugin } from './map/MapNode';
import { textPlugin } from './text/TextNode';
import { imagePlugin } from './image/ImageNode';
import { shapePlugin } from './shape/ShapeNode';
import { framePlugin } from './frame/FrameNode';
import { codePlugin } from './code/CodeNode';

const plugins = new Map<string, typeof drawingPlugin>();

// Register core plugins
plugins.set('drawing', drawingPlugin);
plugins.set('sticky', stickyPlugin);
plugins.set('map', mapPlugin);
plugins.set('text', textPlugin);
plugins.set('image', imagePlugin);
plugins.set('shape', shapePlugin);
plugins.set('frame', framePlugin);
plugins.set('code', codePlugin);

export function getPlugin(type: string) {
  return plugins.get(type);
}

export function getAllPlugins() {
  return Array.from(plugins.values());
}

export function registerPlugin(plugin: typeof drawingPlugin) {
  plugins.set(plugin.type, plugin);
}
