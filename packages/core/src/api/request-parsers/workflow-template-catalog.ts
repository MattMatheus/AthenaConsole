import { AthenaError } from "../../runtime/errors.js";
import type { WorkflowTemplateCatalogListQuery } from "../../shared/contracts.js";

export function parseWorkflowTemplateCatalogListQuery(requestUrl: URL): WorkflowTemplateCatalogListQuery {
  const pluginId = requestUrl.searchParams.get("pluginId")?.trim();
  const includeUnavailable = parseOptionalBooleanQuery(
    requestUrl.searchParams.get("includeUnavailable"),
    "workflowTemplates.list.includeUnavailable"
  );
  return {
    ...(pluginId ? { pluginId } : {}),
    ...(includeUnavailable !== undefined ? { includeUnavailable } : {})
  };
}

function parseOptionalBooleanQuery(value: string | null, context: string): boolean | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  throw new AthenaError("CONFIG_ERROR", `${context} must be true or false when provided.`);
}
