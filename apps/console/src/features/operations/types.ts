import type { OperationsSummary } from "../../services/OperationsApiService";

export type { OperationsSummary };

export interface ProviderTokenPricing {
  provider: string;
  inputCostPer1kTokensUsd: number;
  outputCostPer1kTokensUsd: number;
  updatedAt: string;
}

export interface ProviderCostSettings {
  schemaVersion: 1;
  updatedAt: string;
  providers: ProviderTokenPricing[];
}

export type EventStatus = "success" | "warning" | "error";

export type OperationsEvent = {
  id: string;
  timestamp: string;
  message: string;
  status: EventStatus;
};
