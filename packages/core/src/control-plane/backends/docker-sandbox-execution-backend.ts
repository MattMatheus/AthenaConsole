import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import type {
  SandboxClaimRequest,
  SandboxClaimResult,
  SandboxCleanupRequest,
  SandboxCleanupResult,
  SandboxExecutionBackend,
  SandboxResourceUsageRequest,
  SandboxResourceUsageResult,
  SandboxTerminateRequest,
  SandboxTerminateResult,
  SandboxWaitReadyRequest,
  SandboxWaitReadyResult
} from "../backends.js";

const DEFAULT_IMAGE = "node:20-slim";
const DEFAULT_USER = "65532:65532";
const DEFAULT_NETWORK_MODE = "none";
const DEFAULT_DOCKER_COMMAND = "docker";
const DEFAULT_POLL_INTERVAL_MS = 200;
const DEFAULT_AVAILABILITY_TIMEOUT_MS = 1_500;
const DEFAULT_WORKSPACE_MOUNT_PATH = "/workspace";

export interface DockerCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: unknown;
}

export type DockerCommandRunner = (
  dockerCommand: string,
  args: string[],
  options?: {
    timeoutMs?: number;
  }
) => Promise<DockerCommandResult>;

export interface DockerSandboxExecutionBackendOptions {
  image?: string;
  user?: string;
  networkMode?: string;
  dockerCommand?: string;
  startupPollIntervalMs?: number;
  commandRunner?: DockerCommandRunner;
}

export class DockerSandboxExecutionBackend implements SandboxExecutionBackend {
  readonly kind = "agent-sandbox" as const;
  private readonly image: string;
  private readonly user: string;
  private readonly networkMode: string;
  private readonly dockerCommand: string;
  private readonly startupPollIntervalMs: number;
  private readonly commandRunner: DockerCommandRunner;

  constructor(options: DockerSandboxExecutionBackendOptions = {}) {
    this.image = options.image?.trim() || process.env.ATHENA_SANDBOX_DOCKER_IMAGE?.trim() || DEFAULT_IMAGE;
    this.user = options.user?.trim() || process.env.ATHENA_SANDBOX_DOCKER_USER?.trim() || DEFAULT_USER;
    this.networkMode =
      options.networkMode?.trim() || process.env.ATHENA_SANDBOX_DOCKER_NETWORK_MODE?.trim() || DEFAULT_NETWORK_MODE;
    this.dockerCommand = options.dockerCommand?.trim() || DEFAULT_DOCKER_COMMAND;
    this.startupPollIntervalMs = Math.max(25, options.startupPollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
    this.commandRunner = options.commandRunner ?? runDockerCommand;
  }

  async isAvailable(): Promise<boolean> {
    const result = await this.commandRunner(this.dockerCommand, ["info", "--format", "{{.ServerVersion}}"], {
      timeoutMs: DEFAULT_AVAILABILITY_TIMEOUT_MS
    });
    return result.exitCode === 0;
  }

  async claim(request: SandboxClaimRequest): Promise<SandboxClaimResult> {
    const startedAt = new Date().toISOString();
    const containerName = `athena-sbx-${sanitizeName(request.runId)}-${randomUUID().slice(0, 8)}`;
    const egressPolicy = normalizeEgressPolicy(request.egressPolicy);
    if (request.egressPolicy && !egressPolicy) {
      return {
        status: "unsupported",
        reason: "docker egress policy is invalid"
      };
    }
    const labels = this.buildLabels(request);
    if (egressPolicy) {
      labels.push("athena.dev/egress-default=deny");
      if (egressPolicy.allow.length > 0) {
        const serializedAllow = serializeEgressAllowlist(egressPolicy.allow);
        if (!serializedAllow) {
          return {
            status: "unsupported",
            reason: "docker egress policy allow-list is invalid"
          };
        }
        labels.push(`athena.dev/egress-allowlist=${serializedAllow}`);
      }
    }
    const workspaceMountPath = normalizeWorkspaceMountPath(request.workspaceMountPath) ?? DEFAULT_WORKSPACE_MOUNT_PATH;
    const workspaceReadOnly = request.workspaceReadOnly ?? false;
    const networkMode = resolveDockerNetworkMode(this.networkMode, egressPolicy);
    const args = [
      "create",
      "--name",
      containerName,
      "--network",
      networkMode,
      "--user",
      this.user,
      "--workdir",
      workspaceMountPath,
      ...(request.workspaceHostPath
        ? [
            "--volume",
            `${request.workspaceHostPath}:${workspaceMountPath}${workspaceReadOnly ? ":ro" : ""}`
          ]
        : []),
      ...buildDockerIgnoreMounts(workspaceMountPath, request.workspaceIgnore),
      ...labels.flatMap((entry) => ["--label", entry]),
      this.image,
      "sh",
      "-lc",
      "trap 'exit 0' TERM INT; while true; do sleep 3600; done"
    ];
    const result = await this.commandRunner(this.dockerCommand, args, {
      ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {})
    });
    if (result.exitCode !== 0) {
      return {
        status: "unsupported",
        reason: resolveDockerFailureReason(result, "docker create failed")
      };
    }
    const sandboxId = firstNonEmptyLine(result.stdout);
    if (!sandboxId) {
      return {
        status: "unsupported",
        reason: "docker create succeeded but did not return a container id"
      };
    }
    return {
      status: "claimed",
      sandboxId,
      claimName: containerName,
      runtimeClassName: "docker",
      claimedAt: startedAt
    };
  }

