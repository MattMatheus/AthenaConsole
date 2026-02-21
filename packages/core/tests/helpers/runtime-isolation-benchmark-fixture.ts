import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const RUNTIME_ISOLATION_BENCHMARK_SCHEMA_VERSION =
  "athena.runtime-isolation-benchmark.v1" as const;

export type BenchmarkOutcomeStatus = "ok" | "failed" | "timeout" | "cancelled" | "rejected";

export interface RuntimeIsolationBenchmarkSample {
  startupLatencyMs: number;
  totalRuntimeMs: number;
  cancellationLatencyMs?: number;
  outcomeStatus: BenchmarkOutcomeStatus;
}

export interface RuntimeIsolationBenchmarkScenarioDefinition {
  id: "short-turn" | "cancellation-heavy";
  description: string;
  samples: RuntimeIsolationBenchmarkSample[];
}

export interface RuntimeIsolationBenchmarkVariantDefinition {
  id: string;
  isolationProfile: "standard" | "high-security";
  runtimeClassName: string | null;
  scenarios: RuntimeIsolationBenchmarkScenarioDefinition[];
}

interface LatencySummary {
  min: number | null;
  max: number | null;
  p50: number | null;
  p95: number | null;
}

export interface RuntimeIsolationBenchmarkSummaryRecord {
  variantId: string;
  isolationProfile: "standard" | "high-security";
  runtimeClassName: string | null;
  scenarioId: "short-turn" | "cancellation-heavy";
  iterations: number;
  startupLatencyMs: LatencySummary;
  totalRuntimeMs: LatencySummary;
  cancellationLatencyMs: LatencySummary & { sampleCount: number };
  outcomeStatusCounts: Record<BenchmarkOutcomeStatus, number>;
}

export interface RuntimeIsolationBenchmarkSummaryArtifactV1 {
  schemaVersion: typeof RUNTIME_ISOLATION_BENCHMARK_SCHEMA_VERSION;
  fixtureVersion: "1.0.0";
  generatedAt: string;
  records: RuntimeIsolationBenchmarkSummaryRecord[];
}

export interface RuntimeIsolationBenchmarkRunOptions {
  outputPath: string;
  generatedAt?: string;
  variants?: RuntimeIsolationBenchmarkVariantDefinition[];
}

export const runtimeIsolationBenchmarkFixtureVariants: RuntimeIsolationBenchmarkVariantDefinition[] = [
  {
    id: "baseline-default",
    isolationProfile: "standard",
    runtimeClassName: null,
    scenarios: [
      {
        id: "short-turn",
        description: "single-step short turn with deterministic startup and completion",
        samples: [
          {
            startupLatencyMs: 18,
            totalRuntimeMs: 96,
            outcomeStatus: "ok"
          },
          {
            startupLatencyMs: 21,
            totalRuntimeMs: 102,
            outcomeStatus: "ok"
          },
          {
            startupLatencyMs: 19,
            totalRuntimeMs: 99,
            outcomeStatus: "ok"
          },
          {
            startupLatencyMs: 20,
            totalRuntimeMs: 101,
            outcomeStatus: "ok"
          }
        ]
      },
      {
        id: "cancellation-heavy",
        description: "rapid cancellation requests across mostly in-flight runs",
        samples: [
          {
            startupLatencyMs: 25,
            totalRuntimeMs: 78,
            cancellationLatencyMs: 14,
            outcomeStatus: "cancelled"
          },
          {
            startupLatencyMs: 27,
            totalRuntimeMs: 82,
            cancellationLatencyMs: 16,
            outcomeStatus: "cancelled"
          },
          {
            startupLatencyMs: 26,
            totalRuntimeMs: 80,
            cancellationLatencyMs: 15,
            outcomeStatus: "cancelled"
          },
          {
            startupLatencyMs: 28,
            totalRuntimeMs: 88,
            cancellationLatencyMs: 19,
            outcomeStatus: "cancelled"
          },
          {
            startupLatencyMs: 24,
            totalRuntimeMs: 75,
            cancellationLatencyMs: 13,
            outcomeStatus: "ok"
          }
        ]
      }
    ]
  },
  {
    id: "isolated-gvisor",
    isolationProfile: "high-security",
    runtimeClassName: "gvisor-secure",
    scenarios: [
      {
        id: "short-turn",
        description: "single-step short turn under high-security runtime class",
        samples: [
          {
            startupLatencyMs: 34,
            totalRuntimeMs: 127,
            outcomeStatus: "ok"
          },
          {
            startupLatencyMs: 36,
            totalRuntimeMs: 133,
            outcomeStatus: "ok"
          },
          {
            startupLatencyMs: 35,
            totalRuntimeMs: 129,
            outcomeStatus: "ok"
          },
          {
            startupLatencyMs: 37,
            totalRuntimeMs: 136,
            outcomeStatus: "ok"
          }
        ]
      },
      {
        id: "cancellation-heavy",
        description: "rapid cancellation requests under high-security runtime class",
        samples: [
          {
            startupLatencyMs: 44,
            totalRuntimeMs: 111,
            cancellationLatencyMs: 26,
            outcomeStatus: "cancelled"
          },
          {
            startupLatencyMs: 46,
            totalRuntimeMs: 118,
            cancellationLatencyMs: 30,
            outcomeStatus: "cancelled"
          },
          {
            startupLatencyMs: 45,
            totalRuntimeMs: 115,
            cancellationLatencyMs: 28,
            outcomeStatus: "cancelled"
          },
          {
            startupLatencyMs: 43,
            totalRuntimeMs: 109,
            cancellationLatencyMs: 24,
            outcomeStatus: "cancelled"
          },
          {
            startupLatencyMs: 42,
            totalRuntimeMs: 104,
            cancellationLatencyMs: 22,
            outcomeStatus: "ok"
          }
        ]
      }
    ]
  }
];

