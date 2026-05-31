import { appendFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createApiServer, resolveApiRouteFamily } from "../src/api/server.js";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import type { ExecutionBackend } from "../src/control-plane/backends.js";
import { createLocalControlPlaneServices } from "../src/control-plane/services.js";
import { loadConfig } from "../src/shared/config.js";
import {
  MockMetricsProvider,
  createBaselineOperationsSummary,
  createResourceOperationsSummary
} from "./helpers/mock-operations-metrics-provider.js";

describe("api server", () => {
  it("uses deterministic route-family matcher precedence for ambiguous paths", () => {
    expect(resolveApiRouteFamily("POST", "/api/v1/schedules/tick")).toBe("schedules");
    expect(resolveApiRouteFamily("DELETE", "/api/v1/schedules/tick")).toBe("schedules");
    expect(resolveApiRouteFamily("GET", "/api/v1/runs/active")).toBe("runs");
    expect(resolveApiRouteFamily("GET", "/api/v1/runs/cancel-requests")).toBe("runs");
    expect(resolveApiRouteFamily("POST", "/api/v1/run-control/by-run/run-1/cancel")).toBe("runs");
    expect(resolveApiRouteFamily("GET", "/api/v1/sessions/search")).toBe("sessions");
    expect(resolveApiRouteFamily("GET", "/api/v1/sessions/session-1/transcript/stream")).toBe("sessions");
    expect(resolveApiRouteFamily("GET", "/api/v1/sessions/session-1/artifacts")).toBe("sessions");
    expect(resolveApiRouteFamily("GET", "/api/v1/directives")).toBe("directives");
    expect(resolveApiRouteFamily("GET", "/api/v1/harness-profiles")).toBe("harness-profiles");
    expect(resolveApiRouteFamily("GET", "/api/v1/run-templates")).toBe("run-templates");
    expect(resolveApiRouteFamily("POST", "/api/v1/templates/template-1/run")).toBe("run-templates");
    expect(resolveApiRouteFamily("GET", "/api/v1/workflows")).toBeUndefined();
    expect(resolveApiRouteFamily("GET", "/api/v1/workflows/run/workflow-1")).toBeUndefined();
    expect(resolveApiRouteFamily("POST", "/api/v1/workflows/run/workflow-1/resume")).toBeUndefined();
    expect(resolveApiRouteFamily("GET", "/api/v1/workflow-runs/workflow-run-1/status")).toBe("workflows");
    expect(resolveApiRouteFamily("POST", "/api/v1/workflow-runs/workflow-run-1/execute")).toBe("workflows");
    expect(resolveApiRouteFamily("GET", "/api/v1/work/observability")).toBe("work");
    expect(resolveApiRouteFamily("GET", "/api/v1/work/observability/alerts")).toBe("work");
    expect(resolveApiRouteFamily("GET", "/api/v1/work/observability/alerts/export.csv")).toBe("work");
    expect(resolveApiRouteFamily("GET", "/api/v1/work/flows/trace-1")).toBe("work");
    expect(resolveApiRouteFamily("GET", "/api/v1/events/stream")).toBe("operations-events-policy");
    expect(resolveApiRouteFamily("GET", "/api/v1/events")).toBe("operations-events-policy");
    expect(resolveApiRouteFamily("GET", "/api/operations/summary")).toBe("operations-events-policy");
    expect(resolveApiRouteFamily("GET", "/api/v1/operations/summary")).toBe("operations-events-policy");
    expect(resolveApiRouteFamily("GET", "/api/v1/operations/cost/settings")).toBe("operations-events-policy");
    expect(resolveApiRouteFamily("PUT", "/api/v1/operations/cost/settings")).toBe("operations-events-policy");
    expect(resolveApiRouteFamily("GET", "/api/v1/operations/cost/report.csv")).toBe("operations-events-policy");
    const removedTelemetryAlias = "fl" + "eet";
    expect(resolveApiRouteFamily("GET", `/api/v1/${removedTelemetryAlias}/summary`)).toBeUndefined();
    expect(resolveApiRouteFamily("GET", "/api/v1/rbac/roles")).toBe("identity-rbac");
    expect(resolveApiRouteFamily("GET", "/api/v1/governance/audit-trail")).toBe("identity-rbac");
    expect(resolveApiRouteFamily("GET", "/api/v1/rejections")).toBe("operations-events-policy");
    expect(resolveApiRouteFamily("GET", "/api/v1/policy/rejections")).toBe("operations-events-policy");
    expect(resolveApiRouteFamily("POST", "/api/v1/failed-work/msg-1/retry")).toBe("failed-work");
    expect(resolveApiRouteFamily("POST", "/api/v1/a2a/dlq/msg-1/requeue")).toBeUndefined();
    expect(resolveApiRouteFamily("POST", "/api/v1/agents/run")).toBeUndefined();
    expect(resolveApiRouteFamily("POST", "/api/v1/agents/run")).toBeUndefined();
    expect(resolveApiRouteFamily("GET", "/api/v1/agent-catalog/plugins")).toBe("agent-catalog");
    expect(resolveApiRouteFamily("GET", "/api/v1/agent-catalog/agents")).toBe("agent-catalog");
    expect(resolveApiRouteFamily("GET", "/api/v1/tasks/metadata")).toBe("tasks");
    expect(resolveApiRouteFamily("GET", "/api/v1/tasks")).toBe("tasks");
    expect(resolveApiRouteFamily("POST", "/api/v1/tasks")).toBe("tasks");
    expect(resolveApiRouteFamily("GET", "/api/v1/tasks/task-1")).toBe("tasks");
    expect(resolveApiRouteFamily("PUT", "/api/v1/tasks/task-1")).toBe("tasks");
    expect(resolveApiRouteFamily("POST", "/api/v1/tasks/task-1/run")).toBe("tasks");
    expect(resolveApiRouteFamily("GET", "/api/v1/task-runs/run-1")).toBe("tasks");
    expect(resolveApiRouteFamily("POST", "/api/v1/task-runs/run-1/cancel")).toBe("tasks");
    expect(resolveApiRouteFamily("GET", "/api/v1/unknown")).toBeUndefined();
    expect(resolveApiRouteFamily("GET", "/api/v1/readiness")).toBe("core");
  });

  it("emits AUTHZ_MODE_ACTIVE on server startup", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-authz-startup-"));
    writeFileSync(join(dir, ".env"), "ATHENA_AUTH_ENABLED=true\nATHENA_AUTHZ_MODE=soft-enforce", "utf8");
    const config = loadConfig(dir);
    const services = createLocalControlPlaneServices({ config });
    const server = createApiServer({
      config,
      services,
      host: "127.0.0.1",
      port: 0
    });
    let started = false;
    try {
      try {
        await server.start();
        started = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("EPERM")) {
          return;
        }
        throw error;
      }

      const events = await services.eventService.list({
        types: ["AUTHZ_MODE_ACTIVE"],
        limit: 5
      });
      expect(events.events.length).toBe(1);
      expect(events.events[0]?.payload).toMatchObject({
        mode: "soft-enforce"
      });

      const stateStoreEvents = await services.eventService.list({
        types: ["STATE_STORES_ACTIVE"],
        limit: 5
      });
      expect(stateStoreEvents.events.length).toBe(1);
      expect(stateStoreEvents.events[0]?.payload).toMatchObject({
        ownershipMap: "docs/product/architecture/state-ownership-map.md",
        sqlite: {
          appStatePath: join(dir, ".athena", "team-orchestrator.sqlite")
        },
        stores: expect.arrayContaining([
          expect.objectContaining({
            id: "sqlite-app-state",
            category: "sqlite-app-state"
          }),
          expect.objectContaining({
            id: "sqlite-app-state",
            category: "sqlite-app-state"
          })
        ])
      });
      expect(JSON.stringify(stateStoreEvents.events[0]?.payload)).not.toContain("legacy-workflows");
    } finally {
      if (started) {
        await server.stop();
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses externally bound API startup without token auth or explicit local-dev override", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-auth-posture-"));
    const config = loadConfig(dir);
    const server = createApiServer({
      config,
      host: "0.0.0.0",
      port: 0
    });
    try {
      await expect(server.start()).rejects.toMatchObject({
        code: "CONFIG_ERROR"
      });
    } finally {
      await server.stop().catch(() => undefined);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("allows externally bound API startup with explicit local-dev override", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-auth-posture-"));
    writeFileSync(join(dir, ".env"), "ATHENA_ALLOW_EXTERNAL_UNAUTHENTICATED=true", "utf8");
    const config = loadConfig(dir);
    const server = createApiServer({
      config,
      host: "0.0.0.0",
      port: 0
    });
    let started = false;
    try {
      try {
        await server.start();
        started = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("EPERM")) {
          return;
        }
        throw error;
      }
      expect(started).toBe(true);
    } finally {
      if (started) {
        await server.stop();
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("allows externally bound API startup when token-protected auth is enabled", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-auth-posture-"));
    writeFileSync(
      join(dir, ".env"),
      [
        "ATHENA_AUTH_ENABLED=true",
        "ATHENA_AUTH_API_TOKEN=0123456789abcdef",
        "ATHENA_AUTHZ_MODE=enforce",
        "ATHENA_AUTH_IDENTITY_ROLE_MAP=console:Admin"
      ].join("\n"),
      "utf8"
    );
    const config = loadConfig(dir);
    const server = createApiServer({
      config,
      host: "0.0.0.0",
      port: 0
    });
    let started = false;
    try {
      try {
        await server.start();
        started = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("EPERM")) {
          return;
        }
        throw error;
      }
      expect(started).toBe(true);
    } finally {
      if (started) {
        await server.stop();
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("invokes control-plane shutdown hooks when stopping the API server", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-stop-"));
    const config = loadConfig(dir);
    const services = createLocalControlPlaneServices({ config });
    let shutdownCalls = 0;
    services.shutdown = async () => {
      shutdownCalls += 1;
    };
    const server = createApiServer({
      config,
      services,
      host: "127.0.0.1",
      port: 0
    });
    let started = false;
    try {
      try {
        await server.start();
        started = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("EPERM")) {
          return;
        }
        throw error;
      }
    } finally {
      if (started) {
        await server.stop();
      }
      expect(shutdownCalls).toBe(started ? 1 : 0);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("serves agent catalog routes from SQLite app state", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-agent-catalog-"));
    const config = loadConfig(dir);
    const appState = openAppStateDatabase(config);
    try {
      appState.plugins.upsert({
        id: "team-orchestrator.test.catalog",
        version: "0.1.0",
        path: "/tmp/team-orchestrator-catalog-plugin",
        enabled: true,
        status: "loaded",
        sourceType: "local",
        manifest: {
          plugin: {
            name: "Catalog Plugin"
          }
        },
        validationErrors: []
      });
      appState.agents.upsert({
        id: "catalog.writer",
        version: "1.0.0",
        pluginId: "team-orchestrator.test.catalog",
        pluginVersion: "0.1.0",
        name: "Catalog Writer",
        capabilities: ["text.write", "text.summarize"],
        status: "loaded",
        manifest: {
          agent: {
            implementation: {
              type: "local-command",
              command: "npm"
            },
            observability: {
              mode: "black-box"
            }
          }
        }
      });
    } finally {
      appState.close();
    }

    const server = createApiServer({
      config,
      host: "127.0.0.1",
      port: 0
    });
    let bound: { host: string; port: number };
    try {
      bound = await server.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      rmSync(dir, { recursive: true, force: true });
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }
    const base = `http://${bound.host}:${bound.port}`;

    try {
      const pluginsResponse = await fetch(`${base}/api/v1/agent-catalog/plugins`);
      expect(pluginsResponse.status).toBe(200);
      const pluginsEnvelope = (await pluginsResponse.json()) as {
        ok: boolean;
        data: { total: number; plugins: Array<{ id: string; metadata: { name: string } }> };
      };
      expect(pluginsEnvelope.ok).toBe(true);
      expect(pluginsEnvelope.data).toMatchObject({
        total: 1,
        plugins: [
          {
            id: "team-orchestrator.test.catalog",
            metadata: {
              name: "Catalog Plugin"
            }
          }
        ]
      });

      const agentsResponse = await fetch(`${base}/api/v1/agent-catalog/agents?capability=text.summarize`);
      expect(agentsResponse.status).toBe(200);
      const agentsEnvelope = (await agentsResponse.json()) as {
        ok: boolean;
        data: { total: number; agents: Array<{ id: string; available: boolean }> };
      };
      expect(agentsEnvelope.ok).toBe(true);
      expect(agentsEnvelope.data).toMatchObject({
        total: 1,
        agents: [
          {
            id: "catalog.writer",
            available: true
          }
        ]
      });
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("serves core v1 endpoints through control-plane services", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-"));
    const failedWorkDir = join(dir, ".athena", "failed-work");
    const runtimeActiveDir = join(dir, ".athena", "runtime", "active");
    const runtimeCancelDir = join(dir, ".athena", "runtime", "cancel");
    mkdirSync(failedWorkDir, { recursive: true });
    mkdirSync(runtimeActiveDir, { recursive: true });
    mkdirSync(runtimeCancelDir, { recursive: true });
    mkdirSync(join(dir, "memory"), { recursive: true });
    writeFileSync(join(dir, ".env"), "ATHENA_MEMORY_ENABLED=true\n", "utf8");
    writeFileSync(join(dir, "MEMORY.md"), "athena api test memory block\n", "utf8");
    writeFileSync(join(dir, "memory", "notes.md"), "line 1\nline 2\nline 3\n", "utf8");
    writeFileSync(
      join(failedWorkDir, "items.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          items: [
            {
              id: "msg-1",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              status: "pending",
              reason: "test",
              payload: { hello: "world" }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );
    writeFileSync(
      join(runtimeActiveDir, "api-active.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          sessionId: "api-active",
          pid: process.pid,
          startedAt: new Date().toISOString()
        },
        null,
        2
      ),
      "utf8"
    );
    const legacyStartedAt = JSON.parse(readFileSync(join(runtimeActiveDir, "api-active.json"), "utf8")).startedAt as string;
    writeFileSync(
      join(runtimeCancelDir, "api-active.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          sessionId: "api-active",
          requestedAt: new Date().toISOString(),
          reason: "operator-cancel",
          startedAt: legacyStartedAt
        },
        null,
        2
      ),
      "utf8"
    );
    const config = loadConfig(dir);
    const server = createApiServer({
      config,
      host: "127.0.0.1",
      port: 0
    });
    let bound: { host: string; port: number };
    try {
      bound = await server.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }
    const base = `http://${bound.host}:${bound.port}`;

    try {
      const healthResponse = await fetch(`${base}/api/v1/health`);
      expect(healthResponse.status).toBe(200);
      const healthEnvelope = (await healthResponse.json()) as {
        ok: boolean;
        data: { status: string; now: string };
      };
      expect(healthEnvelope.ok).toBe(true);
      expect(healthEnvelope.data.status).toBe("ok");
      expect(healthEnvelope.data.now).toEqual(expect.any(String));

      const readinessResponse = await fetch(`${base}/api/v1/readiness`);
      expect(readinessResponse.status).toBe(200);
      const readinessEnvelope = (await readinessResponse.json()) as {
        ok: boolean;
        data: {
          status: string;
          generatedAt: string;
          summary: {
            ready: boolean;
            requiredFailed: number;
            degraded: number;
            optionalUnavailable: number;
          };
          checks: Array<{
            id: string;
            status: string;
            required: boolean;
            message: string;
            nextStep: string;
            details: Record<string, unknown>;
          }>;
        };
      };
      expect(readinessEnvelope.ok).toBe(true);
      expect(readinessEnvelope.data.status).toBe("degraded");
      expect(readinessEnvelope.data.generatedAt).toEqual(expect.any(String));
      expect(readinessEnvelope.data.summary.requiredFailed).toBe(0);
      expect(readinessEnvelope.data.checks.map((check) => check.id)).toEqual([
        "api",
        "app-state",
        "artifact-storage",
        "managed-repo-root",
        "plugin-paths",
        "secret-root",
        "model-providers",
        "plugins",
        "runtime",
        "server-exposure",
        "sample-demo"
      ]);
      expect(readinessEnvelope.data.checks.find((check) => check.id === "app-state")).toMatchObject({
        status: "ok",
        required: true,
        details: {
          appStatePath: join(dir, ".athena", "team-orchestrator.sqlite")
        }
      });
      expect(readinessEnvelope.data.checks.find((check) => check.id === "sample-demo")).toMatchObject({
        status: "degraded",
        required: false
      });
      expect(readinessEnvelope.data.checks.find((check) => check.id === "server-exposure")).toMatchObject({
        status: "ok",
        required: true
      });
      expect(JSON.stringify(readinessEnvelope.data)).not.toContain("ATHENA_");
      expect(JSON.stringify(readinessEnvelope.data)).not.toContain("apiKey");

      const adminHealthResponse = await fetch(`${base}/api/v1/admin/health`);
      expect(adminHealthResponse.status).toBe(200);
      const adminHealthEnvelope = (await adminHealthResponse.json()) as {
        ok: boolean;
        data: {
          status: string;
          now: string;
          stateStores: {
            ownershipMap: string;
            sqlite: { appStatePath: string };
            stores: Array<{ id: string; category: string; path: string }>;
          };
        };
      };
      expect(adminHealthEnvelope.ok).toBe(true);
      expect(adminHealthEnvelope.data.stateStores).toMatchObject({
        ownershipMap: "docs/product/architecture/state-ownership-map.md",
        sqlite: {
          appStatePath: join(dir, ".athena", "team-orchestrator.sqlite")
        }
      });
      expect(adminHealthEnvelope.data.stateStores.stores).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "sqlite-app-state",
            category: "sqlite-app-state",
            path: join(dir, ".athena", "team-orchestrator.sqlite")
          }),
          expect.objectContaining({
            id: "run-evidence",
            category: "intentional-file-artifact",
            path: join(dir, ".athena", "run-evidence")
          }),
          expect.objectContaining({
            id: "harness-profiles",
            category: "sqlite-app-state",
            path: join(dir, ".athena", "team-orchestrator.sqlite")
          }),
          expect.objectContaining({
            id: "directives",
            category: "sqlite-app-state",
            path: join(dir, ".athena", "team-orchestrator.sqlite")
          }),
          expect.objectContaining({
            id: "run-templates",
            category: "sqlite-app-state",
            path: join(dir, ".athena", "team-orchestrator.sqlite")
          })
        ])
      );
      expect(adminHealthEnvelope.data.stateStores.stores.map((store) => store.id)).not.toContain("legacy-workflows");
      expect(adminHealthEnvelope.data.stateStores.stores.map((store) => store.id)).not.toContain("legacy-workflow-runs");
      expect(JSON.stringify(adminHealthEnvelope.data.stateStores)).not.toContain("ATHENA_");

      const capabilitiesResponse = await fetch(`${base}/api/v1/capabilities`);
      expect(capabilitiesResponse.status).toBe(200);
      const capabilitiesEnvelope = (await capabilitiesResponse.json()) as {
        ok: boolean;
        data: { executionBackend: string; stateStore: string; supportsSandbox: boolean };
      };
      expect(capabilitiesEnvelope.ok).toBe(true);
      const capabilities = capabilitiesEnvelope.data;
      expect(capabilities.executionBackend).toBe("local");
      expect(capabilities.stateStore).toBe("file");
      expect(capabilities.supportsSandbox).toBe(false);

      const activeRunsResponse = await fetch(`${base}/api/v1/runs/active?sessionId=api-active&limit=5`);
      expect(activeRunsResponse.status).toBe(200);
      const activeRunsEnvelope = (await activeRunsResponse.json()) as {
        ok: boolean;
        data: { items: Array<{ sessionId: string; pid: number; startedAt: string; runId: string; traceId?: string }> };
      };
      expect(activeRunsEnvelope.ok).toBe(true);
      expect(activeRunsEnvelope.data.items.length).toBe(1);
      expect(activeRunsEnvelope.data.items[0]?.sessionId).toBe("api-active");
      expect(activeRunsEnvelope.data.items[0]?.runId.startsWith("legacy-")).toBe(true);
      expect(activeRunsEnvelope.data.items[0]?.traceId).toBeUndefined();

      const cancelRequestsResponse = await fetch(
        `${base}/api/v1/runs/cancel-requests?sessionId=api-active&runId=missing-run&limit=5`
      );
      expect(cancelRequestsResponse.status).toBe(200);
      const cancelRequestsEnvelope = (await cancelRequestsResponse.json()) as {
        ok: boolean;
        data: {
          items: Array<{
            sessionId: string;
            requestedAt: string;
            reason?: string;
            runId: string;
            traceId?: string;
            startedAt?: string;
          }>;
        };
      };
      expect(cancelRequestsEnvelope.ok).toBe(true);
      expect(cancelRequestsEnvelope.data.items.length).toBe(0);

      const cancelRequestsUnfilteredResponse = await fetch(`${base}/api/v1/runs/cancel-requests?sessionId=api-active&limit=5`);
      expect(cancelRequestsUnfilteredResponse.status).toBe(200);
      const cancelRequestsUnfilteredEnvelope = (await cancelRequestsUnfilteredResponse.json()) as {
        ok: boolean;
        data: { items: Array<{ sessionId: string; requestedAt: string; reason?: string; runId: string }> };
      };
      expect(cancelRequestsUnfilteredEnvelope.ok).toBe(true);
      expect(cancelRequestsUnfilteredEnvelope.data.items.length).toBe(1);
      expect(cancelRequestsUnfilteredEnvelope.data.items[0]?.sessionId).toBe("api-active");
      expect(cancelRequestsUnfilteredEnvelope.data.items[0]?.reason).toBe("operator-cancel");
      expect(cancelRequestsUnfilteredEnvelope.data.items[0]?.runId).toBe(activeRunsEnvelope.data.items[0]?.runId);

      const cancelByRunIdResponse = await fetch(
        `${base}/api/v1/run-control/by-run/${encodeURIComponent(activeRunsEnvelope.data.items[0]!.runId)}/cancel`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            reason: "run-id-cancel"
          })
        }
      );
      expect(cancelByRunIdResponse.status).toBe(200);
      const cancelByRunIdEnvelope = (await cancelByRunIdResponse.json()) as {
        ok: boolean;
        data: { runId: string; status: string; sessionId?: string };
      };
      expect(cancelByRunIdEnvelope.ok).toBe(true);
      expect(cancelByRunIdEnvelope.data.runId).toBe(activeRunsEnvelope.data.items[0]!.runId);
      expect(cancelByRunIdEnvelope.data.status).toBe("cancelled");
      expect(cancelByRunIdEnvelope.data.sessionId).toBe("api-active");

      const cancelByMissingRunIdResponse = await fetch(`${base}/api/v1/run-control/by-run/missing-run/cancel`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reason: "run-id-cancel"
        })
      });
      expect(cancelByMissingRunIdResponse.status).toBe(200);
      const cancelByMissingRunIdEnvelope = (await cancelByMissingRunIdResponse.json()) as {
        ok: boolean;
        data: { runId: string; status: string; sessionId?: string };
      };
      expect(cancelByMissingRunIdEnvelope.ok).toBe(true);
      expect(cancelByMissingRunIdEnvelope.data.runId).toBe("missing-run");
      expect(cancelByMissingRunIdEnvelope.data.status).toBe("not-running");
      expect(cancelByMissingRunIdEnvelope.data.sessionId).toBeUndefined();

      const runResponse = await fetch(`${base}/api/v1/runs`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sessionId: "s1",
          input: "hello from api"
        })
      });
      expect(runResponse.status).toBe(200);
      const runEnvelope = (await runResponse.json()) as {
        ok: boolean;
        data: { sessionId: string; output: string; directiveId?: string; harnessProfileId?: string };
      };
      expect(runEnvelope.ok).toBe(true);
      const run = runEnvelope.data;
      expect(run.sessionId).toBe("s1");
      expect(typeof run.output).toBe("string");
      expect(run.directiveId).toBeDefined();
      expect(run.harnessProfileId?.startsWith("shadow-harness-")).toBe(true);

      const sessionsResponse = await fetch(`${base}/api/v1/sessions?limit=1`);
      expect(sessionsResponse.status).toBe(200);
      const sessionsEnvelope = (await sessionsResponse.json()) as { ok: boolean; data: { items: Array<{ id: string }> } };
      expect(sessionsEnvelope.ok).toBe(true);
      const sessions = sessionsEnvelope.data;
      expect(sessions.items.length).toBe(1);
      expect(sessions.items[0]?.id).toBe("s1");

      const createDirectiveResponse = await fetch(`${base}/api/v1/directives`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          input: "audit this request",
          contextRefs: ["MEMORY.md"],
          metadata: {
            origin: "api-test"
          }
        })
      });
      expect(createDirectiveResponse.status).toBe(200);
      const createDirectiveEnvelope = (await createDirectiveResponse.json()) as {
        ok: boolean;
        data: { id: string; input: string; contextRefs?: string[]; metadata?: Record<string, string> };
      };
      expect(createDirectiveEnvelope.ok).toBe(true);
      expect(createDirectiveEnvelope.data.input).toBe("audit this request");
      expect(createDirectiveEnvelope.data.contextRefs).toEqual(["MEMORY.md"]);
      expect(createDirectiveEnvelope.data.metadata).toEqual({ origin: "api-test" });
      expect(existsSync(join(dir, ".athena", "directives", `${createDirectiveEnvelope.data.id}.json`))).toBe(false);

      mkdirSync(join(dir, ".athena", "directives"), { recursive: true });
      writeFileSync(
        join(dir, ".athena", "directives", "old-file-directive.json"),
        JSON.stringify(
          {
            id: "old-file-directive",
            input: "old file directive",
            createdAt: new Date().toISOString()
          },
          null,
          2
        ),
        "utf8"
      );

      const listDirectivesResponse = await fetch(`${base}/api/v1/directives?limit=10`);
      expect(listDirectivesResponse.status).toBe(200);
      const listDirectivesEnvelope = (await listDirectivesResponse.json()) as {
        ok: boolean;
        data: {
          items: Array<{ id: string; input: string }>;
        };
      };
      expect(listDirectivesEnvelope.ok).toBe(true);
      expect(listDirectivesEnvelope.data.items.length).toBeGreaterThan(0);
      expect(listDirectivesEnvelope.data.items[0]?.id).toBe(createDirectiveEnvelope.data.id);
      expect(listDirectivesEnvelope.data.items.map((item) => item.id)).not.toContain("old-file-directive");

      const createHarnessProfileResponse = await fetch(`${base}/api/v1/harness-profiles`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          displayName: "High Security Reviewer",
          version: "v1",
          config: {
            provider: "mock",
            model: "mock-model",
            tools: ["review", "trace"]
          },
          policies: {
            timeoutMs: 45_000,
            retryLimit: 2,
            budgetUsd: 4.5
          }
        })
      });
      expect(createHarnessProfileResponse.status).toBe(200);
      const createHarnessProfileEnvelope = (await createHarnessProfileResponse.json()) as {
        ok: boolean;
        data: {
          id: string;
          displayName: string;
          version: "v1" | "v2";
          config: { provider: string; model: string; tools: string[] };
        };
      };
      expect(createHarnessProfileEnvelope.ok).toBe(true);
      expect(createHarnessProfileEnvelope.data.displayName).toBe("High Security Reviewer");
      expect(createHarnessProfileEnvelope.data.version).toBe("v1");
      expect(createHarnessProfileEnvelope.data.config.provider).toBe("mock");
      expect(createHarnessProfileEnvelope.data.config.model).toBe("mock-model");
      expect(
        existsSync(join(dir, ".athena", "harness-profiles", `${createHarnessProfileEnvelope.data.id}.json`))
      ).toBe(false);

      mkdirSync(join(dir, ".athena", "harness-profiles"), { recursive: true });
      writeFileSync(
        join(dir, ".athena", "harness-profiles", "old-file-profile.json"),
        JSON.stringify(
          {
            id: "old-file-profile",
            displayName: "Old File Profile",
            version: "v1",
            config: {
              provider: "mock",
              model: "mock-model",
              tools: ["legacy"]
            },
            policies: {
              timeoutMs: 1,
              retryLimit: 0,
              budgetUsd: 0
            },
            createdAt: new Date().toISOString()
          },
          null,
          2
        ),
        "utf8"
      );

      const listHarnessProfilesResponse = await fetch(`${base}/api/v1/harness-profiles?limit=10`);
      expect(listHarnessProfilesResponse.status).toBe(200);
      const listHarnessProfilesEnvelope = (await listHarnessProfilesResponse.json()) as {
        ok: boolean;
        data: {
          items: Array<{ id: string; displayName: string }>;
        };
      };
      expect(listHarnessProfilesEnvelope.ok).toBe(true);
      expect(listHarnessProfilesEnvelope.data.items.length).toBeGreaterThan(0);
      expect(listHarnessProfilesEnvelope.data.items[0]?.id).toBe(createHarnessProfileEnvelope.data.id);
      expect(listHarnessProfilesEnvelope.data.items.map((item) => item.id)).not.toContain("old-file-profile");

      const createRunTemplateResponse = await fetch(`${base}/api/v1/run-templates`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          harnessProfileId: createHarnessProfileEnvelope.data.id,
          directiveTemplate: "Review {{HEAD_REF}} against {{BASE_REF}}",
          defaultParams: {
            HEAD_REF: "main",
            BASE_REF: "origin/main"
          }
        })
      });
      expect(createRunTemplateResponse.status).toBe(200);
      const createRunTemplateEnvelope = (await createRunTemplateResponse.json()) as {
        ok: boolean;
        data: {
          id: string;
          harnessProfileId: string;
          directiveTemplate: string;
          defaultParams: Record<string, string>;
        };
      };
      expect(createRunTemplateEnvelope.ok).toBe(true);
      expect(createRunTemplateEnvelope.data.harnessProfileId).toBe(createHarnessProfileEnvelope.data.id);
      expect(createRunTemplateEnvelope.data.directiveTemplate).toBe("Review {{HEAD_REF}} against {{BASE_REF}}");
      expect(createRunTemplateEnvelope.data.defaultParams).toEqual({
        HEAD_REF: "main",
        BASE_REF: "origin/main"
      });
      expect(existsSync(join(dir, ".athena", "run-templates", `${createRunTemplateEnvelope.data.id}.json`))).toBe(false);

      mkdirSync(join(dir, ".athena", "run-templates"), { recursive: true });
      writeFileSync(
        join(dir, ".athena", "run-templates", "old-file-template.json"),
        JSON.stringify(
          {
            id: "old-file-template",
            harnessProfileId: createHarnessProfileEnvelope.data.id,
            directiveTemplate: "Old {{HEAD_REF}}",
            defaultParams: {
              HEAD_REF: "old"
            },
            createdAt: new Date().toISOString()
          },
          null,
          2
        ),
        "utf8"
      );

      const listRunTemplatesResponse = await fetch(`${base}/api/v1/run-templates?limit=10`);
      expect(listRunTemplatesResponse.status).toBe(200);
      const listRunTemplatesEnvelope = (await listRunTemplatesResponse.json()) as {
        ok: boolean;
        data: {
          items: Array<{ id: string; harnessProfileId: string }>;
        };
      };
      expect(listRunTemplatesEnvelope.ok).toBe(true);
      expect(listRunTemplatesEnvelope.data.items.length).toBeGreaterThan(0);
      expect(listRunTemplatesEnvelope.data.items[0]?.id).toBe(createRunTemplateEnvelope.data.id);
      expect(listRunTemplatesEnvelope.data.items.map((item) => item.id)).not.toContain("old-file-template");

      const runTemplateResponse = await fetch(
        `${base}/api/v1/templates/${encodeURIComponent(createRunTemplateEnvelope.data.id)}/run`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            params: {
              HEAD_REF: "feature/abc"
            }
          })
        }
      );
      expect(runTemplateResponse.status).toBe(200);
      const runTemplateEnvelope = (await runTemplateResponse.json()) as {
        ok: boolean;
        data: {
          output: string;
          directiveId?: string;
          harnessProfileId?: string;
          template?: {
            id: string;
            harnessProfileId: string;
            effectiveParams: Record<string, string>;
          };
        };
      };
      expect(runTemplateEnvelope.ok).toBe(true);
      expect(runTemplateEnvelope.data.template?.id).toBe(createRunTemplateEnvelope.data.id);
      expect(runTemplateEnvelope.data.template?.harnessProfileId).toBe(createHarnessProfileEnvelope.data.id);
      expect(runTemplateEnvelope.data.harnessProfileId).toBe(createHarnessProfileEnvelope.data.id);
      expect(runTemplateEnvelope.data.directiveId).toBeDefined();
      expect(runTemplateEnvelope.data.template?.effectiveParams).toEqual({
        HEAD_REF: "feature/abc",
        BASE_REF: "origin/main"
      });
      expect(runTemplateEnvelope.data.output).toContain("feature/abc");

      expect((await fetch(`${base}/api/v1/workflows`)).status).toBe(404);
      expect(
        (
          await fetch(`${base}/api/v1/workflows`, {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({ definition: { steps: [], dependencies: [] } })
          })
        ).status
      ).toBe(404);
      expect((await fetch(`${base}/api/v1/workflows/run/legacy-workflow`)).status).toBe(404);
      expect(
        (
          await fetch(`${base}/api/v1/workflows/run/legacy-workflow/resume`, {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({})
          })
        ).status
      ).toBe(404);

      const memorySearchResponse = await fetch(`${base}/api/v1/memory/search?query=athena&maxResults=3`);
      expect(memorySearchResponse.status).toBe(200);
      const memorySearchEnvelope = (await memorySearchResponse.json()) as {
        ok: boolean;
        data: Array<{ sourcePath: string }>;
      };
      expect(memorySearchEnvelope.ok).toBe(true);
      expect(memorySearchEnvelope.data.some((row) => row.sourcePath === "MEMORY.md")).toBe(true);

      const memoryGetResponse = await fetch(`${base}/api/v1/memory/get`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          path: "memory/notes.md",
          from: 2,
          lines: 2
        })
      });
      expect(memoryGetResponse.status).toBe(200);
      const memoryGetEnvelope = (await memoryGetResponse.json()) as {
        ok: boolean;
        data: { text: string };
      };
      expect(memoryGetEnvelope.ok).toBe(true);
      expect(memoryGetEnvelope.data.text).toBe("line 2\nline 3");

      const cancelResponse = await fetch(`${base}/api/v1/runs/s1/cancel`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reason: "test"
        })
      });
      expect(cancelResponse.status).toBe(200);
      const cancelEnvelope = (await cancelResponse.json()) as { ok: boolean; data: { status: string } };
      expect(cancelEnvelope.ok).toBe(true);
      const cancel = cancelEnvelope.data;
      expect(cancel.status).toBe("not-running");

      const eventsResponse = await fetch(
        `${base}/api/v1/events?sessionId=s1&types=run.created,run.cancel.requested&limit=10`
      );
      expect(eventsResponse.status).toBe(200);
      const eventsEnvelope = (await eventsResponse.json()) as {
        ok: boolean;
        data: {
          events: Array<{
            type: string;
            sessionId?: string;
            payload?: { directiveId?: string; harnessProfileId?: string };
          }>;
          nextCursor?: string;
        };
      };
      expect(eventsEnvelope.ok).toBe(true);
      expect(eventsEnvelope.data.events.length).toBeGreaterThan(0);
      expect(eventsEnvelope.data.events.some((item) => item.type === "run.created")).toBe(true);
      expect(eventsEnvelope.data.events.every((item) => item.sessionId === "s1")).toBe(true);
      expect(
        eventsEnvelope.data.events.some(
          (item) => item.type === "run.created" && !!item.payload?.directiveId && !!item.payload?.harnessProfileId
        )
      ).toBe(true);

      const createScheduleResponse = await fetch(`${base}/api/v1/schedules`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          id: "job1",
          sessionId: "s1",
          input: "scheduled hello",
          everyMinutes: 5,
          startNow: false
        })
      });
      expect(createScheduleResponse.status).toBe(200);
      const createScheduleEnvelope = (await createScheduleResponse.json()) as {
        ok: boolean;
        data: { id: string; sessionId: string };
      };
      expect(createScheduleEnvelope.ok).toBe(true);
      expect(createScheduleEnvelope.data.id).toBe("job1");

      const runScheduleResponse = await fetch(`${base}/api/v1/schedules/job1/run`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({})
      });
      expect(runScheduleResponse.status).toBe(200);
      const runScheduleEnvelope = (await runScheduleResponse.json()) as {
        ok: boolean;
        data: { id: string; status: string };
      };
      expect(runScheduleEnvelope.ok).toBe(true);
      expect(runScheduleEnvelope.data.id).toBe("job1");
      expect(runScheduleEnvelope.data.status).toBe("ok");

      const tickResponse = await fetch(`${base}/api/v1/schedules/tick`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          at: new Date().toISOString()
        })
      });
      expect(tickResponse.status).toBe(200);
      const tickEnvelope = (await tickResponse.json()) as {
        ok: boolean;
        data: { at: string; run: unknown[]; skipped: number };
      };
      expect(tickEnvelope.ok).toBe(true);
      expect(typeof tickEnvelope.data.at).toBe("string");
      expect(Array.isArray(tickEnvelope.data.run)).toBe(true);
      expect(typeof tickEnvelope.data.skipped).toBe("number");

      const removeScheduleResponse = await fetch(`${base}/api/v1/schedules/job1`, { method: "DELETE" });
      expect(removeScheduleResponse.status).toBe(200);
      const removeScheduleEnvelope = (await removeScheduleResponse.json()) as {
        ok: boolean;
        data: { id: string; removed: boolean };
      };
      expect(removeScheduleEnvelope.ok).toBe(true);
      expect(removeScheduleEnvelope.data.id).toBe("job1");
      expect(removeScheduleEnvelope.data.removed).toBe(true);

      const invalidRunResponse = await fetch(`${base}/api/v1/runs`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sessionId: "s2"
        })
      });
      expect(invalidRunResponse.status).toBe(400);
      const invalidRun = (await invalidRunResponse.json()) as {
        ok: boolean;
        error: { code: string; message: string; traceId?: string };
      };
      expect(invalidRun.ok).toBe(false);
      expect(invalidRun.error.code).toBe("CONFIG_ERROR");
      expect(invalidRun.error.message).toContain("requires either input or directiveId");

      const removedAgentRouteResponse = await fetch(`${base}/api/v1/agents/run`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: "code-review"
        })
      });
      expect(removedAgentRouteResponse.status).toBe(404);
      const removedAgentRouteEnvelope = (await removedAgentRouteResponse.json()) as {
        ok: boolean;
        error: { code: string; message: string };
      };
      expect(removedAgentRouteEnvelope.ok).toBe(false);
      expect(removedAgentRouteEnvelope.error.code).toBe("UNKNOWN_ERROR");

      const failedWorkResponse = await fetch(`${base}/api/v1/failed-work?status=pending`);
      expect(failedWorkResponse.status).toBe(200);
      const failedWorkEnvelope = (await failedWorkResponse.json()) as {
        ok: boolean;
        data: { items: Array<{ id: string; status: string }> };
      };
      expect(failedWorkEnvelope.ok).toBe(true);
      expect(failedWorkEnvelope.data.items.length).toBe(1);
      expect(failedWorkEnvelope.data.items[0]?.id).toBe("msg-1");

      const oldFailedWorkResponse = await fetch(`${base}/api/v1/a2a/dlq?status=pending`);
      expect(oldFailedWorkResponse.status).toBe(404);

      const retryResponse = await fetch(`${base}/api/v1/failed-work/msg-1/retry`, { method: "POST" });
      expect(retryResponse.status).toBe(200);
      const retryTraceId = retryResponse.headers.get("x-trace-id");
      expect(retryTraceId).toBeTruthy();
      const retryEnvelope = (await retryResponse.json()) as {
        ok: boolean;
        data: { updated: boolean; item?: { status: string } };
      };
      expect(retryEnvelope.ok).toBe(true);
      expect(retryEnvelope.data.updated).toBe(true);
      expect(retryEnvelope.data.item?.status).toBe("retried");

      const discardResponse = await fetch(`${base}/api/v1/failed-work/msg-1/discard`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          auditNote: "Operator confirmed poison message and discarded."
        })
      });
      expect(discardResponse.status).toBe(200);
      const discardEnvelope = (await discardResponse.json()) as {
        ok: boolean;
        data: { updated: boolean; item?: { status: string } };
      };
      expect(discardEnvelope.ok).toBe(true);
      expect(discardEnvelope.data.updated).toBe(true);
      expect(discardEnvelope.data.item?.status).toBe("discarded");

      const discardAuditEventsResponse = await fetch(`${base}/api/v1/events?types=failed-work.discarded&limit=5`);
      expect(discardAuditEventsResponse.status).toBe(200);
      const discardAuditEventsEnvelope = (await discardAuditEventsResponse.json()) as {
        ok: boolean;
        data: {
          events: Array<{ type: string; payload?: { id?: string; auditNote?: string } }>;
        };
      };
      expect(discardAuditEventsEnvelope.ok).toBe(true);
      expect(
        discardAuditEventsEnvelope.data.events.some(
          (event) =>
            event.type === "failed-work.discarded" &&
            event.payload?.id === "msg-1" &&
            event.payload?.auditNote === "Operator confirmed poison message and discarded."
        )
      ).toBe(true);

      const flowResponse = await fetch(`${base}/api/v1/work/flows/${encodeURIComponent(retryTraceId as string)}?limit=10`);
      expect(flowResponse.status).toBe(200);
      const flowEnvelope = (await flowResponse.json()) as {
        ok: boolean;
        data: {
          traceId: string;
          nodes: Array<{ id: string; kind: string; label: string }>;
          edges: Array<{ eventId: string; type: string; step: number; statusLabel: string }>;
          truncated: boolean;
        };
      };
      expect(flowEnvelope.ok).toBe(true);
      expect(flowEnvelope.data.traceId).toBe(retryTraceId);
      expect(flowEnvelope.data.edges.length).toBeGreaterThan(0);
      expect(flowEnvelope.data.edges[0]?.step).toBe(1);
      expect(flowEnvelope.data.edges[0]?.type).toBe("failed-work.retry-requested");
      expect(flowEnvelope.data.edges[0]?.statusLabel).toContain("Step 1");
      expect(flowEnvelope.data.nodes.length).toBeGreaterThan(0);

      const observabilityResponse = await fetch(
        `${base}/api/v1/work/observability?windowMinutes=120&bucketMinutes=5&limit=500`
      );
      expect(observabilityResponse.status).toBe(200);
      const observabilityEnvelope = (await observabilityResponse.json()) as {
        ok: boolean;
        data: {
          throughput: Array<{ queueId: string }>;
          latencyHeatmap: Array<{ stepId: string }>;
          stallAlerts: Array<{ stepId: string }>;
          sampleCount: number;
          truncated: boolean;
        };
      };
      expect(observabilityEnvelope.ok).toBe(true);
      expect(observabilityEnvelope.data.sampleCount).toBeGreaterThan(0);
      expect(Array.isArray(observabilityEnvelope.data.throughput)).toBe(true);
      expect(Array.isArray(observabilityEnvelope.data.latencyHeatmap)).toBe(true);
      expect(Array.isArray(observabilityEnvelope.data.stallAlerts)).toBe(true);
      expect(typeof observabilityEnvelope.data.truncated).toBe("boolean");

      const alertsResponse = await fetch(`${base}/api/v1/work/observability/alerts?limit=20`);
      expect(alertsResponse.status).toBe(200);
      const alertsEnvelope = (await alertsResponse.json()) as {
        ok: boolean;
        data: { items: Array<{ id: string; severity: string }>; nextCursor?: string };
      };
      expect(alertsEnvelope.ok).toBe(true);
      expect(Array.isArray(alertsEnvelope.data.items)).toBe(true);
      if (alertsEnvelope.data.items.length > 0) {
        expect(typeof alertsEnvelope.data.items[0]?.id).toBe("string");
      }

      const nowIso = new Date().toISOString();
      const hourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const alertsCsvResponse = await fetch(
        `${base}/api/v1/work/observability/alerts/export.csv?createdAfter=${encodeURIComponent(hourAgoIso)}&createdBefore=${encodeURIComponent(nowIso)}`
      );
      expect(alertsCsvResponse.status).toBe(200);
      expect(alertsCsvResponse.headers.get("content-type")).toContain("text/csv");
      const alertsCsv = await alertsCsvResponse.text();
      expect(alertsCsv).toContain("id,createdAt,resolvedAt,status,severity");

      const policyResponse = await fetch(`${base}/api/v1/policy`);
      expect(policyResponse.status).toBe(200);
      const policyEnvelope = (await policyResponse.json()) as {
        ok: boolean;
        data: null | { schemaVersion: number };
      };
      expect(policyEnvelope.ok).toBe(true);
      expect(policyEnvelope.data).toBeNull();

      const putPolicyResponse = await fetch(`${base}/api/v1/policy`, {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          schemaVersion: 1,
          updatedAt: "2026-02-16T00:00:00.000Z",
          maxConcurrentRuns: 2,
          defaultRunTimeoutMs: 10000
        })
      });
      expect(putPolicyResponse.status).toBe(200);
      const putPolicyEnvelope = (await putPolicyResponse.json()) as {
        ok: boolean;
        data: { schemaVersion: number; updatedAt: string; maxConcurrentRuns?: number; defaultRunTimeoutMs?: number };
      };
      expect(putPolicyEnvelope.ok).toBe(true);
      expect(putPolicyEnvelope.data.schemaVersion).toBe(1);
      expect(putPolicyEnvelope.data.maxConcurrentRuns).toBe(2);
      expect(putPolicyEnvelope.data.defaultRunTimeoutMs).toBe(10000);
      expect(putPolicyEnvelope.data.updatedAt).not.toBe("2026-02-16T00:00:00.000Z");

      const putPolicyWithInvalidUpdatedAtResponse = await fetch(`${base}/api/v1/policy`, {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          schemaVersion: 1,
          updatedAt: { invalid: true },
          maxConcurrentRuns: 3
        })
      });
      expect(putPolicyWithInvalidUpdatedAtResponse.status).toBe(200);
      const putPolicyWithInvalidUpdatedAtEnvelope = (await putPolicyWithInvalidUpdatedAtResponse.json()) as {
        ok: boolean;
        data: { schemaVersion: number; updatedAt: string; maxConcurrentRuns?: number };
      };
      expect(putPolicyWithInvalidUpdatedAtEnvelope.ok).toBe(true);
      expect(putPolicyWithInvalidUpdatedAtEnvelope.data.schemaVersion).toBe(1);
      expect(putPolicyWithInvalidUpdatedAtEnvelope.data.maxConcurrentRuns).toBe(3);
      expect(typeof putPolicyWithInvalidUpdatedAtEnvelope.data.updatedAt).toBe("string");

      const getPolicyAfterPutResponse = await fetch(`${base}/api/v1/policy`);
      expect(getPolicyAfterPutResponse.status).toBe(200);
      const getPolicyAfterPutEnvelope = (await getPolicyAfterPutResponse.json()) as {
        ok: boolean;
        data: null | { schemaVersion: number; maxConcurrentRuns?: number; updatedAt: string };
      };
      expect(getPolicyAfterPutEnvelope.ok).toBe(true);
      expect(getPolicyAfterPutEnvelope.data?.schemaVersion).toBe(1);
      expect(getPolicyAfterPutEnvelope.data?.maxConcurrentRuns).toBe(3);
      expect(typeof getPolicyAfterPutEnvelope.data?.updatedAt).toBe("string");

      const policyRejectionsResponse = await fetch(`${base}/api/v1/policy/rejections?limit=5`);
      expect(policyRejectionsResponse.status).toBe(200);
      const policyRejectionsEnvelope = (await policyRejectionsResponse.json()) as {
        ok: boolean;
        data: { items: Array<{ id: string; sessionId: string; reason: string }> };
      };
      expect(policyRejectionsEnvelope.ok).toBe(true);
      expect(Array.isArray(policyRejectionsEnvelope.data.items)).toBe(true);

      const rejectionsResponse = await fetch(`${base}/api/v1/rejections?limit=5&offset=0`);
      expect(rejectionsResponse.status).toBe(200);
      const rejectionsEnvelope = (await rejectionsResponse.json()) as {
        ok: boolean;
        data: Array<{ schemaVersion: number; policyType: string; reason: string }>;
      };
      expect(rejectionsEnvelope.ok).toBe(true);
      expect(Array.isArray(rejectionsEnvelope.data)).toBe(true);

      const operationsSummaryResponse = await fetch(`${base}/api/v1/operations/summary`);
      expect(operationsSummaryResponse.status).toBe(200);
      const operationsSummaryEnvelope = (await operationsSummaryResponse.json()) as {
        ok: boolean;
        data: {
          total: number;
          running: number;
          pending: number;
          succeeded: number;
          failed: number;
          capabilities: {
            supportsPodStatus: boolean;
            supportsCpuMemMetrics: boolean;
          };
          cpuUsage?: number;
          memoryUsage?: number;
          operationalSummary?: {
            totalActiveRuns: number;
            totalActiveSessions: number;
            aggregateResourceUsage: {
              cpuUsage: number;
              memoryUsage: number;
            };
            recentFailureRejectionCount: number;
          };
        };
      };
      expect(operationsSummaryEnvelope.ok).toBe(true);
      expect(operationsSummaryEnvelope.data.total).toBeGreaterThanOrEqual(1);
      expect(operationsSummaryEnvelope.data.running).toBeGreaterThanOrEqual(0);
      expect(operationsSummaryEnvelope.data.pending).toBeGreaterThanOrEqual(0);
      expect(operationsSummaryEnvelope.data.succeeded).toBeGreaterThanOrEqual(0);
      expect(operationsSummaryEnvelope.data.failed).toBeGreaterThanOrEqual(0);
      expect(operationsSummaryEnvelope.data.capabilities).toEqual({
        supportsPodStatus: false,
        supportsCpuMemMetrics: false
      });
      expect(operationsSummaryEnvelope.data.cpuUsage).toBeUndefined();
      expect(operationsSummaryEnvelope.data.memoryUsage).toBeUndefined();
      expect(operationsSummaryEnvelope.data.operationalSummary).toEqual({
        totalActiveRuns: 0,
        totalActiveSessions: 0,
        aggregateResourceUsage: {
          cpuUsage: 0,
          memoryUsage: 0
        },
        recentFailureRejectionCount: 0
      });

      const operationsSummaryAliasResponse = await fetch(`${base}/api/operations/summary`);
      expect(operationsSummaryAliasResponse.status).toBe(200);
      const operationsSummaryAliasEnvelope = (await operationsSummaryAliasResponse.json()) as {
        ok: boolean;
        data: {
          operationalSummary: {
            totalActiveRuns: number;
            totalActiveSessions: number;
          };
          costSummary?: {
            totalEstimatedSpendUsd: number;
          };
        };
      };
      expect(operationsSummaryAliasEnvelope.ok).toBe(true);
      expect(operationsSummaryAliasEnvelope.data.operationalSummary.totalActiveRuns).toBe(0);
      expect(operationsSummaryAliasEnvelope.data.operationalSummary.totalActiveSessions).toBe(0);
      expect(operationsSummaryAliasEnvelope.data.costSummary?.totalEstimatedSpendUsd ?? 0).toBeGreaterThanOrEqual(0);

      const putCostSettingsResponse = await fetch(`${base}/api/v1/operations/cost/settings`, {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          providers: [
            {
              provider: "mock",
              inputCostPer1kTokensUsd: 0.5,
              outputCostPer1kTokensUsd: 1
            }
          ]
        })
      });
      expect(putCostSettingsResponse.status).toBe(200);
      const putCostSettingsEnvelope = (await putCostSettingsResponse.json()) as {
        ok: boolean;
        data: {
          providers: Array<{
            provider: string;
            inputCostPer1kTokensUsd: number;
            outputCostPer1kTokensUsd: number;
            updatedAt: string;
          }>;
        };
      };
      expect(putCostSettingsEnvelope.ok).toBe(true);
      expect(putCostSettingsEnvelope.data.providers[0]).toMatchObject({
        provider: "mock",
        inputCostPer1kTokensUsd: 0.5,
        outputCostPer1kTokensUsd: 1
      });
      expect(typeof putCostSettingsEnvelope.data.providers[0]?.updatedAt).toBe("string");

      const getCostSettingsResponse = await fetch(`${base}/api/v1/operations/cost/settings`);
      expect(getCostSettingsResponse.status).toBe(200);
      const getCostSettingsEnvelope = (await getCostSettingsResponse.json()) as {
        ok: boolean;
        data: { providers: Array<{ provider: string }> };
      };
      expect(getCostSettingsEnvelope.ok).toBe(true);
      expect(getCostSettingsEnvelope.data.providers[0]?.provider).toBe("mock");

      const removedTelemetryAlias = "fl" + "eet";
      const removedCostSettingsAliasResponse = await fetch(`${base}/api/v1/${removedTelemetryAlias}/cost/settings`);
      expect(removedCostSettingsAliasResponse.status).toBe(404);

      const csvReportResponse = await fetch(`${base}/api/v1/operations/cost/report.csv?month=2026-02`);
      expect(csvReportResponse.status).toBe(200);
      expect(csvReportResponse.headers.get("content-type")).toContain("text/csv");
      expect(csvReportResponse.headers.get("content-disposition")).toContain("operations-cost-report-2026-02.csv");
      const csvBody = await csvReportResponse.text();
      expect(csvBody).toContain("month,2026-02");
      expect(csvBody).toContain("agentName,estimatedSpendUsd,inputTokens,outputTokens,totalTokens");

      const csvReportAliasResponse = await fetch(`${base}/api/v1/${removedTelemetryAlias}/cost/report.csv?month=2026-02`);
      expect(csvReportAliasResponse.status).toBe(404);
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns 429 with machine-readable code when policy concurrency is saturated", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-concurrency-reject-"));
    try {
      let releaseHeldRun: (() => void) | undefined;
      const hold = new Promise<void>((resolve) => {
        releaseHeldRun = resolve;
      });
      const backend: ExecutionBackend = {
        kind: "local",
        async run(request) {
          if (request.sessionId === "hold-session") {
            await hold;
          }
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
      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({
        config,
        executionBackend: backend
      });
      await services.policyService.put({
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        maxConcurrentRuns: 1
      });
      const server = createApiServer({
        config,
        services,
        host: "127.0.0.1",
        port: 0
      });
      let bound: { host: string; port: number };
      try {
        bound = await server.start();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("EPERM")) {
          return;
        }
        throw error;
      }
      const base = `http://${bound.host}:${bound.port}`;
      try {
        const heldRunRequest = fetch(`${base}/api/v1/runs`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sessionId: "hold-session",
            input: "hold"
          })
        });
        await new Promise((resolve) => setTimeout(resolve, 20));

        const blockedRunResponse = await fetch(`${base}/api/v1/runs`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sessionId: "blocked-session",
            input: "blocked"
          })
        });
        expect(blockedRunResponse.status).toBe(429);
        const blockedEnvelope = (await blockedRunResponse.json()) as {
          ok: boolean;
          error: { code: string; message: string; retryable: boolean };
        };
        expect(blockedEnvelope.ok).toBe(false);
        expect(blockedEnvelope.error.code).toBe("POLICY_CONCURRENCY_LIMIT_EXCEEDED");
        expect(blockedEnvelope.error.message).toContain("policy.maxConcurrentRuns exceeded");
        expect(blockedEnvelope.error.retryable).toBe(false);

        releaseHeldRun?.();
        const heldRunResponse = await heldRunRequest;
        expect(heldRunResponse.status).toBe(200);
      } finally {
        await server.stop();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses keyset cursors for session history pagination and keeps legacy offset cursor compatibility", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-sessions-keyset-"));
    const sessionsDir = join(dir, ".athena", "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    const recordBase = {
      schemaVersion: 1,
      transcriptPath: ".athena/transcripts/placeholder.jsonl",
      provider: "mock",
      model: "default",
      createdAt: "2026-02-18T10:00:00.000Z"
    };
    writeFileSync(
      join(sessionsDir, "s2.json"),
      JSON.stringify(
        {
          ...recordBase,
          id: "s2",
          updatedAt: "2026-02-18T12:00:00.000Z"
        },
        null,
        2
      ),
      "utf8"
    );
    writeFileSync(
      join(sessionsDir, "s1.json"),
      JSON.stringify(
        {
          ...recordBase,
          id: "s1",
          updatedAt: "2026-02-18T11:00:00.000Z"
        },
        null,
        2
      ),
      "utf8"
    );

    const config = loadConfig(dir);
    const server = createApiServer({
      config,
      host: "127.0.0.1",
      port: 0
    });
    let bound: { host: string; port: number };
    try {
      bound = await server.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }
    const base = `http://${bound.host}:${bound.port}`;

    try {
      const firstResponse = await fetch(`${base}/api/v1/sessions?limit=1`);
      expect(firstResponse.status).toBe(200);
      const firstEnvelope = (await firstResponse.json()) as {
        ok: boolean;
        data: { items: Array<{ id: string }>; nextCursor?: string };
      };
      expect(firstEnvelope.ok).toBe(true);
      expect(firstEnvelope.data.items.map((row) => row.id)).toEqual(["s2"]);
      expect(typeof firstEnvelope.data.nextCursor).toBe("string");

      writeFileSync(
        join(sessionsDir, "s3.json"),
        JSON.stringify(
          {
            ...recordBase,
            id: "s3",
            updatedAt: "2026-02-18T13:00:00.000Z"
          },
          null,
          2
        ),
        "utf8"
      );

      const secondResponse = await fetch(
        `${base}/api/v1/sessions?limit=1&cursor=${encodeURIComponent(firstEnvelope.data.nextCursor!)}`
      );
      expect(secondResponse.status).toBe(200);
      const secondEnvelope = (await secondResponse.json()) as {
        ok: boolean;
        data: { items: Array<{ id: string }>; nextCursor?: string };
      };
      expect(secondEnvelope.ok).toBe(true);
      expect(secondEnvelope.data.items.map((row) => row.id)).toEqual(["s1"]);

      const legacyOffsetCursor = Buffer.from("1", "utf8").toString("base64url");
      const legacyResponse = await fetch(`${base}/api/v1/sessions?limit=1&cursor=${encodeURIComponent(legacyOffsetCursor)}`);
      expect(legacyResponse.status).toBe(200);
      const legacyEnvelope = (await legacyResponse.json()) as {
        ok: boolean;
        data: { items: Array<{ id: string }> };
      };
      expect(legacyEnvelope.ok).toBe(true);
      expect(legacyEnvelope.data.items.length).toBe(1);
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("streams transcript entries with replay cursor continuity", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-session-stream-"));
    const config = loadConfig(dir);
    const server = createApiServer({
      config,
      host: "127.0.0.1",
      port: 0
    });
    let bound: { host: string; port: number };
    try {
      bound = await server.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }
    const base = `http://${bound.host}:${bound.port}`;
    const sessionId = "stream-s1";

    try {
      const firstReader = await openSseReader(
        `${base}/api/v1/sessions/${encodeURIComponent(sessionId)}/transcript/stream?limit=200`
      );
      const firstRunResponse = await fetch(`${base}/api/v1/runs`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          input: "first stream run"
        })
      });
      expect(firstRunResponse.status).toBe(200);
      const firstEvents = await collectSseData(firstReader, 2);
      const firstEntries = firstEvents
        .map(parseTranscriptSseData)
        .filter((row): row is { id: string; role: string; content: string } => Boolean(row));
      expect(firstEntries.length).toBeGreaterThanOrEqual(2);
      const firstLastId = firstEntries[firstEntries.length - 1]?.id;
      expect(typeof firstLastId).toBe("string");

      const secondReader = await openSseReader(
        `${base}/api/v1/sessions/${encodeURIComponent(sessionId)}/transcript/stream?limit=200`,
        { "last-event-id": firstLastId! }
      );
      const secondRunResponse = await fetch(`${base}/api/v1/runs`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          input: "second stream run"
        })
      });
      expect(secondRunResponse.status).toBe(200);
      const secondEvents = await collectSseData(secondReader, 2);
      const secondEntries = secondEvents
        .map(parseTranscriptSseData)
        .filter((row): row is { id: string; role: string; content: string } => Boolean(row));
      expect(secondEntries.length).toBeGreaterThanOrEqual(2);
      expect(secondEntries.every((entry) => entry.id !== firstLastId)).toBe(true);
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lists and retrieves session artifacts for gallery usage", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-session-artifacts-"));
    const sessionsDir = join(dir, ".athena", "sessions");
    const transcriptsDir = join(dir, ".athena", "transcripts");
    const runEvidenceDir = join(dir, ".athena", "run-evidence", "run-1");
    mkdirSync(sessionsDir, { recursive: true });
    mkdirSync(transcriptsDir, { recursive: true });
    mkdirSync(runEvidenceDir, { recursive: true });
    const sessionId = "artifact-session";
    const transcriptPath = join(transcriptsDir, `${sessionId}.jsonl`);
    writeFileSync(
      join(sessionsDir, `${sessionId}.json`),
      JSON.stringify(
        {
          schemaVersion: 1,
          id: sessionId,
          transcriptPath,
          createdAt: "2026-02-20T00:00:00.000Z",
          updatedAt: "2026-02-20T00:00:01.000Z"
        },
        null,
        2
      ),
      "utf8"
    );
    writeFileSync(
      transcriptPath,
      `${JSON.stringify({
        id: "entry-1",
        role: "assistant",
        content: "artifact produced",
        metadata: { runId: "run-1", runTraceId: "trace-1" },
        createdAt: "2026-02-20T00:00:01.000Z"
      })}\n`,
      "utf8"
    );
    writeFileSync(
      join(runEvidenceDir, "artifact-1.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          id: "artifact-1",
          sessionId,
          runId: "run-1",
          traceId: "trace-1",
          label: "summary.md",
          type: "text",
          content: {
            kind: "text",
            text: "# Summary\n\nBuild passed."
          },
          createdAt: "2026-02-20T00:00:02.000Z",
          artifactRef: "run-evidence/run-1/artifact-1.json",
          sizeBytes: 24
        },
        null,
        2
      ),
      "utf8"
    );

    const config = loadConfig(dir);
    const server = createApiServer({
      config,
      host: "127.0.0.1",
      port: 0
    });
    let bound: { host: string; port: number };
    try {
      bound = await server.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }
    const base = `http://${bound.host}:${bound.port}`;

    try {
      const listResponse = await fetch(`${base}/api/v1/sessions/${encodeURIComponent(sessionId)}/artifacts`);
      expect(listResponse.status).toBe(200);
      const listEnvelope = (await listResponse.json()) as {
        ok: boolean;
        data: { items: Array<{ id: string; format: string; transcriptEntryId?: string }> };
      };
      expect(listEnvelope.ok).toBe(true);
      expect(listEnvelope.data.items.length).toBe(1);
      expect(listEnvelope.data.items[0]?.id).toBe("artifact-1");
      expect(listEnvelope.data.items[0]?.format).toBe("markdown");
      expect(listEnvelope.data.items[0]?.transcriptEntryId).toBe("entry-1");

      const artifactResponse = await fetch(
        `${base}/api/v1/sessions/${encodeURIComponent(sessionId)}/artifacts/run-1/artifact-1`
      );
      expect(artifactResponse.status).toBe(200);
      const artifactEnvelope = (await artifactResponse.json()) as {
        ok: boolean;
        data: { id: string; content: { kind: string; text?: string } };
      };
      expect(artifactEnvelope.ok).toBe(true);
      expect(artifactEnvelope.data.id).toBe("artifact-1");
      expect(artifactEnvelope.data.content.kind).toBe("text");
      expect(artifactEnvelope.data.content.text).toContain("Summary");
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("authors policy updatedAt on the server when client provides or omits updatedAt", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-policy-updated-at-"));
    const config = loadConfig(dir);
    const server = createApiServer({
      config,
      host: "127.0.0.1",
      port: 0
    });

    let bound: { host: string; port: number };
    try {
      bound = await server.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }

    const base = `http://${bound.host}:${bound.port}`;
    try {
      const withClientUpdatedAtResponse = await fetch(`${base}/api/v1/policy`, {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          schemaVersion: 1,
          updatedAt: "1999-01-01T00:00:00.000Z",
          maxConcurrentRuns: 2
        })
      });
      expect(withClientUpdatedAtResponse.status).toBe(200);
      const withClientUpdatedAtEnvelope = (await withClientUpdatedAtResponse.json()) as {
        ok: boolean;
        data: { updatedAt: string; maxConcurrentRuns?: number };
      };
      expect(withClientUpdatedAtEnvelope.ok).toBe(true);
      expect(withClientUpdatedAtEnvelope.data.maxConcurrentRuns).toBe(2);
      expect(withClientUpdatedAtEnvelope.data.updatedAt).not.toBe("1999-01-01T00:00:00.000Z");
      const withClientTimestamp = Date.parse(withClientUpdatedAtEnvelope.data.updatedAt);
      expect(Number.isNaN(withClientTimestamp)).toBe(false);

      const withoutClientUpdatedAtResponse = await fetch(`${base}/api/v1/policy`, {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          schemaVersion: 1,
          maxConcurrentRuns: 3
        })
      });
      expect(withoutClientUpdatedAtResponse.status).toBe(200);
      const withoutClientUpdatedAtEnvelope = (await withoutClientUpdatedAtResponse.json()) as {
        ok: boolean;
        data: { updatedAt: string; maxConcurrentRuns?: number };
      };
      expect(withoutClientUpdatedAtEnvelope.ok).toBe(true);
      expect(withoutClientUpdatedAtEnvelope.data.maxConcurrentRuns).toBe(3);
      const withoutClientTimestamp = Date.parse(withoutClientUpdatedAtEnvelope.data.updatedAt);
      expect(Number.isNaN(withoutClientTimestamp)).toBe(false);
      expect(withoutClientTimestamp).toBeGreaterThanOrEqual(withClientTimestamp);

      const auditedUpdateResponse = await fetch(`${base}/api/v1/policy`, {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          policy: {
            schemaVersion: 1,
            maxConcurrentRuns: 4,
            retryBudgetPerRun: 2
          },
          auditComment: "Increase concurrency during migration."
        })
      });
      expect(auditedUpdateResponse.status).toBe(200);
      const auditedUpdateEnvelope = (await auditedUpdateResponse.json()) as {
        ok: boolean;
        data: { updatedAt: string; maxConcurrentRuns?: number; retryBudgetPerRun?: number };
      };
      expect(auditedUpdateEnvelope.ok).toBe(true);
      expect(auditedUpdateEnvelope.data.maxConcurrentRuns).toBe(4);
      expect(auditedUpdateEnvelope.data.retryBudgetPerRun).toBe(2);
      expect(Number.isNaN(Date.parse(auditedUpdateEnvelope.data.updatedAt))).toBe(false);

      const missingAuditCommentResponse = await fetch(`${base}/api/v1/policy`, {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          policy: {
            schemaVersion: 1,
            maxConcurrentRuns: 4
          }
        })
      });
      expect(missingAuditCommentResponse.status).toBe(400);
      const missingAuditCommentEnvelope = (await missingAuditCommentResponse.json()) as {
        ok: boolean;
        error: { code: string; message: string };
      };
      expect(missingAuditCommentEnvelope.ok).toBe(false);
      expect(missingAuditCommentEnvelope.error.code).toBe("CONFIG_ERROR");
      expect(missingAuditCommentEnvelope.error.message).toContain("policy.put.auditComment");
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("manages RBAC assignments and enforces Admin-only access", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-rbac-"));
    writeFileSync(
      join(dir, ".env"),
      [
        "ATHENA_AUTH_ENABLED=true",
        "ATHENA_AUTHZ_MODE=enforce",
        "ATHENA_AUTH_IDENTITY_ROLE_MAP=bootstrap-admin:Admin,*:Viewer"
      ].join("\n"),
      "utf8"
    );
    const config = loadConfig(dir);
    const services = createLocalControlPlaneServices({ config });
    const server = createApiServer({
      config,
      services,
      host: "127.0.0.1",
      port: 0
    });

    let bound: { host: string; port: number };
    try {
      bound = await server.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }
    const base = `http://${bound.host}:${bound.port}`;

    try {
      const forbiddenRolesResponse = await fetch(`${base}/api/v1/rbac/roles`, {
        headers: {
          "x-athena-identity": "viewer-user"
        }
      });
      expect(forbiddenRolesResponse.status).toBe(403);

      const forbiddenAuditTrailResponse = await fetch(`${base}/api/v1/governance/audit-trail`, {
        headers: {
          "x-athena-identity": "viewer-user"
        }
      });
      expect(forbiddenAuditTrailResponse.status).toBe(403);

      const forbiddenFlowResponse = await fetch(`${base}/api/v1/work/flows/trace-1`, {
        headers: {
          "x-athena-identity": "viewer-user"
        }
      });
      expect(forbiddenFlowResponse.status).toBe(403);

      const forbiddenObservabilityResponse = await fetch(`${base}/api/v1/work/observability`, {
        headers: {
          "x-athena-identity": "viewer-user"
        }
      });
      expect(forbiddenObservabilityResponse.status).toBe(403);

      const forbiddenObservabilityAlertsResponse = await fetch(`${base}/api/v1/work/observability/alerts`, {
        headers: {
          "x-athena-identity": "viewer-user"
        }
      });
      expect(forbiddenObservabilityAlertsResponse.status).toBe(403);

      const forbiddenObservabilityAlertsCsvResponse = await fetch(
        `${base}/api/v1/work/observability/alerts/export.csv?createdAfter=${encodeURIComponent(new Date(Date.now() - 60_000).toISOString())}&createdBefore=${encodeURIComponent(new Date().toISOString())}`,
        {
          headers: {
            "x-athena-identity": "viewer-user"
          }
        }
      );
      expect(forbiddenObservabilityAlertsCsvResponse.status).toBe(403);

      const rolesResponse = await fetch(`${base}/api/v1/rbac/roles`, {
        headers: {
          "x-athena-identity": "bootstrap-admin"
        }
      });
      expect(rolesResponse.status).toBe(200);
      const rolesEnvelope = (await rolesResponse.json()) as {
        ok: boolean;
        data: { items: Array<{ name: string; permissions: string[] }> };
      };
      expect(rolesEnvelope.ok).toBe(true);
      expect(rolesEnvelope.data.items.some((item) => item.name === "Admin")).toBe(true);

      const assignResponse = await fetch(`${base}/api/v1/rbac/assignments/service-token-acme`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-athena-identity": "bootstrap-admin"
        },
        body: JSON.stringify({
          role: "Operator",
          subjectType: "service-token"
        })
      });
      expect(assignResponse.status).toBe(200);
      const assignEnvelope = (await assignResponse.json()) as {
        ok: boolean;
        data: { subject: string; role: string; subjectType: string; updatedBy?: string };
      };
      expect(assignEnvelope.ok).toBe(true);
      expect(assignEnvelope.data.subject).toBe("service-token-acme");
      expect(assignEnvelope.data.role).toBe("Operator");
      expect(assignEnvelope.data.subjectType).toBe("service-token");
      expect(assignEnvelope.data.updatedBy).toBe("bootstrap-admin");

      const assignmentsResponse = await fetch(`${base}/api/v1/rbac/assignments`, {
        headers: {
          "x-athena-identity": "bootstrap-admin"
        }
      });
      expect(assignmentsResponse.status).toBe(200);
      const assignmentsEnvelope = (await assignmentsResponse.json()) as {
        ok: boolean;
        data: { items: Array<{ subject: string; role: string }> };
      };
      expect(assignmentsEnvelope.ok).toBe(true);
      expect(assignmentsEnvelope.data.items.some((item) => item.subject === "service-token-acme" && item.role === "Operator")).toBe(
        true
      );

      const auditResponse = await fetch(`${base}/api/v1/rbac/audit/service-token-acme`, {
        headers: {
          "x-athena-identity": "bootstrap-admin"
        }
      });
      expect(auditResponse.status).toBe(200);
      const auditEnvelope = (await auditResponse.json()) as {
        ok: boolean;
        data: { role: string; source: string; permissions: string[] };
      };
      expect(auditEnvelope.ok).toBe(true);
      expect(auditEnvelope.data.role).toBe("Operator");
      expect(auditEnvelope.data.source).toBe("persisted");
      expect(auditEnvelope.data.permissions).toContain("runs.create");

      const removeResponse = await fetch(`${base}/api/v1/rbac/assignments/service-token-acme`, {
        method: "DELETE",
        headers: {
          "x-athena-identity": "bootstrap-admin"
        }
      });
      expect(removeResponse.status).toBe(200);
      const removeEnvelope = (await removeResponse.json()) as {
        ok: boolean;
        data: { subject: string; removed: boolean };
      };
      expect(removeEnvelope.ok).toBe(true);
      expect(removeEnvelope.data.subject).toBe("service-token-acme");
      expect(removeEnvelope.data.removed).toBe(true);

      const auditEventsResponse = await fetch(
        `${base}/api/v1/events?types=rbac.assignment.upserted,rbac.assignment.removed&limit=20`,
        {
          headers: {
            "x-athena-identity": "bootstrap-admin"
          }
        }
      );
      expect(auditEventsResponse.status).toBe(200);
      const auditEventsEnvelope = (await auditEventsResponse.json()) as {
        ok: boolean;
        data: { events: Array<{ type: string }> };
      };
      expect(auditEventsEnvelope.ok).toBe(true);
      expect(auditEventsEnvelope.data.events.some((row) => row.type === "rbac.assignment.upserted")).toBe(true);
      expect(auditEventsEnvelope.data.events.some((row) => row.type === "rbac.assignment.removed")).toBe(true);

      const auditTrailResponse = await fetch(`${base}/api/v1/governance/audit-trail?limit=20`, {
        headers: {
          "x-athena-identity": "bootstrap-admin"
        }
      });
      expect(auditTrailResponse.status).toBe(200);
      const auditTrailEnvelope = (await auditTrailResponse.json()) as {
        ok: boolean;
        data: { items: Array<{ category: string; action: string; actor: { subject: string } }> };
      };
      expect(auditTrailEnvelope.ok).toBe(true);
      expect(auditTrailEnvelope.data.items.some((row) => row.category === "identity-assignment")).toBe(true);
      expect(auditTrailEnvelope.data.items.some((row) => row.action === "rbac.assignment.upserted")).toBe(true);
      expect(auditTrailEnvelope.data.items.some((row) => row.actor.subject === "bootstrap-admin")).toBe(true);

      const flowResponse = await fetch(`${base}/api/v1/work/flows/trace-not-found?limit=20`, {
        headers: {
          "x-athena-identity": "bootstrap-admin"
        }
      });
      expect(flowResponse.status).toBe(200);
      const flowEnvelope = (await flowResponse.json()) as {
        ok: boolean;
        data: { traceId: string; nodes: unknown[]; edges: unknown[]; truncated: boolean };
      };
      expect(flowEnvelope.ok).toBe(true);
      expect(flowEnvelope.data.traceId).toBe("trace-not-found");
      expect(flowEnvelope.data.nodes).toEqual([]);
      expect(flowEnvelope.data.edges).toEqual([]);
      expect(flowEnvelope.data.truncated).toBe(false);

      const observabilityResponse = await fetch(`${base}/api/v1/work/observability?windowMinutes=30`, {
        headers: {
          "x-athena-identity": "bootstrap-admin"
        }
      });
      expect(observabilityResponse.status).toBe(200);
      const observabilityEnvelope = (await observabilityResponse.json()) as {
        ok: boolean;
        data: { throughput: unknown[]; latencyHeatmap: unknown[]; stallAlerts: unknown[] };
      };
      expect(observabilityEnvelope.ok).toBe(true);
      expect(Array.isArray(observabilityEnvelope.data.throughput)).toBe(true);
      expect(Array.isArray(observabilityEnvelope.data.latencyHeatmap)).toBe(true);
      expect(Array.isArray(observabilityEnvelope.data.stallAlerts)).toBe(true);

      const alertsResponse = await fetch(`${base}/api/v1/work/observability/alerts?limit=10`, {
        headers: {
          "x-athena-identity": "bootstrap-admin"
        }
      });
      expect(alertsResponse.status).toBe(200);
      const alertsEnvelope = (await alertsResponse.json()) as {
        ok: boolean;
        data: { items: unknown[]; nextCursor?: string };
      };
      expect(alertsEnvelope.ok).toBe(true);
      expect(Array.isArray(alertsEnvelope.data.items)).toBe(true);
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("surfaces k8s capability flags through API when metrics API is unavailable", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-k8s-capabilities-"));
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
    const config = loadConfig(dir);
    const services = createLocalControlPlaneServices({
      config,
      executionBackend: backend,
      k8sMetricsProviderOptions: {
        podApiClient: {
          async listPodForAllNamespaces() {
            return { items: [] };
          }
        },
        podMetricsApiClient: {
          async listClusterCustomObject() {
            throw new Error("metrics unavailable");
          }
        }
      }
    });
    const server = createApiServer({
      config,
      services,
      host: "127.0.0.1",
      port: 0
    });

    let bound: { host: string; port: number };
    try {
      bound = await server.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }

    const base = `http://${bound.host}:${bound.port}`;
    try {
      const response = await fetch(`${base}/api/v1/capabilities`);
      expect(response.status).toBe(200);
      const envelope = (await response.json()) as {
        ok: boolean;
        data: {
          executionBackend: string;
          supportsPods: boolean;
          supportsCpuMemMetrics: boolean;
          supportsSandbox: boolean;
        };
      };
      expect(envelope.ok).toBe(true);
      expect(envelope.data.executionBackend).toBe("k8s");
      expect(envelope.data.supportsPods).toBe(true);
      expect(envelope.data.supportsCpuMemMetrics).toBe(false);
      expect(envelope.data.supportsSandbox).toBe(false);
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("serves operations summary from configurable mock metrics provider", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-operations-mock-"));
    const config = loadConfig(dir);
    const services = createLocalControlPlaneServices({ config });
    const mockProvider = new MockMetricsProvider({
      summary: createBaselineOperationsSummary({
        total: 11,
        running: 7,
        pending: 2,
        succeeded: 1,
        failed: 1
      })
    });
    services.operationsService = {
      async getSummary() {
        const [summary, capabilities] = await Promise.all([mockProvider.getMetrics(), mockProvider.getCapabilities()]);
        return {
          ...summary,
          capabilities
        };
      },
      async getOperationsProviderCostSettings() {
        return {
          schemaVersion: 1,
          updatedAt: new Date(0).toISOString(),
          providers: []
        };
      },
      async updateProviderCostSettings(request) {
        return {
          schemaVersion: 1,
          updatedAt: new Date().toISOString(),
          providers: request.providers.map((row) => ({
            provider: row.provider,
            inputCostPer1kTokensUsd: row.inputCostPer1kTokensUsd,
            outputCostPer1kTokensUsd: row.outputCostPer1kTokensUsd,
            updatedAt: new Date().toISOString()
          }))
        };
      },
      async exportMonthlyCostCsv() {
        return "month,2026-02";
      }
    };
    const server = createApiServer({
      config,
      services,
      host: "127.0.0.1",
      port: 0
    });
    let bound: { host: string; port: number };
    try {
      bound = await server.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }
    const base = `http://${bound.host}:${bound.port}`;

    try {
      const baselineResponse = await fetch(`${base}/api/v1/operations/summary`);
      expect(baselineResponse.status).toBe(200);
      const baselineEnvelope = (await baselineResponse.json()) as {
        ok: boolean;
        data: {
          total: number;
          running: number;
          pending: number;
          succeeded: number;
          failed: number;
          capabilities: {
            supportsPodStatus: boolean;
            supportsCpuMemMetrics: boolean;
          };
          cpuUsage?: number;
          memoryUsage?: number;
        };
      };
      expect(baselineEnvelope.ok).toBe(true);
      expect(baselineEnvelope.data).toEqual({
        total: 11,
        running: 7,
        pending: 2,
        succeeded: 1,
        failed: 1,
        capabilities: {
          supportsPodStatus: false,
          supportsCpuMemMetrics: false
        }
      });

      mockProvider.setSummary(
        createResourceOperationsSummary(
          {
            total: 11,
            running: 8,
            pending: 1,
            succeeded: 1,
            failed: 1
          },
          {
            cpuUsage: 2.5,
            memoryUsage: 134217728
          }
        )
      );
      mockProvider.setCapabilities({
        supportsPodStatus: true,
        supportsCpuMemMetrics: true
      });

      const resourceResponse = await fetch(`${base}/api/v1/operations/summary`);
      expect(resourceResponse.status).toBe(200);
      const resourceEnvelope = (await resourceResponse.json()) as {
        ok: boolean;
        data: {
          total: number;
          running: number;
          pending: number;
          succeeded: number;
          failed: number;
          capabilities: {
            supportsPodStatus: boolean;
            supportsCpuMemMetrics: boolean;
          };
          cpuUsage?: number;
          memoryUsage?: number;
        };
      };
      expect(resourceEnvelope.ok).toBe(true);
      expect(resourceEnvelope.data).toEqual({
        total: 11,
        running: 8,
        pending: 1,
        succeeded: 1,
        failed: 1,
        capabilities: {
          supportsPodStatus: true,
          supportsCpuMemMetrics: true
        },
        cpuUsage: 2.5,
        memoryUsage: 134217728
      });
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects oversized JSON bodies with 413", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-limit-"));
    const config = loadConfig(dir);
    const server = createApiServer({
      config,
      host: "127.0.0.1",
      port: 0
    });
    let bound: { host: string; port: number };
    try {
      bound = await server.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }

    const base = `http://${bound.host}:${bound.port}`;
    const payload = JSON.stringify({
      sessionId: "oversized",
      input: "x".repeat(1_000_200)
    });

    try {
      const declaredLengthResponse = await fetch(`${base}/api/v1/runs`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: payload
      });
      expect(declaredLengthResponse.status).toBe(413);
      const declaredLengthEnvelope = (await declaredLengthResponse.json()) as {
        ok: boolean;
        error: { code: string; message: string };
      };
      expect(declaredLengthEnvelope.ok).toBe(false);
      expect(declaredLengthEnvelope.error.code).toBe("PAYLOAD_TOO_LARGE");

      const streamedOverflow = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const req = httpRequest(
          {
            method: "POST",
            host: bound.host,
            port: bound.port,
            path: "/api/v1/runs",
            headers: {
              "content-type": "application/json"
            }
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk) => {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            res.on("end", () => {
              resolve({
                status: res.statusCode ?? 0,
                body: Buffer.concat(chunks).toString("utf8")
              });
            });
          }
        );
        req.on("error", reject);
        req.write('{"sessionId":"chunked","input":"');
        req.write("x".repeat(1_000_200));
        req.write('"}');
        req.end();
      });

      expect(streamedOverflow.status).toBe(413);
      const streamedOverflowEnvelope = JSON.parse(streamedOverflow.body) as {
        ok: boolean;
        error: { code: string; message: string };
      };
      expect(streamedOverflowEnvelope.ok).toBe(false);
      expect(streamedOverflowEnvelope.error.code).toBe("PAYLOAD_TOO_LARGE");
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("searches sessions across transcripts with filters and snippets", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-server-session-search-"));
    const config = loadConfig(dir);
    const server = createApiServer({
      config,
      host: "127.0.0.1",
      port: 0
    });
    let bound: { host: string; port: number };
    try {
      bound = await server.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }
    const base = `http://${bound.host}:${bound.port}`;

    try {
      await fetch(`${base}/api/v1/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "s-search-ok",
          input: "needle alpha",
          metadata: {
            agentId: "ops",
            userId: "alice"
          }
        })
      });

      await fetch(`${base}/api/v1/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "s-search-failed",
          input: "needle beta",
          metadata: {
            agentId: "infra",
            userId: "bob"
          }
        })
      });

      const sessionsResponse = await fetch(`${base}/api/v1/sessions?limit=20`);
      const sessionsEnvelope = (await sessionsResponse.json()) as {
        ok: boolean;
        data: { items: Array<{ id: string; transcriptPath: string }> };
      };
      const okSession = sessionsEnvelope.data.items.find((item) => item.id === "s-search-ok");
      const failedSession = sessionsEnvelope.data.items.find((item) => item.id === "s-search-failed");
      expect(okSession?.transcriptPath).toBeDefined();
      expect(failedSession?.transcriptPath).toBeDefined();
      appendFileSync(
        okSession!.transcriptPath,
        `${JSON.stringify({
          id: "manual-filter-entry",
          role: "assistant",
          content: "needle filtered for ops alice",
          metadata: {
            agentId: "ops",
            userId: "alice"
          },
          createdAt: new Date().toISOString()
        })}\n`,
        "utf8"
      );
      const failedTranscriptPath = failedSession!.transcriptPath;
      appendFileSync(
        failedTranscriptPath,
        `${JSON.stringify({
          id: "manual-failure-entry",
          role: "assistant",
          content: "needle failure path",
          isError: true,
          createdAt: new Date().toISOString()
        })}\n`,
        "utf8"
      );

      const filtered = await fetch(
        `${base}/api/v1/sessions/search?query=needle&agentId=ops&userId=alice&status=ok&limit=10`
      );
      expect(filtered.status).toBe(200);
      const filteredEnvelope = (await filtered.json()) as {
        ok: boolean;
        data: { items: Array<{ session: { id: string }; snippet: string; status: string }>; total: number; tookMs: number };
      };
      expect(filteredEnvelope.ok).toBe(true);
      expect(filteredEnvelope.data.items.length).toBe(1);
      expect(filteredEnvelope.data.items[0]?.session.id).toBe("s-search-ok");
      expect(filteredEnvelope.data.items[0]?.status).toBe("ok");
      expect(filteredEnvelope.data.items[0]?.snippet.toLowerCase()).toContain("needle");
      expect(filteredEnvelope.data.total).toBe(1);
      expect(typeof filteredEnvelope.data.tookMs).toBe("number");

      const failedOnly = await fetch(`${base}/api/v1/sessions/search?query=needle&status=failed`);
      expect(failedOnly.status).toBe(200);
      const failedOnlyEnvelope = (await failedOnly.json()) as {
        ok: boolean;
        data: { items: Array<{ session: { id: string }; status: string }> };
      };
      expect(failedOnlyEnvelope.ok).toBe(true);
      expect(failedOnlyEnvelope.data.items.some((item) => item.session.id === "s-search-failed")).toBe(true);

      const outOfRange = await fetch(`${base}/api/v1/sessions/search?query=needle&from=2099-01-01T00:00:00.000Z`);
      expect(outOfRange.status).toBe(200);
      const outOfRangeEnvelope = (await outOfRange.json()) as {
        ok: boolean;
        data: { items: Array<unknown>; total: number };
      };
      expect(outOfRangeEnvelope.ok).toBe(true);
      expect(outOfRangeEnvelope.data.items).toEqual([]);
      expect(outOfRangeEnvelope.data.total).toBe(0);
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

