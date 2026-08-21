import assert from 'node:assert/strict';
import type { CanvasStore, LivingNode, Relation } from '../../apps/web/src/store/canvasStore';

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

type BrowserMocks = {
  storage: Map<string, string>;
  attrs: Map<string, string>;
};

const tests: TestCase[] = [];

function test(name: string, run: TestCase['run']): void {
  tests.push({ name, run });
}

function installBrowserMocks(preferLight = false): BrowserMocks {
  const storage = new Map<string, string>();
  const attrs = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  };

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      CANVIO_CONFIG: {},
      localStorage: localStorageMock,
      location: { search: '', hostname: '127.0.0.1' },
      crypto: { randomUUID: () => 'unit-client-id' },
      matchMedia: () => ({
        matches: preferLight,
        media: '(prefers-color-scheme: light)',
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    },
  });

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorageMock,
  });

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      documentElement: {
        setAttribute: (key: string, value: string) => attrs.set(key, value),
        getAttribute: (key: string) => attrs.get(key) ?? null,
      },
    },
  });

  return { storage, attrs };
}

function makeNode(id: string, overrides: Partial<LivingNode> = {}): LivingNode {
  return {
    id,
    type: 'sticky',
    position: { x: 0, y: 0 },
    size: { width: 220, height: 160 },
    rotation: 0,
    zIndex: 1,
    locked: false,
    data: { text: `${id} text`, color: 'yellow' },
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeRelation(id: string, sourceId = 'a', targetId = 'b', overrides: Partial<Relation> = {}): Relation {
  return {
    id,
    sourceId,
    targetId,
    relationship: 'related_to',
    label: 'explains',
    style: {
      type: 'orthogonal',
      color: '#6366f1',
      width: 4,
      endArrow: 'arrow',
    },
    ...overrides,
  };
}

async function main(): Promise<void> {
const { storage, attrs } = installBrowserMocks();
const { useCanvasStore } = await import('../../apps/web/src/store/canvasStore');
const {
  nodeToYMap,
  relationToYMap,
  syncNodeToYMap,
  syncRelationToYMap,
  yMapToNode,
  yMapToRelation,
} = await import('../../packages/collaboration/src/yjsHelpers');
const {
  analyzeGraphWithAIAsync,
  challengeBoardWithAIAsync,
  generateSpatialBoardAsync,
  getAIFallbackMessage,
  organizeAndClusterWithAIAsync,
  socraticInquiryWithAIAsync,
  summarizeBoardWithAIAsync,
} = await import('../../apps/web/src/utils/spatialAIEngine');
const { ApiRequestError } = await import('../../apps/web/src/utils/api');
const { classifyAIError } = await import('../../apps/server/src/routes/ai');
const Y = await import('yjs');

function resetStore(): void {
  storage.clear();
  attrs.clear();
  useCanvasStore.setState({
    nodes: {},
    relations: {},
    inkStrokes: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeIds: [],
    selectedRelationId: null,
    activeTool: 'select',
    snapLines: null,
    relationSourceId: null,
    relationSourcePort: null,
    relationTargetId: null,
    relationTargetPort: null,
    past: [],
    future: [],
    historyMode: 'local',
    historyAdapter: null,
    canUndo: false,
    canRedo: false,
    theme: 'dark',
    themePreference: 'system',
    canvasBackground: null,
    strokeColor: '#f0f0f5',
    strokeWidth: 3,
    stickyColor: 'yellow',
    isAIAssistantOpen: false,
  } satisfies Partial<CanvasStore>);
}

test('node removal clears dependent relations and selection', () => {
  resetStore();
  const store = useCanvasStore.getState();
  store.addNode(makeNode('a'));
  store.addNode(makeNode('b'));
  store.addRelation(makeRelation('r1'));
  store.selectNode('a');

  useCanvasStore.getState().removeNode('a');

  const state = useCanvasStore.getState();
  assert.equal(state.nodes.a, undefined);
  assert.equal(state.nodes.b.id, 'b');
  assert.deepEqual(state.relations, {});
  assert.deepEqual(state.selectedNodeIds, []);
  assert.equal(state.canUndo, true);
});

test('collaboration history adapter prevents local snapshot growth', () => {
  resetStore();
  let undoCalls = 0;
  let redoCalls = 0;
  let canUndo = true;

  useCanvasStore.getState().setCollaborationHistoryAdapter({
    canUndo: () => canUndo,
    canRedo: () => true,
    undo: () => {
      undoCalls += 1;
      canUndo = false;
    },
    redo: () => {
      redoCalls += 1;
    },
  });

  useCanvasStore.getState().addNode(makeNode('a'));
  let state = useCanvasStore.getState();
  assert.equal(state.historyMode, 'collaboration');
  assert.equal(state.past.length, 0);
  assert.equal(state.future.length, 0);
  assert.equal(state.canUndo, true);

  state.undo();
  state = useCanvasStore.getState();
  assert.equal(undoCalls, 1);
  assert.equal(redoCalls, 0);
  assert.equal(state.canUndo, false);
  assert.equal(state.canRedo, true);
});

test('replaceWorld restores board data and clears transient interaction state', () => {
  resetStore();
  useCanvasStore.setState({
    selectedNodeIds: ['old'],
    selectedRelationId: 'old-relation',
    activeTool: 'relation',
    relationSourceId: 'old',
    relationSourcePort: 'right',
    relationTargetId: 'other',
    relationTargetPort: 'left',
    themePreference: 'dark',
  });

  const node = makeNode('fresh', { position: { x: 120, y: 240 } });
  useCanvasStore.getState().replaceWorld({
    nodes: { fresh: node },
    relations: {},
    inkStrokes: [],
    viewport: { x: 10, y: 20, zoom: 1.5 },
    appearance: { canvasBackground: '#ffffff' },
  });

  let state = useCanvasStore.getState();
  assert.equal(state.nodes.fresh.position.x, 120);
  assert.deepEqual(state.selectedNodeIds, []);
  assert.equal(state.selectedRelationId, null);
  assert.equal(state.activeTool, 'select');
  assert.equal(state.relationSourceId, null);
  assert.deepEqual(state.viewport, { x: 10, y: 20, zoom: 1.5 });
  assert.equal(state.canvasBackground, '#ffffff');
  assert.equal(storage.get('canvio-canvas-background'), '#ffffff');
  assert.equal(attrs.get('data-theme'), 'dark');

  useCanvasStore.getState().replaceWorld({ nodes: {}, relations: {}, appearance: { canvasBackground: null } });
  state = useCanvasStore.getState();
  assert.equal(state.canvasBackground, null);
  assert.equal(storage.has('canvio-canvas-background'), false);
});

test('viewport pan and anchored zoom stay stable', () => {
  resetStore();
  useCanvasStore.getState().panBy(25, -10);
  assert.deepEqual(useCanvasStore.getState().viewport, { x: 25, y: -10, zoom: 1 });

  useCanvasStore.getState().zoomAtPoint(2, { x: 100, y: 100 }, { left: 0, top: 0, width: 200, height: 200 }, true);
  assert.deepEqual(useCanvasStore.getState().viewport, { x: 25, y: -10, zoom: 2 });

  useCanvasStore.getState().zoomAtPoint(2, { x: 200, y: 100 }, { left: 0, top: 0, width: 200, height: 200 }, true);
  const state = useCanvasStore.getState();
  assert.equal(state.viewport.zoom, 4);
  assert.equal(state.viewport.x, 0);
  assert.equal(state.viewport.y, -10);
});

test('layout slice aligns selected nodes without touching unselected nodes', () => {
  resetStore();
  const a = makeNode('a', { position: { x: 20, y: 80 }, size: { width: 100, height: 100 }, zIndex: 1 });
  const b = makeNode('b', { position: { x: 160, y: 40 }, size: { width: 100, height: 80 }, zIndex: 2 });
  const c = makeNode('c', { position: { x: 600, y: 600 }, zIndex: 3 });
  useCanvasStore.setState({ nodes: { a, b, c }, selectedNodeIds: ['a', 'b'] });

  useCanvasStore.getState().alignNodes('top');

  const state = useCanvasStore.getState();
  assert.equal(state.nodes.a.position.y, 40);
  assert.equal(state.nodes.b.position.y, 40);
  assert.deepEqual(state.nodes.c.position, { x: 600, y: 600 });
  assert.equal(state.canUndo, true);
});

test('Yjs node maps keep collaborative text fields granular and readable', () => {
  const node = makeNode('node-1', {
    data: { text: 'Original note', title: 'Card title', color: 'yellow' },
  });

  const doc = new Y.Doc();
  const ymap = doc.getMap<unknown>('node');
  syncNodeToYMap(ymap, node);
  const dataMap = ymap.get('data');
  assert.equal(typeof (dataMap as { get?: unknown }).get, 'function');
  const collaborativeData = dataMap as { get: (key: string) => unknown };
  const ytext = collaborativeData.get('text') as { toString: () => string };
  assert.equal(typeof ytext.toString, 'function');
  assert.equal(ytext.toString(), 'Original note');

  syncNodeToYMap(ymap, {
    ...node,
    data: { text: 'Original better note', title: 'Card title', color: 'blue' },
  });

  assert.equal(collaborativeData.get('text'), ytext);
  assert.equal(ytext.toString(), 'Original better note');
  assert.deepEqual(yMapToNode(ymap).data, {
    text: 'Original better note',
    title: 'Card title',
    color: 'blue',
  });
});

test('Yjs helpers preserve legacy node data and relation style compatibility', () => {
  const doc = new Y.Doc();
  const legacyNodeMap = doc.getMap<unknown>('legacy-node');
  syncNodeToYMap(legacyNodeMap, makeNode('legacy', {
    position: { x: 1, y: 2 },
    data: { text: 'new body', color: 'blue' },
  }));
  legacyNodeMap.set('data', '{"text":"legacy body","color":"pink"}');

  assert.deepEqual(yMapToNode(legacyNodeMap).data, { text: 'legacy body', color: 'pink' });

  const relation = makeRelation('relation-1');
  const relationDoc = new Y.Doc();
  const relationMap = relationDoc.getMap<unknown>('relation');
  syncRelationToYMap(relationMap, relation);
  assert.equal(typeof relationMap.get('style'), 'string');
  assert.equal(yMapToRelation(relationMap).style.color, '#6366f1');

  syncRelationToYMap(relationMap, {
    ...relation,
    style: { ...relation.style, color: '#ef4444', width: 6 },
  });
  const updatedRelation = yMapToRelation(relationMap);
  assert.equal(updatedRelation.style.color, '#ef4444');
  assert.equal(updatedRelation.style.width, 6);
});

test('Yjs helper creation does not read detached maps', () => {
  const node = makeNode('detached-node', {
    data: { text: 'Detached text', title: 'Detached title', color: 'green' },
  });
  const relation = makeRelation('detached-relation');
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '));
  };

  try {
    const nodeMap = nodeToYMap(node);
    const relationMap = relationToYMap(relation);
    const doc = new Y.Doc();
    const nodesMap = doc.getMap<any>('nodes');
    const relationsMap = doc.getMap<any>('relations');

    nodesMap.set(node.id, nodeMap);
    relationsMap.set(relation.id, relationMap);

    assert.equal(yMapToNode(nodesMap.get(node.id)!).data.text, 'Detached text');
    assert.equal(yMapToRelation(relationsMap.get(relation.id)!).style.color, '#6366f1');
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(warnings.filter((warning) => warning.includes('Invalid access')).length, 0);
});

test('AI server error classifier identifies production failure modes', () => {
  const quota = classifyAIError(new Error('Gemini API HTTP 429: Quota exceeded for metric. Please retry in 10.615s.'));
  assert.equal(quota.error, 'AI_QUOTA_EXCEEDED');
  assert.equal(quota.retryAfterSeconds, 11);

  const model = classifyAIError(new Error('GROQ API HTTP 404: model `llama-3.1-8b-instant` does not exist or you do not have access to it.'));
  assert.equal(model.error, 'AI_MODEL_UNAVAILABLE');

  const invalid = classifyAIError(new Error("GROQ openai/gpt-oss-20b returned invalid JSON: Expected ',' or '}' after property value."));
  assert.equal(invalid.error, 'AI_INVALID_RESPONSE');

  const friendly = getAIFallbackMessage(new ApiRequestError('AI quota is temporarily exhausted. Canvio used local smart mode.', 200, 'AI_QUOTA_EXCEEDED'));
  assert.equal(friendly, 'AI quota is temporarily exhausted. Canvio used local smart mode.');
});

test('AI client paths use editable local fallbacks for provider failures', async () => {
  resetStore();
  const originalFetch = globalThis.fetch;
  const requestedPaths: string[] = [];
  const fallbackMessage = 'AI quota is temporarily exhausted. Canvio used local smart mode.';
  const jsonResponse = (payload: unknown) => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    requestedPaths.push(url);

    if (url.includes('/api/ai/generate') || url.includes('/api/ai/summarize')) {
      return jsonResponse({
        source: 'local-fallback',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        title: '',
        nodes: [],
        relations: [],
        error: 'AI_QUOTA_EXCEEDED',
        message: fallbackMessage,
      });
    }

    if (url.includes('/api/ai/analyze-graph')) {
      return jsonResponse({
        source: 'local-fallback',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        critique: '',
        healthScore: 0,
        insights: [],
        suggestedRelations: [],
        error: 'AI_QUOTA_EXCEEDED',
        message: fallbackMessage,
      });
    }

    if (url.includes('/api/ai/challenge')) {
      return jsonResponse({
        source: 'local-fallback',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        challengeSummary: '',
        challenges: [],
        challengerNodes: [],
        challengerRelations: [],
        error: 'AI_QUOTA_EXCEEDED',
        message: fallbackMessage,
      });
    }

    if (url.includes('/api/ai/socratic')) {
      return jsonResponse({
        source: 'local-fallback',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        inquiryFocus: '',
        questions: [],
        error: 'AI_QUOTA_EXCEEDED',
        message: fallbackMessage,
      });
    }

    if (url.includes('/api/ai/organize')) {
      return jsonResponse({
        source: 'local-fallback',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        clusters: [],
        error: 'AI_QUOTA_EXCEEDED',
        message: fallbackMessage,
      });
    }

    return jsonResponse({});
  };

  try {
    const claim = makeNode('claim', { data: { text: 'Claim: practice improves recall', color: 'yellow' } });
    const evidence = makeNode('evidence', { position: { x: 320, y: 0 }, data: { text: 'Evidence: spaced repetition examples', color: 'green' } });
    const relation = makeRelation('reason', 'claim', 'evidence', { relationship: 'based_on', label: 'supported by' });
    const boardNodes = [claim, evidence];
    const boardRelations = [relation];

    const generated = await generateSpatialBoardAsync('Create a study board about memory');
    assert.equal(generated.source, 'local');
    assert.match(generated.message || '', /quota/i);
    assert.ok(generated.nodes.length > 0);

    const summary = await summarizeBoardWithAIAsync(boardNodes, boardRelations, 'summary');
    assert.equal(summary.source, 'local');
    assert.match(summary.message || '', /quota/i);
    assert.ok(summary.nodes.length > 0);

    const analysis = await analyzeGraphWithAIAsync(boardNodes, boardRelations);
    assert.equal(analysis.source, 'local');
    assert.match(analysis.message || '', /quota/i);
    assert.ok(analysis.critique.length > 0);

    const challenge = await challengeBoardWithAIAsync(boardNodes, boardRelations);
    assert.equal(challenge.source, 'local');
    assert.match(challenge.message || '', /quota/i);
    assert.ok(challenge.challenges.length > 0);

    const socratic = await socraticInquiryWithAIAsync(boardNodes, boardRelations);
    assert.equal(socratic.source, 'local');
    assert.match(socratic.message || '', /quota/i);
    assert.ok(socratic.questions.length > 0);

    const updatedPositions: Record<string, LivingNode['position']> = {};
    const addedNodes: LivingNode[] = [];
    const organized = await organizeAndClusterWithAIAsync(
      boardNodes,
      (id, patch) => {
        if (patch.position) updatedPositions[id] = patch.position;
      },
      (node) => addedNodes.push(node)
    );
    assert.equal(organized.source, 'local');
    assert.match(organized.message || '', /quota/i);
    assert.ok(Object.keys(updatedPositions).length > 0);
    assert.ok(addedNodes.some((node) => node.type === 'frame'));

    for (const path of ['generate', 'summarize', 'analyze-graph', 'challenge', 'socratic', 'organize']) {
      assert.ok(requestedPaths.some((url) => url.includes(`/api/ai/${path}`)), `expected /api/ai/${path} request`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

let passed = 0;

for (const { name, run } of tests) {
  try {
    await run();
    passed += 1;
    console.log(`ok ${passed} - ${name}`);
  } catch (error) {
    console.error(`not ok ${passed + 1} - ${name}`);
    throw error;
  }
}

console.log(`Unit checks passed: ${passed}/${tests.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
