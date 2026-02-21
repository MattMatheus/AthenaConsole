import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { PassThrough } from "node:stream";
import { CoreV1Api, CustomObjectsApi, KubeConfig, Log } from "@kubernetes/client-node";
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
const DEFAULT_NAMESPACE = "default";
const DEFAULT_NAME_PREFIX = "athena-sbx";
const DEFAULT_POLL_INTERVAL_MS = 200;
const DEFAULT_AVAILABILITY_TIMEOUT_MS = 1_500;
const DEFAULT_ACTIVE_DEADLINE_SECONDS = 300;
const DEFAULT_WORKSPACE_MOUNT_PATH = "/workspace";
const SERVICE_ACCOUNT_NAMESPACE_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/namespace";
const K8S_METRICS_GROUP = "metrics.k8s.io";
const K8S_METRICS_VERSION = "v1beta1";
const K8S_PODS_RESOURCE = "pods";

interface K8sPodCondition {
  type?: string;
  status?: string;
}

interface K8sPodStatus {
  phase?: string;
  conditions?: K8sPodCondition[];
}

interface K8sPodRecord {
  metadata?: {
    name?: string;
    namespace?: string;
  };
  status?: K8sPodStatus;
}

interface K8sPodMetricsApiClient {
  getNamespacedCustomObject(param: {
    group: string;
    version: string;
    namespace: string;
    plural: string;
    name: string;
  }): Promise<unknown>;
}

export interface K8sPodApiClient {
  listNamespacedPod(param: {
    namespace: string;
    limit?: number;
  }): Promise<{
    items?: K8sPodRecord[];
  }>;
  createNamespacedPod(param: {
    namespace: string;
    body: Record<string, unknown>;
  }): Promise<K8sPodRecord>;
  readNamespacedPod(param: {
    namespace: string;
    name: string;
  }): Promise<K8sPodRecord>;
  deleteNamespacedPod(param: {
    namespace: string;
    name: string;
    gracePeriodSeconds?: number;
    propagationPolicy?: "Background" | "Foreground" | "Orphan";
  }): Promise<unknown>;
}

interface K8sPodLogStreamHandle {
  stop: () => void;
}

export interface K8sPodLogClient {
  streamPodLogs(request: {
    namespace: string;
    podName: string;
    containerName?: string;
    onLine: (line: string) => void;
  }): Promise<K8sPodLogStreamHandle | undefined>;
}

export interface K8sSandboxExecutionBackendOptions {
  namespace?: string;
  image?: string;
  serviceAccountName?: string;
  podNamePrefix?: string;
  startupPollIntervalMs?: number;
  availabilityTimeoutMs?: number;
  defaultActiveDeadlineSeconds?: number;
  streamLogs?: boolean;
  onLogLine?: (entry: { runId: string; sandboxId: string; line: string }) => void;
  podApiClient?: K8sPodApiClient;
  podMetricsApiClient?: K8sPodMetricsApiClient;
  podLogClient?: K8sPodLogClient;
  kubeConfig?: KubeConfig;
}

export class K8sSandboxExecutionBackend implements SandboxExecutionBackend {
  readonly kind = "agent-sandbox" as const;
  private namespace: string | undefined;
  private readonly image: string;
  private readonly serviceAccountName: string | undefined;
  private readonly podNamePrefix: string;
  private readonly startupPollIntervalMs: number;
  private readonly availabilityTimeoutMs: number;
  private readonly defaultActiveDeadlineSeconds: number;
  private readonly streamLogs: boolean;
  private readonly onLogLine: (entry: { runId: string; sandboxId: string; line: string }) => void;
  private readonly podLogClient: K8sPodLogClient;
  private readonly podLogHandles = new Map<string, K8sPodLogStreamHandle>();
  private podApiClient: K8sPodApiClient | undefined;
  private podMetricsApiClient: K8sPodMetricsApiClient | undefined;
  private kubeConfig: KubeConfig | undefined;

