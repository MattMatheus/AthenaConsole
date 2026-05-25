import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/shared/config.js";
import { createDefaultProviderRegistry } from "../src/providers/index.js";

describe("provider registry defaults", () => {
  it("registers local-first providers by default", () => {
    const config = loadConfig();
    const registry = createDefaultProviderRegistry(config);
    expect(registry.get("mock")).toBeDefined();
    expect(registry.get("openai")).toBeDefined();
    expect(registry.get("local-exec")).toBeDefined();
  });
});
