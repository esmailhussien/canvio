/**
 * Generates apps/web/public/og-image.png (1200x630) — a real branded social
 * card instead of the bare logo. Run: node scripts/generate-og-image.mjs
 */
import { chromium } from '@playwright/test';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(root, 'apps', 'web', 'public', 'og-image.png');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background:
      radial-gradient(900px 500px at 85% 15%, rgba(128,131,255,0.16), transparent 60%),
      radial-gradient(700px 420px at 10% 90%, rgba(56,189,248,0.10), transparent 60%),
      #0a0a0f;
    color: #f0f0f5;
    position: relative;
  }
  .dot {
    position: absolute; width: 4px; height: 4px; border-radius: 50%;
    background: rgba(255,255,255,0.14);
  }
  .brand { position: absolute; top: 54px; left: 72px; display: flex; align-items: center; gap: 16px; }
  .mark {
    width: 52px; height: 52px; border-radius: 14px;
    background: linear-gradient(135deg, #8083ff, #56b8ff);
    display: flex; align-items: center; justify-content: center;
    font-size: 30px; font-weight: 800; color: #0a0a0f;
  }
  .wordmark { font-size: 34px; font-weight: 800; letter-spacing: 0.01em; }
  h1 {
    position: absolute; top: 168px; left: 72px; width: 640px;
    font-size: 58px; line-height: 1.12; font-weight: 800; letter-spacing: -0.02em;
  }
  h1 em { font-style: normal; color: #9b9dff; }
  .tagline {
    position: absolute; top: 372px; left: 74px;
    font-size: 22px; color: #9d9aab; font-weight: 500;
  }
  .trust {
    position: absolute; top: 430px; left: 74px; display: flex; gap: 12px;
  }
  .pill {
    padding: 9px 18px; border-radius: 999px; font-size: 16px; font-weight: 600;
    background: rgba(128,131,255,0.12); border: 1px solid rgba(155,157,255,0.35); color: #c9caff;
  }
  .board {
    position: absolute; top: 130px; right: -60px; width: 480px; height: 420px;
    transform: rotate(3deg);
    background: rgba(20,20,30,0.75);
    border: 1px solid rgba(255,255,255,0.12); border-radius: 18px;
    box-shadow: 0 30px 80px rgba(0,0,0,0.55);
  }
  .node {
    position: absolute; border-radius: 12px; padding: 14px 16px;
    font-size: 15px; font-weight: 700; line-height: 1.3; color: #10101a;
  }
  .node small { display: block; margin-top: 4px; font-weight: 600; opacity: 0.72; font-size: 13px; }
  .n1 { top: 34px; left: 36px; width: 150px; height: 84px; background: #facc15; }
  .n1 small { font-weight: 600; opacity: 0.75; }
  .n2 { top: 44px; right: 40px; width: 160px; height: 96px; background: #7dd3fc; }
  .n3 { bottom: 60px; left: 70px; width: 170px; height: 92px; background: #c4b5fd; }
  .n4 { bottom: 34px; right: 48px; width: 140px; height: 76px; background: #86efac; }
  svg.rels { position: absolute; inset: 0; width: 100%; height: 100%; }
  svg.rels path { fill: none; stroke-width: 3.5; stroke-linecap: round; }
</style>
</head>
<body>
  <div class="dot" style="top:90px;left:520px"></div>
  <div class="dot" style="top:300px;left:80px"></div>
  <div class="dot" style="top:520px;left:640px"></div>
  <div class="dot" style="top:180px;left:980px"></div>
  <div class="dot" style="top:560px;left:1100px"></div>

  <div class="brand">
    <div class="mark">C</div>
    <div class="wordmark">Canvio</div>
  </div>

  <h1>A whiteboard where ideas stay <em>connected.</em></h1>
  <div class="tagline">Connect ideas. Create knowledge.</div>

  <div class="trust">
    <span class="pill">Free to use</span>
    <span class="pill">No signup required</span>
    <span class="pill">Private by default</span>
  </div>

  <div class="board">
    <svg class="rels" viewBox="0 0 480 420">
      <path d="M186 118 C 250 100 280 105 320 122" stroke="#8083ff"/>
      <path d="M330 168 C 340 240 300 290 245 310" stroke="#38bdf8"/>
      <path d="M200 350 C 320 360 360 330 380 300" stroke="#22c55e"/>
      <path d="M120 190 C 110 250 115 290 140 322" stroke="#ec4899"/>
    </svg>
    <div class="node n1">Question<small>What are we exploring?</small></div>
    <div class="node n2">Evidence<small>Notes · maps · files</small></div>
    <div class="node n3">Reasoning<small>Checked & grounded</small></div>
    <div class="node n4">Decision<small>Next action</small></div>
  </div>
</body>
</html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: outFile });
  console.log(`OG image written: ${outFile}`);
} finally {
  await browser.close();
}
