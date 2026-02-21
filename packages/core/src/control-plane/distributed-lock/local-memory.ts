import { randomUUID } from "node:crypto";
import { AthenaError } from "../../runtime/errors.js";
import type {
  DistributedLockAcquireRequest,
  DistributedLockAcquireResult,
  DistributedLockReleaseRequest,
  IDistributedLock
} from "./types.js";

interface MemoryLockRecord {
  lockName: string;
  ownerId: string;
  token: string;
  acquiredAtMs: number;
  expiresAtMs: number;
}

export class LocalMemoryLock implements IDistributedLock {
  private readonly locks = new Map<string, MemoryLockRecord>();

  async tryAcquire(request: DistributedLockAcquireRequest): Promise<DistributedLockAcquireResult> {
    if (!Number.isInteger(request.leaseMs) || request.leaseMs <= 0) {
      throw new AthenaError("CONFIG_ERROR", "Distributed lock leaseMs must be a positive integer.");
    }
    const current = this.locks.get(request.lockName);
    if (current && !this.shouldReclaimLock(current)) {
      return { acquired: false };
    }
    const nowMs = Date.now();
    const record: MemoryLockRecord = {
      lockName: request.lockName,
      ownerId: request.ownerId,
      token: randomUUID(),
      acquiredAtMs: nowMs,
      expiresAtMs: nowMs + request.leaseMs
    };
    this.locks.set(request.lockName, record);
    return {
      acquired: true,
      lockName: record.lockName,
      ownerId: record.ownerId,
      token: record.token,
      acquiredAt: new Date(record.acquiredAtMs).toISOString(),
      expiresAt: new Date(record.expiresAtMs).toISOString()
    };
  }

  async release(request: DistributedLockReleaseRequest): Promise<void> {
    const current = this.locks.get(request.lockName);
    if (!current) {
      return;
    }
    if (current.ownerId !== request.ownerId || current.token !== request.token) {
      return;
    }
    this.locks.delete(request.lockName);
  }

  private shouldReclaimLock(lock: MemoryLockRecord): boolean {
    return lock.expiresAtMs <= Date.now();
  }
}

export class LocalMemoryDistributedLock extends LocalMemoryLock {}
