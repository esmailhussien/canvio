/**
 * Temporary diagnostic probe: reproduce "tools dead / radial items dead".
 * Run: npx tsx scripts/tmp-probe.ts
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const webDir = join(process.cwd(), 'apps', 'web');
const port = 4189;
const baseUrl = `http://127.0.0.1:${port}`;

function previewCommand() {
  if (process.platform === 'win32') {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', `npm run preview -- --host 127.0.0.1 --port ${port}`] };
  }
  return { command: 'npm', args: ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port)] };
}

async function waitForServer(url: string, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error('preview server timeout');
}

async function stop(server: any) {
  if (!server.pid) return;
  if (process.platform === 'win32') {
    await new Promise(res => { const k = spawn('taskkill.exe', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' }); k.on('close', res); });
    return;
  }
  server.kill('SIGTERM');
}

const main = async () => {
  const server = spawn(previewCommand().command, previewCommand().args, { cwd: webDir, stdio: 'ignore' });
  let browser: any;
  try {
    await waitForServer(baseUrl);
    browser = await chromium.launch();
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();

    page.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') console.log(`[console.${msg.type()}]`, msg.text().slice(0, 300)); });
    page.on('pageerror', (err) => console.log('[pageerror]', String(err).slice(0, 500)));

    await page.goto(`${baseUrl}/w/probe-${Date.now()}`);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.world-page__starter-panel').waitFor({ state: 'visible', timeout: 8000 });
    await page.keyboard.press('Escape'); // dismiss starter
    await page.waitForTimeout(300);

    // 1) Pen tool select + draw stroke
    await page.locator('[data-tool-id="draw"]').click();
    const activeTool = await page.evaluate(() => document.querySelector('.world-page')?.getAttribute('data-tool'));
    console.log('activeTool after pen click:', activeTool);

    const before = await page.locator('.free-ink-layer path').count();
    await page.locator('.canvas').hover({ position: { x: 300, y: 300 } });
    await page.mouse.down();
    for (let i = 0; i < 12; i++) await page.mouse.move(300 + i * 10, 300 + i * 4);
    await page.mouse.up();
    await page.waitForTimeout(400);
    const after = await page.locator('.free-ink-layer path').count();
    console.log(`ink paths before=${before} after=${after}`);

    // What's on top at that point?
    const topEl = await page.evaluate(() => {
      const el = document.elementFromPoint(360, 310);
      return el ? `${el.tagName}.${String(el.className?.baseVal ?? el.className).slice(0, 60)}` : 'none';
    });
    console.log('elementFromPoint(360,310):', topEl);

    // 2) Radial menu: right-click empty area then click Sticky item
    await page.locator('.canvas').click({ button: 'right', position: { x: 500, y: 260 } });
    await page.waitForTimeout(250);
    const radialVisible = await page.locator('.canvas__radial-menu, [class*="radial"]').first().isVisible().catch(() => false);
    console.log('radial visible:', radialVisible);
    // click the sticky item by title/aria if present
    const stickyBtn = page.locator('[class*="radial"] button', { hasText: '' }).filter({ has: page.locator('svg') });
    const itemCount = await page.locator('[class*="radial-circle-item"]').count();
    console.log('radial items found:', itemCount);
    if (itemCount > 0) {
      await page.locator('[class*="radial-circle-item"]').nth(1).click({ force: true });
      await page.waitForTimeout(500);
      const nodes = await page.locator('.node-renderer').count();
      console.log('node-renderer count after radial item click:', nodes);
    }

    // 3) Toolbar sticky tool direct
    await page.locator('[data-tool-id="sticky"]').click();
    await page.locator('.canvas').click({ position: { x: 700, y: 400 } });
    await page.waitForTimeout(400);
    console.log('nodes after toolbar sticky click:', await page.locator('.node-renderer').count());

  } finally {
    await browser?.close();
    await stop(server);
  }
};

main().catch((e) => { console.error('PROBE FAILED:', e.message); process.exitCode = 1; });
