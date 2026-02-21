import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/shared/config.js";
import { createDefaultProviderRegistry } from "../src/providers/index.js";

describe("provider registry defaults", () => {
  it("registers foundry and openai adapters by default", () => {
    const config = loadConfig();
    const registry = createDefaultProviderRegistry(config);
    expect(registry.get("foundry")).toBeDefined();
    expect(registry.get("openai")).toBeDefined();
  });
});
