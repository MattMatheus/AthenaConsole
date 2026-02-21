import { appendFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { AthenaConfig } from "../shared/config.js";
import type { SessionRecord, TranscriptEntry } from "../shared/contracts.js";
import { transcriptStreamBroker } from "./transcript-stream.js";
import { AthenaError } from "./errors.js";
import { acquireSessionLock } from "./session-lock.js";

export interface RuntimePaths {
  stateRoot: string;
  sessionsDir: string;
  transcriptsDir: string;
  locksDir: string;
}

export interface PreparedSession {
  session: SessionRecord;
  transcript: TranscriptEntry[];
  transcriptPath: string;
  lockPath: string;
}

const SESSION_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const SESSION_SCHEMA_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1_000;
const RUN_HISTORY_RETENTION_META_SCHEMA_VERSION = 1;

interface RunHistoryRetentionMeta {
  schemaVersion: 1;
  lastSweepAt: string;
}

export function assertValidSessionId(sessionId: string): void {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new AthenaError(
      "CONFIG_ERROR",
      `Invalid sessionId '${sessionId}'. Allowed pattern: ${SESSION_ID_PATTERN.source}`
    );
  }
}

function safeJsonParse<T>(raw: string, filePath: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new AthenaError("SESSION_IO_ERROR", `Invalid JSON in ${filePath}`, false, error);
  }
}

export function resolveRuntimePaths(config: AthenaConfig): RuntimePaths {
  const stateRoot = resolve(config.workspaceRoot, config.stateDir);
  return {
    stateRoot,
    sessionsDir: resolve(stateRoot, "sessions"),
    transcriptsDir: resolve(stateRoot, "transcripts"),
    locksDir: resolve(stateRoot, "locks")
  };
}

export class SessionStore {
  private readonly paths: RuntimePaths;
  private readonly retentionDays: number;
  private readonly retentionSweepIntervalMs: number;
  private readonly retentionMetaPath: string;
  private readonly retentionLockPath: string;
  private nextRetentionSweepAtMs = 0;

  constructor(private readonly config: AthenaConfig) {
    this.paths = resolveRuntimePaths(config);
    this.retentionDays = config.runHistory?.retentionDays ?? 30;
    this.retentionSweepIntervalMs = config.runHistory?.sweepIntervalMs ?? 60 * 60 * 1_000;
    this.retentionMetaPath = resolve(this.paths.stateRoot, "run-history-retention.json");
    this.retentionLockPath = resolve(this.paths.locksDir, "run-history-retention.lock");
    this.assertPathWithin(this.paths.stateRoot, this.retentionMetaPath);
    this.assertPathWithin(this.paths.locksDir, this.retentionLockPath);
  }

  getRuntimePaths(): RuntimePaths {
    return this.paths;
  }

  async ensureStateDirectories(): Promise<void> {
    await mkdir(this.paths.sessionsDir, { recursive: true });
    await mkdir(this.paths.transcriptsDir, { recursive: true });
    await mkdir(this.paths.locksDir, { recursive: true });
  }

