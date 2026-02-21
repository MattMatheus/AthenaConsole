import { existsSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { AthenaConfig } from "../shared/config.js";
import type {
  ActiveRunQueryResult,
  ActiveRunRecord,
  CancellationRequestQueryResult,
  CancellationRequestRecord,
  RunControlQuery
} from "../shared/contracts.js";
import { AthenaError } from "./errors.js";
import { assertValidSessionId } from "./session-store.js";

const POLL_INTERVAL_MS = 200;
const RUN_CONTROL_LIMIT_DEFAULT = 100;
const RUN_CONTROL_LIMIT_MAX = 500;

interface PersistedActiveRunRecord {
  schemaVersion: 1;
  sessionId: string;
  pid: number;
  startedAt: string;
  runId?: string;
  traceId?: string;
}

interface PersistedCancellationRequestRecord {
  schemaVersion: 1;
  sessionId: string;
  requestedAt: string;
  reason?: string;
  runId?: string;
  traceId?: string;
  startedAt?: string;
}

function assertPathWithin(baseDir: string, candidate: string): void {
  const rel = relative(baseDir, candidate);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new AthenaError("SESSION_IO_ERROR", `Resolved path escapes state directory: ${candidate}`);
  }
}

async function atomicWriteFile(path: string, payload: string): Promise<void> {
  const tmpPath = `${path}.${process.pid}.tmp`;
  await writeFile(tmpPath, payload, "utf8");
  await rename(tmpPath, path);
  await rm(tmpPath, { force: true });
}

export class RuntimeCancellationStore {
  private readonly stateRoot: string;
  private readonly runtimeDir: string;
  private readonly activeDir: string;
  private readonly cancelDir: string;

  constructor(config: AthenaConfig) {
    this.stateRoot = resolve(config.workspaceRoot, config.stateDir);
    this.runtimeDir = resolve(this.stateRoot, "runtime");
    this.activeDir = resolve(this.runtimeDir, "active");
    this.cancelDir = resolve(this.runtimeDir, "cancel");
    assertPathWithin(this.stateRoot, this.runtimeDir);
    assertPathWithin(this.stateRoot, this.activeDir);
    assertPathWithin(this.stateRoot, this.cancelDir);
  }

  async ensureDirectories(): Promise<void> {
    await mkdir(this.activeDir, { recursive: true });
    await mkdir(this.cancelDir, { recursive: true });
  }

  private resolveActivePath(sessionId: string): string {
    assertValidSessionId(sessionId);
    const candidate = resolve(this.activeDir, `${sessionId}.json`);
    assertPathWithin(this.activeDir, candidate);
    return candidate;
  }

  private resolveCancelPath(sessionId: string): string {
    assertValidSessionId(sessionId);
    const candidate = resolve(this.cancelDir, `${sessionId}.json`);
    assertPathWithin(this.cancelDir, candidate);
    return candidate;
  }

  async markRunActive(
    sessionId: string,
    options: {
      runId?: string;
      traceId?: string;
    } = {}
  ): Promise<void> {
    const payload: PersistedActiveRunRecord = {
      schemaVersion: 1,
      sessionId,
      pid: process.pid,
      startedAt: new Date().toISOString(),
      runId: options.runId ?? randomUUID(),
      traceId: options.traceId ?? randomUUID()
    };
    await this.ensureDirectories();
    await atomicWriteFile(this.resolveActivePath(sessionId), `${JSON.stringify(payload, null, 2)}\n`);
  }

  async clearRunActive(sessionId: string): Promise<void> {
    await rm(this.resolveActivePath(sessionId), { force: true });
  }

  async clearCancellationRequest(sessionId: string): Promise<void> {
    await rm(this.resolveCancelPath(sessionId), { force: true });
  }

  async requestCancellation(sessionId: string, reason?: string): Promise<{ status: "cancelled" | "not-running" }> {
    await this.ensureDirectories();
    const activePath = this.resolveActivePath(sessionId);
    if (!existsSync(activePath)) {
      return { status: "not-running" };
    }
    const active = await this.readActiveRunRecord(activePath);

    const payload: PersistedCancellationRequestRecord = {
      schemaVersion: 1,
      sessionId,
      requestedAt: new Date().toISOString(),
      runId: active?.runId ?? randomUUID(),
      ...(reason ? { reason } : {}),
      ...(active?.traceId ? { traceId: active.traceId } : {}),
      ...(active?.startedAt ? { startedAt: active.startedAt } : {})
    };
    await atomicWriteFile(this.resolveCancelPath(sessionId), `${JSON.stringify(payload, null, 2)}\n`);
    return { status: "cancelled" };
  }

