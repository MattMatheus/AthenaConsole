import { describe, expect, it } from "vitest";
import { AthenaError } from "../src/runtime/errors.js";
import { assertApiResponseSchema, assertApiRouteSchemasComplete } from "../src/control-plane/api-schemas.js";

describe("api schemas", () => {
  it("covers every v1 route definition", () => {
    expect(() => assertApiRouteSchemasComplete()).not.toThrow();
  });

  it("validates response payload shape for route operations", () => {
    expect(() =>
      assertApiResponseSchema("getCapabilities", {
        executionBackend: "local",
        stateStore: "file",
        supportsPods: false,
        supportsCpuMemMetrics: false,
        supportsSandbox: false,
        supportsA2ABus: true
      })
    ).not.toThrow();

    expect(() =>
      assertApiResponseSchema("getCapabilities", {
        executionBackend: "local",
        stateStore: "file"
      })
    ).toThrow(AthenaError);

    expect(() =>
      assertApiResponseSchema("getHealth", {
        status: "ok",
        now: "2026-02-21T00:00:00.000Z"
      })
    ).not.toThrow();

    expect(() =>
      assertApiResponseSchema("getHealth", {
        status: "degraded"
      })
    ).toThrow(AthenaError);

    expect(() =>
      assertApiResponseSchema("getReadiness", {
        status: "degraded",
        generatedAt: "2026-02-21T00:00:00.000Z",
        summary: {
          ready: false,
          requiredFailed: 0,
          degraded: 1,
          optionalUnavailable: 1
        },
        lanes: [
          {
            id: "first-run-demo",
            label: "First-run demo",
            status: "degraded",
            message: "The local stack is mostly usable, but the sample workflow is not ready yet.",
            nextStep: "Check plugin/template indexing before running the first-run demo.",
            checkIds: ["sample-demo"]
          }
        ],
        checks: [
          {
            id: "sample-demo",
            label: "Sample/demo workflow",
            category: "sample-demo",
            status: "degraded",
            required: false,
            message: "No available workflow template is ready for a first-run demo yet.",
            nextStep: "Continue with the sample plugin workflow demo story before documenting a demo run.",
            details: {
              totalWorkflowTemplates: 0,
              availableWorkflowTemplates: 0
            }
          }
        ]
      })
    ).not.toThrow();

    expect(() =>
      assertApiResponseSchema("getReadiness", {
        status: "ok",
        generatedAt: "2026-02-21T00:00:00.000Z",
        summary: {
          ready: true,
          requiredFailed: 0,
          degraded: 0,
          optionalUnavailable: 0
        },
        checks: []
      })
    ).toThrow(AthenaError);

    expect(() =>
      assertApiResponseSchema("getAdminHealth", {
        status: "ok",
        now: "2026-02-21T00:00:00.000Z",
        stateStores: {
          ownershipMap: "docs/product/architecture/state-ownership-map.md",
          sqlite: {
            appStatePath: "/workspace/.athena/team-orchestrator.sqlite"
          },
          stores: [
            {
              id: "sqlite-app-state",
              label: "SQLite app-state database",
              category: "sqlite-app-state",
              path: "/workspace/.athena/team-orchestrator.sqlite"
            }
          ]
        }
      })
    ).not.toThrow();

    expect(() =>
      assertApiResponseSchema("getOperationsSummary", {
        total: 4,
        running: 1,
        pending: 1,
        succeeded: 2,
        failed: 0,
        uptime: 1,
        errorRate: 0,
        capabilities: {
          supportsPodStatus: false,
          supportsCpuMemMetrics: false
        },
        operationalSummary: {
          totalActiveRuns: 1,
          totalActiveSessions: 1,
          aggregateResourceUsage: {
            cpuUsage: 0.5,
            memoryUsage: 1024
          },
          recentFailureRejectionCount: 2
        }
      })
    ).not.toThrow();

    expect(() =>
      assertApiResponseSchema("executeWorkflowRun", {
        runId: "workflow-run-demo",
        status: "completed",
        executedStepIds: ["prepare", "verify"],
        snapshot: {
          run: { id: "workflow-run-demo", status: "completed" },
          steps: []
        }
      })
    ).not.toThrow();

    expect(() =>
      assertApiResponseSchema("getOperationsSummary", {
        total: 4,
        running: 1
      })
    ).toThrow(AthenaError);

    expect(() =>
      assertApiResponseSchema("getOperationsProviderCostSettings", {
        schemaVersion: 1,
        updatedAt: "2026-02-20T00:00:00.000Z",
        providers: [
          {
            provider: "openai",
            inputCostPer1kTokensUsd: 0.5,
            outputCostPer1kTokensUsd: 1.5,
            updatedAt: "2026-02-20T00:00:00.000Z"
          }
        ]
      })
    ).not.toThrow();

    expect(() =>
      assertApiResponseSchema("getOperationsProviderCostSettings", {
        providers: []
      })
    ).toThrow(AthenaError);

    expect(() =>
      assertApiResponseSchema("getA2aObservability", {
        computedAt: "2026-02-20T00:00:00.000Z",
        windowStart: "2026-02-19T23:00:00.000Z",
        windowEnd: "2026-02-20T00:00:00.000Z",
        bucketMinutes: 5,
        throughput: [],
        latencyHeatmap: [],
        stallAlerts: [],
        sampleCount: 0,
        truncated: false
      })
    ).not.toThrow();

    expect(() =>
      assertApiResponseSchema("listA2aObservabilityAlerts", {
        items: [
          {
            id: "alert-1",
            traceId: "trace-1",
            stepId: "planner",
            queueId: "queue-1",
            correlationId: "item-1",
            startedAt: "2026-02-20T00:00:00.000Z",
            createdAt: "2026-02-20T00:01:00.000Z",
            status: "active",
            pendingForMs: 120000,
            historicalP95Ms: 60000,
            severity: "critical"
          }
        ]
      })
    ).not.toThrow();
  });
});
