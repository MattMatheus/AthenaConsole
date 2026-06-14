import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { acquireSessionLock } from "../runtime/session-lock.js";
import { AthenaError } from "../runtime/errors.js";
import type { AthenaConfig } from "../shared/config.js";
import type { AthenaErrorCode, ScheduleRunLog, ScheduleStatus, ScheduleTargetType, ScheduledTask, ScheduledTasksStateFile } from "../shared/contracts.js";
import { assertValidSessionId } from "../runtime/session-store.js";

const SCHEDULE_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const SCHEDULE_TASK_SCHEMA_VERSION = 1;
const SCHEDULE_TASKS_FILE_SCHEMA_VERSION = 2;

export interface UpsertScheduleRequest {
  id: string;
  sessionId?: string;
  input?: string;
  everyMinutes?: number;
  enabled?: boolean;
  startNow?: boolean;
  name?: string;
  targetType?: ScheduleTargetType;
  targetId?: string;
  inputBindings?: unknown;
  runAt?: string;
  rrule?: string;
  timezone?: string;
  status?: ScheduleStatus;
  failurePolicy?: unknown;
}

export interface RunScheduleResult {
  id: string;
  sessionId: string;
  status: "ok" | "failed" | "already-running";
  startedAt: string;
  finishedAt: string;
  targetType?: ScheduleTargetType;
  targetId?: string;
  runId?: string;
  workflowDagRunId?: string;
  missionId?: string;
  taskIds?: string[];
  nextRunAt?: string;
  missedRunAt?: string;
  reason?: string;
  error?: string;
  errorCode?: AthenaErrorCode;
}

export type ScheduleRunHandler = (task: ScheduledTask, options?: { signal?: AbortSignal }) => Promise<void>;

export class ScheduleManager {
  private readonly scheduleRoot: string;
  private readonly tasksPath: string;
  private readonly logsDir: string;
  private readonly locksDir: string;
  private readonly runningIds = new Set<string>();

  constructor(private readonly config: AthenaConfig) {
    this.scheduleRoot = resolve(this.config.workspaceRoot, this.config.stateDir, "schedule");
    this.tasksPath = resolve(this.scheduleRoot, "tasks.json");
    this.logsDir = resolve(this.scheduleRoot, "logs");
    this.locksDir = resolve(this.scheduleRoot, "locks");
  }

  async listTasks(): Promise<ScheduledTask[]> {
    await this.ensureDirs();
    return this.loadTasks();
  }

  async removeTask(id: string): Promise<boolean> {
    assertValidScheduleId(id);
    return this.withGlobalLock(async () => {
      const tasks = await this.loadTasks();
      const index = tasks.findIndex((task) => task.id === id);
      if (index < 0) {
        return false;
      }
      tasks.splice(index, 1);
      await this.saveTasks(tasks);
      return true;
    });
  }

  async upsertTask(request: UpsertScheduleRequest): Promise<ScheduledTask> {
    assertValidScheduleId(request.id);
    const sessionId = request.sessionId;
    const input = request.input;
    if (!sessionId) {
      throw new Error("Schedule sessionId is required");
    }
    if (!input?.trim()) {
      throw new Error("Schedule input is required");
    }
    if (!Number.isFinite(request.everyMinutes) || (request.everyMinutes ?? 0) <= 0) {
      throw new Error("everyMinutes must be a positive integer");
    }
    assertValidSessionId(sessionId);

    const now = new Date().toISOString();
    const everyMinutes = Math.max(1, Math.floor(request.everyMinutes ?? 1));

    return this.withGlobalLock(async () => {
      const tasks = await this.loadTasks();
      const existing = tasks.find((task) => task.id === request.id);
      const nextRunAt = request.startNow ? now : addMinutes(now, everyMinutes);
      const enabled = request.enabled ?? existing?.enabled ?? true;

      const next: ScheduledTask = existing
        ? {
            ...existing,
            sessionId,
            input,
            everyMinutes,
            enabled,
            nextRunAt,
            updatedAt: now
          }
        : {
            schemaVersion: SCHEDULE_TASK_SCHEMA_VERSION,
            id: request.id,
            sessionId,
            input,
            everyMinutes,
            enabled,
            running: false,
            createdAt: now,
            updatedAt: now,
            nextRunAt
          };

      if (existing) {
        const index = tasks.findIndex((task) => task.id === request.id);
        tasks.splice(index, 1, next);
      } else {
        tasks.push(next);
      }

      await this.saveTasks(tasks);
      return next;
    });
  }

