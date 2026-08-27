import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const webDir = join(root, 'apps', 'web');
const port = Number(process.env.CANVIO_E2E_PORT || 4187);
const baseUrl = `http://127.0.0.1:${port}`;
const worldId = `e2e-smoke-${Date.now()}`;
const errors = [];

function fail(message) {
  errors.push(message);
  console.error(`E2E smoke failed: ${message}`);
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function previewCommand() {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', `npm run preview -- --host 127.0.0.1 --port ${port}`],
    };
  }

  return {
    command: 'npm',
    args: ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port)],
  };
}

async function assertState(page, label, predicate) {
  const result = await page.evaluate(predicate);
  if (!result.ok) fail(`${label}: ${result.message}`);
}

async function clickUnique(page, role, name) {
  const locator = page.getByRole(role, typeof name === 'string' ? { name, exact: true } : { name });
  await locator.first().waitFor({ state: 'visible', timeout: 10000 });
  const count = await locator.count();
  if (count !== 1) throw new Error(`Expected one ${role} "${name}", found ${count}`);
  await locator.click();
}

async function clickExportTrigger(page) {
  const locator = page.locator('.export-menu__trigger-btn');
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  await locator.click();
}

async function isExportMenuOpen(page) {
  return page.locator('.export-menu__popover').isVisible().catch(() => false);
}

async function openExportMenu(page) {
  if (await isExportMenuOpen(page)) return;
  await clickExportTrigger(page);
  await page.locator('.export-menu__popover').waitFor({ state: 'visible', timeout: 10000 });
}

async function closeExportMenu(page) {
  if (!(await isExportMenuOpen(page))) return;
  await clickExportTrigger(page);
  await page.locator('.export-menu__popover').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
}

async function clickToolbarTool(page, toolId) {
  const locator = page.locator(`.canvio-toolbar [data-tool-id="${toolId}"]`).first();
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  await locator.click();
}

async function stopServer(server) {
  if (!server.pid || server.killed) return;

  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill.exe', ['/pid', String(server.pid), '/t', '/f'], {
        stdio: 'ignore',
      });
      killer.on('close', resolve);
      killer.on('error', resolve);
    });
    return;
  }

  server.kill('SIGTERM');
}

