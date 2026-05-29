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
