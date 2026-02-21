import type { IncomingMessage } from "node:http";
import { createIdentityRoleResolver, type RequestAuthContext, type ScopeSet } from "../../control-plane/auth.js";
import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";

export interface IdentityExtractionMiddleware {
  extract(req: IncomingMessage): RequestAuthContext | undefined;
}

export function createIdentityExtractionMiddleware(config: AthenaConfig): IdentityExtractionMiddleware {
  const roleResolver = createIdentityRoleResolver(config);
  const authConfig = config.auth;
  if (!authConfig?.enabled) {
    return {
      extract(): undefined {
        return undefined;
      }
    };
  }

  const headerName = authConfig.identityHeader.toLowerCase();
  return {
    extract(req: IncomingMessage): RequestAuthContext {
      const headerValue = req.headers[headerName];
      const subject = parseIdentityHeaderValue(headerValue);
      if (!subject) {
        throw new AthenaError("AUTH_IDENTITY_MISSING", `Missing required header: ${headerName}.`);
      }
      const resolved = roleResolver.resolve(subject);
      return {
        ...resolved,
        scope: parseScopeHeaders(req.headers, resolved.role === "Admin")
      };
    }
  };
}

function parseIdentityHeaderValue(headerValue: string | string[] | undefined): string | undefined {
  if (Array.isArray(headerValue)) {
    const first = headerValue.find((value) => value.trim().length > 0);
    return first?.trim();
  }
  if (typeof headerValue !== "string") {
    return undefined;
  }
  const first = headerValue
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return first;
}

function parseScopeHeaders(headers: IncomingMessage["headers"], adminGlobal: boolean): ScopeSet {
  const personas = parseScopeList(headers["x-athena-scope-personas"]);
  const sessionIds = parseScopeList(headers["x-athena-scope-sessions"]);
  const runIds = parseScopeList(headers["x-athena-scope-runs"]);
  const globalHeader = parseScopeGlobal(headers["x-athena-scope-global"]);
  return {
    global: adminGlobal || globalHeader,
    personas,
    sessionIds,
    runIds
  };
}

function parseScopeGlobal(value: string | string[] | undefined): boolean {
  const normalized = parseIdentityHeaderValue(value)?.toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

function parseScopeList(value: string | string[] | undefined): string[] {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  const scopes = new Set<string>();
  for (const entry of rawValues) {
    for (const token of entry.split(",")) {
      const normalized = token.trim();
      if (normalized.length > 0) {
        scopes.add(normalized);
      }
    }
  }
  return [...scopes];
}
