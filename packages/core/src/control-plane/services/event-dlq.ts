import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { acquireSessionLock } from "../../runtime/session-lock.js";
import type { AthenaConfig } from "../../shared/config.js";
import { getRequestAuthContext } from "../auth.js";
import type {
  EventEmitRequest,
  EventQuery,
  EventQueryResult,
  EventRecord,
  FailedWorkItem,
  FailedWorkListQuery,
  FailedWorkListResult
} from "../../shared/contracts.js";
import type { EventService, FailedWorkService } from "../interfaces.js";
import { clampLimit, decodeOffsetCursor, encodeOffsetCursor } from "./pagination.js";

export class LocalEventService implements EventService {
  private readonly workspaceStateDir: string;
  private readonly eventsDir: string;
  private readonly eventsPath: string;
  private readonly lockPath: string;
  private readonly retentionMaxRecords: number;
  private readonly retentionMaxAgeMs: number;
  private readonly retentionMaxBytes: number;
  private sweepScheduled = false;
  private sweepInFlight: Promise<void> | undefined;

  constructor(config: AthenaConfig) {
    this.workspaceStateDir = resolve(config.workspaceRoot, config.stateDir);
    this.eventsDir = resolve(config.workspaceRoot, config.stateDir, "events");
    this.eventsPath = resolve(this.eventsDir, "events.jsonl");
    this.lockPath = resolve(this.eventsDir, "events.lock");
    this.retentionMaxRecords = config.telemetry?.events.maxRecords ?? 10_000;
    this.retentionMaxAgeMs = config.telemetry?.events.maxAgeMs ?? 30 * 24 * 60 * 60 * 1_000;
    this.retentionMaxBytes = config.telemetry?.events.maxBytes ?? 5_000_000;
  }

  async list(query: EventQuery = {}): Promise<EventQueryResult> {
    await this.ensureDirs();
    const lock = await acquireSessionLock(this.lockPath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      const rows = await this.readAll();
      const filtered = rows.filter((row) => this.matchesQuery(row, query));
      const limit = clampLimit(query.limit ?? 100, 1, 500);
      const offset = decodeOffsetCursor(query.cursor);
      const events = filtered.slice(offset, offset + limit);
      const next = offset + events.length;
      return {
        events,
        ...(next < filtered.length ? { nextCursor: encodeOffsetCursor(next) } : {})
      };
    } finally {
      await lock.release();
    }
  }

  async emit(event: EventEmitRequest): Promise<void> {
    await this.ensureDirs();
    const lock = await acquireSessionLock(this.lockPath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      const row: EventRecord = {
        id: randomUUID(),
        traceId: event.traceId ?? randomUUID(),
        type: event.type,
        createdAt: new Date().toISOString(),
        ...(event.sessionId ? { sessionId: event.sessionId } : {}),
        ...(event.runId ? { runId: event.runId } : {}),
        ...(event.taskId ? { taskId: event.taskId } : {}),
        ...(event.parentRunId ? { parentRunId: event.parentRunId } : {}),
        ...(event.sandbox ? { sandbox: event.sandbox } : {}),
        ...(event.policy ? { policy: event.policy } : {}),
        payload: event.payload
      };
      await this.appendRowLocked(row);
      const safetyRow = await this.deriveSafetyAuditRow(row);
      if (safetyRow) {
        await this.appendRowLocked(safetyRow);
        this.emitSafetyAlert(safetyRow);
      }
    } finally {
      await lock.release();
    }
    this.schedulePruneSweep();
  }

  async shutdown(): Promise<void> {
    this.sweepScheduled = false;
    const inFlight = this.sweepInFlight;
    if (inFlight) {
      await inFlight;
    }
  }

