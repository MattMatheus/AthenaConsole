import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AthenaError } from "../runtime/errors.js";
import type { AthenaRbacRole } from "./contracts.js";
import type { ContextStrategy } from "./contracts.js";

export type ConfigRuntimeIsolationProfile = "standard" | "high-security";
export type AuthzMode = "off" | "observe" | "soft-enforce" | "enforce";
export type AuthzDefaultDecision = "allow" | "deny";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DAY_MS = 24 * 60 * 60 * 1_000;

export interface AthenaConfig {
  workspaceRoot: string;
  stateDir: string;
  defaultProvider: string;
  defaultModel: string;
  providerFallbackOrder: string[];
  localProviderCommand: string;
  localProviderArgs: string[];
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  azure?: {
    enabled: boolean;
    openaiUseEntraId: boolean;
    openaiAudience: string;
    managedIdentityClientId?: string;
    keyVaultUrl?: string;
    openaiApiKeySecretName?: string;
  };
  httpProviderUrl: string | undefined;
  httpProviderApiKey: string | undefined;
  httpProviderTimeoutMs: number;
  runtimeRunTimeoutMs: number;
  scheduleRunTimeoutMs: number;
  runHistory?: {
    retentionDays: number;
    sweepIntervalMs: number;
  };
  fleetMetricsProvider?: "local" | "k8s";
  distributedLockProvider?: "local" | "redis" | "k8s-lease";
  redisUrl?: string;
  sandbox?: {
    enabled: boolean;
    requireForHighSecurity: boolean;
  };
  runtimeIsolation?: {
    defaultProfile: ConfigRuntimeIsolationProfile;
    fallbackToDefaultRuntimeClass: boolean;
    profiles: {
      standard: {
        isolationProfile: "standard";
        runtimeClassName?: string;
        requireSandbox: boolean;
      };
      "high-security": {
        isolationProfile: "high-security";
        runtimeClassName?: string;
        requireSandbox: boolean;
      };
    };
  };
  cliTransport?: "local" | "api" | "auto";
  cliApiBaseUrl?: string;
  cliApiTimeoutMs?: number;
  history?: {
    maxEntries: number;
    maxEntryChars: number;
    repairToolPairing: boolean;
    stripControlChars: boolean;
  };
  memory?: {
    enabled: boolean;
    sqlitePath?: string;
    includeTranscripts: boolean;
    maxResults: number;
    maxSnippetChars: number;
    maxInjectedChars: number;
  };
  context?: {
    strategy: ContextStrategy;
    maxChars: number;
    reserveChars: number;
    maxOverflowRetries: number;
    summaryMaxChars: number;
    maxToolResultChars: number;
  };
  telemetry?: {
    events: {
      maxRecords: number;
      maxAgeMs: number;
      maxBytes: number;
    };
    appInsights?: {
      enabled: boolean;
      connectionString?: string;
      samplingPercentage: number;
      cloudRoleName: string;
      trackDependencies: boolean;
    };
  };
  auth?: {
    enabled: boolean;
    identityHeader: string;
    defaultRole: AthenaRbacRole;
    identityRoleMap: Record<string, AthenaRbacRole>;
  };
  authz?: {
    mode: AuthzMode;
    defaultDecision: AuthzDefaultDecision;
  };
  allowedOrigins?: string[];
}

