import { AthenaError } from "../../runtime/errors.js";
import type { AthenaRbacRole, IdentitySubjectType } from "../../shared/contracts.js";
import { optionalString, requireString } from "../validation.js";

const VALID_ROLES = new Set<AthenaRbacRole>(["Viewer", "Operator", "Admin"]);
const VALID_SUBJECT_TYPES = new Set<IdentitySubjectType>(["identity", "service-token"]);

export function parseIdentityAssignmentUpsertRequest(body: Record<string, unknown>): {
  role: AthenaRbacRole;
  subjectType: IdentitySubjectType;
  updatedBy?: string;
} {
  const role = requireString(body, "role", "rbac.assignments.upsert");
  if (!VALID_ROLES.has(role as AthenaRbacRole)) {
    throw new AthenaError("CONFIG_ERROR", "rbac.assignments.upsert.role must be Viewer|Operator|Admin.");
  }
  const subjectTypeRaw = optionalString(body, "subjectType", "rbac.assignments.upsert");
  const subjectType = (subjectTypeRaw ?? "identity") as IdentitySubjectType;
  if (!VALID_SUBJECT_TYPES.has(subjectType)) {
    throw new AthenaError("CONFIG_ERROR", "rbac.assignments.upsert.subjectType must be identity|service-token.");
  }
  const updatedBy = optionalString(body, "updatedBy", "rbac.assignments.upsert");
  return {
    role: role as AthenaRbacRole,
    subjectType,
    ...(updatedBy ? { updatedBy } : {})
  };
}
