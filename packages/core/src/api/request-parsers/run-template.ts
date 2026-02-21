import { AthenaError } from "../../runtime/errors.js";
import { requireString } from "../validation.js";

export function parseCreateRunTemplateRequest(body: Record<string, unknown>): {
  harnessProfileId: string;
  directiveTemplate: string;
  defaultParams: Record<string, string>;
} {
  return {
    harnessProfileId: requireString(body, "harnessProfileId", "runTemplates.create"),
    directiveTemplate: requireString(body, "directiveTemplate", "runTemplates.create"),
    defaultParams: parseRunTemplateDefaultParams(body.defaultParams)
  };
}

export function parseTemplateRunRequest(body: Record<string, unknown>): { params?: Record<string, string> } {
  const params = parseTemplateRunParams(body.params);
  return {
    ...(params ? { params } : {})
  };
}

function parseRunTemplateDefaultParams(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("CONFIG_ERROR", "runTemplates.create.defaultParams must be an object.");
  }
  const row = value as Record<string, unknown>;
  const params: Record<string, string> = {};
  for (const [key, entry] of Object.entries(row)) {
    const normalizedKey = key.trim();
    if (normalizedKey.length === 0) {
      throw new AthenaError("CONFIG_ERROR", "runTemplates.create.defaultParams keys must be non-empty strings.");
    }
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `runTemplates.create.defaultParams.${normalizedKey} must be a non-empty string.`
      );
    }
    params[normalizedKey] = entry.trim();
  }
  return params;
}

function parseTemplateRunParams(value: unknown): Record<string, string> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("CONFIG_ERROR", "templates.run.params must be an object when provided.");
  }
  const row = value as Record<string, unknown>;
  const params: Record<string, string> = {};
  for (const [key, entry] of Object.entries(row)) {
    const normalizedKey = key.trim();
    if (normalizedKey.length === 0) {
      throw new AthenaError("CONFIG_ERROR", "templates.run.params keys must be non-empty strings.");
    }
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new AthenaError("CONFIG_ERROR", `templates.run.params.${normalizedKey} must be a non-empty string.`);
    }
    params[normalizedKey] = entry.trim();
  }
  return params;
}