  constructor(options: K8sSandboxExecutionBackendOptions = {}) {
    this.namespace = normalizeNamespace(options.namespace ?? process.env.ATHENA_K8S_NAMESPACE);
    this.image = options.image?.trim() || process.env.ATHENA_SANDBOX_K8S_IMAGE?.trim() || DEFAULT_IMAGE;
    this.serviceAccountName = normalizeNamespace(
      options.serviceAccountName ?? process.env.ATHENA_SANDBOX_K8S_SERVICE_ACCOUNT
    );
    this.podNamePrefix = sanitizeK8sName(
      options.podNamePrefix ?? process.env.ATHENA_SANDBOX_K8S_POD_PREFIX ?? DEFAULT_NAME_PREFIX
    );
    this.startupPollIntervalMs = Math.max(25, options.startupPollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
    this.availabilityTimeoutMs = Math.max(100, options.availabilityTimeoutMs ?? DEFAULT_AVAILABILITY_TIMEOUT_MS);
    this.defaultActiveDeadlineSeconds = Math.max(1, options.defaultActiveDeadlineSeconds ?? DEFAULT_ACTIVE_DEADLINE_SECONDS);
    this.streamLogs = options.streamLogs ?? true;
    this.onLogLine = options.onLogLine ?? (() => undefined);
    this.podApiClient = options.podApiClient;
    this.podMetricsApiClient = options.podMetricsApiClient;
    this.podLogClient = options.podLogClient ?? new KubernetesPodLogClient(options.kubeConfig);
    this.kubeConfig = options.kubeConfig;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const context = this.getClientContext();
      await withTimeout(context.apiClient.listNamespacedPod({ namespace: context.namespace, limit: 1 }), this.availabilityTimeoutMs);
      return true;
    } catch {
      return false;
    }
  }

  async claim(request: SandboxClaimRequest): Promise<SandboxClaimResult> {
    const claimedAt = new Date().toISOString();
    const context = this.getClientContext();
    const podName = `${this.podNamePrefix}-${sanitizeK8sName(request.runId)}-${randomUUID().slice(0, 8)}`.slice(0, 63);
    const egressPolicy = normalizeEgressPolicy(request.egressPolicy);
    if (request.egressPolicy && !egressPolicy) {
      return {
        status: "unsupported",
        reason: "k8s egress policy is invalid"
      };
    }
    const labels = this.buildLabels(request);
    const annotations = this.buildAnnotations(request);
    if (egressPolicy) {
      annotations["athena.dev/egress-default"] = "deny";
      if (egressPolicy.allow.length > 0) {
        const serializedAllow = serializeEgressAllowlist(egressPolicy.allow);
        if (!serializedAllow) {
          return {
            status: "unsupported",
            reason: "k8s egress policy allow-list is invalid"
          };
        }
        annotations["athena.dev/egress-allowlist"] = serializedAllow;
      }
    }
    const activeDeadlineSeconds = resolveActiveDeadlineSeconds(request.timeoutMs, this.defaultActiveDeadlineSeconds);
    const workspace = this.resolveWorkspaceConfig(request);

    try {
      await withTimeout(
        context.apiClient.createNamespacedPod({
          namespace: context.namespace,
          body: {
            apiVersion: "v1",
            kind: "Pod",
            metadata: {
              name: podName,
              labels,
              ...(Object.keys(annotations).length > 0 ? { annotations } : {})
            },
            spec: this.buildPodSpec(request, workspace, activeDeadlineSeconds)
          }
        }),
        request.timeoutMs
      );
    } catch (error) {
      return {
        status: "unsupported",
        reason: resolveK8sFailureReason(error, "k8s pod create failed")
      };
    }

    return {
      status: "claimed",
      sandboxId: podName,
      claimName: podName,
      namespace: context.namespace,
      ...(request.runtimeClassName ? { runtimeClassName: request.runtimeClassName } : {}),
      claimedAt
    };
  }

