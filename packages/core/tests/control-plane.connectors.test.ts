import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import {
  evaluateConnectorReadiness,
  evaluateExternalWriteApproval,
  getConnectorCredentialBinding,
  redactConnectorAuditContext,
  upsertConnectorCredentialBinding,
  type ConnectorMetadata
} from "../src/control-plane/connectors.js";
import { loadConfig } from "../src/shared/config.js";

describe("connector platform primitives", () => {
  it("persists non-secret credential binding metadata and resolves readiness scopes", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-connectors-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        const binding = upsertConnectorCredentialBinding(appState, {
          pluginId: "team-orchestrator.test.connector",
          pluginVersion: "0.1.0",
          serviceId: "fixture.service",
          bindingRef: "local-file:/run/secrets/athena/fixture-token",
          displayName: "Fixture token",
          scopes: ["fixture:read"],
          now: new Date("2026-06-02T00:00:00.000Z")
        });

        expect(binding).toMatchObject({
          serviceId: "fixture.service",
          displayName: "Fixture token",
          scopes: ["fixture:read"],
          status: "bound"
        });
        expect(binding).not.toHaveProperty("secretValue");

        const loaded = getConnectorCredentialBinding(
          appState,
          "team-orchestrator.test.connector",
          "0.1.0",
          "fixture.service"
        );
        expect(loaded).toMatchObject({ bindingRef: "local-file:/run/secrets/athena/fixture-token" });

        const readiness = evaluateConnectorReadiness({
          pluginId: "team-orchestrator.test.connector",
          pluginVersion: "0.1.0",
          connector: connectorFixture(),
          binding
        });

        expect(readiness.status).toBe("missing-scopes");
        expect(readiness.missingScopes).toEqual(["fixture:write"]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports configured, missing credential, missing scope, rate-limited, degraded, and blocked readiness states", () => {
    const connector = connectorFixture();
    const binding = {
      pluginId: "team-orchestrator.test.connector",
      pluginVersion: "0.1.0",
      serviceId: "fixture.service",
      bindingRef: "local-file:/run/secrets/athena/fixture-token",
      scopes: ["fixture:read", "fixture:write"],
      status: "bound",
      createdAt: "2026-06-02T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z"
    };

    expect(evaluateConnectorReadiness({ pluginId: "p", pluginVersion: "1", connector, binding }).status).toBe("configured");
    expect(evaluateConnectorReadiness({ pluginId: "p", pluginVersion: "1", connector }).status).toBe("missing-credentials");
    expect(
      evaluateConnectorReadiness({
        pluginId: "p",
        pluginVersion: "1",
        connector,
        binding: { ...binding, scopes: ["fixture:read"] }
      }).status
    ).toBe("missing-scopes");
    expect(
      evaluateConnectorReadiness({
        pluginId: "p",
        pluginVersion: "1",
        connector,
        binding,
        rateLimitedOperationIds: ["create-record"]
      }).status
    ).toBe("rate-limited");
    expect(evaluateConnectorReadiness({ pluginId: "p", pluginVersion: "1", connector, binding, degraded: true }).status).toBe(
      "degraded"
    );
    expect(
      evaluateConnectorReadiness({
        pluginId: "p",
        pluginVersion: "1",
        connector,
        binding,
        blockedReasons: ["Connector disabled by policy."]
      }).status
    ).toBe("blocked");
  });

  it("fails closed for unknown or unapproved external write operations", () => {
    const connector = connectorFixture();
    expect(evaluateExternalWriteApproval({ connector, operationId: "list-records" })).toMatchObject({
      requiresApproval: false,
      blocked: false
    });
    expect(evaluateExternalWriteApproval({ connector, operationId: "create-record" })).toMatchObject({
      requiresApproval: true,
      approved: false,
      blocked: true,
      riskClass: "external-write"
    });
    expect(
      evaluateExternalWriteApproval({
        connector,
        operationId: "create-record",
        approvalEvidence: { approved: true, approvalId: "approval-1", approvedBy: "operator" }
      })
    ).toMatchObject({
      requiresApproval: true,
      approved: true,
      blocked: false
    });
    expect(evaluateExternalWriteApproval({ connector, operationId: "unknown-operation" })).toMatchObject({
      operationClass: "external-write",
      requiresApproval: true,
      blocked: true
    });
  });

  it("redacts secret-shaped audit context keys", () => {
    expect(
      redactConnectorAuditContext({
        serviceId: "fixture.service",
        bindingRef: "local-file:/run/secrets/athena/fixture-token",
        token: "secret-token"
      })
    ).toEqual({
      serviceId: "fixture.service",
      bindingRef: "[redacted]",
      token: "[redacted]"
    });
  });
});

function connectorFixture(): ConnectorMetadata {
  return {
    service: {
      id: "fixture.service",
      name: "Fixture Service"
    },
    auth: {
      type: "api-token",
      credentialBinding: "required"
    },
    scopes: [
      {
        id: "fixture:read",
        label: "Read fixture records",
        required: true,
        access: "read"
      },
      {
        id: "fixture:write",
        label: "Write fixture records",
        required: true,
        access: "write"
      }
    ],
    operations: [
      {
        id: "list-records",
        class: "read",
        scopes: ["fixture:read"]
      },
      {
        id: "create-record",
        class: "external-write",
        scopes: ["fixture:write"],
        approvalRequired: true
      }
    ]
  };
}
