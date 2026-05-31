import { describe, expect, it } from "vitest";
import { DOCUMENTATION_CANONICAL_PATH, resolveConsoleRedirect } from "./routeModel";

describe("console route model", () => {
  it("redirects the documentation alias to canonical docs", () => {
    expect(resolveConsoleRedirect("/documentation")).toBe(DOCUMENTATION_CANONICAL_PATH);
  });

  it("does not redirect unrelated paths", () => {
    expect(resolveConsoleRedirect("/docs")).toBeUndefined();
    expect(resolveConsoleRedirect("/tasks")).toBeUndefined();
  });
});
