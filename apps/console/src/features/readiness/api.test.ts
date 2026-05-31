import { describe, expect, it } from "vitest";
import { parseReadinessReport } from "./api";

describe("readiness api model", () => {
  it("normalizes readiness reports for first-run empty states", () => {
    const report = parseReadinessReport({
      status: "degraded",
      generatedAt: "2026-05-28T12:00:00.000Z",
      summary: {
        ready: false,
        requiredFailed: 0,
        degraded: 1,
        optionalUnavailable: 1,
      },
      lanes: [
        {
          id: "first-run-demo",
          label: "First-run demo",
          status: "ready",
          message: "The credential-free first-run demo can run now.",
          nextStep: "Open Workflows.",
          checkIds: ["api", "sample-demo", 12],
        },
        {
          id: "unknown-lane",
          label: "Unknown",
          status: "unknown-status",
          message: "Unknown.",
          nextStep: "Unknown.",
          checkIds: [],
        },
      ],
      checks: [
        {
          id: "artifact-storage",
          label: "Artifact storage",
          category: "storage",
          status: "degraded",
          required: true,
          message: "Artifact roots are not writable.",
          nextStep: "Fix host volume ownership.",
          details: {
            artifactStoreCount: 1,
            writableArtifactStores: 0,
            ignoredSecret: ["nope"],
          },
        },
      ],
    });

    expect(report.status).toBe("degraded");
    expect(report.summary.optionalUnavailable).toBe(1);
    expect(report.lanes).toEqual([
      {
        id: "first-run-demo",
        label: "First-run demo",
        status: "ready",
        message: "The credential-free first-run demo can run now.",
        nextStep: "Open Workflows.",
        checkIds: ["api", "sample-demo"],
      },
      {
        id: "first-run-demo",
        label: "Unknown",
        status: "blocked",
        message: "Unknown.",
        nextStep: "Unknown.",
        checkIds: [],
      },
    ]);
    expect(report.checks[0]).toMatchObject({
      id: "artifact-storage",
      category: "storage",
      status: "degraded",
      required: true,
      details: {
        artifactStoreCount: 1,
        writableArtifactStores: 0,
      },
    });
    expect(report.checks[0]?.details).not.toHaveProperty("ignoredSecret");
  });
});