  async waitReady(request: SandboxWaitReadyRequest): Promise<SandboxWaitReadyResult> {
    const startResult = await this.commandRunner(this.dockerCommand, ["start", request.sandboxId], {
      timeoutMs: request.timeoutMs
    });
    if (startResult.exitCode !== 0 && !isNotFoundError(startResult.stderr)) {
      return {
        status: "timeout",
        observedAt: new Date().toISOString(),
        reason: resolveDockerFailureReason(startResult, "docker start failed")
      };
    }

    const deadline = Date.now() + Math.max(1, request.timeoutMs);
    while (Date.now() < deadline) {
      const inspect = await this.commandRunner(
        this.dockerCommand,
        ["inspect", "--format", "{{.State.Status}}", request.sandboxId],
        { timeoutMs: Math.min(this.startupPollIntervalMs, Math.max(1, deadline - Date.now())) }
      );
      if (inspect.exitCode === 0) {
        const status = firstNonEmptyLine(inspect.stdout);
        if (status === "running") {
          return {
            status: "ready",
            observedAt: new Date().toISOString(),
            endpoint: `docker://${request.sandboxId}`
          };
        }
        if (status === "exited" || status === "dead") {
          return {
            status: "timeout",
            observedAt: new Date().toISOString(),
            reason: `container entered non-running state: ${status}`
          };
        }
      } else if (isNotFoundError(inspect.stderr)) {
        return {
          status: "timeout",
          observedAt: new Date().toISOString(),
          reason: "container not found while waiting for readiness"
        };
      }
      await sleep(Math.min(this.startupPollIntervalMs, Math.max(0, deadline - Date.now())));
    }

    return {
      status: "timeout",
      observedAt: new Date().toISOString(),
      reason: "container did not become ready before timeout"
    };
  }

  async terminate(request: SandboxTerminateRequest): Promise<SandboxTerminateResult> {
    const result = await this.commandRunner(
      this.dockerCommand,
      ["stop", "--time", "1", request.sandboxId],
      {
        timeoutMs: 10_000
      }
    );
    if (result.exitCode !== 0 && !isNotFoundError(result.stderr)) {
      throw new Error(resolveDockerFailureReason(result, "docker stop failed"));
    }
    return {
      status: "terminated",
      observedAt: new Date().toISOString(),
      ...(isNotFoundError(result.stderr) ? { reason: "container was already absent" } : {})
    };
  }

  async cleanup(request: SandboxCleanupRequest): Promise<SandboxCleanupResult> {
    const result = await this.commandRunner(
      this.dockerCommand,
      ["rm", "--force", request.sandboxId],
      {
        timeoutMs: resolveCleanupTimeoutMs(request.ttlSeconds)
      }
    );
    if (result.exitCode !== 0 && !isNotFoundError(result.stderr)) {
      throw new Error(resolveDockerFailureReason(result, "docker rm failed"));
    }
    return {
      status: "cleaned",
      observedAt: new Date().toISOString(),
      ...(isNotFoundError(result.stderr) ? { reason: "container was already absent" } : {})
    };
  }