  async runTask(id: string, handler: ScheduleRunHandler): Promise<RunScheduleResult> {
    assertValidScheduleId(id);
    if (this.runningIds.has(id)) {
      const now = new Date().toISOString();
      const skipped: RunScheduleResult = {
        id,
        sessionId: "unknown",
        status: "already-running",
        startedAt: now,
        finishedAt: now
      };
      await this.appendRunLog({
        id: randomUUID(),
        scheduleId: id,
        sessionId: "unknown",
        startedAt: now,
        finishedAt: now,
        status: "already-running"
      });
      return skipped;
    }

    this.runningIds.add(id);
    const lock = await acquireSessionLock(this.resolveTaskLockPath(id), {
      timeoutMs: 15_000,
      retryDelayMs: 25
    });

    try {
      const start = new Date().toISOString();
      const maybeTask = await this.withGlobalLock(async () => {
        const tasks = await this.loadTasks();
        const task = tasks.find((row) => row.id === id);
        if (!task) {
          return undefined;
        }
        task.running = true;
        task.updatedAt = start;
        await this.saveTasks(tasks);
        return task;
      });

      if (!maybeTask) {
        throw new Error(`Schedule '${id}' not found`);
      }
      const task = maybeTask;

      try {
        const scheduleTimeoutMs = this.config.scheduleRunTimeoutMs;
        await this.runWithTimeout((signal) => handler(task, { signal }), scheduleTimeoutMs);
        const finish = new Date().toISOString();
        await this.withGlobalLock(async () => {
          const tasks = await this.loadTasks();
          const current = tasks.find((row) => row.id === id);
          if (current) {
            current.running = false;
            current.lastRunAt = finish;
            current.nextRunAt = addMinutes(finish, current.everyMinutes);
            current.updatedAt = finish;
            await this.saveTasks(tasks);
          }
        });
        await this.appendRunLog({
          id: randomUUID(),
          scheduleId: id,
          sessionId: task.sessionId,
          startedAt: start,
          finishedAt: finish,
          status: "ok"
        });
        return {
          id,
          sessionId: task.sessionId,
          status: "ok",
          startedAt: start,
          finishedAt: finish
        };
      } catch (error) {
        const finish = new Date().toISOString();
        const message = error instanceof Error ? error.message : String(error);
        const errorCode = asErrorCode(error);
        await this.withGlobalLock(async () => {
          const tasks = await this.loadTasks();
          const current = tasks.find((row) => row.id === id);
          if (current) {
            current.running = false;
            current.nextRunAt = addMinutes(finish, current.everyMinutes);
            current.updatedAt = finish;
            await this.saveTasks(tasks);
          }
        });
        await this.appendRunLog({
          id: randomUUID(),
          scheduleId: id,
          sessionId: task.sessionId,
          startedAt: start,
          finishedAt: finish,
          status: "failed",
          error: message,
          ...(errorCode ? { errorCode } : {})
        });
        return {
          id,
          sessionId: task.sessionId,
          status: "failed",
          startedAt: start,
          finishedAt: finish,
          error: message,
          ...(errorCode ? { errorCode } : {})
        };
      }
    } finally {
      this.runningIds.delete(id);
      await lock.release();
    }
  }

  async runDue(at: Date, handler: ScheduleRunHandler): Promise<{ run: RunScheduleResult[]; skipped: number }> {
    const now = at.toISOString();
    const tasks = await this.listTasks();
    const due = tasks.filter((task) => task.enabled && task.nextRunAt <= now);
    const run: RunScheduleResult[] = [];

    for (const task of due) {
      run.push(await this.runTask(task.id, handler));
    }

    return {
      run,
      skipped: tasks.length - due.length
    };
  }

