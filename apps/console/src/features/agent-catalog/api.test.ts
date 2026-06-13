import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAgentCatalogAgents, fetchAgentCatalogPlugins } from "./api";

describe("agent catalog api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes connector readiness without carrying credential references", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              total: 1,
              plugins: [
                {
                  id: "team-orchestrator.test.connector",
                  version: "0.1.0",
                  path: "/tmp/plugin",
                  enabled: true,
                  status: "certified",
                  sourceType: "local",
                  sourceScope: "workspace",
                  metadata: {
                    name: "Connector Pack",
                    connectorReadiness: {
                      status: "missing-scopes",
                      serviceId: "fixture.service",
                      serviceName: "Fixture Service",
                      credentialState: "bound",
                      requiredScopes: ["fixture:read", "fixture:write"],
                      missingScopes: ["fixture:write"],
                      rateLimitedOperations: [],
                      reasons: ["Missing required connector scopes: fixture:write."],
                      nextStep: "Update the credential binding or service authorization to include the required scopes.",
                      bindingRef: "local-file:/run/secrets/athena/fixture-token"
                    }
                  },
                  validationErrors: [],
                  agentCount: 1,
                  createdAt: "2026-06-12T00:00:00.000Z",
                  updatedAt: "2026-06-12T00:00:00.000Z"
                }
              ]
            }
          }),
        ),
      ),
    );

    const result = await fetchAgentCatalogPlugins();

    expect(result.plugins[0]?.metadata.connectorReadiness).toEqual({
      status: "missing-scopes",
      serviceId: "fixture.service",
      serviceName: "Fixture Service",
      credentialState: "bound",
      requiredScopes: ["fixture:read", "fixture:write"],
      missingScopes: ["fixture:write"],
      rateLimitedOperations: [],
      reasons: ["Missing required connector scopes: fixture:write."],
      nextStep: "Update the credential binding or service authorization to include the required scopes."
    });
    expect(JSON.stringify(result)).not.toContain("local-file:/run/secrets/athena");
  });

  it("normalizes agent certification links", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              total: 1,
              agents: [
                {
                  id: "bundled.certified.agent",
                  version: "0.1.0",
                  name: "Certified Agent",
                  plugin: {
                    id: "team-orchestrator.bundled.certified",
                    version: "0.1.0",
                    name: "Certified Pack",
                    sourceType: "system",
                    sourceScope: "system",
                    enabled: true,
                    status: "loaded"
                  },
                  capabilities: ["repo.summary"],
                  status: "certified",
                  available: true,
                  providerReadiness: {
                    status: "untested",
                    required: false,
                    requirements: [],
                    message: "No model provider requirement declared."
                  },
                  certification: {
                    status: "certified",
                    required: true,
                    declaredMaturity: "certified",
                    effectiveMaturity: "certified",
                    evalRunId: "eval-run-1",
                    evalResultIds: ["eval-result-1"],
                    expectedArtifactUris: ["fixture://expected.md"],
                    actualArtifactUris: ["memory://actual.md"],
                    securityOwner: "security@example.test",
                    ownershipRecord: "docs://ownership/certified-agent.md",
                    evidenceLinks: [
                      {
                        kind: "security-owner",
                        uri: "owner:security@example.test",
                        label: "Security"
                      }
                    ],
                    reasons: [],
                    message: "Certified.",
                    secret: "do-not-carry"
                  },
                  metadata: {},
                  validationErrors: [],
                  createdAt: "2026-06-12T00:00:00.000Z",
                  updatedAt: "2026-06-12T00:00:00.000Z"
                }
              ],
              filters: {}
            }
          }),
        ),
      ),
    );

    const result = await fetchAgentCatalogAgents();

    expect(result.agents[0]?.certification).toEqual({
      status: "certified",
      required: true,
      declaredMaturity: "certified",
      effectiveMaturity: "certified",
      evalRunId: "eval-run-1",
      evalResultIds: ["eval-result-1"],
      expectedArtifactUris: ["fixture://expected.md"],
      actualArtifactUris: ["memory://actual.md"],
      securityOwner: "security@example.test",
      ownershipRecord: "docs://ownership/certified-agent.md",
      evidenceLinks: [
        {
          kind: "security-owner",
          uri: "owner:security@example.test",
          label: "Security"
        }
      ],
      reasons: [],
      message: "Certified."
    });
    expect(JSON.stringify(result)).not.toContain("do-not-carry");
  });
});
