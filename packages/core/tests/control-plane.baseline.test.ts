import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { ExecutionBackend } from "../src/control-plane/backends.js";
import { FileStateStore } from "../src/control-plane/state-store.js";
import { createLocalControlPlaneServices } from "../src/control-plane/services.js";
import { createRuntime } from "../src/runtime/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("control-plane phase-0 baseline", () => {
  it("maps local runtime state through FileStateStore", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-store-"));
    try {
      const config = loadConfig(dir);
      const runtime = createRuntime({ config });
      await runtime.run({
        sessionId: "s1",
        input: "hello"
      });

      const store = new FileStateStore(config);
      const sessions = await store.listSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0]?.id).toBe("s1");

      const transcript = await store.getTranscript("s1");
      expect(transcript.length).toBe(2);
      expect(transcript[0]?.role).toBe("user");
      expect(transcript[1]?.role).toBe("assistant");
      const transcriptAfterFirst = await store.getTranscript("s1", {
        ...(transcript[0]?.id ? { after: transcript[0].id } : {}),
        limit: 10
      });
      expect(transcriptAfterFirst.length).toBe(1);
      expect(transcriptAfterFirst[0]?.id).toBe(transcript[1]?.id);

      const queue = await store.getWorkQueue("s1");
      expect(queue.items.length).toBe(0);

      const firstDirective = await store.createDirective({
        input: "Review this run",
        contextRefs: ["MEMORY.md"],
        metadata: { source: "baseline-test" }
      });
      const secondDirective = await store.createDirective({
        input: "Review this run",
        contextRefs: ["MEMORY.md"],
        metadata: { source: "baseline-test" }
      });
      expect(firstDirective.id).not.toBe(secondDirective.id);
      const directives = await store.listDirectives();
      expect(directives.length).toBe(2);
      expect(directives[0]?.id).toBe(secondDirective.id);

      const firstHarnessProfile = await store.createHarnessProfile({
        displayName: "Reviewer v1",
        version: "v1",
        config: {
          provider: "mock",
          model: "mock-model",
          tools: ["review"]
        },
        policies: {
          timeoutMs: 30_000,
          retryLimit: 2,
          budgetUsd: 5
        }
      });
      const secondHarnessProfile = await store.createHarnessProfile({
        displayName: "Reviewer v2",
        version: "v2",
        config: {
          provider: "mock",
          model: "mock-model",
          tools: ["review", "trace"]
        },
        policies: {
          timeoutMs: 45_000,
          retryLimit: 3,
          budgetUsd: 10
        },
        verificationPolicies: [
          {
            id: "require-review-log",
            kind: "require-evidence",
            label: "review-log",
            evidenceType: "text"
          }
        ]
      });
      expect(firstHarnessProfile.id).not.toBe(secondHarnessProfile.id);
      const harnessProfiles = await store.listHarnessProfiles();
      expect(harnessProfiles.length).toBe(2);
      expect(harnessProfiles.map((item) => item.id)).toContain(secondHarnessProfile.id);
      expect(harnessProfiles.find((item) => item.id === secondHarnessProfile.id)?.verificationPolicies?.[0]?.id).toBe(
        "require-review-log"
      );

      const firstRunTemplate = await store.createRunTemplate({
        harnessProfileId: firstHarnessProfile.id,
        directiveTemplate: "Review {{HEAD_REF}} against {{BASE_REF}}.",
        defaultParams: {
          HEAD_REF: "main",
          BASE_REF: "origin/main"
        }
      });
      const secondRunTemplate = await store.createRunTemplate({
        harnessProfileId: secondHarnessProfile.id,
        directiveTemplate: "Review {{HEAD_REF}} against {{BASE_REF}}.",
        defaultParams: {
          HEAD_REF: "feature/xyz",
          BASE_REF: "main"
        }
      });
      expect(firstRunTemplate.id).not.toBe(secondRunTemplate.id);
      const runTemplates = await store.listRunTemplates();
      expect(runTemplates.length).toBe(2);
      expect(runTemplates[0]?.id).toBe(secondRunTemplate.id);

      const firstWorkflow = await store.createWorkflow({
        definition: {
          steps: [
            {
              id: "seed",
              directiveId: firstDirective.id,
              harnessProfileId: firstHarnessProfile.id
            },
            {
              id: "review",
              directiveId: secondDirective.id,
              harnessProfileId: secondHarnessProfile.id
            }
          ],
          dependencies: [{ from: "seed", to: "review" }]
        }
      });
      const secondWorkflow = await store.createWorkflow({
        definition: {
          steps: [
            {
              id: "one",
              directiveId: firstDirective.id,
              harnessProfileId: firstHarnessProfile.id
            }
          ],
          dependencies: []
        }
      });
      expect(firstWorkflow.id).not.toBe(secondWorkflow.id);
      const workflows = await store.listWorkflows();
      expect(workflows.length).toBe(2);
      expect(workflows[0]?.id).toBe(secondWorkflow.id);

      const workflowRun = await store.createWorkflowRun({
        workflowId: firstWorkflow.id,
        stepOrder: ["seed", "review"],
        stepStates: {
          seed: {
            stepId: "seed",
            status: "ok",
            attempt: 1,
            ready: false,
            dependencyReadiness: {
              totalDependencies: 0,
              readyDependencies: 0,
              blockingStepIds: []
            },
            updatedAt: new Date().toISOString()
          },
          review: {
            stepId: "review",
            status: "pending",
            attempt: 0,
            ready: true,
            dependencyReadiness: {
              totalDependencies: 1,
              readyDependencies: 1,
              blockingStepIds: []
            },
            updatedAt: new Date().toISOString()
          }
        }
      });
      expect(workflowRun.workflowId).toBe(firstWorkflow.id);
      const transitioned = await store.transitionWorkflowRun(firstWorkflow.id, workflowRun.id, (run) => ({
        ...run,
        status: "running",
        updatedAt: new Date().toISOString()
      }));
      expect(transitioned.status).toBe("running");
      const workflowRuns = await store.listWorkflowRuns(firstWorkflow.id);
      expect(workflowRuns[0]?.id).toBe(workflowRun.id);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds local control-plane services with capability discovery", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-services-"));
    try {
      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config });
      const capabilities = await services.capabilityService.getCapabilities();
      expect(capabilities.executionBackend).toBe("local");
      expect(capabilities.stateStore).toBe("file");
      expect(capabilities.supportsPods).toBe(false);
      expect(capabilities.supportsSandbox).toBe(false);

      const cancel = await services.runService.cancel({ sessionId: "s1" });
      expect(cancel.status).toBe("not-running");

      const active = await services.runService.listActiveRuns();
      expect(active.items).toEqual([]);
      const cancelRequests = await services.runService.listCancellationRequests();
      expect(cancelRequests.items).toEqual([]);

      const createdDirective = await services.directiveService.create({
        input: "Capture intent for auditing"
      });
      expect(createdDirective.id.length).toBeGreaterThan(0);
      const listedDirectives = await services.directiveService.list({ limit: 10 });
      expect(listedDirectives.items[0]?.id).toBe(createdDirective.id);

      const createdHarnessProfile = await services.harnessProfileService.create({
        displayName: "Fleet Reviewer",
        version: "v1",
        config: {
          provider: "mock",
          model: "mock-model",
          tools: ["review"]
        },
        policies: {
          timeoutMs: 30_000,
          retryLimit: 2,
          budgetUsd: 3
        }
      });
      expect(createdHarnessProfile.id.length).toBeGreaterThan(0);
      const listedHarnessProfiles = await services.harnessProfileService.list({ limit: 10 });
      expect(listedHarnessProfiles.items[0]?.id).toBe(createdHarnessProfile.id);

      const createdRunTemplate = await services.runTemplateService.create({
        harnessProfileId: createdHarnessProfile.id,
        directiveTemplate: "Review {{HEAD_REF}} against {{BASE_REF}}",
        defaultParams: {
          HEAD_REF: "main",
          BASE_REF: "origin/main"
        }
      });
      expect(createdRunTemplate.id.length).toBeGreaterThan(0);
      const listedRunTemplates = await services.runTemplateService.list({ limit: 10 });
      expect(listedRunTemplates.items[0]?.id).toBe(createdRunTemplate.id);

      const templateRun = await services.runTemplateService.run(createdRunTemplate.id, {
        params: {
          HEAD_REF: "feature/template-run"
        }
      });
      expect(templateRun.template?.id).toBe(createdRunTemplate.id);
      expect(templateRun.template?.effectiveParams).toEqual({
        HEAD_REF: "feature/template-run",
        BASE_REF: "origin/main"
      });
      expect(templateRun.output).toContain("feature/template-run");
      expect(templateRun.directiveId).toBeDefined();
      expect(templateRun.harnessProfileId).toBe(createdHarnessProfile.id);
      expect(templateRun.harnessProfileSnapshot?.id).toBe(createdHarnessProfile.id);

      const structuredDirective = await services.directiveService.create({
        input: "Run from directive-harness path"
      });
      const structuredRun = await services.runService.run({
        sessionId: "structured-s1",
        directiveId: structuredDirective.id,
        harnessProfileId: createdHarnessProfile.id
      });
      expect(structuredRun.directiveId).toBe(structuredDirective.id);
      expect(structuredRun.harnessProfileId).toBe(createdHarnessProfile.id);
      expect(structuredRun.harnessProfileSnapshot?.id).toBe(createdHarnessProfile.id);
      expect(structuredRun.output).toContain("Run from directive-harness path");

      const shadowRun = await services.runService.run({
        sessionId: "shadow-s1",
        input: "legacy input"
      });
      expect(shadowRun.directiveId).toBeDefined();
      expect(shadowRun.harnessProfileId?.startsWith("shadow-harness-")).toBe(true);
      expect(shadowRun.harnessProfileSnapshot?.id).toBe(shadowRun.harnessProfileId);
      expect(shadowRun.harnessProfileSnapshot?.config.provider).toBe("mock");
      expect(shadowRun.harnessProfileSnapshot?.config.model).toBe("mock-model");

      await expect(
        services.harnessProfileService.create({
          displayName: "Invalid Profile",
          version: "v1",
          config: {
            provider: "unknown-provider",
            model: "mock-model",
            tools: ["review"]
          },
          policies: {
            timeoutMs: 30_000,
            retryLimit: 2,
            budgetUsd: 3
          }
        })
      ).rejects.toMatchObject({ code: "CONFIG_ERROR" });

      await expect(
        services.runTemplateService.create({
          harnessProfileId: createdHarnessProfile.id,
          directiveTemplate: "Review {{HEAD_REF}} against {{BASE_REF}}",
          defaultParams: {
            HEAD_REF: "main"
          }
        })
      ).rejects.toMatchObject({ code: "CONFIG_ERROR" });

      await expect(
        services.runTemplateService.create({
          harnessProfileId: "missing-harness-profile",
          directiveTemplate: "Review {{HEAD_REF}}",
          defaultParams: {
            HEAD_REF: "main"
          }
        })
      ).rejects.toMatchObject({ code: "CONFIG_ERROR" });

      await expect(
        services.runTemplateService.run(createdRunTemplate.id, {
          params: {
            BASE_REF: ""
          }
        })
      ).rejects.toMatchObject({ code: "CONFIG_ERROR" });

    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps capability shape stable with k8s metrics scaffold backend", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-services-k8s-"));
    try {
      const config = loadConfig(dir);
      const backend: ExecutionBackend = {
        kind: "k8s",
        async run(request) {
          return {
            sessionId: request.sessionId,
            output: "ok",
            provider: request.provider ?? "mock",
            model: request.model ?? "mock-model",
            createdAt: new Date().toISOString()
          };
        },
        async cancel(request) {
          return {
            sessionId: request.sessionId,
            status: "not-running"
          };
        }
      };
      const services = createLocalControlPlaneServices({
        config,
        executionBackend: backend,
        k8sMetricsProviderOptions: {
          podMetricsApiClient: {
            async listClusterCustomObject() {
              throw new Error("metrics unavailable");
            }
          }
        }
      });
      const capabilities = await services.capabilityService.getCapabilities();
      expect(capabilities.executionBackend).toBe("k8s");
      expect(capabilities.stateStore).toBe("file");
      expect(capabilities.supportsPods).toBe(true);
      expect(capabilities.supportsCpuMemMetrics).toBe(false);
      expect(capabilities.supportsSandbox).toBe(false);
      expect(capabilities.supportsA2ABus).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects evidence attachment when run is no longer active", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-evidence-inactive-"));
    try {
      const backend: ExecutionBackend = {
        kind: "local",
        async run(request, options) {
          await options?.onAttachEvidence?.({
            sessionId: request.sessionId,
            runId: "run-inactive",
            traceId: "trace-inactive",
            metadata: request.metadata ?? {},
            label: "late-proof",
            type: "text",
            content: "not active"
          });
          return {
            sessionId: request.sessionId,
            output: "ok",
            provider: request.provider ?? "mock",
            model: request.model ?? "mock-model",
            createdAt: new Date().toISOString()
          };
        },
        async cancel(request) {
          return {
            sessionId: request.sessionId,
            status: "not-running"
          };
        },
        async listActiveRuns() {
          return { items: [] };
        }
      };
      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config, executionBackend: backend });
      await expect(
        services.runService.run({
          sessionId: "inactive-evidence",
          input: "hello"
        })
      ).rejects.toMatchObject({ code: "CONFIG_ERROR" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("evaluates harness verification policies against collected run evidence", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-run-verification-policies-"));
    try {
      let activeRun:
        | {
            sessionId: string;
            runId: string;
            traceId: string;
            startedAt: string;
          }
        | undefined;
      const backend: ExecutionBackend = {
        kind: "local",
        async run(request, options) {
          const runId = `run-${request.sessionId}`;
          activeRun = {
            sessionId: request.sessionId,
            runId,
            traceId: `trace-${request.sessionId}`,
            startedAt: new Date().toISOString()
          };
          const content = (request.input ?? "").includes("empty") ? "   " : "all checks green";
          await options?.onAttachEvidence?.({
            sessionId: activeRun.sessionId,
            runId: activeRun.runId,
            traceId: activeRun.traceId,
            metadata: request.metadata ?? {},
            label: "test-report",
            type: "text",
            content
          });
          activeRun = undefined;
          return {
            sessionId: request.sessionId,
            output: "ok",
            provider: request.provider ?? "mock",
            model: request.model ?? "mock-model",
            createdAt: new Date().toISOString(),
            runId
          };
        },
        async cancel(request) {
          return {
            sessionId: request.sessionId,
            status: "not-running"
          };
        },
        async listActiveRuns(query) {
          if (!activeRun || query?.runId !== activeRun.runId) {
            return { items: [] };
          }
          return {
            items: [
              {
                sessionId: activeRun.sessionId,
                pid: process.pid,
                startedAt: activeRun.startedAt,
                runId: activeRun.runId,
                traceId: activeRun.traceId
              }
            ]
          };
        }
      };

      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config, executionBackend: backend });
      const profile = await services.harnessProfileService.create({
        displayName: "Verification Harness",
        version: "v1",
        config: {
          provider: "mock",
          model: "mock-model",
          tools: ["verify"]
        },
        policies: {
          timeoutMs: 30_000,
          retryLimit: 1,
          budgetUsd: 1
        },
        verificationPolicies: [
          {
            id: "require-test-report",
            kind: "require-evidence",
            label: "test-report",
            evidenceType: "text"
          }
        ]
      });

      const passed = await services.runService.run({
        sessionId: "verify-pass",
        input: "normal run",
        harnessProfileId: profile.id
      });
      expect(passed.verificationStatus).toBe("passed");
      expect(passed.verificationFailures).toBeUndefined();

      const failed = await services.runService.run({
        sessionId: "verify-fail",
        input: "empty report",
        harnessProfileId: profile.id
      });
      expect(failed.verificationStatus).toBe("verification-failed");
      expect(failed.verificationFailures).toHaveLength(1);
      expect(failed.verificationFailures?.[0]?.policyId).toBe("require-test-report");
      expect(failed.verificationFailures?.[0]?.message).toContain("empty");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
