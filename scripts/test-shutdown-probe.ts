import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

async function runProbe() {
  const dataDir = await mkdtemp(join(tmpdir(), 'canvio-probe-'));
  const port = 4567;
  console.log('Using dataDir:', dataDir, 'port:', port);

  const child = spawn(
    process.execPath,
    [
      '--import',
      'tsx',
      '-e',
      `
      import './apps/server/src/combined-server.ts';
      process.on('message', (msg) => {
        console.log('[PROBE-CHILD] Got IPC message:', msg);
        if (msg === 'SIGTERM') process.emit('SIGTERM');
        if (msg === 'SIGINT') process.emit('SIGINT');
      });
      `,
    ],
    {
      env: {
        ...process.env,
        PORT: String(port),
        CANVIO_DATA_DIR: dataDir,
        NODE_ENV: 'production',
        CANVIO_ALLOW_LOCAL_ORIGINS: 'true',
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    }
  );

  child.stdout?.on('data', (d) => process.stdout.write(`[SERVER OUT] ${d}`));
  child.stderr?.on('data', (d) => process.stderr.write(`[SERVER ERR] ${d}`));

  // Wait for health endpoint
  const start = Date.now();
  while (Date.now() - start < 10000) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) {
        console.log('Server is healthy!');
        break;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Connect raw WebSocket
  console.log('Connecting raw WebSocket...');
  const rawWs = new WebSocket(`ws://127.0.0.1:${port}/raw-board-test`, {
    headers: { Origin: 'https://canvio.space' },
  });

  let rawCloseCode: number | null = null;
  let rawCloseReason: string | null = null;
  rawWs.on('close', (code, reason) => {
    rawCloseCode = code;
    rawCloseReason = reason.toString();
    console.log(`[RAW WS] Closed with code=${code}, reason=${reason.toString()}`);
  });

  await new Promise((resolve) => rawWs.on('open', resolve));
  console.log('Raw WS opened!');

  // Connect Yjs virtual peer
  console.log('Connecting Yjs Virtual Peer...');
  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(
    `ws://127.0.0.1:${port}`,
    'crdt-flush-test',
    ydoc,
    {
      WebSocketPolyfill: WebSocket as any,
      disableBc: true,
    }
  );

  let providerCloseCode: number | null = null;
  let providerCloseReason: string | null = null;
  provider.ws?.addEventListener('close', (event: any) => {
    providerCloseCode = event.code;
    providerCloseReason = event.reason;
    console.log(`[YJS WS] Closed with code=${event.code}, reason=${event.reason}`);
  });

  await new Promise((resolve) => {
    if (provider.synced) resolve(true);
    else provider.once('sync', resolve);
  });
  console.log('Yjs peer synced!');

  // Trigger in-flight edit
  console.log('Mutating Yjs doc with 25 nodes...');
  const nodesMap = ydoc.getMap('nodes');
  ydoc.transact(() => {
    for (let i = 0; i < 25; i++) {
      const node = new Y.Map();
      node.set('id', `node-${i}`);
      node.set('type', 'sticky');
      node.set('text', `In-flight edit item ${i}`);
      node.set('timestamp', Date.now());
      nodesMap.set(`node-${i}`, node);
    }
  });

  // Wait 30ms to ensure the websocket frames are sent across the TCP connection
  await new Promise((r) => setTimeout(r, 30));

  // Trigger SIGTERM immediately (way before the 750ms debounce)
  console.log('Triggering SIGTERM shutdown via IPC...');
  child.send('SIGTERM');

  // Wait for child process exit
  const exitResult = await new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal }));
  });
  console.log('Server process exited:', exitResult);

  console.log('Summary of Close Codes:');
  console.log('Raw WS close code:', rawCloseCode, 'reason:', rawCloseReason);
  console.log('Yjs WS close code:', providerCloseCode, 'reason:', providerCloseReason);

  // Check disk persistence
  const { existsSync, readdirSync, readFileSync } = await import('node:fs');
  const ydocsDir = join(dataDir, 'ydocs');
  console.log('Files in ydocsDir:', existsSync(ydocsDir) ? readdirSync(ydocsDir) : 'DIR NOT FOUND');

  const binFile = join(ydocsDir, 'crdt-flush-test.bin');
  if (existsSync(binFile)) {
    const data = readFileSync(binFile);
    console.log('Binary file exists! Size:', data.byteLength, 'bytes');
    const readDoc = new Y.Doc();
    Y.applyUpdate(readDoc, data);
    const readNodes = readDoc.getMap('nodes');
    console.log('Persisted nodes count in re-read Y.Doc:', readNodes.size);
  } else {
    console.error('ERROR: Binary file does NOT exist on disk!');
  }

  // Check for orphan tmp files
  const allFiles = existsSync(dataDir) ? readdirSync(dataDir, { recursive: true }) : [];
  const tmpFiles = (allFiles as string[]).filter((f) => f.includes('.tmp-'));
  console.log('Orphaned .tmp-* files count:', tmpFiles.length, tmpFiles);

  await rm(dataDir, { recursive: true, force: true }).catch(() => {});
  provider.destroy();
  rawWs.close();
}

runProbe().catch(console.error);
