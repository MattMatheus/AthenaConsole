import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { loadConfig } from "../src/shared/config.js";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const packRoot = resolve(repoRoot, "bundled-plugins/software-team");
const goldenRoot = resolve(packRoot, "evals/golden");
const runnerPath = resolve(packRoot, "scripts/software-team-runner.mjs");

interface SoftwareTeamGoldenCase {
  id: string;
  mode: string;
  agentId: string;
  agentVersion: string;
  promptTemplateHash: string;
  inputs: Record<string, unknown>;
  expected: {
    summary: string;
    markdown: string;
  };
}

describe("software-team golden eval fixtures", () => {
  it("runs repo summary, PR review, and test failure triage fixtures with exact expected artifacts", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-software-team-golden-evals-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        const suite = appState.evals.createSuite({
          id: "software-team-golden",
          name: "Software Team Golden Runs",
          description: "Credential-free golden evals for bundled software-team capabilities.",
          status: "active",
          metadata: {
            packId: "team-orchestrator.bundled.software-team",
            fixtureRoot: "bundled-plugins/software-team/evals/golden"
          },
          now: new Date("2026-06-13T03:00:00.000Z")
        });

        const cases = loadGoldenCases();
        expect(cases.map((testCase) => testCase.id).sort()).toEqual([
          "software-team.pr-diff-review.golden",
          "software-team.repo-summary.golden",
          "software-team.test-failure-triage.golden"
        ]);

        for (const testCase of cases) {
          const evalRun = appState.evals.createRun({
            id: `eval-${testCase.id}`,
            suiteId: suite.id,
            agentId: testCase.agentId,
            agentVersion: testCase.agentVersion,
            providerKind: "deterministic-local",
            model: "software-team-runner.mjs",
            promptTemplateHash: testCase.promptTemplateHash,
            status: "running",
            startedAt: "2026-06-13T03:01:00.000Z",
            metadata: { mode: testCase.mode, fixtureId: testCase.id },
            now: new Date("2026-06-13T03:01:00.000Z")
          });

          const actual = runSoftwareTeamFixture(testCase);
          expect(actual.summary).toBe(testCase.expected.summary);
          expect(actual.output.markdown).toBe(testCase.expected.markdown);

          appState.evals.createResult({
            id: `result-${testCase.id}`,
            evalRunId: evalRun.id,
            caseId: testCase.id,
            status: "passed",
            score: 1,
            expectedArtifactUri: `fixture://software-team/evals/golden/${testCase.id}`,
            actualArtifactUri: `memory://software-team-golden/${evalRun.id}.md`,
            metrics: {
              exactMarkdownMatch: true,
              exactSummaryMatch: true
            },
            metadata: {
              markdownBytes: Buffer.byteLength(actual.output.markdown, "utf8")
            },
            createdAt: "2026-06-13T03:02:00.000Z"
          });
          appState.evals.updateRun(evalRun.id, {
            status: "completed",
            finishedAt: "2026-06-13T03:02:00.000Z",
            now: new Date("2026-06-13T03:02:00.000Z")
          });
        }

        expect(appState.evals.listRuns({ suiteId: suite.id, status: "completed" })).toHaveLength(3);
        expect(
          appState.evals
            .listRuns({ suiteId: suite.id, status: "completed" })
            .flatMap((run) => appState.evals.listResults({ evalRunId: run.id }))
            .map((result) => ({ caseId: result.caseId, status: result.status, score: result.score }))
            .sort((left, right) => left.caseId.localeCompare(right.caseId))
        ).toEqual([
          { caseId: "software-team.pr-diff-review.golden", status: "passed", score: 1 },
          { caseId: "software-team.repo-summary.golden", status: "passed", score: 1 },
          { caseId: "software-team.test-failure-triage.golden", status: "passed", score: 1 }
        ]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function loadGoldenCases(): SoftwareTeamGoldenCase[] {
  return readdirSync(goldenRoot)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort()
    .map((fileName) => JSON.parse(readFileSync(resolve(goldenRoot, fileName), "utf8")) as SoftwareTeamGoldenCase);
}

function runSoftwareTeamFixture(testCase: SoftwareTeamGoldenCase): { summary: string; output: { markdown: string } } {
  const stdout = execFileSync(process.execPath, [runnerPath, testCase.mode], {
    cwd: repoRoot,
    input: JSON.stringify({
      task: {
        id: `task-${testCase.id}`,
        inputs: testCase.inputs
      },
      agent: {
        id: testCase.agentId,
        version: testCase.agentVersion
      },
      run: {
        id: `run-${testCase.id}`
      }
    }),
    encoding: "utf8",
    maxBuffer: 1024 * 1024
  });
  return JSON.parse(stdout) as { summary: string; output: { markdown: string } };
}