  async waitReady(request: SandboxWaitReadyRequest): Promise<SandboxWaitReadyResult> {
    const context = this.getClientContext();
    const deadline = Date.now() + Math.max(1, request.timeoutMs);
    while (Date.now() < deadline) {
      let pod: K8sPodRecord;
      try {
        pod = await withTimeout(
          context.apiClient.readNamespacedPod({
            namespace: context.namespace,
            name: request.sandboxId
          }),
          Math.min(this.startupPollIntervalMs, Math.max(1, deadline - Date.now()))
        );
      } catch (error) {
        if (isK8sNotFound(error)) {
          return {
            status: "timeout",
            observedAt: new Date().toISOString(),
            reason: "pod not found while waiting for readiness"
          };
        }
        return {
          status: "timeout",
          observedAt: new Date().toISOString(),
          reason: resolveK8sFailureReason(error, "k8s pod readiness check failed")
        };
      }

      const phase = pod.status?.phase;
      const ready = isPodReady(pod.status);
      if (phase === "Running" && ready) {
        await this.ensureLogStream(request.runId, request.sandboxId, context.namespace);
        return {
          status: "ready",
          observedAt: new Date().toISOString(),
          endpoint: `k8s://${context.namespace}/${request.sandboxId}`
        };
      }
      if (phase === "Failed" || phase === "Succeeded") {
        return {
          status: "timeout",
          observedAt: new Date().toISOString(),
          reason: `pod entered terminal phase before readiness: ${phase}`
        };
      }
      await sleep(Math.min(this.startupPollIntervalMs, Math.max(0, deadline - Date.now())));
    }

    return {
      status: "timeout",
      observedAt: new Date().toISOString(),
      reason: "pod did not become ready before timeout"
    };
  }

  async terminate(request: SandboxTerminateRequest): Promise<SandboxTerminateResult> {
    this.stopLogStream(request.sandboxId);
    const context = this.getClientContext();
    try {
      await context.apiClient.deleteNamespacedPod({
        namespace: context.namespace,
        name: request.sandboxId,
        gracePeriodSeconds: 1,
        propagationPolicy: "Background"
      });
    } catch (error) {
      if (!isK8sNotFound(error)) {
        throw new Error(resolveK8sFailureReason(error, "k8s pod terminate failed"));
      }
      return {
        status: "terminated",
        observedAt: new Date().toISOString(),
        reason: "pod was already absent"
      };
    }
    return {
      status: "terminated",
      observedAt: new Date().toISOString()
    };
  }

  async cleanup(request: SandboxCleanupRequest): Promise<SandboxCleanupResult> {
    this.stopLogStream(request.sandboxId);
    const context = this.getClientContext();
    try {
      await withTimeout(
        context.apiClient.deleteNamespacedPod({
          namespace: context.namespace,
          name: request.sandboxId,
          gracePeriodSeconds: 0,
          propagationPolicy: "Background"
        }),
        resolveCleanupTimeoutMs(request.ttlSeconds)
      );
    } catch (error) {
      if (!isK8sNotFound(error)) {
        throw new Error(resolveK8sFailureReason(error, "k8s pod cleanup failed"));
      }
      return {
        status: "cleaned",
        observedAt: new Date().toISOString(),
        reason: "pod was already absent"
      };
    }
    return {
      status: "cleaned",
      observedAt: new Date().toISOString()
    };
  }

  async getResourceUsage(request: SandboxResourceUsageRequest): Promise<SandboxResourceUsageResult> {
    const observedAt = new Date().toISOString();
    const namespace = request.namespace ?? this.getClientContext().namespace;
    try {
      const metrics = await this.getPodMetricsApiClient().getNamespacedCustomObject({
        group: K8S_METRICS_GROUP,
        version: K8S_METRICS_VERSION,
        namespace,
        plural: K8S_PODS_RESOURCE,
        name: request.sandboxId
      });
      const { cpuCores, memoryBytes } = parseK8sPodMetrics(metrics);
      if (cpuCores === undefined && memoryBytes === undefined) {
        return {
          status: "unsupported",
          observedAt,
          reason: "k8s pod metrics are unavailable"
        };
      }
      return {
        status: "ok",
        observedAt,
        ...(cpuCores !== undefined ? { cpuCores } : {}),
        ...(memoryBytes !== undefined ? { memoryBytes } : {})
      };
    } catch (error) {
      return {
        status: "unsupported",
        observedAt,
        reason: resolveK8sFailureReason(error, "k8s pod metrics lookup failed")
      };
    }
  }

  private getClientContext(): { apiClient: K8sPodApiClient; namespace: string } {
    const apiClient = this.getPodApiClient();
    const namespace = this.namespace ?? this.resolveDefaultNamespace();
    return {
      apiClient,
      namespace
    };
  }

  private getPodApiClient(): K8sPodApiClient {
    if (this.podApiClient) {
      return this.podApiClient;
    }
    this.kubeConfig ??= createKubeConfig();
    this.podApiClient = this.kubeConfig.makeApiClient(CoreV1Api);
    return this.podApiClient;
  }

