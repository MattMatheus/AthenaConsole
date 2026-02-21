import { describe, expect, it } from "vitest";
import { compileContext, truncateOversizedToolResults, type ContextMessage } from "../src/context/index.js";

describe("context compiler", () => {
  it("keeps raw strategy deterministic", () => {
    const messages: ContextMessage[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "world" }
    ];

    const one = compileContext({
      strategy: "raw",
      messages,
      maxChars: 4000,
      reserveChars: 200,
      summaryMaxChars: 1000
    });
    const two = compileContext({
      strategy: "raw",
      messages,
      maxChars: 4000,
      reserveChars: 200,
      summaryMaxChars: 1000
    });

    expect(one.content).toBe("user: hello\n\nassistant: world");
    expect(two.content).toBe(one.content);
    expect(one.stats.overflow).toBe(false);
  });

  it("compacts with summary strategy when over budget", () => {
    const messages: ContextMessage[] = [
      { role: "user", content: "a".repeat(900) },
      { role: "assistant", content: "b".repeat(900) },
      { role: "user", content: "current task" }
    ];

    const result = compileContext({
      strategy: "summary",
      messages,
      maxChars: 1700,
      reserveChars: 200,
      summaryMaxChars: 220
    });

    expect(result.content).toContain("system: Prior conversation summary");
    expect(result.content).toContain("user: current task");
    expect(result.stats.overflow).toBe(false);
  });

  it("truncates oversized tool results only", () => {
    const messages: ContextMessage[] = [
      { role: "assistant", kind: "tool-call", content: "calling read_file" },
      { role: "tool", kind: "tool-result", content: "x".repeat(600) },
      { role: "user", content: "next" }
    ];

    const result = truncateOversizedToolResults(messages, 250);
    expect(result.truncatedCount).toBe(1);
    expect(result.messages[1]?.content.length).toBeLessThanOrEqual(260);
    expect(result.messages[2]?.content).toBe("next");
  });
});
