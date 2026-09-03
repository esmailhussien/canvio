import { spawn, type ChildProcess } from 'node:child_process';
import { rmSync } from 'node:fs';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Ensure WebSocket is globally available for any sub-dependencies
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;
}

// -----------------------------------------------------------------------------
// Assertion Library
// -----------------------------------------------------------------------------

export class AssertionError extends Error {
  constructor(message: string, public actual?: unknown, public expected?: unknown) {
    super(message);
    this.name = 'AssertionError';
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new AssertionError(message);
  }
}

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      message || `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`,
      actual,
      expected
    );
  }
}

export function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new AssertionError(
      message || `Deep equality mismatch:\nExpected: ${expectedStr}\nActual:   ${actualStr}`,
      actual,
      expected
    );
  }
}

export function assertMatch(actual: string, regex: RegExp, message?: string): void {
  if (!regex.test(actual)) {
    throw new AssertionError(
      message || `String ${JSON.stringify(actual)} did not match pattern ${regex}`,
      actual,
      regex.toString()
    );
  }
}

export function assertGreaterThan(actual: number, threshold: number, message?: string): void {
  if (!(actual > threshold)) {
    throw new AssertionError(
      message || `Expected ${actual} to be greater than ${threshold}`,
      actual,
      threshold
    );
  }
}

export function assertBetween(actual: number, min: number, max: number, message?: string): void {
  if (actual < min || actual > max) {
    throw new AssertionError(
      message || `Expected ${actual} to be between ${min} and ${max}`,
      actual,
      { min, max }
    );
  }
}

// -----------------------------------------------------------------------------
// HTTP Client Helper
// -----------------------------------------------------------------------------

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Headers;
  text: string;
  json: <T = unknown>() => T;
  durationMs: number;
}

export async function httpRequest(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<HttpResponse> {
  const timeoutMs = init?.timeoutMs ?? 10000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = Date.now();

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const text = await res.text();
    const durationMs = Date.now() - startTime;

    return {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      text,
      json: <T = unknown>() => JSON.parse(text) as T,
      durationMs,
    };
  } finally {
    clearTimeout(timer);
  }
}

// -----------------------------------------------------------------------------
// Raw WebSocket Helper
// -----------------------------------------------------------------------------

export interface RawWsConnectionResult {
  ws: WebSocket;
  messages: Array<string | Buffer>;
  waitForClose: (timeoutMs?: number) => Promise<{ code: number; reason: string }>;
  waitForMessage: (timeoutMs?: number) => Promise<string | Buffer>;
  close: (code?: number, reason?: string) => Promise<void>;
}

export function connectRawWs(
  url: string,
  options?: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    subprotocols?: string | string[];
  }
): Promise<RawWsConnectionResult> {
  const timeoutMs = options?.timeoutMs ?? 7000;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, options?.subprotocols, {
      headers: options?.headers,
      handshakeTimeout: timeoutMs,
    });

    const messages: Array<string | Buffer> = [];
    const messageWaiters: Array<(msg: string | Buffer) => void> = [];
    let closePromiseResolver: ((val: { code: number; reason: string }) => void) | null = null;
    let closeEventResult: { code: number; reason: string } | null = null;

    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error(`WebSocket connection timed out after ${timeoutMs}ms to ${url}`));
    }, timeoutMs);

    ws.on('open', () => {
      clearTimeout(timer);
      resolve({
        ws,
        messages,
        waitForClose(closeTimeoutMs = 5000) {
          if (closeEventResult) {
            return Promise.resolve(closeEventResult);
          }
          return new Promise((res, rej) => {
            if (ws.readyState === WebSocket.CLOSED) {
              res(closeEventResult || { code: 1000, reason: 'Already closed' });
              return;
            }
            const closeTimer = setTimeout(() => {
              rej(new Error(`Timed out waiting for WebSocket close (${closeTimeoutMs}ms)`));
            }, closeTimeoutMs);

            closePromiseResolver = (val) => {
              clearTimeout(closeTimer);
              res(val);
            };
          });
        },
        waitForMessage(msgTimeoutMs = 5000) {
          return new Promise((res, rej) => {
            if (messages.length > 0) {
              res(messages.shift()!);
              return;
            }
            const msgTimer = setTimeout(() => {
              rej(new Error(`Timed out waiting for WS message (${msgTimeoutMs}ms)`));
            }, msgTimeoutMs);

            messageWaiters.push((msg) => {
              clearTimeout(msgTimer);
              res(msg);
            });
          });
        },
        async close(code = 1000, reason = 'Normal closure') {
          if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) return;
          return new Promise((res) => {
            ws.once('close', () => res());
            ws.close(code, reason);
          });
        },
      });
    });

    ws.on('message', (data: Buffer | string) => {
      if (messageWaiters.length > 0) {
        const waiter = messageWaiters.shift()!;
        waiter(data);
      } else {
        messages.push(data);
      }
    });

    ws.on('close', (code, reasonBuf) => {
      clearTimeout(timer);
      const reason = reasonBuf.toString('utf8');
      closeEventResult = { code, reason };
      if (closePromiseResolver) {
        closePromiseResolver(closeEventResult);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      // If we haven't opened yet, reject
      if (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) {
        reject(err);
      }
    });
  });
}

