import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import type { ExecutionBackend, SandboxExecutionBackend } from "../src/control-plane/backends.js";
import type { IDistributedLock } from "../src/control-plane/distributed-lock.js";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { InMemoryRejectionEventStore } from "../src/control-plane/rejection-event-store.js";
import { createLocalControlPlaneServices } from "../src/control-plane/services.js";
import { AthenaError } from "../src/runtime/errors.js";
import { loadConfig } from "../src/shared/config.js";

describe("control-plane policy and operations services", () => {
  it("persists policy state with migration from legacy policy document shape", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-policy-migrate-"));
    try {
      const policyDir = join(dir, ".athena", "policy");
      mkdirSync(policyDir, { recursive: true });
      writeFileSync(
        join(policyDir, "policy.json"),
        JSON.stringify(
          {
            updatedAt: "2026-02-16T10:00:00.000Z",
            maxConcurrentRuns: 3
          },
          null,
          2
        ),
        "utf8"
      );

      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config });
      const policy = await services.policyService.get();
      expect(policy).toEqual({
        schemaVersion: 1,
        updatedAt: "2026-02-16T10:00:00.000Z",
        maxConcurrentRuns: 3
      });

      const persisted = JSON.parse(readFileSync(join(policyDir, "policy.json"), "utf8")) as {
        schemaVersion: number;
        policy: { schemaVersion: number; maxConcurrentRuns: number };
      };
      expect(persisted.schemaVersion).toBe(1);
      expect(persisted.policy.schemaVersion).toBe(1);
      expect(persisted.policy.maxConcurrentRuns).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("normalizes legacy policy rejection rows to versioned run rejection events", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-policy-rejection-migrate-"));
    try {
      const rejectionDir = join(dir, ".athena", "policy", "rejections");
      mkdirSync(rejectionDir, { recursive: true });
      writeFileSync(
        join(rejectionDir, "events.jsonl"),
        JSON.stringify({
          id: "rej-1",
          createdAt: "2026-02-18T00:00:00.000Z",
          sessionId: "legacy-session",
          activeRuns: 2,
          maxConcurrentRuns: 1,
          reason: "max-concurrent-runs-exceeded"
        }) + "\n",
        "utf8"
      );

      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config });
      const rejections = await services.policyService.listConcurrencyRejections({
        sessionId: "legacy-session",
        limit: 10
      });
      expect(rejections.items.length).toBe(1);
      expect(rejections.items[0]?.event).toEqual({
        schemaVersion: 1,
        timestamp: "2026-02-18T00:00:00.000Z",
        policyType: "CONCURRENCY",
        limit: 1,
        rejectedRunDetails: {
          sessionId: "legacy-session"
        },
        reason: "max-concurrent-runs-exceeded",
        activeRuns: 2
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses injected in-memory rejection store with bounded retention while preserving file compatibility", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-policy-rejection-store-"));
    try {
      const config = loadConfig(dir);
      const rejectionStore = new InMemoryRejectionEventStore({
        maxRecords: 3
      });
      const services = createLocalControlPlaneServices({
        config,
        rejectionEventStore: rejectionStore,
        rejectionEventMaxRecords: 3
      });

      for (let index = 1; index <= 5; index += 1) {
        await services.policyService.recordConcurrencyRejection({
          sessionId: `bounded-session-${index}`,
          activeRuns: 1,
          maxConcurrentRuns: 1,
          reason: "max-concurrent-runs-exceeded"
        });
      }

      const rejections = await services.policyService.listConcurrencyRejections({
        limit: 10
      });
      expect(rejections.items.length).toBe(3);
      expect(rejections.items.map((row) => row.sessionId)).toEqual([
        "bounded-session-3",
        "bounded-session-4",
        "bounded-session-5"
      ]);

      const rawRows = readFileSync(join(dir, ".athena", "policy", "rejections", "events.jsonl"), "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      expect(rawRows.length).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("enforces policy limits and default run timeouts in control-plane services", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-policy-enforce-"));
    try {
      const observedTimeouts: number[] = [];
      let releaseHeldRun: (() => void) | undefined;
      const heldRunStarted = new Promise<void>((resolve) => {
        releaseHeldRun = resolve;
      });
      let heldRunGateOpen = false;
      const backend: ExecutionBackend = {
        kind: "local",
        async run(request, options) {
          observedTimeouts.push(options?.timeoutMs ?? -1);
          if (request.sessionId === "hold-session" && !heldRunGateOpen) {
            await heldRunStarted;
            heldRunGateOpen = true;
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
      const putPolicy = await services.policyService.put({
        schemaVersion: 1,
        updatedAt: "2026-02-16T11:00:00.000Z",
        maxConcurrentRuns: 1,
        defaultRunTimeoutMs: 1234,
        defaultScheduleTimeoutMs: 2345
      });
      expect(putPolicy.updatedAt).not.toBe("2026-02-16T11:00:00.000Z");

      await services.runService.run({
        sessionId: "run-timeout-test",
        input: "hello"
      });
      expect(observedTimeouts[0]).toBe(1234);

      const heldRun = services.runService.run({
        sessionId: "hold-session",
        input: "hold"
      });
      await new Promise((resolve) => setTimeout(resolve, 20));

      await expect(
        services.runService.run({
          sessionId: "blocked-session",
          input: "should fail"
        })
      ).rejects.toMatchObject({
        code: "POLICY_CONCURRENCY_LIMIT_EXCEEDED"
      } satisfies Partial<AthenaError>);

      const rejections = await services.policyService.listConcurrencyRejections({
        sessionId: "blocked-session",
        limit: 10
      });
      expect(rejections.items.length).toBe(1);
      expect(rejections.items[0]?.reason).toBe("max-concurrent-runs-exceeded");
      expect(rejections.items[0]?.maxConcurrentRuns).toBe(1);
      expect(rejections.items[0]?.event.schemaVersion).toBe(1);
      expect(rejections.items[0]?.event.policyType).toBe("CONCURRENCY");
      expect(rejections.items[0]?.event.limit).toBe(1);
      expect(rejections.items[0]?.event.rejectedRunDetails.sessionId).toBe("blocked-session");
      expect(rejections.items[0]?.policy?.engine).toBe("athena");
      expect(rejections.items[0]?.policy?.ruleType).toBe("concurrency");
      expect(rejections.items[0]?.event.policy?.engine).toBe("athena");
      expect(rejections.items[0]?.event.policy?.ruleType).toBe("concurrency");

      const rejectionEvents = await services.eventService.list({
        sessionId: "blocked-session",
        types: ["policy.concurrency.rejected"]
      });
      expect(rejectionEvents.events.length).toBe(1);
      expect(rejectionEvents.events[0]?.type).toBe("policy.concurrency.rejected");
      const payload = rejectionEvents.events[0]?.payload as { rejection?: { schemaVersion?: number; policyType?: string } };
      expect(payload.rejection?.schemaVersion).toBe(1);
      expect(payload.rejection?.policyType).toBe("CONCURRENCY");
      expect(rejectionEvents.events[0]?.policy?.decision).toBe("rejected");
      expect(rejectionEvents.events[0]?.policy?.workload.labels["athena.dev/session-id"]).toBe("blocked-session");
      expect(rejectionEvents.events[0]?.policy?.workload.labels["athena.dev/agent-role"]).toBe("unspecified");
      expect(rejectionEvents.events[0]?.policy?.origin?.engine).toBe("athena");

      const canonicalPolicyEvents = await services.eventService.list({
        sessionId: "blocked-session",
        types: ["policy.rejected"]
      });
      const safetyEvents = await services.eventService.list({
        sessionId: "blocked-session",
        types: ["safety.violation"]
      });
      expect(canonicalPolicyEvents.events.length).toBe(1);
      expect(canonicalPolicyEvents.events[0]?.type).toBe("policy.rejected");
      expect(canonicalPolicyEvents.events[0]?.policy?.decision).toBe("rejected");
      expect(canonicalPolicyEvents.events[0]?.runId?.startsWith("sandbox-")).toBe(true);
      expect(safetyEvents.events.some((event) => event.payload.violationCode === "POLICY_CONCURRENCY_REJECTED")).toBe(
        true
      );

      releaseHeldRun?.();
      await heldRun;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses injected distributed lock in policy concurrency enforcement", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-policy-lock-inject-"));
    try {
      let locked = false;
      let acquireCount = 0;
      let releaseCount = 0;
      const distributedLock: IDistributedLock = {
        async tryAcquire() {
          acquireCount += 1;
          if (locked) {
            return { acquired: false };
          }
          locked = true;
          return {
            acquired: true,
            lockName: "policy.concurrency.slot.1",
            ownerId: "owner-1",
            token: "token-1",
            acquiredAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString()
          };
        },
        async release() {
          locked = false;
          releaseCount += 1;
        }
      };

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
            provider: "mock",
            model: "mock-model",
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
        distributedLock
      });
      await services.policyService.put({
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        maxConcurrentRuns: 1
      });

      const heldRun = services.runService.run({
        sessionId: "hold-session",
        input: "hold"
      });
      await new Promise((resolve) => setTimeout(resolve, 20));

      await expect(
        services.runService.run({
          sessionId: "blocked-session",
          input: "blocked"
        })
      ).rejects.toMatchObject({
        code: "POLICY_CONCURRENCY_LIMIT_EXCEEDED"
      } satisfies Partial<AthenaError>);

      releaseHeldRun?.();
      await heldRun;
      expect(acquireCount).toBeGreaterThanOrEqual(2);
      expect(releaseCount).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emits canonical rejection event when distributed lock acquisition throws", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-policy-lock-failure-rejection-"));
    try {
      const distributedLock: IDistributedLock = {
        async tryAcquire() {
          throw new AthenaError("SESSION_IO_ERROR", "distributed lock backend unavailable");
        },
        async release() {
          // no-op
        }
      };

      const backend: ExecutionBackend = {
        kind: "local",
        async run(request) {
          return {
            sessionId: request.sessionId,
            output: "ok",
            provider: "mock",
            model: "mock-model",
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
        distributedLock
      });
      await services.policyService.put({
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        maxConcurrentRuns: 1
      });

      await expect(
        services.runService.run({
          sessionId: "lock-failure-session",
          input: "blocked"
        })
      ).rejects.toMatchObject({
        code: "SESSION_IO_ERROR"
      } satisfies Partial<AthenaError>);

      const rejections = await services.policyService.listConcurrencyRejections({
        sessionId: "lock-failure-session",
        limit: 10
      });
      expect(rejections.items.length).toBe(1);
      expect(rejections.items[0]?.reason).toBe("lock-acquisition-failed");
      expect(rejections.items[0]?.event.reason).toBe("lock-acquisition-failed");
      expect(rejections.items[0]?.event.schemaVersion).toBe(1);
      expect(rejections.items[0]?.event.rejectedRunDetails.sessionId).toBe("lock-failure-session");
      expect(rejections.items[0]?.policy?.engine).toBe("athena");
      expect(rejections.items[0]?.event.policy?.ruleType).toBe("concurrency");

      const rejectionEvents = await services.eventService.list({
        sessionId: "lock-failure-session",
        types: ["policy.concurrency.rejected"]
      });
      expect(rejectionEvents.events.length).toBe(1);
      const payload = rejectionEvents.events[0]?.payload as {
        rejection?: { reason?: string; schemaVersion?: number };
        reason?: string;
      };
      expect(payload.rejection?.reason).toBe("lock-acquisition-failed");
      expect(payload.rejection?.schemaVersion).toBe(1);
      expect(payload.reason).toBe("lock-acquisition-failed");
      expect(rejectionEvents.events[0]?.policy?.decision).toBe("rejected");

      const canonicalPolicyEvents = await services.eventService.list({
        sessionId: "lock-failure-session",
        types: ["policy.rejected"]
      });
      expect(canonicalPolicyEvents.events.length).toBe(1);
      expect(canonicalPolicyEvents.events[0]?.policy?.origin?.policyName).toBe("policy.maxConcurrentRuns");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("releases distributed lock on success, failure, and cancellation", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-policy-lock-release-"));
    try {
      let locked = false;
      let releaseCount = 0;
      const distributedLock: IDistributedLock = {
        async tryAcquire() {
          if (locked) {
            return { acquired: false };
          }
          locked = true;
          return {
            acquired: true,
            lockName: "policy.concurrency.slot.1",
            ownerId: "owner-release",
            token: "token-release",
            acquiredAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString()
          };
        },
        async release() {
          locked = false;
          releaseCount += 1;
        }
      };
      const backend: ExecutionBackend = {
        kind: "local",
        async run(request, options) {
          if (request.sessionId === "fail-session") {
            throw new AthenaError("PROVIDER_ERROR", "simulated backend failure");
          }
          if (request.sessionId === "cancel-session") {
            await new Promise<void>((resolve, reject) => {
              if (options?.signal?.aborted) {
                reject(new AthenaError("RUN_CANCELLED", "Run was cancelled before provider execution."));
                return;
              }
              const onAbort = () => {
                options?.signal?.removeEventListener("abort", onAbort);
                reject(new AthenaError("RUN_CANCELLED", "Run was cancelled before provider execution."));
              };
              options?.signal?.addEventListener("abort", onAbort, { once: true });
            });
          }
          return {
            sessionId: request.sessionId,
            output: "ok",
            provider: "mock",
            model: "mock-model",
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
        distributedLock
      });
      await services.policyService.put({
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        maxConcurrentRuns: 1
      });

      await services.runService.run({
        sessionId: "success-session",
        input: "ok"
      });
      expect(releaseCount).toBe(1);
      expect(locked).toBe(false);

      await expect(
        services.runService.run({
          sessionId: "fail-session",
          input: "fail"
        })
      ).rejects.toMatchObject({
        code: "PROVIDER_ERROR"
      } satisfies Partial<AthenaError>);
      expect(releaseCount).toBe(2);
      expect(locked).toBe(false);

      const controller = new AbortController();
      const cancelledRun = services.runService.run(
        {
          sessionId: "cancel-session",
          input: "cancel"
        },
        { signal: controller.signal }
      );
      controller.abort();
      await expect(cancelledRun).rejects.toMatchObject({
        code: "RUN_CANCELLED"
      } satisfies Partial<AthenaError>);
      expect(releaseCount).toBe(3);
      expect(locked).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("accepts k8s lease distributed lock provider selection at startup", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-policy-lock-provider-"));
    try {
      const config = loadConfig(dir);
      expect(() => {
        createLocalControlPlaneServices({
          config: {
            ...config,
            distributedLockProvider: "k8s-lease"
          }
        });
      }).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects redis distributed lock provider when ATHENA_REDIS_URL is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-policy-lock-provider-redis-missing-url-"));
    try {
      const config = loadConfig(dir);
      expect(() =>
        createLocalControlPlaneServices({
          config: {
            ...config,
            distributedLockProvider: "redis"
          }
        })
      ).toThrow("ATHENA_DISTRIBUTED_LOCK_PROVIDER=redis requires ATHENA_REDIS_URL");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("routes through sandbox backend when enabled and available", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-sandbox-route-success-"));
    try {
      let backendRunCount = 0;
      let claimCount = 0;
      let waitReadyCount = 0;
      let terminateCount = 0;
      let cleanupCount = 0;
      const observedClaimRuntimeClasses: Array<string | undefined> = [];
      let observedWorkspaceHostPath: string | undefined;
      let observedWorkspaceMountPath: string | undefined;
      let observedWorkspaceReadOnly: boolean | undefined;
      let observedWorkspaceSyncRepo: string | undefined;
      let observedWorkspaceSyncStrategy: string | undefined;
      let observedWorkspaceIgnore: string[] | undefined;

      const backend: ExecutionBackend = {
        kind: "local",
        async run(request) {
          backendRunCount += 1;
          return {
            sessionId: request.sessionId,
            output: "ok",
            provider: "mock",
            model: "mock-model",
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
      const sandboxExecutionBackend: SandboxExecutionBackend = {
        kind: "agent-sandbox",
        async isAvailable() {
          return true;
        },
        async claim(request) {
          claimCount += 1;
          observedClaimRuntimeClasses.push(request.runtimeClassName);
          observedWorkspaceHostPath = request.workspaceHostPath;
          observedWorkspaceMountPath = request.workspaceMountPath;
          observedWorkspaceReadOnly = request.workspaceReadOnly;
          observedWorkspaceSyncRepo = request.workspaceSyncRepo;
          observedWorkspaceSyncStrategy = request.workspaceSyncStrategy;
          observedWorkspaceIgnore = request.workspaceIgnore;
          return {
            status: "claimed",
            sandboxId: "sbx-1",
            claimName: "claim-1",
            namespace: "athena",
            ...(request.runtimeClassName ? { runtimeClassName: request.runtimeClassName } : {}),
            claimedAt: new Date().toISOString()
          };
        },
        async waitReady() {
          waitReadyCount += 1;
          return {
            status: "ready",
            observedAt: new Date().toISOString(),
            endpoint: "http://sandbox.local"
          };
        },
        async terminate() {
          terminateCount += 1;
          return {
            status: "terminated",
            observedAt: new Date().toISOString()
          };
        },
        async cleanup() {
          cleanupCount += 1;
          return {
            status: "cleaned",
            observedAt: new Date().toISOString()
          };
        }
      };

      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({
        config: {
          ...config,
          sandbox: {
            enabled: true,
            requireForHighSecurity: false,
            workspaceHostPath: "/workspace/source"
          },
          runtimeIsolation: {
            defaultProfile: "high-security",
            fallbackToDefaultRuntimeClass: true,
            profiles: {
              standard: {
                isolationProfile: "standard",
                runtimeClassName: "runc-default",
                requireSandbox: false
              },
              "high-security": {
                isolationProfile: "high-security",
                runtimeClassName: "gvisor-secure",
                requireSandbox: true
              }
            }
          }
        },
        executionBackend: backend,
        sandboxExecutionBackend
      });

      await services.runService.run({
        sessionId: "sandbox-success",
        input: "hello",
        metadata: {
          sandboxWorkspaceMountPath: "/athena/workspace",
          sandboxWorkspaceReadOnly: "true",
          sandboxWorkspaceRepo: "https://github.com/acme/repo.git",
          sandboxAllowedEgress: "github.com:443",
          sandboxWorkspaceRef: "main",
          sandboxWorkspaceSyncStrategy: "git-sync",
          sandboxWorkspaceIgnore: ".git,.env"
        }
      });

      const events = await services.eventService.list({
        sessionId: "sandbox-success",
        types: ["sandbox.lifecycle"],
        limit: 20
      });
      const phases = events.events.map((event) => event.sandbox?.phase);
      expect(backendRunCount).toBe(1);
      expect(claimCount).toBe(1);
      expect(waitReadyCount).toBe(1);
      expect(terminateCount).toBe(1);
      expect(cleanupCount).toBe(1);
      expect(observedClaimRuntimeClasses).toEqual(["gvisor-secure"]);
      expect(observedWorkspaceHostPath).toBe("/workspace/source");
      expect(observedWorkspaceMountPath).toBe("/athena/workspace");
      expect(observedWorkspaceReadOnly).toBe(true);
      expect(observedWorkspaceSyncRepo).toBe("https://github.com/acme/repo.git");
      expect(observedWorkspaceSyncStrategy).toBe("git-sync");
      expect(observedWorkspaceIgnore).toEqual([".git", ".env"]);
      expect(phases).toEqual(["claiming", "claimed", "ready", "terminating", "cleaned"]);
      const ready = events.events.find((event) => event.sandbox?.phase === "ready");
      expect(typeof ready?.sandbox?.latencyMsClaimToReady).toBe("number");
      expect(typeof ready?.sandbox?.latencyMsStartup).toBe("number");
      expect((ready?.sandbox?.latencyMsClaimToReady ?? 0) >= 0).toBe(true);
      expect(ready?.sandbox?.isolationProfile).toBe("high-security");
      expect(ready?.sandbox?.runtimeClassName).toBe("gvisor-secure");
      expect(ready?.sandbox?.startMode).toBe("cold");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to direct backend execution when sandbox is unavailable and not required", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-sandbox-route-fallback-"));
    try {
      let backendRunCount = 0;
      let claimCount = 0;
      const backend: ExecutionBackend = {
        kind: "local",
        async run(request) {
          backendRunCount += 1;
          return {
            sessionId: request.sessionId,
            output: "ok",
            provider: "mock",
            model: "mock-model",
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
      const sandboxExecutionBackend: SandboxExecutionBackend = {
        kind: "agent-sandbox",
        async isAvailable() {
          return false;
        },
        async claim() {
          claimCount += 1;
          return {
            status: "unsupported",
            reason: "unavailable"
          };
        },
        async waitReady() {
          return {
            status: "unsupported",
            observedAt: new Date().toISOString(),
            reason: "unavailable"
          };
        },
        async terminate() {
          return {
            status: "unsupported",
            observedAt: new Date().toISOString(),
            reason: "unavailable"
          };
        },
        async cleanup() {
          return {
            status: "unsupported",
            observedAt: new Date().toISOString(),
            reason: "unavailable"
          };
        }
      };

      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({
        config: {
          ...config,
          sandbox: {
            enabled: true,
            requireForHighSecurity: false
          }
        },
        executionBackend: backend,
        sandboxExecutionBackend
      });

      await services.runService.run({
        sessionId: "sandbox-fallback",
        input: "hello"
      });

      const events = await services.eventService.list({
        sessionId: "sandbox-fallback",
        types: ["sandbox.lifecycle"],
        limit: 20
      });
      expect(backendRunCount).toBe(1);
      expect(claimCount).toBe(0);
      expect(events.events.map((event) => event.sandbox?.phase)).toEqual(["fallback"]);
      expect(events.events[0]?.sandbox?.reason).toContain("direct execution");
      expect(events.events[0]?.sandbox?.isolationProfile).toBe("standard");
      expect(events.events[0]?.sandbox?.startMode).toBe("cold");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails closed when sandbox is required for high-security run context and unavailable", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-sandbox-route-fail-closed-"));
    try {
      let backendRunCount = 0;
      const backend: ExecutionBackend = {
        kind: "local",
        async run(request) {
          backendRunCount += 1;
          return {
            sessionId: request.sessionId,
            output: "ok",
            provider: "mock",
            model: "mock-model",
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
      const sandboxExecutionBackend: SandboxExecutionBackend = {
        kind: "agent-sandbox",
        async isAvailable() {
          return false;
        },
        async claim() {
          return {
            status: "unsupported",
            reason: "unavailable"
          };
        },
        async waitReady() {
          return {
            status: "unsupported",
            observedAt: new Date().toISOString(),
            reason: "unavailable"
          };
        },
        async terminate() {
          return {
            status: "unsupported",
            observedAt: new Date().toISOString(),
            reason: "unavailable"
          };
        },
        async cleanup() {
          return {
            status: "unsupported",
            observedAt: new Date().toISOString(),
            reason: "unavailable"
          };
        }
      };

      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({
        config: {
          ...config,
          sandbox: {
            enabled: true,
            requireForHighSecurity: true
          }
        },
        executionBackend: backend,
        sandboxExecutionBackend
      });

      await expect(
        services.runService.run({
          sessionId: "sandbox-required",
          input: "hello",
          metadata: {
            securityLevel: "high"
          }
        })
      ).rejects.toMatchObject({
        code: "CONFIG_ERROR"
      } satisfies Partial<AthenaError>);
      const events = await services.eventService.list({
        sessionId: "sandbox-required",
        types: ["sandbox.lifecycle"],
        limit: 20
      });
      expect(backendRunCount).toBe(0);
      expect(events.events.map((event) => event.sandbox?.phase)).toEqual(["required-unavailable"]);
      expect(events.events[0]?.sandbox?.isolationProfile).toBe("high-security");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses profile fallback runtime class for high-security when profile runtime class is unset", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-sandbox-runtimeclass-fallback-"));
    try {
      const observedClaimRuntimeClasses: Array<string | undefined> = [];
      const backend: ExecutionBackend = {
        kind: "local",
        async run(request) {
          return {
            sessionId: request.sessionId,
            output: "ok",
            provider: "mock",
            model: "mock-model",
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
      const sandboxExecutionBackend: SandboxExecutionBackend = {
        kind: "agent-sandbox",
        async isAvailable() {
          return true;
        },
        async claim(request) {
          observedClaimRuntimeClasses.push(request.runtimeClassName);
          return {
            status: "claimed",
            sandboxId: "sbx-runtimeclass-fallback",
            ...(request.runtimeClassName ? { runtimeClassName: request.runtimeClassName } : {}),
            claimedAt: new Date().toISOString()
          };
        },
        async waitReady() {
          return {
            status: "ready",
            observedAt: new Date().toISOString()
          };
        },
        async terminate() {
          return {
            status: "terminated",
            observedAt: new Date().toISOString()
          };
        },
        async cleanup() {
          return {
            status: "cleaned",
            observedAt: new Date().toISOString()
          };
        }
      };

      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({
        config: {
          ...config,
          sandbox: {
            enabled: true,
            requireForHighSecurity: false
          },
          runtimeIsolation: {
            defaultProfile: "standard",
            fallbackToDefaultRuntimeClass: true,
            profiles: {
              standard: {
                isolationProfile: "standard",
                runtimeClassName: "runc-default",
                requireSandbox: false
              },
              "high-security": {
                isolationProfile: "high-security",
                requireSandbox: true
              }
            }
          }
        },
        executionBackend: backend,
        sandboxExecutionBackend
      });

      await services.runService.run({
        sessionId: "sandbox-runtimeclass-fallback",
        input: "hello",
        metadata: {
          isolationProfile: "high-security",
          sandboxWarmPoolRef: "warm-pool-a"
        }
      });

      expect(observedClaimRuntimeClasses).toEqual(["runc-default"]);
      const events = await services.eventService.list({
        sessionId: "sandbox-runtimeclass-fallback",
        types: ["sandbox.lifecycle"],
        limit: 20
      });
      const claimed = events.events.find((event) => event.sandbox?.phase === "claimed");
      expect(claimed?.sandbox?.runtimeClassName).toBe("runc-default");
      expect(claimed?.sandbox?.startMode).toBe("warm");
      expect(claimed?.sandbox?.isolationProfile).toBe("high-security");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("releases active run state on abort when sandbox route is enabled", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-sandbox-route-abort-cleanup-"));
    try {
      const activeSessions = new Set<string>();
      let terminateReason: "cancelled" | "timeout" | "failed" | "cleanup" | undefined;
      let terminateCount = 0;
      let cleanupCount = 0;
      const backend: ExecutionBackend = {
        kind: "local",
        async run(request, options) {
          activeSessions.add(request.sessionId);
          try {
            await new Promise<void>((resolve, reject) => {
              if (options?.signal?.aborted) {
                reject(new AthenaError("RUN_CANCELLED", "Run was cancelled before provider execution."));
                return;
              }
              const onAbort = () => {
                options?.signal?.removeEventListener("abort", onAbort);
                reject(new AthenaError("RUN_CANCELLED", "Run was cancelled before provider execution."));
              };
              options?.signal?.addEventListener("abort", onAbort, { once: true });
            });
          } finally {
            activeSessions.delete(request.sessionId);
          }
          return {
            sessionId: request.sessionId,
            output: "ok",
            provider: "mock",
            model: "mock-model",
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
          return {
            items: Array.from(activeSessions).map((sessionId) => ({
              sessionId,
              pid: 1,
              startedAt: new Date().toISOString(),
              runId: `run-${sessionId}`
            }))
          };
        }
      };
      const sandboxExecutionBackend: SandboxExecutionBackend = {
        kind: "agent-sandbox",
        async isAvailable() {
          return true;
        },
        async claim() {
          return {
            status: "claimed",
            sandboxId: "sbx-abort",
            claimName: "claim-abort",
            namespace: "athena",
            claimedAt: new Date().toISOString()
          };
        },
        async waitReady() {
          return {
            status: "ready",
            observedAt: new Date().toISOString()
          };
        },
        async terminate(request) {
          terminateReason = request.reason;
          terminateCount += 1;
          return {
            status: "terminated",
            observedAt: new Date().toISOString()
          };
        },
        async cleanup() {
          cleanupCount += 1;
          return {
            status: "cleaned",
            observedAt: new Date().toISOString()
          };
        }
      };

      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({
        config: {
          ...config,
          sandbox: {
            enabled: true,
            requireForHighSecurity: false
          }
        },
        executionBackend: backend,
        sandboxExecutionBackend
      });

      const controller = new AbortController();
      const pending = services.runService.run(
        {
          sessionId: "sandbox-abort",
          input: "wait"
        },
        { signal: controller.signal }
      );
      controller.abort();

      await expect(pending).rejects.toMatchObject({
        code: "RUN_CANCELLED"
      } satisfies Partial<AthenaError>);

      const active = await services.runService.listActiveRuns({ sessionId: "sandbox-abort", limit: 5 });
      const events = await services.eventService.list({
        sessionId: "sandbox-abort",
        types: ["sandbox.lifecycle"],
        limit: 20
      });
      expect(active.items).toEqual([]);
      expect(terminateReason).toBe("cancelled");
      expect(terminateCount).toBe(1);
      expect(cleanupCount).toBe(1);
      expect(events.events.map((event) => event.sandbox?.phase)).toEqual([
        "claiming",
        "claimed",
        "ready",
        "terminating",
        "cleaned"
      ]);
      const terminating = events.events.find((event) => event.sandbox?.phase === "terminating");
      expect(terminating?.sandbox?.reason).toBe("cancelled");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails closed and cleans up when sandbox resource quota is exceeded", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-sandbox-quota-enforce-"));
    try {
      let terminateReason: "cancelled" | "timeout" | "failed" | "cleanup" | undefined;
      let terminateCount = 0;
      let cleanupCount = 0;
      const backend: ExecutionBackend = {
        kind: "local",
        async run(request, options) {
          await new Promise<void>((resolve, reject) => {
            if (options?.signal?.aborted) {
              reject(new AthenaError("RUN_CANCELLED", "Run was cancelled before provider execution."));
              return;
            }
            const timer = setTimeout(resolve, 5_000);
            const onAbort = () => {
              clearTimeout(timer);
              options?.signal?.removeEventListener("abort", onAbort);
              reject(new AthenaError("RUN_CANCELLED", "Run was cancelled before provider execution."));
            };
            options?.signal?.addEventListener("abort", onAbort, { once: true });
          });
          return {
            sessionId: request.sessionId,
            output: "ok",
            provider: "mock",
            model: "mock-model",
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
      const sandboxExecutionBackend: SandboxExecutionBackend = {
        kind: "agent-sandbox",
        async isAvailable() {
          return true;
        },
        async claim() {
          return {
            status: "claimed",
            sandboxId: "sbx-quota",
            claimName: "claim-quota",
            namespace: "athena",
            claimedAt: new Date().toISOString()
          };
        },
        async waitReady() {
          return {
            status: "ready",
            observedAt: new Date().toISOString()
          };
        },
        async terminate(request) {
          terminateReason = request.reason;
          terminateCount += 1;
          return {
            status: "terminated",
            observedAt: new Date().toISOString()
          };
        },
        async cleanup() {
          cleanupCount += 1;
          return {
            status: "cleaned",
            observedAt: new Date().toISOString()
          };
        },
        async getResourceUsage() {
          return {
            status: "ok",
            observedAt: new Date().toISOString(),
            cpuCores: 2
          };
        }
      };

      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({
        config: {
          ...config,
          sandbox: {
            enabled: true,
            requireForHighSecurity: false
          }
        },
        executionBackend: backend,
        sandboxExecutionBackend
      });

      await expect(
        services.runService.run({
          sessionId: "sandbox-quota",
          input: "enforce",
          metadata: {
            sandboxQuotaCpuCores: "0.5",
            sandboxQuotaPollMs: "10"
          }
        })
      ).rejects.toMatchObject({
        code: "RUN_TIMEOUT"
      } satisfies Partial<AthenaError>);

      const lifecycleEvents = await services.eventService.list({
        sessionId: "sandbox-quota",
        types: ["sandbox.lifecycle"],
        limit: 20
      });
      const quotaEvents = await services.eventService.list({
        sessionId: "sandbox-quota",
        types: ["sandbox.quota-exceeded"],
        limit: 10
      });
      const safetyEvents = await services.eventService.list({
        sessionId: "sandbox-quota",
        types: ["safety.violation"],
        limit: 10
      });
      expect(terminateReason).toBe("timeout");
      expect(terminateCount).toBe(1);
      expect(cleanupCount).toBe(1);
      expect(lifecycleEvents.events.map((event) => event.sandbox?.phase)).toEqual([
        "claiming",
        "claimed",
        "ready",
        "terminating",
        "cleaned"
      ]);
      const terminating = lifecycleEvents.events.find((event) => event.sandbox?.phase === "terminating");
      expect(terminating?.sandbox?.reason).toContain("Sandbox quota exceeded");
      expect(quotaEvents.events[0]?.payload).toMatchObject({
        quota: {
          cpuCoresMax: 0.5
        }
      });
      expect(safetyEvents.events[0]?.payload).toMatchObject({
        violationCode: "SANDBOX_QUOTA_EXCEEDED",
        category: "sandbox",
        severity: "critical"
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("allows sandbox run when declared egress destinations match harness allow-list", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-sandbox-egress-allow-"));
    try {
      let backendRunCount = 0;
      let observedEgressAllow: Array<{ host: string; port?: number }> = [];
      const backend: ExecutionBackend = {
        kind: "local",
        async run(request) {
          backendRunCount += 1;
          return {
            sessionId: request.sessionId,
            output: "ok",
            provider: "mock",
            model: "mock-model",
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
      const sandboxExecutionBackend: SandboxExecutionBackend = {
        kind: "agent-sandbox",
        async isAvailable() {
          return true;
        },
        async claim(request) {
          observedEgressAllow = request.egressPolicy?.allow ?? [];
          return {
            status: "claimed",
            sandboxId: "sbx-egress-allow",
            claimName: "claim-egress-allow",
            namespace: "athena",
            claimedAt: new Date().toISOString()
          };
        },
        async waitReady() {
          return {
            status: "ready",
            observedAt: new Date().toISOString()
          };
        },
        async terminate() {
          return {
            status: "terminated",
            observedAt: new Date().toISOString()
          };
        },
        async cleanup() {
          return {
            status: "cleaned",
            observedAt: new Date().toISOString()
          };
        }
      };

      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({
        config: {
          ...config,
          sandbox: {
            enabled: true,
            requireForHighSecurity: false
          }
        },
        executionBackend: backend,
        sandboxExecutionBackend
      });
      const profile = await services.harnessProfileService.create({
        displayName: "Egress Allowed",
        version: "v1",
        config: {
          provider: "mock",
          model: "mock-model",
          tools: ["review"]
        },
        policies: {
          timeoutMs: 30_000,
          retryLimit: 1,
          budgetUsd: 1
        },
        allowedEgress: [{ host: "api.openai.com", port: 443 }]
      });

      await services.runService.run({
        sessionId: "sandbox-egress-allow",
        input: "hello",
        harnessProfileId: profile.id,
        metadata: {
          sandboxWorkspaceRepo: "https://api.openai.com/v1/models"
        }
      });

      const egressEvents = await services.eventService.list({
        sessionId: "sandbox-egress-allow",
        types: ["sandbox.egress-policy"],
        limit: 10
      });
      expect(backendRunCount).toBe(1);
      expect(observedEgressAllow).toEqual([{ host: "api.openai.com", port: 443 }]);
      expect(egressEvents.events[0]?.payload).toMatchObject({
        decision: "allowed"
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails closed when declared sandbox egress destination is not allow-listed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-sandbox-egress-block-"));
    try {
      let backendRunCount = 0;
      let claimCount = 0;
      const backend: ExecutionBackend = {
        kind: "local",
        async run(request) {
          backendRunCount += 1;
          return {
            sessionId: request.sessionId,
            output: "ok",
            provider: "mock",
            model: "mock-model",
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
      const sandboxExecutionBackend: SandboxExecutionBackend = {
        kind: "agent-sandbox",
        async isAvailable() {
          return true;
        },
        async claim() {
          claimCount += 1;
          return {
            status: "claimed",
            sandboxId: "sbx-egress-block",
            claimedAt: new Date().toISOString()
          };
        },
        async waitReady() {
          return {
            status: "ready",
            observedAt: new Date().toISOString()
          };
        },
        async terminate() {
          return {
            status: "terminated",
            observedAt: new Date().toISOString()
          };
        },
        async cleanup() {
          return {
            status: "cleaned",
            observedAt: new Date().toISOString()
          };
        }
      };

      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({
        config: {
          ...config,
          sandbox: {
            enabled: true,
            requireForHighSecurity: false
          }
        },
        executionBackend: backend,
        sandboxExecutionBackend
      });
      const profile = await services.harnessProfileService.create({
        displayName: "Egress Restricted",
        version: "v1",
        config: {
          provider: "mock",
          model: "mock-model",
          tools: ["review"]
        },
        policies: {
          timeoutMs: 30_000,
          retryLimit: 1,
          budgetUsd: 1
        },
        allowedEgress: [{ host: "api.openai.com", port: 443 }]
      });

      await expect(
        services.runService.run({
          sessionId: "sandbox-egress-block",
          input: "hello",
          harnessProfileId: profile.id,
          metadata: {
            sandboxWorkspaceRepo: "https://example.com/repo.git"
          }
        })
      ).rejects.toMatchObject({
        code: "CONFIG_ERROR"
      } satisfies Partial<AthenaError>);

      const egressEvents = await services.eventService.list({
        sessionId: "sandbox-egress-block",
        types: ["sandbox.egress-policy"],
        limit: 10
      });
      const safetyEvents = await services.eventService.list({
        sessionId: "sandbox-egress-block",
        types: ["safety.violation"],
        limit: 10
      });
      expect(backendRunCount).toBe(0);
      expect(claimCount).toBe(0);
      expect(egressEvents.events[0]?.payload).toMatchObject({
        decision: "blocked"
      });
      expect(safetyEvents.events[0]?.payload).toMatchObject({
        violationCode: "SANDBOX_EGRESS_BLOCKED",
        category: "sandbox",
        outcome: "blocked"
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns local operations summary counters in OperationsSummary contract shape", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-operations-summary-"));
    try {
      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config });

      await services.runService.run({
        sessionId: "s1",
        input: "hello"
      });
      await services.workService.enqueue({
        sessionId: "s1",
        payload: "todo",
        mode: "followup"
      });
      const appState = openAppStateDatabase(config);
      try {
        seedReadyScheduleTask(appState, "task-operations-summary");
      } finally {
        appState.close();
      }
      await services.scheduleService.upsert({
        id: "job1",
        targetType: "task",
        targetId: "task-operations-summary",
        runAt: "2026-06-01T09:00:00.000Z",
        timezone: "UTC"
      });
      const putPolicy = await services.policyService.put({
        schemaVersion: 1,
        updatedAt: "2026-02-16T12:00:00.000Z",
        maxConcurrentRuns: 2,
        defaultRunTimeoutMs: 5000
      });
      expect(putPolicy.updatedAt).not.toBe("2026-02-16T12:00:00.000Z");

      const activeDir = join(dir, ".athena", "runtime", "active");
      const cancelDir = join(dir, ".athena", "runtime", "cancel");
      mkdirSync(activeDir, { recursive: true });
      mkdirSync(cancelDir, { recursive: true });
      writeFileSync(join(activeDir, "a.json"), "{}\n", "utf8");
      writeFileSync(join(cancelDir, "a.json"), "{}\n", "utf8");

      const summary = await services.operationsService.getSummary();
      expect(summary.total).toBeGreaterThanOrEqual(1);
      expect(summary.running).toBe(1);
      expect(summary.pending).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.succeeded).toBeGreaterThanOrEqual(0);
      expect(summary.uptime).toBeGreaterThanOrEqual(0);
      expect(summary.uptime).toBeLessThanOrEqual(1);
      expect(summary.errorRate).toBeGreaterThanOrEqual(0);
      expect(summary.errorRate).toBeLessThanOrEqual(1);
      expect(summary.capabilities).toEqual({
        supportsPodStatus: false,
        supportsCpuMemMetrics: false
      });
      expect(summary.cpuUsage).toBeUndefined();
      expect(summary.memoryUsage).toBeUndefined();
      expect(summary.operationalSummary).toEqual({
        totalActiveRuns: 0,
        totalActiveSessions: 0,
        aggregateResourceUsage: {
          cpuUsage: 0,
          memoryUsage: 0
        },
        recentFailureRejectionCount: 0
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("maps k8s operations metrics and capabilities through backend provider support", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-operations-k8s-"));
    try {
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
        },
        async getOperationsMetrics() {
          return {
            supportsPods: true,
            supportsCpuMemMetrics: true,
            runs: {
              active: 7,
              cancellationRequested: 2
            }
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
              throw new Error("kube unavailable");
            }
          },
          podMetricsApiClient: {
            async listClusterCustomObject() {
              return { items: [] };
            }
          }
        }
      });

      const capabilities = await services.capabilityService.getCapabilities();
      expect(capabilities.executionBackend).toBe("k8s");
      expect(capabilities.supportsPods).toBe(true);
      expect(capabilities.supportsCpuMemMetrics).toBe(true);
      expect(capabilities.supportsSandbox).toBe(false);

      const summary = await services.operationsService.getSummary();
      expect(summary.running).toBe(7);
      expect(summary.pending).toBe(2);
      expect(summary.total).toBe(9);
      expect(summary.uptime).toBe(1);
      expect(summary.errorRate).toBe(0);
      expect(summary.capabilities).toEqual({
        supportsPodStatus: true,
        supportsCpuMemMetrics: true
      });
      expect(summary.cpuUsage).toBeUndefined();
      expect(summary.memoryUsage).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns aggregated k8s CPU/memory usage through operations service", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-operations-k8s-resources-"));
    try {
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
        },
        async getOperationsMetrics() {
          return {
            supportsPods: true,
            supportsCpuMemMetrics: true,
            runs: {
              active: 0,
              cancellationRequested: 0
            }
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
              return {
                items: [
                  { metadata: { namespace: "athena", name: "agent-1" }, status: { phase: "Running" } },
                  { metadata: { namespace: "athena", name: "agent-2" }, status: { phase: "Pending" } }
                ]
              };
            }
          },
          podMetricsApiClient: {
            async listClusterCustomObject() {
              return {
                items: [
                  {
                    metadata: { namespace: "athena", name: "agent-1" },
                    containers: [{ usage: { cpu: "750m", memory: "256Mi" } }]
                  },
                  {
                    metadata: { namespace: "athena", name: "agent-2" },
                    containers: [{ usage: { cpu: "0.25", memory: "64Mi" } }]
                  },
                  {
                    metadata: { namespace: "other", name: "ignore-me" },
                    containers: [{ usage: { cpu: "3", memory: "1Gi" } }]
                  }
                ]
              };
            }
          }
        }
      });

      const summary = await services.operationsService.getSummary();
      expect(summary.total).toBe(2);
      expect(summary.running).toBe(1);
      expect(summary.pending).toBe(1);
      expect(summary.succeeded).toBe(0);
      expect(summary.failed).toBe(0);
      expect(summary.uptime).toBe(1);
      expect(summary.errorRate).toBe(0);
      expect(summary.capabilities).toEqual({
        supportsPodStatus: true,
        supportsCpuMemMetrics: true
      });
      expect(summary.cpuUsage).toBe(1);
      expect(summary.memoryUsage).toBe(335544320);
      expect(summary.operationalSummary).toEqual({
        totalActiveRuns: 0,
        totalActiveSessions: 0,
        aggregateResourceUsage: {
          cpuUsage: 1,
          memoryUsage: 335544320
        },
        recentFailureRejectionCount: 0
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("selects k8s metrics provider via config when requested", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-operations-provider-select-"));
    try {
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
        },
        async getOperationsMetrics() {
          return {
            supportsPods: true,
            supportsCpuMemMetrics: false,
            runs: {
              active: 3,
              cancellationRequested: 1
            }
          };
        }
      };

      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({
        config: {
          ...config,
          operationsMetricsProvider: "k8s"
        },
        executionBackend: backend,
        k8sMetricsProviderOptions: {
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
      });

      const summary = await services.operationsService.getSummary();
      expect(summary.running).toBe(3);
      expect(summary.pending).toBe(1);
      expect(summary.total).toBe(4);
      expect(summary.uptime).toBe(1);
      expect(summary.errorRate).toBe(0);
      expect(summary.capabilities).toEqual({
        supportsPodStatus: true,
        supportsCpuMemMetrics: false
      });

      const capabilities = await services.capabilityService.getCapabilities();
      expect(capabilities.executionBackend).toBe("local");
      expect(capabilities.supportsPods).toBe(true);
      expect(capabilities.supportsCpuMemMetrics).toBe(false);
      expect(capabilities.supportsSandbox).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("caches operations operational summaries for 5 seconds before recomputing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T00:00:00.000Z"));
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-operations-cache-"));
    try {
      let activeRuns = [
        {
          sessionId: "s1",
          pid: 1,
          startedAt: "2026-02-20T00:00:00.000Z",
          runId: "run-1"
        }
      ];
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
        },
        async listActiveRuns() {
          return { items: activeRuns };
        }
      };

      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config, executionBackend: backend });
      await services.eventService.emit({
        type: "authz.denied",
        payload: {
          operation: "runs.cancel"
        }
      });

      const first = await services.operationsService.getSummary();
      expect(first.operationalSummary).toEqual({
        totalActiveRuns: 1,
        totalActiveSessions: 1,
        aggregateResourceUsage: {
          cpuUsage: 0,
          memoryUsage: 0
        },
        recentFailureRejectionCount: 1
      });

      activeRuns = [
        {
          sessionId: "s1",
          pid: 1,
          startedAt: "2026-02-20T00:00:00.000Z",
          runId: "run-1"
        },
        {
          sessionId: "s2",
          pid: 2,
          startedAt: "2026-02-20T00:00:01.000Z",
          runId: "run-2"
        }
      ];
      await services.eventService.emit({
        type: "policy.concurrency.rejected",
        payload: {
          activeRuns: 2,
          maxConcurrentRuns: 1
        }
      });

      vi.setSystemTime(new Date("2026-02-20T00:00:01.000Z"));
      const cached = await services.operationsService.getSummary();
      expect(cached.operationalSummary).toEqual(first.operationalSummary);

      vi.setSystemTime(new Date("2026-02-20T00:00:06.100Z"));
      const refreshed = await services.operationsService.getSummary();
      expect(refreshed.operationalSummary).toEqual({
        totalActiveRuns: 2,
        totalActiveSessions: 2,
        aggregateResourceUsage: {
          cpuUsage: 0,
          memoryUsage: 0
        },
        recentFailureRejectionCount: 2
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
      vi.useRealTimers();
    }
  });
});

function seedReadyScheduleTask(appState: ReturnType<typeof openAppStateDatabase>, taskId: string): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.policy-scheduler",
    version: "0.1.0",
    path: "/tmp/team-orchestrator-policy-scheduler",
    enabled: true,
    status: "loaded",
    sourceType: "local",
    manifest: { plugin: { name: "Policy Scheduler Test" } },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "policy.scheduler.agent",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.policy-scheduler",
    pluginVersion: "0.1.0",
    name: "Policy Scheduler Agent",
    capabilities: ["test.run"],
    manifest: {},
    status: "loaded"
  });
  appState.tasks.create({
    id: taskId,
    title: "Scheduled policy task",
    status: "ready",
    assignedAgentId: "policy.scheduler.agent",
    assignedAgentVersion: "1.0.0",
    capabilityRequirements: ["test.run"]
  });
}
