#!/usr/bin/env node

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8787";
const DEFAULT_TIMEOUT_MS = 10_000;
const FIRST_RUN_PLUGIN_ID = "team-orchestrator.samples.first-run";
const FIRST_RUN_AGENT_ID = "first-run.demo.local";
const FIRST_RUN_WORKFLOW_ID = "first-run.demo.workflow";

const options = parseArgs(process.argv.slice(2));
const apiBaseUrl = trimTrailingSlash(options.apiBaseUrl ?? process.env.ATHENA_SMOKE_API_BASE_URL ?? DEFAULT_API_BASE_URL);
const timeoutMs = parsePositiveInteger(options.timeoutMs ?? process.env.ATHENA_SMOKE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
const runSuffix = sanitizeIdPart(options.runId ?? new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14));
const missionId = `mission-product-smoke-${runSuffix}`;
const taskIdPrefix = `product-smoke-${runSuffix}`;

const steps = [];

try {
  await checkHealth();
  await checkReadiness();
  await checkAgentCatalog();
  await checkWorkflowTemplate();
  const workflowRunId = await instantiateWorkflow();
  await executeWorkflow(workflowRunId);
  await checkWorkflowStatus(workflowRunId);
  await checkTaskRunArtifacts(workflowRunId);

  console.log("");
  console.log("Product readiness smoke passed.");
  console.log(`API: ${apiBaseUrl}`);
  console.log(`Mission: ${missionId}`);
  console.log(`Workflow run: workflow-run-${missionId}`);
} catch (error) {
  console.error("");
  console.error("Product readiness smoke failed.");
  console.error(error instanceof Error ? error.message : String(error));
  console.error("");
  console.error("Likely setup causes:");
  console.error(`- API is not running at ${apiBaseUrl}. Start the local stack or pass --api-base-url.`);
  console.error("- Sample plugins are not indexed. Confirm ATHENA_PLUGIN_PATHS includes sample-plugins or use the default local stack.");
  console.error("- Readiness is degraded. Open /api/v1/readiness and inspect each failing check's nextStep.");
  console.error("- Workflow run ids may already exist. Re-run with a new --run-id value.");
  console.error("");
  console.error("Completed steps:");
  for (const step of steps) {
    console.error(`- ${step}`);
  }
  process.exitCode = 1;
}

async function checkHealth() {
  const data = await requestJson("/api/v1/health");
  assert(data.status === "ok", "health status should be ok");
  pass("health endpoint returned ok");
}

async function checkReadiness() {
  const data = await requestJson("/api/v1/readiness");
  const status = data.status;
  assert(status === "ready" || status === "degraded", `readiness status should be ready or degraded, got ${String(status)}`);
  const checks = Array.isArray(data.checks) ? data.checks : [];
  const requiredFailures = checks.filter((check) => check.required !== false && check.status === "fail");
  assert(
    requiredFailures.length === 0,
    `readiness has required failures: ${requiredFailures.map((check) => `${check.id}${check.nextStep ? ` (${check.nextStep})` : ""}`).join(", ")}`
  );
  pass(`readiness endpoint returned ${status}`);
}

async function checkAgentCatalog() {
  const data = await requestJson("/api/v1/agent-catalog/agents");
  const agents = Array.isArray(data.agents) ? data.agents : Array.isArray(data) ? data : [];
  const agent = agents.find((entry) => entry.id === FIRST_RUN_AGENT_ID);
  assert(agent, `agent catalog should include ${FIRST_RUN_AGENT_ID}`);
  assert(agent.available !== false, `${FIRST_RUN_AGENT_ID} should be available`);
  assert(
    Array.isArray(agent.capabilities) && agent.capabilities.includes("demo.prepare") && agent.capabilities.includes("demo.verify"),
    `${FIRST_RUN_AGENT_ID} should expose demo.prepare and demo.verify capabilities`
  );
  pass("agent catalog includes first-run demo agent");
}

async function checkWorkflowTemplate() {
  const data = await requestJson(`/api/v1/workflow-templates?pluginId=${encodeURIComponent(FIRST_RUN_PLUGIN_ID)}`);
  const templates = Array.isArray(data.templates) ? data.templates : Array.isArray(data) ? data : [];
  const template = templates.find((entry) => entry.id === FIRST_RUN_WORKFLOW_ID);
  assert(template, `workflow template ${FIRST_RUN_WORKFLOW_ID} should be indexed`);
  assert(template.available !== false, `workflow template ${FIRST_RUN_WORKFLOW_ID} should be available`);
  pass("first-run workflow template is indexed and available");
}

