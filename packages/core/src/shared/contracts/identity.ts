import type { AthenaRbacRole } from "./base.js";

export type IdentitySubjectType = "identity" | "service-token";

export interface RbacRoleDefinition {
  name: AthenaRbacRole;
  permissions: string[];
}

export interface IdentityRoleAssignment {
  subject: string;
  subjectType: IdentitySubjectType;
  role: AthenaRbacRole;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface IdentityRoleAssignmentUpsertRequest {
  subject: string;
  subjectType: IdentitySubjectType;
  role: AthenaRbacRole;
  updatedBy?: string;
}

export interface IdentityRoleAuditResult {
  subject: string;
  role: AthenaRbacRole;
  source: "persisted" | "configured" | "default";
  permissions: string[];
  scope: {
    global: boolean;
    personas: string[];
    sessionIds: string[];
    runIds: string[];
  };
  assignment?: IdentityRoleAssignment;
}
