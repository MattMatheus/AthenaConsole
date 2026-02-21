import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  DockerSandboxExecutionBackend,
  K8sSandboxExecutionBackend,
  LocalSandboxExecutionBackend,
  type DockerCommandRunner,
  type K8sPodApiClient,
  type K8sPodLogClient,
  type SandboxExecutionBackend
} from "../src/control-plane/backends.js";
import { createLocalControlPlaneServices } from "../src/control-plane/services.js";
import { loadConfig } from "../src/shared/config.js";

describe("sandbox backend scaffold", () => {
  it("returns structured unsupported responses in local placeholder adapter", async () => {
    const backend = new LocalSandboxExecutionBackend();

    await expect(backend.isAvailable()).resolves.toBe(false);
    await expect(
      backend.claim({
        runId: "run-1",
        sessionId: "s1",
        templateRef: "default"
      })
    ).resolves.toEqual({
      status: "unsupported",
      reason: "sandbox execution backend is not configured"
    });
    await expect(
      backend.waitReady({
        runId: "run-1",
        sandboxId: "sbx-1",
        timeoutMs: 2_000
      })
    ).resolves.toMatchObject({
      status: "unsupported",
      reason: "sandbox execution backend is not configured"
    });
    await expect(
      backend.terminate({
        runId: "run-1",
        sandboxId: "sbx-1",
        reason: "cancelled"
      })
    ).resolves.toMatchObject({
      status: "unsupported",
      reason: "sandbox execution backend is not configured"
    });
    await expect(
      backend.cleanup({
        runId: "run-1",
        sandboxId: "sbx-1"
      })
    ).resolves.toMatchObject({
      status: "unsupported",
      reason: "sandbox execution backend is not configured"
    });
  });

  it("implements docker sandbox lifecycle contract with network isolation defaults", async () => {
    const calls: Array<{ args: string[]; timeoutMs?: number }> = [];
    const commandRunner: DockerCommandRunner = async (_command, args, options) => {
      calls.push({
        args,
        ...(options?.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {})
      });
      if (args[0] === "info") {
        return {
          exitCode: 0,
          stdout: "25.0.5\n",
          stderr: "",
          timedOut: false
        };
      }
      if (args[0] === "create") {
        return {
          exitCode: 0,
          stdout: "container-abc\n",
          stderr: "",
          timedOut: false
        };
      }
      if (args[0] === "start") {
        return {
          exitCode: 0,
          stdout: "container-abc\n",
          stderr: "",
          timedOut: false
        };
      }
      if (args[0] === "stats") {
        return {
          exitCode: 0,
          stdout: "50.00%|128MiB / 1GiB\n",
          stderr: "",
          timedOut: false
        };
      }
      if (args[0] === "inspect") {
        if (args.includes("--size")) {
          return {
            exitCode: 0,
            stdout: "2048\n",
            stderr: "",
            timedOut: false
          };
        }
        return {
          exitCode: 0,
          stdout: "running\n",
          stderr: "",
          timedOut: false
        };
      }
      return {
        exitCode: 0,
        stdout: "",
        stderr: "",
        timedOut: false
      };
    };

    const backend = new DockerSandboxExecutionBackend({
      commandRunner
    });
    await expect(backend.isAvailable()).resolves.toBe(true);
    await expect(
      backend.claim({
        runId: "run-1",
        sessionId: "session-1",
        templateRef: "default",
        egressPolicy: {
          schemaVersion: 1,
          defaultAction: "deny",
          allow: [{ host: "api.openai.com", port: 443 }]
        },
        labels: { env: "test" },
        workspaceHostPath: "/repo",
        workspaceMountPath: "/sandbox/workspace",
        workspaceReadOnly: true,
        workspaceIgnore: [".git", ".env"],
        timeoutMs: 2_000
      })
    ).resolves.toMatchObject({
      status: "claimed",
      sandboxId: "container-abc"
    });
    await expect(
      backend.waitReady({
        runId: "run-1",
        sandboxId: "container-abc",
        timeoutMs: 2_000
      })
    ).resolves.toMatchObject({
      status: "ready"
    });
    await expect(
      backend.terminate({
        runId: "run-1",
        sandboxId: "container-abc",
        reason: "cleanup"
      })
    ).resolves.toMatchObject({
      status: "terminated"
    });
    await expect(
      backend.cleanup({
        runId: "run-1",
        sandboxId: "container-abc"
      })
    ).resolves.toMatchObject({
      status: "cleaned"
    });
    await expect(
      backend.getResourceUsage({
        runId: "run-1",
        sandboxId: "container-abc"
      })
    ).resolves.toMatchObject({
      status: "ok",
      diskBytes: 2048
    });

    const createCall = calls.find((call) => call.args[0] === "create");
    expect(createCall?.args).toContain("--network");
    expect(createCall?.args).toContain("bridge");
    expect(createCall?.args).toContain("--user");
    expect(createCall?.args).toContain("65532:65532");
    expect(createCall?.args).toContain("--workdir");
    expect(createCall?.args).toContain("/sandbox/workspace");
    expect(createCall?.args).toContain("--volume");
    expect(createCall?.args).toContain("/repo:/sandbox/workspace:ro");
    expect(createCall?.args).toContain("type=tmpfs,destination=/sandbox/workspace/.git");
    expect(createCall?.args).toContain("type=tmpfs,destination=/sandbox/workspace/.env");
    expect(createCall?.args).toContain("athena.dev/egress-default=deny");
    expect(createCall?.args).toContain("athena.dev/egress-allowlist=api.openai.com:443");
  });

  it("implements k8s sandbox lifecycle contract with runtimeClass passthrough", async () => {
    const calls: Array<{ action: string; payload?: unknown }> = [];
    const podApiClient: K8sPodApiClient = {
      async listNamespacedPod(param) {
        calls.push({ action: "list", payload: param });
        return { items: [] };
      },
      async createNamespacedPod(param) {
        calls.push({ action: "create", payload: param });
        const body = param.body as {
          metadata?: {
            name?: string;
          };
        };
        return {
          metadata: {
            name: body.metadata?.name ?? "pod-1",
            namespace: param.namespace
          }
        };
      },
      async readNamespacedPod(param) {
        calls.push({ action: "read", payload: param });
        return {
          status: {
            phase: "Running",
            conditions: [{ type: "Ready", status: "True" }]
          }
        };
      },
      async deleteNamespacedPod(param) {
        calls.push({ action: "delete", payload: param });
        return {};
      }
    };
    const streamedLines: string[] = [];
    const podLogClient: K8sPodLogClient = {
      async streamPodLogs(request) {
        request.onLine("pod-online");
        streamedLines.push("stream-started");
        return {
          stop: () => {
            streamedLines.push("stream-stopped");
          }
        };
      }
    };

    const backend = new K8sSandboxExecutionBackend({
      namespace: "athena-system",
      podApiClient,
      podMetricsApiClient: {
        async getNamespacedCustomObject() {
          return {
            containers: [
              {
                usage: {
                  cpu: "500m",
                  memory: "128Mi"
                }
              }
            ]
          };
        }
      },
      podLogClient,
      onLogLine: ({ line }) => {
        streamedLines.push(line);
      }
    });

    await expect(backend.isAvailable()).resolves.toBe(true);
    await expect(
      backend.claim({
        runId: "run-1",
        sessionId: "session-1",
        templateRef: "default",
        runtimeClassName: "gvisor",
        egressPolicy: {
          schemaVersion: 1,
          defaultAction: "deny",
          allow: [{ host: "api.openai.com", port: 443 }]
        },
        workspaceMountPath: "/athena/workspace",
        workspaceReadOnly: true,
        workspaceSyncRepo: "https://github.com/acme/repo.git",
        workspaceSyncRef: "main",
        workspaceSyncSubPath: "packages/agent",
        workspaceSyncStrategy: "git-sync",
        workspaceIgnore: [".git", ".env"],
        timeoutMs: 3_000
      })
    ).resolves.toMatchObject({
      status: "claimed",
      namespace: "athena-system",
      runtimeClassName: "gvisor"
    });

    const claimed = await backend.claim({
      runId: "run-2",
      sessionId: "session-2",
      templateRef: "default",
      runtimeClassName: "kata",
      timeoutMs: 2_000
    });
    if (claimed.status !== "claimed" || !claimed.sandboxId) {
      throw new Error("expected claimed k8s sandbox");
    }
    await expect(
      backend.waitReady({
        runId: "run-2",
        sandboxId: claimed.sandboxId,
        timeoutMs: 2_000
      })
    ).resolves.toMatchObject({
      status: "ready",
      endpoint: `k8s://athena-system/${claimed.sandboxId}`
    });
    await expect(
      backend.terminate({
        runId: "run-2",
        sandboxId: claimed.sandboxId,
        reason: "cleanup"
      })
    ).resolves.toMatchObject({
      status: "terminated"
    });
    await expect(
      backend.cleanup({
        runId: "run-2",
        sandboxId: claimed.sandboxId
      })
    ).resolves.toMatchObject({
      status: "cleaned"
    });
    await expect(
      backend.getResourceUsage({
        runId: "run-2",
        sandboxId: claimed.sandboxId,
        namespace: "athena-system"
      })
    ).resolves.toMatchObject({
      status: "ok",
      cpuCores: 0.5
    });

    const createCall = calls.find((call) => call.action === "create");
    const createPayload = createCall?.payload as
      | {
          body?: {
            spec?: {
              runtimeClassName?: string;
              activeDeadlineSeconds?: number;
              containers?: Array<{
                workingDir?: string;
                volumeMounts?: Array<{ readOnly?: boolean; mountPath?: string }>;
              }>;
              initContainers?: Array<{
                command?: string[];
              }>;
            };
            metadata?: {
              annotations?: Record<string, string>;
            };
          };
        }
      | undefined;
    expect(createPayload?.body?.spec?.runtimeClassName).toBe("gvisor");
    expect(createPayload?.body?.spec?.activeDeadlineSeconds).toBe(3);
    expect(createPayload?.body?.spec?.containers?.[0]?.workingDir).toBe("/athena/workspace");
    expect(createPayload?.body?.spec?.containers?.[0]?.volumeMounts?.[0]?.mountPath).toBe("/athena/workspace");
    expect(createPayload?.body?.spec?.containers?.[0]?.volumeMounts?.[0]?.readOnly).toBe(true);
    expect(createPayload?.body?.spec?.initContainers?.[0]?.command?.[2]).toContain("git clone --depth 1");
    expect(createPayload?.body?.spec?.initContainers?.[0]?.command?.[2]).toContain(".env");
    expect(createPayload?.body?.metadata?.annotations?.["athena.dev/egress-default"]).toBe("deny");
    expect(createPayload?.body?.metadata?.annotations?.["athena.dev/egress-allowlist"]).toBe("api.openai.com:443");
    expect(streamedLines).toContain("pod-online");
    expect(streamedLines).toContain("stream-stopped");
  });

  it("surfaces sandbox capability flag through capability service", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-sandbox-capability-"));
    try {
      const config = loadConfig(dir);
      const disabledServices = createLocalControlPlaneServices({ config });
      await expect(disabledServices.capabilityService.getCapabilities()).resolves.toMatchObject({
        supportsSandbox: false
      });

      const enabledBackend: SandboxExecutionBackend = {
        kind: "agent-sandbox",
        async isAvailable() {
          return true;
        },
        async claim() {
          return {
            status: "unsupported",
            reason: "not used in this story"
          };
        },
        async waitReady() {
          return {
            status: "unsupported",
            observedAt: new Date().toISOString(),
            reason: "not used in this story"
          };
        },
        async terminate() {
          return {
            status: "unsupported",
            observedAt: new Date().toISOString(),
            reason: "not used in this story"
          };
        },
        async cleanup() {
          return {
            status: "unsupported",
            observedAt: new Date().toISOString(),
            reason: "not used in this story"
          };
        }
      };
      const enabledServices = createLocalControlPlaneServices({
        config,
        sandboxExecutionBackend: enabledBackend
      });
      await expect(enabledServices.capabilityService.getCapabilities()).resolves.toMatchObject({
        supportsSandbox: true
      });

      const dockerServices = createLocalControlPlaneServices({
        config: {
          ...config,
          sandbox: {
            enabled: true,
            requireForHighSecurity: false
          }
        },
        sandboxBackendProvider: "docker",
        dockerSandboxBackendOptions: {
          commandRunner: async (_command, args) => ({
            exitCode: args[0] === "info" ? 0 : 1,
            stdout: args[0] === "info" ? "25.0.5\n" : "",
            stderr: "",
            timedOut: false
          })
        }
      });
      await expect(dockerServices.capabilityService.getCapabilities()).resolves.toMatchObject({
        supportsSandbox: true
      });

      const k8sServices = createLocalControlPlaneServices({
        config: {
          ...config,
          sandbox: {
            enabled: true,
            requireForHighSecurity: false
          }
        },
        sandboxBackendProvider: "k8s",
        k8sSandboxBackendOptions: {
          namespace: "athena-system",
          podApiClient: {
            async listNamespacedPod() {
              return { items: [] };
            },
            async createNamespacedPod() {
              throw new Error("not used");
            },
            async readNamespacedPod() {
              throw new Error("not used");
            },
            async deleteNamespacedPod() {
              throw new Error("not used");
            }
          },
          podMetricsApiClient: {
            async getNamespacedCustomObject() {
              return {
                containers: []
              };
            }
          },
          podLogClient: {
            async streamPodLogs() {
              return undefined;
            }
          }
        }
      });
      await expect(k8sServices.capabilityService.getCapabilities()).resolves.toMatchObject({
        supportsSandbox: true
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses execution provider default when sandbox routing is enabled", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-sandbox-default-provider-"));
    try {
      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({
        config: {
          ...config,
          sandbox: {
            enabled: true,
            requireForHighSecurity: false
          }
        },
        dockerSandboxBackendOptions: {
          commandRunner: async (_command, args) => ({
            exitCode: args[0] === "info" ? 0 : 1,
            stdout: args[0] === "info" ? "25.0.5\n" : "",
            stderr: "",
            timedOut: false
          })
        }
      });
      await expect(services.capabilityService.getCapabilities()).resolves.toMatchObject({
        supportsSandbox: true
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
