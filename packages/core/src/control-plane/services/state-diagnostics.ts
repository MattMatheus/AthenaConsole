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

export function buildStateStoreDiagnostics(config: AthenaConfig, _stateStore: StateStore): StateStoreDiagnostics {
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
        id: "agent-runs",
        label: "Agent run artifacts",
        category: "intentional-file-artifact",
        path: resolve(stateRoot, "agent-runs")
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
        category: "sqlite-app-state",
        path: sqliteAppStatePath
      },
      {
        id: "harness-profiles",
        label: "Harness profile records",
        category: "sqlite-app-state",
        path: sqliteAppStatePath
      },
      {
        id: "run-templates",
        label: "Run template records",
        category: "sqlite-app-state",
        path: sqliteAppStatePath
      }
    ]
  };
}