// -----------------------------------------------------------------------------
// Yjs Peer Client Helper
// -----------------------------------------------------------------------------

export interface YjsPeerOptions {
  wsUrl: string;
  room: string;
  clientId: string;
  userName?: string;
  userColor?: string;
  origin?: string;
}

export class YjsVirtualPeer {
  public doc: Y.Doc;
  public provider: WebsocketProvider;
  public nodesMap: Y.Map<Y.Map<unknown>>;
  public relationsMap: Y.Map<unknown>;
  public clientId: string;
  public synced: boolean = false;

  constructor(public options: YjsPeerOptions) {
    this.clientId = options.clientId;
    this.doc = new Y.Doc();
    this.nodesMap = this.doc.getMap('nodes') as Y.Map<Y.Map<unknown>>;
    this.relationsMap = this.doc.getMap('relations');

    const params: Record<string, string> = {
      clientId: options.clientId,
    };

    const origin = options.origin || 'https://canvio.space';
    class AuthenticatedWebSocket extends WebSocket {
      constructor(address: string | URL, protocols?: string | string[], clientOptions?: WebSocket.ClientOptions) {
        super(address, protocols, {
          ...clientOptions,
          headers: {
            origin,
            ...(clientOptions?.headers || {}),
          },
        });
      }
    }

    this.provider = new WebsocketProvider(options.wsUrl, options.room, this.doc, {
      WebSocketPolyfill: AuthenticatedWebSocket as unknown as typeof globalThis.WebSocket,
      params,
      resyncInterval: 0,
      disableBc: true,
    });

    this.provider.on('sync', (isSynced: boolean) => {
      this.synced = isSynced;
    });

    // Set awareness user identity
    this.provider.awareness.setLocalStateField('user', {
      name: options.userName || `User-${options.clientId}`,
      color: options.userColor || '#3b82f6',
    });
  }

  public async waitForSync(timeoutMs = 10000): Promise<void> {
    if (this.synced) return;

    return new Promise((res, rej) => {
      const timer = setTimeout(() => {
        rej(new Error(`Timed out waiting for Yjs sync on peer ${this.clientId} (${timeoutMs}ms)`));
      }, timeoutMs);

      const handler = (isSynced: boolean) => {
        if (isSynced) {
          clearTimeout(timer);
          this.provider.off('sync', handler);
          res();
        }
      };
      this.provider.on('sync', handler);
    });
  }

  public setCursor(x: number, y: number): void {
    this.provider.awareness.setLocalStateField('cursor', { x, y });
  }

  public getAwarenessCount(): number {
    return this.provider.awareness.getStates().size;
  }

  public async waitForAwarenessCount(expectedCount: number, timeoutMs = 10000): Promise<void> {
    if (this.getAwarenessCount() >= expectedCount) return;

    return new Promise((res, rej) => {
      const timer = setTimeout(() => {
        rej(
          new Error(
            `Timed out waiting for awareness count ${expectedCount}. Current: ${this.getAwarenessCount()}`
          )
        );
      }, timeoutMs);

      const handler = () => {
        if (this.getAwarenessCount() >= expectedCount) {
          clearTimeout(timer);
          this.provider.awareness.off('change', handler);
          res();
        }
      };

      this.provider.awareness.on('change', handler);
    });
  }

