import { describe, expect, it } from "vitest";
import { connectedRepositoryReadinessMessage, mergeConnectedRepositoryContext } from "./repoContext";
import type { ConnectedRepository } from "./types";

describe("connected repository context", () => {
  it("adds structured repo context and repoPath compatibility input", () => {
    expect(
      mergeConnectedRepositoryContext({ objective: "Summarize" }, repository({ status: "ready" })),
    ).toEqual({
      objective: "Summarize",
      repoPath: "/workspace/repo",
      repo: {
        id: "repo-docs",
        name: "Docs",
        sourceType: "existing-path",
        workspacePath: "/workspace/repo",
        hostPath: "/host/repo",
        currentBranch: "main",
        headCommit: "abc123",
        dirtyState: "clean",
        status: "ready",
      },
    });
  });

  it("does not overwrite explicit repoPath inputs", () => {
    expect(
      mergeConnectedRepositoryContext({ repoPath: "/custom/path" }, repository({ status: "ready" })).repoPath,
    ).toBe("/custom/path");
  });

  it("reports non-ready repository selections before work starts", () => {
    expect(connectedRepositoryReadinessMessage(repository({ status: "missing" }))).toBe(
      "Selected repository is missing. Inspect or fix it before starting ready work.",
    );
    expect(connectedRepositoryReadinessMessage(repository({ status: "ready" }))).toBeUndefined();
  });
});

function repository(overrides: Partial<ConnectedRepository>): ConnectedRepository {
  return {
    id: "repo-docs",
    name: "Docs",
    sourceType: "existing-path",
    workspacePath: "/workspace/repo",
    hostPath: "/host/repo",
    currentBranch: "main",
    headCommit: "abc123",
    dirtyState: "clean",
    status: "ready",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
