export type GovernanceAuditCategory = "policy" | "rbac-role" | "identity-assignment";

export type GovernanceAuditDiffField = {
  key: string;
  label: string;
  before?: string;
  after?: string;
};

export type GovernanceAuditEntry = {
  id: string;
  eventId: string;
  category: GovernanceAuditCategory;
  action: string;
  timestamp: string;
  actor: {
    subject: string;
    role?: string;
  };
  reason?: string;
  summary: string;
  diffs: GovernanceAuditDiffField[];
};

export type GovernanceAuditHistoryResult = {
  items: GovernanceAuditEntry[];
  nextCursor?: string;
};

export type GovernanceAuditHistoryQuery = {
  cursor?: string;
  limit?: number;
  actor?: string;
  categories?: GovernanceAuditCategory[];
  createdAfter?: string;
  createdBefore?: string;
};
