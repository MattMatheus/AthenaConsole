import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { CoordinationV1Api, KubeConfig } from "@kubernetes/client-node";
import { AthenaError } from "../../runtime/errors.js";
import type {
  DistributedLockAcquireRequest,
  DistributedLockAcquireResult,
  DistributedLockReleaseRequest,
  IDistributedLock
} from "./types.js";

interface K8sLeaseRecord {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    name?: string;
    namespace?: string;
    resourceVersion?: string;
  };
  spec?: {
    holderIdentity?: string;
    leaseDurationSeconds?: number;
    acquireTime?: unknown;
    renewTime?: unknown;
  };
}

interface K8sLeaseApiClient {
  readNamespacedLease(param: { name: string; namespace: string }): Promise<K8sLeaseRecord>;
  createNamespacedLease(param: { namespace: string; body: K8sLeaseRecord }): Promise<K8sLeaseRecord>;
  replaceNamespacedLease?(param: { name: string; namespace: string; body: K8sLeaseRecord }): Promise<K8sLeaseRecord>;
  deleteNamespacedLease(param: { name: string; namespace: string }): Promise<unknown>;
}

interface K8sLeaseLockProviderOptions {
  namespace?: string;
  leaseApiClient?: K8sLeaseApiClient;
  kubeConfig?: KubeConfig;
  maxAcquireWaitMs?: number;
  retryDelayMs?: number;
}

const K8S_LOCK_NAME_PREFIX = "athena-lock-";
const K8S_DEFAULT_NAMESPACE = "default";
const K8S_NAMESPACE_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/namespace";
const K8S_LOCK_ACQUIRE_RETRY_DELAY_MS = 20;
const K8S_LOCK_ACQUIRE_MAX_WAIT_MS = 250;

export class K8sLeaseLockProvider implements IDistributedLock {
  private namespace: string | undefined;
  private leaseApiClient: K8sLeaseApiClient | undefined;
  private kubeConfig: KubeConfig | undefined;
  private readonly maxAcquireWaitMs: number;
  private readonly retryDelayMs: number;

  constructor(options: K8sLeaseLockProviderOptions = {}) {
    this.namespace = normalizeNamespace(options.namespace ?? process.env.ATHENA_K8S_NAMESPACE);
    this.leaseApiClient = options.leaseApiClient;
    this.kubeConfig = options.kubeConfig;
    this.maxAcquireWaitMs = options.maxAcquireWaitMs ?? K8S_LOCK_ACQUIRE_MAX_WAIT_MS;
    this.retryDelayMs = options.retryDelayMs ?? K8S_LOCK_ACQUIRE_RETRY_DELAY_MS;
  }

  async tryAcquire(request: DistributedLockAcquireRequest): Promise<DistributedLockAcquireResult> {
    if (!Number.isInteger(request.leaseMs) || request.leaseMs <= 0) {
      throw new AthenaError("CONFIG_ERROR", "Distributed lock leaseMs must be a positive integer.");
    }
    const context = this.getClientContext();
    const leaseName = this.resolveLeaseName(request.lockName);
    const token = randomUUID();
    const holderIdentity = this.serializeHolderIdentity(request.ownerId, token);
    const deadlineMs = Date.now() + this.maxAcquireWaitMs;
    while (true) {
      const existing = await this.readLeaseOrUndefined(context.apiClient, context.namespace, leaseName, request.lockName);
      if (existing && !this.shouldReclaimLease(existing)) {
        return { acquired: false };
      }
      if (existing) {
        await this.deleteLease(
          context.apiClient,
          context.namespace,
          leaseName,
          request.lockName,
          "clean up expired lease"
        );
      }
      const nowMs = Date.now();
      const lease = this.buildLease(context.namespace, leaseName, holderIdentity, request.leaseMs, nowMs);
      try {
        await context.apiClient.createNamespacedLease({
          namespace: context.namespace,
          body: lease
        });
        return {
          acquired: true,
          lockName: request.lockName,
          ownerId: request.ownerId,
          token,
          acquiredAt: new Date(nowMs).toISOString(),
          expiresAt: new Date(nowMs + request.leaseMs).toISOString()
        };
      } catch (error) {
        if (!isK8sConflict(error)) {
          throw wrapK8sLockError(error, "acquire", request.lockName);
        }
        if (Date.now() >= deadlineMs) {
          return { acquired: false };
        }
        await delay(this.retryDelayMs);
      }
    }
  }

  async release(request: DistributedLockReleaseRequest): Promise<void> {
    const context = this.getClientContext();
    const leaseName = this.resolveLeaseName(request.lockName);
    const existing = await this.readLeaseOrUndefined(context.apiClient, context.namespace, leaseName, request.lockName);
    if (!existing) {
      return;
    }
    const holderIdentity = this.serializeHolderIdentity(request.ownerId, request.token);
    if (existing.spec?.holderIdentity !== holderIdentity) {
      return;
    }
    await this.deleteLease(context.apiClient, context.namespace, leaseName, request.lockName, "release");
  }

