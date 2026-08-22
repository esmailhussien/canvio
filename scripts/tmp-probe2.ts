/**
 * Temporary diagnostic probe #2: radial menu click interception.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const webDir = join(process.cwd(), 'apps', 'web');
const port = 4191;
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
    page.on('pageerror', (err) => console.log('[pageerror]', String(err).slice(0, 400)));

    await page.goto(`${baseUrl}/w/probe2-${Date.now()}`);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.world-page__starter-panel').waitFor({ state: 'visible', timeout: 8000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Open radial
    await page.locator('.canvas').click({ button: 'right', position: { x: 620, y: 300 } });
    await page.waitForTimeout(350);

    const info = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll<HTMLButtonElement>('.canvas__radial-circle-item'));
      const target = items.find(b => b.getAttribute('aria-label') === 'Add Text Node') || items[1];
      if (!target) return { error: 'no items' };
      const r = target.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const stack = document.elementsFromPoint(cx, cy).slice(0, 5).map((el) => {
        const cls = String((el as HTMLElement).className?.baseVal ?? (el as HTMLElement).className ?? '').slice(0, 50);
        const pe = getComputedStyle(el).pointerEvents;
        const zi = getComputedStyle(el).zIndex;
        return `${el.tagName}.${cls} pe=${pe} z=${zi}`;
      });
      const ring = document.querySelector('.canvas__radial-ring') as HTMLElement | null;
      return {
        itemCount: items.length,
        point: { cx, cy },
        stack,
        ringStyle: ring ? { z: getComputedStyle(ring).zIndex, pos: getComputedStyle(ring).position } : null,
      };
    });
    console.log(JSON.stringify(info, null, 2));

    // Attach a tracer then click
    await page.evaluate(() => {
      (window as any).__clicked = [];
      document.addEventListener('click', (e) => {
        const t = e.target as HTMLElement;
        (window as any).__clicked.push(`${t.tagName}.${String(t.className?.baseVal ?? t.className ?? '').slice(0, 40)} defaultPrevented=${e.defaultPrevented}`);
      }, true);
    });
    await page.locator('.canvas__radial-circle-item[aria-label="Add Text Node"]').click();
    await page.waitForTimeout(400);
    console.log('click trace:', JSON.stringify(await page.evaluate(() => (window as any).__clicked)));
    console.log('nodes after:', await page.locator('.node-renderer').count());
    console.log('radial still open:', await page.locator('.canvas__radial-ring').isVisible().catch(() => false));
  } finally {
    await browser?.close();
    await stop(server);
  }
};

main().catch((e) => { console.error('PROBE FAILED:', e.message); process.exitCode = 1; });