function percentile(values: number[], ratio: number): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const position = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[position] ?? null;
}

function summarizeLatency(values: number[]): LatencySummary {
  if (values.length === 0) {
    return {
      min: null,
      max: null,
      p50: null,
      p95: null
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0] ?? null,
    max: sorted[sorted.length - 1] ?? null,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95)
  };
}

function summarizeScenario(
  variant: RuntimeIsolationBenchmarkVariantDefinition,
  scenario: RuntimeIsolationBenchmarkScenarioDefinition
): RuntimeIsolationBenchmarkSummaryRecord {
  const cancellations = scenario.samples
    .map((sample) => sample.cancellationLatencyMs)
    .filter((value): value is number => typeof value === "number");

  const outcomeStatusCounts: Record<BenchmarkOutcomeStatus, number> = {
    ok: 0,
    failed: 0,
    timeout: 0,
    cancelled: 0,
    rejected: 0
  };

  for (const sample of scenario.samples) {
    outcomeStatusCounts[sample.outcomeStatus] += 1;
  }

  return {
    variantId: variant.id,
    isolationProfile: variant.isolationProfile,
    runtimeClassName: variant.runtimeClassName,
    scenarioId: scenario.id,
    iterations: scenario.samples.length,
    startupLatencyMs: summarizeLatency(scenario.samples.map((sample) => sample.startupLatencyMs)),
    totalRuntimeMs: summarizeLatency(scenario.samples.map((sample) => sample.totalRuntimeMs)),
    cancellationLatencyMs: {
      ...summarizeLatency(cancellations),
      sampleCount: cancellations.length
    },
    outcomeStatusCounts
  };
}

function writeJsonAtomic(path: string, payload: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp`;
  const serialized = JSON.stringify(payload, null, 2);
  writeFileSync(tempPath, `${serialized}\n`, "utf8");
  renameSync(tempPath, path);
}

export function runRuntimeIsolationBenchmarkFixture(
  options: RuntimeIsolationBenchmarkRunOptions
): RuntimeIsolationBenchmarkSummaryArtifactV1 {
  const variants = options.variants ?? runtimeIsolationBenchmarkFixtureVariants;
  const records = variants
    .flatMap((variant) => variant.scenarios.map((scenario) => summarizeScenario(variant, scenario)))
    .sort((left, right) => {
      if (left.variantId !== right.variantId) {
        return left.variantId.localeCompare(right.variantId);
      }
      return left.scenarioId.localeCompare(right.scenarioId);
    });

  const artifact: RuntimeIsolationBenchmarkSummaryArtifactV1 = {
    schemaVersion: RUNTIME_ISOLATION_BENCHMARK_SCHEMA_VERSION,
    fixtureVersion: "1.0.0",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    records
  };

  writeJsonAtomic(options.outputPath, artifact);
  return artifact;
}

export function isRuntimeIsolationBenchmarkSummaryArtifact(
  value: unknown
): value is RuntimeIsolationBenchmarkSummaryArtifactV1 {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as { [key: string]: unknown };
  if (record.schemaVersion !== RUNTIME_ISOLATION_BENCHMARK_SCHEMA_VERSION) {
    return false;
  }

  if (record.fixtureVersion !== "1.0.0") {
    return false;
  }

  if (typeof record.generatedAt !== "string") {
    return false;
  }

  if (!Array.isArray(record.records) || record.records.length === 0) {
    return false;
  }

  for (const item of record.records) {
    if (typeof item !== "object" || item === null) {
      return false;
    }

    const benchmarkRecord = item as { [key: string]: unknown };
    if (typeof benchmarkRecord.variantId !== "string") {
      return false;
    }
    if (benchmarkRecord.isolationProfile !== "standard" && benchmarkRecord.isolationProfile !== "high-security") {
      return false;
    }
    if (typeof benchmarkRecord.scenarioId !== "string") {
      return false;
    }
    if (typeof benchmarkRecord.iterations !== "number") {
      return false;
    }
    if (typeof benchmarkRecord.outcomeStatusCounts !== "object" || benchmarkRecord.outcomeStatusCounts === null) {
      return false;
    }
  }

  return true;
}
