import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { withRequestAuthContext, type ScopeSet } from "../src/control-plane/auth.js";
import type { ExecutionBackend } from "../src/control-plane/backends.js";
import { createLocalControlPlaneServices, type ControlPlaneServices } from "../src/control-plane/services.js";
import type { AthenaRbacRole } from "../src/shared/contracts.js";
import { loadConfig } from "../src/shared/config.js";

describe("control-plane authorization wrappers", () => {
  it("enforces role checks for sensitive operations and audits denials", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-authz-"));
    try {
      writeFileSync(join(dir, ".env"), "ATHENA_AUTH_ENABLED=true\nATHENA_AUTHZ_MODE=enforce", "utf8");
      const config = loadConfig(dir);
      const backend: ExecutionBackend = {
        kind: "local",
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
      const services = createLocalControlPlaneServices({ config, executionBackend: backend });

      await expect(
        withRole("Viewer", () =>
          services.policyService.put({
            schemaVersion: 1,
            updatedAt: new Date().toISOString(),
            maxConcurrentRuns: 2
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(withRole("Viewer", () => services.runService.cancel({ sessionId: "s1" }))).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withRole("Viewer", () =>
          services.scheduleService.upsert({
            id: "job-authz",
            sessionId: "s1",
            input: "test",
            everyMinutes: 5,
            startNow: false
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(withRole("Viewer", () => services.scheduleService.remove("job-authz"))).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(withRole("Viewer", () => services.directiveService.list())).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withRole("Viewer", () =>
          services.directiveService.create({
            input: "deny me"
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withRole("Viewer", () =>
          services.workService.enqueue({
            sessionId: "s1",
            payload: "task",
            mode: "collect"
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(withRole("Viewer", () => services.workService.status("s1"))).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(withRole("Viewer", () => services.workService.drain("s1"))).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(withRole("Viewer", () => services.failedWorkService.retry("item-1"))).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(withRole("Viewer", () => services.failedWorkService.discard("item-1"))).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(withRole("Viewer", () => services.a2aFlowService.getTrace("trace-1"))).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(withRole("Viewer", () => services.a2aObservabilityService.getSnapshot())).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(withRole("Viewer", () => services.a2aObservabilityService.listAlertHistory())).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withRole("Viewer", () =>
          services.a2aObservabilityService.exportAlertHistoryCsv({
            createdAfter: new Date(Date.now() - 60_000).toISOString(),
            createdBefore: new Date().toISOString()
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });

      const deniedEvents = await withRole("Admin", () =>
        services.eventService.list({
          types: ["authz.denied"],
          limit: 40
        })
      );
      expect(deniedEvents.events.length).toBe(15);
      expect(deniedEvents.events.map((event) => event.payload.operation)).toEqual([
        "policy.put",
        "runs.cancel",
        "schedules.upsert",
        "schedules.remove",
        "directives.list",
        "directives.create",
        "work.enqueue",
        "work.status",
        "work.drain",
        "failedWork.retry",
        "failedWork.discard",
        "a2aFlow.get",
        "a2aObservability.get",
        "a2aObservability.alertHistory.list",
        "a2aObservability.alertHistory.export"
      ]);
      for (const event of deniedEvents.events) {
        expect(event.payload.role).toBe("Viewer");
        expect(event.payload.subject).toBe("principal-Viewer");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("allows operator/admin for permitted operations and keeps viewer read/list access", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-authz-"));
    try {
      writeFileSync(join(dir, ".env"), "ATHENA_AUTH_ENABLED=true\nATHENA_AUTHZ_MODE=enforce", "utf8");
      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config });

      await expect(withRole("Viewer", () => services.runService.listActiveRuns())).resolves.toEqual({ items: [] });
      await expect(withRole("Viewer", () => services.scheduleService.list())).resolves.toEqual([]);
      await expect(withRole("Viewer", () => services.policyService.get())).resolves.toBeUndefined();
      await expect(withRole("Viewer", () => services.sessionService.listSessions())).resolves.toEqual([]);
      await expect(withRole("Viewer", () => services.sessionService.searchSessions({ query: "anything" }))).resolves.toEqual({
        items: [],
        total: 0,
        tookMs: expect.any(Number)
      });
      await expect(withRole("Viewer", () => services.sessionService.getSession("s2"))).resolves.toBeUndefined();
      await expect(withRole("Viewer", () => services.sessionService.getTranscript("s2"))).resolves.toEqual([]);
      await expect(withRole("Viewer", () => services.memoryService.search("anything"))).resolves.toEqual([]);
      await expect(withRole("Viewer", () => services.eventService.list({ limit: 5 }))).resolves.toMatchObject({
        events: []
      });
      await expect(withRole("Viewer", () => services.operationsService.getSummary())).resolves.toMatchObject({
        capabilities: {
          supportsPodStatus: false,
          supportsCpuMemMetrics: false
        },
        operationalSummary: {
          totalActiveRuns: 0,
          totalActiveSessions: 0
        }
      });
      await expect(withRole("Viewer", () => services.failedWorkService.list({ limit: 5 }))).resolves.toMatchObject({
        items: []
      });
      await expect(withRole("Viewer", () => services.a2aFlowService.getTrace("trace-1"))).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(withRole("Viewer", () => services.a2aObservabilityService.getSnapshot())).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(withRole("Viewer", () => services.a2aObservabilityService.listAlertHistory())).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withRole("Viewer", () =>
          services.a2aObservabilityService.exportAlertHistoryCsv({
            createdAfter: new Date(Date.now() - 60_000).toISOString(),
            createdBefore: new Date().toISOString()
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });

      await expect(withRole("Operator", () => services.runService.cancel({ sessionId: "s2" }))).resolves.toMatchObject({
        status: "not-running"
      });
      await expect(withRole("Operator", () => services.directiveService.list())).resolves.toEqual({ items: [] });
      await expect(
        withRole("Operator", () =>
          services.directiveService.create({
            input: "operator directive"
          })
        )
      ).resolves.toMatchObject({
        input: "operator directive"
      });
      await expect(
        withRole("Operator", () =>
          services.workService.enqueue({
            sessionId: "s2",
            payload: "work-item",
            mode: "collect"
          })
        )
      ).resolves.toMatchObject({
        sessionId: "s2"
      });
      await expect(withRole("Operator", () => services.workService.status("s2"))).resolves.toMatchObject({
        sessionId: "s2"
      });
      await expect(withRole("Operator", () => services.workService.drain("s2"))).resolves.toMatchObject({
        status: "ok"
      });
      await expect(withRole("Operator", () => services.failedWorkService.retry("missing-id"))).resolves.toEqual({
        updated: false
      });
      await expect(withRole("Operator", () => services.failedWorkService.discard("missing-id"))).resolves.toEqual({
        updated: false
      });
      await expect(withRole("Operator", () => services.a2aFlowService.getTrace("missing-trace"))).resolves.toMatchObject({
        traceId: "missing-trace",
        nodes: [],
        edges: [],
        truncated: false
      });
      await expect(withRole("Operator", () => services.a2aObservabilityService.getSnapshot())).resolves.toMatchObject({
        throughput: [],
        latencyHeatmap: [],
        stallAlerts: []
      });
      await expect(withRole("Operator", () => services.a2aObservabilityService.listAlertHistory())).resolves.toMatchObject({
        items: []
      });
      await expect(
        withRole("Operator", () =>
          services.a2aObservabilityService.exportAlertHistoryCsv({
            createdAfter: new Date(Date.now() - 60_000).toISOString(),
            createdBefore: new Date().toISOString()
          })
        )
      ).resolves.toContain("id,createdAt,resolvedAt,status,severity");
      await expect(
        withRole("Operator", () =>
          services.scheduleService.upsert({
            id: "job-operator",
            sessionId: "s2",
            input: "run",
            everyMinutes: 10,
            startNow: false
          })
        )
      ).resolves.toMatchObject({
        id: "job-operator"
      });
      await expect(withRole("Operator", () => services.scheduleService.remove("job-operator"))).resolves.toBe(true);

      await expect(
        withRole("Admin", () =>
          services.policyService.put({
            schemaVersion: 1,
            updatedAt: new Date().toISOString(),
            maxConcurrentRuns: 3
          })
        )
      ).resolves.toMatchObject({
        maxConcurrentRuns: 3
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("enforces pilot posture for provider config, task execution, memory review, policy changes, and run inspection", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-authz-pilot-"));
    try {
      writeFileSync(join(dir, ".env"), "ATHENA_AUTH_ENABLED=true\nATHENA_AUTHZ_MODE=enforce", "utf8");
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableTaskAgent(appState);
      } finally {
        appState.close();
      }
      const services = createLocalControlPlaneServices({ config });

      await expect(withRole("Viewer", () => services.modelProviderConfigService.list())).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withRole("Operator", () =>
          services.modelProviderConfigService.create({
            id: "provider-operator-denied",
            name: "Denied",
            providerKind: "openai-compatible",
            defaultModel: "gpt-test",
            secret: { kind: "env", name: "OPENAI_API_KEY" }
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withRole("Admin", () =>
          services.modelProviderConfigService.create({
            id: "provider-admin",
            name: "Admin Provider",
            providerKind: "openai-compatible",
            defaultModel: "gpt-test",
            secret: { kind: "env", name: "OPENAI_API_KEY" }
          })
        )
      ).resolves.toMatchObject({
        id: "provider-admin",
        status: "missing"
      });

      await expect(
        withRole("Viewer", () =>
          services.taskWorkbenchService.create({
            id: "task-authz",
            title: "Pilot posture task",
            status: "ready",
            assignedAgentId: "software.authz.local"
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withRole("Operator", () =>
          services.taskWorkbenchService.create({
            id: "task-authz",
            title: "Pilot posture task",
            status: "ready",
            assignedAgentId: "software.authz.local"
          })
        )
      ).resolves.toMatchObject({
        id: "task-authz",
        status: "ready"
      });
      await expect(withRole("Viewer", () => services.taskWorkbenchService.runTask("task-authz"))).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      const run = await withRole("Operator", () =>
        services.taskWorkbenchService.runTask("task-authz", { runId: "run-authz-task" })
      );
      expect(run).toMatchObject({
        id: "run-authz-task"
      });
      await expect(withRole("Viewer", () => services.taskWorkbenchService.getRun("run-authz-task"))).resolves.toMatchObject({
        run: {
          id: "run-authz-task"
        }
      });
      await expect(withRole("Viewer", () => services.taskWorkbenchService.cancelRun("run-authz-task"))).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });

      const proposal = await withRole("Operator", () =>
        services.durableMemoryService.createProposal({
          targetNamespace: { scope: "repository", id: "repo-authz" },
          provenance: {
            sourceKind: "task-run",
            taskId: "task-authz",
            runId: "run-authz-task",
            createdByAction: "runtime-memory-proposal"
          },
          memoryType: "repo-note",
          proposedBody: "Remember the pilot posture.",
          reason: "agent proposed useful context"
        })
      );
      await expect(
        withRole("Viewer", () =>
          services.durableMemoryService.approveProposal({
            id: proposal.id,
            actorId: "viewer",
            reason: "viewer should not approve"
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withRole("Viewer", () =>
          services.durableMemoryService.rejectProposal({
            id: proposal.id,
            actorId: "viewer",
            reason: "viewer should not reject"
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withRole("Operator", () =>
          services.durableMemoryService.approveProposal({
            id: proposal.id,
            actorId: "operator",
            reason: "approved"
          })
        )
      ).resolves.toMatchObject({
        status: "approved",
        reviewedBy: "operator"
      });

      await expect(
        withRole("Viewer", () =>
          services.policyService.put({
            schemaVersion: 1,
            updatedAt: new Date().toISOString(),
            maxConcurrentRuns: 1
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withRole("Admin", () =>
          services.policyService.put({
            schemaVersion: 1,
            updatedAt: new Date().toISOString(),
            maxConcurrentRuns: 1
          })
        )
      ).resolves.toMatchObject({
        maxConcurrentRuns: 1
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("enforces scope constraints after permission checks and audits scope denials", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-authz-scope-"));
    try {
      writeFileSync(join(dir, ".env"), "ATHENA_AUTH_ENABLED=true\nATHENA_AUTHZ_MODE=enforce", "utf8");
      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config });

      await withAuthScope("Admin", globalScope(), () =>
        services.runService.run({
          sessionId: "scope-allowed",
          input: "seed allowed"
        })
      );
      await withAuthScope("Admin", globalScope(), () =>
        services.runService.run({
          sessionId: "scope-denied",
          input: "seed denied"
        })
      );
      await withAuthScope("Admin", globalScope(), () =>
        services.directiveService.create({
          input: "alpha",
          metadata: { agentName: "alpha" }
        })
      );
      await withAuthScope("Admin", globalScope(), () =>
        services.directiveService.create({
          input: "beta",
          metadata: { agentName: "beta" }
        })
      );

      const scopedOperator: ScopeSet = {
        global: false,
        agents: ["alpha"],
        sessionIds: ["scope-allowed"],
        runIds: ["run-allowed"]
      };

      await expect(
        withAuthScope("Operator", scopedOperator, () => services.sessionService.getSession("scope-denied"))
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withAuthScope("Operator", scopedOperator, () =>
          services.directiveService.create({
            input: "beta-denied",
            metadata: { agentName: "beta" }
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withAuthScope("Operator", scopedOperator, () =>
          services.runService.run({
            sessionId: "scope-allowed",
            input: "agent mismatch",
            metadata: { agentName: "beta" }
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withAuthScope("Operator", scopedOperator, () => services.runService.cancel({ sessionId: "scope-denied" }))
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withAuthScope("Operator", scopedOperator, () => services.runService.cancelByRunId({ runId: "run-denied" }))
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withAuthScope("Operator", scopedOperator, () =>
          services.workService.enqueue({
            sessionId: "scope-denied",
            payload: "denied",
            mode: "collect"
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });

      await expect(
        withAuthScope("Viewer", scopedOperator, () =>
          services.directiveService.create({
            input: "viewer-denied",
            metadata: { agentName: "alpha" }
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });

      await expect(withAuthScope("Operator", scopedOperator, () => services.sessionService.listSessions())).resolves.toEqual([
        expect.objectContaining({ id: "scope-allowed" })
      ]);
      await expect(
        withAuthScope("Operator", scopedOperator, () => services.sessionService.searchSessions({ query: "seed" }))
      ).resolves.toMatchObject({
        items: [expect.objectContaining({ session: expect.objectContaining({ id: "scope-allowed" }) })],
        total: 1
      });
      await expect(withAuthScope("Operator", scopedOperator, () => services.directiveService.list())).resolves.toEqual({
        items: [expect.objectContaining({ input: "alpha" })]
      });

      const deniedEvents = await withAuthScope("Admin", globalScope(), () =>
        services.eventService.list({
          types: ["authz.denied"],
          limit: 50
        })
      );
      const safetyEvents = await withAuthScope("Admin", globalScope(), () =>
        services.eventService.list({
          types: ["safety.violation"],
          limit: 50
        })
      );
      expect(deniedEvents.events.some((event) => event.payload.detailCode === "SCOPED_ACCESS_VIOLATION")).toBe(true);
      expect(deniedEvents.events.some((event) => event.payload.denyReason === "ROLE_MISSING")).toBe(true);
      expect(safetyEvents.events.some((event) => event.payload.violationCode === "SCOPED_ACCESS_VIOLATION")).toBe(true);
      expect(safetyEvents.events.some((event) => event.payload.violationCode === "ROLE_MISSING")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports observe and soft-enforce rollout modes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-authz-rollout-"));
    let observeServices: ControlPlaneServices | undefined;
    let softServices: ControlPlaneServices | undefined;
    try {
      writeFileSync(
        join(dir, ".env"),
        "ATHENA_AUTH_ENABLED=true\nATHENA_AUTHZ_MODE=observe\nATHENA_AUTHZ_DEFAULT_DECISION=allow",
        "utf8"
      );
      const observe = createLocalControlPlaneServices({ config: loadConfig(dir) });
      observeServices = observe;

      await expect(
        withRole("Viewer", () =>
          observe.policyService.put({
            schemaVersion: 1,
            updatedAt: new Date().toISOString(),
            maxConcurrentRuns: 2
          })
        )
      ).resolves.toMatchObject({
        maxConcurrentRuns: 2
      });
      await expect(withRole("Viewer", () => observe.runService.cancel({ sessionId: "s-observe" }))).resolves.toMatchObject({
        status: "not-running"
      });
      const observedDenied = await withRole("Admin", () =>
        observe.eventService.list({
          types: ["authz.denied"],
          limit: 20
        })
      );
      expect(observedDenied.events.map((event) => event.payload.operation)).toEqual(["policy.put", "runs.cancel"]);

      writeFileSync(
        join(dir, ".env"),
        "ATHENA_AUTH_ENABLED=true\nATHENA_AUTHZ_MODE=soft-enforce\nATHENA_AUTHZ_DEFAULT_DECISION=allow",
        "utf8"
      );
      const soft = createLocalControlPlaneServices({ config: loadConfig(dir) });
      softServices = soft;

      await expect(
        withRole("Viewer", () =>
          soft.scheduleService.upsert({
            id: "job-soft",
            sessionId: "s-soft",
            input: "allowed",
            everyMinutes: 5,
            startNow: false
          })
        )
      ).resolves.toMatchObject({
        id: "job-soft"
      });
      await expect(withRole("Viewer", () => soft.runService.cancel({ sessionId: "s-soft" }))).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(withRole("Viewer", () => soft.modelProviderConfigService.list())).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withRole("Viewer", () =>
          soft.durableMemoryService.approveProposal({
            id: "missing-proposal",
            actorId: "viewer",
            reason: "viewer should not approve in soft-enforce"
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
      await expect(
        withRole("Viewer", () =>
          soft.policyService.put({
            schemaVersion: 1,
            updatedAt: new Date().toISOString(),
            maxConcurrentRuns: 4
          })
        )
      ).rejects.toMatchObject({
        code: "AUTHZ_DENIED"
      });
    } finally {
      if (softServices?.shutdown) {
        await softServices.shutdown();
      }
      if (observeServices?.shutdown) {
        await observeServices.shutdown();
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function withRole<T>(role: AthenaRbacRole, operation: () => Promise<T>): Promise<T> {
  return withAuthScope(role, defaultScopeForRole(role), operation);
}

function withAuthScope<T>(role: AthenaRbacRole, scope: ScopeSet, operation: () => Promise<T>): Promise<T> {
  return withRequestAuthContext(
    {
      subject: `principal-${role}`,
      role,
      scope
    },
    operation
  );
}

function defaultScopeForRole(role: AthenaRbacRole): ScopeSet {
  return {
    global: role === "Admin",
    agents: [],
    sessionIds: [],
    runIds: []
  };
}

function globalScope(): ScopeSet {
  return {
    global: true,
    agents: [],
    sessionIds: [],
    runIds: []
  };
}

function seedRunnableTaskAgent(appState: ReturnType<typeof openAppStateDatabase>): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.authz",
    version: "0.1.0",
    path: "/tmp/team-orchestrator-authz-plugin",
    enabled: true,
    status: "loaded",
    sourceType: "local",
    manifest: {},
    validationErrors: []
  });
  appState.agents.upsert({
    id: "software.authz.local",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.authz",
    pluginVersion: "0.1.0",
    name: "Authz Runner",
    capabilities: ["test.run"],
    status: "loaded",
    manifest: {
      agent: {
        implementation: {
          type: "local-command",
          command: "/bin/echo",
          args: ['{"summary":"ok","output":{"markdown":"authorized run completed"}}']
        },
        runtime: {
          preferredBackend: "local-process",
          workingDirectory: "."
        }
      }
    }
  });
}
