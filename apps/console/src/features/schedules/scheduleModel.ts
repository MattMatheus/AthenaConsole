import type {
  CreateScheduleRequest,
  ScheduleFormDraft,
  ScheduleFormValidation,
  ScheduleFrequency,
  ScheduleRunLog,
  ScheduleRunResult,
  ScheduleStatus,
  ScheduledTask,
} from "./types";

export function defaultTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function formatScheduleDate(value: string | undefined): string {
  if (!value) {
    return "not recorded";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function formatScheduleCadence(schedule: ScheduledTask): string {
  if (schedule.rrule) {
    const parsed = parseSimpleRRule(schedule.rrule);
    if (parsed) {
      const unit = frequencyLabel(parsed.frequency);
      return parsed.interval === 1 ? `Every ${unit}` : `Every ${parsed.interval} ${unit}s`;
    }
    return schedule.rrule;
  }
  return "One shot";
}

function frequencyLabel(frequency: ScheduleFrequency): string {
  if (frequency === "HOURLY") {
    return "hour";
  }
  if (frequency === "WEEKLY") {
    return "week";
  }
  return "day";
}

export function scheduleStatusTone(status: ScheduleStatus | undefined): "success" | "warning" | "danger" | "muted" {
  if (status === "active") {
    return "success";
  }
  if (status === "paused" || status === "disabled") {
    return "warning";
  }
  if (status === "error") {
    return "danger";
  }
  return "muted";
}

export function buildSimpleRRule(frequency: ScheduleFrequency, interval: number): string {
  return `FREQ=${frequency};INTERVAL=${interval}`;
}

export function parseSimpleRRule(rrule: string): { frequency: ScheduleFrequency; interval: number } | undefined {
  const parts = Object.fromEntries(
    rrule
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, value] = part.split("=");
        return [key?.toUpperCase() ?? "", value?.toUpperCase() ?? ""];
      }),
  );
  const frequency = parts.FREQ;
  if (frequency !== "HOURLY" && frequency !== "DAILY" && frequency !== "WEEKLY") {
    return undefined;
  }
  const interval = Number.parseInt(parts.INTERVAL ?? "1", 10);
  return {
    frequency,
    interval: Number.isInteger(interval) && interval > 0 ? interval : 1,
  };
}

export function validateScheduleForm(draft: ScheduleFormDraft): ScheduleFormValidation {
  const validation: ScheduleFormValidation = {};
  if (!/^[A-Za-z0-9._-]+$/.test(draft.id.trim())) {
    validation.id = "Use letters, numbers, dots, underscores, or hyphens.";
  }
  if (!draft.targetId) {
    validation.targetId = draft.targetType === "workflow-template" ? "Choose a workflow template." : "Choose a ready task.";
  }
  if (draft.mode === "one-shot" && !toIsoFromLocalDateTime(draft.runAtLocal)) {
    validation.runAtLocal = "Choose a valid run time.";
  }
  const interval = Number.parseInt(draft.interval, 10);
  if (draft.mode === "recurring" && (!Number.isInteger(interval) || interval <= 0 || String(interval) !== draft.interval)) {
    validation.interval = "Use a positive whole number.";
  }
  return validation;
}

export function hasScheduleValidationErrors(validation: ScheduleFormValidation): boolean {
  return Boolean(validation.id || validation.targetId || validation.runAtLocal || validation.interval);
}

export function buildCreateScheduleRequest(
  draft: ScheduleFormDraft,
  options: { inputBindings?: unknown } = {},
): CreateScheduleRequest {
  const validation = validateScheduleForm(draft);
  if (hasScheduleValidationErrors(validation)) {
    throw new Error("Schedule form is invalid.");
  }
  const request: CreateScheduleRequest = {
    id: draft.id.trim(),
    targetType: draft.targetType,
    targetId: draft.targetId,
    timezone: draft.timezone.trim() || defaultTimezone(),
    status: "active",
    failurePolicy: { overlap: "skip-if-running" },
  };
  if (draft.targetType === "workflow-template" && options.inputBindings !== undefined) {
    request.inputBindings = options.inputBindings;
  }
  const name = draft.name.trim();
  if (name) {
    request.name = name;
  }
  if (draft.mode === "recurring") {
    request.rrule = buildSimpleRRule(draft.frequency, Number.parseInt(draft.interval, 10));
  } else {
    const runAt = toIsoFromLocalDateTime(draft.runAtLocal);
    if (runAt) {
      request.runAt = runAt;
    }
  }
  return request;
}

export function summarizeScheduleRunResult(result: ScheduleRunResult): string {
  if (result.status === "already-running") {
    return `${result.id} skipped because it is already running.`;
  }
  if (result.status === "failed") {
    return `${result.id} failed${result.error ? `: ${result.error}` : result.reason ? `: ${result.reason}` : "."}`;
  }
  const created = result.missionId ? ` Created mission ${result.missionId}.` : "";
  const next = result.nextRunAt ? ` Next: ${formatScheduleDate(result.nextRunAt)}.` : "";
  const missed = result.missedRunAt ? ` Missed: ${formatScheduleDate(result.missedRunAt)}.` : "";
  return `${result.id} ran successfully.${created}${missed}${next}`;
}

export function summarizeScheduleRunLog(log: ScheduleRunLog): string {
  if (log.status === "already-running") {
    return `${log.scheduleId} skipped because it is already running.`;
  }
  if (log.status === "failed") {
    return `${log.scheduleId} failed${log.error ? `: ${log.error}` : log.reason ? `: ${log.reason}` : "."}`;
  }
  const created = log.missionId ? ` Created mission ${log.missionId}.` : "";
  const run = log.runId ? ` Task run ${log.runId}.` : "";
  const next = log.nextRunAt ? ` Next: ${formatScheduleDate(log.nextRunAt)}.` : "";
  const missed = log.missedRunAt ? ` Missed: ${formatScheduleDate(log.missedRunAt)}.` : "";
  return `${log.scheduleId} ran successfully.${created}${run}${missed}${next}`;
}

function toIsoFromLocalDateTime(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
