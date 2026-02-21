import type { AthenaConfig } from "../shared/config.js";
import type { TranscriptEntry } from "../shared/contracts.js";

const MISSING_TOOL_RESULT_CONTENT =
  "[athena] missing tool result in session history; inserted synthetic error result for transcript repair.";

interface HistoryPolicy {
  maxEntries: number;
  maxEntryChars: number;
  repairToolPairing: boolean;
  stripControlChars: boolean;
}

export interface HistorySanitizationReport {
  droppedOrphanToolResults: number;
  droppedDuplicateToolResults: number;
  insertedMissingToolResults: number;
  truncatedEntries: number;
  trimmedByMaxEntries: number;
}

export function sanitizeTranscriptHistory(
  entries: TranscriptEntry[],
  config: AthenaConfig
): { entries: TranscriptEntry[]; report: HistorySanitizationReport } {
  const policy = resolveHistoryPolicy(config);
  const report: HistorySanitizationReport = {
    droppedOrphanToolResults: 0,
    droppedDuplicateToolResults: 0,
    insertedMissingToolResults: 0,
    truncatedEntries: 0,
    trimmedByMaxEntries: 0
  };

  const sanitized = entries.map((entry) => sanitizeEntry(entry, policy, report));
  const limited = applyHistoryLimit(sanitized, policy.maxEntries, report);

  if (!policy.repairToolPairing) {
    return { entries: limited, report };
  }

  return { entries: repairToolPairing(limited, report), report };
}

function resolveHistoryPolicy(config: AthenaConfig): HistoryPolicy {
  return {
    maxEntries: sanitizePositiveInt(config.history?.maxEntries, 200),
    maxEntryChars: sanitizePositiveInt(config.history?.maxEntryChars, 8_000),
    repairToolPairing: config.history?.repairToolPairing ?? true,
    stripControlChars: config.history?.stripControlChars ?? true
  };
}

function sanitizePositiveInt(value: number | undefined, defaultValue: number): number {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return defaultValue;
  }
  return Math.floor(value);
}

function sanitizeEntry(
  entry: TranscriptEntry,
  policy: HistoryPolicy,
  report: HistorySanitizationReport
): TranscriptEntry {
  const normalized = policy.stripControlChars ? stripDisallowedControlChars(entry.content) : entry.content;
  if (normalized.length <= policy.maxEntryChars) {
    return entry.content === normalized ? entry : { ...entry, content: normalized };
  }

  report.truncatedEntries += 1;
  return {
    ...entry,
    content: normalized.slice(0, policy.maxEntryChars)
  };
}

function stripDisallowedControlChars(input: string): string {
  return input.replace(/[^\P{C}\n\t]/gu, "");
}

function applyHistoryLimit(
  entries: TranscriptEntry[],
  maxEntries: number,
  report: HistorySanitizationReport
): TranscriptEntry[] {
  if (entries.length <= maxEntries) {
    return entries;
  }
  report.trimmedByMaxEntries = entries.length - maxEntries;
  return entries.slice(entries.length - maxEntries);
}

function repairToolPairing(entries: TranscriptEntry[], report: HistorySanitizationReport): TranscriptEntry[] {
  const out: TranscriptEntry[] = [];
  const seenToolResultIds = new Set<string>();
  const pendingToolCalls = new Map<string, TranscriptEntry>();

  const flushMissing = (createdAt: string) => {
    for (const [toolCallId, call] of pendingToolCalls) {
      out.push(createMissingToolResultEntry(call, toolCallId, createdAt));
      report.insertedMissingToolResults += 1;
    }
    pendingToolCalls.clear();
  };

  for (const entry of entries) {
    if (isToolCallEntry(entry)) {
      out.push(entry);
      if (entry.toolCallId) {
        pendingToolCalls.set(entry.toolCallId, entry);
      }
      continue;
    }

    if (isToolResultEntry(entry)) {
      const toolCallId = entry.toolCallId;
      if (toolCallId && seenToolResultIds.has(toolCallId)) {
        report.droppedDuplicateToolResults += 1;
        continue;
      }
      if (!toolCallId || !pendingToolCalls.has(toolCallId)) {
        report.droppedOrphanToolResults += 1;
        continue;
      }
      pendingToolCalls.delete(toolCallId);
      seenToolResultIds.add(toolCallId);
      out.push(entry);
      continue;
    }

    if (pendingToolCalls.size > 0) {
      flushMissing(entry.createdAt);
    }
    out.push(entry);
  }

  if (pendingToolCalls.size > 0) {
    const createdAt = entries.at(-1)?.createdAt ?? new Date().toISOString();
    flushMissing(createdAt);
  }

  return out;
}

function isToolCallEntry(entry: TranscriptEntry): boolean {
  return entry.kind === "tool-call" && entry.role === "assistant";
}

function isToolResultEntry(entry: TranscriptEntry): boolean {
  return entry.kind === "tool-result" && entry.role === "tool";
}

function createMissingToolResultEntry(
  call: TranscriptEntry,
  toolCallId: string,
  createdAt: string
): TranscriptEntry {
  return {
    id: `${call.id}:missing-result:${toolCallId}`,
    role: "tool",
    kind: "tool-result",
    toolCallId,
    toolName: call.toolName ?? "unknown",
    isError: true,
    content: MISSING_TOOL_RESULT_CONTENT,
    createdAt
  };
}
