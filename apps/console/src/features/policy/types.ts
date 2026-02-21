export type PolicyDocument = {
  schemaVersion: number;
  updatedAt: string;
  maxConcurrentRuns?: number;
  defaultRunTimeoutMs?: number;
  defaultScheduleTimeoutMs?: number;
  retryBudgetPerRun?: number;
  costBudgetDailyUsd?: number;
};

export type PolicyUpdateRequest = {
  policy: {
    schemaVersion: number;
    maxConcurrentRuns?: number;
    defaultRunTimeoutMs?: number;
    defaultScheduleTimeoutMs?: number;
    retryBudgetPerRun?: number;
    costBudgetDailyUsd?: number;
    updatedAt?: string;
  };
  auditComment: string;
};
