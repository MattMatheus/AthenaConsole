import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { AthenaError } from "../src/runtime/errors.js";
import {
  K8sLeaseLockProvider,
  LocalFileDistributedLock,
  LocalMemoryLock,
  RedisLockProvider
} from "../src/control-plane/distributed-lock.js";
import { loadConfig } from "../src/shared/config.js";

class FakeRedisClient {
  private readonly locks = new Map<string, { value: string; expiresAtMs: number }>();
  public throwOnSet: Error | undefined;
  public throwOnEval: Error | undefined;

  async set(
    key: string,
    value: string,
    mode: "PX",
    leaseMs: number,
    onlyIfMissing: "NX"
  ): Promise<"OK" | null> {
    if (this.throwOnSet) {
      throw this.throwOnSet;
    }
    if (mode !== "PX" || onlyIfMissing !== "NX") {
      throw new Error("unexpected redis set mode");
    }
    if (!Number.isInteger(leaseMs) || leaseMs <= 0) {
      throw new Error("invalid lease");
    }
    const current = this.readActive(key);
    if (current) {
      return null;
    }
    this.locks.set(key, {
      value,
      expiresAtMs: Date.now() + leaseMs
    });
    return "OK";
  }

  async eval(_script: string, numKeys: number, ...args: string[]): Promise<number> {
    if (this.throwOnEval) {
      throw this.throwOnEval;
    }
    if (numKeys !== 1 || args.length < 2) {
      throw new Error("unexpected redis eval args");
    }
    const [key, expectedValue] = args;
    if (!key || !expectedValue) {
      throw new Error("missing eval args");
    }
    const current = this.readActive(key);
    if (!current || current.value !== expectedValue) {
      return 0;
    }
    this.locks.delete(key);
    return 1;
  }

  hasActiveLock(key: string): boolean {
    return this.readActive(key) !== undefined;
  }

  private readActive(key: string): { value: string; expiresAtMs: number } | undefined {
    const current = this.locks.get(key);
    if (!current) {
      return undefined;
    }
    if (current.expiresAtMs <= Date.now()) {
      this.locks.delete(key);
      return undefined;
    }
    return current;
  }
}

function createK8sApiError(code: number, message: string): Error & { code: number } {
  const error = new Error(message) as Error & { code: number };
  error.code = code;
  return error;
}

class FakeK8sLeaseClient {
  private readonly leases = new Map<string, { holderIdentity: string; leaseDurationSeconds: number; renewTime: string }>();
  public throwOnRead: (Error & { code: number }) | undefined;
  public throwOnCreate: (Error & { code: number }) | undefined;
  public throwOnDelete: (Error & { code: number }) | undefined;

  async readNamespacedLease(param: { name: string; namespace: string }): Promise<{
    metadata: { name: string; namespace: string };
    spec: { holderIdentity: string; leaseDurationSeconds: number; renewTime: string };
  }> {
    if (this.throwOnRead) {
      throw this.throwOnRead;
    }
    const key = `${param.namespace}/${param.name}`;
    const current = this.leases.get(key);
    if (!current) {
      throw createK8sApiError(404, "not found");
    }
    return {
      metadata: {
        name: param.name,
        namespace: param.namespace
      },
      spec: {
        holderIdentity: current.holderIdentity,
        leaseDurationSeconds: current.leaseDurationSeconds,
        renewTime: current.renewTime
      }
    };
  }

