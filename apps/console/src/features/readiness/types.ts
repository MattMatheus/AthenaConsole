export type ReadinessStatus = "ready" | "degraded" | "not-ready";
export type ReadinessCheckStatus = "ok" | "degraded" | "failed";
export type ReadinessCheckCategory =
  | "api"
  | "app-state"
  | "storage"
  | "repos"
  | "plugins"
  | "providers"
  | "runtime"
  | "security"
  | "sample-demo";

export type ReadinessSummary = {
  ready: boolean;
  requiredFailed: number;
  degraded: number;
  optionalUnavailable: number;
};

export type ReadinessCheck = {
  id: string;
  label: string;
  category: ReadinessCheckCategory;
  status: ReadinessCheckStatus;
  required: boolean;
  message: string;
  nextStep: string;
  details: Record<string, string | number | boolean>;
};

export type ReadinessReport = {
  status: ReadinessStatus;
  generatedAt: string;
  summary: ReadinessSummary;
  checks: ReadinessCheck[];
};