  async requestCancellationByRunId(
    runId: string,
    reason?: string
  ): Promise<{ status: "cancelled" | "not-running"; sessionId?: string }> {
    await this.ensureDirectories();
    const activeRows = await this.readRecordsFromDir(this.activeDir, (row) => this.parseActiveRunRow(row));
    const activeMatch = activeRows.find((row) => row.runId === runId);
    if (activeMatch) {
      const cancelPath = this.resolveCancelPath(activeMatch.sessionId);
      const hadExistingCancelRequest = existsSync(cancelPath);
      const result = await this.requestCancellation(activeMatch.sessionId, reason);
      // Legacy active rows can become orphaned; if cancellation was already requested,
      // treat this as stale state and clear the active marker.
      if (hadExistingCancelRequest && result.status === "cancelled") {
        await this.clearRunActive(activeMatch.sessionId);
      }
      return {
        status: result.status,
        sessionId: activeMatch.sessionId
      };
    }

    const cancelRows = await this.readRecordsFromDir(this.cancelDir, (row) => this.parseCancellationRequestRow(row));
    const cancelMatch = cancelRows.find((row) => row.runId === runId);
    return {
      status: "not-running",
      ...(cancelMatch ? { sessionId: cancelMatch.sessionId } : {})
    };
  }

  watchForCancellation(sessionId: string, controller: AbortController): { stop: () => void; done: Promise<string | undefined> } {
    const cancelPath = this.resolveCancelPath(sessionId);
    let stopped = false;
    let timer: NodeJS.Timeout | undefined;
    let resolved = false;

    const done = new Promise<string | undefined>((resolveDone) => {
      const check = async () => {
        if (stopped || resolved) {
          return;
        }
        if (!existsSync(cancelPath)) {
          timer = setTimeout(check, POLL_INTERVAL_MS);
          return;
        }

        let reason: string | undefined;
        try {
          const raw = await readFile(cancelPath, "utf8");
          const parsed = JSON.parse(raw) as PersistedCancellationRequestRecord;
          if (typeof parsed.reason === "string" && parsed.reason.trim().length > 0) {
            reason = parsed.reason.trim();
          }
        } catch {
          reason = undefined;
        }
        await this.clearCancellationRequest(sessionId);
        controller.abort();
        resolved = true;
        resolveDone(reason);
      };
      timer = setTimeout(check, POLL_INTERVAL_MS);
    });

    return {
      stop: () => {
        stopped = true;
        if (timer) {
          clearTimeout(timer);
        }
      },
      done
    };
  }

  async listActiveRuns(query: RunControlQuery = {}): Promise<ActiveRunQueryResult> {
    if (query.sessionId) {
      assertValidSessionId(query.sessionId);
    }
    await this.ensureDirectories();
    const rows = await this.readRecordsFromDir(this.activeDir, (row) => this.parseActiveRunRow(row));
    const filtered = rows.filter((row) => {
      if (query.sessionId && row.sessionId !== query.sessionId) {
        return false;
      }
      if (query.runId && row.runId !== query.runId) {
        return false;
      }
      return true;
    });
    filtered.sort(compareActiveRunsDesc);
    return pageActiveRunRows(filtered, query);
  }

  async listCancellationRequests(query: RunControlQuery = {}): Promise<CancellationRequestQueryResult> {
    if (query.sessionId) {
      assertValidSessionId(query.sessionId);
    }
    await this.ensureDirectories();
    const rows = await this.readRecordsFromDir(this.cancelDir, (row) => this.parseCancellationRequestRow(row));
    const filtered = rows.filter((row) => {
      if (query.sessionId && row.sessionId !== query.sessionId) {
        return false;
      }
      if (query.runId && row.runId !== query.runId) {
        return false;
      }
      return true;
    });
    filtered.sort(compareCancellationRequestsDesc);
    return pageCancellationRequestRows(filtered, query);
  }

  private async readRecordsFromDir<T>(dir: string, parser: (row: unknown) => T | undefined): Promise<T[]> {
    const names = await readdir(dir);
    const rows: T[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) {
        continue;
      }
      const path = resolve(dir, name);
      try {
        const raw = await readFile(path, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        const normalized = parser(parsed);
        if (normalized) {
          rows.push(normalized);
        }
      } catch {
        // Ignore malformed rows so control surfaces remain readable.
      }
    }
    return rows;
  }

