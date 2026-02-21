export type GovernanceAuditChangeCategory = "policy" | "rbac-role" | "identity-assignment";

export interface GovernanceAuditDiffField {
  key: string;
  label: string;
  before?: string;
  after?: string;
}

export interface GovernanceAuditActor {
  subject: string;
  role?: string;
}

export interface GovernanceAuditEntry {
  id: string;
  eventId: string;
  category: GovernanceAuditChangeCategory;
  action: string;
  timestamp: string;
  actor: GovernanceAuditActor;
  reason?: string;
  summary: string;
  diffs: GovernanceAuditDiffField[];
}

export interface GovernanceAuditHistoryQuery {
  cursor?: string;
  limit?: number;
  actor?: string;
  categories?: GovernanceAuditChangeCategory[];
  createdAfter?: string;
  createdBefore?: string;
}

export interface GovernanceAuditHistoryResult {
  items: GovernanceAuditEntry[];
  nextCursor?: string;
}
