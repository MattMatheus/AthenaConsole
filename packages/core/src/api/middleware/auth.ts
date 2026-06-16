import type { IncomingMessage } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  createIdentityRoleResolver,
  normalizeAuthSubject,
  type RequestAuthContext,
  type ScopeSet,
  type WorkspaceMembership
} from "../../control-plane/auth.js";
import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";

export interface IdentityExtractionMiddleware {
  extract(req: IncomingMessage): Promise<RequestAuthContext | undefined>;
}

export interface IdentityExtractionMiddlewareOptions {
  resolveWorkspaceMemberships?: (subject: string) => Promise<WorkspaceMembership[]>;
}

export function createIdentityExtractionMiddleware(
  config: AthenaConfig,
  options: IdentityExtractionMiddlewareOptions = {}
): IdentityExtractionMiddleware {
  const roleResolver = createIdentityRoleResolver(config);
  const authConfig = config.auth;
  if (!authConfig?.enabled) {
    return {
      async extract(): Promise<undefined> {
        return undefined;
      }
    };
  }

  const headerName = authConfig.identityHeader.toLowerCase();
  return {
    async extract(req: IncomingMessage): Promise<RequestAuthContext> {
      if (authConfig.apiToken) {
        assertValidApiToken(req, authConfig.apiToken);
      }
      const headerValue = req.headers[headerName];
      const subject = parseIdentityHeaderValue(headerValue);
      if (!subject) {
        throw new AthenaError("AUTH_IDENTITY_MISSING", `Missing required header: ${headerName}.`);
      }
      const resolved = roleResolver.resolve(subject);
      const memberships = await resolveMemberships(resolved, options);
      return {
        ...resolved,
        workspaceMemberships: memberships,
        scope: parseScopeHeaders(req.headers, {
          adminGlobal: resolved.role === "Admin",
          memberships
        })
      };
    }
  };
}

async function resolveMemberships(
  context: RequestAuthContext,
  options: IdentityExtractionMiddlewareOptions
): Promise<WorkspaceMembership[]> {
  if (context.role === "Admin") {
    return [];
  }
  const resolver = options.resolveWorkspaceMemberships;
  if (!resolver) {
    return [];
  }
  return resolver(context.subject);
}

function assertValidApiToken(req: IncomingMessage, expectedToken: string): void {
  const authorization = parseIdentityHeaderValue(req.headers.authorization);
  const bearerToken = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : undefined;
  const token = bearerToken ?? parseIdentityHeaderValue(req.headers["x-athena-api-token"]);
  if (!token) {
    throw new AthenaError("AUTH_TOKEN_MISSING", "Missing required API bearer token.");
  }
  if (!constantTimeEquals(token, expectedToken)) {
    throw new AthenaError("AUTH_TOKEN_INVALID", "Invalid API bearer token.");
  }
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash) && left.length === right.length;
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

function parseScopeHeaders(
  headers: IncomingMessage["headers"],
  options: { adminGlobal: boolean; memberships: WorkspaceMembership[] }
): ScopeSet {
  const agents = parseScopeList(headers["x-athena-scope-agents"]);
  const sessionIds = parseScopeList(headers["x-athena-scope-sessions"]);
  const runIds = parseScopeList(headers["x-athena-scope-runs"]);
  const requestedWorkspaces = parseScopeList(headers["x-athena-scope-workspaces"]);
  const workspaces = resolveWorkspaceScope(requestedWorkspaces, options);
  return {
    global: options.adminGlobal,
    agents,
    sessionIds,
    runIds,
    workspaces
  };
}

function resolveWorkspaceScope(
  requestedWorkspaces: string[],
  options: { adminGlobal: boolean; memberships: WorkspaceMembership[] }
): string[] {
  if (options.adminGlobal) {
    return requestedWorkspaces;
  }
  const allowed = [...new Set(options.memberships.map((membership) => membership.workspaceId))];
  if (requestedWorkspaces.length === 0) {
    return allowed;
  }
  const allowedSet = new Set(allowed);
  const unauthorized = requestedWorkspaces.find((workspaceId) => !allowedSet.has(workspaceId));
  if (unauthorized) {
    throw new AthenaError("AUTHZ_DENIED", `Forbidden: workspace '${unauthorized}' is outside allowed membership scope.`);
  }
  return requestedWorkspaces;
}

function parseScopeList(value: string | string[] | undefined): string[] {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  const scopes = new Set<string>();
  for (const entry of rawValues) {
    for (const token of entry.split(",")) {
      const normalized = token.trim();
      if (normalized.length > 0) {
        scopes.add(normalizeAuthSubject(normalized));
      }
    }
  }
  return [...scopes];
}
