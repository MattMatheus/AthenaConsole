import type { AthenaConfig } from "../../shared/config.js";
import type { AppStateDatabase, AppStateProvider, AppStateProviderOptions, WorkerHeartbeatRecord, WorkerHeartbeatUpsert } from "../app-state/index.js";
import { resolveAppStateProvider } from "../app-state/index.js";

export interface LocalWorkerHeartbeatServiceOptions extends AppStateProviderOptions {
  defaultTtlMs?: number;
}

export interface WorkerHeartbeatRequest extends Omit<WorkerHeartbeatUpsert, "ttlMs"> {
  ttlMs?: number;
}

export class LocalWorkerHeartbeatService {
  private readonly appStateProvider: AppStateProvider;

  constructor(
    private readonly config: AthenaConfig,
    private readonly options: LocalWorkerHeartbeatServiceOptions = {}
  ) {
    this.appStateProvider = resolveAppStateProvider(config, options);
  }

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
    return this.appStateProvider.withAppState(read);
  }
}