  async getResourceUsage(request: SandboxResourceUsageRequest): Promise<SandboxResourceUsageResult> {
    const observedAt = new Date().toISOString();
    const stats = await this.commandRunner(
      this.dockerCommand,
      ["stats", "--no-stream", "--format", "{{.CPUPerc}}|{{.MemUsage}}", request.sandboxId],
      { timeoutMs: 2_000 }
    );
    if (stats.exitCode !== 0) {
      return {
        status: "unsupported",
        observedAt,
        reason: resolveDockerFailureReason(stats, "docker stats failed")
      };
    }
    const statsLine = firstNonEmptyLine(stats.stdout);
    if (!statsLine) {
      return {
        status: "unsupported",
        observedAt,
        reason: "docker stats returned no output"
      };
    }
    const [cpuRaw, memRaw] = statsLine.split("|");
    const cpuCores = parseDockerCpuCores(cpuRaw);
    const memoryBytes = parseDockerMemoryBytes(memRaw);

    const inspect = await this.commandRunner(
      this.dockerCommand,
      ["inspect", "--size", "--format", "{{.SizeRw}}", request.sandboxId],
      { timeoutMs: 2_000 }
    );
    const diskBytes = inspect.exitCode === 0 ? parseDockerDiskBytes(firstNonEmptyLine(inspect.stdout)) : undefined;

    if (cpuCores === undefined && memoryBytes === undefined && diskBytes === undefined) {
      return {
        status: "unsupported",
        observedAt,
        reason: "docker resource usage metrics are unavailable"
      };
    }

    return {
      status: "ok",
      observedAt,
      ...(cpuCores !== undefined ? { cpuCores } : {}),
      ...(memoryBytes !== undefined ? { memoryBytes } : {}),
      ...(diskBytes !== undefined ? { diskBytes } : {})
    };
  }

  private buildLabels(request: SandboxClaimRequest): string[] {
    const labels: Record<string, string> = {
      "athena.dev/run-id": request.runId,
      "athena.dev/session-id": request.sessionId,
      "athena.dev/template-ref": request.templateRef,
      ...(request.warmPoolRef ? { "athena.dev/warm-pool-ref": request.warmPoolRef } : {}),
      ...(request.runtimeClassName ? { "athena.dev/runtime-class-name": request.runtimeClassName } : {})
    };
    for (const [key, value] of Object.entries(request.labels ?? {})) {
      if (key && value) {
        labels[key] = value;
      }
    }
    for (const [key, value] of Object.entries(request.annotations ?? {})) {
      if (key && value) {
        labels[`athena.annotation.${key}`] = value;
      }
    }
    return Object.entries(labels).map(([key, value]) => `${key}=${value}`);
  }
}

function resolveDockerNetworkMode(configured: string, egressPolicy: { allow: Array<{ host: string; port?: number }> } | undefined): string {
  if (!egressPolicy || egressPolicy.allow.length === 0) {
    return configured;
  }
  return configured === "none" ? "bridge" : configured;
}

function normalizeEgressPolicy(
  value: SandboxClaimRequest["egressPolicy"]
): { allow: Array<{ host: string; port?: number }> } | undefined {
  if (!value) {
    return undefined;
  }
  if (value.defaultAction !== "deny" || !Array.isArray(value.allow)) {
    return undefined;
  }
  const rules: Array<{ host: string; port?: number }> = [];
  for (const rule of value.allow) {
    const host = rule.host?.trim().toLowerCase();
    if (!host || !isValidEgressHost(host)) {
      return undefined;
    }
    if (rule.port !== undefined && (!Number.isInteger(rule.port) || rule.port < 1 || rule.port > 65535)) {
      return undefined;
    }
    rules.push({
      host,
      ...(rule.port !== undefined ? { port: rule.port } : {})
    });
  }
  return { allow: rules };
}

function serializeEgressAllowlist(rules: Array<{ host: string; port?: number }>): string | undefined {
  const serialized = rules.map((rule) => `${rule.host}${rule.port !== undefined ? `:${rule.port}` : ""}`).join(",");
  if (!serialized || serialized.length > 2_048) {
    return undefined;
  }
  return serialized;
}

function isValidEgressHost(value: string): boolean {
  if (isIpv4Host(value)) {
    return true;
  }
  if (isHostname(value)) {
    return true;
  }
  if (value.startsWith("*.")) {
    return isHostname(value.slice(2));
  }
  return false;
}

function isIpv4Host(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const parsed = Number.parseInt(part, 10);
    return parsed >= 0 && parsed <= 255;
  });
}

function isHostname(value: string): boolean {
  if (value.length === 0 || value.length > 253) {
    return false;
  }
  if (!/^[a-z0-9.-]+$/.test(value)) {
    return false;
  }
  const labels = value.split(".");
  if (labels.some((label) => label.length === 0 || label.length > 63)) {
    return false;
  }
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
}