  async createNamespacedLease(param: {
    namespace: string;
    body: {
      metadata?: { name?: string };
      spec?: { holderIdentity?: string; leaseDurationSeconds?: number; renewTime?: string };
    };
  }): Promise<{
    metadata: { name: string; namespace: string };
    spec: { holderIdentity: string; leaseDurationSeconds: number; renewTime: string };
  }> {
    if (this.throwOnCreate) {
      throw this.throwOnCreate;
    }
    const leaseName = param.body.metadata?.name;
    const holderIdentity = param.body.spec?.holderIdentity;
    const leaseDurationSeconds = param.body.spec?.leaseDurationSeconds;
    const renewTime = param.body.spec?.renewTime;
    if (!leaseName || !holderIdentity || !leaseDurationSeconds || !renewTime) {
      throw new Error("invalid lease create payload");
    }
    const key = `${param.namespace}/${leaseName}`;
    if (this.leases.has(key)) {
      throw createK8sApiError(409, "conflict");
    }
    this.leases.set(key, {
      holderIdentity,
      leaseDurationSeconds,
      renewTime
    });
    return {
      metadata: {
        name: leaseName,
        namespace: param.namespace
      },
      spec: {
        holderIdentity,
        leaseDurationSeconds,
        renewTime
      }
    };
  }

  async deleteNamespacedLease(param: { name: string; namespace: string }): Promise<unknown> {
    if (this.throwOnDelete) {
      throw this.throwOnDelete;
    }
    const key = `${param.namespace}/${param.name}`;
    if (!this.leases.has(key)) {
      throw createK8sApiError(404, "not found");
    }
    this.leases.delete(key);
    return {};
  }

  hasLease(namespace: string): boolean {
    return Array.from(this.leases.keys()).some((key) => key.startsWith(`${namespace}/`));
  }

  removeAllLeases(): void {
    this.leases.clear();
  }
}

describe("local memory distributed lock", () => {
  it("acquires, blocks contention, releases, and reacquires", async () => {
    const lock = new LocalMemoryLock();
    const acquired = await lock.tryAcquire({
      lockName: "policy.concurrency.slot.1",
      ownerId: "owner-1",
      leaseMs: 30_000
    });
    expect(acquired.acquired).toBe(true);
    if (!acquired.acquired) {
      throw new Error("expected lock acquisition to succeed");
    }

    const denied = await lock.tryAcquire({
      lockName: "policy.concurrency.slot.1",
      ownerId: "owner-2",
      leaseMs: 30_000
    });
    expect(denied.acquired).toBe(false);

    await lock.release({
      lockName: acquired.lockName,
      ownerId: acquired.ownerId,
      token: acquired.token
    });
    const reacquired = await lock.tryAcquire({
      lockName: "policy.concurrency.slot.1",
      ownerId: "owner-2",
      leaseMs: 30_000
    });
    expect(reacquired.acquired).toBe(true);
  });

  it("reclaims expired locks and ignores mismatched release ownership", async () => {
    const lock = new LocalMemoryLock();
    const acquired = await lock.tryAcquire({
      lockName: "policy.concurrency.slot.1",
      ownerId: "owner-1",
      leaseMs: 50
    });
    expect(acquired.acquired).toBe(true);
    if (!acquired.acquired) {
      throw new Error("expected lock acquisition to succeed");
    }

    await lock.release({
      lockName: acquired.lockName,
      ownerId: "owner-2",
      token: "wrong-token"
    });
    const denied = await lock.tryAcquire({
      lockName: "policy.concurrency.slot.1",
      ownerId: "owner-3",
      leaseMs: 30_000
    });
    expect(denied.acquired).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 60));
    const reacquired = await lock.tryAcquire({
      lockName: "policy.concurrency.slot.1",
      ownerId: "owner-2",
      leaseMs: 30_000
    });
    expect(reacquired.acquired).toBe(true);
  });
});