  private getPodMetricsApiClient(): K8sPodMetricsApiClient {
    if (this.podMetricsApiClient) {
      return this.podMetricsApiClient;
    }
    this.kubeConfig ??= createKubeConfig();
    this.podMetricsApiClient = this.kubeConfig.makeApiClient(CustomObjectsApi);
    return this.podMetricsApiClient;
  }

  private resolveDefaultNamespace(): string {
    const fromServiceAccount = readNamespaceFromServiceAccount();
    if (fromServiceAccount) {
      this.namespace = fromServiceAccount;
      return fromServiceAccount;
    }
    this.kubeConfig ??= createKubeConfig();
    const currentContextName = this.kubeConfig.getCurrentContext();
    const context = currentContextName ? this.kubeConfig.getContextObject(currentContextName) : null;
    const fromContext = normalizeNamespace(context?.namespace);
    if (fromContext) {
      this.namespace = fromContext;
      return fromContext;
    }
    this.namespace = DEFAULT_NAMESPACE;
    return DEFAULT_NAMESPACE;
  }

  private buildLabels(request: SandboxClaimRequest): Record<string, string> {
    const labels: Record<string, string> = {
      "app.kubernetes.io/name": "athena-sandbox",
      "app.kubernetes.io/managed-by": "project-athena",
      "athena.dev/run-id": normalizeLabelValue(request.runId),
      "athena.dev/session-id": normalizeLabelValue(request.sessionId),
      "athena.dev/template-ref": normalizeLabelValue(request.templateRef),
      ...(request.warmPoolRef ? { "athena.dev/warm-pool-ref": normalizeLabelValue(request.warmPoolRef) } : {}),
      ...(request.runtimeClassName
        ? { "athena.dev/runtime-class-name": normalizeLabelValue(request.runtimeClassName) }
        : {})
    };

    for (const [key, value] of Object.entries(request.labels ?? {})) {
      if (isNonEmpty(key) && isNonEmpty(value)) {
        labels[key] = normalizeLabelValue(value);
      }
    }

    return labels;
  }

  private buildAnnotations(request: SandboxClaimRequest): Record<string, string> {
    const annotations: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.annotations ?? {})) {
      if (isNonEmpty(key) && isNonEmpty(value)) {
        annotations[key] = value;
      }
    }
    return annotations;
  }

  private resolveWorkspaceConfig(request: SandboxClaimRequest): {
    mountPath: string;
    readOnly: boolean;
    syncRepo?: string;
    syncRef?: string;
    syncSubPath?: string;
    syncStrategy: "init-git-clone" | "git-sync";
    ignorePaths: string[];
  } {
    const mountPath = normalizeWorkspaceMountPath(request.workspaceMountPath) ?? DEFAULT_WORKSPACE_MOUNT_PATH;
    return {
      mountPath,
      readOnly: request.workspaceReadOnly ?? false,
      ...(request.workspaceSyncRepo ? { syncRepo: request.workspaceSyncRepo } : {}),
      ...(request.workspaceSyncRef ? { syncRef: request.workspaceSyncRef } : {}),
      ...(request.workspaceSyncSubPath ? { syncSubPath: request.workspaceSyncSubPath } : {}),
      syncStrategy: request.workspaceSyncStrategy ?? "init-git-clone",
      ignorePaths: request.workspaceIgnore ?? []
    };
  }

  private buildPodSpec(
    request: SandboxClaimRequest,
    workspace: {
      mountPath: string;
      readOnly: boolean;
      syncRepo?: string;
      syncRef?: string;
      syncSubPath?: string;
      syncStrategy: "init-git-clone" | "git-sync";
      ignorePaths: string[];
    },
    activeDeadlineSeconds: number
  ): Record<string, unknown> {
    const initContainers = buildWorkspaceInitContainers(workspace);
    return {
      restartPolicy: "Never",
      ...(request.runtimeClassName ? { runtimeClassName: request.runtimeClassName } : {}),
      ...(this.serviceAccountName ? { serviceAccountName: this.serviceAccountName } : {}),
      ...(activeDeadlineSeconds ? { activeDeadlineSeconds } : {}),
      volumes: [{ name: "workspace", emptyDir: {} }],
      ...(initContainers.length > 0 ? { initContainers } : {}),
      containers: [
        {
          name: "runner",
          image: this.image,
          imagePullPolicy: "IfNotPresent",
          workingDir: workspace.mountPath,
          volumeMounts: [
            {
              name: "workspace",
              mountPath: workspace.mountPath,
              ...(workspace.readOnly ? { readOnly: true } : {})
            }
          ],
          command: ["/bin/sh", "-lc", "trap 'exit 0' TERM INT; while true; do sleep 3600; done"]
        }
      ]
    };
  }

  private async ensureLogStream(runId: string, sandboxId: string, namespace: string): Promise<void> {
    if (!this.streamLogs || this.podLogHandles.has(sandboxId)) {
      return;
    }
    try {
      const handle = await this.podLogClient.streamPodLogs({
        namespace,
        podName: sandboxId,
        containerName: "runner",
        onLine: (line) => {
          this.onLogLine({ runId, sandboxId, line });
        }
      });
      if (handle) {
        this.podLogHandles.set(sandboxId, handle);
      }
    } catch {
      // Log streaming is best-effort and should not impact sandbox lifecycle outcomes.
    }
  }

  private stopLogStream(sandboxId: string): void {
    const handle = this.podLogHandles.get(sandboxId);
    if (!handle) {
      return;
    }
    this.podLogHandles.delete(sandboxId);
    try {
      handle.stop();
    } catch {
      // no-op best effort
    }
  }
}

