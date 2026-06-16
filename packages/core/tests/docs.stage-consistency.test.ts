import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("current docs consistency", () => {
  it("keeps the current operator docs map aligned with live docs", () => {
    const root = resolve(process.cwd(), "..", "..");
    const agents = readFileSync(resolve(root, "AGENTS.md"), "utf8");
    const readme = readFileSync(resolve(root, "docs", "README.md"), "utf8");
    const gettingStarted = readFileSync(resolve(root, "GETTING_STARTED.md"), "utf8");

    expect(existsSync(resolve(root, "docs", "getting-started", "README.md"))).toBe(false);
    expect(existsSync(resolve(root, "IMPLEMENT.MD"))).toBe(false);
    expect(agents).toContain("docs/product/direction/current-direction.md");
    expect(readme).toContain("[Getting Started](../GETTING_STARTED.md)");
    expect(readme).toContain("[User Guide](user-guide/README.md)");
    expect(gettingStarted).toContain("first-run demo");
    expect(gettingStarted).toContain("http://127.0.0.1:5173/workflows");
  });
});
