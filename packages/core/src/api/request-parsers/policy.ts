import type { URL } from "node:url";
import type { PolicyDocument } from "../../shared/contracts.js";
import { normalizeCursorPageQuery } from "../../control-plane/api-contracts.js";
import { AthenaError } from "../../runtime/errors.js";
import { optionalNumber, optionalPositiveInt, parseJsonObject, requirePositiveInt, requireString } from "../validation.js";
import { parseOptionalInt, parseOptionalIsoDateTime } from "./helpers.js";

export interface PolicyPutRequest {
  policy: PolicyDocument;
  auditComment?: string;
}

export function parsePolicyPutRequest(body: Record<string, unknown>): PolicyPutRequest {
  if (body.policy !== undefined) {
    const policy = parsePolicyDocument(parseJsonObject(body.policy, "policy.put.policy"), "policy.put.policy");
    return {
      policy,
      auditComment: requireString(body, "auditComment", "policy.put")
    };
  }
  return {
    policy: parsePolicyDocument(body, "policy.put")
  };
}

function parsePolicyDocument(body: Record<string, unknown>, context: string): PolicyDocument {
  const maxConcurrentRuns = optionalPositiveInt(body, "maxConcurrentRuns", context);
  const defaultRunTimeoutMs = optionalPositiveInt(body, "defaultRunTimeoutMs", context);
  const defaultScheduleTimeoutMs = optionalPositiveInt(body, "defaultScheduleTimeoutMs", context);
  const retryBudgetValue = body.retryBudgetPerRun;
  if (retryBudgetValue !== undefined && retryBudgetValue !== null) {
    if (typeof retryBudgetValue !== "number" || !Number.isInteger(retryBudgetValue) || retryBudgetValue < 0) {
      throw new AthenaError("CONFIG_ERROR", `${context}.retryBudgetPerRun must be a non-negative integer when provided.`);
    }
  }
  const retryBudgetPerRun = retryBudgetValue as number | undefined;
  const costBudgetDailyUsd = optionalNumber(body, "costBudgetDailyUsd", context);
  if (costBudgetDailyUsd !== undefined && costBudgetDailyUsd < 0) {
    throw new AthenaError("CONFIG_ERROR", `${context}.costBudgetDailyUsd must be >= 0 when provided.`);
  }
  return {
    schemaVersion: requirePositiveInt(body, "schemaVersion", context),
    updatedAt: new Date().toISOString(),
    ...(maxConcurrentRuns !== undefined ? { maxConcurrentRuns } : {}),
    ...(defaultRunTimeoutMs !== undefined ? { defaultRunTimeoutMs } : {}),
    ...(defaultScheduleTimeoutMs !== undefined ? { defaultScheduleTimeoutMs } : {}),
    ...(retryBudgetPerRun !== undefined && retryBudgetPerRun !== null ? { retryBudgetPerRun } : {}),
    ...(costBudgetDailyUsd !== undefined ? { costBudgetDailyUsd } : {})
  };
}

export function parsePolicyConcurrencyRejectionsQuery(requestUrl: URL): {
  cursor?: string;
  limit: number;
  sessionId?: string;
  createdAfter?: string;
  createdBefore?: string;
} {
  return parseRejectionHistoryQuery(requestUrl, "policy.rejections");
}

export function parseRejectionsQuery(requestUrl: URL): {
  cursor?: string;
  limit: number;
  sessionId?: string;
  createdAfter?: string;
  createdBefore?: string;
} {
  return parseRejectionHistoryQuery(requestUrl, "rejections");
}

function parseRejectionHistoryQuery(
  requestUrl: URL,
  context: "policy.rejections" | "rejections"
): {
  cursor?: string;
  limit: number;
  sessionId?: string;
  createdAfter?: string;
  createdBefore?: string;
} {
  const cursor = requestUrl.searchParams.get("cursor")?.trim();
  const offset = parseOptionalInt(requestUrl.searchParams.get("offset"));
  if (offset !== undefined && offset < 0) {
    throw new AthenaError("CONFIG_ERROR", `${context}.offset must be a non-negative integer when provided.`);
  }
  const limit = parseOptionalInt(requestUrl.searchParams.get("limit"));
  const page = normalizeCursorPageQuery({
    ...(cursor ? { cursor } : {}),
    ...(!cursor && offset !== undefined ? { cursor: encodeOffsetCursor(offset) } : {}),
    ...(limit !== undefined ? { limit } : {})
  });
  const sessionId = requestUrl.searchParams.get("sessionId")?.trim();
  const createdAfter = parseOptionalIsoDateTime(
    requestUrl.searchParams.get("createdAfter"),
    `${context}.createdAfter`
  );
  const createdBefore = parseOptionalIsoDateTime(
    requestUrl.searchParams.get("createdBefore"),
    `${context}.createdBefore`
  );
  return {
    ...page,
    ...(sessionId ? { sessionId } : {}),
    ...(createdAfter ? { createdAfter } : {}),
    ...(createdBefore ? { createdBefore } : {})
  };
}

function encodeOffsetCursor(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}
