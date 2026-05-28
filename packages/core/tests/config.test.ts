import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { AthenaError } from "../src/runtime/errors.js";
import { loadConfig } from "../src/shared/config.js";

describe("loadConfig", () => {
  it("loads defaults when no .env exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-config-"));
    try {
      const config = loadConfig(dir);
      expect(config.executionProviderDefault).toBe("local-placeholder");
      expect(config.lockProviderDefault).toBe("local");
      expect(config.defaultProvider).toBe("mock");
      expect(config.defaultModel).toBe("mock-model");
      expect(config.providerFallbackOrder).toEqual([]);
      expect(config.localProviderCommand).toBe("/bin/echo");
      expect(config.openaiApiKey).toBeUndefined();
      expect(config.openaiBaseUrl).toBe("https://api.openai.com/v1");
      expect(config.foundry?.enabled).toBe(false);
      expect(config.foundry?.projectEndpoint).toBeUndefined();
      expect(config.foundry?.deployment).toBeUndefined();
      expect(config.foundry?.apiVersion).toBe("2024-05-01-preview");
      expect(config.foundry?.useEntraId).toBe(false);
      expect(config.foundry?.audience).toBe("https://cognitiveservices.azure.com/.default");
      expect(config.foundry?.managedIdentityClientId).toBeUndefined();
      expect(config.foundry?.apiKey).toBeUndefined();
      expect(config.azure?.enabled).toBe(false);
      expect(config.azure?.openaiUseEntraId).toBe(false);
      expect(config.azure?.openaiAudience).toBe("https://cognitiveservices.azure.com/.default");
      expect(config.azure?.managedIdentityClientId).toBeUndefined();
      expect(config.azure?.keyVaultUrl).toBeUndefined();
      expect(config.azure?.openaiApiKeySecretName).toBeUndefined();
      expect(config.azure?.billing?.enabled).toBe(false);
      expect(config.azure?.billing?.audience).toBe("https://management.azure.com/.default");
      expect(config.azure?.billing?.scopeResourceId).toBeUndefined();
      expect(config.azure?.billing?.subscriptionId).toBeUndefined();
      expect(config.azure?.billing?.resourceGroupName).toBeUndefined();
      expect(config.azure?.billing?.apiVersion).toBe("2023-03-01");
      expect(config.history?.maxEntries).toBe(200);
      expect(config.memory?.enabled).toBe(false);
      expect(config.memory?.includeTranscripts).toBe(false);
      expect(config.plugins?.searchPaths).toEqual([".athena/plugins"]);
      expect(config.plugins?.systemPluginPaths).toEqual([]);
      expect(config.context?.strategy).toBe("raw");
      expect(config.context?.maxChars).toBe(32000);
      expect(config.context?.maxOverflowRetries).toBe(2);
      expect(config.runtimeRunTimeoutMs).toBe(30000);
      expect(config.scheduleRunTimeoutMs).toBe(45000);
      expect(config.runHistory?.retentionDays).toBe(30);
      expect(config.runHistory?.sweepIntervalMs).toBe(60 * 60 * 1000);
      expect(config.fleetMetricsProvider).toBeUndefined();
      expect(config.distributedLockProvider).toBeUndefined();
      expect(config.sandbox?.enabled).toBe(false);
      expect(config.sandbox?.requireForHighSecurity).toBe(false);
      expect(config.sandbox?.workspaceHostPath).toBeUndefined();
      expect(config.runtimeIsolation?.defaultProfile).toBe("standard");
      expect(config.runtimeIsolation?.fallbackToDefaultRuntimeClass).toBe(true);
      expect(config.runtimeIsolation?.profiles.standard.isolationProfile).toBe("standard");
      expect(config.runtimeIsolation?.profiles.standard.runtimeClassName).toBeUndefined();
      expect(config.runtimeIsolation?.profiles.standard.requireSandbox).toBe(false);
      expect(config.runtimeIsolation?.profiles["high-security"].isolationProfile).toBe("high-security");
      expect(config.runtimeIsolation?.profiles["high-security"].runtimeClassName).toBeUndefined();
      expect(config.runtimeIsolation?.profiles["high-security"].requireSandbox).toBe(false);
      expect(config.cliTransport).toBe("auto");
      expect(config.cliApiBaseUrl).toBeUndefined();
      expect(config.cliApiTimeoutMs).toBe(5000);
      expect(config.telemetry?.events.maxRecords).toBe(10000);
      expect(config.telemetry?.events.maxAgeMs).toBe(30 * 24 * 60 * 60 * 1000);
      expect(config.telemetry?.events.maxBytes).toBe(5000000);
      expect(config.telemetry?.appInsights?.enabled).toBe(false);
      expect(config.telemetry?.appInsights?.connectionString).toBeUndefined();
      expect(config.telemetry?.appInsights?.samplingPercentage).toBe(20);
      expect(config.telemetry?.appInsights?.cloudRoleName).toBe("athena-control-plane");
      expect(config.telemetry?.appInsights?.trackDependencies).toBe(true);
      expect(config.auth?.enabled).toBe(false);
      expect(config.auth?.identityHeader).toBe("x-athena-identity");
      expect(config.auth?.apiToken).toBeUndefined();
      expect(config.auth?.allowExternalUnauthenticated).toBe(false);
      expect(config.auth?.defaultRole).toBe("Viewer");
      expect(config.auth?.identityRoleMap).toEqual({});
      expect(config.authz?.mode).toBe("off");
      expect(config.authz?.defaultDecision).toBe("allow");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads values from .env", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-config-"));
    try {
      writeFileSync(
        join(dir, ".env"),
        [
          "ATHENA_DEFAULT_PROVIDER=test-provider",
          "ATHENA_DEFAULT_MODEL=test-model",
          "ATHENA_STATE_DIR=.athena-test",
          "ATHENA_PROVIDER_FALLBACK_ORDER=provider-b,provider-c",
          "ATHENA_FOUNDRY_ENABLED=false",
          "ATHENA_FOUNDRY_PROJECT_ENDPOINT=https://athena-foundry.services.ai.azure.com",
          "ATHENA_FOUNDRY_DEPLOYMENT=gpt-4o-mini",
          "ATHENA_FOUNDRY_API_VERSION=2024-10-21",
          "ATHENA_FOUNDRY_USE_ENTRA_ID=false",
          "ATHENA_FOUNDRY_AUDIENCE=https://foundry.azure.us/.default",
          "ATHENA_FOUNDRY_MANAGED_IDENTITY_CLIENT_ID=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          "ATHENA_FOUNDRY_API_KEY=foundry-secret",
          "ATHENA_LOCAL_PROVIDER_CMD=/bin/echo",
          "ATHENA_LOCAL_PROVIDER_ARGS=arg1,arg2",
          "ATHENA_OPENAI_API_KEY=openai-secret",
          "ATHENA_OPENAI_BASE_URL=https://groq.example/v1",
          "ATHENA_AZURE_AUTH_ENABLED=true",
          "ATHENA_AZURE_OPENAI_USE_ENTRA_ID=true",
          "ATHENA_AZURE_OPENAI_AUDIENCE=https://cognitiveservices.azure.us/.default",
          "ATHENA_AZURE_MANAGED_IDENTITY_CLIENT_ID=11111111-2222-3333-4444-555555555555",
          "ATHENA_AZURE_KEY_VAULT_URL=https://kv-athena-dev.vault.azure.net",
          "ATHENA_AZURE_OPENAI_KEY_SECRET_NAME=athena-openai-api-key",
          "ATHENA_AZURE_BILLING_ENABLED=true",
          "ATHENA_AZURE_BILLING_AUDIENCE=https://management.azure.us/.default",
          "ATHENA_AZURE_BILLING_SCOPE_RESOURCE_ID=/subscriptions/123/resourceGroups/rg-athena-dev",
          "ATHENA_AZURE_BILLING_SUBSCRIPTION_ID=123",
          "ATHENA_AZURE_BILLING_RESOURCE_GROUP_NAME=rg-athena-dev",
          "ATHENA_AZURE_BILLING_API_VERSION=2024-08-01",
          "ATHENA_HTTP_PROVIDER_URL=http://localhost:9999/provider",
          "ATHENA_HTTP_PROVIDER_API_KEY=secret",
          "ATHENA_HTTP_PROVIDER_TIMEOUT_MS=1500",
          "ATHENA_RUNTIME_RUN_TIMEOUT_MS=2200",
          "ATHENA_SCHEDULE_RUN_TIMEOUT_MS=3300",
          "ATHENA_RUN_HISTORY_RETENTION_DAYS=45",
          "ATHENA_RUN_HISTORY_RETENTION_SWEEP_MS=120000",
          "ATHENA_FLEET_METRICS_PROVIDER=k8s",
          "ATHENA_DISTRIBUTED_LOCK_PROVIDER=redis",
          "ATHENA_EXECUTION_PROVIDER_DEFAULT=k8s",
          "ATHENA_LOCK_PROVIDER_DEFAULT=k8s-lease",
          "ATHENA_REDIS_URL=redis://redis.internal:6379/1",
          "ATHENA_SANDBOX_ENABLED=true",
          "ATHENA_SANDBOX_REQUIRE_FOR_HIGH_SECURITY=true",
          "ATHENA_SANDBOX_WORKSPACE_HOST_PATH=/workspace/source",
          "ATHENA_RUNTIME_ISOLATION_DEFAULT_PROFILE=HIGH_SECURITY",
          "ATHENA_RUNTIME_ISOLATION_STANDARD_RUNTIME_CLASS= ",
          "ATHENA_RUNTIME_ISOLATION_STANDARD_REQUIRE_SANDBOX=true",
          "ATHENA_RUNTIME_ISOLATION_HIGH_SECURITY_RUNTIME_CLASS=gvisor.sandbox",
          "ATHENA_RUNTIME_ISOLATION_HIGH_SECURITY_REQUIRE_SANDBOX=false",
          "ATHENA_RUNTIME_ISOLATION_FALLBACK_TO_DEFAULT_RUNTIME_CLASS=0",
          "ATHENA_CLI_TRANSPORT=api",
          "ATHENA_API_BASE_URL=http://127.0.0.1:8787",
          "ATHENA_CLI_API_TIMEOUT_MS=1400",
          "ATHENA_HISTORY_MAX_ENTRIES=120",
          "ATHENA_HISTORY_MAX_ENTRY_CHARS=3000",
          "ATHENA_HISTORY_REPAIR_TOOL_PAIRING=false",
          "ATHENA_MEMORY_ENABLED=true",
          "ATHENA_MEMORY_INCLUDE_TRANSCRIPTS=true",
          "ATHENA_MEMORY_SQLITE_PATH=.athena/memory/main.sqlite",
          "ATHENA_MEMORY_MAX_RESULTS=8",
          "ATHENA_PLUGIN_PATHS=plugins/news,/opt/team-orchestrator/plugins",
          "ATHENA_SYSTEM_PLUGIN_PATHS=packages/core/system-plugins",
          "ATHENA_CONTEXT_STRATEGY=summary",
          "ATHENA_CONTEXT_MAX_CHARS=18000",
          "ATHENA_CONTEXT_RESERVE_CHARS=1200",
          "ATHENA_CONTEXT_MAX_OVERFLOW_RETRIES=4",
          "ATHENA_CONTEXT_SUMMARY_MAX_CHARS=900",
          "ATHENA_CONTEXT_MAX_TOOL_RESULT_CHARS=4500",
          "ATHENA_EVENTS_MAX_RECORDS=1200",
          "ATHENA_EVENT_RETENTION_DAYS=7",
          "ATHENA_EVENT_MAX_BYTES=2100000",
          "ATHENA_APPINSIGHTS_ENABLED=true",
          "ATHENA_APPINSIGHTS_CONNECTION_STRING=InstrumentationKey=test;IngestionEndpoint=https://eastus-0.in.applicationinsights.azure.com/",
          "ATHENA_APPINSIGHTS_SAMPLING_PERCENTAGE=10",
          "ATHENA_APPINSIGHTS_CLOUD_ROLE_NAME=athena-dev-control-plane",
          "ATHENA_APPINSIGHTS_TRACK_DEPENDENCIES=false",
          "ATHENA_AUTH_ENABLED=true",
          "ATHENA_AUTHZ_MODE=soft_enforce",
          "ATHENA_AUTHZ_DEFAULT_DECISION=deny",
          "ATHENA_AUTH_IDENTITY_HEADER=X-Athena-Subject",
          "ATHENA_AUTH_API_TOKEN=0123456789abcdef",
          "ATHENA_ALLOW_EXTERNAL_UNAUTHENTICATED=true",
          "ATHENA_AUTH_DEFAULT_ROLE=operator",
          "ATHENA_AUTH_IDENTITY_ROLE_MAP=alice:Admin,bob:Viewer,*:Operator"
        ].join("\n"),
        "utf8"
      );
      const config = loadConfig(dir);
      expect(config.defaultProvider).toBe("test-provider");
      expect(config.defaultModel).toBe("test-model");
      expect(config.stateDir).toBe(".athena-test");
      expect(config.providerFallbackOrder).toEqual(["provider-b", "provider-c"]);
      expect(config.foundry?.enabled).toBe(false);
      expect(config.foundry?.projectEndpoint).toBe("https://athena-foundry.services.ai.azure.com");
      expect(config.foundry?.deployment).toBe("gpt-4o-mini");
      expect(config.foundry?.apiVersion).toBe("2024-10-21");
      expect(config.foundry?.useEntraId).toBe(false);
      expect(config.foundry?.audience).toBe("https://foundry.azure.us/.default");
      expect(config.foundry?.managedIdentityClientId).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
      expect(config.foundry?.apiKey).toBe("foundry-secret");
      expect(config.localProviderCommand).toBe("/bin/echo");
      expect(config.localProviderArgs).toEqual(["arg1", "arg2"]);
      expect(config.openaiApiKey).toBe("openai-secret");
      expect(config.openaiBaseUrl).toBe("https://groq.example/v1");
      expect(config.azure?.enabled).toBe(true);
      expect(config.azure?.openaiUseEntraId).toBe(true);
      expect(config.azure?.openaiAudience).toBe("https://cognitiveservices.azure.us/.default");
      expect(config.azure?.managedIdentityClientId).toBe("11111111-2222-3333-4444-555555555555");
      expect(config.azure?.keyVaultUrl).toBe("https://kv-athena-dev.vault.azure.net");
      expect(config.azure?.openaiApiKeySecretName).toBe("athena-openai-api-key");
      expect(config.azure?.billing?.enabled).toBe(true);
      expect(config.azure?.billing?.audience).toBe("https://management.azure.us/.default");
      expect(config.azure?.billing?.scopeResourceId).toBe("/subscriptions/123/resourceGroups/rg-athena-dev");
      expect(config.azure?.billing?.subscriptionId).toBe("123");
      expect(config.azure?.billing?.resourceGroupName).toBe("rg-athena-dev");
      expect(config.azure?.billing?.apiVersion).toBe("2024-08-01");
      expect(config.httpProviderUrl).toBe("http://localhost:9999/provider");
      expect(config.httpProviderApiKey).toBe("secret");
      expect(config.httpProviderTimeoutMs).toBe(1500);
      expect(config.runtimeRunTimeoutMs).toBe(2200);
      expect(config.scheduleRunTimeoutMs).toBe(3300);
      expect(config.runHistory?.retentionDays).toBe(45);
      expect(config.runHistory?.sweepIntervalMs).toBe(120000);
      expect(config.fleetMetricsProvider).toBe("k8s");
      expect(config.executionProviderDefault).toBe("k8s");
      expect(config.lockProviderDefault).toBe("k8s-lease");
      expect(config.distributedLockProvider).toBe("redis");
      expect(config.redisUrl).toBe("redis://redis.internal:6379/1");
      expect(config.sandbox?.enabled).toBe(true);
      expect(config.sandbox?.requireForHighSecurity).toBe(true);
      expect(config.sandbox?.workspaceHostPath).toBe("/workspace/source");
      expect(config.runtimeIsolation?.defaultProfile).toBe("high-security");
      expect(config.runtimeIsolation?.fallbackToDefaultRuntimeClass).toBe(false);
      expect(config.runtimeIsolation?.profiles.standard.isolationProfile).toBe("standard");
      expect(config.runtimeIsolation?.profiles.standard.runtimeClassName).toBeUndefined();
      expect(config.runtimeIsolation?.profiles.standard.requireSandbox).toBe(true);
      expect(config.runtimeIsolation?.profiles["high-security"].isolationProfile).toBe("high-security");
      expect(config.runtimeIsolation?.profiles["high-security"].runtimeClassName).toBe("gvisor.sandbox");
      expect(config.runtimeIsolation?.profiles["high-security"].requireSandbox).toBe(false);
      expect(config.cliTransport).toBe("api");
      expect(config.cliApiBaseUrl).toBe("http://127.0.0.1:8787");
      expect(config.cliApiTimeoutMs).toBe(1400);
      expect(config.history?.maxEntries).toBe(120);
      expect(config.history?.maxEntryChars).toBe(3000);
      expect(config.history?.repairToolPairing).toBe(false);
      expect(config.memory?.enabled).toBe(true);
      expect(config.memory?.includeTranscripts).toBe(true);
      expect(config.memory?.sqlitePath).toBe(".athena/memory/main.sqlite");
      expect(config.memory?.maxResults).toBe(8);
      expect(config.plugins?.searchPaths).toEqual(["plugins/news", "/opt/team-orchestrator/plugins"]);
      expect(config.plugins?.systemPluginPaths).toEqual(["packages/core/system-plugins"]);
      expect(config.context?.strategy).toBe("summary");
      expect(config.context?.maxChars).toBe(18000);
      expect(config.context?.reserveChars).toBe(1200);
      expect(config.context?.maxOverflowRetries).toBe(4);
      expect(config.context?.summaryMaxChars).toBe(900);
      expect(config.context?.maxToolResultChars).toBe(4500);
      expect(config.telemetry?.events.maxRecords).toBe(1200);
      expect(config.telemetry?.events.maxAgeMs).toBe(7 * 24 * 60 * 60 * 1000);
      expect(config.telemetry?.events.maxBytes).toBe(2100000);
      expect(config.telemetry?.appInsights?.enabled).toBe(true);
      expect(config.telemetry?.appInsights?.connectionString).toContain("InstrumentationKey=test");
      expect(config.telemetry?.appInsights?.samplingPercentage).toBe(10);
      expect(config.telemetry?.appInsights?.cloudRoleName).toBe("athena-dev-control-plane");
      expect(config.telemetry?.appInsights?.trackDependencies).toBe(false);
      expect(config.auth?.enabled).toBe(true);
      expect(config.auth?.identityHeader).toBe("x-athena-subject");
      expect(config.auth?.apiToken).toBe("0123456789abcdef");
      expect(config.auth?.allowExternalUnauthenticated).toBe(true);
      expect(config.auth?.defaultRole).toBe("Operator");
      expect(config.auth?.identityRoleMap).toEqual({
        alice: "Admin",
        bob: "Viewer",
        "*": "Operator"
      });
      expect(config.authz?.mode).toBe("soft-enforce");
      expect(config.authz?.defaultDecision).toBe("deny");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("inherits high-security sandbox requirement from legacy sandbox config when new key is unset", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-config-"));
    try {
      writeFileSync(join(dir, ".env"), "ATHENA_SANDBOX_REQUIRE_FOR_HIGH_SECURITY=true", "utf8");
      const config = loadConfig(dir);
      expect(config.sandbox?.requireForHighSecurity).toBe(true);
      expect(config.runtimeIsolation?.profiles["high-security"].requireSandbox).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws structured config errors for non-absolute sandbox workspace host paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-config-"));
    try {
      writeFileSync(join(dir, ".env"), "ATHENA_SANDBOX_WORKSPACE_HOST_PATH=relative/path", "utf8");
      expect(() => loadConfig(dir)).toThrow(AthenaError);
      expect(() => loadConfig(dir)).toThrow("ATHENA_SANDBOX_WORKSPACE_HOST_PATH");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports legacy provider default env keys when modern defaults are unset", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-config-"));
    try {
      writeFileSync(
        join(dir, ".env"),
        ["ATHENA_SANDBOX_BACKEND_PROVIDER=k8s", "ATHENA_DISTRIBUTED_LOCK_PROVIDER=redis"].join("\n"),
        "utf8"
      );
      const config = loadConfig(dir);
      expect(config.executionProviderDefault).toBe("k8s");
      expect(config.lockProviderDefault).toBe("redis");
      expect(config.distributedLockProvider).toBe("redis");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports legacy event retention env keys for backward compatibility", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-config-"));
    try {
      writeFileSync(
        join(dir, ".env"),
        ["ATHENA_EVENTS_MAX_AGE_MS=3600000", "ATHENA_EVENTS_MAX_BYTES=1500000"].join("\n"),
        "utf8"
      );
      const config = loadConfig(dir);
      expect(config.telemetry?.events.maxAgeMs).toBe(3600000);
      expect(config.telemetry?.events.maxBytes).toBe(1500000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("enables app insights by default when connection string is provided", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-config-"));
    try {
      writeFileSync(
        join(dir, ".env"),
        "ATHENA_APPINSIGHTS_CONNECTION_STRING=InstrumentationKey=test;IngestionEndpoint=https://eastus-0.in.applicationinsights.azure.com/",
        "utf8"
      );
      const config = loadConfig(dir);
      expect(config.telemetry?.appInsights?.enabled).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("accepts symbolic-signatures context strategy", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-config-"));
    try {
      writeFileSync(join(dir, ".env"), "ATHENA_CONTEXT_STRATEGY=symbolic-signatures", "utf8");
      const config = loadConfig(dir);
      expect(config.context?.strategy).toBe("symbolic-signatures");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws structured config errors for invalid runtime isolation values", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-config-"));
    try {
      writeFileSync(
        join(dir, ".env"),
        [
          "ATHENA_RUNTIME_ISOLATION_DEFAULT_PROFILE=ultra-secure",
          "ATHENA_RUNTIME_ISOLATION_STANDARD_RUNTIME_CLASS=INVALID_NAME",
          "ATHENA_RUNTIME_ISOLATION_FALLBACK_TO_DEFAULT_RUNTIME_CLASS=maybe"
        ].join("\n"),
        "utf8"
      );

      expect(() => loadConfig(dir)).toThrow(AthenaError);
      expect(() => loadConfig(dir)).toThrow("ATHENA_RUNTIME_ISOLATION_DEFAULT_PROFILE");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws structured config errors for invalid auth role values", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-config-"));
    try {
      writeFileSync(
        join(dir, ".env"),
        [
          "ATHENA_AUTH_DEFAULT_ROLE=superuser",
          "ATHENA_AUTH_IDENTITY_HEADER=x-athena-identity",
          "ATHENA_AUTH_IDENTITY_ROLE_MAP=alice:Operator"
        ].join("\n"),
        "utf8"
      );

      expect(() => loadConfig(dir)).toThrow(AthenaError);
      expect(() => loadConfig(dir)).toThrow("ATHENA_AUTH_DEFAULT_ROLE");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws structured config errors for invalid identity header names", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-config-"));
    try {
      writeFileSync(join(dir, ".env"), "ATHENA_AUTH_IDENTITY_HEADER=X_Identity", "utf8");
      expect(() => loadConfig(dir)).toThrow(AthenaError);
      expect(() => loadConfig(dir)).toThrow("ATHENA_AUTH_IDENTITY_HEADER");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws structured config errors for too-short API tokens", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-config-"));
    try {
      writeFileSync(join(dir, ".env"), "ATHENA_AUTH_API_TOKEN=short", "utf8");
      expect(() => loadConfig(dir)).toThrow(AthenaError);
      expect(() => loadConfig(dir)).toThrow("ATHENA_AUTH_API_TOKEN");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws structured config errors for invalid authz rollout values", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-config-"));
    try {
      writeFileSync(
        join(dir, ".env"),
        ["ATHENA_AUTHZ_MODE=monitor", "ATHENA_AUTHZ_DEFAULT_DECISION=block"].join("\n"),
        "utf8"
      );
      expect(() => loadConfig(dir)).toThrow(AthenaError);
      expect(() => loadConfig(dir)).toThrow("ATHENA_AUTHZ_MODE");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