async function instantiateWorkflow() {
  const data = await requestJson(`/api/v1/workflow-templates/${encodeURIComponent(FIRST_RUN_WORKFLOW_ID)}/instantiate`, {
    method: "POST",
    body: {
      missionId,
      taskIdPrefix,
      inputs: {
        demoName: "Product Readiness Smoke"
      }
    }
  });
  const workflowRunId = data.workflowDagRun?.id;
  assert(typeof workflowRunId === "string" && workflowRunId.length > 0, "instantiate response should include workflowDagRun.id");
  pass(`instantiated first-run workflow as ${workflowRunId}`);
  return workflowRunId;
}

async function executeWorkflow(workflowRunId) {
  const data = await requestJson(`/api/v1/workflow-runs/${encodeURIComponent(workflowRunId)}/execute`, { method: "POST" });
  assert(data.status === "completed", `workflow execution should complete, got ${String(data.status)}`);
  assert(Array.isArray(data.executedStepIds) && data.executedStepIds.length >= 2, "workflow execution should report executed steps");
  pass("executed first-run workflow to completion");
}

async function checkWorkflowStatus(workflowRunId) {
  const data = await requestJson(`/api/v1/workflow-runs/${encodeURIComponent(workflowRunId)}/status`);
  assert(data.run?.status === "completed", `workflow status should be completed, got ${String(data.run?.status)}`);
  assert(data.progress?.percentComplete === 100, `workflow progress should be 100, got ${String(data.progress?.percentComplete)}`);
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  assert(nodes.length >= 2, "workflow status should include dependency graph nodes");
  pass("workflow status exposes completed graph");
}

async function checkTaskRunArtifacts(workflowRunId) {
  const status = await requestJson(`/api/v1/workflow-runs/${encodeURIComponent(workflowRunId)}/status`);
  const taskRunIds = collectTaskRunIds(status);
  assert(taskRunIds.length > 0, "workflow status should include linked task run ids");

  let artifactCount = 0;
  for (const taskRunId of taskRunIds) {
    const run = await requestJson(`/api/v1/task-runs/${encodeURIComponent(taskRunId)}`);
    const artifacts = Array.isArray(run.artifacts) ? run.artifacts : [];
    artifactCount += artifacts.length;
  }
  assert(artifactCount > 0, "linked task runs should expose artifact metadata");
  pass(`task run inspection exposes ${artifactCount} artifact metadata record(s)`);
}

async function requestJson(path, init = {}) {
  const url = path.startsWith("http") ? path : `${apiBaseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(options.apiToken ? { authorization: `Bearer ${options.apiToken}` } : {}),
        ...(options.identity ? { "x-athena-identity": options.identity } : {})
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal
    });
    const text = await response.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`${init.method ?? "GET"} ${url} returned non-JSON response: ${text.slice(0, 200)}`);
    }
    if (!response.ok || parsed.ok === false) {
      throw new Error(`${init.method ?? "GET"} ${url} failed: ${response.status} ${JSON.stringify(parsed).slice(0, 800)}`);
    }
    return parsed.data ?? parsed;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`${init.method ?? "GET"} ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function collectTaskRunIds(value) {
  const ids = new Set();
  visit(value);
  return [...ids].sort();

  function visit(current) {
    if (!current || typeof current !== "object") {
      return;
    }
    if (typeof current.taskRunId === "string" && current.taskRunId.trim()) {
      ids.add(current.taskRunId);
    }
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    Object.values(current).forEach(visit);
  }
}

function pass(message) {
  steps.push(message);
  console.log(`ok - ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      printHelp();
      process.exit(0);
    }
    if (!token.startsWith("--")) {
      throw new Error(`Unknown positional argument '${token}'.`);
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      parsed[toCamelCase(key)] = "true";
      continue;
    }
    parsed[toCamelCase(key)] = value;
    index += 1;
  }
  return parsed;
}

function printHelp() {
  console.log([
    "Usage: npm run smoke:product -- [--api-base-url <url>] [--run-id <suffix>] [--api-token <token>] [--identity <id>]",
    "",
    "Checks a running Team Orchestrator API for health, readiness, sample agent catalog, first-run workflow execution, and task-run artifact metadata.",
    "",
    "Defaults:",
    `  --api-base-url ${DEFAULT_API_BASE_URL}`,
    `  --timeout-ms ${DEFAULT_TIMEOUT_MS}`,
    "",
    "Optional provider-backed smoke remains manual for now: configure a provider in Settings, run a model-backed agent task, then inspect the run detail and artifact preview in the console."
  ].join("\n"));
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, "");
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sanitizeIdPart(value) {
  const sanitized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return sanitized || "run";
}