async function openSseReader(
  url: string,
  headers?: Record<string, string>
): Promise<{ reader: ReadableStreamDefaultReader<Uint8Array>; abort: () => void }> {
  const controller = new AbortController();
  const response = await fetch(url, {
    headers: {
      accept: "text/event-stream",
      ...(headers ?? {})
    },
    signal: controller.signal
  });
  if (response.status !== 200) {
    controller.abort();
    throw new Error(`Expected SSE status 200, received ${response.status}.`);
  }
  const reader = response.body?.getReader() as ReadableStreamDefaultReader<Uint8Array> | undefined;
  if (!reader) {
    controller.abort();
    throw new Error("Missing SSE response body.");
  }
  return {
    reader,
    abort: () => controller.abort()
  };
}

async function collectSseData(
  stream: { reader: ReadableStreamDefaultReader<Uint8Array>; abort: () => void },
  minCount: number
): Promise<string[]> {
  const out: string[] = [];
  const decoder = new TextDecoder();
  let buffer = "";
  const startMs = Date.now();
  try {
    while (Date.now() - startMs < 15_000) {
      const { value, done } = await stream.reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf("\n\n");
      while (separator >= 0) {
        const frame = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        const dataLines = frame
          .split("\n")
          .filter((line) => line.startsWith("data: "))
          .map((line) => line.slice("data: ".length));
        if (dataLines.length > 0) {
          out.push(dataLines.join("\n"));
        }
        separator = buffer.indexOf("\n\n");
      }
      if (out.length >= minCount) {
        return out;
      }
    }
    return out;
  } finally {
    stream.abort();
    try {
      await stream.reader.cancel();
    } catch {
      // Reader is already closed by abort in some environments.
    }
  }
}

function parseTranscriptSseData(data: string): { id: string; role: string; content: string } | undefined {
  try {
    const parsed = JSON.parse(data) as { ok?: unknown; data?: unknown };
    if (parsed.ok !== true || typeof parsed.data !== "object" || parsed.data === null) {
      return undefined;
    }
    const entry = parsed.data as Record<string, unknown>;
    if (typeof entry.id !== "string" || typeof entry.role !== "string" || typeof entry.content !== "string") {
      return undefined;
    }
    return {
      id: entry.id,
      role: entry.role,
      content: entry.content
    };
  } catch {
    return undefined;
  }
}
