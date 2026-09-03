import { promises as fs } from 'node:fs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DATA_DIR, ensureDataDir } from './storage/paths.js';

export const SERVER_VERSION = '0.1.0';

export interface HealthConnectionHooks {
  getActiveConnections?: () => number;
  getActiveDocs?: () => number;
  getMaxConnections?: () => number;
}

export interface StorageHealth {
  status: 'ok' | 'degraded' | 'unavailable';
  accessible: boolean;
  writable: boolean;
  dataDir: string;
  boardsDir?: string;
  ydocsDir?: string;
  error?: string;
}

export interface MemoryStats {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  rssMb: number;
  heapTotalMb: number;
  heapUsedMb: number;
}

/**
 * Formats a duration in seconds into a human-readable string (e.g., "1d 2h 3m 4s", "5m 45s", "0s").
 */
export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0s';
  const totalSeconds = Math.floor(seconds);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

/**
 * Gathers current Node.js process memory usage in bytes and converted megabytes.
 */
export function getMemoryStats(): MemoryStats {
  const mem = process.memoryUsage();
  const toMb = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 100) / 100;
  return {
    rss: mem.rss,
    heapTotal: mem.heapTotal,
    heapUsed: mem.heapUsed,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers,
    rssMb: toMb(mem.rss),
    heapTotalMb: toMb(mem.heapTotal),
    heapUsedMb: toMb(mem.heapUsed),
  };
}

/**
 * Checks storage accessibility and write permissions across both `boards` and `ydocs` directories.
 */
export async function checkStorageHealth(): Promise<StorageHealth> {
  let boardsDir: string | undefined;
  let ydocsDir: string | undefined;
  let boardsOk = false;
  let ydocsOk = false;
  const errors: string[] = [];

  try {
    boardsDir = await ensureDataDir('boards');
    await fs.access(boardsDir, fs.constants.R_OK | fs.constants.W_OK);
    boardsOk = true;
  } catch (err) {
    const message = (err as Error).message || 'boards directory inaccessible';
    errors.push(`boards: ${message}`);
  }

  try {
    ydocsDir = await ensureDataDir('ydocs');
    await fs.access(ydocsDir, fs.constants.R_OK | fs.constants.W_OK);
    ydocsOk = true;
  } catch (err) {
    const message = (err as Error).message || 'ydocs directory inaccessible';
    errors.push(`ydocs: ${message}`);
  }

  const allOk = boardsOk && ydocsOk;
  const noneOk = !boardsOk && !ydocsOk;
  const status: StorageHealth['status'] = allOk ? 'ok' : noneOk ? 'unavailable' : 'degraded';

  return {
    status,
    accessible: allOk,
    writable: allOk,
    dataDir: DATA_DIR,
    boardsDir,
    ydocsDir,
    ...(errors.length > 0 ? { error: errors.join('; ') } : {}),
  };
}

/**
 * Readiness probe: throws an error if storage is not ready and writable.
 */
export async function getReadiness(): Promise<Record<string, unknown>> {
  const storage = await checkStorageHealth();
  if (!storage.writable || !storage.accessible) {
    const message = storage.error || 'Storage is not writable or accessible';
    const error = new Error(message);
    (error as Error & { storage?: StorageHealth }).storage = storage;
    throw error;
  }

  return {
    status: 'ready',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime() * 100) / 100,
    storage,
  };
}

/**
 * Compiles a complete health report combining uptime, process info, memory, connection hooks, and storage.
 */
export async function getHealthReport(hooks: HealthConnectionHooks = {}): Promise<Record<string, unknown>> {
  const uptimeSeconds = process.uptime();
  const memory = getMemoryStats();
  const storage = await checkStorageHealth();

  const getSafeCount = (fn?: () => number) => {
    if (typeof fn !== 'function') return 0;
    try {
      const val = fn();
      return typeof val === 'number' && Number.isFinite(val) && val >= 0 ? val : 0;
    } catch {
      return 0;
    }
  };

  const activeWebSocket = getSafeCount(hooks.getActiveConnections);
  const activeDocuments = getSafeCount(hooks.getActiveDocs);
  const maxConnections = getSafeCount(hooks.getMaxConnections);

  const isHealthy = storage.accessible && storage.writable;

  return {
    status: isHealthy ? 'healthy' : 'degraded',
    version: SERVER_VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.round(uptimeSeconds * 100) / 100,
    uptimeFormatted: formatUptime(uptimeSeconds),
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      environment: process.env.NODE_ENV || 'development',
    },
    memory,
    activeConnections: activeWebSocket,
    connections: {
      active: activeWebSocket,
      activeWebSocket,
      activeDocuments,
      maxConnections,
    },
    storage: {
      status: storage.status,
      accessible: storage.accessible,
      writable: storage.writable,
      dataDir: storage.dataDir,
      type: 'filesystem',
      ...(storage.boardsDir ? { boardsDir: storage.boardsDir } : {}),
      ...(storage.ydocsDir ? { ydocsDir: storage.ydocsDir } : {}),
      ...(storage.error ? { error: storage.error } : {}),
    },
  };
}

/**
 * Registers `/health`, `/api/health`, `/health/ready`, and `/api/health/ready` on a Fastify instance.
 */
export function registerHealthRoutes(app: FastifyInstance, hooks: HealthConnectionHooks = {}): void {
  const livenessHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
    const report = await getHealthReport(hooks);
    return reply.code(200).send(report);
  };

  const readinessHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const readyReport = await getReadiness();
      return reply.code(200).send(readyReport);
    } catch (error) {
      app.log.error({ err: error }, 'Readiness check failed');
      return reply.code(503).send({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        storage: 'unavailable',
        error: (error as Error).message || 'Storage unavailable',
      });
    }
  };

  app.get('/health', livenessHandler);
  app.get('/api/health', livenessHandler);
  app.get('/health/ready', readinessHandler);
  app.get('/api/health/ready', readinessHandler);
}
