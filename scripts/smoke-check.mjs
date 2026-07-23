import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const distDir = join(root, 'apps', 'web', 'dist');
const indexPath = join(distDir, 'index.html');
const configPath = join(distDir, 'canvio-config.js');
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
}

if (!existsSync(configPath)) {
  fail('runtime config file canvio-config.js is missing from dist.');
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
  console.log('Smoke check passed.');
}
