import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("eval suite and result store", () => {
  it("persists eval suites, runs, provenance, results, and failure detail", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-evals-store-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        const suite = appState.evals.createSuite({
          id: "suite-software-team-golden",
          name: "Software Team Golden Runs",
          description: "Golden evals for first-party software team capabilities.",
          status: "active",
          metadata: { owner: "platform", fixtureVersion: "2026.06" },
          now: new Date("2026-06-13T02:00:00.000Z")
        });

        expect(suite).toMatchObject({
          id: "suite-software-team-golden",
          status: "active",
          metadata: { owner: "platform", fixtureVersion: "2026.06" },
          createdAt: "2026-06-13T02:00:00.000Z",
          updatedAt: "2026-06-13T02:00:00.000Z"
        });

        const evalRun = appState.evals.createRun({
          id: "eval-run-1",
          suiteId: suite.id,
          sourceRunId: "run-software-team-1",
          agentId: "athena.agent.repo-summary",
          agentVersion: "0.1.0",
          providerId: "provider-openai",
          providerKind: "openai-compatible",
          model: "gpt-4.1-mini",
          promptTemplateId: "repo-summary-default",
          promptTemplateVersion: "0.1.0",
          promptTemplateHash: "sha256:prompt-hash",
          status: "running",
          startedAt: "2026-06-13T02:01:00.000Z",
          metadata: { gitCommit: "abc123" },
          now: new Date("2026-06-13T02:01:00.000Z")
        });

        expect(evalRun).toMatchObject({
          id: "eval-run-1",
          suiteId: suite.id,
          sourceRunId: "run-software-team-1",
          agentId: "athena.agent.repo-summary",
          agentVersion: "0.1.0",
          providerId: "provider-openai",
          providerKind: "openai-compatible",
          model: "gpt-4.1-mini",
          promptTemplateHash: "sha256:prompt-hash",
          status: "running",
          metadata: { gitCommit: "abc123" }
        });

        appState.evals.createResult({
          id: "eval-result-1",
          evalRunId: evalRun.id,
          caseId: "repo-summary-basic",
          status: "passed",
          score: 0.97,
          expectedArtifactUri: "fixture://repo-summary/expected.md",
          actualArtifactUri: "artifact://runs/eval-run-1/repo-summary.md",
          metrics: { exactSections: 4, allowedDiffs: 1 },
          metadata: { comparator: "markdown-structure" },
          createdAt: "2026-06-13T02:02:00.000Z"
        });
        appState.evals.createResult({
          id: "eval-result-2",
          evalRunId: evalRun.id,
          caseId: "repo-summary-secret-redaction",
          status: "failed",
          failure: {
            code: "redaction-missing",
            message: "Output included a synthetic secret.",
            details: { field: "markdown" }
          },
          metrics: { leakedSecrets: 1 },
          createdAt: "2026-06-13T02:02:10.000Z"
        });

        const completed = appState.evals.updateRun(evalRun.id, {
          status: "failed",
          finishedAt: "2026-06-13T02:03:00.000Z",
          failure: {
            code: "case-failed",
            message: "One eval case failed."
          },
          now: new Date("2026-06-13T02:03:00.000Z")
        });

        expect(completed).toMatchObject({
          status: "failed",
          finishedAt: "2026-06-13T02:03:00.000Z",
          failure: {
            code: "case-failed",
            message: "One eval case failed."
          },
          updatedAt: "2026-06-13T02:03:00.000Z"
        });
        expect(appState.evals.listSuites({ status: "active" }).map((entry) => entry.id)).toEqual([suite.id]);
        expect(appState.evals.listRuns({ suiteId: suite.id, agentId: "athena.agent.repo-summary" }).map((entry) => entry.id)).toEqual([
          evalRun.id
        ]);
        expect(appState.evals.listResults({ evalRunId: evalRun.id, status: "failed" })).toEqual([
          expect.objectContaining({
            id: "eval-result-2",
            caseId: "repo-summary-secret-redaction",
            status: "failed",
            failure: {
              code: "redaction-missing",
              message: "Output included a synthetic secret.",
              details: { field: "markdown" }
            },
            metrics: { leakedSecrets: 1 },
            metadata: {}
          })
        ]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("cascades suite deletion to eval runs and results", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-evals-cascade-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        const suite = appState.evals.createSuite({
          id: "suite-cascade",
          name: "Cascade suite"
        });
        const evalRun = appState.evals.createRun({
          id: "eval-run-cascade",
          suiteId: suite.id,
          agentId: "agent.test",
          agentVersion: "0.1.0",
          promptTemplateHash: "sha256:test"
        });
        appState.evals.createResult({
          id: "eval-result-cascade",
          evalRunId: evalRun.id,
          caseId: "case-1",
          status: "passed"
        });

        appState.db.prepare("delete from eval_suites where id = ?").run(suite.id);

        expect(appState.evals.getSuite(suite.id)).toBeUndefined();
        expect(appState.evals.getRun(evalRun.id)).toBeUndefined();
        expect(appState.evals.getResult("eval-result-cascade")).toBeUndefined();
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
