import { describe, expect, it } from "vitest";
import { MockProviderAdapter } from "../src/providers/mock.js";

describe("mock provider", () => {
  it("returns schema-valid persona JSON when trigger is persona:run", async () => {
    const provider = new MockProviderAdapter();
    const result = await provider.generate({
      sessionId: "session-1",
      input: "review this",
      metadata: {
        trigger: "persona:run"
      }
    });

    const parsed = JSON.parse(result.output) as {
      schemaVersion: number;
      mergeGate: string;
      reportMarkdown: string;
      findings: unknown[];
    };

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.mergeGate).toBe("pass");
    expect(parsed.reportMarkdown).toBe("Mock report content...");
    expect(parsed.findings).toEqual([]);
  });

  it("falls back to echo response when persona trigger is not present", async () => {
    const provider = new MockProviderAdapter();
    const result = await provider.generate({
      sessionId: "session-1",
      input: "hello"
    });

    expect(result.output).toBe("Echo: hello");
  });
});
