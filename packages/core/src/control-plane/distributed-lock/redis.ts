import { randomUUID } from "node:crypto";
import { trackOperationEvent } from "../../observability/application-insights.js";
import { AthenaError } from "../../runtime/errors.js";
import type {
  DistributedLockAcquireRequest,
  DistributedLockAcquireResult,
  DistributedLockReleaseRequest,
  IDistributedLock
} from "./types.js";

interface RedisLockClient {
  set(
    key: string,
    value: string,
    mode: "PX",
    leaseMs: number,
    onlyIfMissing: "NX"
  ): Promise<"OK" | null>;
  eval(script: string, numKeys: number, ...args: string[]): Promise<number>;
}

interface RedisLockProviderOptions {
  redisUrl: string;
  keyPrefix?: string;
  client?: RedisLockClient;
}

const REDIS_LOCK_KEY_PREFIX = "athena:lock:";
const REDIS_COMPARE_AND_DELETE_SCRIPT =
  'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end';

export class RedisLockProvider implements IDistributedLock {
  private readonly redisUrl: string;
  private readonly keyPrefix: string;
  private redisClient: RedisLockClient | undefined;

  constructor(options: RedisLockProviderOptions) {
    const redisUrl = options.redisUrl.trim();
    if (redisUrl.length === 0) {
      throw new AthenaError("CONFIG_ERROR", "ATHENA_REDIS_URL is required when distributed lock provider is redis.");
    }
    this.redisUrl = redisUrl;
    this.keyPrefix = options.keyPrefix ?? REDIS_LOCK_KEY_PREFIX;
    this.redisClient = options.client;
  }

  async tryAcquire(request: DistributedLockAcquireRequest): Promise<DistributedLockAcquireResult> {
    if (!Number.isInteger(request.leaseMs) || request.leaseMs <= 0) {
      throw new AthenaError("CONFIG_ERROR", "Distributed lock leaseMs must be a positive integer.");
    }
    const nowMs = Date.now();
    const startedAt = nowMs;
    const token = randomUUID();
    const key = this.resolveLockKey(request.lockName);
    const value = this.serializeOwnerToken(request.ownerId, token);
    const client = await this.getRedisClient();
    try {
      const result = await client.set(key, value, "PX", request.leaseMs, "NX");
      if (result !== "OK") {
        trackOperationEvent(
          "athena.redis.lock.acquire",
          {
            lockName: request.lockName,
            acquired: "false"
          },
          {
            latencyMs: Date.now() - startedAt
          }
        );
        return { acquired: false };
      }
    } catch (error) {
      throw new AthenaError(
        "SESSION_IO_ERROR",
        `Failed to acquire distributed lock via Redis for ${request.lockName}.`,
        true,
        error
      );
    }
    trackOperationEvent(
      "athena.redis.lock.acquire",
      {
        lockName: request.lockName,
        acquired: "true"
      },
      {
        latencyMs: Date.now() - startedAt
      }
    );
    return {
      acquired: true,
      lockName: request.lockName,
      ownerId: request.ownerId,
      token,
      acquiredAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(nowMs + request.leaseMs).toISOString()
    };
  }

  async release(request: DistributedLockReleaseRequest): Promise<void> {
    const key = this.resolveLockKey(request.lockName);
    const value = this.serializeOwnerToken(request.ownerId, request.token);
    const client = await this.getRedisClient();
    try {
      await client.eval(REDIS_COMPARE_AND_DELETE_SCRIPT, 1, key, value);
    } catch (error) {
      throw new AthenaError(
        "SESSION_IO_ERROR",
        `Failed to release distributed lock via Redis for ${request.lockName}.`,
        true,
        error
      );
    }
  }

  private resolveLockKey(lockName: string): string {
    return `${this.keyPrefix}${lockName}`;
  }

  private serializeOwnerToken(ownerId: string, token: string): string {
    return JSON.stringify({
      ownerId,
      token
    });
  }

  private async getRedisClient(): Promise<RedisLockClient> {
    if (this.redisClient) {
      return this.redisClient;
    }
    this.redisClient = await this.createRedisClient(this.redisUrl);
    return this.redisClient;
  }

  private async createRedisClient(redisUrl: string): Promise<RedisLockClient> {
    let moduleNamespace: unknown;
    try {
      moduleNamespace = await import("ioredis");
    } catch (error) {
      throw new AthenaError(
        "CONFIG_ERROR",
        "ATHENA_DISTRIBUTED_LOCK_PROVIDER=redis requires the ioredis package to be installed.",
        true,
        error
      );
    }
    const constructorCandidate =
      typeof moduleNamespace === "object" && moduleNamespace && "default" in moduleNamespace
        ? (moduleNamespace as { default: unknown }).default
        : moduleNamespace;
    if (typeof constructorCandidate !== "function") {
      throw new AthenaError(
        "CONFIG_ERROR",
        "Failed to initialize ioredis client for distributed lock provider."
      );
    }
    const RedisClient = constructorCandidate as new (url: string, options: Record<string, unknown>) => RedisLockClient;
    return new RedisClient(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1
    });
  }
}
