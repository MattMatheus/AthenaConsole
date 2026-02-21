import { loadConfig } from "../../shared/config.js";
import { isCliApiTransportError } from "../api-client.js";
import { parsePositiveInt } from "./flags.js";

type CliTransportMode = "local" | "api" | "auto";

export interface CliTransportSettings {
  mode: CliTransportMode;
  apiBaseUrl?: string;
  apiTimeoutMs: number;
}

export function resolveCliTransport(
  flags: Record<string, string>,
  config: ReturnType<typeof loadConfig>
): CliTransportSettings {
  const transportFlag = flags.transport?.trim().toLowerCase();
  const configuredMode = transportFlag ?? config.cliTransport ?? "auto";
  if (!isCliTransportMode(configuredMode)) {
    throw new Error(`Invalid --transport '${flags.transport}'. Expected local|api|auto.`);
  }

  const apiBaseUrl = flags["api-base-url"] ?? config.cliApiBaseUrl;
  const rawTimeout = flags["api-timeout-ms"];
  const parsedTimeout = parsePositiveInt(rawTimeout);
  if (rawTimeout !== undefined && parsedTimeout === undefined) {
    throw new Error(`Invalid --api-timeout-ms '${rawTimeout}'. Expected positive integer.`);
  }

  return {
    mode: configuredMode,
    ...(apiBaseUrl ? { apiBaseUrl } : {}),
    apiTimeoutMs: parsedTimeout ?? config.cliApiTimeoutMs ?? 5_000
  };
}

function isCliTransportMode(value: string): value is CliTransportMode {
  return value === "local" || value === "api" || value === "auto";
}

export async function runWithSelectedTransport<T>(
  transport: CliTransportSettings,
  runLocal: () => Promise<T>,
  runApi: (apiBaseUrl: string, timeoutMs: number) => Promise<T>
): Promise<T> {
  if (transport.mode === "local") {
    return runLocal();
  }

  if (!transport.apiBaseUrl) {
    if (transport.mode === "api") {
      throw new Error("API transport requires --api-base-url or ATHENA_API_BASE_URL.");
    }
    return runLocal();
  }

  try {
    return await runApi(transport.apiBaseUrl, transport.apiTimeoutMs);
  } catch (error) {
    if (transport.mode === "auto" && isCliApiTransportError(error)) {
      return runLocal();
    }
    throw error;
  }
}
