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
          id: "sample-demo",
          label: "Sample demo",
          category: "sample-demo",
          status: "degraded",
          required: false,
          message: "No demo workflow templates are loaded.",
          nextStep: "Refresh the workflow catalog after the sample plugin is available.",
          details: {
            totalWorkflowTemplates: 0,
            availableWorkflowTemplates: 0,
            ignoredSecret: ["nope"],
          },
        },
      ],
    });

    expect(report.status).toBe("degraded");
    expect(report.summary.optionalUnavailable).toBe(1);
    expect(report.checks[0]).toMatchObject({
      id: "sample-demo",
      category: "sample-demo",
      status: "degraded",
      required: false,
      details: {
        totalWorkflowTemplates: 0,
        availableWorkflowTemplates: 0,
      },
    });
    expect(report.checks[0]?.details).not.toHaveProperty("ignoredSecret");
  });
});