class KubernetesPodLogClient implements K8sPodLogClient {
  private readonly kubeConfig: KubeConfig;

  constructor(kubeConfig?: KubeConfig) {
    this.kubeConfig = kubeConfig ?? createKubeConfig();
  }

  async streamPodLogs(request: {
    namespace: string;
    podName: string;
    containerName?: string;
    onLine: (line: string) => void;
  }): Promise<K8sPodLogStreamHandle | undefined> {
    const lineStream = new PassThrough();
    let buffered = "";
    const onData = (chunk: Buffer | string) => {
      buffered += chunk.toString();
      for (;;) {
        const newlineIndex = buffered.indexOf("\n");
        if (newlineIndex < 0) {
          break;
        }
        const line = buffered.slice(0, newlineIndex).trimEnd();
        buffered = buffered.slice(newlineIndex + 1);
        if (line.length > 0) {
          request.onLine(line);
        }
      }
    };
    lineStream.on("data", onData);

    const logApi = new Log(this.kubeConfig) as unknown as {
      log: (...args: unknown[]) => Promise<unknown>;
    };

    const abortController = new AbortController();
    void logApi
      .log(
        request.namespace,
        request.podName,
        request.containerName ?? "runner",
        lineStream,
        {
          follow: true,
          pretty: false,
          timestamps: false,
          abortSignal: abortController.signal
        }
      )
      .catch(() => undefined)
      .finally(() => {
        lineStream.removeListener("data", onData);
        lineStream.destroy();
      });

    return {
      stop: () => {
        abortController.abort();
        lineStream.removeListener("data", onData);
        lineStream.destroy();
      }
    };
  }
}

function createKubeConfig(): KubeConfig {
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromDefault();
  return kubeConfig;
}

function normalizeNamespace(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNamespaceFromServiceAccount(): string | undefined {
  if (!existsSync(SERVICE_ACCOUNT_NAMESPACE_PATH)) {
    return undefined;
  }
  try {
    return normalizeNamespace(readFileSync(SERVICE_ACCOUNT_NAMESPACE_PATH, "utf8"));
  } catch {
    return undefined;
  }
}

function sanitizeK8sName(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const compacted = normalized.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return compacted.slice(0, 63) || "run";
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

function normalizeLabelValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "unknown";
  }
  const normalized = trimmed.replace(/[^A-Za-z0-9_.-]/g, "-");
  const compacted = normalized.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return (compacted || "unknown").slice(0, 63);
}

function parseK8sPodMetrics(value: unknown): { cpuCores?: number; memoryBytes?: number } {
  const row = value as {
    containers?: Array<{
      usage?: {
        cpu?: string;
        memory?: string;
      };
    }>;
    body?: {
      containers?: Array<{
        usage?: {
          cpu?: string;
          memory?: string;
        };
      }>;
    };
  };
  const containers = row.containers ?? row.body?.containers ?? [];
  let cpu = 0;
  let memory = 0;
  let cpuSeen = false;
  let memorySeen = false;
  for (const container of containers) {
    const parsedCpu = parseCpuQuantity(container.usage?.cpu);
    if (parsedCpu !== undefined) {
      cpu += parsedCpu;
      cpuSeen = true;
    }
    const parsedMemory = parseMemoryQuantity(container.usage?.memory);
    if (parsedMemory !== undefined) {
      memory += parsedMemory;
      memorySeen = true;
    }
  }
  return {
    ...(cpuSeen ? { cpuCores: cpu } : {}),
    ...(memorySeen ? { memoryBytes: memory } : {})
  };
}

