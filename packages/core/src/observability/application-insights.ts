import type { IncomingMessage } from "node:http";
import { createRequire } from "node:module";
import type { AthenaConfig } from "../shared/config.js";

type TelemetryClientLike = {
  trackEvent(payload: { name: string; properties?: Record<string, string>; measurements?: Record<string, number> }): void;
  flush(options?: { callback?: () => void }): void;
  context?: {
    keys?: {
      cloudRole?: string;
    };
    tags?: Record<string, string>;
  };
  config?: {
    samplingPercentage?: number;
  };
};

type AppInsightsSetupChain = {
  setAutoCollectRequests(enabled: boolean): AppInsightsSetupChain;
  setAutoCollectDependencies(enabled: boolean): AppInsightsSetupChain;
  setAutoDependencyCorrelation(enabled: boolean): AppInsightsSetupChain;
  setAutoCollectExceptions(enabled: boolean): AppInsightsSetupChain;
  setAutoCollectConsole(collectConsoleLog?: boolean, collectConsoleError?: boolean): AppInsightsSetupChain;
  setUseDiskRetryCaching(enabled: boolean): AppInsightsSetupChain;
  setSendLiveMetrics(enabled: boolean): AppInsightsSetupChain;
  setDistributedTracingMode(mode: unknown): AppInsightsSetupChain;
  start(): unknown;
};

type AppInsightsModule = {
  setup(connectionString?: string): AppInsightsSetupChain;
  defaultClient?: TelemetryClientLike;
  DistributedTracingModes?: {
    AI_AND_W3C?: unknown;
  };
};

let telemetryClient: TelemetryClientLike | undefined;
let initialized = false;
const require = createRequire(import.meta.url);

export function initializeApplicationInsights(config: AthenaConfig): void {
  if (initialized) {
    return;
  }
  initialized = true;
  const appInsights = config.telemetry?.appInsights;
  if (!appInsights?.enabled || !appInsights.connectionString) {
    return;
  }

  try {
    const moduleCandidate = requireApplicationInsights();
    if (!moduleCandidate) {
      return;
    }
    moduleCandidate
      .setup(appInsights.connectionString)
      .setAutoCollectRequests(true)
      .setAutoCollectDependencies(appInsights.trackDependencies)
      .setAutoDependencyCorrelation(true)
      .setAutoCollectExceptions(true)
      .setAutoCollectConsole(false, false)
      .setUseDiskRetryCaching(true)
      .setSendLiveMetrics(false)
      .setDistributedTracingMode(moduleCandidate.DistributedTracingModes?.AI_AND_W3C)
      .start();

    telemetryClient = moduleCandidate.defaultClient as TelemetryClientLike;
    if (telemetryClient.config) {
      telemetryClient.config.samplingPercentage = appInsights.samplingPercentage;
    }
    const cloudRoleKey = telemetryClient.context?.keys?.cloudRole;
    if (cloudRoleKey && telemetryClient.context?.tags) {
      telemetryClient.context.tags[cloudRoleKey] = appInsights.cloudRoleName;
    }
  } catch {
    telemetryClient = undefined;
  }
}

export function flushApplicationInsights(): Promise<void> {
  return new Promise((resolve) => {
    if (!telemetryClient) {
      resolve();
      return;
    }
    telemetryClient.flush({ callback: () => resolve() });
  });
}

export function trackOperationEvent(
  name: string,
  dimensions: Record<string, string | undefined>,
  measurements?: Record<string, number>
): void {
  if (!telemetryClient) {
    return;
  }
  telemetryClient.trackEvent({
    name,
    properties: compactDimensions(dimensions),
    ...(measurements ? { measurements } : {})
  });
}

export function resolveTenantId(req: IncomingMessage): string | undefined {
  return normalizeHeaderValue(req.headers["x-athena-tenant-id"] ?? req.headers["x-tenant-id"]);
}

export function resolveRunId(
  params: Record<string, string>,
  requestUrl: URL
): string | undefined {
  return params.runId?.trim() || requestUrl.searchParams.get("runId")?.trim() || undefined;
}

export function resolveAgentId(
  params: Record<string, string>,
  requestUrl: URL
): string | undefined {
  return (
    params.agentId?.trim() ||
    requestUrl.searchParams.get("agentId")?.trim() ||
    params.agentId?.trim() ||
    requestUrl.searchParams.get("agentId")?.trim() ||
    undefined
  );
}

function compactDimensions(input: Record<string, string | undefined>): Record<string, string> {
  const compact: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.trim().length > 0) {
      compact[key] = value;
    }
  }
  return compact;
}

function normalizeHeaderValue(input: string | string[] | undefined): string | undefined {
  if (!input) {
    return undefined;
  }
  if (Array.isArray(input)) {
    const first = input.find((value) => value.trim().length > 0);
    return first?.trim();
  }
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireApplicationInsights(): AppInsightsModule | undefined {
  try {
    return require("applicationinsights") as AppInsightsModule;
  } catch {
    return undefined;
  }
}
