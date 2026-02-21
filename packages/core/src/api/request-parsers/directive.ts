import { AthenaError } from "../../runtime/errors.js";
import { requireString } from "../validation.js";

export function parseCreateDirectiveRequest(body: Record<string, unknown>): {
  input: string;
  contextRefs?: string[];
  metadata?: Record<string, string>;
} {
  const contextRefs = parseDirectiveContextRefs(body.contextRefs);
  const metadata = parseDirectiveMetadata(body.metadata);
  return {
    input: requireString(body, "input", "directives.create"),
    ...(contextRefs ? { contextRefs } : {}),
    ...(metadata ? { metadata } : {})
  };
}

function parseDirectiveContextRefs(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new AthenaError("CONFIG_ERROR", "directives.create.contextRefs must be an array when provided.");
  }
  const refs = value.map((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `directives.create.contextRefs[${index}] must be a non-empty string.`
      );
    }
    return item.trim();
  });
  return refs.length > 0 ? refs : undefined;
}

function parseDirectiveMetadata(value: unknown): Record<string, string> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("CONFIG_ERROR", "directives.create.metadata must be an object when provided.");
  }
  const metadata: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `directives.create.metadata.${key} must be a non-empty string.`
      );
    }
    metadata[key] = item.trim();
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}
