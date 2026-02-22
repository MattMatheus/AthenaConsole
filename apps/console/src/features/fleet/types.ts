import type { FleetSummary, ProviderCostSettings } from "@athena/core/control-plane/api-contracts";

export type { FleetSummary, ProviderCostSettings };

export type EventStatus = "success" | "warning" | "error";

export type FleetEvent = {
  id: string;
  timestamp: string;
  message: string;
  status: EventStatus;
};
