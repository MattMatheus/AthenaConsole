export type A2aDlqStatus = "pending" | "requeued" | "discarded";

export type A2aDlqItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: A2aDlqStatus;
  reason?: string;
  payload: Record<string, unknown>;
};

export type A2aDlqListQuery = {
  cursor?: string;
  limit?: number;
  status?: A2aDlqStatus;
};

export type A2aDlqListResult = {
  items: A2aDlqItem[];
  nextCursor?: string;
};

export type A2aDlqMutationResult = {
  updated: boolean;
  item?: A2aDlqItem;
};

export type A2aDlqDiscardRequest = {
  auditNote?: string;
};
