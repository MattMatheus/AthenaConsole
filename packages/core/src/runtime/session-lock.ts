import { mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { AthenaError } from "./errors.js";

export interface SessionLockOptions {
  timeoutMs?: number;
  retryDelayMs?: number;
  staleAfterMs?: number;
}

export interface SessionLockHandle {
  release(): Promise<void>;
}

export async function acquireSessionLock(lockPath: string, options: SessionLockOptions = {}): Promise<SessionLockHandle> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retryDelayMs = options.retryDelayMs ?? 40;
  const staleAfterMs = options.staleAfterMs ?? 30_000;
  const deadline = Date.now() + timeoutMs;

  await mkdir(dirname(lockPath), { recursive: true });

  while (Date.now() <= deadline) {
    try {
      const fd = await open(lockPath, "wx");
      await fd.writeFile(`pid=${process.pid}\ncreatedAt=${new Date().toISOString()}\n`, "utf8");

      return {
        async release(): Promise<void> {
          await fd.close();
          await rm(lockPath, { force: true });
        }
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw new AthenaError("SESSION_IO_ERROR", `Failed to acquire lock: ${String(code)}`, true, error);
      }
      const reclaimed = await reclaimStaleLock(lockPath, staleAfterMs);
      if (reclaimed) {
        continue;
      }
    }
    await delay(retryDelayMs);
  }

  throw new AthenaError("SESSION_LOCK_TIMEOUT", `Timed out acquiring session lock at ${lockPath}`);
}

async function reclaimStaleLock(lockPath: string, staleAfterMs: number): Promise<boolean> {
  if (!Number.isFinite(staleAfterMs) || staleAfterMs <= 0) {
    return false;
  }

  let pid: number | undefined;
  let createdAtMs: number | undefined;
  try {
    const raw = await readFile(lockPath, "utf8");
    const parsed = parseLockMetadata(raw);
    pid = parsed.pid;
    createdAtMs = parsed.createdAtMs;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return false;
    }
    return false;
  }

  if (!pid || !createdAtMs) {
    return false;
  }

  if (Date.now() - createdAtMs < staleAfterMs) {
    return false;
  }

  if (isPidAlive(pid)) {
    return false;
  }

  try {
    await rm(lockPath);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return false;
    }
    return false;
  }
}

function parseLockMetadata(raw: string): { pid: number | undefined; createdAtMs: number | undefined } {
  let pid: number | undefined;
  let createdAtMs: number | undefined;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith("pid=")) {
      const parsed = Number.parseInt(trimmed.slice("pid=".length), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        pid = parsed;
      }
      continue;
    }
    if (trimmed.startsWith("createdAt=")) {
      const iso = trimmed.slice("createdAt=".length);
      const ms = Date.parse(iso);
      if (Number.isFinite(ms)) {
        createdAtMs = ms;
      }
    }
  }
  return { pid, createdAtMs };
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") {
      return false;
    }
    return true;
  }
}
