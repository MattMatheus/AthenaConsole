import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("athena-prime specialist manifest", () => {
  it("keeps id aligned with folder", () => {
    const manifestPath = resolve(import.meta.dirname, "..", "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { id?: string };
    expect(manifest.id).toBe("athena-prime");
  });
});
