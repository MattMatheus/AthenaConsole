import type { URL } from "node:url";
import { AthenaError } from "../../runtime/errors.js";
import { parseOptionalInt, parseOptionalIsoDateTime } from "./helpers.js";
import { parseCursorPageQuery } from "./pagination.js";

export function parseA2aFlowGraphQuery(requestUrl: URL): {
  limit: number;
  types?: string[];
} {
  const limitRaw = parseOptionalInt(requestUrl.searchParams.get("limit"));
  const limit = clampLimit(limitRaw);
  const typesRaw = requestUrl.searchParams.get("types");
  const types = typesRaw
    ? typesRaw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
  return {
    limit,
    ...(types && types.length > 0 ? { types } : {})
  };
}

export function parseA2aObservabilityQuery(requestUrl: URL): {
  limit: number;
  windowMinutes: number;
  bucketMinutes: number;
  traceId?: string;
} {
  const limit = clampLimit(parseOptionalInt(requestUrl.searchParams.get("limit")), 500, 2_000);
  const windowMinutes = clampLimit(parseOptionalInt(requestUrl.searchParams.get("windowMinutes")), 60, 1_440);
  const bucketMinutes = clampLimit(parseOptionalInt(requestUrl.searchParams.get("bucketMinutes")), 5, 60);
  const traceId = requestUrl.searchParams.get("traceId")?.trim();
  return {
    limit,
    windowMinutes,
    bucketMinutes,
    ...(traceId ? { traceId } : {})
  };
}

export function parseA2aStallAlertHistoryQuery(requestUrl: URL): {
  cursor?: string;
  limit: number;
  traceId?: string;
  stepId?: string;
  severity?: "warning" | "critical";
  createdAfter?: string;
  createdBefore?: string;
} {
  const page = parseCursorPageQuery(requestUrl);
  const traceId = requestUrl.searchParams.get("traceId")?.trim();
  const stepId = requestUrl.searchParams.get("stepId")?.trim();
  const severityRaw = requestUrl.searchParams.get("severity")?.trim();
  const severity =
    severityRaw === "warning" || severityRaw === "critical"
      ? severityRaw
      : severityRaw
        ? (() => {
            throw new AthenaError("CONFIG_ERROR", "a2a.observability.alerts.severity must be warning|critical.");
          })()
        : undefined;
  const createdAfter = parseOptionalIsoDateTime(
    requestUrl.searchParams.get("createdAfter"),
    "a2a.observability.alerts.createdAfter"
  );
  const createdBefore = parseOptionalIsoDateTime(
    requestUrl.searchParams.get("createdBefore"),
    "a2a.observability.alerts.createdBefore"
  );
  return {
    ...page,
    ...(traceId ? { traceId } : {}),
    ...(stepId ? { stepId } : {}),
    ...(severity ? { severity } : {}),
    ...(createdAfter ? { createdAfter } : {}),
    ...(createdBefore ? { createdBefore } : {})
  };
}

export function parseA2aStallAlertCsvExportQuery(requestUrl: URL): {
  traceId?: string;
  stepId?: string;
  severity?: "warning" | "critical";
  createdAfter: string;
  createdBefore: string;
} {
  const traceId = requestUrl.searchParams.get("traceId")?.trim();
  const stepId = requestUrl.searchParams.get("stepId")?.trim();
  const severityRaw = requestUrl.searchParams.get("severity")?.trim();
  let severity: "warning" | "critical" | undefined;
  if (severityRaw) {
    if (severityRaw !== "warning" && severityRaw !== "critical") {
      throw new AthenaError("CONFIG_ERROR", "a2a.observability.alerts.severity must be warning|critical.");
    }
    severity = severityRaw;
  }
  const createdAfter = parseOptionalIsoDateTime(
    requestUrl.searchParams.get("createdAfter"),
    "a2a.observability.alerts.export.createdAfter"
  );
  const createdBefore = parseOptionalIsoDateTime(
    requestUrl.searchParams.get("createdBefore"),
    "a2a.observability.alerts.export.createdBefore"
  );
  if (!createdAfter || !createdBefore) {
    throw new AthenaError(
      "CONFIG_ERROR",
      "a2a.observability.alerts.export requires createdAfter and createdBefore."
    );
  }
  return {
    ...(traceId ? { traceId } : {}),
    ...(stepId ? { stepId } : {}),
    ...(severity ? { severity } : {}),
    createdAfter,
    createdBefore
  };
}

function clampLimit(value: number | undefined, fallback = 200, max = 1_000): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.floor(value as number)));
}
