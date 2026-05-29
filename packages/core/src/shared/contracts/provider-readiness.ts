import type { ModelProviderKind } from "./model-providers.js";

export type ProviderReadinessStatus = "configured" | "missing" | "invalid" | "untested";

export interface ModelProviderRequirement {
  required: boolean;
  providerKind?: ModelProviderKind;
  providerId?: string;
  model?: string;
  label?: string;
}

export interface ProviderReadiness {
  status: ProviderReadinessStatus;
  required: boolean;
  requirements: ModelProviderRequirement[];
  providerId?: string;
  providerName?: string;
  providerKind?: ModelProviderKind;
  model?: string;
  message: string;
}
