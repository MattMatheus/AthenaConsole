import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AthenaError } from "../../runtime/errors.js";
import { acquireSessionLock } from "../../runtime/session-lock.js";
import type { AthenaConfig } from "../../shared/config.js";
import type {
  DistributedLockAcquireRequest,
  DistributedLockAcquireResult,
  DistributedLockReleaseRequest,
  IDistributedLock
} from "./types.js";

const DISTRIBUTED_LOCK_RECORD_SCHEMA_VERSION = 1;

interface DistributedLockRecord {
  schemaVersion: number;
  lockName: string;
  ownerId: string;
  token: string;
  pid: number;
  acquiredAt: string;
  expiresAt: string;
}

export class LocalFileDistributedLock implements IDistributedLock {
  private readonly lockRootDir: string;
  private readonly lockFilePath: string;

  constructor(config: AthenaConfig) {
    this.lockRootDir = resolve(config.workspaceRoot, config.stateDir, "locks", "distributed");
    this.lockFilePath = resolve(this.lockRootDir, "distributed.lock");
  }

  async tryAcquire(request: DistributedLockAcquireRequest): Promise<DistributedLockAcquireResult> {
    if (!Number.isInteger(request.leaseMs) || request.leaseMs <= 0) {
      throw new AthenaError("CONFIG_ERROR", "Distributed lock leaseMs must be a positive integer.");
    }
    await mkdir(this.lockRootDir, { recursive: true });
    const lock = await acquireSessionLock(this.lockFilePath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      const statePath = this.resolveLockPath(request.lockName);
      const current = await this.readLock(statePath);
      if (current && !this.shouldReclaimLock(current)) {
        return { acquired: false };
      }
      if (current) {
        await rm(statePath, { force: true });
      }
      const now = new Date();
      const record: DistributedLockRecord = {
        schemaVersion: DISTRIBUTED_LOCK_RECORD_SCHEMA_VERSION,
        lockName: request.lockName,
        ownerId: request.ownerId,
        token: randomUUID(),
        pid: process.pid,
        acquiredAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + request.leaseMs).toISOString()
      };
      await this.writeLock(statePath, record);
      return {
        acquired: true,
        lockName: record.lockName,
        ownerId: record.ownerId,
        token: record.token,
        acquiredAt: record.acquiredAt,
        expiresAt: record.expiresAt
      };
    } finally {
      await lock.release();
    }
  }

  async release(request: DistributedLockReleaseRequest): Promise<void> {
    await mkdir(this.lockRootDir, { recursive: true });
    const lock = await acquireSessionLock(this.lockFilePath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      const statePath = this.resolveLockPath(request.lockName);
      const current = await this.readLock(statePath);
      if (!current) {
        return;
      }
      if (current.token !== request.token || current.ownerId !== request.ownerId) {
        return;
      }
      await rm(statePath, { force: true });
    } finally {
      await lock.release();
    }
  }

  private resolveLockPath(lockName: string): string {
    const suffix = createHash("sha256").update(lockName).digest("hex");
    return resolve(this.lockRootDir, `${suffix}.json`);
  }

  private async readLock(path: string): Promise<DistributedLockRecord | undefined> {
    if (!existsSync(path)) {
      return undefined;
    }
    try {
      const raw = await readFile(path, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (
        typeof parsed.lockName !== "string" ||
        typeof parsed.ownerId !== "string" ||
        typeof parsed.token !== "string" ||
        typeof parsed.pid !== "number" ||
        typeof parsed.acquiredAt !== "string" ||
        typeof parsed.expiresAt !== "string"
      ) {
        return undefined;
      }
      return {
        schemaVersion:
          typeof parsed.schemaVersion === "number" && Number.isInteger(parsed.schemaVersion) && parsed.schemaVersion > 0
            ? parsed.schemaVersion
            : DISTRIBUTED_LOCK_RECORD_SCHEMA_VERSION,
        lockName: parsed.lockName,
        ownerId: parsed.ownerId,
        token: parsed.token,
        pid: parsed.pid,
        acquiredAt: parsed.acquiredAt,
        expiresAt: parsed.expiresAt
      };
    } catch {
      return undefined;
    }
  }

  private async writeLock(path: string, record: DistributedLockRecord): Promise<void> {
    const tmpPath = `${path}.${process.pid}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    await rename(tmpPath, path);
    await rm(tmpPath, { force: true });
  }

  private shouldReclaimLock(lock: DistributedLockRecord): boolean {
    if (!isPidAlive(lock.pid)) {
      return true;
    }
    const acquiredAtMs = Date.parse(lock.acquiredAt);
    if (!Number.isFinite(acquiredAtMs)) {
      return true;
    }
    const expiresAtMs = Date.parse(lock.expiresAt);
    if (!Number.isFinite(expiresAtMs)) {
      return true;
    }
    return expiresAtMs <= Date.now();
  }
}

function isPidAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code !== "ESRCH";
  }
}
