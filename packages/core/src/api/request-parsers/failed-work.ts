import type { URL } from "node:url";
import { AthenaError } from "../../runtime/errors.js";
import { optionalString } from "../validation.js";
import { parseCursorPageQuery } from "./pagination.js";

export type FailedWorkStatus = "pending" | "retried" | "discarded";

export function parseFailedWorkListQuery(requestUrl: URL): {
  cursor?: string;
  limit: number;
  status?: FailedWorkStatus;
} {
  const page = parseCursorPageQuery(requestUrl);
  const status = parseFailedWorkStatus(requestUrl.searchParams.get("status"));
  return {
    ...page,
    ...(status ? { status } : {})
  };
}

export function parseFailedWorkDiscardRequest(body: Record<string, unknown>): {
  auditNote?: string;
} {
  const auditNote = optionalString(body, "auditNote", "failed-work.discard");
  return {
    ...(auditNote ? { auditNote } : {})
  };
}

function parseFailedWorkStatus(value: string | null): FailedWorkStatus | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "pending" || value === "retried" || value === "discarded") {
    return value;
  }
  throw new AthenaError("CONFIG_ERROR", "failed-work.status must be pending|retried|discarded.");
}