  public createStickyNote(id: string, text: string, x = 100, y = 100): void {
    this.doc.transact(() => {
      const nodeMap = new Y.Map<unknown>();
      nodeMap.set('id', id);
      nodeMap.set('type', 'sticky');
      nodeMap.set('position', { x, y });
      nodeMap.set('size', { width: 220, height: 160 });
      nodeMap.set('zIndex', 1);

      const dataMap = new Y.Map<unknown>();
      const ytext = new Y.Text();
      ytext.insert(0, text);
      dataMap.set('text', ytext);
      dataMap.set('color', 'yellow');

      nodeMap.set('data', dataMap);
      this.nodesMap.set(id, nodeMap);
    });
  }

  public updateStickyText(nodeId: string, appendText: string): void {
    const nodeMap = this.nodesMap.get(nodeId);
    if (!nodeMap) throw new Error(`Node ${nodeId} not found on peer ${this.clientId}`);

    const dataMap = nodeMap.get('data') as Y.Map<unknown>;
    const ytext = dataMap.get('text') as Y.Text;
    ytext.insert(ytext.length, appendText);
  }

  public createRelation(id: string, sourceId: string, targetId: string): void {
    this.doc.transact(() => {
      this.relationsMap.set(id, {
        id,
        sourceId,
        targetId,
        relationship: 'related_to',
      });
    });
  }

  public getStateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc);
  }

  public destroy(): void {
    this.provider.destroy();
    this.doc.destroy();
  }
}

// -----------------------------------------------------------------------------
// Server Supervisor (Ephemeral Node/TSX Server)
// -----------------------------------------------------------------------------

export interface ServerSupervisorOptions {
  port?: number;
  dataDir?: string;
  env?: Record<string, string>;
  verbose?: boolean;
}

export class ServerSupervisor {
  public childProcess: ChildProcess | null = null;
  public port: number = 0;
  public url: string = '';
  public wsUrl: string = '';
  public dataDir: string = '';
  private autoCreatedDir: boolean = false;

  public static async getFreePort(): Promise<number> {
    return new Promise((res, rej) => {
      const srv = createServer();
      srv.listen(0, '127.0.0.1', () => {
        const address = srv.address();
        if (address && typeof address === 'object') {
          const port = address.port;
          srv.close(() => res(port));
        } else {
          rej(new Error('Failed to acquire free port'));
        }
      });
      srv.on('error', rej);
    });
  }

  public async start(options?: ServerSupervisorOptions): Promise<void> {
    this.port = options?.port || (await ServerSupervisor.getFreePort());
    this.url = `http://127.0.0.1:${this.port}`;
    this.wsUrl = `ws://127.0.0.1:${this.port}`;

    if (options?.dataDir) {
      this.dataDir = options.dataDir;
    } else {
      this.dataDir = await mkdtemp(join(tmpdir(), 'canvio-e2e-'));
      this.autoCreatedDir = true;
      process.once('exit', () => {
        try {
          rmSync(this.dataDir, { recursive: true, force: true });
        } catch {
          // Ignore temp directory deletion errors
        }
      });
    }

    try {
      await mkdir(join(this.dataDir, 'boards'), { recursive: true });
      await mkdir(join(this.dataDir, 'ydocs'), { recursive: true });
    } catch {
      // Ignore directory creation failure (e.g. invalid test paths)
    }

    const serverScript = resolve(process.cwd(), 'apps', 'server', 'src', 'combined-server.ts');

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(this.port),
      CANVIO_DATA_DIR: this.dataDir,
      NODE_ENV: 'production',
      CANVIO_ALLOW_LOCAL_ORIGINS: 'true',
      CANVIO_WS_MAX_PER_IP: '200',
      CANVIO_WS_MAX_CONNECTIONS: '500',
      ...options?.env,
    };

    // Use tsx to launch the server file directly
    const isWin = process.platform === 'win32';
    const tsxCmd = isWin ? 'npx.cmd' : 'npx';
    const args = ['tsx', serverScript];

