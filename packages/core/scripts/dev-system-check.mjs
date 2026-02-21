import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const envPath = resolve(cwd, ".env");

function parseDotEnv(content) {
  const result = {};
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

function asBoolean(value, defaultValue = false) {
  if (!value) {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function pickPort(value, fallback) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const dotenvValues = existsSync(envPath) ? parseDotEnv(readFileSync(envPath, "utf8")) : {};
const env = {
  ...dotenvValues,
  ...process.env
};

const issues = [];
const warnings = [];

if (!existsSync(envPath)) {
  warnings.push("No .env file found at project root; using shell environment only.");
}

const provider = env.ATHENA_DEFAULT_PROVIDER ?? "foundry";
const foundryEnabled = asBoolean(env.ATHENA_FOUNDRY_ENABLED, true);
const foundryUseEntraId = asBoolean(env.ATHENA_FOUNDRY_USE_ENTRA_ID, true);
const fallbackProviders = (env.ATHENA_PROVIDER_FALLBACK_ORDER ?? "")
  .split(",")
  .map((providerId) => providerId.trim())
  .filter(Boolean);

if (provider === "foundry" && foundryEnabled) {
  if (!env.ATHENA_FOUNDRY_PROJECT_ENDPOINT) {
    issues.push("ATHENA_FOUNDRY_PROJECT_ENDPOINT is required when ATHENA_DEFAULT_PROVIDER=foundry.");
  }
  if (!env.ATHENA_FOUNDRY_DEPLOYMENT) {
    issues.push("ATHENA_FOUNDRY_DEPLOYMENT is required when ATHENA_DEFAULT_PROVIDER=foundry.");
  }
  if (!foundryUseEntraId && !env.ATHENA_FOUNDRY_API_KEY) {
    issues.push("ATHENA_FOUNDRY_API_KEY is required when ATHENA_FOUNDRY_USE_ENTRA_ID=false.");
  }
}

if (provider === "openai" && !env.ATHENA_OPENAI_API_KEY) {
  issues.push("ATHENA_OPENAI_API_KEY is required when ATHENA_DEFAULT_PROVIDER=openai.");
}
if (fallbackProviders.includes("openai") && !env.ATHENA_OPENAI_API_KEY) {
  warnings.push("ATHENA_PROVIDER_FALLBACK_ORDER includes openai but ATHENA_OPENAI_API_KEY is not set.");
}

const lockProvider = env.ATHENA_DISTRIBUTED_LOCK_PROVIDER ?? "local";
if (lockProvider === "redis" && !env.ATHENA_REDIS_URL) {
  issues.push("ATHENA_REDIS_URL is required when ATHENA_DISTRIBUTED_LOCK_PROVIDER=redis.");
}

if (asBoolean(env.ATHENA_AUTH_ENABLED, false) && !env.ATHENA_AUTH_IDENTITY_HEADER) {
  warnings.push("ATHENA_AUTH_ENABLED=true without ATHENA_AUTH_IDENTITY_HEADER; default x-athena-identity will be used.");
}

const apiHost = env.ATHENA_DEV_API_HOST ?? "127.0.0.1";
const apiPort = pickPort(env.ATHENA_DEV_API_PORT, 8787);
const uiHost = env.ATHENA_DEV_UI_HOST ?? "127.0.0.1";
const uiPort = pickPort(env.ATHENA_DEV_UI_PORT, 5173);
const proxyTarget = env.ATHENA_DEV_PROXY_TARGET ?? env.VITE_API_PROXY_TARGET ?? `http://${apiHost}:${apiPort}`;

process.stdout.write("[system] Startup check\n");
process.stdout.write(`[system] API: ${apiHost}:${apiPort}\n`);
process.stdout.write(`[system] UI: ${uiHost}:${uiPort}\n`);
process.stdout.write(`[system] Proxy target: ${proxyTarget}\n`);

for (const warning of warnings) {
  process.stdout.write(`[system] Warning: ${warning}\n`);
}

if (issues.length > 0) {
  for (const issue of issues) {
    process.stderr.write(`[system] Error: ${issue}\n`);
  }
  process.exit(1);
}

process.stdout.write("[system] Check passed\n");
