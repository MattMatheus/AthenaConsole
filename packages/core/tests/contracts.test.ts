import { describe, expect, it } from "vitest";
import { compileContext } from "../src/context/index.js";
import { createInMemoryStore } from "../src/memory/index.js";

describe("stage-0 baseline contracts", () => {
  it("exposes distill placeholder", () => {
    const result = compileContext({
      strategy: "distill",
      messages: [
        { role: "user", content: "a" },
        { role: "assistant", content: "b" }
      ],
      maxChars: 4000,
      reserveChars: 500,
      summaryMaxChars: 1200
    });

    expect(result.strategy).toBe("distill");
    expect(result.notes).toContain("placeholder");
    expect(result.stats.inputChars).toBeGreaterThan(0);
  });

  it("supports basic in-memory search", () => {
    const store = createInMemoryStore();
    store.add({
      id: "1",
      sourcePath: "memory/test.md",
      content: "hello athena",
      createdAt: new Date().toISOString()
    });

    const results = store.search("athena");
    expect(results.length).toBe(1);
    expect(results[0]?.sourcePath).toBe("memory/test.md");
  });
});