    this.childProcess = spawn(tsxCmd, args, {
      env,
      cwd: process.cwd(),
      stdio: options?.verbose ? 'inherit' : 'pipe',
      shell: isWin,
    });

    this.childProcess.stdout?.on('data', (chunk) => {
      if (options?.verbose) process.stdout.write(chunk);
    });
    this.childProcess.stderr?.on('data', (chunk) => {
      if (options?.verbose) process.stderr.write(chunk);
    });

    // Poll until ready
    await this.waitForReady(15000);
  }

  public async waitForReady(timeoutMs = 15000): Promise<void> {
    const start = Date.now();
    let lastError: unknown = null;

    while (Date.now() - start < timeoutMs) {
      try {
        const res = await httpRequest(`${this.url}/health`, { timeoutMs: 1000 });
        if (res.status === 200) {
          return;
        }
      } catch (err) {
        lastError = err;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    throw new Error(
      `Server failed to become ready at ${this.url}/health after ${timeoutMs}ms. Last error: ${String(
        lastError
      )}`
    );
  }

  public async stop(signal: NodeJS.Signals = 'SIGTERM'): Promise<{ exitCode: number | null }> {
    if (!this.childProcess || this.childProcess.killed) {
      return { exitCode: 0 };
    }

    const cp = this.childProcess;
    return new Promise((res) => {
      let resolved = false;
      const done = (code: number | null) => {
        if (resolved) return;
        resolved = true;
        res({ exitCode: process.platform === 'win32' ? 0 : code });
      };

      if (process.platform === 'win32' && cp.pid) {
        // On Windows, taskkill terminates the process tree
        const killer = spawn('taskkill.exe', ['/pid', String(cp.pid), '/t', '/f'], {
          stdio: 'ignore',
        });
        killer.on('close', () => done(0));
        killer.on('error', () => done(0));
      } else {
        cp.once('close', (code) => done(code));
        cp.once('exit', (code) => done(code));
        cp.kill(signal);
      }

      // Safety timeout
      setTimeout(() => done(0), 4000);
    });
  }

  public async cleanupDir(): Promise<void> {
    if (this.autoCreatedDir && this.dataDir) {
      try {
        await rm(this.dataDir, { recursive: true, force: true });
      } catch {
        // Ignore temp directory deletion errors
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Test Runner & Suite Framework
// -----------------------------------------------------------------------------

export interface TestCase {
  id: string;
  name: string;
  fn: () => Promise<void> | void;
}

export interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: Error;
}

export interface SuiteResult {
  suiteName: string;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestResult[];
}

export class TestRunner {
  private tests: TestCase[] = [];

  constructor(public suiteName: string) {}

  public test(id: string, name: string, fn: () => Promise<void> | void): void {
    this.tests.push({ id, name, fn });
  }

  public async run(): Promise<SuiteResult> {
    console.log(`\n=== Running Test Suite: ${this.suiteName} (${this.tests.length} tests) ===\n`);
    const results: TestResult[] = [];
    const suiteStart = Date.now();

    for (const testCase of this.tests) {
      const testStart = Date.now();
      try {
        await testCase.fn();
        const durationMs = Date.now() - testStart;
        console.log(`  ✓ [${testCase.id}] ${testCase.name} (${durationMs}ms)`);
        results.push({ id: testCase.id, name: testCase.name, passed: true, durationMs });
      } catch (err) {
        const durationMs = Date.now() - testStart;
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(`  ✗ [${testCase.id}] ${testCase.name} (${durationMs}ms)`);
        console.error(`     Error: ${error.message}`);
        if (error.stack) {
          const cleanStack = error.stack
            .split('\n')
            .slice(1, 4)
            .map((line) => `     ${line.trim()}`)
            .join('\n');
          console.error(cleanStack);
        }
        results.push({ id: testCase.id, name: testCase.name, passed: false, durationMs, error });
      }
    }

    const suiteDuration = Date.now() - suiteStart;
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    console.log(`\nSuite Summary: ${passed}/${this.tests.length} passed (${suiteDuration}ms)\n`);

    return {
      suiteName: this.suiteName,
      total: this.tests.length,
      passed,
      failed,
      durationMs: suiteDuration,
      results,
    };
  }
}
