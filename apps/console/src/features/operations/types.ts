import type { ProviderCostSettings } from "@athena/core/control-plane/api-contracts";
import type { OperationsSummary } from "../../services/OperationsApiService";

export type { OperationsSummary, ProviderCostSettings };

export type EventStatus = "success" | "warning" | "error";

export type OperationsEvent = {
  id: string;
  timestamp: string;
  message: string;
  status: EventStatus;
};