const DEFAULT_CONFIG: AthenaConfig = {
  workspaceRoot: process.cwd(),
  stateDir: ".athena",
  defaultProvider: "mock",
  defaultModel: "mock-model",
  providerFallbackOrder: [],
  localProviderCommand: "/bin/echo",
  localProviderArgs: [],
  openaiBaseUrl: DEFAULT_OPENAI_BASE_URL,
  azure: {
    enabled: false,
    openaiUseEntraId: false,
    openaiAudience: "https://cognitiveservices.azure.com/.default"
  },
  httpProviderUrl: undefined,
  httpProviderApiKey: undefined,
  httpProviderTimeoutMs: 20_000,
  runtimeRunTimeoutMs: 30_000,
  scheduleRunTimeoutMs: 45_000,
  runHistory: {
    retentionDays: 30,
    sweepIntervalMs: 60 * 60 * 1_000
  },
  sandbox: {
    enabled: false,
    requireForHighSecurity: false
  },
  runtimeIsolation: {
    defaultProfile: "standard",
    fallbackToDefaultRuntimeClass: true,
    profiles: {
      standard: {
        isolationProfile: "standard",
        requireSandbox: false
      },
      "high-security": {
        isolationProfile: "high-security",
        requireSandbox: false
      }
    }
  },
  cliTransport: "auto",
  cliApiTimeoutMs: 5_000,
  history: {
    maxEntries: 200,
    maxEntryChars: 8_000,
    repairToolPairing: true,
    stripControlChars: true
  },
  memory: {
    enabled: false,
    includeTranscripts: false,
    maxResults: 6,
    maxSnippetChars: 700,
    maxInjectedChars: 2_500
  },
  context: {
    strategy: "raw",
    maxChars: 32_000,
    reserveChars: 2_000,
    maxOverflowRetries: 2,
    summaryMaxChars: 2_400,
    maxToolResultChars: 12_000
  },
  telemetry: {
    events: {
      maxRecords: 10_000,
      maxAgeMs: 30 * DAY_MS,
      maxBytes: 5_000_000
    },
    appInsights: {
      enabled: false,
      samplingPercentage: 20,
      cloudRoleName: "athena-control-plane",
      trackDependencies: true
    }
  },
  auth: {
    enabled: false,
    identityHeader: "x-athena-identity",
    defaultRole: "Viewer",
    identityRoleMap: {}
  },
  authz: {
    mode: "off",
    defaultDecision: "allow"
  },
  allowedOrigins: ["*"]
};

