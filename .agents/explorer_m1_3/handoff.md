# Implementation Specification Report: Process Lifecycle & Concurrency Parameters
**Milestone:** Milestone 1 — Server Core Hardening & Observability  
**Role:** Explorer M1-3 (`teamwork_preview_explorer`)  
**Target Scope:**
1. `apps/server/src/storage/yPersistence.ts`: Active docs tracking, pending timer management, `flushAll(): Promise<void>`.
2. `apps/server/src/combined-server.ts`: POSIX signal handlers (`SIGINT`, `SIGTERM`), graceful shutdown sequence (code 1001, persistence flush, Fastify close, 10s fallback), global process error traps (`unhandledRejection`, `uncaughtException`), and `CANVIO_WS_MAX_PER_IP` default update (20 → 100).

---

## 1. Observation

### 1.1 Current Implementation of `apps/server/src/storage/yPersistence.ts`
Inspection of `apps/server/src/storage/yPersistence.ts:1-83` reveals:
- **Lexical Timer Map Without Document Reference (`yPersistence.ts:48-60`)**:
  ```typescript
  export function createFilePersistence() {
    const pendingWrites = new Map<string, NodeJS.Timeout>();

    const scheduleWrite = (docName: string, doc: Doc) => {
      const existing = pendingWrites.get(docName);
      if (existing) clearTimeout(existing);

      pendingWrites.set(docName, setTimeout(() => {
        pendingWrites.delete(docName);
        writeSnapshot(docName, doc).catch((error) => {
          console.error('Failed to persist Yjs document', { docName: safeId(docName), error });
        });
      }, 750));
    };
  ```
- **Lack of Active Document Registry (`yPersistence.ts:62-82`)**:
  - `bindState` receives `docName: string` and `doc: SharedDoc`, loads persisted updates from disk, and sets up `doc.on('update')`.
  - However, `doc` is never registered in any collection or tracked data structure within `createFilePersistence()`. Once `bindState` finishes, only the lexical closure inside `doc.on('update')` retains a reference to `doc`.
  - There is no mechanism to determine which documents are currently in memory or active (`activeDocs`).
- **No Immediate Flush Capability (`yPersistence.ts:62-82`)**:
  - The returned persistence object only exposes `{ provider, bindState, writeState }`.
  - There is no `flushAll()` method. Any edits made within the 750ms window prior to process shutdown remain trapped in pending timeouts and are permanently lost when the process terminates.
- **Unhandled Rejection Risk on Disconnect (`node_modules/y-websocket/bin/utils.cjs:223-229` vs `yPersistence.ts:73-80`)**:
  - In `y-websocket/bin/utils.cjs`:
    ```javascript
    if (doc.conns.size === 0 && persistence !== null) {
      persistence.writeState(doc.name, doc).then(() => {
        doc.destroy()
      })
      docs.delete(doc.name)
    }
    ```
  - In `yPersistence.ts`:
    ```typescript
    writeState: async (docName: string, doc: SharedDoc) => {
      const pending = pendingWrites.get(docName);
      if (pending) {
        clearTimeout(pending);
        pendingWrites.delete(docName);
      }
      await writeSnapshot(docName, doc);
    }
    ```
  - Notice `utils.cjs:225` does not attach `.catch(...)` to `persistence.writeState()`. If `writeSnapshot` throws an I/O error during client disconnect, Node raises an unhandled promise rejection.

---

### 1.2 Current Implementation of `apps/server/src/combined-server.ts`
Inspection of `apps/server/src/combined-server.ts:1-133` reveals:
- **Anonymous Persistence Instance Without Flush Reference (`combined-server.ts:23-24`)**:
  ```typescript
  const { setupWSConnection, setPersistence } = ywsUtils;
  setPersistence(createFilePersistence());
  ```
  `createFilePersistence()` is passed directly to `setPersistence()` without storing the instance. The server process retains no handle to invoke flush or lifecycle hooks.
