import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const distDir = join(root, 'apps', 'web', 'dist');
const indexPath = join(distDir, 'index.html');
const configPath = join(distDir, 'canvio-config.js');
const sitemapPath = join(distDir, 'sitemap.xml');
const robotsPath = join(distDir, 'robots.txt');
const assetsDir = join(distDir, 'assets');

function fail(message) {
  console.error(`Smoke check failed: ${message}`);
  process.exitCode = 1;
}

if (!existsSync(indexPath)) {
  fail('apps/web/dist/index.html is missing. Run npm run build first.');
} else {
  const index = readFileSync(indexPath, 'utf8');
  if (!index.includes('/canvio-config.js')) {
    fail('runtime config script is not referenced by index.html.');
  }
  if (!index.includes('Canvio | Connected Whiteboard')) {
    fail('index.html is missing expected title metadata.');
  }
}

if (!existsSync(configPath)) {
  fail('runtime config file canvio-config.js is missing from dist.');
}

if (!existsSync(sitemapPath)) {
  fail('sitemap.xml is missing from dist.');
}

if (!existsSync(robotsPath)) {
  fail('robots.txt is missing from dist.');
}

// Check SSG / Prerendered marketing routes
const expectedPrerenderRoutes = [
  'how-it-works',
  'support',
  'updates',
  'updates/visual-reasoning-and-ai-thinking-partner',
  'updates/laser-pointer-for-live-guidance',
  'updates/richer-language-aware-ai-boards',
  'updates/ai-navigator-editable-boards',
  'updates/relations-for-connected-thinking',
];

for (const route of expectedPrerenderRoutes) {
  const routeHtmlPath = join(distDir, route, 'index.html');
  if (!existsSync(routeHtmlPath)) {
    fail(`prerendered route HTML is missing: apps/web/dist/${route}/index.html`);
  } else {
    const html = readFileSync(routeHtmlPath, 'utf8');
    if (!html.includes('<title>') || html.includes('<title>undefined</title>')) {
      fail(`prerendered route "${route}" has invalid title tag.`);
    }
    if (!html.includes('id="canvio-seo-jsonld"')) {
      fail(`prerendered route "${route}" is missing Schema.org JSON-LD.`);
    }
    if (!html.includes('rel="canonical"')) {
      fail(`prerendered route "${route}" is missing canonical link.`);
    }
  }
}

if (!existsSync(assetsDir)) {
  fail('dist assets directory is missing.');
} else {
  const assets = readdirSync(assetsDir);
  const expectedChunks = ['vendor-react', 'vendor-map', 'vendor-collaboration'];
  for (const chunk of expectedChunks) {
    if (!assets.some((asset) => asset.startsWith(chunk) && asset.endsWith('.js'))) {
      fail(`expected split chunk "${chunk}" was not emitted.`);
    }
  }

  const oversized = assets
    .filter((asset) => asset.endsWith('.js'))
    .map((asset) => ({ asset, size: statSync(join(assetsDir, asset)).size }))
    .filter(({ size }) => size > 500 * 1024);

  if (oversized.length > 0) {
    fail(`oversized JS chunks remain: ${oversized.map(({ asset }) => asset).join(', ')}`);
  }
}

if (!process.exitCode) {
  console.log('✅ Smoke check passed: All assets, split chunks, and prerendered SSG routes verified!');
}
