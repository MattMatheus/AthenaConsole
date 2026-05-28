import type { RunTemplate, RunTemplateCreateRequest, TemplateRunRequest } from "./types";

export type KeyValueLineParseResult = {
  values: Record<string, string>;
  errors: string[];
};

const PLACEHOLDER_RE = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

export function parseKeyValueLines(text: string): KeyValueLineParseResult {
  const values: Record<string, string> = {};
  const errors: string[] = [];

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }
    const separator = line.indexOf("=");
    if (separator <= 0) {
      errors.push(`Line ${index + 1} must use KEY=value.`);
      return;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!key) {
      errors.push(`Line ${index + 1} is missing a key.`);
      return;
    }
    if (!/^[A-Z0-9_]+$/.test(key)) {
      errors.push(`Line ${index + 1} key must use uppercase letters, numbers, or underscores.`);
      return;
    }
    if (!value) {
      errors.push(`Line ${index + 1} is missing a value.`);
      return;
    }
    values[key] = value;
  });

  return { values, errors };
}

export function formatKeyValueLines(values: Record<string, string> | undefined): string {
  if (!values) {
    return "";
  }
  return Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export function extractDirectivePlaceholders(directiveTemplate: string): string[] {
  const names = new Set<string>();
  for (const match of directiveTemplate.matchAll(PLACEHOLDER_RE)) {
    names.add(match[1] ?? "");
  }
  return [...names].filter(Boolean).sort();
}

export function summarizeParams(values: Record<string, string>): string {
  const count = Object.keys(values).length;
  if (count === 0) {
    return "No params";
  }
  return count === 1 ? "1 param" : `${count} params`;
}

export function buildRunTemplateCreateRequest(input: {
  harnessProfileId: string;
  directiveTemplate: string;
  defaultParamsText: string;
}): { request?: RunTemplateCreateRequest; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const harnessProfileId = input.harnessProfileId.trim();
  const directiveTemplate = input.directiveTemplate.trim();
  const parsedParams = parseKeyValueLines(input.defaultParamsText);

  if (!harnessProfileId) {
    errors.harnessProfileId = "Harness profile is required.";
  }
  if (!directiveTemplate) {
    errors.directiveTemplate = "Directive template is required.";
  }
  if (parsedParams.errors.length > 0) {
    errors.defaultParams = parsedParams.errors.join(" ");
  }

  const missingDefaults = extractDirectivePlaceholders(directiveTemplate).filter((name) => parsedParams.values[name] === undefined);
  if (missingDefaults.length > 0) {
    errors.defaultParams = `Default params must include: ${missingDefaults.join(", ")}.`;
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    request: {
      harnessProfileId,
      directiveTemplate,
      defaultParams: parsedParams.values,
    },
    errors,
  };
}

export function buildTemplateRunRequest(input: {
  sessionId: string;
  overrideParamsText: string;
}): { request?: TemplateRunRequest; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const parsedParams = parseKeyValueLines(input.overrideParamsText);
  if (parsedParams.errors.length > 0) {
    errors.overrideParams = parsedParams.errors.join(" ");
  }
  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    request: {
      ...(input.sessionId.trim() ? { sessionId: input.sessionId.trim() } : {}),
      ...(Object.keys(parsedParams.values).length > 0 ? { params: parsedParams.values } : {}),
    },
    errors,
  };
}

export function templateSearchText(template: RunTemplate): string {
  return [
    template.id,
    template.harnessProfileId,
    template.directiveTemplate,
    ...Object.keys(template.defaultParams),
    ...Object.values(template.defaultParams),
  ].join(" ");
}