- **Zero Signal Handlers (`combined-server.ts:122-132`)**:
  ```typescript
  const start = async () => {
    try {
      await app.listen({ port: PORT, host: '0.0.0.0' });
      console.log(`🚀 Canvio Combined API + Collaboration Server running on port ${PORT}`);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };

  start();
  ```
  There are zero listeners for `SIGINT` (Ctrl+C, terminal interrupt) or `SIGTERM` (Docker container stop, Kubernetes pod termination). Upon receiving a signal, the OS kills the process immediately:
  1. Connected WebSocket clients receive an unclean TCP reset (`ECONNRESET`) rather than standard WebSocket close frame 1001.
  2. Fastify HTTP connections are aborted mid-flight.
  3. Pending debounced Yjs disk writes in `pendingWrites` are aborted.
- **Lack of Process-Level Error Traps (`combined-server.ts:28-35`)**:
  - Fastify has route-level error handling via `registerErrorHandler(app)`, but process-level `unhandledRejection` and `uncaughtException` listeners are absent. Any async error outside Fastify's request-reply pipeline crashes the process.
- **Per-IP WebSocket Concurrency Limit Bottleneck (`combined-server.ts:68, 85-89`)**:
  ```typescript
  const WS_MAX_PER_IP = readPositiveIntEnv('CANVIO_WS_MAX_PER_IP', 20, 1, 1_000);
  ...
  const currentForIp = connectionsPerIp.get(peerIp) || 0;
  if (currentForIp >= WS_MAX_PER_IP) {
    conn.close(1013, 'Too many connections from this address');
    return;
  }
  ```
  `WS_MAX_PER_IP` defaults to 20. When running Requirement R3's stress test (30+ simultaneous virtual peers connecting from `127.0.0.1`), peer #21 is abruptly terminated with code 1013 ("Too many connections from this address").

---

## 2. Logic Chain

### 2.1 Storage Lifecycle & `flushAll()` Mechanics
1. **Active Document Tracking**:
   - To flush all active documents, `createFilePersistence()` must maintain an internal map `activeDocs = new Map<string, SharedDoc>()`.
   - When `bindState(docName, doc)` is invoked, `activeDocs.set(docName, doc)` registers the document.
   - To prevent memory leaks when rooms are closed, `doc.on('destroy', () => { activeDocs.delete(docName); })` automatically unregisters the document when `y-websocket` cleans it up.
2. **Pending Write Debounce Management**:
   - `pendingWrites = new Map<string, NodeJS.Timeout>()` continues to hold debounced timers for in-flight changes.
   - When `flushAll()` is triggered:
     - All active timers in `pendingWrites` are cancelled via `clearTimeout` and the map is cleared so no background timers fire concurrently.
     - For every document in `activeDocs`, `writeSnapshot` is executed immediately.
3. **Sequential Write Serialization per Document**:
   - If a background debounce write is currently in-flight when `flushAll()` or `writeState()` is called for the same document, concurrent writes to the same `.bin` file could race.
   - By maintaining an `inFlightWrites = new Map<string, Promise<void>>()`, any subsequent write for `docName` chains onto the in-flight promise. This guarantees that writes for a single document are strictly sequential, while distinct documents flush in parallel.
4. **Resilient Error Containment**:
   - In `writeState()` and `flushAll()`, individual snapshot write errors are caught and logged with `safeId(docName)`. This prevents one bad disk write from rejecting `flushAll()` or creating an unhandled promise rejection in `y-websocket`.

### 2.2 Graceful Shutdown Pipeline in `combined-server.ts`
1. **Signal Interception**:
   - Registering `process.on('SIGINT', () => handleShutdown('SIGINT'))` and `process.on('SIGTERM', () => handleShutdown('SIGTERM'))`.
   - An `isShuttingDown` boolean flag guarantees idempotence if multiple signals are received.
2. **10-Second Fallback Guard**:
   - Set an unreferenced timeout (`setTimeout(..., 10000).unref()`) at the start of shutdown. If any component hangs (e.g. frozen disk I/O, hung HTTP keep-alive), the timer forces `process.exit(1)` so containers do not remain in `Killing` state indefinitely.
