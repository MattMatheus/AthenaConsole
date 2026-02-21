import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  isRuntimeIsolationBenchmarkSummaryArtifact,
  runRuntimeIsolationBenchmarkFixture
} from "./helpers/runtime-isolation-benchmark-fixture.js";

describe("runtime isolation benchmark fixture smoke", () => {
  it("persists a deterministic, versioned benchmark summary artifact", () => {
    const workspace = mkdtempSync(join(tmpdir(), "athena-runtime-isolation-benchmark-"));

    try {
      const outputPath = join(workspace, "summary.json");
      const generatedAt = "2026-02-18T00:00:00.000Z";
      const first = runRuntimeIsolationBenchmarkFixture({ outputPath, generatedAt });
      const second = runRuntimeIsolationBenchmarkFixture({
        outputPath: join(workspace, "summary-second.json"),
        generatedAt
      });

      expect(first).toEqual(second);

      const persisted = JSON.parse(readFileSync(outputPath, "utf8")) as unknown;
      expect(isRuntimeIsolationBenchmarkSummaryArtifact(persisted)).toBe(true);

      if (!isRuntimeIsolationBenchmarkSummaryArtifact(persisted)) {
        return;
      }

      const scenarios = new Set(persisted.records.map((record) => record.scenarioId));
      expect(scenarios.has("short-turn")).toBe(true);
      expect(scenarios.has("cancellation-heavy")).toBe(true);

      const variants = new Set(persisted.records.map((record) => record.variantId));
      expect(variants.has("baseline-default")).toBe(true);
      expect(variants.has("isolated-gvisor")).toBe(true);

      for (const record of persisted.records) {
        expect(record.startupLatencyMs.p50).not.toBeNull();
        expect(record.totalRuntimeMs.p95).not.toBeNull();
        expect(record.outcomeStatusCounts.ok + record.outcomeStatusCounts.cancelled).toBeGreaterThan(0);
      }
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