async function main() {
  const preview = previewCommand();
  const server = spawn(preview.command, preview.args, {
    cwd: webDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverOutput = '';
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

  const tempDir = await mkdtemp(join(tmpdir(), 'canvio-e2e-'));
  const backupPath = join(tempDir, 'restore-backup.json');
  const frameRelationBackupPath = join(tempDir, 'frame-relation-backup.json');
  const imageErrorBackupPath = join(tempDir, 'image-error-backup.json');
  const invalidImagePath = join(tempDir, 'not-an-image.txt');
  await writeFile(invalidImagePath, 'This file is intentionally not an image.');

  let browser;
  let context;

  try {
    await waitForServer(baseUrl);
    browser = await chromium.launch();
    context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 860 } });
    const page = await context.newPage();
    await page.route('**/api/ai/generate', (route) => route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'AI_REQUEST_FAILED',
        message: 'Server AI unavailable for E2E.',
      }),
    }));

    await page.goto(`${baseUrl}/w/${worldId}`);
    await page.waitForLoadState('domcontentloaded');

    console.log('E2E: checking empty-starter chrome and minimap controls');
    await page.locator('.world-page__starter-panel').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.canvio-toolbar').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.minimap-container').waitFor({ state: 'visible', timeout: 10000 });

    await assertState(page, 'starter chrome visible', () => {
      const isVisible = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const minimapControls = document.querySelectorAll('.minimap__controls button').length;
      return {
        ok: isVisible('.world-page__starter-panel') && isVisible('.canvio-toolbar') && isVisible('.minimap-container') && minimapControls === 3,
        message: `expected starter, toolbar, minimap, and 3 minimap controls; got controls=${minimapControls}`,
      };
    });

    console.log('E2E: checking AI fallback trust messaging');
    await page.locator('.world-page__starter-link--ai').click();
    await page.getByRole('dialog', { name: 'Canvio AI' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('#canvio-ai-prompt').fill('Create a tiny QA board about source, relation, and result');
    await page.getByRole('button', { name: /Create board/i }).click();
    await page.waitForFunction(
      () => document.querySelector('.ai-modal__status')?.textContent?.includes('Local smart mode used'),
      null,
      { timeout: 15000 }
    );

    await assertState(page, 'AI fallback trust state', () => {
      const status = document.querySelector('.ai-modal__status')?.textContent || '';
      const nodeCount = document.querySelectorAll('.node-renderer').length;
      return {
        ok: status.includes('Local smart mode used')
          && status.includes('Prompt-only generation')
          && status.includes('View board')
          && nodeCount >= 3,
        message: `expected local fallback status and generated nodes, got status="${status}" / nodes=${nodeCount}`,
      };
    });
    await page.getByRole('button', { name: 'View board' }).click();
    await page.locator('.ai-modal__overlay').waitFor({ state: 'detached', timeout: 10000 });
    await assertState(page, 'starter dismissed by AI entry', () => ({
      ok: window.localStorage.getItem('CANVIO_STARTER_DISMISSED_V1') === '1',
      message: 'expected starter dismissal to persist after opening AI from starter',
    }));

    console.log('E2E: checking radial Quick add creates a node');
    // Regression guard: Canvas's pointerdown handler used to close the menu
    // before item clicks could land, making Quick add silently dead.
    await page.locator('.canvas').click({ button: 'right', position: { x: 640, y: 200 } });
    await page.locator('.canvas__radial-circle-item[aria-label="Add Sticky Note"]').waitFor({ state: 'visible', timeout: 5000 });
    const beforeRadial = await page.locator('.node-renderer').count();
    await page.locator('.canvas__radial-circle-item[aria-label="Add Sticky Note"]').click();
    await page.waitForFunction(
      (prev) => document.querySelectorAll('.node-renderer').length > prev,
      beforeRadial,
      { timeout: 8000 }
    );

    console.log('E2E: inserting field operations template');
    await page.getByRole('button', { name: 'Templates', exact: true }).first().click();
    await page.locator('.template-card').filter({ hasText: 'Field Operations Map' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.leaflet-marker-icon').length >= 2);

    await assertState(page, 'template inserted', () => {
      const nodeCount = document.querySelectorAll('.node-renderer').length;
      const markerCount = document.querySelectorAll('.leaflet-marker-icon').length;
      return {
        ok: nodeCount >= 5 && markerCount >= 2,
        message: `expected >=5 nodes and >=2 markers, got ${nodeCount} nodes / ${markerCount} markers`,
      };
    });

    console.log('E2E: creating relation from exact map pin to canvas node');
    await clickToolbarTool(page, 'relation');
    // Templates are appended after any AI-generated content. Target the map
    // that belongs to this template instead of an earlier offscreen map.
    const templateMarker = page.locator('.node-type-map').last().locator('.leaflet-marker-icon').first();
    await templateMarker.waitFor({ state: 'visible', timeout: 5000 });
    await templateMarker.click();
    await page.waitForFunction(() => document.querySelectorAll('.node-renderer.relation-source').length === 1)
      .catch(async (error) => {
        const state = await page.evaluate(() => ({
          tool: document.querySelector('.world-page')?.getAttribute('data-tool'),
          mapMode: document.querySelector('.map-node')?.className,
          markerCount: document.querySelectorAll('.node-type-map .leaflet-marker-icon').length,
          sourceCount: document.querySelectorAll('.node-renderer.relation-source').length,
        }));
        throw new Error(`map marker did not become relation source: ${JSON.stringify(state)}; ${error.message}`);
      });

    // Pick the relation target from the END of the DOM list: template nodes
    // are appended after any earlier (possibly offscreen) board content, and
    // fitTemplateToViewport framed the template itself.
    const targetNode = page.locator('.node-renderer:not(.node-type-map)').last();
    const targetBox = await targetNode.boundingBox();
    if (!targetBox) throw new Error('Could not locate relation target node');
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.mouse.click(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.waitForFunction(() => document.querySelectorAll('.node-renderer.relation-source').length === 0);

    await assertState(page, 'relation committed', () => {
      const relationSvgs = document.querySelectorAll('.canvas__relations-layer > svg .relation-group').length;
      const source = document.querySelectorAll('.node-renderer.relation-source').length;
      return {
        ok: relationSvgs >= 1 && source === 0,
        message: `expected rendered relations and no active source, got ${relationSvgs} relations / ${source} sources`,
      };
    });

    console.log('E2E: checking pan and fit-to-world');
    await clickToolbarTool(page, 'pan');
    const beforePan = await page.locator('.canvas__world').evaluate((el) => getComputedStyle(el).transform);
    await page.locator('.canvas').hover({ position: { x: 180, y: 260 } });
    await page.mouse.wheel(180, 120);
    await page.waitForFunction(
      (previousTransform) => getComputedStyle(document.querySelector('.canvas__world')).transform !== previousTransform,
      beforePan
    );
    const afterPan = await page.locator('.canvas__world').evaluate((el) => getComputedStyle(el).transform);
    await clickUnique(page, 'button', 'Open Canvio workspace menu');
    await page.locator('.canvio-menu-item').filter({ hasText: 'Fit Viewport to Canvas' }).click();
    const afterFit = await page.locator('.canvas__world').evaluate((el) => getComputedStyle(el).transform);
    if (beforePan === afterPan) fail('pan did not change the viewport transform');
    if (afterFit === afterPan) fail('fit to world did not reframe the viewport');


    console.log('E2E: checking relation selection inside a frame');
    const now = Date.now();
    await writeFile(frameRelationBackupPath, JSON.stringify({
      version: '1.0',
      worldId: 'e2e-frame-relation',
      exportedAt: new Date(now).toISOString(),
      appearance: { theme: 'dark', canvasBackground: null },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: {
        'frame-relation-frame': {
          id: 'frame-relation-frame',
          type: 'frame',
          position: { x: -500, y: -260 },
          size: { width: 1000, height: 520 },
          rotation: 0,
          zIndex: 0,
          locked: false,
          data: { title: 'Frame Relation QA', color: '#6366f1' },
          createdAt: now,
          updatedAt: now,
        },
        'frame-relation-source': {
          id: 'frame-relation-source',
          type: 'sticky',
          position: { x: -360, y: -60 },
          size: { width: 220, height: 140 },
          rotation: 0,
          zIndex: 2,
          locked: false,
          data: { color: 'yellow', text: 'Source inside frame' },
          createdAt: now,
          updatedAt: now,
        },
        'frame-relation-target': {
          id: 'frame-relation-target',
          type: 'sticky',
          position: { x: 140, y: -60 },
          size: { width: 220, height: 140 },
          rotation: 0,
          zIndex: 3,
          locked: false,
          data: { color: 'blue', text: 'Target inside frame' },
          createdAt: now,
          updatedAt: now,
        },
      },
      relations: {
        'frame-relation-link': {
          id: 'frame-relation-link',
          sourceId: 'frame-relation-source',
          targetId: 'frame-relation-target',
          relationship: 'related_to',
          label: 'inside frame',
          style: { type: 'orthogonal', color: '#6366f1', width: 2, endArrow: 'arrow' },
        },
      },
    }, null, 2));

    await openExportMenu(page);
    await page.locator('input[type="file"].export-menu__file-input').setInputFiles(frameRelationBackupPath);
    await page.waitForFunction(() => document.body.textContent?.includes('Source inside frame'));
    await closeExportMenu(page);
    await clickToolbarTool(page, 'select');
    await page.waitForFunction(() => document.querySelectorAll('.node-renderer.selected, .relation-group--selected').length === 0);

    const relationBox = await page.locator('.relation-group').first().boundingBox();
    if (!relationBox) throw new Error('Could not locate frame relation');
    await page.mouse.click(relationBox.x + relationBox.width / 2, relationBox.y + relationBox.height / 2);
    await assertState(page, 'relation inside frame selectable', () => {
      // Scope to the paths layer: label pills render a mirrored group above nodes.
      const selectedRelations = document.querySelectorAll('.canvas__relations-layer .relation-group--selected').length;
      const selectedFrames = document.querySelectorAll('.node-renderer.node-type-frame.selected').length;
      const inspector = document.querySelector('.relation-inspector');
      return {
        ok: selectedRelations === 1 && selectedFrames === 0 && Boolean(inspector),
        message: `expected relation inspector without selected frame, got ${selectedRelations} selected relation(s), ${selectedFrames} selected frame(s), inspector=${Boolean(inspector)}`,
      };
    });

    console.log('E2E: checking inline image upload errors');
    await writeFile(imageErrorBackupPath, JSON.stringify({
      version: '1.0',
      worldId: 'e2e-image-error',
      exportedAt: new Date().toISOString(),
      appearance: { theme: 'dark', canvasBackground: null },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: {
        'image-error-node': {
          id: 'image-error-node',
          type: 'image',
          position: { x: -150, y: -100 },
          size: { width: 300, height: 200 },
          rotation: 0,
          zIndex: 1,
          locked: false,
          data: {
            src: '',
            alt: 'Image upload QA',
            objectFit: 'cover',
            opacity: 1,
            borderRadius: 8,
          },
          createdAt: Date.now() - 10000,
          updatedAt: Date.now() - 10000,
        },
      },
      relations: {},
    }, null, 2));

    await openExportMenu(page);
    await page.locator('input[type="file"].export-menu__file-input').setInputFiles(imageErrorBackupPath);
    await page.waitForFunction(() => document.body.textContent?.includes('Drop, paste, or choose image'));
    await closeExportMenu(page);
    await page.locator('input.image-node__file-input').setInputFiles(invalidImagePath);
    await page.waitForFunction(() => document.body.textContent?.includes('Choose an image file like PNG, JPG, or WebP.'));
    await assertState(page, 'image upload error is inline', () => {
      const error = document.querySelector('.image-node__placeholder-error')?.textContent || '';
      return {
        ok: error.includes('Choose an image file'),
        message: `expected inline image error, got "${error}"`,
      };
    });

    console.log('E2E: checking JSON and PNG exports');
    await openExportMenu(page);
    const jsonDownloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.locator('.canvio-menu-item').filter({ hasText: 'Export Backup (JSON)' }).click();
    await jsonDownloadPromise;
    await page.waitForFunction(() => document.querySelector('.export-menu__status-chip')?.textContent?.includes('JSON backup ready'));

    await openExportMenu(page);
    const pngDownloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await page.locator('.canvio-menu-item').filter({ hasText: 'Export Image (PNG)' }).click();
    await pngDownloadPromise;
    await page.waitForFunction(() => document.querySelector('.export-menu__status-chip')?.textContent?.includes('PNG export ready'));

    console.log('E2E: checking JSON restore and appearance persistence');
    await writeFile(backupPath, JSON.stringify({
      version: '1.0',
      worldId: 'e2e-restore',
      exportedAt: new Date().toISOString(),
      appearance: { theme: 'light', canvasBackground: '#f8fafc' },
      viewport: { x: -40, y: -40, zoom: 1 },
      nodes: {
        'restore-test-node': {
          id: 'restore-test-node',
          type: 'sticky',
          position: { x: 0, y: 0 },
          size: { width: 220, height: 132 },
          rotation: 0,
          zIndex: 1,
          locked: false,
          data: { color: 'green', text: 'Restore QA passed' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      relations: {},
    }, null, 2));

    await openExportMenu(page);
    await page.locator('input[type="file"].export-menu__file-input').setInputFiles(backupPath);
    await page.waitForFunction(() => document.querySelector('.export-menu__status-chip')?.textContent?.includes('Restored 1 nodes'));

    await assertState(page, 'restore applied', () => {
      const nodeCount = document.querySelectorAll('.node-renderer').length;
      const restored = document.body.textContent?.includes('Restore QA passed');
      const theme = document.documentElement.getAttribute('data-theme');
      return {
        ok: nodeCount === 1 && Boolean(restored) && theme === 'light',
        message: `expected restored light one-node world, got ${nodeCount} nodes / restored=${Boolean(restored)} / theme=${theme}`,
      };
    });
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    await stopServer(server);
  }

  if (errors.length > 0) {
    process.exit(1);
  }

  console.log('E2E smoke passed.');
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
