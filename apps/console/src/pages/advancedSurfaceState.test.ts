import { describe, expect, it } from "vitest";
import { ApiClientError } from "../services";
import { resolveAdvancedSurfaceNotice } from "./advancedSurfaceState";

describe("advanced surface state", () => {
  it("turns unavailable admin API responses into local-profile notices", () => {
    const notice = resolveAdvancedSurfaceNotice(
      new ApiClientError("Not found", { status: 404 }),
      "failed-work",
    );

    expect(notice).toEqual({
      title: "Failed Work is not available in this local profile",
      body:
        "Failed-work recovery depends on recovery queue APIs that may be disabled when the local server has no recovery backend configured.",
      detail:
        "This does not block the primary local operator loop. You can still create work, run agents, inspect runs, and review artifacts from the main workflow surfaces.",
    });
  });

  it("turns restricted admin API responses into privilege notices", () => {
    const notice = resolveAdvancedSurfaceNotice(
      new ApiClientError("Forbidden", { status: 403 }),
      "rbac",
    );

    expect(notice).toEqual({
      title: "Access Control is restricted",
      body: "This admin surface is present, but the current identity is not allowed to read or change it.",
      detail: "Use a bootstrap or high-privilege administrator identity for this surface.",
    });
  });

  it("leaves ordinary operational errors to page-level error handling", () => {
    const notice = resolveAdvancedSurfaceNotice(
      new ApiClientError("Server failed", { status: 500 }),
      "audit-trail",
    );

    expect(notice).toBeUndefined();
  });
});
