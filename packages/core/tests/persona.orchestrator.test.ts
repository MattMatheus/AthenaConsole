import { describe, expect, it, vi } from "vitest";
import type { AthenaConfig } from "../src/shared/config.js";
import {
  runPersonaOrchestrator,
  type PersonaRunExecutionPreparation,
  type PersonaRunOrchestratorDependencies
} from "../src/personas/run.js";

describe("persona run orchestrator", () => {
  it("executes helper stages in order and preserves normalized result shape", async () => {
    const calls: string[] = [];
    const executionPreparation: PersonaRunExecutionPreparation = {
      contextPack: {
        systemContent: "system context",
        userContent: "user context",
        manifest: {
          schemaVersion: 1,
          personaId: "code-review",
          personaRoot: "/repo/specialists/code-review",
          limits: { maxFileChars: 100, maxTotalChars: 1000 },
          totals: { requestedFiles: 1, loadedFiles: 1, loadedChars: 20, truncatedFiles: 0 },
          entries: []
        }
      },
      diff: "diff --git a/a.ts b/a.ts",
      changedFiles: ["a.ts"],
      dependencyInspection: { status: "ok", notes: ["deps"] },
      referenced: {
        meta: {
          attemptedImports: 1,
          loadedSnapshots: 1,
          limitHit: false,
          maxReferencedFiles: 10,
          maxReferencedFileChars: 5000
        },
        snapshots: [
          {
            sourcePath: "a.ts",
            importSpecifier: "./b",
            path: "b.ts",
            chars: 12,
            truncated: false,
            content: "export const b = 1;"
          }
        ]
      }
    };

    const dependencies: PersonaRunOrchestratorDependencies = {
      async runPreflightChecks() {
        calls.push("preflight");
        return {
          persona: {
            schemaVersion: 1,
            id: "code-review",
            output: { stdoutDefault: "summary" }
          },
          repoPath: "/repo",
          baseResolution: {
            baseRef: "main",
            resolvedFrom: "main"
          }
        };
      },
      async assemblePersonaContextPack() {
        calls.push("context-pack");
        return executionPreparation.contextPack;
      },
      async getDiff() {
        calls.push("diff");
        return executionPreparation.diff;
      },
      async listChangedFiles() {
        calls.push("changed-files");
        return executionPreparation.changedFiles;
      },
      async inspectDependenciesBestEffort() {
        calls.push("dependency-inspection");
        return executionPreparation.dependencyInspection;
      },
      async collectReferencedFileSnapshots() {
        calls.push("referenced-snapshots");
        return executionPreparation.referenced;
      },
      createRuntime() {
        calls.push("create-runtime");
        return {} as never;
      },
      constructPersonaReviewPrompt() {
        calls.push("prompt");
        return "review prompt";
      },
      async executeModelWithRepair() {
        calls.push("execute");
        return {
          runtimeResult: {
            output: "{\"schemaVersion\":1}",
            provider: "mock",
            model: "model-1",
            createdAt: "2026-02-18T00:00:10.000Z",
            usage: {
              inputTokens: 10,
              outputTokens: 5,
              totalTokens: 15
            },
            contextMeta: {
              initialChars: 100,
              finalChars: 90
            }
          },
          modelOutputRaw: "{\"schemaVersion\":1}",
          status: "ok",
          parseRetryAttempted: false,
          parsed: { parsed: { schemaVersion: 1, mergeGate: "pass", reportMarkdown: "# report", findings: [] } }
        };
      },
      normalizePersonaOutput() {
        calls.push("normalize");
        return {
          reportMarkdown: "# report",
          findings: [],
          mergeGate: "pass",
          dependencyInspection: executionPreparation.dependencyInspection,
          modelOutputRaw: "{\"schemaVersion\":1}",
          modelOutputParsed: true,
          parseRetryAttempted: false
        };
      },
      resolvePersonaRunPaths: vi.fn(() => ({
        auditDir: "/repo/.athena/specialist-runs/run",
        resultJsonPath: "r.json",
        reportMarkdownPath: "r.md"
      })),
      resolveWorkspaceRelative: vi.fn((workspaceRoot: string, userPath: string) => `${workspaceRoot}/${userPath}`),
      persistPersonaRunEvidenceBundle: vi.fn(async () => {
        calls.push("persist-evidence");
        return [];
      }),
      persistPersonaRunResultArtifacts: vi.fn(async () => {
        calls.push("persist");
      }),
      nowIso: vi
        .fn<() => string>()
        .mockReturnValueOnce("2026-02-18T00:00:00.000Z")
        .mockReturnValueOnce("2026-02-18T00:00:30.000Z"),
      buildSafeId: vi.fn((prefix: string) => `${prefix}-id`)
    };

    const config = {
      workspaceRoot: "/repo",
      stateDir: ".athena"
    } as AthenaConfig;

    const response = await runPersonaOrchestrator(
      {
        name: "code-review",
        repoPath: ".",
        headRef: "feature"
      },
      config,
      dependencies
    );

    expect(calls).toEqual([
      "preflight",
      "context-pack",
      "diff",
      "changed-files",
      "dependency-inspection",
      "referenced-snapshots",
      "prompt",
      "create-runtime",
      "execute",
      "normalize",
      "persist-evidence",
      "persist"
    ]);
    expect(response.result.runId).toBe("persona-code-review-id");
    expect(response.result.sessionId).toBe("session-code-review-id");
    expect(response.result.startedAt).toBe("2026-02-18T00:00:00.000Z");
    expect(response.result.finishedAt).toBe("2026-02-18T00:00:30.000Z");
    expect(response.result.status).toBe("ok");
    expect(response.result.usage).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15
    });
    expect(response.result.contextMeta).toEqual({
      initialChars: 100,
      finalChars: 90
    });
    expect(response.result.runtimeResult?.usage?.totalTokens).toBe(15);
    expect(response.result.runtimeResult?.contextMeta).toEqual({
      initialChars: 100,
      finalChars: 90
    });
    expect(response.result.evidenceManifest).toEqual([]);
    expect(response.result.modelOutputParsed).toBe(true);
    expect(response.stdout).toContain("specialist: code-review");
    expect(dependencies.persistPersonaRunResultArtifacts).toHaveBeenCalledTimes(1);
  });

  it("defaults athena-prime runs to foundry deployment when provider/model are omitted", async () => {
    const executeModelWithRepair = vi.fn(async (input: { provider?: string; model?: string }) => {
      return {
        runtimeResult: {
          output: "{\"schemaVersion\":1}",
          provider: input.provider ?? "foundry",
          model: input.model ?? "fallback-model",
          createdAt: "2026-02-18T00:00:10.000Z"
        },
        modelOutputRaw: "{\"schemaVersion\":1}",
        status: "ok" as const,
        parseRetryAttempted: false,
        parsed: { parsed: { schemaVersion: 1 as const, mergeGate: "pass" as const, reportMarkdown: "# report", findings: [] } }
      };
    });

    const dependencies: PersonaRunOrchestratorDependencies = {
      async runPreflightChecks() {
        return {
          persona: {
            schemaVersion: 1,
            id: "athena-prime",
            output: { stdoutDefault: "summary" }
          },
          repoPath: "/repo",
          baseResolution: {
            baseRef: "main",
            resolvedFrom: "main"
          }
        };
      },
      async assemblePersonaContextPack() {
        return {
          systemContent: "system context",
          userContent: "user context",
          manifest: {
            schemaVersion: 1,
            personaId: "athena-prime",
            personaRoot: "/repo/specialists/athena-prime",
            limits: { maxFileChars: 100, maxTotalChars: 1000 },
            totals: { requestedFiles: 1, loadedFiles: 1, loadedChars: 20, truncatedFiles: 0 },
            entries: []
          }
        };
      },
      async getDiff() {
        return "diff --git a/a.ts b/a.ts";
      },
      async listChangedFiles() {
        return ["a.ts"];
      },
      async inspectDependenciesBestEffort() {
        return { status: "ok", notes: [] };
      },
      async collectReferencedFileSnapshots() {
        return {
          meta: {
            attemptedImports: 0,
            loadedSnapshots: 0,
            limitHit: false,
            maxReferencedFiles: 10,
            maxReferencedFileChars: 5000
          },
          snapshots: []
        };
      },
      createRuntime() {
        return {} as never;
      },
      constructPersonaReviewPrompt() {
        return "review prompt";
      },
      executeModelWithRepair,
      normalizePersonaOutput() {
        return {
          reportMarkdown: "# report",
          findings: [],
          mergeGate: "pass",
          dependencyInspection: { status: "ok", notes: [] },
          modelOutputRaw: "{\"schemaVersion\":1}",
          modelOutputParsed: true,
          parseRetryAttempted: false
        };
      },
      resolvePersonaRunPaths: vi.fn(() => ({
        auditDir: "/repo/.athena/specialist-runs/run",
        resultJsonPath: "r.json",
        reportMarkdownPath: "r.md"
      })),
      resolveWorkspaceRelative: vi.fn((workspaceRoot: string, userPath: string) => `${workspaceRoot}/${userPath}`),
      persistPersonaRunEvidenceBundle: vi.fn(async () => []),
      persistPersonaRunResultArtifacts: vi.fn(async () => {}),
      nowIso: vi
        .fn<() => string>()
        .mockReturnValueOnce("2026-02-18T00:00:00.000Z")
        .mockReturnValueOnce("2026-02-18T00:00:30.000Z"),
      buildSafeId: vi.fn((prefix: string) => `${prefix}-id`)
    };

    const config = {
      workspaceRoot: "/repo",
      stateDir: ".athena",
      defaultModel: "gpt-4o-mini",
      foundry: {
        enabled: true,
        deployment: "gpt-5.1-codex-mini",
        apiVersion: "2024-05-01-preview",
        useEntraId: true,
        audience: "https://cognitiveservices.azure.com/.default"
      }
    } as AthenaConfig;

    await runPersonaOrchestrator(
      {
        name: "athena-prime",
        repoPath: ".",
        headRef: "main"
      },
      config,
      dependencies
    );

    expect(executeModelWithRepair).toHaveBeenCalledTimes(1);
    expect(executeModelWithRepair).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "foundry",
        model: "gpt-5.1-codex-mini"
      })
    );
  });
});
