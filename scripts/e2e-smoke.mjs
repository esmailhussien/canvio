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
  const locator = page.getByRole(role, { name });
  const count = await locator.count();
  if (count !== 1) throw new Error(`Expected one ${role} "${name}", found ${count}`);
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

  let browser;
  let context;

  try {
    await waitForServer(baseUrl);
    browser = await chromium.launch();
    context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 860 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/w/${worldId}`);
    await page.waitForLoadState('domcontentloaded');

    console.log('E2E: inserting field operations template');
    await clickUnique(page, 'button', 'Presets & Layout');
    await page.locator('.template-card').filter({ hasText: 'Field Operations Map' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.node-renderer').length >= 5);

    await assertState(page, 'template inserted', () => {
      const nodeCount = document.querySelectorAll('.node-renderer').length;
      const markerCount = document.querySelectorAll('.leaflet-marker-icon').length;
      return {
        ok: nodeCount >= 5 && markerCount >= 2,
        message: `expected >=5 nodes and >=2 markers, got ${nodeCount} nodes / ${markerCount} markers`,
      };
    });

    console.log('E2E: creating relation from exact map pin to canvas node');
    await clickUnique(page, 'button', 'Relation (L)');
    await page.locator('.node-type-map .leaflet-marker-icon').first().click();
    await page.waitForFunction(() => document.querySelectorAll('.node-renderer.relation-source').length === 1);

    const targetNode = page.locator('.node-renderer:not(.node-type-map)').first();
    const targetBox = await targetNode.boundingBox();
    if (!targetBox) throw new Error('Could not locate relation target node');
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.waitForFunction(() => document.querySelectorAll('.node-renderer.relation-target').length === 1);
    await page.mouse.click(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.waitForFunction(() => document.querySelectorAll('.node-renderer.relation-source').length === 0);

    await assertState(page, 'relation committed', () => {
      const relationSvgs = document.querySelectorAll('.canvas__world > svg').length;
      const source = document.querySelectorAll('.node-renderer.relation-source').length;
      return {
        ok: relationSvgs >= 1 && source === 0,
        message: `expected rendered relations and no active source, got ${relationSvgs} svgs / ${source} sources`,
      };
    });

    console.log('E2E: checking pan and fit-to-world');
    await clickUnique(page, 'button', 'Pan (Space)');
    const beforePan = await page.locator('.canvas__world').evaluate((el) => getComputedStyle(el).transform);
    await page.locator('.canvas').hover({ position: { x: 180, y: 260 } });
    await page.mouse.wheel(180, 120);
    await page.waitForFunction(
      (previousTransform) => getComputedStyle(document.querySelector('.canvas__world')).transform !== previousTransform,
      beforePan
    );
    const afterPan = await page.locator('.canvas__world').evaluate((el) => getComputedStyle(el).transform);
    await clickUnique(page, 'button', 'Fit to world');
    const afterFit = await page.locator('.canvas__world').evaluate((el) => getComputedStyle(el).transform);
    if (beforePan === afterPan) fail('pan did not change the viewport transform');
    if (afterFit === afterPan) fail('fit to world did not reframe the viewport');

    console.log('E2E: checking JSON and PNG exports');
    await clickUnique(page, 'button', 'Export & Templates');
    const jsonDownloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.getByRole('button', { name: '📄 Export Backup (JSON)' }).click();
    await jsonDownloadPromise;
    await page.waitForFunction(() => document.querySelector('.export-menu__status-chip')?.textContent?.includes('JSON backup ready'));

    await clickUnique(page, 'button', 'Export & Templates');
    const pngDownloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await page.getByRole('button', { name: '🖼️ Export Image (PNG)' }).click();
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

    await clickUnique(page, 'button', 'Export & Templates');
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
