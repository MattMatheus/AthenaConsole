import type { HarnessVerificationPolicy } from "../../shared/contracts.js";
import { AthenaError } from "../../runtime/errors.js";
import { optionalNumber, optionalString, requirePositiveInt, requireString } from "../validation.js";

export function parseCreateHarnessProfileRequest(body: Record<string, unknown>): {
  displayName: string;
  version: "v1" | "v2";
  config: {
    provider: string;
    model: string;
    tools: string[];
  };
  policies: {
    timeoutMs: number;
    retryLimit: number;
    budgetUsd: number;
  };
  allowedEgress?: Array<{ host: string; port?: number }>;
  verificationPolicies?: HarnessVerificationPolicy[];
} {
  const allowedEgress = parseAllowedEgressRules(body.allowedEgress);
  const verificationPolicies = parseHarnessVerificationPolicies(body.verificationPolicies);
  return {
    displayName: requireString(body, "displayName", "harnessProfiles.create"),
    version: parseHarnessProfileVersion(body.version),
    config: parseHarnessProfileConfig(body.config),
    policies: parseHarnessProfilePolicies(body.policies),
    ...(allowedEgress ? { allowedEgress } : {}),
    ...(verificationPolicies ? { verificationPolicies } : {})
  };
}

function parseHarnessProfileVersion(value: unknown): "v1" | "v2" {
  if (value === "v1" || value === "v2") {
    return value;
  }
  throw new AthenaError("CONFIG_ERROR", "harnessProfiles.create.version must be 'v1' or 'v2'.");
}

function parseHarnessProfileConfig(value: unknown): {
  provider: string;
  model: string;
  tools: string[];
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("CONFIG_ERROR", "harnessProfiles.create.config must be an object.");
  }
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.tools)) {
    throw new AthenaError("CONFIG_ERROR", "harnessProfiles.create.config.tools must be an array.");
  }
  const tools = row.tools.map((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `harnessProfiles.create.config.tools[${index}] must be a non-empty string.`
      );
    }
    return item.trim();
  });
  if (tools.length === 0) {
    throw new AthenaError("CONFIG_ERROR", "harnessProfiles.create.config.tools must include at least one tool.");
  }
  return {
    provider: requireString(row, "provider", "harnessProfiles.create.config"),
    model: requireString(row, "model", "harnessProfiles.create.config"),
    tools: [...new Set(tools)]
  };
}

function parseHarnessProfilePolicies(value: unknown): {
  timeoutMs: number;
  retryLimit: number;
  budgetUsd: number;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("CONFIG_ERROR", "harnessProfiles.create.policies must be an object.");
  }
  const row = value as Record<string, unknown>;
  const timeoutMs = requirePositiveInt(row, "timeoutMs", "harnessProfiles.create.policies");
  const retryLimit = requirePositiveInt(row, "retryLimit", "harnessProfiles.create.policies");
  const budgetUsd = optionalNumber(row, "budgetUsd", "harnessProfiles.create.policies");
  if (budgetUsd === undefined || budgetUsd < 0) {
    throw new AthenaError("CONFIG_ERROR", "harnessProfiles.create.policies.budgetUsd must be >= 0.");
  }
  return {
    timeoutMs,
    retryLimit,
    budgetUsd
  };
}

function parseHarnessVerificationPolicies(value: unknown): HarnessVerificationPolicy[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new AthenaError("CONFIG_ERROR", "harnessProfiles.create.verificationPolicies must be an array.");
  }
  const parsed: HarnessVerificationPolicy[] = [];
  const seenPolicyIds = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `harnessProfiles.create.verificationPolicies[${index}] must be an object.`
      );
    }
    const row = item as Record<string, unknown>;
    const id = requireString(row, "id", `harnessProfiles.create.verificationPolicies[${index}]`);
    if (seenPolicyIds.has(id)) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `harnessProfiles.create.verificationPolicies contains duplicate id '${id}'.`
      );
    }
    seenPolicyIds.add(id);
    const kind = requireString(row, "kind", `harnessProfiles.create.verificationPolicies[${index}]`);
    if (kind !== "require-evidence") {
      throw new AthenaError(
        "CONFIG_ERROR",
        `harnessProfiles.create.verificationPolicies[${index}].kind is unsupported: ${kind}.`
      );
    }
    const label = requireString(row, "label", `harnessProfiles.create.verificationPolicies[${index}]`);
    const evidenceType = optionalString(
      row,
      "evidenceType",
      `harnessProfiles.create.verificationPolicies[${index}]`
    );
    let normalizedEvidenceType: "text" | "json" | "binary" | undefined;
    if (evidenceType !== undefined) {
      if (evidenceType !== "text" && evidenceType !== "json" && evidenceType !== "binary") {
        throw new AthenaError(
          "CONFIG_ERROR",
          `harnessProfiles.create.verificationPolicies[${index}].evidenceType must be 'text', 'json', or 'binary'.`
        );
      }
      normalizedEvidenceType = evidenceType;
    }
    parsed.push({
      id,
      kind: "require-evidence",
      label,
      ...(normalizedEvidenceType ? { evidenceType: normalizedEvidenceType } : {})
    });
  }
  return parsed;
}

function parseAllowedEgressRules(value: unknown): Array<{ host: string; port?: number }> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new AthenaError("CONFIG_ERROR", "harnessProfiles.create.allowedEgress must be an array.");
  }
  const parsed: Array<{ host: string; port?: number }> = [];
  const seen = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new AthenaError("CONFIG_ERROR", `harnessProfiles.create.allowedEgress[${index}] must be an object.`);
    }
    const row = item as Record<string, unknown>;
    const host = requireString(row, "host", `harnessProfiles.create.allowedEgress[${index}]`).toLowerCase();
    if (!isValidEgressHost(host)) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `harnessProfiles.create.allowedEgress[${index}].host must be a valid domain, wildcard domain, or IPv4 address.`
      );
    }
    const port = row.port;
    let normalizedPort: number | undefined;
    if (port !== undefined) {
      if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
        throw new AthenaError(
          "CONFIG_ERROR",
          `harnessProfiles.create.allowedEgress[${index}].port must be an integer between 1 and 65535.`
        );
      }
      normalizedPort = port;
    }
    const dedupeKey = `${host}:${normalizedPort ?? "*"}`;
    if (seen.has(dedupeKey)) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `harnessProfiles.create.allowedEgress contains duplicate destination '${dedupeKey}'.`
      );
    }
    seen.add(dedupeKey);
    parsed.push({
      host,
      ...(normalizedPort !== undefined ? { port: normalizedPort } : {})
    });
  }
  return parsed.length > 0 ? parsed : undefined;
}

function isValidEgressHost(value: string): boolean {
  if (isIpv4Host(value)) {
    return true;
  }
  if (isHostname(value)) {
    return true;
  }
  if (value.startsWith("*.")) {
    return isHostname(value.slice(2));
  }
  return false;
}

function isIpv4Host(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const parsed = Number.parseInt(part, 10);
    return parsed >= 0 && parsed <= 255;
  });
}

function isHostname(value: string): boolean {
  if (value.length === 0 || value.length > 253) {
    return false;
  }
  if (!/^[a-z0-9.-]+$/.test(value)) {
    return false;
  }
  const labels = value.split(".");
  if (labels.some((label) => label.length === 0 || label.length > 63)) {
    return false;
  }
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
}
