import type { ReadinessCheck, ReadinessLane, ReadinessReport } from "./types";

export type DashboardReadinessTone = "ready" | "degraded" | "blocked" | "checking" | "unavailable";

export function firstRunDemoLane(readiness: ReadinessReport | undefined): ReadinessLane | undefined {
  return readiness?.lanes.find((lane) => lane.id === "first-run-demo");
}

export function dashboardReadinessTone(readiness: ReadinessReport | undefined, isLoading: boolean): DashboardReadinessTone {
  if (isLoading) {
    return "checking";
  }
  if (!readiness) {
    return "unavailable";
  }
  const demoLane = firstRunDemoLane(readiness);
  if (readiness.summary.requiredFailed > 0 || demoLane?.status === "blocked") {
    return "blocked";
  }
  if (demoLane?.status === "ready") {
    return "ready";
  }
  return "degraded";
}

export function dashboardReadinessLabel(readiness: ReadinessReport | undefined, isLoading: boolean): string {
  const tone = dashboardReadinessTone(readiness, isLoading);
  if (tone === "checking") {
    return "checking";
  }
  if (tone === "unavailable") {
    return "unavailable";
  }
  if (tone === "blocked") {
    return "required setup blocked";
  }
  if (tone === "ready") {
    return "demo ready";
  }
  return "demo needs attention";
}

export function dashboardReadinessMessage(readiness: ReadinessReport | undefined, error: Error | null): string {
  if (error) {
    return error.message;
  }
  if (!readiness) {
    return "Readiness checks are unavailable until the API responds.";
  }
  if (readiness.summary.requiredFailed > 0) {
    return "Required local services are blocked. Fix failed readiness checks before running work.";
  }
  return firstRunDemoLane(readiness)?.message ?? "Readiness checks are available.";
}

export function checksForLane(readiness: ReadinessReport | undefined, lane: ReadinessLane): ReadinessCheck[] {
  const checks = readiness?.checks ?? [];
  return lane.checkIds.map((id) => checks.find((check) => check.id === id)).filter((check): check is ReadinessCheck => check !== undefined);
}
