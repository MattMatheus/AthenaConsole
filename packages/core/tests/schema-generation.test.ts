import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("generated component schemas", () => {
  it("are up to date with shared contracts", () => {
    const thisDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
    const repoRoot = resolve(thisDir, "..");
    const result = spawnSync(process.execPath, ["scripts/generate-api-component-schemas.mjs", "--check"], {
      cwd: repoRoot,
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
  });
});