describe("redis distributed lock", () => {
  it("acquires, blocks contention, and releases with owner/token verification", async () => {
    const client = new FakeRedisClient();
    const lock = new RedisLockProvider({
      redisUrl: "redis://example.invalid:6379",
      client
    });
    const acquired = await lock.tryAcquire({
      lockName: "policy.concurrency.slot.1",
      ownerId: "owner-1",
      leaseMs: 30_000
    });
    expect(acquired.acquired).toBe(true);
    if (!acquired.acquired) {
      throw new Error("expected lock acquisition to succeed");
    }
    expect(client.hasActiveLock("athena:lock:policy.concurrency.slot.1")).toBe(true);

    const denied = await lock.tryAcquire({
      lockName: "policy.concurrency.slot.1",
      ownerId: "owner-2",
      leaseMs: 30_000
    });
    expect(denied.acquired).toBe(false);

    await lock.release({
      lockName: acquired.lockName,
      ownerId: "owner-2",
      token: acquired.token
    });
    expect(client.hasActiveLock("athena:lock:policy.concurrency.slot.1")).toBe(true);

    await lock.release({
      lockName: acquired.lockName,
      ownerId: acquired.ownerId,
      token: acquired.token
    });
    expect(client.hasActiveLock("athena:lock:policy.concurrency.slot.1")).toBe(false);
  });

  it("reclaims expired lock lease on next acquire", async () => {
    const client = new FakeRedisClient();
    const lock = new RedisLockProvider({
      redisUrl: "redis://example.invalid:6379",
      client
    });
    const acquired = await lock.tryAcquire({
      lockName: "policy.concurrency.slot.1",
      ownerId: "owner-1",
      leaseMs: 1
    });
    expect(acquired.acquired).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const reacquired = await lock.tryAcquire({
      lockName: "policy.concurrency.slot.1",
      ownerId: "owner-2",
      leaseMs: 30_000
    });
    expect(reacquired.acquired).toBe(true);
  });

  it("maps redis errors to SESSION_IO_ERROR for acquire and release", async () => {
    const acquireFailureClient = new FakeRedisClient();
    acquireFailureClient.throwOnSet = new Error("redis unavailable");
    const acquireLock = new RedisLockProvider({
      redisUrl: "redis://example.invalid:6379",
      client: acquireFailureClient
    });
    await expect(
      acquireLock.tryAcquire({
        lockName: "policy.concurrency.slot.1",
        ownerId: "owner-1",
        leaseMs: 30_000
      })
    ).rejects.toMatchObject({
      code: "SESSION_IO_ERROR"
    } satisfies Partial<AthenaError>);

    const releaseFailureClient = new FakeRedisClient();
    const releaseLock = new RedisLockProvider({
      redisUrl: "redis://example.invalid:6379",
      client: releaseFailureClient
    });
    const acquired = await releaseLock.tryAcquire({
      lockName: "policy.concurrency.slot.1",
      ownerId: "owner-1",
      leaseMs: 30_000
    });
    expect(acquired.acquired).toBe(true);
    if (!acquired.acquired) {
      throw new Error("expected lock acquisition to succeed");
    }
    releaseFailureClient.throwOnEval = new Error("redis unavailable");
    await expect(
      releaseLock.release({
        lockName: acquired.lockName,
        ownerId: acquired.ownerId,
        token: acquired.token
      })
    ).rejects.toMatchObject({
      code: "SESSION_IO_ERROR"
    } satisfies Partial<AthenaError>);
  });
});