function resolveCleanupTimeoutMs(ttlSeconds: number | undefined): number {
  if (ttlSeconds === undefined || ttlSeconds <= 0) {
    return 10_000;
  }
  return Math.min(300_000, Math.max(1_000, ttlSeconds * 1_000));
}

function firstNonEmptyLine(value: string): string | undefined {
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return undefined;
}

function sanitizeName(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "-");
  const compacted = normalized.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return compacted.slice(0, 40) || "run";
}

function normalizeWorkspaceMountPath(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized.startsWith("/") || normalized.includes("..")) {
    return undefined;
  }
  return normalized.replace(/\/+/g, "/");
}

function buildDockerIgnoreMounts(workspaceMountPath: string, ignorePaths: string[] | undefined): string[] {
  if (!ignorePaths || ignorePaths.length === 0) {
    return [];
  }
  const mounts: string[] = [];
  for (const path of ignorePaths) {
    const target = resolveWorkspaceIgnoreTarget(workspaceMountPath, path);
    if (!target) {
      continue;
    }
    mounts.push("--mount", `type=tmpfs,destination=${target}`);
  }
  return mounts;
}

function resolveWorkspaceIgnoreTarget(workspaceMountPath: string, value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const relative = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  if (!relative || relative.includes("..")) {
    return undefined;
  }
  return `${workspaceMountPath.replace(/\/+$/g, "")}/${relative}`.replace(/\/+/g, "/");
}

function resolveDockerFailureReason(result: DockerCommandResult, fallback: string): string {
  if (result.timedOut) {
    return `${fallback}: command timed out`;
  }
  const stderr = result.stderr.trim();
  if (stderr.length > 0) {
    return `${fallback}: ${stderr}`;
  }
  const stdout = result.stdout.trim();
  if (stdout.length > 0) {
    return `${fallback}: ${stdout}`;
  }
  if (result.error instanceof Error && result.error.message.trim().length > 0) {
    return `${fallback}: ${result.error.message}`;
  }
  return fallback;
}

function parseDockerCpuCores(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().replace("%", "");
  const percent = Number.parseFloat(normalized);
  if (!Number.isFinite(percent) || percent < 0) {
    return undefined;
  }
  return percent / 100;
}

function parseDockerMemoryBytes(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const usage = value.split("/")[0]?.trim();
  if (!usage) {
    return undefined;
  }
  return parseDockerByteQuantity(usage);
}

function parseDockerDiskBytes(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}

function parseDockerByteQuantity(value: string): number | undefined {
  const match = value.trim().match(/^([0-9]*\.?[0-9]+)\s*([kmgtp]?i?b)$/i);
  if (!match) {
    return undefined;
  }
  const amount = Number.parseFloat(match[1] ?? "");
  const unit = (match[2] ?? "").toLowerCase();
  if (!Number.isFinite(amount) || amount < 0) {
    return undefined;
  }
  const factors: Record<string, number> = {
    b: 1,
    kb: 1_000,
    mb: 1_000_000,
    gb: 1_000_000_000,
    tb: 1_000_000_000_000,
    pb: 1_000_000_000_000_000,
    kib: 1_024,
    mib: 1_048_576,
    gib: 1_073_741_824,
    tib: 1_099_511_627_776,
    pib: 1_125_899_906_842_624
  };
  const factor = factors[unit];
  if (!factor) {
    return undefined;
  }
  return amount * factor;
}

function isNotFoundError(stderr: string): boolean {
  const normalized = stderr.toLowerCase();
  return normalized.includes("no such container") || normalized.includes("not found");
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function runDockerCommand(
  dockerCommand: string,
  args: string[],
  options: { timeoutMs?: number } = {}
): Promise<DockerCommandResult> {
  return await new Promise<DockerCommandResult>((resolve) => {
    const child = spawn(dockerCommand, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    const timeoutMs = options.timeoutMs;
    const timer =
      timeoutMs !== undefined && timeoutMs > 0
        ? setTimeout(() => {
            if (settled) {
              return;
            }
            timedOut = true;
            child.kill("SIGTERM");
            setTimeout(() => {
              if (!settled) {
                child.kill("SIGKILL");
              }
            }, 200);
          }, timeoutMs)
        : undefined;

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.once("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      resolve({
        exitCode: 1,
        stdout,
        stderr,
        timedOut,
        error
      });
    });
    child.once("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        timedOut
      });
    });
  });
}
