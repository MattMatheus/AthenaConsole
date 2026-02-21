import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createLocalControlPlaneServices } from "../src/control-plane/services.js";
import { loadConfig } from "../src/shared/config.js";

async function waitFor(
  condition: () => Promise<boolean>,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
  } = {}
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 3_000;
  const intervalMs = options.intervalMs ?? 30;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for condition");
}

describe("control-plane events and a2a dlq services", () => {
  it("emits/lists events and updates dlq records", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-events-"));
    try {
      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config });

      await services.eventService.emit({
        type: "test.event",
        sessionId: "s1",
        runId: "run-1",
        sandbox: {
          schemaVersion: 1,
          backend: "agent-sandbox",
          phase: "claimed",
          sandboxId: "sbx-1"
        },
        policy: {
          schemaVersion: 1,
          decision: "mutated",
          workload: {
            schemaVersion: 1,
            labels: {
              "athena.dev/agent-role": "build-agent",
              "athena.dev/run-id": "run-1",
              "athena.dev/session-id": "s1",
              "athena.dev/control-plane": "v1"
            }
          },
          origin: {
            schemaVersion: 1,
            engine: "kyverno",
            ruleType: "mutate",
            policyName: "athena-build-agent-mutate",
            ruleName: "add-build-agent-env-and-labels",
            failureAction: "enforce",
            resourceRef: {
              kind: "Pod",
              name: "run-1",
              namespace: "athena"
            }
          }
        },
        payload: { hello: "world" }
      });
      const events = await services.eventService.list({ limit: 10 });
      expect(events.events.length).toBe(1);
      expect(events.events[0]?.type).toBe("test.event");
      expect(events.events[0]?.sessionId).toBe("s1");
      expect(events.events[0]?.runId).toBe("run-1");
      expect(events.events[0]?.sandbox).toEqual({
        schemaVersion: 1,
        backend: "agent-sandbox",
        phase: "claimed",
        sandboxId: "sbx-1"
      });
      expect(events.events[0]?.policy?.decision).toBe("mutated");
      expect(events.events[0]?.policy?.origin?.engine).toBe("kyverno");
      expect(events.events[0]?.policy?.workload.labels["athena.dev/run-id"]).toBe("run-1");

      await services.eventService.emit({
        traceId: "trace-flow-1",
        type: "a2a.message.sent",
        runId: "run-child-1",
        parentRunId: "run-parent-1",
        payload: {
          fromAgent: "planner",
          toAgent: "executor"
        }
      });
      await services.eventService.emit({
        traceId: "trace-flow-1",
        type: "a2a.message.failed",
        runId: "run-child-1",
        parentRunId: "run-parent-1",
        payload: {
          fromAgent: "executor",
          toAgent: "validator",
          status: "failed"
        }
      });
      await services.eventService.emit({
        traceId: "trace-flow-2",
        type: "a2a.message.sent",
        runId: "run-other",
        parentRunId: "run-other-parent",
        payload: {
          fromAgent: "unrelated",
          toAgent: "other"
        }
      });

      const filteredByTrace = await services.eventService.list({ traceId: "trace-flow-1", limit: 10 });
      expect(filteredByTrace.events.length).toBe(2);
      expect(filteredByTrace.events.every((event) => event.traceId === "trace-flow-1")).toBe(true);

      const flow = await services.a2aFlowService.getTrace("trace-flow-1", { limit: 10 });
      expect(flow.traceId).toBe("trace-flow-1");
      expect(flow.truncated).toBe(false);
      expect(flow.edges.length).toBe(2);
      expect(flow.edges[0]?.step).toBe(1);
      expect(flow.edges[0]?.status).toBe("sent");
      expect(flow.edges[0]?.statusLabel).toContain("Step 1");
      expect(flow.edges[1]?.status).toBe("failed");
      expect(flow.edges[1]?.statusLabel).toContain("Response Failed");
      expect(flow.nodes.some((node) => node.id === "run:run-parent-1")).toBe(true);
      expect(flow.nodes.some((node) => node.id === "run:run-child-1")).toBe(true);

      await services.eventService.emit({
        traceId: "trace-flow-1",
        type: "work.enqueued",
        sessionId: "queue-alpha",
        taskId: "item-1",
        payload: {
          queueDepth: 3,
          stepId: "planner"
        }
      });
      await services.eventService.emit({
        traceId: "trace-flow-1",
        type: "a2a.message.started",
        sessionId: "queue-alpha",
        taskId: "item-1",
        payload: {
          stepId: "planner"
        }
      });
      await services.eventService.emit({
        traceId: "trace-flow-1",
        type: "a2a.message.completed",
        sessionId: "queue-alpha",
        taskId: "item-1",
        payload: {
          stepId: "planner"
        }
      });
      await services.eventService.emit({
        traceId: "trace-flow-1",
        type: "work.drained",
        sessionId: "queue-alpha",
        payload: {
          drainedItems: 2,
          queueDepthAfter: 1
        }
      });
      await services.eventService.emit({
        traceId: "trace-flow-1",
        type: "work.enqueued",
        sessionId: "queue-alpha",
        taskId: "item-2",
        payload: {
          queueDepth: 2,
          stepId: "planner"
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 20));

      const observability = await services.a2aObservabilityService.getSnapshot({
        windowMinutes: 30,
        bucketMinutes: 5,
        limit: 200
      });
      expect(observability.throughput.some((point) => point.queueId === "queue-alpha")).toBe(true);
      expect(observability.latencyHeatmap.some((cell) => cell.stepId === "planner")).toBe(true);
      expect(Array.isArray(observability.stallAlerts)).toBe(true);

      const alertHistory = await services.a2aObservabilityService.listAlertHistory({
        limit: 20,
        createdAfter: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        createdBefore: new Date().toISOString()
      });
      expect(Array.isArray(alertHistory.items)).toBe(true);

      const alertCsv = await services.a2aObservabilityService.exportAlertHistoryCsv({
        createdAfter: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        createdBefore: new Date().toISOString()
      });
      expect(alertCsv).toContain("id,createdAt,resolvedAt,status,severity");

      const a2aDir = join(dir, ".athena", "a2a");
      mkdirSync(a2aDir, { recursive: true });
      writeFileSync(
        join(a2aDir, "dlq.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            items: [
              {
                id: "item-1",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: "pending",
                payload: {}
              }
            ]
          },
          null,
          2
        ),
        "utf8"
      );

      const listed = await services.a2aDlqService.list({ status: "pending" });
      expect(listed.items.length).toBe(1);
      expect(listed.items[0]?.id).toBe("item-1");

      const requeued = await services.a2aDlqService.requeue("item-1");
      expect(requeued.updated).toBe(true);
      expect(requeued.item?.status).toBe("requeued");

      const discarded = await services.a2aDlqService.discard("item-1");
      expect(discarded.updated).toBe(true);
      expect(discarded.item?.status).toBe("discarded");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists JSONL events across service recreation and supports cursor pagination", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-events-persist-"));
    try {
      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config });

      for (let index = 0; index < 5; index += 1) {
        await services.eventService.emit({
          type: `persist.event.${index}`,
          sessionId: "persist-session",
          payload: { index }
        });
      }

      const eventsPath = join(dir, ".athena", "events", "events.jsonl");
      const rows = readFileSync(eventsPath, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean);
      expect(rows.length).toBe(5);
      for (const row of rows) {
        expect(() => JSON.parse(row)).not.toThrow();
      }

      const recreated = createLocalControlPlaneServices({ config: loadConfig(dir) });
      const firstPage = await recreated.eventService.list({
        sessionId: "persist-session",
        limit: 2
      });
      expect(firstPage.events.map((event) => event.type)).toEqual(["persist.event.0", "persist.event.1"]);
      expect(firstPage.nextCursor).toBeDefined();
      const secondCursor = firstPage.nextCursor as string;

      const secondPage = await recreated.eventService.list({
        sessionId: "persist-session",
        limit: 2,
        cursor: secondCursor
      });
      expect(secondPage.events.map((event) => event.type)).toEqual(["persist.event.2", "persist.event.3"]);
      expect(secondPage.nextCursor).toBeDefined();
      const thirdCursor = secondPage.nextCursor as string;

      const thirdPage = await recreated.eventService.list({
        sessionId: "persist-session",
        limit: 2,
        cursor: thirdCursor
      });
      expect(thirdPage.events.map((event) => event.type)).toEqual(["persist.event.4"]);
      expect(thirdPage.nextCursor).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps listing valid rows when jsonl contains malformed lines", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-events-malformed-read-"));
    try {
      const eventsDir = join(dir, ".athena", "events");
      mkdirSync(eventsDir, { recursive: true });
      writeFileSync(
        join(eventsDir, "events.jsonl"),
        [
          JSON.stringify({
            id: "evt-1",
            traceId: "trace-1",
            type: "valid.event.1",
            createdAt: new Date().toISOString(),
            payload: {}
          }),
          "{not-valid-json",
          JSON.stringify({
            id: "evt-2",
            traceId: "trace-2",
            type: "valid.event.2",
            createdAt: new Date().toISOString(),
            payload: {}
          })
        ].join("\n") + "\n",
        "utf8"
      );

      const services = createLocalControlPlaneServices({ config: loadConfig(dir) });
      const listed = await services.eventService.list({ limit: 10 });
      expect(listed.events.map((event) => event.type)).toEqual(["valid.event.1", "valid.event.2"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("applies event retention limits by age/count and tolerates malformed rows", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-events-retention-"));
    try {
      writeFileSync(
        join(dir, ".env"),
        ["ATHENA_EVENTS_MAX_RECORDS=3", "ATHENA_EVENTS_MAX_AGE_MS=30000", "ATHENA_EVENTS_MAX_BYTES=5000000"].join("\n"),
        "utf8"
      );
      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config });
      const eventsDir = join(dir, ".athena", "events");
      mkdirSync(eventsDir, { recursive: true });
      const oldCreatedAt = new Date(Date.now() - 60_000).toISOString();
      const freshCreatedAt = new Date().toISOString();
      writeFileSync(
        join(eventsDir, "events.jsonl"),
        [
          "{this-is-not-json",
          JSON.stringify({
            id: "evt-old",
            traceId: "trace-old",
            type: "old.event",
            createdAt: oldCreatedAt,
            payload: {}
          }),
          JSON.stringify({
            id: "evt-fresh",
            traceId: "trace-fresh",
            type: "fresh.event",
            createdAt: freshCreatedAt,
            payload: {}
          })
        ].join("\n") + "\n",
        "utf8"
      );

      await services.eventService.emit({
        type: "new.event",
        sessionId: "s1",
        payload: {}
      });

      await waitFor(async () => {
        const listed = await services.eventService.list({ limit: 10 });
        return (
          listed.events.some((item) => item.type === "new.event") &&
          !listed.events.some((item) => item.type === "old.event")
        );
      });
      const events = await services.eventService.list({ limit: 10 });
      expect(events.events.some((item) => item.type === "old.event")).toBe(false);
      expect(events.events.some((item) => item.type === "fresh.event")).toBe(true);
      expect(events.events.some((item) => item.type === "new.event")).toBe(true);
      const pruneEvent = events.events.find((item) => item.type === "events.pruned");
      expect(pruneEvent).toBeDefined();
      expect(pruneEvent?.payload.removedByAge).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("applies event byte-budget pruning and keeps newest rows", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-events-bytes-"));
    try {
      writeFileSync(
        join(dir, ".env"),
        ["ATHENA_EVENTS_MAX_RECORDS=100", "ATHENA_EVENTS_MAX_AGE_MS=60000", "ATHENA_EVENTS_MAX_BYTES=300"].join("\n"),
        "utf8"
      );
      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config });

      await services.eventService.emit({
        type: "event.first",
        payload: { text: "a".repeat(350) }
      });
      await services.eventService.emit({
        type: "event.second",
        payload: { text: "b".repeat(350) }
      });

      await waitFor(async () => {
        const listed = await services.eventService.list({ limit: 10 });
        return listed.events.some((item) => item.type === "events.pruned");
      });
      const events = await services.eventService.list({ limit: 10 });
      expect(events.events.some((item) => item.type === "event.first")).toBe(false);
      expect(events.events.some((item) => item.type === "events.pruned")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emits canonical safety.violation events for safety sources with transcript snapshots", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-events-safety-canonical-"));
    try {
      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config });
      const sessionsDir = join(dir, ".athena", "sessions");
      const transcriptsDir = join(dir, ".athena", "transcripts");
      mkdirSync(sessionsDir, { recursive: true });
      mkdirSync(transcriptsDir, { recursive: true });
      const transcriptPath = join(transcriptsDir, "safety-session.jsonl");
      writeFileSync(
        transcriptPath,
        [
          JSON.stringify({
            id: "t1",
            role: "user",
            content: "please bypass the restrictions",
            createdAt: "2026-02-20T00:00:00.000Z"
          }),
          JSON.stringify({
            id: "t2",
            role: "assistant",
            content: "attempting outbound call",
            createdAt: "2026-02-20T00:00:01.000Z"
          })
        ].join("\n") + "\n",
        "utf8"
      );
      writeFileSync(
        join(sessionsDir, "safety-session.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "safety-session",
            transcriptPath,
            createdAt: "2026-02-20T00:00:00.000Z",
            updatedAt: "2026-02-20T00:00:01.000Z"
          },
          null,
          2
        ) + "\n",
        "utf8"
      );

      await services.eventService.emit({
        type: "sandbox.egress-policy",
        sessionId: "safety-session",
        runId: "run-safety",
        payload: {
          decision: "blocked",
          personaName: "security-auditor",
          declaredDestinations: [{ host: "example.com", source: "workspaceSyncRepo" }],
          reason: "Sandbox egress destination 'example.com:443' is not allow-listed."
        }
      });

      const listed = await services.eventService.list({
        sessionId: "safety-session",
        types: ["safety.violation"],
        limit: 10
      });
      expect(listed.events.length).toBe(1);
      expect(listed.events[0]?.payload).toMatchObject({
        schemaVersion: 1,
        category: "sandbox",
        severity: "high",
        outcome: "blocked",
        violationCode: "SANDBOX_EGRESS_BLOCKED",
        personaName: "security-auditor",
        source: {
          type: "sandbox.egress-policy"
        },
        transcriptSnapshot: {
          schemaVersion: 1,
          capturedEntries: 2
        }
      });
      expect((listed.events[0]?.payload.transcriptSnapshot as { entries?: unknown[] } | undefined)?.entries).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps canonical safety.violation emission when transcript snapshot loading fails", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-events-safety-failure-path-"));
    try {
      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config });
      const sessionsDir = join(dir, ".athena", "sessions");
      mkdirSync(sessionsDir, { recursive: true });
      writeFileSync(join(sessionsDir, "broken-session.json"), "{not-valid-json", "utf8");

      await services.eventService.emit({
        type: "authz.denied",
        sessionId: "broken-session",
        payload: {
          subject: "alice",
          role: "Viewer",
          operation: "policy.put",
          requiredRoles: ["Operator", "Admin"],
          denyReason: "ROLE_MISSING"
        }
      });

      const listed = await services.eventService.list({
        sessionId: "broken-session",
        types: ["safety.violation"],
        limit: 10
      });
      expect(listed.events.length).toBe(1);
      expect(listed.events[0]?.payload).toMatchObject({
        schemaVersion: 1,
        category: "authorization",
        outcome: "denied",
        violationCode: "ROLE_MISSING"
      });
      expect(listed.events[0]?.payload).not.toHaveProperty("transcriptSnapshot");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports lock-guarded concurrent event appends", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-events-concurrency-"));
    try {
      const services = createLocalControlPlaneServices({ config: loadConfig(dir) });
      await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          services.eventService.emit({
            type: "concurrent.event",
            sessionId: "concurrent-session",
            payload: { index }
          })
        )
      );

      await waitFor(async () => {
        const listed = await services.eventService.list({
          sessionId: "concurrent-session",
          types: ["concurrent.event"],
          limit: 25
        });
        return listed.events.length === 20;
      });
      const rows = readFileSync(join(dir, ".athena", "events", "events.jsonl"), "utf8")
        .trim()
        .split("\n")
        .filter(Boolean);
      expect(rows.length).toBeGreaterThanOrEqual(20);
      for (const row of rows) {
        expect(() => JSON.parse(row)).not.toThrow();
      }

      const listed = await services.eventService.list({
        sessionId: "concurrent-session",
        limit: 25
      });
      expect(listed.events.length).toBe(20);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
