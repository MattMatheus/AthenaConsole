import type { FleetSummary } from "@athena/core/control-plane/api-contracts";
import { ApiClientError, apiClient } from "./apiClient";

type RecordValue = Record<string, unknown>;

export interface FleetApiClient {
  get<TResponse>(path: string): Promise<TResponse>;
}

export class FleetApiServiceError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "FleetApiServiceError";
    this.cause = cause;
  }
}

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

function toFleetSummary(payload: unknown): FleetSummary {
  const record = isRecord(payload) ? payload : {};
  const costSummaryRecord = isRecord(record.costSummary) ? record.costSummary : undefined;
  const tokenMixRecord = costSummaryRecord && isRecord(costSummaryRecord.tokenMix) ? costSummaryRecord.tokenMix : undefined;

  return {
    total: toNumber(record.total),
    running: toNumber(record.running),
    pending: toNumber(record.pending),
    succeeded: toNumber(record.succeeded),
    failed: toNumber(record.failed),
    capabilities: isRecord(record.capabilities)
      ? {
          supportsPodStatus: Boolean(record.capabilities.supportsPodStatus),
          supportsCpuMemMetrics: Boolean(record.capabilities.supportsCpuMemMetrics)
        }
      : {
          supportsPodStatus: false,
          supportsCpuMemMetrics: false
        },
    ...(typeof record.cpuUsage === "number" ? { cpuUsage: record.cpuUsage } : {}),
    ...(typeof record.memoryUsage === "number" ? { memoryUsage: record.memoryUsage } : {}),
    ...(isRecord(record.operationalSummary)
      ? {
          operationalSummary: {
            totalActiveRuns: toNumber(record.operationalSummary.totalActiveRuns),
            totalActiveSessions: toNumber(record.operationalSummary.totalActiveSessions),
            aggregateResourceUsage: isRecord(record.operationalSummary.aggregateResourceUsage)
              ? {
                  cpuUsage: toNumber(record.operationalSummary.aggregateResourceUsage.cpuUsage),
                  memoryUsage: toNumber(record.operationalSummary.aggregateResourceUsage.memoryUsage)
                }
              : {
                  cpuUsage: 0,
                  memoryUsage: 0
                },
            recentFailureRejectionCount: toNumber(record.operationalSummary.recentFailureRejectionCount)
          }
        }
      : {}),
    ...(costSummaryRecord
      ? {
          costSummary: {
            month:
              typeof costSummaryRecord.month === "string"
                ? costSummaryRecord.month
                : new Date().toISOString().slice(0, 7),
            windowStart:
              typeof costSummaryRecord.windowStart === "string"
                ? costSummaryRecord.windowStart
                : new Date().toISOString(),
            windowEnd:
              typeof costSummaryRecord.windowEnd === "string"
                ? costSummaryRecord.windowEnd
                : new Date().toISOString(),
            totalEstimatedSpendUsd: toNumber(costSummaryRecord.totalEstimatedSpendUsd),
            personaBreakdown: Array.isArray(costSummaryRecord.personaBreakdown)
              ? costSummaryRecord.personaBreakdown
                  .filter(isRecord)
                  .map((row) => ({
                    personaName: typeof row.personaName === "string" ? row.personaName : "unattributed",
                    estimatedSpendUsd: toNumber(row.estimatedSpendUsd),
                    inputTokens: toNumber(row.inputTokens),
                    outputTokens: toNumber(row.outputTokens),
                    totalTokens: toNumber(row.totalTokens)
                  }))
              : [],
            providerBreakdown: Array.isArray(costSummaryRecord.providerBreakdown)
              ? costSummaryRecord.providerBreakdown
                  .filter(isRecord)
                  .map((row) => ({
                    provider: typeof row.provider === "string" ? row.provider : "unknown",
                    estimatedSpendUsd: toNumber(row.estimatedSpendUsd),
                    inputTokens: toNumber(row.inputTokens),
                    outputTokens: toNumber(row.outputTokens),
                    totalTokens: toNumber(row.totalTokens)
                  }))
              : [],
            tokenMix: {
              inputTokens: toNumber(tokenMixRecord?.inputTokens),
              outputTokens: toNumber(tokenMixRecord?.outputTokens),
              totalTokens: toNumber(tokenMixRecord?.totalTokens),
              inputRatio: toNumber(tokenMixRecord?.inputRatio),
              outputRatio: toNumber(tokenMixRecord?.outputRatio)
            }
          }
        }
      : {})
  };
}

export class FleetApiService {
  constructor(private readonly client: FleetApiClient = apiClient) {}

  async getFleetSummary(): Promise<FleetSummary> {
    try {
      const payload = await this.client.get<unknown>("/fleet/summary");
      return toFleetSummary(payload);
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw new FleetApiServiceError(`Unable to fetch fleet summary (${error.status}): ${error.message}`, error);
      }
      if (error instanceof Error) {
        throw new FleetApiServiceError(`Unable to fetch fleet summary: ${error.message}`, error);
      }
      throw new FleetApiServiceError("Unable to fetch fleet summary due to an unknown error.", error);
    }
  }
}

export const fleetApiService = new FleetApiService();
