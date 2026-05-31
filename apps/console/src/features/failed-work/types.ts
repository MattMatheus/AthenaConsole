export type FailedWorkStatus = "pending" | "retried" | "discarded";

export type FailedWorkItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: FailedWorkStatus;
  reason?: string;
  payload: Record<string, unknown>;
};

export type FailedWorkListQuery = {
  cursor?: string;
  limit?: number;
  status?: FailedWorkStatus;
};

export type FailedWorkListResult = {
  items: FailedWorkItem[];
  nextCursor?: string;
};

export type FailedWorkMutationResult = {
  updated: boolean;
  item?: FailedWorkItem;
};

export type FailedWorkDiscardRequest = {
  auditNote?: string;
};
