import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { acquireSessionLock } from "../runtime/session-lock.js";
import type { AthenaConfig } from "../shared/config.js";
import type { WorkDedupeMode, WorkDropPolicy, WorkItem, WorkQueueState } from "../shared/contracts.js";
import { assertValidSessionId } from "../runtime/session-store.js";
const WORK_QUEUE_SCHEMA_VERSION = 1;

export interface EnqueueWorkRequest {
  sessionId: string;
  payload: string;
  mode: WorkItem["mode"];
  dedupeKey?: string;
  dedupeMode?: WorkDedupeMode;
  dropPolicy?: WorkDropPolicy;
}

export interface DrainBatch {
  sessionId: string;
  mode: WorkItem["mode"];
  payload: string;
  sourceItems: WorkItem[];
}

export interface DrainResult {
  drainedItems: number;
  status: "ok" | "already-draining";
  queueDepthBefore: number;
  queueDepthAfter: number;
}

export type DrainHandler = (batch: DrainBatch) => Promise<void>;

export class WorkManager {
  private readonly queuesDir: string;
  private readonly locksDir: string;
  private readonly drainingSessions = new Set<string>();

  constructor(private readonly config: AthenaConfig) {
    this.queuesDir = resolve(this.config.workspaceRoot, this.config.stateDir, "work", "queues");
    this.locksDir = resolve(this.config.workspaceRoot, this.config.stateDir, "work", "locks");
  }

  async loadQueue(sessionId: string): Promise<WorkQueueState> {
    assertValidSessionId(sessionId);
    await this.ensureDirs();

    return this.loadQueueUnlocked(sessionId);
  }

  async enqueue(request: EnqueueWorkRequest): Promise<WorkQueueState> {
    assertValidSessionId(request.sessionId);
    return this.withSessionLock(request.sessionId, async () => {
      const queue = await this.loadQueueUnlocked(request.sessionId);
      const dedupeMode = request.dedupeMode ?? "payload";
      const dropPolicy = request.dropPolicy ?? "keep-old";

      const item: WorkItem = {
        id: randomUUID(),
        sessionId: request.sessionId,
        payload: request.payload,
        mode: request.mode,
        ...(request.dedupeKey ? { dedupeKey: request.dedupeKey } : {}),
        createdAt: new Date().toISOString()
      };

      const matchIndex = queue.items.findIndex((existing) => {
        if (dedupeMode === "none") {
          return false;
        }
        if (dedupeMode === "dedupe-key") {
          return Boolean(item.dedupeKey && existing.dedupeKey === item.dedupeKey);
        }
        return existing.payload === item.payload && existing.mode === item.mode;
      });

      if (matchIndex >= 0) {
        if (dropPolicy === "keep-old") {
          return queue;
        }
        queue.items.splice(matchIndex, 1, item);
      } else {
        queue.items.push(item);
      }

      queue.updatedAt = new Date().toISOString();
      await this.saveQueue(queue);
      return queue;
    });
  }

  async drain(sessionId: string, handler: DrainHandler): Promise<DrainResult> {
    assertValidSessionId(sessionId);
    if (this.drainingSessions.has(sessionId)) {
      const queue = await this.loadQueue(sessionId);
      return {
        status: "already-draining",
        drainedItems: 0,
        queueDepthBefore: queue.items.length,
        queueDepthAfter: queue.items.length
      };
    }

    this.drainingSessions.add(sessionId);
    let drainedItems = 0;

    try {
      return await this.withSessionLock(sessionId, async () => {
        let drainError: unknown;
        let queueDepthBefore = 0;
        try {
          let queue = await this.loadQueueUnlocked(sessionId);
          queueDepthBefore = queue.items.length;
          queue.draining = true;
          queue.updatedAt = new Date().toISOString();
          await this.saveQueue(queue);

          while (queue.items.length > 0) {
            const next = this.buildNextBatch(queue);
            await handler(next);

            const removed = new Set(next.sourceItems.map((item) => item.id));
            queue.items = queue.items.filter((item) => !removed.has(item.id));
            drainedItems += next.sourceItems.length;
            queue.updatedAt = new Date().toISOString();
            await this.saveQueue(queue);
          }

          return {
            status: "ok",
            drainedItems,
            queueDepthBefore,
            queueDepthAfter: queue.items.length
          };
        } catch (error) {
          drainError = error;
          throw error;
        } finally {
          try {
            const queue = await this.loadQueueUnlocked(sessionId);
            if (queue.draining) {
              queue.draining = false;
              queue.updatedAt = new Date().toISOString();
              await this.saveQueue(queue);
            }
          } catch (cleanupError) {
            if (!drainError) {
              throw cleanupError;
            }
          }
        }
      });
    } finally {
      this.drainingSessions.delete(sessionId);
    }
  }

  private buildNextBatch(queue: WorkQueueState): DrainBatch {
    const first = queue.items[0];
    if (!first) {
      throw new Error("Cannot build drain batch for empty queue");
    }

    if (first.mode === "followup") {
      return {
        sessionId: queue.sessionId,
        mode: "followup",
        payload: first.payload,
        sourceItems: [first]
      };
    }

    const collectItems: WorkItem[] = [];
    for (const item of queue.items) {
      if (item.mode !== "collect") {
        break;
      }
      collectItems.push(item);
    }

    return {
      sessionId: queue.sessionId,
      mode: "collect",
      payload: collectItems.map((item) => item.payload).join("\n\n"),
      sourceItems: collectItems
    };
  }

  private async ensureDirs(): Promise<void> {
    await mkdir(this.queuesDir, { recursive: true });
    await mkdir(this.locksDir, { recursive: true });
  }

  private resolveQueuePath(sessionId: string): string {
    return resolve(this.queuesDir, `${sessionId}.json`);
  }

  private resolveLockPath(sessionId: string): string {
    return resolve(this.locksDir, `${sessionId}.lock`);
  }

  private async withSessionLock<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
    await this.ensureDirs();
    const lock = await acquireSessionLock(this.resolveLockPath(sessionId), {
      timeoutMs: 15_000,
      retryDelayMs: 25
    });
    try {
      return await operation();
    } finally {
      await lock.release();
    }
  }

  private async loadQueueUnlocked(sessionId: string): Promise<WorkQueueState> {
    const queuePath = this.resolveQueuePath(sessionId);
    if (!existsSync(queuePath)) {
      return createEmptyQueue(sessionId);
    }

    const raw = await readFile(queuePath, "utf8");
    const parsed = JSON.parse(raw) as WorkQueueState;
    return migrateQueue({
      ...parsed,
      sessionId,
      items: parsed.items ?? []
    });
  }

  private async saveQueue(queue: WorkQueueState): Promise<void> {
    await this.ensureDirs();
    const queuePath = this.resolveQueuePath(queue.sessionId);
    const tmpPath = `${queuePath}.${process.pid}.tmp`;

    await writeFile(tmpPath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
    await mkdir(dirname(queuePath), { recursive: true });
    await rename(tmpPath, queuePath);
    await rm(tmpPath, { force: true });
  }
}

export function createEmptyQueue(sessionId: string): WorkQueueState {
  return {
    schemaVersion: WORK_QUEUE_SCHEMA_VERSION,
    sessionId,
    items: [],
    draining: false,
    updatedAt: new Date().toISOString()
  };
}

function migrateQueue(queue: WorkQueueState): WorkQueueState {
  return {
    ...queue,
    schemaVersion: WORK_QUEUE_SCHEMA_VERSION
  };
}