  private async appendRowLocked(row: EventRecord): Promise<void> {
    const handle = await open(this.eventsPath, "a");
    try {
      await handle.appendFile(`${JSON.stringify(row)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  private async ensureDirs(): Promise<void> {
    await mkdir(this.eventsDir, { recursive: true });
  }

  private async readAll(): Promise<EventRecord[]> {
    if (!existsSync(this.eventsPath)) {
      return [];
    }
    const raw = await readFile(this.eventsPath, "utf8");
    const rows: EventRecord[] = [];
    for (const line of raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)) {
      try {
        rows.push(JSON.parse(line) as EventRecord);
      } catch {
        // Ignore malformed JSONL rows so partially written trailing lines do not break reads.
      }
    }
    return rows;
  }

  private matchesQuery(row: EventRecord, query: EventQuery): boolean {
    if (query.traceId && row.traceId !== query.traceId) {
      return false;
    }
    if (query.sessionId && row.sessionId !== query.sessionId) {
      return false;
    }
    if (query.types?.length && !query.types.includes(row.type)) {
      return false;
    }
    if (query.createdAfter || query.createdBefore) {
      const createdAtMs = Date.parse(row.createdAt);
      if (!Number.isFinite(createdAtMs)) {
        return false;
      }
      if (query.createdAfter) {
        const afterMs = Date.parse(query.createdAfter);
        if (Number.isFinite(afterMs) && createdAtMs < afterMs) {
          return false;
        }
      }
      if (query.createdBefore) {
        const beforeMs = Date.parse(query.createdBefore);
        if (Number.isFinite(beforeMs) && createdAtMs > beforeMs) {
          return false;
        }
      }
    }
    return true;
  }

  private async deriveSafetyAuditRow(row: EventRecord): Promise<EventRecord | undefined> {
    if (row.type === "safety.violation") {
      return undefined;
    }
    const normalized = this.normalizeSafetyViolation(row);
    if (!normalized) {
      return undefined;
    }
    const transcriptSnapshot = row.sessionId ? await this.readTranscriptSnapshot(row.sessionId) : undefined;
    const payload: Record<string, unknown> = {
      schemaVersion: 1,
      source: {
        eventId: row.id,
        traceId: row.traceId,
        type: row.type,
        createdAt: row.createdAt
      },
      category: normalized.category,
      severity: normalized.severity,
      outcome: normalized.outcome,
      violationCode: normalized.violationCode,
      actor: normalized.actor,
      ...normalized.details,
      ...(transcriptSnapshot ? { transcriptSnapshot } : {})
    };
    return {
      id: randomUUID(),
      traceId: row.traceId,
      type: "safety.violation",
      createdAt: new Date().toISOString(),
      ...(row.sessionId ? { sessionId: row.sessionId } : {}),
      ...(row.runId ? { runId: row.runId } : {}),
      ...(row.taskId ? { taskId: row.taskId } : {}),
      ...(row.parentRunId ? { parentRunId: row.parentRunId } : {}),
      ...(row.sandbox ? { sandbox: row.sandbox } : {}),
      ...(row.policy ? { policy: row.policy } : {}),
      payload
    };
  }

  private normalizeSafetyViolation(row: EventRecord): {
    category: "authorization" | "policy" | "sandbox";
    severity: "high" | "critical";
    outcome: "denied" | "blocked" | "failed" | "violated";
    violationCode: string;
    actor: { subject: string; role: string };
    details: Record<string, unknown>;
  } | undefined {
    const payload = toObject(row.payload);
    const context = getRequestAuthContext();
    const actor = {
      subject: readString(payload.subject) ?? context?.subject ?? "system",
      role: readString(payload.role) ?? context?.role ?? "system"
    };
    if (row.type === "authz.denied") {
      return {
        category: "authorization",
        severity: "high",
        outcome: "denied",
        violationCode: readString(payload.detailCode) ?? readString(payload.denyReason) ?? "AUTHZ_DENIED",
        actor,
        details: {
          operation: readString(payload.operation),
          requiredRoles: Array.isArray(payload.requiredRoles) ? payload.requiredRoles : [],
          ...(readString(payload.agentName) ? { agentName: readString(payload.agentName) } : {}),
          ...(readString(payload.denyDetail) ? { detail: readString(payload.denyDetail) } : {})
        }
      };
    }
    if (row.type === "policy.concurrency.rejected") {
      return {
        category: "policy",
        severity: "high",
        outcome: "denied",
        violationCode: "POLICY_CONCURRENCY_REJECTED",
        actor,
        details: {
          ...(readString(payload.directiveId) ? { directiveId: readString(payload.directiveId) } : {}),
          ...(readString(payload.harnessProfileId) ? { harnessProfileId: readString(payload.harnessProfileId) } : {}),
          limit: {
            kind: "concurrency.activeRuns",
            ...(readNumber(payload.maxConcurrentRuns) !== undefined
              ? { configured: readNumber(payload.maxConcurrentRuns) }
              : {}),
            ...(readNumber(payload.activeRuns) !== undefined ? { observed: readNumber(payload.activeRuns) } : {})
          },
          reason: readString(payload.reason) ?? "max-concurrent-runs-exceeded"
        }
      };
    }
    if (row.type === "sandbox.quota-exceeded") {
      return {
        category: "sandbox",
        severity: "critical",
        outcome: "violated",
        violationCode: "SANDBOX_QUOTA_EXCEEDED",
        actor,
        details: {
          ...(readString(payload.reason) ? { reason: readString(payload.reason) } : {}),
          ...(readString(payload.agentName) ? { agentName: readString(payload.agentName) } : {}),
          quota: toObject(payload.quota),
          usage: toObject(payload.usage)
        }
      };
    }
    if (row.type === "sandbox.egress-policy") {
      const decision = readString(payload.decision);
      if (decision !== "blocked" && decision !== "error") {
        return undefined;
      }
      return {
        category: "sandbox",
        severity: decision === "error" ? "critical" : "high",
        outcome: decision === "error" ? "failed" : "blocked",
        violationCode: decision === "error" ? "SANDBOX_EGRESS_POLICY_ERROR" : "SANDBOX_EGRESS_BLOCKED",
        actor,
        details: {
          ...(readString(payload.reason) ? { reason: readString(payload.reason) } : {}),
          ...(readString(payload.agentName) ? { agentName: readString(payload.agentName) } : {}),
          declaredDestinations: Array.isArray(payload.declaredDestinations) ? payload.declaredDestinations : []
        }
      };
    }
    if (row.type === "sandbox.lifecycle") {
      const phase = row.sandbox?.phase;
      if (phase !== "required-unavailable" && phase !== "ready-timeout" && phase !== "cleanup-failed") {
        return undefined;
      }
      return {
        category: "sandbox",
        severity: "critical",
        outcome: "failed",
        violationCode: `SANDBOX_${phase.toUpperCase().replaceAll("-", "_")}`,
        actor,
        details: {
          phase,
          ...(row.sandbox?.reason ? { reason: row.sandbox.reason } : {})
        }
      };
    }
    return undefined;
  }

  private async readTranscriptSnapshot(sessionId: string): Promise<Record<string, unknown> | undefined> {
    const sessionPath = resolve(this.workspaceStateDir, "sessions", `${sessionId}.json`);
    if (!existsSync(sessionPath)) {
      return undefined;
    }
    try {
      const sessionRaw = await readFile(sessionPath, "utf8");
      const sessionData = toObject(JSON.parse(sessionRaw));
      const transcriptPath = readString(sessionData.transcriptPath);
      if (!transcriptPath || !existsSync(transcriptPath)) {
        return undefined;
      }
      const transcriptRaw = await readFile(transcriptPath, "utf8");
      const lines = transcriptRaw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const entries = lines
        .slice(-5)
        .map((line) => {
          try {
            return toObject(JSON.parse(line));
          } catch {
            return undefined;
          }
        })
        .filter((entry): entry is Record<string, unknown> => !!entry)
        .map((entry) => ({
          id: readString(entry.id),
          role: readString(entry.role),
          content: truncate(readString(entry.content), 500),
          ...(readString(entry.kind) ? { kind: readString(entry.kind) } : {}),
          ...(readString(entry.toolName) ? { toolName: readString(entry.toolName) } : {}),
          ...(typeof entry.isError === "boolean" ? { isError: entry.isError } : {}),
          createdAt: readString(entry.createdAt)
        }))
        .filter((entry) => entry.id && entry.role && entry.content && entry.createdAt);
      if (entries.length === 0) {
        return undefined;
      }
      return {
        schemaVersion: 1,
        totalEntries: lines.length,
        capturedEntries: entries.length,
        truncated: lines.length > entries.length,
        entries
      };
    } catch {
      return undefined;
    }
  }

  private emitSafetyAlert(row: EventRecord): void {
    const payload = toObject(row.payload);
    const severity = readString(payload.severity) ?? "high";
    const violationCode = readString(payload.violationCode) ?? "SAFETY_VIOLATION";
    const sessionId = row.sessionId ?? "n/a";
    const runId = row.runId ?? "n/a";
    console.error(`[athena:safety][${severity}] ${violationCode} session=${sessionId} run=${runId} trace=${row.traceId}`);
  }

  private schedulePruneSweep(): void {
    this.sweepScheduled = true;
    if (this.sweepInFlight) {
      return;
    }
    this.sweepInFlight = this.runScheduledSweep()
      .catch((error) => {
        if (!isIgnorableSweepError(error)) {
          // Sweep is best-effort; surface non-ignorable errors by dropping the run.
        }
      })
      .finally(() => {
        this.sweepInFlight = undefined;
      });
  }

  private async runScheduledSweep(): Promise<void> {
    while (this.sweepScheduled) {
      this.sweepScheduled = false;
      const lock = await acquireSessionLock(this.lockPath, {
        timeoutMs: 5_000,
        retryDelayMs: 20
      });
      try {
        await this.pruneLocked();
      } finally {
        await lock.release();
      }
    }
  }

  private async pruneLocked(): Promise<void> {
    const rows = await this.readAll();
    const pruneResult = this.applyRetention(rows);
    if (pruneResult.removedTotal === 0) {
      return;
    }
    await this.writeRowsAtomically(pruneResult.rows);
    await this.appendPruneAuditEventLocked(pruneResult);
  }

  private applyRetention(rows: EventRecord[]): {
    rows: EventRecord[];
    removedByAge: number;
    removedByCount: number;
    removedByBytes: number;
    removedTotal: number;
  } {
    const now = Date.now();
    const cutoff = now - this.retentionMaxAgeMs;
    const ageFiltered = rows.filter((row) => {
      const createdAtMs = Date.parse(row.createdAt);
      if (!Number.isFinite(createdAtMs)) {
        return true;
      }
      return createdAtMs >= cutoff;
    });
    const removedByAge = rows.length - ageFiltered.length;
    const byCount = ageFiltered.slice(-this.retentionMaxRecords);
    const removedByCount = ageFiltered.length - byCount.length;
    const byBytes = this.retainWithinByteBudget(byCount);
    const removedByBytes = byCount.length - byBytes.length;
    return {
      rows: byBytes,
      removedByAge,
      removedByCount,
      removedByBytes,
      removedTotal: removedByAge + removedByCount + removedByBytes
    };
  }

  private retainWithinByteBudget(rows: EventRecord[]): EventRecord[] {
    const retained: EventRecord[] = [];
    let total = 0;
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const row = rows[i]!;
      const lineBytes = Buffer.byteLength(`${JSON.stringify(row)}\n`, "utf8");
      if (total + lineBytes > this.retentionMaxBytes) {
        break;
      }
      retained.unshift(row);
      total += lineBytes;
    }
    if (retained.length === 0 && rows.length > 0) {
      return [rows[rows.length - 1]!];
    }
    return retained;
  }

  private async appendPruneAuditEventLocked(pruneResult: {
    rows: EventRecord[];
    removedByAge: number;
    removedByCount: number;
    removedByBytes: number;
    removedTotal: number;
  }): Promise<void> {
    const row: EventRecord = {
      id: randomUUID(),
      traceId: randomUUID(),
      type: "events.pruned",
      createdAt: new Date().toISOString(),
      payload: {
        schemaVersion: 1,
        removedTotal: pruneResult.removedTotal,
        removedByAge: pruneResult.removedByAge,
        removedByCount: pruneResult.removedByCount,
        removedByBytes: pruneResult.removedByBytes,
        retainedRecords: pruneResult.rows.length
      }
    };
    await this.appendRowLocked(row);
  }

  private async writeRowsAtomically(rows: EventRecord[]): Promise<void> {
    const tmp = `${this.eventsPath}.${process.pid}.tmp`;
    const content = rows.map((row) => JSON.stringify(row)).join("\n");
    await writeFile(tmp, content.length > 0 ? `${content}\n` : "", "utf8");
    await rename(tmp, this.eventsPath);
    await rm(tmp, { force: true });
  }
}

interface FailedWorkStateFile {
  schemaVersion: 1;
  items: FailedWorkItem[];
}

export class LocalFailedWorkService implements FailedWorkService {
  private readonly recoveryDir: string;
  private readonly statePath: string;
  private readonly lockPath: string;

  constructor(config: AthenaConfig) {
    this.recoveryDir = resolve(config.workspaceRoot, config.stateDir, "failed-work");
    this.statePath = resolve(this.recoveryDir, "items.json");
    this.lockPath = resolve(this.recoveryDir, "items.lock");
  }

  async list(query: FailedWorkListQuery = {}): Promise<FailedWorkListResult> {
    const state = await this.loadState();
    const filtered = query.status ? state.items.filter((item) => item.status === query.status) : state.items;
    const limit = clampLimit(query.limit ?? 50, 1, 500);
    const offset = decodeOffsetCursor(query.cursor);
    const items = filtered.slice(offset, offset + limit);
    const next = offset + items.length;
    return {
      items,
      ...(next < filtered.length ? { nextCursor: encodeOffsetCursor(next) } : {})
    };
  }

  async retry(id: string): Promise<{ updated: boolean; item?: FailedWorkItem }> {
    return this.setStatus(id, "retried");
  }

  async discard(id: string): Promise<{ updated: boolean; item?: FailedWorkItem }> {
    return this.setStatus(id, "discarded");
  }

  private async setStatus(id: string, status: FailedWorkItem["status"]): Promise<{ updated: boolean; item?: FailedWorkItem }> {
    const lock = await acquireSessionLock(this.lockPath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      const state = await this.loadState();
      const index = state.items.findIndex((item) => item.id === id);
      if (index < 0) {
        return { updated: false };
      }
      const updated: FailedWorkItem = {
        ...state.items[index]!,
        status,
        updatedAt: new Date().toISOString()
      };
      state.items.splice(index, 1, updated);
      await this.saveState(state);
      return {
        updated: true,
        item: updated
      };
    } finally {
      await lock.release();
    }
  }

  private async loadState(): Promise<FailedWorkStateFile> {
    await mkdir(this.recoveryDir, { recursive: true });
    if (!existsSync(this.statePath)) {
      return {
        schemaVersion: 1,
        items: []
      };
    }
    const raw = await readFile(this.statePath, "utf8");
    const parsed = JSON.parse(raw) as FailedWorkStateFile;
    return {
      schemaVersion: 1,
      items: parsed.items ?? []
    };
  }

  private async saveState(state: FailedWorkStateFile): Promise<void> {
    await mkdir(this.recoveryDir, { recursive: true });
    const tmp = `${this.statePath}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(tmp, this.statePath);
    await rm(tmp, { force: true });
  }
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function truncate(value: string | undefined, maxChars: number): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}...`;
}

function isIgnorableSweepError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  if (code === "ENOENT") {
    return true;
  }
  const cause = (error as { causeError?: unknown }).causeError;
  if (cause && typeof cause === "object" && (cause as { code?: unknown }).code === "ENOENT") {
    return true;
  }
  return false;
}
