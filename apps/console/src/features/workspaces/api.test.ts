import { describe, expect, it } from "vitest";
import { parseWorkspace } from "./api";

describe("workspace api parser", () => {
  it("normalizes workspace payloads", () => {
    expect(
      parseWorkspace({
        id: "workspace-alpha",
        name: "Workspace Alpha",
        slug: "workspace-alpha",
      }),
    ).toEqual({
      id: "workspace-alpha",
      name: "Workspace Alpha",
      slug: "workspace-alpha",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    });
  });

  it("rejects invalid workspace payloads", () => {
    expect(() => parseWorkspace({ id: "workspace-alpha" })).toThrow("Workspace payload is invalid.");
  });
});