3. **Phased Teardown Sequence**:
   - **Phase 1: WebSocket Drain & Notification**:
     - Call `wss.close()` to stop accepting new connection attempts on the port.
     - Iterate through `wss.clients`:
       - If `client.readyState === 1` (OPEN), send `client.close(1001, 'Server shutting down')`. Code 1001 informs collaborative peers that the server is going away, prompting client reconnect backoffs.
       - If `client.readyState === 0` (CONNECTING), call `client.terminate()`.
   - **Phase 2: Data Persistence Flush**:
     - Await `persistence.flushAll()`. With WebSockets closed, no new mutations can enter Yjs docs, guaranteeing all in-memory CRDT updates reach disk before the process exits.
   - **Phase 3: HTTP Server Drain**:
     - Await `app.close()`. Fastify stops accepting HTTP requests, allows in-flight responses to complete, and runs any registered `onClose` hooks.
   - **Phase 4: Clean Exit**:
     - Clear fallback timer, log completion, and exit with `process.exit(0)`.

### 2.3 Concurrency & Process Hardening
1. **`CANVIO_WS_MAX_PER_IP` Default**:
   - Updating default from 20 to 100 resolves the connection refusal barrier for local stress testing (Requirement R3) and multi-user corporate networks behind shared NAT gateways, while keeping the upper bound configurable up to 1,000 via environment variables.
2. **Process-Level Error Traps**:
   - `process.on('unhandledRejection')` logs the error with full stack trace via `app.log.error` without crashing the process.
   - `process.on('uncaughtException')` logs fatal error via `app.log.fatal` and exits with code 1.

---

## 3. Caveats

1. **Windows Signal Semantics**: `SIGTERM` is a POSIX signal. On Windows development environments, Ctrl+C sends `SIGINT`. In Docker containers (`node:20-alpine`), Docker sends `SIGTERM` followed by `SIGKILL` after the stop timeout. Supporting both `SIGINT` and `SIGTERM` ensures parity across local Windows development and Linux production containers.
2. **Coordination with Peer Explorers in Milestone 1**:
   - **Explorer M1-1** (`health.ts`): Requires `persistence.getActiveDocs()` to report active document counts to `/health`. Our interface explicitly provides `getActiveDocs: () => number`.
   - **Explorer M1-2** (Static frontend & fallback): Handles `@fastify/static` and SPA routes in `combined-server.ts`. Our lifecycle changes wrap around Fastify cleanly without interfering with route or static plugin configurations.

---

## 4. Conclusion & Complete Implementation Specification

### 4.1 Implementation Specification: `apps/server/src/storage/yPersistence.ts`

