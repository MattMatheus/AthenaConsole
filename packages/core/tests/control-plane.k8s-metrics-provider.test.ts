import { describe, expect, it } from "vitest";
import type { V1Pod } from "@kubernetes/client-node";
import type { ExecutionBackend } from "../src/control-plane/backends.js";
import { K8sMetricsProvider } from "../src/control-plane/backends/k8s-metrics-provider.js";

function createNoopBackend(overrides: Partial<ExecutionBackend> = {}): ExecutionBackend {
  return {
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
    },
    ...overrides
  };
}

describe("K8sMetricsProvider", () => {
  it("maps pod phases and aggregates CPU/memory usage from metrics API", async () => {
    const seenPodSelectors: string[] = [];
    const seenMetricSelectors: string[] = [];
    const pods: V1Pod[] = [
      { metadata: { namespace: "athena", name: "athena-1" }, status: { phase: "Running" } },
      { metadata: { namespace: "athena", name: "athena-2" }, status: { phase: "Running" } },
      { metadata: { namespace: "athena", name: "athena-3" }, status: { phase: "Pending" } },
      { metadata: { namespace: "athena", name: "athena-4" }, status: { phase: "Succeeded" } },
      { metadata: { namespace: "athena", name: "athena-5" }, status: { phase: "Failed" } },
      { metadata: { namespace: "athena", name: "athena-6" }, status: { phase: "Unknown" } }
    ];
    const provider = new K8sMetricsProvider(
      createNoopBackend({
        async getFleetMetrics() {
          return {
            supportsPods: false,
            supportsCpuMemMetrics: false,
            runs: {
              active: 8,
              cancellationRequested: 2
            }
          };
        }
      }),
      {
        podLabelSelector: "app.kubernetes.io/component=athena-agent",
        podApiClient: {
          async listPodForAllNamespaces(param) {
            seenPodSelectors.push(param?.labelSelector ?? "");
            return { items: pods };
          }
        },
        podMetricsApiClient: {
          async listClusterCustomObject(param) {
            seenMetricSelectors.push(param.labelSelector ?? "");
            return {
              items: [
                {
                  metadata: { namespace: "athena", name: "athena-1" },
                  containers: [{ usage: { cpu: "250m", memory: "64Mi" } }]
                },
                {
                  metadata: { namespace: "athena", name: "athena-2" },
                  containers: [
                    { usage: { cpu: "100m", memory: "32Mi" } },
                    { usage: { cpu: "0.5", memory: "128Mi" } }
                  ]
                },
                {
                  metadata: { namespace: "other", name: "non-agent" },
                  containers: [{ usage: { cpu: "12", memory: "4Gi" } }]
                }
              ]
            };
          }
        }
      }
    );

    await expect(provider.getCapabilities()).resolves.toEqual({
      supportsPodStatus: true,
      supportsCpuMemMetrics: true
    });
    await expect(provider.getMetrics()).resolves.toEqual({
      total: 6,
      running: 2,
      pending: 1,
      succeeded: 1,
      failed: 1,
      uptime: 0.8333,
      errorRate: 0.1667,
      cpuUsage: 0.85,
      memoryUsage: 234881024
    });
    expect(seenPodSelectors).toEqual(["app.kubernetes.io/component=athena-agent"]);
    expect(seenMetricSelectors).toEqual([
      "app.kubernetes.io/component=athena-agent",
      "app.kubernetes.io/component=athena-agent"
    ]);
  });

  it("keeps pod status summary when metrics API is unavailable", async () => {
    const provider = new K8sMetricsProvider(
      createNoopBackend({
        async getFleetMetrics() {
          return {
            supportsPods: true,
            supportsCpuMemMetrics: true,
            runs: {
              active: 2,
              cancellationRequested: 1
            }
          };
        }
      }),
      {
        podApiClient: {
          async listPodForAllNamespaces() {
            return {
              items: [{ status: { phase: "Running" } }, { status: { phase: "Pending" } }]
            };
          }
        },
        podMetricsApiClient: {
          async listClusterCustomObject() {
            throw new Error("metrics unavailable");
          }
        }
      }
    );

    await expect(provider.getMetrics()).resolves.toEqual({
      total: 2,
      running: 1,
      pending: 1,
      succeeded: 0,
      failed: 0,
      uptime: 1,
      errorRate: 0
    });
    await expect(provider.getCapabilities()).resolves.toEqual({
      supportsPodStatus: true,
      supportsCpuMemMetrics: false
    });
  });

  it("falls back to backend snapshot counters when Kubernetes API is unavailable", async () => {
    const provider = new K8sMetricsProvider(
      createNoopBackend({
        async getFleetMetrics() {
          return {
            supportsPods: true,
            supportsCpuMemMetrics: false,
            runs: {
              active: 3,
              cancellationRequested: 4
            }
          };
        }
      }),
      {
        podApiClient: {
          async listPodForAllNamespaces() {
            throw new Error("kube unavailable");
          }
        }
      }
    );

    await expect(provider.getMetrics()).resolves.toEqual({
      total: 7,
      running: 3,
      pending: 4,
      succeeded: 0,
      failed: 0,
      uptime: 1,
      errorRate: 0
    });
  });

  it("returns placeholder-safe defaults when backend metrics are unavailable", async () => {
    const provider = new K8sMetricsProvider(
      createNoopBackend(),
      {
        podApiClient: {
          async listPodForAllNamespaces() {
            throw new Error("kube unavailable");
          }
        },
        podMetricsApiClient: {
          async listClusterCustomObject() {
            throw new Error("metrics unavailable");
          }
        }
      }
    );

    await expect(provider.getCapabilities()).resolves.toEqual({
      supportsPodStatus: true,
      supportsCpuMemMetrics: false
    });
    await expect(provider.getMetrics()).resolves.toEqual({
      total: 0,
      running: 0,
      pending: 0,
      succeeded: 0,
      failed: 0,
      uptime: 0,
      errorRate: 0
    });
  });
});
