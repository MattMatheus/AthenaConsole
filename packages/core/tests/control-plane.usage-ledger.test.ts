import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("UsageLedgerRepository", () => {
  it("upserts normalized usage by run and lists it by reporting window", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-usage-ledger-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        appState.tasks.create({
          id: "task-usage-1",
          title: "Track usage",
          status: "completed"
        });
        appState.runs.create({
          id: "run-usage-1",
          targetType: "task",
          targetId: "task-usage-1",
          status: "completed",
          endedAt: "2026-06-13T12:00:00.000Z"
        });

        appState.usageLedger.upsert({
          runId: "run-usage-1",
          targetType: "task",
          targetId: "task-usage-1",
          taskId: "task-usage-1",
          agentId: "agent.software-engineer",
          provider: "openai-compatible",
          providerId: "local-openai",
          model: "gpt-4.1-mini",
          userId: "operator@example.test",
          workspaceId: "workspace-a",
          inputTokens: 100,
          outputTokens: 40,
          costUsd: 0.0123,
          providerUsage: { promptTokens: 100, completionTokens: 40 },
          source: "run-output",
          recordedAt: "2026-06-13T12:00:00.000Z"
        });
        const updated = appState.usageLedger.upsert({
          runId: "run-usage-1",
          inputTokens: 120,
          outputTokens: 45,
          source: "run-event",
          recordedAt: "2026-06-13T12:01:00.000Z"
        });

        expect(updated.id).toBe("usage-run-usage-1");
        expect(updated.totalTokens).toBe(165);
        expect(updated.source).toBe("run-event");

        expect(
          appState.usageLedger.list({
            windowStart: "2026-06-01T00:00:00.000Z",
            windowEnd: "2026-07-01T00:00:00.000Z"
          })
        ).toEqual([expect.objectContaining({ runId: "run-usage-1", inputTokens: 120, outputTokens: 45 })]);
        expect(appState.usageLedger.list({ userId: "operator@example.test" })).toEqual([]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