#### Proposed Code for `apps/server/src/storage/yPersistence.ts`
```typescript
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import type { Doc } from 'yjs';
import { ensureDataDir, safeId, writeFileAtomic } from './paths.js';

// y-websocket's production server utilities load Yjs through CommonJS. Reuse
// that instance so constructor checks and document updates share one runtime.
const require = createRequire(import.meta.url);
const Y = require('yjs') as typeof import('yjs');

export type SharedDoc = Doc & {
  name?: string;
  conns?: Map<unknown, unknown>;
};

export interface FilePersistence {
  provider: { name: string };
  bindState: (docName: string, doc: SharedDoc) => Promise<void>;
  writeState: (docName: string, doc: SharedDoc) => Promise<void>;
  flushAll: () => Promise<void>;
  flushDoc?: (docName: string) => Promise<void>;
  getActiveDocs: () => number;
  getPendingWritesCount: () => number;
}

async function documentPath(docName: string) {
  const dir = await ensureDataDir('ydocs');
  return path.join(dir, `${safeId(docName)}.bin`);
}

async function readUpdate(docName: string) {
  try {
    return await fs.readFile(await documentPath(docName));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeSnapshot(docName: string, doc: Doc) {
  const update = Y.encodeStateAsUpdate(doc);
  await writeFileAtomic(await documentPath(docName), update);
}

/**
 * Copies a persisted Yjs document binary from one board to another.
 * Used during board forking so the fork preserves all canvas content.
 */
export async function copyYDoc(sourceDocName: string, targetDocName: string): Promise<void> {
  const sourcePath = await documentPath(sourceDocName);
  const targetPath = await documentPath(targetDocName);
  const data = await fs.readFile(sourcePath);
  await writeFileAtomic(targetPath, data);
}

export function createFilePersistence(): FilePersistence {
  const pendingWrites = new Map<string, NodeJS.Timeout>();
  const activeDocs = new Map<string, SharedDoc>();
  const inFlightWrites = new Map<string, Promise<void>>();

  // Atomically serialize writes per doc to avoid concurrent write races
  const writeSnapshotSerialized = async (docName: string, doc: Doc): Promise<void> => {
    const previous = inFlightWrites.get(docName) || Promise.resolve();
    const current = previous
      .catch(() => {})
      .then(async () => {
        await writeSnapshot(docName, doc);
      });

    inFlightWrites.set(docName, current);
    try {
      await current;
    } finally {
      if (inFlightWrites.get(docName) === current) {
        inFlightWrites.delete(docName);
      }
    }
  };

  const scheduleWrite = (docName: string, doc: Doc) => {
    const existing = pendingWrites.get(docName);
    if (existing) clearTimeout(existing);

    pendingWrites.set(
      docName,
      setTimeout(() => {
        pendingWrites.delete(docName);
        writeSnapshotSerialized(docName, doc).catch((error) => {
          console.error('Failed to persist Yjs document snapshot', {
            docName: safeId(docName),
            error,
          });
        });
      }, 750)
    );
  };

  return {
    provider: { name: 'file' },

    bindState: async (docName: string, doc: SharedDoc) => {
      // Register doc in active docs map
      activeDocs.set(docName, doc);

      // Clean up tracking when doc is destroyed
      doc.on('destroy', () => {
        activeDocs.delete(docName);
        const pending = pendingWrites.get(docName);
        if (pending) {
          clearTimeout(pending);
          pendingWrites.delete(docName);
        }
      });

      const persisted = await readUpdate(docName);
      if (persisted) {
        Y.applyUpdate(doc, persisted);
      }

      doc.on('update', () => scheduleWrite(docName, doc));
      scheduleWrite(docName, doc);
    },

    writeState: async (docName: string, doc: SharedDoc) => {
      const pending = pendingWrites.get(docName);
      if (pending) {
        clearTimeout(pending);
        pendingWrites.delete(docName);
      }
      try {
        await writeSnapshotSerialized(docName, doc);
      } catch (error) {
        console.error('Failed to persist Yjs document snapshot on writeState', {
          docName: safeId(docName),
          error,
        });
      }
    },

    flushDoc: async (docName: string) => {
      const pending = pendingWrites.get(docName);
      if (pending) {
        clearTimeout(pending);
        pendingWrites.delete(docName);
      }
      const doc = activeDocs.get(docName);
      if (doc) {
        await writeSnapshotSerialized(docName, doc);
      }
    },

    flushAll: async () => {
      // 1. Clear all pending debounced timers
      for (const [, timer] of pendingWrites) {
        clearTimeout(timer);
      }
      pendingWrites.clear();

      // 2. Flush all active docs in parallel (with per-doc write serialization)
      const tasks = Array.from(activeDocs.entries()).map(async ([docName, doc]) => {
        try {
          await writeSnapshotSerialized(docName, doc);
        } catch (error) {
          console.error('Failed to flush Yjs document snapshot during flushAll', {
            docName: safeId(docName),
            error,
          });
        }
      });

      await Promise.all(tasks);
    },

    getActiveDocs: () => activeDocs.size,
    getPendingWritesCount: () => pendingWrites.size,
  };
}
```

---

### 4.2 Implementation Specification: `apps/server/src/combined-server.ts`

#### Key Changes in `apps/server/src/combined-server.ts`