  private parseActiveRunRow(row: unknown): ActiveRunRecord | undefined {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return undefined;
    }
    const parsed = row as Record<string, unknown>;
    if (
      typeof parsed.sessionId !== "string" ||
      typeof parsed.pid !== "number" ||
      !Number.isInteger(parsed.pid) ||
      parsed.pid <= 0 ||
      typeof parsed.startedAt !== "string"
    ) {
      return undefined;
    }
    return {
      sessionId: parsed.sessionId,
      pid: parsed.pid,
      startedAt: parsed.startedAt,
      runId:
        typeof parsed.runId === "string" && parsed.runId.trim().length > 0
          ? parsed.runId
          : deriveLegacyRunId({
              sessionId: parsed.sessionId,
              startedAt: parsed.startedAt
            }),
      ...(typeof parsed.traceId === "string" && parsed.traceId.trim().length > 0 ? { traceId: parsed.traceId } : {})
    };
  }

  private parseCancellationRequestRow(row: unknown): CancellationRequestRecord | undefined {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return undefined;
    }
    const parsed = row as Record<string, unknown>;
    if (typeof parsed.sessionId !== "string" || typeof parsed.requestedAt !== "string") {
      return undefined;
    }
    return {
      sessionId: parsed.sessionId,
      requestedAt: parsed.requestedAt,
      runId:
        typeof parsed.runId === "string" && parsed.runId.trim().length > 0
          ? parsed.runId
          : typeof parsed.startedAt === "string" && parsed.startedAt.trim().length > 0
            ? deriveLegacyRunId({
                sessionId: parsed.sessionId,
                startedAt: parsed.startedAt
              })
            : deriveLegacyRunId({
                sessionId: parsed.sessionId,
                requestedAt: parsed.requestedAt
              }),
      ...(typeof parsed.reason === "string" && parsed.reason.trim().length > 0 ? { reason: parsed.reason } : {}),
      ...(typeof parsed.traceId === "string" && parsed.traceId.trim().length > 0 ? { traceId: parsed.traceId } : {}),
      ...(typeof parsed.startedAt === "string" && parsed.startedAt.trim().length > 0
        ? { startedAt: parsed.startedAt }
        : {})
    };
  }

  private async readActiveRunRecord(path: string): Promise<ActiveRunRecord | undefined> {
    try {
      const raw = await readFile(path, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return this.parseActiveRunRow(parsed);
    } catch {
      return undefined;
    }
  }
}

function pageRowsByOffset<T>(rows: T[], query: RunControlQuery): { items: T[]; nextCursor?: string } {
  const limit = clampLimit(query.limit ?? RUN_CONTROL_LIMIT_DEFAULT, 1, RUN_CONTROL_LIMIT_MAX);
  const offset = decodeOffsetCursor(query.cursor);
  const items = rows.slice(offset, offset + limit);
  const next = offset + items.length;
  return {
    items,
    ...(next < rows.length ? { nextCursor: encodeOffsetCursor(next) } : {})
  };
}

function pageActiveRunRows(rows: ActiveRunRecord[], query: RunControlQuery): ActiveRunQueryResult {
  const decoded = decodeRunControlCursor(query.cursor);
  if (query.cursor && (!decoded || decoded.kind === "offset")) {
    return pageRowsByOffset(rows, query);
  }
  const limit = clampLimit(query.limit ?? RUN_CONTROL_LIMIT_DEFAULT, 1, RUN_CONTROL_LIMIT_MAX);
  const remaining =
    decoded && decoded.kind === "active"
      ? (() => {
          const startIndex = rows.findIndex((row) => compareActiveRunToCursor(row, decoded) > 0);
          if (startIndex < 0) {
            return [];
          }
          return rows.slice(startIndex);
        })()
      : rows;
  const items = remaining.slice(0, limit);
  return {
    items,
    ...(remaining.length > items.length ? { nextCursor: encodeActiveRunCursor(items[items.length - 1]!) } : {})
  };
}

function pageCancellationRequestRows(
  rows: CancellationRequestRecord[],
  query: RunControlQuery
): CancellationRequestQueryResult {
  const decoded = decodeRunControlCursor(query.cursor);
  if (query.cursor && (!decoded || decoded.kind === "offset")) {
    return pageRowsByOffset(rows, query);
  }
  const limit = clampLimit(query.limit ?? RUN_CONTROL_LIMIT_DEFAULT, 1, RUN_CONTROL_LIMIT_MAX);
  const remaining =
    decoded && decoded.kind === "cancel"
      ? (() => {
          const startIndex = rows.findIndex((row) => compareCancellationRequestToCursor(row, decoded) > 0);
          if (startIndex < 0) {
            return [];
          }
          return rows.slice(startIndex);
        })()
      : rows;
  const items = remaining.slice(0, limit);
  return {
    items,
    ...(remaining.length > items.length ? { nextCursor: encodeCancellationRequestCursor(items[items.length - 1]!) } : {})
  };
}