describe("k8s lease distributed lock", () => {
  it("acquires, blocks contention, and releases with holderIdentity ownership checks", async () => {
    const client = new FakeK8sLeaseClient();
    const lock = new K8sLeaseLockProvider({
      namespace: "athena-system",
      leaseApiClient: client
    });
    const acquired = await lock.tryAcquire({
      lockName: "policy.concurrency.slot.1",
      ownerId: "owner-1",
      leaseMs: 30_000
    });
    expect(acquired.acquired).toBe(true);
    if (!acquired.acquired) {
      throw new Error("expected lock acquisition to succeed");
    }
    expect(client.hasLease("athena-system")).toBe(true);

    const denied = await lock.tryAcquire({
      lockName: "policy.concurrency.slot.1",
      ownerId: "owner-2",
      leaseMs: 30_000
    });
    expect(denied.acquired).toBe(false);

    await lock.release({
      lockName: acquired.lockName,
      ownerId: "owner-2",
      token: acquired.token
    });
    expect(client.hasLease("athena-system")).toBe(true);

    await lock.release({
      lockName: acquired.lockName,
      ownerId: acquired.ownerId,
      token: acquired.token
    });
    expect(client.hasLease("athena-system")).toBe(false);
  });

  it("reclaims expired lease locks on next acquire", async () => {
    const client = new FakeK8sLeaseClient();
    const lock = new K8sLeaseLockProvider({
      namespace: "athena-system",
      leaseApiClient: client
    });
    const acquired = await lock.tryAcquire({
      lockName: "policy.concurrency.slot.1",
      ownerId: "owner-1",
      leaseMs: 1_000
    });
    expect(acquired.acquired).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 1_100));

    const reacquired = await lock.tryAcquire({
      lockName: "policy.concurrency.slot.1",
      ownerId: "owner-2",
      leaseMs: 30_000
    });
    expect(reacquired.acquired).toBe(true);
  });

  it("maps k8s lease backend failures to SESSION_IO_ERROR", async () => {
    const acquireFailureClient = new FakeK8sLeaseClient();
    acquireFailureClient.throwOnCreate = createK8sApiError(500, "kube unavailable");
    const acquireLock = new K8sLeaseLockProvider({
      namespace: "athena-system",
      leaseApiClient: acquireFailureClient
    });
    await expect(
      acquireLock.tryAcquire({
        lockName: "policy.concurrency.slot.1",
        ownerId: "owner-1",
        leaseMs: 30_000
      })
    ).rejects.toMatchObject({
      code: "SESSION_IO_ERROR"
    } satisfies Partial<AthenaError>);

    const releaseFailureClient = new FakeK8sLeaseClient();
    const releaseLock = new K8sLeaseLockProvider({
      namespace: "athena-system",
      leaseApiClient: releaseFailureClient
    });
    const acquired = await releaseLock.tryAcquire({
      lockName: "policy.concurrency.slot.1",
      ownerId: "owner-1",
      leaseMs: 30_000
    });
    expect(acquired.acquired).toBe(true);
    if (!acquired.acquired) {
      throw new Error("expected lock acquisition to succeed");
    }
    releaseFailureClient.throwOnDelete = createK8sApiError(500, "kube unavailable");
    await expect(
      releaseLock.release({
        lockName: acquired.lockName,
        ownerId: acquired.ownerId,
        token: acquired.token
      })
    ).rejects.toMatchObject({
      code: "SESSION_IO_ERROR"
    } satisfies Partial<AthenaError>);
  });
});

describe("local file distributed lock", () => {
  it("acquires, blocks concurrent acquire, and releases", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-distributed-lock-"));
    try {
      const lock = new LocalFileDistributedLock(loadConfig(dir));
      const acquired = await lock.tryAcquire({
        lockName: "policy.concurrency.slot.1",
        ownerId: "owner-1",
        leaseMs: 30_000
      });
      expect(acquired.acquired).toBe(true);
      if (!acquired.acquired) {
        throw new Error("expected lock acquisition to succeed");
      }

      const denied = await lock.tryAcquire({
        lockName: "policy.concurrency.slot.1",
        ownerId: "owner-2",
        leaseMs: 30_000
      });
      expect(denied.acquired).toBe(false);

      await lock.release({
        lockName: acquired.lockName,
        ownerId: acquired.ownerId,
        token: acquired.token
      });

      const reacquired = await lock.tryAcquire({
        lockName: "policy.concurrency.slot.1",
        ownerId: "owner-2",
        leaseMs: 30_000
      });
      expect(reacquired.acquired).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reclaims expired locks", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-distributed-lock-expire-"));
    try {
      const lock = new LocalFileDistributedLock(loadConfig(dir));
      const acquired = await lock.tryAcquire({
        lockName: "policy.concurrency.slot.1",
        ownerId: "owner-1",
        leaseMs: 1
      });
      expect(acquired.acquired).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 5));

      const reacquired = await lock.tryAcquire({
        lockName: "policy.concurrency.slot.1",
        ownerId: "owner-2",
        leaseMs: 30_000
      });
      expect(reacquired.acquired).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