  private buildLease(
    namespace: string,
    leaseName: string,
    holderIdentity: string,
    leaseMs: number,
    nowMs: number
  ): K8sLeaseRecord {
    const now = new Date(nowMs).toISOString();
    return {
      apiVersion: "coordination.k8s.io/v1",
      kind: "Lease",
      metadata: {
        name: leaseName,
        namespace
      },
      spec: {
        holderIdentity,
        leaseDurationSeconds: Math.max(1, Math.ceil(leaseMs / 1_000)),
        acquireTime: now,
        renewTime: now
      }
    };
  }

  private shouldReclaimLease(lease: K8sLeaseRecord): boolean {
    const durationSeconds = lease.spec?.leaseDurationSeconds;
    if (
      durationSeconds === undefined ||
      !Number.isFinite(durationSeconds) ||
      !Number.isInteger(durationSeconds) ||
      durationSeconds <= 0
    ) {
      return true;
    }
    const observedAtMs = this.parseLeaseObservedAtMs(lease);
    if (observedAtMs === undefined) {
      return true;
    }
    return observedAtMs + durationSeconds * 1_000 <= Date.now();
  }

  private parseLeaseObservedAtMs(lease: K8sLeaseRecord): number | undefined {
    const renewMs = parseK8sTimestampMs(lease.spec?.renewTime);
    if (renewMs !== undefined) {
      return renewMs;
    }
    return parseK8sTimestampMs(lease.spec?.acquireTime);
  }

  private resolveLeaseName(lockName: string): string {
    const hash = createHash("sha256").update(lockName).digest("hex").slice(0, 40);
    return `${K8S_LOCK_NAME_PREFIX}${hash}`;
  }

  private serializeHolderIdentity(ownerId: string, token: string): string {
    return `${ownerId}:${token}`;
  }

  private getClientContext(): { apiClient: K8sLeaseApiClient; namespace: string } {
    const apiClient = this.getLeaseApiClient();
    const namespace = this.namespace ?? this.resolveDefaultNamespace();
    return {
      apiClient,
      namespace
    };
  }

  private getLeaseApiClient(): K8sLeaseApiClient {
    if (this.leaseApiClient) {
      return this.leaseApiClient;
    }
    this.kubeConfig ??= this.createKubeConfig();
    this.leaseApiClient = this.kubeConfig.makeApiClient(CoordinationV1Api);
    return this.leaseApiClient;
  }

  private createKubeConfig(): KubeConfig {
    try {
      const kubeConfig = new KubeConfig();
      kubeConfig.loadFromDefault();
      return kubeConfig;
    } catch (error) {
      throw new AthenaError(
        "CONFIG_ERROR",
        "Failed to initialize Kubernetes client for ATHENA_DISTRIBUTED_LOCK_PROVIDER=k8s-lease.",
        true,
        error
      );
    }
  }

  private resolveDefaultNamespace(): string {
    const fromServiceAccount = readNamespaceFromServiceAccount();
    if (fromServiceAccount) {
      this.namespace = fromServiceAccount;
      return fromServiceAccount;
    }
    const currentContextName = this.kubeConfig?.getCurrentContext();
    const context = currentContextName ? this.kubeConfig?.getContextObject(currentContextName) : null;
    const fromContext = normalizeNamespace(context?.namespace);
    if (fromContext) {
      this.namespace = fromContext;
      return fromContext;
    }
    this.namespace = K8S_DEFAULT_NAMESPACE;
    return K8S_DEFAULT_NAMESPACE;
  }

  private async readLeaseOrUndefined(
    apiClient: K8sLeaseApiClient,
    namespace: string,
    leaseName: string,
    lockName: string
  ): Promise<K8sLeaseRecord | undefined> {
    try {
      return await apiClient.readNamespacedLease({
        name: leaseName,
        namespace
      });
    } catch (error) {
      if (isK8sNotFound(error)) {
        return undefined;
      }
      throw wrapK8sLockError(error, "read", lockName);
    }
  }

  private async deleteLease(
    apiClient: K8sLeaseApiClient,
    namespace: string,
    leaseName: string,
    lockName: string,
    action: string
  ): Promise<void> {
    try {
      await apiClient.deleteNamespacedLease({
        name: leaseName,
        namespace
      });
    } catch (error) {
      if (isK8sNotFound(error)) {
        return;
      }
      throw wrapK8sLockError(error, action, lockName);
    }
  }
}

function normalizeNamespace(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function readNamespaceFromServiceAccount(): string | undefined {
  if (!existsSync(K8S_NAMESPACE_PATH)) {
    return undefined;
  }
  try {
    return normalizeNamespace(readFileSync(K8S_NAMESPACE_PATH, "utf8"));
  } catch {
    return undefined;
  }
}

function parseK8sTimestampMs(value: unknown): number | undefined {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function getK8sErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const record = error as Record<string, unknown>;
  if (typeof record.code === "number") {
    return record.code;
  }
  if (typeof record.statusCode === "number") {
    return record.statusCode;
  }
  return undefined;
}

function isK8sNotFound(error: unknown): boolean {
  return getK8sErrorCode(error) === 404;
}

function isK8sConflict(error: unknown): boolean {
  return getK8sErrorCode(error) === 409;
}

function wrapK8sLockError(error: unknown, action: string, lockName: string): AthenaError {
  return new AthenaError(
    "SESSION_IO_ERROR",
    `Failed to ${action} distributed lock via Kubernetes Lease for ${lockName}.`,
    true,
    error
  );
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
