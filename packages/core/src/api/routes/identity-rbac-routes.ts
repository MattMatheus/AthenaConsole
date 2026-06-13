import { parseGovernanceAuditHistoryQuery, parseIdentityAssignmentUpsertRequest } from "../request-parsers/index.js";
import type { RouteParams } from "../router.js";
import { readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";
import { simulateRbacRole } from "../../control-plane/rbac.js";
import type { AthenaRbacRole } from "../../shared/contracts.js";

export const RBAC_ROUTES = defineApiRoutes("identity-rbac", [
  { method: "GET", path: "/api/v1/rbac/roles", handler: handleListRbacRolesRoute },
  { method: "GET", path: "/api/v1/rbac/simulate", handler: handleSimulateRbacRoleRoute },
  { method: "GET", path: "/api/v1/rbac/assignments", handler: handleListIdentityRoleAssignmentsRoute },
  { method: "PUT", path: "/api/v1/rbac/assignments/:subject", handler: handleUpsertIdentityRoleAssignmentRoute },
  { method: "DELETE", path: "/api/v1/rbac/assignments/:subject", handler: handleDeleteIdentityRoleAssignmentRoute },
  { method: "GET", path: "/api/v1/rbac/audit/:subject", handler: handleAuditIdentityPermissionsRoute },
  { method: "GET", path: "/api/v1/governance/audit-trail", handler: handleListGovernanceAuditTrailRoute },
  { method: "GET", path: "/api/v1/governance/audit-trail/export.jsonl", handler: handleExportGovernanceAuditTrailJsonlRoute },
  { method: "GET", path: "/api/v1/governance/audit-trail/export.csv", handler: handleExportGovernanceAuditTrailCsvRoute }
]);

async function handleListRbacRolesRoute(context: ApiRouteContext): Promise<void> {
  const items = await context.services.identityService.listRoles();
  writeSuccess(context.res, "listRbacRoles", 200, { items });
}

async function handleSimulateRbacRoleRoute(context: ApiRouteContext): Promise<void> {
  await context.services.identityService.listRoles();
  const role = parseRoleParam(context.requestUrl.searchParams.get("role"));
  writeSuccess(context.res, "simulateRbacRole", 200, simulateRbacRole(role));
}

async function handleListIdentityRoleAssignmentsRoute(context: ApiRouteContext): Promise<void> {
  const items = await context.services.identityService.listAssignments();
  writeSuccess(context.res, "listIdentityRoleAssignments", 200, { items });
}

async function handleUpsertIdentityRoleAssignmentRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const body = await readJson(context.req);
  const parsed = parseIdentityAssignmentUpsertRequest(body);
  const subject = decodeRouteParam(params, "subject");
  const updatedBy = parsed.updatedBy ?? context.auth?.subject;
  const assignment = await context.services.identityService.upsertAssignment(
    updatedBy
      ? {
          subject,
          role: parsed.role,
          subjectType: parsed.subjectType,
          updatedBy
        }
      : {
          subject,
          role: parsed.role,
          subjectType: parsed.subjectType
        }
  );
  writeSuccess(context.res, "upsertIdentityRoleAssignment", 200, assignment);
}

async function handleDeleteIdentityRoleAssignmentRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const subject = decodeRouteParam(params, "subject");
  const result = await context.services.identityService.removeAssignment(subject);
  writeSuccess(context.res, "deleteIdentityRoleAssignment", 200, result);
}

async function handleAuditIdentityPermissionsRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const subject = decodeRouteParam(params, "subject");
  const result = await context.services.identityService.auditPermissions(subject);
  writeSuccess(context.res, "auditIdentityPermissions", 200, result);
}

async function handleListGovernanceAuditTrailRoute(context: ApiRouteContext): Promise<void> {
  const query = parseGovernanceAuditHistoryQuery(context.requestUrl);
  const result = await context.services.governanceAuditService.list(query);
  writeSuccess(context.res, "listGovernanceAuditTrail", 200, result);
}

async function handleExportGovernanceAuditTrailJsonlRoute(context: ApiRouteContext): Promise<void> {
  const query = parseGovernanceAuditHistoryQuery(context.requestUrl);
  const body = await context.services.governanceAuditService.exportJsonl(query);
  context.res.writeHead(200, {
    "content-type": "application/x-ndjson; charset=utf-8"
  });
  context.res.end(body);
}

async function handleExportGovernanceAuditTrailCsvRoute(context: ApiRouteContext): Promise<void> {
  const query = parseGovernanceAuditHistoryQuery(context.requestUrl);
  const body = await context.services.governanceAuditService.exportCsv(query);
  context.res.writeHead(200, {
    "content-type": "text/csv; charset=utf-8"
  });
  context.res.end(body);
}

function decodeRouteParam(params: RouteParams, key: string): string {
  const value = params[key];
  if (!value || value.length === 0) {
    throw new Error(`Missing route param: ${key}`);
  }
  return decodeURIComponent(value);
}

function parseRoleParam(value: string | null): AthenaRbacRole {
  if (value === "Viewer" || value === "Operator" || value === "Admin") {
    return value;
  }
  return "Viewer";
}