1. **Persistence Reference Retention (Lines 23-24)**:
   ```typescript
   // BEFORE:
   const { setupWSConnection, setPersistence } = ywsUtils;
   setPersistence(createFilePersistence());

   // AFTER:
   const { setupWSConnection, setPersistence } = ywsUtils;
   const persistence = createFilePersistence();
   setPersistence(persistence);
   ```

2. **Global Process-Level Error Traps (After Fastify creation, line 31)**:
   ```typescript
   const app = Fastify(FASTIFY_OPTIONS);
   registerErrorHandler(app);
   registerSecurityHeaders(app);

   // Global process-level safety traps to satisfy R4 zero unhandled rejections
   process.on('unhandledRejection', (reason, promise) => {
     app.log.error({ err: reason, promise }, 'Unhandled Promise Rejection caught at process level');
   });

   process.on('uncaughtException', (error) => {
     app.log.fatal({ err: error }, 'Uncaught Exception caught at process level. Forcing exit.');
     process.exit(1);
   });
   ```

3. **Concurrency Default Bump (Line 68)**:
   ```typescript
   // BEFORE:
   const WS_MAX_PER_IP = readPositiveIntEnv('CANVIO_WS_MAX_PER_IP', 20, 1, 1_000);

   // AFTER:
   const WS_MAX_PER_IP = readPositiveIntEnv('CANVIO_WS_MAX_PER_IP', 100, 1, 1_000);
   ```

4. **Signal Handlers & Graceful Shutdown Sequence (Replacing lines 122-132)**:
   ```typescript
   let isShuttingDown = false;

   async function handleShutdown(signal: string): Promise<void> {
     if (isShuttingDown) {
       app.log.warn({ signal }, 'Shutdown already in progress; ignoring duplicate signal');
       return;
     }
     isShuttingDown = true;
     app.log.info({ signal }, `Received ${signal}. Initiating graceful shutdown...`);

     // 10-second fallback guard: force termination if components hang
     const forceExitTimer = setTimeout(() => {
       app.log.error('Graceful shutdown timed out after 10000ms. Forcing process exit.');
       process.exit(1);
     }, 10_000);
     forceExitTimer.unref();

     try {
       // Step 1: Stop accepting new WebSocket connections
       app.log.info('Closing WebSocket server listener...');
       wss.close((err) => {
         if (err) app.log.warn({ err }, 'Error during WebSocket server close');
       });

       // Step 2: Notify and disconnect all open WebSocket clients with code 1001 (Going Away)
       app.log.info(`Disconnecting ${wss.clients.size} active WebSocket clients with code 1001...`);
       for (const client of wss.clients) {
         if (client.readyState === 1 /* WebSocket.OPEN */) {
           try {
             client.close(1001, 'Server shutting down');
           } catch (err) {
             app.log.warn({ err }, 'Error closing client WebSocket');
           }
         } else if (client.readyState === 0 /* WebSocket.CONNECTING */) {
           try {
             client.terminate();
           } catch (err) {
             app.log.warn({ err }, 'Error terminating connecting WebSocket');
           }
         }
       }

       // Step 3: Flush all pending debounced writes and active Yjs documents to disk
       app.log.info('Flushing all Yjs documents to persistence...');
       await persistence.flushAll();
       app.log.info('All Yjs documents flushed to disk successfully.');

       // Step 4: Close Fastify HTTP server and drain pending requests
       app.log.info('Closing Fastify HTTP server...');
       await app.close();
       app.log.info('Fastify HTTP server closed.');

       clearTimeout(forceExitTimer);
       app.log.info('Graceful shutdown completed cleanly. Exiting.');
       process.exit(0);
     } catch (error) {
       clearTimeout(forceExitTimer);
       app.log.fatal({ err: error }, 'Error occurred during graceful shutdown');
       process.exit(1);
     }
   }

   process.on('SIGINT', () => handleShutdown('SIGINT'));
   process.on('SIGTERM', () => handleShutdown('SIGTERM'));

   const start = async () => {
     try {
       await app.listen({ port: PORT, host: '0.0.0.0' });
       console.log(`🚀 Canvio Combined API + Collaboration Server running on port ${PORT}`);
     } catch (err) {
       app.log.error(err);
       process.exit(1);
     }
   };

   start();
   ```

