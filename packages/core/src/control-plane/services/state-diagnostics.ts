import { resolve } from "node:path";
import { resolveRuntimePaths } from "../../runtime/session-store.js";
import type { AthenaConfig } from "../../shared/config.js";
import { resolveAppStateDatabasePath } from "../app-state/index.js";
import type { StateDiagnosticsService } from "../interfaces.js";
import type { StateStore } from "../state-store.js";

export type StateStoreOwnershipCategory =
  | "sqlite-app-state"
  | "intentional-file-artifact"
  | "intentional-file-support-state"
  | "migration-candidate"
  | "deprecated-file-backed-state";

export interface StateStoreDiagnosticEntry {
  id: string;
  label: string;
  category: StateStoreOwnershipCategory;
  path: string;
}

export interface StateStoreDiagnostics {
  ownershipMap: string;
  sqlite: {
    appStatePath: string;
  };
  stores: StateStoreDiagnosticEntry[];
}

export class LocalStateDiagnosticsService implements StateDiagnosticsService {
  constructor(
    private readonly config: AthenaConfig,
    private readonly stateStore: StateStore
  ) {}

  getDiagnostics(): StateStoreDiagnostics {
    return buildStateStoreDiagnostics(this.config, this.stateStore);
  }
}

export function buildStateStoreDiagnostics(config: AthenaConfig, stateStore: StateStore): StateStoreDiagnostics {
  const runtimePaths = resolveRuntimePaths(config);
  const stateRoot = runtimePaths.stateRoot;
  const sqliteAppStatePath = resolveAppStateDatabasePath(config);
  return {
    ownershipMap: "docs/product/architecture/state-ownership-map.md",
    sqlite: {
      appStatePath: sqliteAppStatePath
    },
    stores: [
      {
        id: "sqlite-app-state",
        label: "SQLite app-state database",
        category: "sqlite-app-state",
        path: sqliteAppStatePath
      },
      {
        id: "sessions",
        label: "Session records",
        category: "intentional-file-support-state",
        path: runtimePaths.sessionsDir
      },
      {
        id: "transcripts",
        label: "Transcript payloads",
        category: "intentional-file-artifact",
        path: runtimePaths.transcriptsDir
      },
      {
        id: "run-evidence",
        label: "Run evidence payloads",
        category: "intentional-file-artifact",
        path: resolve(stateRoot, "run-evidence")
      },
      {
        id: "specialist-runs",
        label: "Specialist run artifacts",
        category: "intentional-file-artifact",
        path: resolve(stateRoot, "specialist-runs")
      },
      {
        id: "persona-runs",
        label: "Persona run artifacts",
        category: "intentional-file-artifact",
        path: resolve(stateRoot, "persona-runs")
      },
      {
        id: "work-queues",
        label: "Session work queues",
        category: "intentional-file-support-state",
        path: resolve(stateRoot, "work")
      },
      {
        id: "directives",
        label: "Directive records",
        category: "migration-candidate",
        path: resolve(stateRoot, "directives")
      },
      {
        id: "harness-profiles",
        label: "Harness profile records",
        category: "migration-candidate",
        path: resolve(stateRoot, "harness-profiles")
      },
      {
        id: "run-templates",
        label: "Run template records",
        category: "migration-candidate",
        path: resolve(stateRoot, "run-templates")
      },
      ...(stateStore.kind === "file"
        ? [
            {
              id: "legacy-workflows",
              label: "Deprecated legacy workflow definitions",
              category: "deprecated-file-backed-state" as const,
              path: resolve(stateRoot, "workflows")
            },
            {
              id: "legacy-workflow-runs",
              label: "Deprecated legacy workflow run state",
              category: "deprecated-file-backed-state" as const,
              path: resolve(stateRoot, "workflow-runs")
            }
          ]
        : [])
    ]
  };
}
