import { apiClient, fleetApiService } from "../../services";
import type { FleetEvent, FleetSummary, ProviderCostSettings } from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function toEventStatus(value: unknown): FleetEvent["status"] {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (normalized === "error") {
    return "error";
  }
  if (normalized === "warning" || normalized === "warn") {
    return "warning";
  }
  return "success";
}

export async function fetchFleetSummary(): Promise<FleetSummary> {
  return fleetApiService.getFleetSummary();
}

export async function fetchRecentEvents(limit = 10): Promise<FleetEvent[]> {
  const payload = await apiClient.get<unknown>("/events");

  const list = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.events)
      ? payload.events
      : [];

  return list
    .filter(isRecord)
    .slice(0, limit)
    .map((item, index) => ({
      id:
        typeof item.id === "string"
          ? item.id
          : typeof item.eventId === "string"
            ? item.eventId
            : `event_${index + 1}`,
      timestamp:
        typeof item.timestamp === "string"
          ? item.timestamp
          : typeof item.createdAt === "string"
            ? item.createdAt
            : new Date().toISOString(),
      message:
        typeof item.message === "string"
          ? item.message
          : typeof item.type === "string"
            ? item.type
            : "System event",
      status: toEventStatus(item.status),
    }));
}

export async function fetchProviderCostSettings(): Promise<ProviderCostSettings> {
  const payload = await apiClient.get<unknown>("/fleet/cost/settings");
  const record = isRecord(payload) ? payload : {};
  const providers = Array.isArray(record.providers)
    ? record.providers
        .filter(isRecord)
        .map((row) => ({
          provider: typeof row.provider === "string" ? row.provider : "",
          inputCostPer1kTokensUsd: toNumber(row.inputCostPer1kTokensUsd),
          outputCostPer1kTokensUsd: toNumber(row.outputCostPer1kTokensUsd),
          updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
        }))
        .filter((row) => row.provider.length > 0)
    : [];

  return {
    schemaVersion: 1,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date(0).toISOString(),
    providers,
  };
}

export async function updateProviderCostSettings(request: {
  providers: Array<{
    provider: string;
    inputCostPer1kTokensUsd: number;
    outputCostPer1kTokensUsd: number;
  }>;
}): Promise<ProviderCostSettings> {
  return apiClient.put<ProviderCostSettings>("/fleet/cost/settings", request);
}

export async function fetchMonthlyCostReportCsv(month?: string): Promise<string> {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return apiClient.getText(`/fleet/cost/report.csv${query}`);
}