5. **Exposing Observability Hook to Explorer M1-1 (`health.ts`)**:
   When Explorer M1-1 wires `registerHealthRoutes(app, hooks)` into `combined-server.ts`:
   ```typescript
   registerHealthRoutes(app, {
     getActiveConnections: () => activeConnections,
     getActiveDocs: () => persistence.getActiveDocs(),
     getMaxConnections: () => WS_MAX_CONNECTIONS,
   });
   ```

---

## 5. Verification Method

### 5.1 Unit Test Verification in `scripts/unit/run-unit-tests.ts`
Add a dedicated unit test suite for `FilePersistence` lifecycle and `flushAll()` behavior:

```typescript
// Suite: Yjs FilePersistence Lifecycle & Flush
{
  const { createFilePersistence } = await import('../../apps/server/src/storage/yPersistence.js');
  const { ensureDataDir } = await import('../../apps/server/src/storage/paths.js');
  const { promises as fs } = await import('node:fs');
  const path = await import('node:path');

  const persistence = createFilePersistence();
  const testDoc1Name = `test-unit-flush-1-${Date.now()}`;
  const testDoc2Name = `test-unit-flush-2-${Date.now()}`;

  const doc1 = new Y.Doc();
  const doc2 = new Y.Doc();

  // 1. Verify active doc tracking on bindState
  await persistence.bindState(testDoc1Name, doc1 as any);
  await persistence.bindState(testDoc2Name, doc2 as any);
  assert.equal(persistence.getActiveDocs(), 2, 'Active docs count should be 2 after bindState');

  // 2. Mutate documents and verify pending write timer scheduling
  doc1.getText('test').insert(0, 'Hello Canvio');
  assert.equal(persistence.getPendingWritesCount() >= 1, true, 'Pending write timer should be scheduled');

  // 3. Trigger flushAll() immediately and assert pending timers are cleared
  await persistence.flushAll();
  assert.equal(persistence.getPendingWritesCount(), 0, 'Pending writes count must be 0 after flushAll()');

  // 4. Verify persisted content on disk
  const ydocsDir = await ensureDataDir('ydocs');
  const file1Path = path.join(ydocsDir, `${testDoc1Name}.bin`);
  const file1Exists = await fs.access(file1Path).then(() => true).catch(() => false);
  assert.equal(file1Exists, true, 'Flushed document file must exist on disk');

  // 5. Verify cleanup on document destroy
  doc1.destroy();
  assert.equal(persistence.getActiveDocs(), 1, 'Active docs count should decrement on destroy');
  doc2.destroy();
  assert.equal(persistence.getActiveDocs(), 0, 'Active docs count should be 0 when all destroyed');

  // Clean up test files
  await fs.rm(file1Path, { force: true });
}
```

### 5.2 Independent Graceful Shutdown Verification Script
Create and execute a standalone test script `scripts/test-shutdown-verify.ts`:
1. Spawns child process: `tsx apps/server/src/combined-server.ts` with `PORT=4098`.
2. Connects a WebSocket client to `ws://127.0.0.1:4098/ws/shutdown-test-board` with `Origin: http://127.0.0.1:4098`.
3. Sends `SIGINT` or `SIGTERM` signal to child process (`serverProcess.kill('SIGINT')`).
4. **Assert Client Close Event**:
   - `event.code === 1001`
   - `event.reason === 'Server shutting down'`
5. **Assert Process Exit**:
   - `exitCode === 0` within 3000ms.
6. **Assert Storage State**:
   - Document `shutdown-test-board.bin` exists in `data/ydocs/`.
   - Zero orphaned `.tmp-*` files exist in `data/ydocs/`.

### 5.3 Baseline Verification
Run Turborepo gates:
- `npm run typecheck` (TypeScript compiles cleanly with code 0 across all 6 packages).
- `npm run test:unit` (Passes all suites, including the new persistence tests).
- `npm run build` (Builds web and server targets without error).
