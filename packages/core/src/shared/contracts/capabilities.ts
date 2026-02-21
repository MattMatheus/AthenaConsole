export interface CapabilitySet {
  executionBackend: "local" | "k8s";
  stateStore: "file" | "remote";
  supportsPods: boolean;
  supportsCpuMemMetrics: boolean;
  supportsSandbox: boolean;
  supportsA2ABus: boolean;
}
