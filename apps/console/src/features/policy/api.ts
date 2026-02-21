import { apiClient } from "../../services";
import type { PolicyDocument, PolicyUpdateRequest } from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function toPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : undefined;
}

function toNonNegativeNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return value;
}

function toPolicyDocument(input: unknown): PolicyDocument | null {
  if (input === null) {
    return null;
  }
  if (!isRecord(input) || typeof input.schemaVersion !== "number" || typeof input.updatedAt !== "string") {
    return null;
  }

  const maxConcurrentRuns = toPositiveInteger(input.maxConcurrentRuns);
  const defaultRunTimeoutMs = toPositiveInteger(input.defaultRunTimeoutMs);
  const defaultScheduleTimeoutMs = toPositiveInteger(input.defaultScheduleTimeoutMs);
  const retryBudgetPerRun = toPositiveInteger(input.retryBudgetPerRun);
  const costBudgetDailyUsd = toNonNegativeNumber(input.costBudgetDailyUsd);

  return {
    schemaVersion: Math.max(1, Math.floor(input.schemaVersion)),
    updatedAt: input.updatedAt,
    ...(maxConcurrentRuns !== undefined ? { maxConcurrentRuns } : {}),
    ...(defaultRunTimeoutMs !== undefined ? { defaultRunTimeoutMs } : {}),
    ...(defaultScheduleTimeoutMs !== undefined ? { defaultScheduleTimeoutMs } : {}),
    ...(retryBudgetPerRun !== undefined ? { retryBudgetPerRun } : {}),
    ...(costBudgetDailyUsd !== undefined ? { costBudgetDailyUsd } : {})
  };
}

export async function fetchPolicy(): Promise<PolicyDocument | null> {
  const payload = await apiClient.get<unknown>("/policy");
  return toPolicyDocument(payload);
}

export async function updatePolicy(request: PolicyUpdateRequest): Promise<PolicyDocument> {
  const payload = await apiClient.put<unknown>("/policy", request);
  const parsed = toPolicyDocument(payload);
  if (!parsed) {
    throw new Error("Policy update response payload is invalid.");
  }
  return parsed;
}
