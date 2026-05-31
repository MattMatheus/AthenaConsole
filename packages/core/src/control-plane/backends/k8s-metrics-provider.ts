import { CoreV1Api, CustomObjectsApi, KubeConfig, type V1Pod } from "@kubernetes/client-node";
import type { BackendOperationsMetricsSnapshot, ExecutionBackend } from "../backends.js";
import { computeOperationsHealthMetrics, type IOperationsMetricsProvider } from "./operations-metrics-provider.js";

const DEFAULT_AGENT_LABEL_SELECTOR = "app.kubernetes.io/component=athena-agent";
const K8S_METRICS_GROUP = "metrics.k8s.io";
const K8S_METRICS_VERSION = "v1beta1";
const K8S_PODS_RESOURCE = "pods";

interface K8sPodApiClient {
  listPodForAllNamespaces(param?: {
    labelSelector?: string;
  }): Promise<{
    items?: V1Pod[];
  }>;
  listNamespacedPod?(param: {
    namespace: string;
    labelSelector?: string;
  }): Promise<{
    items?: V1Pod[];
  }>;
}

interface K8sPodMetricsApiClient {
  listClusterCustomObject(param: {
    group: string;
    version: string;
    plural: string;
    labelSelector?: string;
  }): Promise<unknown>;
  listNamespacedCustomObject?(
    param: {
      group: string;
      version: string;
      namespace: string;
      plural: string;
      labelSelector?: string;
    }
  ): Promise<unknown>;
}

interface K8sPodMetricsItem {
  metadata?: {
    name?: string;
    namespace?: string;
  };
  containers?: Array<{
    usage?: {
      cpu?: string;
      memory?: string;
    };
  }>;
}

export interface K8sMetricsProviderOptions {
  podApiClient?: K8sPodApiClient;
  podMetricsApiClient?: K8sPodMetricsApiClient;
  podLabelSelector?: string;
  namespace?: string;
}

export class K8sMetricsProvider implements IOperationsMetricsProvider {
  readonly source = "k8s" as const;
  private readonly podLabelSelector: string;
  private readonly namespace: string | undefined;
  private podApiClient: K8sPodApiClient | undefined;
  private podMetricsApiClient: K8sPodMetricsApiClient | undefined;

  constructor(
    private readonly backend: ExecutionBackend,
    options: K8sMetricsProviderOptions = {}
  ) {
    this.podLabelSelector =
      options.podLabelSelector ?? process.env.ATHENA_K8S_AGENT_LABEL_SELECTOR ?? DEFAULT_AGENT_LABEL_SELECTOR;
    this.namespace = options.namespace ?? process.env.ATHENA_K8S_NAMESPACE;
    this.podApiClient = options.podApiClient;
    this.podMetricsApiClient = options.podMetricsApiClient;
  }

  async getCapabilities(): Promise<{ supportsPodStatus: boolean; supportsCpuMemMetrics: boolean }> {
    return {
      supportsPodStatus: true,
      supportsCpuMemMetrics: await this.canQueryPodMetricsApi()
    };
  }

  async getMetrics() {
    try {
      const pods = await this.listAgentPods();
      const summary = this.mapPodsToOperationsSummary(pods);
      try {
        const podMetrics = await this.listAgentPodMetrics();
        const resources = this.aggregatePodResourceUsage(podMetrics, pods);
        return {
          ...summary,
          ...resources
        };
      } catch {
        return summary;
      }
    } catch {
      const snapshot = await this.readSnapshot();
      const running = snapshot.runs.active;
      const pending = snapshot.runs.cancellationRequested;
      const total = running + pending;
      return {
        total,
        running,
        pending,
        succeeded: 0,
        failed: 0,
        ...computeOperationsHealthMetrics({
          total,
          failed: 0
        })
      };
    }
  }

  private async listAgentPods(): Promise<V1Pod[]> {
    const podApiClient = this.getPodApiClient();
    if (this.namespace && podApiClient.listNamespacedPod) {
      const podList = await podApiClient.listNamespacedPod({
        namespace: this.namespace,
        labelSelector: this.podLabelSelector
      });
      return podList.items ?? [];
    }
    const podList = await podApiClient.listPodForAllNamespaces({
      labelSelector: this.podLabelSelector
    });
    return podList.items ?? [];
  }

