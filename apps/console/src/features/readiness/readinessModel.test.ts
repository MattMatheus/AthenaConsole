import { describe, expect, it } from "vitest";
import {
  checksForLane,
  dashboardReadinessLabel,
  dashboardReadinessMessage,
  dashboardReadinessTone,
  firstRunDemoLane,
} from "./readinessModel";
import type { ReadinessReport } from "./types";

describe("dashboard readiness model", () => {
  it("treats degraded provider/server warnings as demo-ready when demo lane is ready", () => {
    const report = readinessReport({
      requiredFailed: 0,
      lanes: [
        {
          id: "first-run-demo",
          label: "First-run demo",
          status: "ready",
          message: "The credential-free first-run demo can run now.",
          nextStep: "Open Workflows.",
          checkIds: ["sample-demo"],
        },
        {
          id: "provider-setup",
          label: "Model-backed agents",
          status: "degraded",
          message: "Provider setup is optional for the demo.",
          nextStep: "Open Settings.",
          checkIds: ["model-providers"],
        },
      ],
    });

    expect(firstRunDemoLane(report)?.status).toBe("ready");
    expect(dashboardReadinessTone(report, false)).toBe("ready");
    expect(dashboardReadinessLabel(report, false)).toBe("demo ready");
    expect(dashboardReadinessMessage(report, null)).toBe("The credential-free first-run demo can run now.");
  });

  it("keeps required failures prominent even if lane messages exist", () => {
    const report = readinessReport({
      requiredFailed: 1,
      lanes: [
        {
          id: "first-run-demo",
          label: "First-run demo",
          status: "blocked",
          message: "Required local services are blocked before the demo can run.",
          nextStep: "Fix app-state.",
          checkIds: ["app-state"],
        },
      ],
    });

    expect(dashboardReadinessTone(report, false)).toBe("blocked");
    expect(dashboardReadinessLabel(report, false)).toBe("required setup blocked");
    expect(dashboardReadinessMessage(report, null)).toBe(
      "Required local services are blocked. Fix failed readiness checks before running work.",
    );
  });

  it("maps lane check ids to visible checks", () => {
    const report = readinessReport({
      requiredFailed: 0,
      lanes: [
        {
          id: "server-hardening",
          label: "Server hardening",
          status: "degraded",
          message: "Server deployment hardening still has warnings.",
          nextStep: "Enable auth.",
          checkIds: ["server-exposure", "missing"],
        },
      ],
    });

    expect(checksForLane(report, report.lanes[0]!).map((check) => check.id)).toEqual(["server-exposure"]);
  });
});

function readinessReport(input: { requiredFailed: number; lanes: ReadinessReport["lanes"] }): ReadinessReport {
  return {
    status: input.requiredFailed > 0 ? "not-ready" : "degraded",
    generatedAt: "2026-05-31T00:00:00.000Z",
    summary: {
      ready: input.requiredFailed === 0,
      requiredFailed: input.requiredFailed,
      degraded: 1,
      optionalUnavailable: 1,
    },
    lanes: input.lanes,
    checks: [
      {
        id: "sample-demo",
        label: "Sample/demo workflow",
        category: "sample-demo",
        status: "ok",
        required: false,
        message: "Ready.",
        nextStep: "Open Workflows.",
        details: {},
      },
      {
        id: "server-exposure",
        label: "Server exposure",
        category: "security",
        status: "degraded",
        required: true,
        message: "External unauthenticated override is enabled.",
        nextStep: "Enable auth.",
        details: {},
      },
    ],
  };
}
