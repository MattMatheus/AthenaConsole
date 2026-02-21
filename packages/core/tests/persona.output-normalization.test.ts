import { describe, expect, it } from "vitest";
import { normalizePersonaOutput, type PersonaModelExecutionResult } from "../src/personas/run.js";

describe("persona output normalization", () => {
  it("normalizes parsed output and applies dependency inspection overrides", () => {
    const execution: PersonaModelExecutionResult = {
      modelOutputRaw: "{\"schemaVersion\":1}",
      status: "ok",
      parseRetryAttempted: false,
      parsed: {
        parsed: {
          schemaVersion: 1,
          mergeGate: "fail",
          reportMarkdown: "# report",
          findings: [{ priority: "P1", confidence: 0.9, title: "critical", message: "fix now" }],
          dependencyInspection: {
            status: "skipped",
            notes: ["model note"]
          }
        }
      }
    };

    const normalized = normalizePersonaOutput({
      execution,
      dependencyInspection: {
        status: "ok",
        notes: ["computed note"],
        detectedEcosystem: "npm"
      }
    });

    expect(normalized.reportMarkdown).toBe("# report");
    expect(normalized.findings).toHaveLength(1);
    expect(normalized.mergeGate).toBe("fail");
    expect(normalized.modelOutputParsed).toBe(true);
    expect(normalized.parseRetryAttempted).toBe(false);
    expect(normalized.dependencyInspection).toMatchObject({
      status: "skipped",
      notes: ["model note"],
      detectedEcosystem: "npm"
    });
  });

  it("falls back to raw output and parse error when parsing fails", () => {
    const execution: PersonaModelExecutionResult = {
      modelOutputRaw: "bad output",
      status: "failed",
      parseRetryAttempted: true,
      parsed: {
        error: "parse failed"
      }
    };

    const normalized = normalizePersonaOutput({
      execution,
      dependencyInspection: { status: "ok" }
    });

    expect(normalized.reportMarkdown).toBe("bad output");
    expect(normalized.findings).toEqual([]);
    expect(normalized.mergeGate).toBe("pass");
    expect(normalized.modelOutputParsed).toBe(false);
    expect(normalized.parseRetryAttempted).toBe(true);
    expect(normalized.parseError).toBe("parse failed");
  });
});
