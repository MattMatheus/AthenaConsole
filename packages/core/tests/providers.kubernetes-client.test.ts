import { describe, expect, it } from "vitest";
import { CoreV1Api, KubeConfig } from "@kubernetes/client-node";

describe("kubernetes client library", () => {
  it("imports and configures KubeConfig without cluster access", () => {
    const kubeConfig = new KubeConfig();
    kubeConfig.loadFromOptions({
      clusters: [
        {
          name: "test-cluster",
          server: "https://example.invalid",
          skipTLSVerify: true
        }
      ],
      users: [
        {
          name: "test-user",
          token: "fake-token"
        }
      ],
      contexts: [
        {
          name: "test-context",
          cluster: "test-cluster",
          user: "test-user"
        }
      ],
      currentContext: "test-context"
    });

    const apiClient = kubeConfig.makeApiClient(CoreV1Api);

    expect(kubeConfig.getCurrentCluster()?.server).toBe("https://example.invalid");
    expect(kubeConfig.getCurrentUser()?.name).toBe("test-user");
    expect(apiClient).toBeDefined();
  });
});