  private async listAgentPodMetrics(): Promise<K8sPodMetricsItem[]> {
    const podMetricsApiClient = this.getPodMetricsApiClient();
    const response =
      this.namespace && podMetricsApiClient.listNamespacedCustomObject
        ? await podMetricsApiClient.listNamespacedCustomObject({
            group: K8S_METRICS_GROUP,
            version: K8S_METRICS_VERSION,
            namespace: this.namespace,
            plural: K8S_PODS_RESOURCE,
            labelSelector: this.podLabelSelector
          })
        : await podMetricsApiClient.listClusterCustomObject({
            group: K8S_METRICS_GROUP,
            version: K8S_METRICS_VERSION,
            plural: K8S_PODS_RESOURCE,
            labelSelector: this.podLabelSelector
          });

    return this.extractCustomObjectItems(response);
  }

  private async canQueryPodMetricsApi(): Promise<boolean> {
    try {
      await this.listAgentPodMetrics();
      return true;
    } catch {
      return false;
    }
  }

  private mapPodsToOperationsSummary(pods: V1Pod[]) {
    let pending = 0;
    let running = 0;
    let succeeded = 0;
    let failed = 0;

    for (const pod of pods) {
      const phase = pod.status?.phase;
      if (phase === "Pending") {
        pending += 1;
      } else if (phase === "Running") {
        running += 1;
      } else if (phase === "Succeeded") {
        succeeded += 1;
      } else if (phase === "Failed") {
        failed += 1;
      }
    }

    return {
      total: pods.length,
      running,
      pending,
      succeeded,
      failed,
      ...computeOperationsHealthMetrics({
        total: pods.length,
        failed
      })
    };
  }

  private aggregatePodResourceUsage(podMetrics: K8sPodMetricsItem[], pods: V1Pod[]) {
    const matchedPodIds = new Set<string>();
    for (const pod of pods) {
      const podName = pod.metadata?.name;
      if (!podName) {
        continue;
      }
      const podNamespace = pod.metadata?.namespace ?? this.namespace ?? "";
      matchedPodIds.add(`${podNamespace}/${podName}`);
    }

    let cpuUsage = 0;
    let memoryUsage = 0;
    for (const podMetric of podMetrics) {
      const podName = podMetric.metadata?.name;
      if (!podName) {
        continue;
      }
      const podNamespace = podMetric.metadata?.namespace ?? this.namespace ?? "";
      const podId = `${podNamespace}/${podName}`;
      if (matchedPodIds.size > 0 && !matchedPodIds.has(podId)) {
        continue;
      }
      for (const container of podMetric.containers ?? []) {
        const parsedCpu = parseCpuQuantity(container.usage?.cpu);
        if (parsedCpu !== undefined) {
          cpuUsage += parsedCpu;
        }
        const parsedMemory = parseMemoryQuantity(container.usage?.memory);
        if (parsedMemory !== undefined) {
          memoryUsage += parsedMemory;
        }
      }
    }

    return {
      cpuUsage,
      memoryUsage
    };
  }

  private getPodApiClient(): K8sPodApiClient {
    if (!this.podApiClient) {
      const kubeConfig = new KubeConfig();
      kubeConfig.loadFromDefault();
      this.podApiClient = kubeConfig.makeApiClient(CoreV1Api);
    }
    return this.podApiClient;
  }

  private getPodMetricsApiClient(): K8sPodMetricsApiClient {
    if (!this.podMetricsApiClient) {
      const kubeConfig = new KubeConfig();
      kubeConfig.loadFromDefault();
      this.podMetricsApiClient = kubeConfig.makeApiClient(CustomObjectsApi);
    }
    return this.podMetricsApiClient;
  }

  private extractCustomObjectItems(value: unknown): K8sPodMetricsItem[] {
    const response = value as { items?: unknown[]; body?: { items?: unknown[] } };
    const items = response.items ?? response.body?.items;
    if (!Array.isArray(items)) {
      return [];
    }
    return items as K8sPodMetricsItem[];
  }

  private async readSnapshot(): Promise<BackendOperationsMetricsSnapshot> {
    const backendMetrics = await this.backend.getOperationsMetrics?.();
    if (backendMetrics) {
      return backendMetrics;
    }
    return {
      supportsPods: false,
      supportsCpuMemMetrics: false,
      runs: {
        active: 0,
        cancellationRequested: 0
      }
    };
  }
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
  const match = /^([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)([A-Za-z]*)$/.exec(quantity.trim());
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