function buildWorkspaceInitContainers(workspace: {
  mountPath: string;
  syncRepo?: string;
  syncRef?: string;
  syncSubPath?: string;
  syncStrategy: "init-git-clone" | "git-sync";
  ignorePaths: string[];
}): Array<Record<string, unknown>> {
  if (!workspace.syncRepo) {
    return [];
  }
  const command =
    workspace.syncStrategy === "git-sync"
      ? buildGitSyncCommand(workspace.syncRepo, workspace.syncRef, workspace.syncSubPath, workspace.ignorePaths)
      : buildInitGitCloneCommand(workspace.syncRepo, workspace.syncRef, workspace.syncSubPath, workspace.ignorePaths);
  return [
    {
      name: "workspace-sync",
      image: "alpine/git:2.47.2",
      imagePullPolicy: "IfNotPresent",
      workingDir: workspace.mountPath,
      command: ["/bin/sh", "-lc", command],
      volumeMounts: [
        {
          name: "workspace",
          mountPath: workspace.mountPath
        }
      ]
    }
  ];
}

function buildInitGitCloneCommand(
  repo: string,
  ref: string | undefined,
  subPath: string | undefined,
  ignorePaths: string[]
): string {
  const targetDir = sanitizeSubPath(subPath);
  const syncTarget = targetDir === "." ? "/workspace" : `/workspace/${targetDir}`;
  const refCommand = ref ? `git -C /workspace-src checkout ${shellEscape(ref)}` : "";
  const copyCommand =
    targetDir === "."
      ? "cp -a /workspace-src/. /workspace/"
      : `cp -a /workspace-src/${shellEscape(targetDir)}/. ${shellEscape(syncTarget)}/`;
  const ignoreCommand = buildIgnoreCleanupCommands(syncTarget, ignorePaths);
  return [
    "set -euo pipefail",
    "rm -rf /workspace/* /workspace/.[!.]* /workspace/..?* 2>/dev/null || true",
    `git clone --depth 1 ${shellEscape(repo)} /workspace-src`,
    refCommand,
    `mkdir -p ${shellEscape(syncTarget)}`,
    copyCommand,
    ignoreCommand
  ]
    .filter(Boolean)
    .join(" && ");
}

function buildGitSyncCommand(repo: string, ref: string | undefined, subPath: string | undefined, ignorePaths: string[]): string {
  const targetDir = sanitizeSubPath(subPath);
  const syncTarget = targetDir === "." ? "/workspace" : `/workspace/${targetDir}`;
  const branchArg = ref ? `--branch ${shellEscape(ref)}` : "";
  const copyCommand =
    targetDir === "."
      ? "cp -a /workspace-src/. /workspace/"
      : `cp -a /workspace-src/${shellEscape(targetDir)}/. ${shellEscape(syncTarget)}/`;
  const ignoreCommand = buildIgnoreCleanupCommands(syncTarget, ignorePaths);
  return [
    "set -euo pipefail",
    "rm -rf /workspace/* /workspace/.[!.]* /workspace/..?* 2>/dev/null || true",
    `git clone --depth 1 ${branchArg} ${shellEscape(repo)} /workspace-src`,
    `mkdir -p ${shellEscape(syncTarget)}`,
    copyCommand,
    ignoreCommand
  ]
    .filter(Boolean)
    .join(" && ");
}

