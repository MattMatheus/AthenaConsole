import type { AthenaConfig } from "../../shared/config.js";
import type { AppStateDatabase } from "./database.js";
import { openAppStateDatabase } from "./database.js";

export interface AppStateProvider {
  withAppState<T>(access: (appState: AppStateDatabase) => T): T;
  withAppStateAsync<T>(access: (appState: AppStateDatabase) => Promise<T>): Promise<T>;
}

export interface AppStateProviderOptions {
  appState?: AppStateDatabase;
  appStateProvider?: AppStateProvider;
}

export function createAppStateProvider(config: AthenaConfig): AppStateProvider {
  return {
    withAppState<T>(access: (appState: AppStateDatabase) => T): T {
      const appState = openAppStateDatabase(config);
      try {
        return access(appState);
      } finally {
        appState.close();
      }
    },
    async withAppStateAsync<T>(access: (appState: AppStateDatabase) => Promise<T>): Promise<T> {
      const appState = openAppStateDatabase(config);
      try {
        return await access(appState);
      } finally {
        appState.close();
      }
    }
  };
}

export function createAppStateProviderFromDatabase(appState: AppStateDatabase): AppStateProvider {
  return {
    withAppState<T>(access: (database: AppStateDatabase) => T): T {
      return access(appState);
    },
    withAppStateAsync<T>(access: (database: AppStateDatabase) => Promise<T>): Promise<T> {
      return access(appState);
    }
  };
}

export function resolveAppStateProvider(config: AthenaConfig, options: AppStateProviderOptions = {}): AppStateProvider {
  return options.appStateProvider ?? (options.appState ? createAppStateProviderFromDatabase(options.appState) : createAppStateProvider(config));
}
