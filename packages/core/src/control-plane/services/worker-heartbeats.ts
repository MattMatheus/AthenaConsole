import type { AthenaConfig } from "../../shared/config.js";
import type { AppStateDatabase, WorkerHeartbeatRecord, WorkerHeartbeatUpsert } from "../app-state/index.js";
import { openAppStateDatabase } from "../app-state/index.js";

export interface LocalWorkerHeartbeatServiceOptions {
  appState?: AppStateDatabase;
  defaultTtlMs?: number;
}

export interface WorkerHeartbeatRequest extends Omit<WorkerHeartbeatUpsert, "ttlMs"> {
  ttlMs?: number;
}

export class LocalWorkerHeartbeatService {
  constructor(
    private readonly config: AthenaConfig,
    private readonly options: LocalWorkerHeartbeatServiceOptions = {}
  ) {}

  heartbeat(request: WorkerHeartbeatRequest): WorkerHeartbeatRecord {
    return this.withAppState((appState) =>
      appState.workerHeartbeats.upsert({
        ...request,
        ttlMs: request.ttlMs ?? this.options.defaultTtlMs
      })
    );
  }

  listActive(at: Date = new Date(), limit?: number): WorkerHeartbeatRecord[] {
    return this.withAppState((appState) => appState.workerHeartbeats.list({ activeAt: at, limit }));
  }

  listExpired(before: Date = new Date(), limit?: number): WorkerHeartbeatRecord[] {
    return this.withAppState((appState) => appState.workerHeartbeats.list({ expiredBefore: before, limit }));
  }

  cleanupExpired(before: Date = new Date()): number {
    return this.withAppState((appState) => appState.workerHeartbeats.deleteExpired(before));
  }

  private withAppState<T>(read: (appState: AppStateDatabase) => T): T {
    if (this.options.appState) {
      return read(this.options.appState);
    }
    const appState = openAppStateDatabase(this.config);
    try {
      return read(appState);
    } finally {
      appState.close();
    }
  }
}
