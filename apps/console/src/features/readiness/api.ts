import { apiClient } from "../../services";
import type {
  ReadinessCheck,
  ReadinessCheckCategory,
  ReadinessCheckStatus,
  ReadinessReport,
  ReadinessStatus,
} from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readinessStatus(value: unknown): ReadinessStatus {
  return value === "ready" || value === "degraded" || value === "not-ready" ? value : "not-ready";
}

function checkStatus(value: unknown): ReadinessCheckStatus {
  return value === "ok" || value === "degraded" || value === "failed" ? value : "failed";
}

function checkCategory(value: unknown): ReadinessCheckCategory {
  return value === "api" || value === "app-state" || value === "plugins" || value === "runtime" || value === "sample-demo"
    ? value
    : "runtime";
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function detailsRecord(value: unknown): Record<string, string | number | boolean> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string | number | boolean] => {
      const detail = entry[1];
      return typeof detail === "string" || typeof detail === "number" || typeof detail === "boolean";
    }),
  );
}

function parseCheck(value: unknown): ReadinessCheck | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.label !== "string") {
    return undefined;
  }
  return {
    id: value.id,
    label: value.label,
    category: checkCategory(value.category),
    status: checkStatus(value.status),
    required: Boolean(value.required),
    message: typeof value.message === "string" ? value.message : "",
    nextStep: typeof value.nextStep === "string" ? value.nextStep : "",
    details: detailsRecord(value.details),
  };
}

export function parseReadinessReport(payload: unknown): ReadinessReport {
  if (!isRecord(payload)) {
    throw new Error("Readiness payload is invalid.");
  }
  const summary = isRecord(payload.summary) ? payload.summary : {};
  const checks = Array.isArray(payload.checks)
    ? payload.checks.map(parseCheck).filter((check): check is ReadinessCheck => check !== undefined)
    : [];
  return {
    status: readinessStatus(payload.status),
    generatedAt: typeof payload.generatedAt === "string" ? payload.generatedAt : new Date(0).toISOString(),
    summary: {
      ready: Boolean(summary.ready),
      requiredFailed: numberValue(summary.requiredFailed),
      degraded: numberValue(summary.degraded),
      optionalUnavailable: numberValue(summary.optionalUnavailable),
    },
    checks,
  };
}

export async function fetchReadiness(): Promise<ReadinessReport> {
  return parseReadinessReport(await apiClient.get<unknown>("/v1/readiness"));
}
