export type RoleDefinition = {
  name: "Viewer" | "Operator" | "Admin";
  permissions: string[];
};

export type IdentityRoleAssignment = {
  subject: string;
  subjectType: "identity" | "service-token";
  role: "Viewer" | "Operator" | "Admin";
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
};

export type IdentityRoleAuditResult = {
  subject: string;
  role: "Viewer" | "Operator" | "Admin";
  source: "persisted" | "configured" | "default";
  permissions: string[];
  scope: {
    global: boolean;
    personas: string[];
    sessionIds: string[];
    runIds: string[];
  };
  assignment?: IdentityRoleAssignment;
};

export type UpsertIdentityRoleAssignmentRequest = {
  subject: string;
  role: "Viewer" | "Operator" | "Admin";
  subjectType: "identity" | "service-token";
};
