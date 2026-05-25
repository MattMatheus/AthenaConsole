import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import type { AthenaConfig } from "../../shared/config.js";
import {
  ArtifactMetadataRepository,
  MissionRepository,
  RunEventRepository,
  RunRepository,
  TaskRepository
} from "./domain-repositories.js";
import { ensureAppStateMigrationTable, runAppStateMigrations } from "./migrations.js";
import {
  AgentIndexRepository,
  AppSettingsRepository,
  AppStateMigrationRepository,
  PluginIndexRepository
} from "./repositories.js";

export const APP_STATE_DB_FILENAME = "team-orchestrator.sqlite";

export interface AppStateDatabaseOptions {
  migrate?: boolean;
}

export interface AppStateDatabase {
  readonly path: string;
  readonly db: Database.Database;
  readonly migrations: AppStateMigrationRepository;
  readonly settings: AppSettingsRepository;
  readonly plugins: PluginIndexRepository;
  readonly agents: AgentIndexRepository;
  readonly tasks: TaskRepository;
  readonly missions: MissionRepository;
  readonly runs: RunRepository;
  readonly runEvents: RunEventRepository;
  readonly artifacts: ArtifactMetadataRepository;
  close(): void;
}

export function resolveAppStateDatabasePath(config: AthenaConfig): string {
  return resolve(config.workspaceRoot, config.stateDir, APP_STATE_DB_FILENAME);
}

export function openAppStateDatabase(config: AthenaConfig, options: AppStateDatabaseOptions = {}): AppStateDatabase {
  const databasePath = resolveAppStateDatabasePath(config);
  mkdirSync(dirname(databasePath), { recursive: true });

  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  let migrations: AppStateMigrationRepository;
  if (options.migrate === false) {
    ensureAppStateMigrationTable(db);
    migrations = new AppStateMigrationRepository(db);
  } else {
    migrations = runAppStateMigrations(db);
  }

  return {
    path: databasePath,
    db,
    migrations,
    settings: new AppSettingsRepository(db),
    plugins: new PluginIndexRepository(db),
    agents: new AgentIndexRepository(db),
    tasks: new TaskRepository(db),
    missions: new MissionRepository(db),
    runs: new RunRepository(db),
    runEvents: new RunEventRepository(db),
    artifacts: new ArtifactMetadataRepository(db),
    close: () => {
      db.close();
    }
  };
}