  async readLogs(id: string, limit = 20): Promise<ScheduleRunLog[]> {
    assertValidScheduleId(id);
    const path = this.resolveLogPath(id);
    if (!existsSync(path)) {
      return [];
    }

    const raw = await readFile(path, "utf8");
    const rows = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ScheduleRunLog);

    const bounded = Math.max(1, Math.floor(limit));
    return rows.slice(-bounded).reverse();
  }

  private async appendRunLog(log: ScheduleRunLog): Promise<void> {
    await this.ensureDirs();
    const path = this.resolveLogPath(log.scheduleId);
    await appendFile(path, `${JSON.stringify(log)}\n`, "utf8");
  }

  private resolveGlobalLockPath(): string {
    return resolve(this.locksDir, "schedule-global.lock");
  }

  private resolveTaskLockPath(id: string): string {
    return resolve(this.locksDir, `${id}.lock`);
  }

  private resolveLogPath(id: string): string {
    return resolve(this.logsDir, `${id}.jsonl`);
  }

  private async withGlobalLock<T>(operation: () => Promise<T>): Promise<T> {
    await this.ensureDirs();
    const lock = await acquireSessionLock(this.resolveGlobalLockPath(), {
      timeoutMs: 15_000,
      retryDelayMs: 25
    });
    try {
      return await operation();
    } finally {
      await lock.release();
    }
  }

  private async ensureDirs(): Promise<void> {
    await mkdir(this.scheduleRoot, { recursive: true });
    await mkdir(this.logsDir, { recursive: true });
    await mkdir(this.locksDir, { recursive: true });
  }

  private async loadTasks(): Promise<ScheduledTask[]> {
    if (!existsSync(this.tasksPath)) {
      return [];
    }
    const raw = await readFile(this.tasksPath, "utf8");
    const parsed = JSON.parse(raw) as ScheduledTask[] | ScheduledTasksStateFile;
    if (Array.isArray(parsed)) {
      return parsed.map(migrateScheduledTask);
    }
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.tasks)) {
      return parsed.tasks.map(migrateScheduledTask);
    }
    return [];
  }

  private async saveTasks(tasks: ScheduledTask[]): Promise<void> {
    await this.ensureDirs();
    const tmpPath = `${this.tasksPath}.${process.pid}.tmp`;
    const normalized = tasks.map(migrateScheduledTask);
    const payload: ScheduledTasksStateFile = {
      schemaVersion: SCHEDULE_TASKS_FILE_SCHEMA_VERSION,
      tasks: normalized
    };
    await writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await mkdir(dirname(this.tasksPath), { recursive: true });
    await rename(tmpPath, this.tasksPath);
    await rm(tmpPath, { force: true });
  }

  private async runWithTimeout(operation: (signal: AbortSignal) => Promise<void>, timeoutMs: number): Promise<void> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      await operation(new AbortController().signal);
      return;
    }

    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        reject(new AthenaError("SCHEDULE_TIMEOUT", `Schedule run timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      await Promise.race([operation(controller.signal), timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}

export function assertValidScheduleId(scheduleId: string): void {
  if (!SCHEDULE_ID_PATTERN.test(scheduleId)) {
    throw new Error(`Invalid schedule id '${scheduleId}'. Allowed pattern: ${SCHEDULE_ID_PATTERN.source}`);
  }
}

function addMinutes(iso: string, minutes: number): string {
  const date = new Date(iso);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString();
}

function migrateScheduledTask(task: ScheduledTask): ScheduledTask {
  return {
    ...task,
    schemaVersion: SCHEDULE_TASK_SCHEMA_VERSION
  };
}

function asErrorCode(error: unknown): AthenaErrorCode | undefined {
  if (error instanceof AthenaError) {
    return error.code;
  }
  return undefined;
}