  async pruneRunHistoryIfDue(nowMs = Date.now()): Promise<void> {
    if (!Number.isFinite(this.retentionDays) || this.retentionDays <= 0) {
      return;
    }
    if (this.nextRetentionSweepAtMs > nowMs) {
      return;
    }
    await this.ensureStateDirectories();

    let retentionLock: Awaited<ReturnType<typeof acquireSessionLock>> | undefined;
    try {
      retentionLock = await acquireSessionLock(this.retentionLockPath, {
        timeoutMs: 50,
        retryDelayMs: 10
      });
    } catch (error) {
      const athenaError = error instanceof AthenaError ? error : undefined;
      if (athenaError?.code === "SESSION_LOCK_TIMEOUT") {
        return;
      }
      throw error;
    }

    try {
      const existingMeta = await this.readRetentionMeta();
      const lastSweepMs = existingMeta?.lastSweepAt ? Date.parse(existingMeta.lastSweepAt) : undefined;
      if (Number.isFinite(lastSweepMs) && (lastSweepMs as number) + this.retentionSweepIntervalMs > nowMs) {
        this.nextRetentionSweepAtMs = (lastSweepMs as number) + this.retentionSweepIntervalMs;
        return;
      }

      const cutoffMs = nowMs - this.retentionDays * DAY_MS;
      const names = await readdir(this.paths.sessionsDir);
      for (const name of names) {
        if (!name.endsWith(".json")) {
          continue;
        }
        const sessionId = name.slice(0, -".json".length);
        if (!SESSION_ID_PATTERN.test(sessionId)) {
          continue;
        }

        const sessionPath = this.resolveSessionPath(sessionId);
        const stale = await this.isSessionStaleByUpdatedAt(sessionPath, cutoffMs);
        if (!stale) {
          continue;
        }

        let sessionLock: Awaited<ReturnType<typeof acquireSessionLock>> | undefined;
        try {
          sessionLock = await acquireSessionLock(this.resolveLockPath(sessionId), {
            timeoutMs: 50,
            retryDelayMs: 10
          });
        } catch (error) {
          const athenaError = error instanceof AthenaError ? error : undefined;
          if (athenaError?.code === "SESSION_LOCK_TIMEOUT") {
            continue;
          }
          throw error;
        }
        try {
          const stillStale = await this.isSessionStaleByUpdatedAt(sessionPath, cutoffMs);
          if (!stillStale) {
            continue;
          }
          await rm(sessionPath, { force: true });
          await rm(this.resolveTranscriptPath(sessionId), { force: true });
        } finally {
          await sessionLock.release();
        }
      }

      await this.atomicWriteFile(
        this.retentionMetaPath,
        `${JSON.stringify(
          {
            schemaVersion: RUN_HISTORY_RETENTION_META_SCHEMA_VERSION,
            lastSweepAt: new Date(nowMs).toISOString()
          } satisfies RunHistoryRetentionMeta,
          null,
          2
        )}\n`
      );
      this.nextRetentionSweepAtMs = nowMs + this.retentionSweepIntervalMs;
    } finally {
      await retentionLock.release();
    }
  }

  async prepareSession(sessionId: string, model: string, provider: string): Promise<PreparedSession> {
    assertValidSessionId(sessionId);
    await this.ensureStateDirectories();

    const sessionPath = this.resolveSessionPath(sessionId);
    const transcriptPath = this.resolveTranscriptPath(sessionId);
    const lockPath = this.resolveLockPath(sessionId);

    const now = new Date().toISOString();
    let session: SessionRecord;

    if (existsSync(sessionPath)) {
      const raw = await readFile(sessionPath, "utf8");
      session = migrateSessionRecord(safeJsonParse<SessionRecord>(raw, sessionPath));
      session.provider = provider;
      session.model = model;
      session.updatedAt = now;
    } else {
      session = {
        schemaVersion: SESSION_SCHEMA_VERSION,
        id: sessionId,
        transcriptPath,
        model,
        provider,
        createdAt: now,
        updatedAt: now
      };
    }

    await this.atomicWriteFile(sessionPath, `${JSON.stringify(session, null, 2)}\n`);

    const transcript = await this.readTranscript(transcriptPath);

    return {
      session,
      transcript,
      transcriptPath,
      lockPath
    };
  }

  async updateSessionMetadata(sessionId: string, model: string, provider: string): Promise<void> {
    assertValidSessionId(sessionId);
    const sessionPath = this.resolveSessionPath(sessionId);
    if (!existsSync(sessionPath)) {
      return;
    }

    const raw = await readFile(sessionPath, "utf8");
    const session = migrateSessionRecord(safeJsonParse<SessionRecord>(raw, sessionPath));
    session.model = model;
    session.provider = provider;
    session.updatedAt = new Date().toISOString();
    await this.atomicWriteFile(sessionPath, `${JSON.stringify(session, null, 2)}\n`);
  }

  async appendTranscript(transcriptPath: string, entries: TranscriptEntry[]): Promise<void> {
    const payload = entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
    await appendFile(transcriptPath, payload, "utf8");
    const sessionId = transcriptPathToSessionId(transcriptPath);
    if (sessionId) {
      transcriptStreamBroker.publish(sessionId, entries);
    }
  }