function buildIgnoreCleanupCommands(syncTarget: string, ignorePaths: string[]): string {
  const commands = ignorePaths
    .map((value) => normalizeIgnorePath(value))
    .filter((value): value is string => Boolean(value))
    .map((value) => `rm -rf ${shellEscape(`${syncTarget.replace(/\/+$/g, "")}/${value}`.replace(/\/+/g, "/"))}`);
  return commands.join(" && ");
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

function normalizeIgnorePath(value: string): string | undefined {
  const trimmed = value.trim().replace(/^\/+/, "");
  if (!trimmed || trimmed.includes("..")) {
    return undefined;
  }
  return trimmed;
}

function sanitizeSubPath(value: string | undefined): string {
  if (!value) {
    return ".";
  }
  const normalized = value.trim().replace(/^\/+/, "").replace(/\/+/g, "/");
  if (!normalized || normalized.includes("..")) {
    return ".";
  }
  return normalized;
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPodReady(status: K8sPodStatus | undefined): boolean {
  const conditions = status?.conditions ?? [];
  const readyCondition = conditions.find((condition) => condition.type === "Ready");
  return readyCondition?.status === "True";
}

function resolveCleanupTimeoutMs(ttlSeconds: number | undefined): number {
  if (ttlSeconds === undefined || ttlSeconds <= 0) {
    return 10_000;
  }
  return Math.min(300_000, Math.max(1_000, ttlSeconds * 1_000));
}

const DECIMAL_QUANTITY_SUFFIXES: Record<string, number> = {
  n: 1e-9,
  u: 1e-6,
  m: 1e-3,
  "": 1,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  P: 1e15,
  E: 1e18
};

const BINARY_QUANTITY_SUFFIXES: Record<string, number> = {
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  Ti: 1024 ** 4,
  Pi: 1024 ** 5,
  Ei: 1024 ** 6
};

function parseCpuQuantity(quantity: string | undefined): number | undefined {
  const parsed = parseQuantityComponents(quantity);
  if (!parsed) {
    return undefined;
  }
  const factor = {
    "": 1,
    n: 1e-9,
    u: 1e-6,
    m: 1e-3
  }[parsed.suffix];
  if (factor === undefined) {
    return undefined;
  }
  return parsed.value * factor;
}

function parseMemoryQuantity(quantity: string | undefined): number | undefined {
  const parsed = parseQuantityComponents(quantity);
  if (!parsed) {
    return undefined;
  }
  const decimalFactor = DECIMAL_QUANTITY_SUFFIXES[parsed.suffix];
  if (decimalFactor !== undefined) {
    return parsed.value * decimalFactor;
  }
  const binaryFactor = BINARY_QUANTITY_SUFFIXES[parsed.suffix];
  if (binaryFactor !== undefined) {
    return parsed.value * binaryFactor;
  }
  return undefined;
}

function parseQuantityComponents(quantity: string | undefined): { value: number; suffix: string } | undefined {
  if (!quantity) {
    return undefined;
  }
  const trimmed = quantity.trim();
  const match = trimmed.match(/^([+-]?\d+(?:\.\d+)?)([a-zA-Z]*)$/);
  if (!match) {
    return undefined;
  }
  const value = Number.parseFloat(match[1] ?? "");
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return {
    value,
    suffix: match[2] ?? ""
  };
}

function resolveActiveDeadlineSeconds(timeoutMs: number | undefined, defaultValue: number): number {
  if (timeoutMs === undefined || timeoutMs <= 0) {
    return defaultValue;
  }
  return Math.max(1, Math.ceil(timeoutMs / 1_000));
}

function getK8sErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const row = error as Record<string, unknown>;
  if (typeof row.code === "number") {
    return row.code;
  }
  if (typeof row.statusCode === "number") {
    return row.statusCode;
  }
  return undefined;
}

function isK8sNotFound(error: unknown): boolean {
  return getK8sErrorCode(error) === 404;
}

function resolveK8sFailureReason(error: unknown, fallback: string): string {
  const message = extractErrorMessage(error);
  if (message) {
    return `${fallback}: ${message}`;
  }
  const code = getK8sErrorCode(error);
  if (code !== undefined) {
    return `${fallback}: kubernetes status ${code}`;
  }
  return fallback;
}

function extractErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const row = error as {
    body?: {
      message?: unknown;
    };
    response?: {
      body?: {
        message?: unknown;
      };
    };
  };
  const message =
    typeof row.body?.message === "string"
      ? row.body.message
      : typeof row.response?.body?.message === "string"
        ? row.response.body.message
        : undefined;
  return message?.trim() || undefined;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number | undefined): Promise<T> {
  if (timeoutMs === undefined || timeoutMs <= 0) {
    return promise;
  }
  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error("operation timed out"));
    }, timeoutMs);
    void promise
      .then((result) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}