interface DecodedOffsetCursor {
  kind: "offset";
  offset: number;
}

interface DecodedActiveRunCursor {
  kind: "active";
  startedAt: string;
  sessionId: string;
  runId: string;
  pid: number;
}

interface DecodedCancellationRequestCursor {
  kind: "cancel";
  requestedAt: string;
  sessionId: string;
  runId: string;
}

type DecodedRunControlCursor = DecodedOffsetCursor | DecodedActiveRunCursor | DecodedCancellationRequestCursor;

function decodeRunControlCursor(cursor: string | undefined): DecodedRunControlCursor | undefined {
  if (!cursor) {
    return undefined;
  }
  const offset = decodeOffsetCursor(cursor);
  if (offset > 0 || decodeOffsetCursorRaw(cursor) === 0) {
    return {
      kind: "offset",
      offset
    };
  }
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    if (parsed.kind === "active") {
      if (
        typeof parsed.startedAt === "string" &&
        typeof parsed.sessionId === "string" &&
        typeof parsed.pid === "number" &&
        Number.isInteger(parsed.pid) &&
        parsed.pid > 0
      ) {
        return {
          kind: "active",
          startedAt: parsed.startedAt,
          sessionId: parsed.sessionId,
          pid: parsed.pid,
          runId: typeof parsed.runId === "string" && parsed.runId.length > 0 ? parsed.runId : ""
        };
      }
    }
    if (parsed.kind === "cancel") {
      if (typeof parsed.requestedAt === "string" && typeof parsed.sessionId === "string") {
        return {
          kind: "cancel",
          requestedAt: parsed.requestedAt,
          sessionId: parsed.sessionId,
          runId: typeof parsed.runId === "string" && parsed.runId.length > 0 ? parsed.runId : ""
        };
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function decodeOffsetCursorRaw(cursor: string): number | undefined {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = Number.parseInt(decoded, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function compareActiveRunsDesc(left: ActiveRunRecord, right: ActiveRunRecord): number {
  return (
    compareStringsDesc(left.startedAt, right.startedAt) ||
    compareStringsDesc(left.sessionId, right.sessionId) ||
    compareStringsDesc(left.runId, right.runId) ||
    right.pid - left.pid
  );
}

function compareCancellationRequestsDesc(left: CancellationRequestRecord, right: CancellationRequestRecord): number {
  return (
    compareStringsDesc(left.requestedAt, right.requestedAt) ||
    compareStringsDesc(left.sessionId, right.sessionId) ||
    compareStringsDesc(left.runId, right.runId)
  );
}

function compareActiveRunToCursor(row: ActiveRunRecord, cursor: DecodedRunControlCursor): number {
  if (cursor.kind !== "active") {
    return -1;
  }
  return (
    compareStringsDesc(row.startedAt, cursor.startedAt) ||
    compareStringsDesc(row.sessionId, cursor.sessionId) ||
    compareStringsDesc(row.runId, cursor.runId) ||
    cursor.pid - row.pid
  );
}

function compareCancellationRequestToCursor(row: CancellationRequestRecord, cursor: DecodedRunControlCursor): number {
  if (cursor.kind !== "cancel") {
    return -1;
  }
  return (
    compareStringsDesc(row.requestedAt, cursor.requestedAt) ||
    compareStringsDesc(row.sessionId, cursor.sessionId) ||
    compareStringsDesc(row.runId, cursor.runId)
  );
}

function compareStringsDesc(left: string, right: string): number {
  return right.localeCompare(left);
}

function encodeActiveRunCursor(row: ActiveRunRecord): string {
  return Buffer.from(
    JSON.stringify({
      kind: "active",
      startedAt: row.startedAt,
      sessionId: row.sessionId,
      runId: row.runId,
      pid: row.pid
    }),
    "utf8"
  ).toString("base64url");
}

function encodeCancellationRequestCursor(row: CancellationRequestRecord): string {
  return Buffer.from(
    JSON.stringify({
      kind: "cancel",
      requestedAt: row.requestedAt,
      sessionId: row.sessionId,
      runId: row.runId
    }),
    "utf8"
  ).toString("base64url");
}

function deriveLegacyRunId(input: { sessionId: string; startedAt?: string; requestedAt?: string }): string {
  const parts = [input.sessionId, input.startedAt ?? "", input.requestedAt ?? ""].join("|");
  const digest = createHash("sha256").update(parts).digest("hex").slice(0, 24);
  return `legacy-${digest}`;
}

function clampLimit(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function decodeOffsetCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = Number.parseInt(decoded, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return parsed;
  } catch {
    return 0;
  }
}

function encodeOffsetCursor(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}
