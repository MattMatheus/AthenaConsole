import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/shared/config.js";
import { createDefaultProviderRegistry } from "../src/providers/index.js";

describe("provider registry defaults", () => {
  it("registers openai adapter by default", () => {
    const config = loadConfig();
    const registry = createDefaultProviderRegistry(config);
    expect(registry.get("openai")).toBeDefined();
  });
});
