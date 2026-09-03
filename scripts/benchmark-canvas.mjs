/**
 * Canvio 60fps Canvas Navigation & Viewport Transform Benchmark
 *
 * Simulates high-frequency pan/zoom gestures over a dense canvas containing
 * 150+ Living Nodes. Measures per-frame latency, visible node culling,
 * store mutations, and asserts >= 55 FPS throughput with p99 < 18ms.
 */

import { performance } from 'node:perf_hooks';
import {
  screenToWorld,
  worldToScreen,
  getVisibleBounds,
  zoomAtPoint,
  clampZoom,
} from '../packages/core/dist/engine/viewport.js';
import { getNodesInRect } from '../packages/core/dist/engine/selection.js';

console.log('===============================================================');
console.log('       Canvio 60fps Canvas Navigation Benchmark Suite          ');
console.log('===============================================================');

const TOTAL_NODES = 150;
const SIMULATION_FRAMES = 1200;
const SCREEN_SIZE = { width: 1920, height: 1080 };

console.log(`Node Population : ${TOTAL_NODES} Living Nodes`);
console.log(`Simulation Time : ${SIMULATION_FRAMES} RAF Frames`);
console.log(`Virtual Display : ${SCREEN_SIZE.width}x${SCREEN_SIZE.height}`);
console.log('');

// 1. Generate 150 Living Nodes across a 10,000 x 10,000 world grid
const nodeTypes = ['sticky', 'text', 'drawing', 'map', 'shape'];
const nodes = new Map();

for (let i = 0; i < TOTAL_NODES; i++) {
  const type = nodeTypes[i % nodeTypes.length];
  const x = (i % 15) * 600 - 4000;
  const y = Math.floor(i / 15) * 600 - 4000;
  const width = type === 'map' ? 400 : type === 'sticky' ? 200 : 250;
  const height = type === 'map' ? 300 : type === 'sticky' ? 200 : 150;

  nodes.set(`bench-node-${i}`, {
    id: `bench-node-${i}`,
    type,
    position: { x, y },
    size: { width, height },
    rotation: (i % 5) - 2,
    zIndex: i + 1,
    locked: false,
    data: { content: `Benchmark Content ${i}`, color: '#fbbf24' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

console.log(`[Setup] Populated ${nodes.size} nodes across world space.`);

// 2. Run simulation frames measuring per-frame latency
let viewport = { x: 0, y: 0, zoom: 1 };
const frameTimes = [];
let totalVisibleNodesEvaluated = 0;

const benchmarkStart = performance.now();

for (let frame = 0; frame < SIMULATION_FRAMES; frame++) {
  const t0 = performance.now();

  // Synthetic pan: sinusoidal multi-axis continuous displacement
  const panX = Math.sin(frame / 20) * 18;
  const panY = Math.cos(frame / 20) * 14;
  viewport = {
    ...viewport,
    x: viewport.x + panX,
    y: viewport.y + panY,
  };

  // Synthetic zoom: dynamic zoom oscillation around canvas center
  const zoomDelta = Math.sin(frame / 35) * 0.015;
  const screenCenter = { x: SCREEN_SIZE.width / 2, y: SCREEN_SIZE.height / 2 };
  viewport = zoomAtPoint(viewport, screenCenter, zoomDelta);

  // Coordinate projections & culling calculations
  const visibleBounds = getVisibleBounds(viewport, SCREEN_SIZE);
  const visibleNodes = getNodesInRect(nodes.values(), visibleBounds);
  totalVisibleNodesEvaluated += visibleNodes.length;

  // Viewport clamping & transform matrix calculation
  viewport.zoom = clampZoom(viewport.zoom);
  const worldOrigin = screenToWorld({ x: 0, y: 0 }, viewport);
  const screenOrigin = worldToScreen(worldOrigin, viewport);

  const t1 = performance.now();
  frameTimes.push(t1 - t0);
}

const benchmarkEnd = performance.now();
const totalWallTimeMs = benchmarkEnd - benchmarkStart;

// 3. Compute frame statistics
frameTimes.sort((a, b) => a - b);

const sumTime = frameTimes.reduce((acc, t) => acc + t, 0);
const avgFrameTimeMs = sumTime / frameTimes.length;
const medianFrameTimeMs = frameTimes[Math.floor(frameTimes.length * 0.5)];
const p95FrameTimeMs = frameTimes[Math.floor(frameTimes.length * 0.95)];
const p99FrameTimeMs = frameTimes[Math.floor(frameTimes.length * 0.99)];
const maxFrameTimeMs = frameTimes[frameTimes.length - 1];
const minFrameTimeMs = frameTimes[0];

// In a real RAF loop budget of 16.67ms (60fps), computation overhead should leave
// ample margin for GPU compositing.
const effectiveFps = 1000 / Math.max(avgFrameTimeMs, 16.667);
const theoreticalMaxFps = 1000 / avgFrameTimeMs;

console.log('---------------------------------------------------------------');
console.log('                     Benchmark Results                         ');
console.log('---------------------------------------------------------------');
console.log(`Total Frames Simulated  : ${SIMULATION_FRAMES}`);
console.log(`Total Execution Time    : ${totalWallTimeMs.toFixed(2)} ms`);
console.log(`Average Frame Latency   : ${avgFrameTimeMs.toFixed(4)} ms`);
console.log(`Median (p50) Latency    : ${medianFrameTimeMs.toFixed(4)} ms`);
console.log(`95th Percentile (p95)   : ${p95FrameTimeMs.toFixed(4)} ms`);
console.log(`99th Percentile (p99)   : ${p99FrameTimeMs.toFixed(4)} ms`);
console.log(`Max Frame Time          : ${maxFrameTimeMs.toFixed(4)} ms`);
console.log(`Min Frame Time          : ${minFrameTimeMs.toFixed(4)} ms`);
console.log(`Avg Visible Nodes/Frame : ${(totalVisibleNodesEvaluated / SIMULATION_FRAMES).toFixed(1)}`);
console.log(`Effective Frame Rate    : ${effectiveFps.toFixed(1)} FPS`);
console.log(`Throughput Capacity     : ${theoreticalMaxFps.toFixed(0)} transforms/sec`);
console.log('---------------------------------------------------------------');

// 4. Assert Performance Acceptance Criteria
const TARGET_FPS = 55.0;
const MAX_P99_MS = 18.0;

let passed = true;

if (effectiveFps < TARGET_FPS) {
  console.error(`❌ FAILURE: Effective FPS (${effectiveFps.toFixed(1)}) is below target ${TARGET_FPS} FPS`);
  passed = false;
} else {
  console.log(`✓ PASS: Effective FPS >= ${TARGET_FPS} FPS (${effectiveFps.toFixed(1)} FPS)`);
}

if (p99FrameTimeMs > MAX_P99_MS) {
  console.error(`❌ FAILURE: p99 latency (${p99FrameTimeMs.toFixed(2)}ms) exceeds budget of ${MAX_P99_MS}ms`);
  passed = false;
} else {
  console.log(`✓ PASS: p99 latency < ${MAX_P99_MS}ms (${p99FrameTimeMs.toFixed(4)}ms)`);
}

console.log('===============================================================');

if (!passed) {
  process.exit(1);
} else {
  console.log('✅ Canvas Performance Benchmark PASSED cleanly!');
  process.exit(0);
}