function parseCsv(input: string | undefined): string[] {
  if (!input) {
    return [];
  }
  return input
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function parseNumber(input: string | undefined, defaultValue: number): number {
  if (!input) {
    return defaultValue;
  }
  const parsed = Number.parseInt(input, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return parsed;
}

function parseContextStrategy(input: string | undefined, defaultValue: ContextStrategy): ContextStrategy {
  if (!input) {
    return defaultValue;
  }
  const normalized = input.trim().toLowerCase();
  if (
    normalized === "raw" ||
    normalized === "summary" ||
    normalized === "distill" ||
    normalized === "symbolic-signatures"
  ) {
    return normalized;
  }
  return defaultValue;
}

function parseBoolean(input: string | undefined, defaultValue: boolean): boolean {
  if (!input) {
    return defaultValue;
  }
  const normalized = input.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function parseCliTransport(input: string | undefined, defaultValue: "local" | "api" | "auto"): "local" | "api" | "auto" {
  if (!input) {
    return defaultValue;
  }
  const normalized = input.trim().toLowerCase();
  if (normalized === "local" || normalized === "api" || normalized === "auto") {
    return normalized;
  }
  return defaultValue;
}

function parseFleetMetricsProvider(input: string | undefined): "local" | "k8s" | undefined {
  if (!input) {
    return undefined;
  }
  const normalized = input.trim().toLowerCase();
  if (normalized === "local" || normalized === "k8s") {
    return normalized;
  }
  return undefined;
}

function parseDistributedLockProvider(input: string | undefined): "local" | "redis" | "k8s-lease" | undefined {
  if (!input) {
    return undefined;
  }
  const normalized = input.trim().toLowerCase();
  if (normalized === "local" || normalized === "redis" || normalized === "k8s-lease") {
    return normalized;
  }
  return undefined;
}

function normalizeRuntimeIsolationProfile(input: string): ConfigRuntimeIsolationProfile | undefined {
  const normalized = input.trim().toLowerCase();
  if (normalized === "standard") {
    return "standard";
  }
  if (normalized === "high-security" || normalized === "high_security" || normalized === "highsecurity") {
    return "high-security";
  }
  return undefined;
}

function parseRuntimeIsolationProfile(
  input: string | undefined,
  fieldName: string,
  defaultValue: ConfigRuntimeIsolationProfile
): ConfigRuntimeIsolationProfile {
  if (!input) {
    return defaultValue;
  }
  const normalized = normalizeRuntimeIsolationProfile(input);
  if (!normalized) {
    throw new AthenaError(
      "CONFIG_ERROR",
      `${fieldName} must be one of: standard, high-security. Received: ${input}.`
    );
  }
  return normalized;
}

function parseBooleanStrict(input: string | undefined, fieldName: string, defaultValue: boolean): boolean {
  if (!input) {
    return defaultValue;
  }
  const normalized = input.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  throw new AthenaError(
    "CONFIG_ERROR",
    `${fieldName} must be a boolean value (true/false/1/0/yes/no/on/off). Received: ${input}.`
  );
}

function parseRuntimeClassName(input: string | undefined, fieldName: string): string | undefined {
  if (input === undefined) {
    return undefined;
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length > 253) {
    throw new AthenaError("CONFIG_ERROR", `${fieldName} must be 253 characters or fewer.`);
  }
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(trimmed)) {
    throw new AthenaError(
      "CONFIG_ERROR",
      `${fieldName} must be a valid Kubernetes RuntimeClass name (lowercase alphanumeric, '-' or '.').`
    );
  }
  return trimmed;
}

function parseAuthRole(input: string | undefined, fieldName: string, defaultRole: AthenaRbacRole): AthenaRbacRole {
  if (!input) {
    return defaultRole;
  }
  const normalized = input.trim().toLowerCase();
  if (normalized === "viewer") {
    return "Viewer";
  }
  if (normalized === "operator") {
    return "Operator";
  }
  if (normalized === "admin") {
    return "Admin";
  }
  throw new AthenaError(
    "CONFIG_ERROR",
    `${fieldName} must be one of: Viewer, Operator, Admin. Received: ${input}.`
  );
}

function parseIdentityHeader(input: string | undefined, defaultValue: string): string {
  if (!input) {
    return defaultValue;
  }
  const normalized = input.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    throw new AthenaError(
      "CONFIG_ERROR",
      "ATHENA_AUTH_IDENTITY_HEADER must contain only lowercase letters, numbers, and dashes."
    );
  }
  return normalized;
}

function parseIdentityRoleMap(input: string | undefined): Record<string, AthenaRbacRole> {
  if (!input) {
    return {};
  }
  const roleMap: Record<string, AthenaRbacRole> = {};
  for (const token of input.split(",")) {
    const entry = token.trim();
    if (!entry) {
      continue;
    }
    const separator = entry.indexOf(":");
    if (separator <= 0 || separator >= entry.length - 1) {
      throw new AthenaError(
        "CONFIG_ERROR",
        "ATHENA_AUTH_IDENTITY_ROLE_MAP entries must use identity:role format (for example: alice:Operator,*:Viewer)."
      );
    }
    const identity = entry.slice(0, separator).trim();
    const roleValue = entry.slice(separator + 1).trim();
    if (!identity) {
      throw new AthenaError("CONFIG_ERROR", "ATHENA_AUTH_IDENTITY_ROLE_MAP identity cannot be empty.");
    }
    roleMap[identity] = parseAuthRole(roleValue, "ATHENA_AUTH_IDENTITY_ROLE_MAP", "Viewer");
  }
  return roleMap;
}

function parseAuthzMode(input: string | undefined, defaultValue: AuthzMode): AuthzMode {
  if (!input) {
    return defaultValue;
  }
  const normalized = input.trim().toLowerCase();
  if (normalized === "off") {
    return "off";
  }
  if (normalized === "observe") {
    return "observe";
  }
  if (normalized === "soft-enforce" || normalized === "soft_enforce" || normalized === "softenforce") {
    return "soft-enforce";
  }
  if (normalized === "enforce") {
    return "enforce";
  }
  throw new AthenaError(
    "CONFIG_ERROR",
    `ATHENA_AUTHZ_MODE must be one of: off, observe, soft-enforce, enforce. Received: ${input}.`
  );
}

function parseAuthzDefaultDecision(
  input: string | undefined,
  fieldName: string,
  defaultValue: AuthzDefaultDecision
): AuthzDefaultDecision {
  if (!input) {
    return defaultValue;
  }
  const normalized = input.trim().toLowerCase();
  if (normalized === "allow") {
    return "allow";
  }
  if (normalized === "deny") {
    return "deny";
  }
  throw new AthenaError("CONFIG_ERROR", `${fieldName} must be one of: allow, deny. Received: ${input}.`);
}

function parseDotEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim().replace(/^['\"]|['\"]$/g, "");
    result[key] = value;
  }
  return result;
}

export function loadConfig(cwd = process.cwd()): AthenaConfig {
  const envPath = resolve(cwd, ".env");
  let env: Record<string, string> = {};

  if (existsSync(envPath)) {
    env = parseDotEnv(readFileSync(envPath, "utf8"));
  }

  const memorySqlitePath = env.ATHENA_MEMORY_SQLITE_PATH ?? process.env.ATHENA_MEMORY_SQLITE_PATH;
  const cliApiBaseUrl = env.ATHENA_API_BASE_URL ?? process.env.ATHENA_API_BASE_URL;
  const openaiApiKey = env.ATHENA_OPENAI_API_KEY ?? process.env.ATHENA_OPENAI_API_KEY;
  const azureAuthEnabled = parseBoolean(
    env.ATHENA_AZURE_AUTH_ENABLED ?? process.env.ATHENA_AZURE_AUTH_ENABLED,
    DEFAULT_CONFIG.azure!.enabled
  );
  const azureOpenAiUseEntraId = parseBoolean(
    env.ATHENA_AZURE_OPENAI_USE_ENTRA_ID ?? process.env.ATHENA_AZURE_OPENAI_USE_ENTRA_ID,
    DEFAULT_CONFIG.azure!.openaiUseEntraId
  );
  const azureOpenAiAudience =
    env.ATHENA_AZURE_OPENAI_AUDIENCE ??
    process.env.ATHENA_AZURE_OPENAI_AUDIENCE ??
    DEFAULT_CONFIG.azure!.openaiAudience;
  const azureManagedIdentityClientId =
    env.ATHENA_AZURE_MANAGED_IDENTITY_CLIENT_ID ?? process.env.ATHENA_AZURE_MANAGED_IDENTITY_CLIENT_ID;
  const azureKeyVaultUrl = env.ATHENA_AZURE_KEY_VAULT_URL ?? process.env.ATHENA_AZURE_KEY_VAULT_URL;
  const azureOpenAiApiKeySecretName =
    env.ATHENA_AZURE_OPENAI_KEY_SECRET_NAME ?? process.env.ATHENA_AZURE_OPENAI_KEY_SECRET_NAME;
  const fleetMetricsProvider = parseFleetMetricsProvider(
    env.ATHENA_FLEET_METRICS_PROVIDER ?? process.env.ATHENA_FLEET_METRICS_PROVIDER
  );
  const distributedLockProvider = parseDistributedLockProvider(
    env.ATHENA_DISTRIBUTED_LOCK_PROVIDER ?? process.env.ATHENA_DISTRIBUTED_LOCK_PROVIDER
  );
  const redisUrl = env.ATHENA_REDIS_URL ?? process.env.ATHENA_REDIS_URL;
  const defaultRuntimeIsolationProfile = parseRuntimeIsolationProfile(
    env.ATHENA_RUNTIME_ISOLATION_DEFAULT_PROFILE ?? process.env.ATHENA_RUNTIME_ISOLATION_DEFAULT_PROFILE,
    "ATHENA_RUNTIME_ISOLATION_DEFAULT_PROFILE",
    DEFAULT_CONFIG.runtimeIsolation!.defaultProfile
  );
  const standardRuntimeClassName = parseRuntimeClassName(
    env.ATHENA_RUNTIME_ISOLATION_STANDARD_RUNTIME_CLASS ?? process.env.ATHENA_RUNTIME_ISOLATION_STANDARD_RUNTIME_CLASS,
    "ATHENA_RUNTIME_ISOLATION_STANDARD_RUNTIME_CLASS"
  );
  const highSecurityRuntimeClassName = parseRuntimeClassName(
    env.ATHENA_RUNTIME_ISOLATION_HIGH_SECURITY_RUNTIME_CLASS ??
      process.env.ATHENA_RUNTIME_ISOLATION_HIGH_SECURITY_RUNTIME_CLASS,
    "ATHENA_RUNTIME_ISOLATION_HIGH_SECURITY_RUNTIME_CLASS"
  );
  const authEnabled = parseBoolean(
    env.ATHENA_AUTH_ENABLED ?? process.env.ATHENA_AUTH_ENABLED,
    DEFAULT_CONFIG.auth!.enabled
  );
  const authIdentityHeader = parseIdentityHeader(
    env.ATHENA_AUTH_IDENTITY_HEADER ?? process.env.ATHENA_AUTH_IDENTITY_HEADER,
    DEFAULT_CONFIG.auth!.identityHeader
  );
  const authDefaultRole = parseAuthRole(
    env.ATHENA_AUTH_DEFAULT_ROLE ?? process.env.ATHENA_AUTH_DEFAULT_ROLE,
    "ATHENA_AUTH_DEFAULT_ROLE",
    DEFAULT_CONFIG.auth!.defaultRole
  );
  const authIdentityRoleMap = parseIdentityRoleMap(
    env.ATHENA_AUTH_IDENTITY_ROLE_MAP ?? process.env.ATHENA_AUTH_IDENTITY_ROLE_MAP
  );
  const authzMode = parseAuthzMode(env.ATHENA_AUTHZ_MODE ?? process.env.ATHENA_AUTHZ_MODE, DEFAULT_CONFIG.authz!.mode);
  const authzDefaultDecision = parseAuthzDefaultDecision(
    env.ATHENA_AUTHZ_DEFAULT_DECISION ?? process.env.ATHENA_AUTHZ_DEFAULT_DECISION,
    "ATHENA_AUTHZ_DEFAULT_DECISION",
    DEFAULT_CONFIG.authz!.defaultDecision
  );
  const eventRetentionDaysRaw = env.ATHENA_EVENT_RETENTION_DAYS ?? process.env.ATHENA_EVENT_RETENTION_DAYS;
  const eventMaxAgeMsRaw = env.ATHENA_EVENTS_MAX_AGE_MS ?? process.env.ATHENA_EVENTS_MAX_AGE_MS;
  const appInsightsConnectionString =
    env.ATHENA_APPINSIGHTS_CONNECTION_STRING ?? process.env.ATHENA_APPINSIGHTS_CONNECTION_STRING;
  const appInsightsEnabledDefault = appInsightsConnectionString !== undefined;
  const appInsightsEnabled = parseBoolean(
    env.ATHENA_APPINSIGHTS_ENABLED ?? process.env.ATHENA_APPINSIGHTS_ENABLED,
    appInsightsEnabledDefault
  );
  const defaultEventRetentionDays = Math.max(1, Math.floor(DEFAULT_CONFIG.telemetry!.events.maxAgeMs / DAY_MS));
  const eventRetentionDays = parseNumber(eventRetentionDaysRaw, defaultEventRetentionDays);

  return {
    workspaceRoot: env.ATHENA_WORKSPACE_ROOT ?? process.env.ATHENA_WORKSPACE_ROOT ?? cwd,
    stateDir: env.ATHENA_STATE_DIR ?? process.env.ATHENA_STATE_DIR ?? DEFAULT_CONFIG.stateDir,
    defaultProvider: env.ATHENA_DEFAULT_PROVIDER ?? process.env.ATHENA_DEFAULT_PROVIDER ?? DEFAULT_CONFIG.defaultProvider,
    defaultModel: env.ATHENA_DEFAULT_MODEL ?? process.env.ATHENA_DEFAULT_MODEL ?? DEFAULT_CONFIG.defaultModel,
    providerFallbackOrder: parseCsv(env.ATHENA_PROVIDER_FALLBACK_ORDER ?? process.env.ATHENA_PROVIDER_FALLBACK_ORDER),
    localProviderCommand: env.ATHENA_LOCAL_PROVIDER_CMD ?? process.env.ATHENA_LOCAL_PROVIDER_CMD ?? DEFAULT_CONFIG.localProviderCommand,
    localProviderArgs: parseCsv(env.ATHENA_LOCAL_PROVIDER_ARGS ?? process.env.ATHENA_LOCAL_PROVIDER_ARGS),
    openaiBaseUrl: env.ATHENA_OPENAI_BASE_URL ?? process.env.ATHENA_OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL,
    ...(openaiApiKey !== undefined ? { openaiApiKey } : {}),
    azure: {
      enabled: azureAuthEnabled,
      openaiUseEntraId: azureOpenAiUseEntraId,
      openaiAudience: azureOpenAiAudience,
      ...(azureManagedIdentityClientId !== undefined ? { managedIdentityClientId: azureManagedIdentityClientId } : {}),
      ...(azureKeyVaultUrl !== undefined ? { keyVaultUrl: azureKeyVaultUrl } : {}),
      ...(azureOpenAiApiKeySecretName !== undefined ? { openaiApiKeySecretName: azureOpenAiApiKeySecretName } : {})
    },
    httpProviderUrl: env.ATHENA_HTTP_PROVIDER_URL ?? process.env.ATHENA_HTTP_PROVIDER_URL,
    httpProviderApiKey: env.ATHENA_HTTP_PROVIDER_API_KEY ?? process.env.ATHENA_HTTP_PROVIDER_API_KEY,
    httpProviderTimeoutMs: parseNumber(
      env.ATHENA_HTTP_PROVIDER_TIMEOUT_MS ?? process.env.ATHENA_HTTP_PROVIDER_TIMEOUT_MS,
      DEFAULT_CONFIG.httpProviderTimeoutMs
    ),
    runtimeRunTimeoutMs: parseNumber(
      env.ATHENA_RUNTIME_RUN_TIMEOUT_MS ?? process.env.ATHENA_RUNTIME_RUN_TIMEOUT_MS,
      DEFAULT_CONFIG.runtimeRunTimeoutMs
    ),
    scheduleRunTimeoutMs: parseNumber(
      env.ATHENA_SCHEDULE_RUN_TIMEOUT_MS ?? process.env.ATHENA_SCHEDULE_RUN_TIMEOUT_MS,
      DEFAULT_CONFIG.scheduleRunTimeoutMs
    ),
    runHistory: {
      retentionDays: parseNumber(
        env.ATHENA_RUN_HISTORY_RETENTION_DAYS ?? process.env.ATHENA_RUN_HISTORY_RETENTION_DAYS,
        DEFAULT_CONFIG.runHistory!.retentionDays
      ),
      sweepIntervalMs: parseNumber(
        env.ATHENA_RUN_HISTORY_RETENTION_SWEEP_MS ?? process.env.ATHENA_RUN_HISTORY_RETENTION_SWEEP_MS,
        DEFAULT_CONFIG.runHistory!.sweepIntervalMs
      )
    },
    ...(fleetMetricsProvider ? { fleetMetricsProvider } : {}),
    ...(distributedLockProvider ? { distributedLockProvider } : {}),
    ...(redisUrl ? { redisUrl } : {}),
    sandbox: {
      enabled: parseBoolean(
        env.ATHENA_SANDBOX_ENABLED ?? process.env.ATHENA_SANDBOX_ENABLED,
        DEFAULT_CONFIG.sandbox!.enabled
      ),
      requireForHighSecurity: parseBoolean(
        env.ATHENA_SANDBOX_REQUIRE_FOR_HIGH_SECURITY ?? process.env.ATHENA_SANDBOX_REQUIRE_FOR_HIGH_SECURITY,
        DEFAULT_CONFIG.sandbox!.requireForHighSecurity
      )
    },
    runtimeIsolation: {
      defaultProfile: defaultRuntimeIsolationProfile,
      fallbackToDefaultRuntimeClass: parseBooleanStrict(
        env.ATHENA_RUNTIME_ISOLATION_FALLBACK_TO_DEFAULT_RUNTIME_CLASS ??
          process.env.ATHENA_RUNTIME_ISOLATION_FALLBACK_TO_DEFAULT_RUNTIME_CLASS,
        "ATHENA_RUNTIME_ISOLATION_FALLBACK_TO_DEFAULT_RUNTIME_CLASS",
        DEFAULT_CONFIG.runtimeIsolation!.fallbackToDefaultRuntimeClass
      ),
      profiles: {
        standard: {
          isolationProfile: "standard",
          ...(standardRuntimeClassName ? { runtimeClassName: standardRuntimeClassName } : {}),
          requireSandbox: parseBooleanStrict(
            env.ATHENA_RUNTIME_ISOLATION_STANDARD_REQUIRE_SANDBOX ??
              process.env.ATHENA_RUNTIME_ISOLATION_STANDARD_REQUIRE_SANDBOX,
            "ATHENA_RUNTIME_ISOLATION_STANDARD_REQUIRE_SANDBOX",
            DEFAULT_CONFIG.runtimeIsolation!.profiles.standard.requireSandbox
          )
        },
        "high-security": {
          isolationProfile: "high-security",
          ...(highSecurityRuntimeClassName ? { runtimeClassName: highSecurityRuntimeClassName } : {}),
          requireSandbox: parseBooleanStrict(
            env.ATHENA_RUNTIME_ISOLATION_HIGH_SECURITY_REQUIRE_SANDBOX ??
              process.env.ATHENA_RUNTIME_ISOLATION_HIGH_SECURITY_REQUIRE_SANDBOX,
            "ATHENA_RUNTIME_ISOLATION_HIGH_SECURITY_REQUIRE_SANDBOX",
            parseBoolean(
              env.ATHENA_SANDBOX_REQUIRE_FOR_HIGH_SECURITY ?? process.env.ATHENA_SANDBOX_REQUIRE_FOR_HIGH_SECURITY,
              DEFAULT_CONFIG.runtimeIsolation!.profiles["high-security"].requireSandbox
            )
          )
        }
      }
    },
    cliTransport: parseCliTransport(
      env.ATHENA_CLI_TRANSPORT ?? process.env.ATHENA_CLI_TRANSPORT,
      DEFAULT_CONFIG.cliTransport ?? "auto"
    ),
    ...(cliApiBaseUrl !== undefined ? { cliApiBaseUrl } : {}),
    cliApiTimeoutMs: parseNumber(
      env.ATHENA_CLI_API_TIMEOUT_MS ?? process.env.ATHENA_CLI_API_TIMEOUT_MS,
      DEFAULT_CONFIG.cliApiTimeoutMs ?? 5_000
    ),
    history: {
      maxEntries: parseNumber(
        env.ATHENA_HISTORY_MAX_ENTRIES ?? process.env.ATHENA_HISTORY_MAX_ENTRIES,
        DEFAULT_CONFIG.history!.maxEntries
      ),
      maxEntryChars: parseNumber(
        env.ATHENA_HISTORY_MAX_ENTRY_CHARS ?? process.env.ATHENA_HISTORY_MAX_ENTRY_CHARS,
        DEFAULT_CONFIG.history!.maxEntryChars
      ),
      repairToolPairing: parseBoolean(
        env.ATHENA_HISTORY_REPAIR_TOOL_PAIRING ?? process.env.ATHENA_HISTORY_REPAIR_TOOL_PAIRING,
        DEFAULT_CONFIG.history!.repairToolPairing
      ),
      stripControlChars: parseBoolean(
        env.ATHENA_HISTORY_STRIP_CONTROL_CHARS ?? process.env.ATHENA_HISTORY_STRIP_CONTROL_CHARS,
        DEFAULT_CONFIG.history!.stripControlChars
      )
    },
    memory: {
      enabled: parseBoolean(
        env.ATHENA_MEMORY_ENABLED ?? process.env.ATHENA_MEMORY_ENABLED,
        DEFAULT_CONFIG.memory!.enabled
      ),
      ...(typeof memorySqlitePath === "string" ? { sqlitePath: memorySqlitePath } : {}),
      includeTranscripts: parseBoolean(
        env.ATHENA_MEMORY_INCLUDE_TRANSCRIPTS ?? process.env.ATHENA_MEMORY_INCLUDE_TRANSCRIPTS,
        DEFAULT_CONFIG.memory!.includeTranscripts
      ),
      maxResults: parseNumber(
        env.ATHENA_MEMORY_MAX_RESULTS ?? process.env.ATHENA_MEMORY_MAX_RESULTS,
        DEFAULT_CONFIG.memory!.maxResults
      ),
      maxSnippetChars: parseNumber(
        env.ATHENA_MEMORY_MAX_SNIPPET_CHARS ?? process.env.ATHENA_MEMORY_MAX_SNIPPET_CHARS,
        DEFAULT_CONFIG.memory!.maxSnippetChars
      ),
      maxInjectedChars: parseNumber(
        env.ATHENA_MEMORY_MAX_INJECTED_CHARS ?? process.env.ATHENA_MEMORY_MAX_INJECTED_CHARS,
        DEFAULT_CONFIG.memory!.maxInjectedChars
      )
    },
    context: {
      strategy: parseContextStrategy(
        env.ATHENA_CONTEXT_STRATEGY ?? process.env.ATHENA_CONTEXT_STRATEGY,
        DEFAULT_CONFIG.context!.strategy
      ),
      maxChars: parseNumber(
        env.ATHENA_CONTEXT_MAX_CHARS ?? process.env.ATHENA_CONTEXT_MAX_CHARS,
        DEFAULT_CONFIG.context!.maxChars
      ),
      reserveChars: parseNumber(
        env.ATHENA_CONTEXT_RESERVE_CHARS ?? process.env.ATHENA_CONTEXT_RESERVE_CHARS,
        DEFAULT_CONFIG.context!.reserveChars
      ),
      maxOverflowRetries: parseNumber(
        env.ATHENA_CONTEXT_MAX_OVERFLOW_RETRIES ?? process.env.ATHENA_CONTEXT_MAX_OVERFLOW_RETRIES,
        DEFAULT_CONFIG.context!.maxOverflowRetries
      ),
      summaryMaxChars: parseNumber(
        env.ATHENA_CONTEXT_SUMMARY_MAX_CHARS ?? process.env.ATHENA_CONTEXT_SUMMARY_MAX_CHARS,
        DEFAULT_CONFIG.context!.summaryMaxChars
      ),
      maxToolResultChars: parseNumber(
        env.ATHENA_CONTEXT_MAX_TOOL_RESULT_CHARS ?? process.env.ATHENA_CONTEXT_MAX_TOOL_RESULT_CHARS,
        DEFAULT_CONFIG.context!.maxToolResultChars
      )
    },
    telemetry: {
      events: {
        maxRecords: parseNumber(
          env.ATHENA_EVENTS_MAX_RECORDS ?? process.env.ATHENA_EVENTS_MAX_RECORDS,
          DEFAULT_CONFIG.telemetry!.events.maxRecords
        ),
        maxAgeMs: eventRetentionDaysRaw
          ? eventRetentionDays * DAY_MS
          : parseNumber(eventMaxAgeMsRaw, DEFAULT_CONFIG.telemetry!.events.maxAgeMs),
        maxBytes: parseNumber(
          env.ATHENA_EVENT_MAX_BYTES ??
            process.env.ATHENA_EVENT_MAX_BYTES ??
            env.ATHENA_EVENTS_MAX_BYTES ??
            process.env.ATHENA_EVENTS_MAX_BYTES,
          DEFAULT_CONFIG.telemetry!.events.maxBytes
        )
      },
      appInsights: {
        enabled: appInsightsEnabled,
        ...(appInsightsConnectionString !== undefined ? { connectionString: appInsightsConnectionString } : {}),
        samplingPercentage: parseNumber(
          env.ATHENA_APPINSIGHTS_SAMPLING_PERCENTAGE ?? process.env.ATHENA_APPINSIGHTS_SAMPLING_PERCENTAGE,
          DEFAULT_CONFIG.telemetry!.appInsights!.samplingPercentage
        ),
        cloudRoleName:
          env.ATHENA_APPINSIGHTS_CLOUD_ROLE_NAME ??
          process.env.ATHENA_APPINSIGHTS_CLOUD_ROLE_NAME ??
          DEFAULT_CONFIG.telemetry!.appInsights!.cloudRoleName,
        trackDependencies: parseBoolean(
          env.ATHENA_APPINSIGHTS_TRACK_DEPENDENCIES ?? process.env.ATHENA_APPINSIGHTS_TRACK_DEPENDENCIES,
          DEFAULT_CONFIG.telemetry!.appInsights!.trackDependencies
        )
      }
    },
    auth: {
      enabled: authEnabled,
      identityHeader: authIdentityHeader,
      defaultRole: authDefaultRole,
      identityRoleMap: authIdentityRoleMap
    },
    authz: {
      mode: authzMode,
      defaultDecision: authzDefaultDecision
    },
    allowedOrigins: (env.ATHENA_ALLOWED_ORIGINS || process.env.ATHENA_ALLOWED_ORIGINS)
      ? parseCsv(env.ATHENA_ALLOWED_ORIGINS ?? process.env.ATHENA_ALLOWED_ORIGINS)
      : (DEFAULT_CONFIG.allowedOrigins ?? ["*"])
  };
}