  private async readTranscript(transcriptPath: string): Promise<TranscriptEntry[]> {
    if (!existsSync(transcriptPath)) {
      return [];
    }

    const fileStats = await stat(transcriptPath);
    if (fileStats.size === 0) {
      return [];
    }

    const raw = await readFile(transcriptPath, "utf8");
    const entries: TranscriptEntry[] = [];

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const parsed = safeJsonParse<TranscriptEntry>(trimmed, transcriptPath);
      entries.push(parsed);
    }

    return entries;
  }

  createTranscriptEntry(
    role: TranscriptEntry["role"],
    content: string,
    createdAt = new Date().toISOString(),
    metadata?: Record<string, string>
  ): TranscriptEntry {
    return {
      id: randomUUID(),
      role,
      content,
      ...(metadata ? { metadata } : {}),
      createdAt
    };
  }

  private resolveSessionPath(sessionId: string): string {
    return this.resolveStateFilePath(this.paths.sessionsDir, sessionId, ".json");
  }

  resolveTranscriptPath(sessionId: string): string {
    return this.resolveStateFilePath(this.paths.transcriptsDir, sessionId, ".jsonl");
  }

  resolveLockPath(sessionId: string): string {
    return this.resolveStateFilePath(this.paths.locksDir, sessionId, ".lock");
  }

  private resolveStateFilePath(baseDir: string, sessionId: string, suffix: string): string {
    assertValidSessionId(sessionId);
    const candidate = resolve(baseDir, `${sessionId}${suffix}`);
    this.assertPathWithin(baseDir, candidate);
    return candidate;
  }

  private assertPathWithin(baseDir: string, candidate: string): void {
    const rel = relative(baseDir, candidate);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new AthenaError("SESSION_IO_ERROR", `Resolved path escapes state directory: ${candidate}`);
    }
  }

  private async atomicWriteFile(path: string, payload: string): Promise<void> {
    const tmpPath = `${path}.${process.pid}.tmp`;
    await writeFile(tmpPath, payload, "utf8");
    await rename(tmpPath, path);
    await rm(tmpPath, { force: true });
  }

  private async readRetentionMeta(): Promise<RunHistoryRetentionMeta | undefined> {
    if (!existsSync(this.retentionMetaPath)) {
      return undefined;
    }
    try {
      const raw = await readFile(this.retentionMetaPath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (
        parsed.schemaVersion !== RUN_HISTORY_RETENTION_META_SCHEMA_VERSION ||
        typeof parsed.lastSweepAt !== "string" ||
        !Number.isFinite(Date.parse(parsed.lastSweepAt))
      ) {
        return undefined;
      }
      return {
        schemaVersion: RUN_HISTORY_RETENTION_META_SCHEMA_VERSION,
        lastSweepAt: parsed.lastSweepAt
      };
    } catch {
      return undefined;
    }
  }

  private async isSessionStaleByUpdatedAt(sessionPath: string, cutoffMs: number): Promise<boolean> {
    if (!existsSync(sessionPath)) {
      return false;
    }
    try {
      const raw = await readFile(sessionPath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.updatedAt !== "string") {
        return false;
      }
      const updatedAtMs = Date.parse(parsed.updatedAt);
      if (!Number.isFinite(updatedAtMs)) {
        return false;
      }
      return updatedAtMs < cutoffMs;
    } catch {
      return false;
    }
  }
}

function migrateSessionRecord(record: SessionRecord): SessionRecord {
  return {
    ...record,
    schemaVersion: SESSION_SCHEMA_VERSION
  };
}

function transcriptPathToSessionId(transcriptPath: string): string | undefined {
  const fileName = basename(transcriptPath);
  if (!fileName.endsWith(".jsonl")) {
    return undefined;
  }
  const sessionId = fileName.slice(0, -".jsonl".length);
  if (!sessionId) {
    return undefined;
  }
  try {
    assertValidSessionId(sessionId);
    return sessionId;
  } catch {
    return undefined;
  }
}
