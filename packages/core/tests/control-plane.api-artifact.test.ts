import { describe, expect, it } from "vitest";
import { buildApiContractArtifact } from "../src/control-plane/api-artifact.js";
import { API_V1_ROUTES } from "../src/control-plane/api-contracts.js";

describe("control-plane api artifact", () => {
  it("builds an OpenAPI-style artifact with per-route schemas", () => {
    const artifact = buildApiContractArtifact(new Date("2026-02-16T00:00:00.000Z"));

    expect(artifact.schemaVersion).toBe(2);
    expect(artifact.routeCount).toBe(API_V1_ROUTES.length);
    expect(artifact.openapi.openapi).toBe("3.1.0");
    expect(artifact.openapi.paths["/api/v1/runs"]?.post?.operationId).toBe("createRun");
    expect(artifact.openapi.paths["/api/v1/runs/active"]?.get?.operationId).toBe("listActiveRuns");
    expect(artifact.openapi.paths["/api/v1/runs/cancel-requests"]?.get?.operationId).toBe("listCancellationRequests");
    expect(artifact.openapi.paths["/api/v1/runs/{sessionId}/cancel"]?.post?.operationId).toBe("cancelRun");
    expect(artifact.openapi.paths["/api/v1/run-control/by-run/{runId}/cancel"]?.post?.operationId).toBe("cancelRunByRunId");
    expect(artifact.openapi.paths["/api/v1/runs"]?.post?.requestBody).toBeDefined();
    expect(artifact.openapi.paths["/api/v1/directives"]?.get?.operationId).toBe("listDirectives");
    expect(artifact.openapi.paths["/api/v1/directives"]?.post?.operationId).toBe("createDirective");
    expect(artifact.openapi.paths["/api/v1/harness-profiles"]?.get?.operationId).toBe("listHarnessProfiles");
    expect(artifact.openapi.paths["/api/v1/harness-profiles"]?.post?.operationId).toBe("createHarnessProfile");
    expect(artifact.openapi.paths["/api/v1/run-templates"]?.get?.operationId).toBe("listRunTemplates");
    expect(artifact.openapi.paths["/api/v1/run-templates"]?.post?.operationId).toBe("createRunTemplate");
    expect(artifact.openapi.paths["/api/v1/templates/{id}/run"]?.post?.operationId).toBe("runTemplate");
    expect(artifact.openapi.paths["/api/v1/workflows"]?.get?.operationId).toBe("listWorkflows");
    expect(artifact.openapi.paths["/api/v1/workflows"]?.post?.operationId).toBe("createWorkflow");
    expect(artifact.openapi.paths["/api/v1/workflows/run/{id}"]?.get?.operationId).toBe("getWorkflowRun");
    expect(artifact.openapi.paths["/api/v1/workflows/run/{id}/resume"]?.post?.operationId).toBe("resumeWorkflow");
    expect(artifact.openapi.paths["/api/v1/workflows/run/{id}"]?.get?.deprecated).toBe(true);
    expect(artifact.openapi.paths["/api/v1/workflows/run/{id}"]?.get?.["x-athena-surface"]).toBe(
      "legacy-file-backed-workflow"
    );
    expect(artifact.openapi.paths["/api/v1/workflows/run/{id}"]?.get?.["x-athena-canonicalPath"]).toBe(
      "/api/v1/workflow-runs/:runId/status"
    );
    expect(artifact.openapi.paths["/api/v1/workflow-runs/{runId}/status"]?.get?.["x-athena-surface"]).toBe("canonical");
    expect(artifact.openapi.paths["/api/v1/work/observability"]?.get?.operationId).toBe("getA2aObservability");
    expect(artifact.openapi.paths["/api/v1/work/observability/alerts"]?.get?.operationId).toBe("listA2aObservabilityAlerts");
    expect(artifact.openapi.paths["/api/v1/work/observability/alerts/export.csv"]?.get?.operationId).toBe(
      "exportA2aObservabilityAlertsCsv"
    );
    expect(artifact.openapi.paths["/api/v1/work/flows/{traceId}"]?.get?.operationId).toBe("getA2aFlowGraph");
    expect(artifact.openapi.paths["/api/v1/sessions/search"]?.get?.operationId).toBe("searchSessions");
    expect(artifact.openapi.paths["/api/v1/sessions/{id}/artifacts"]?.get?.operationId).toBe("listSessionArtifacts");
    expect(artifact.openapi.paths["/api/v1/sessions/{id}/artifacts/{runId}/{artifactId}"]?.get?.operationId).toBe(
      "getSessionArtifact"
    );
    expect(artifact.openapi.paths["/api/v1/sessions/{id}/transcript/stream"]?.get?.operationId).toBe(
      "streamSessionTranscript"
    );
    expect(artifact.openapi.paths["/api/v1/events"]?.get?.responses).toBeDefined();
    expect(artifact.openapi.paths["/api/v1/events/stream"]?.get?.responses).toBeDefined();
    expect(artifact.openapi.paths["/api/v1/rejections"]?.get?.responses).toBeDefined();
    expect(artifact.openapi.paths["/api/v1/policy/rejections"]?.get?.responses).toBeDefined();
    expect(artifact.openapi.paths["/api/v1/rbac/roles"]?.get?.operationId).toBe("listRbacRoles");
    expect(artifact.openapi.paths["/api/v1/rbac/assignments"]?.get?.operationId).toBe("listIdentityRoleAssignments");
    expect(artifact.openapi.paths["/api/v1/rbac/assignments/{subject}"]?.put?.operationId).toBe("upsertIdentityRoleAssignment");
    expect(artifact.openapi.paths["/api/v1/rbac/assignments/{subject}"]?.delete?.operationId).toBe(
      "deleteIdentityRoleAssignment"
    );
    expect(artifact.openapi.paths["/api/v1/rbac/audit/{subject}"]?.get?.operationId).toBe("auditIdentityPermissions");
    expect(artifact.openapi.paths["/api/v1/governance/audit-trail"]?.get?.operationId).toBe("listGovernanceAuditTrail");
    expect(artifact.openapi.components.schemas.RunResult).toBeDefined();
    expect(artifact.openapi.components.schemas.RunRejectionEvent).toBeDefined();
    expect(artifact.openapi.components.schemas.RbacRoleDefinition).toBeDefined();
    expect(artifact.openapi.components.schemas.IdentityRoleAssignment).toBeDefined();
    expect(artifact.openapi.components.schemas.IdentityRoleAuditResult).toBeDefined();
    expect(artifact.openapi.components.schemas.GovernanceAuditHistoryResult).toBeDefined();
    const recordSchema = artifact.openapi.components.schemas.PolicyConcurrencyRejectionRecord as {
      properties?: {
        reason?: { enum?: string[] };
        policy?: {
          properties?: {
            engine?: { enum?: string[] };
            ruleType?: { enum?: string[] };
          };
        };
        event?: {
          required?: string[];
          properties?: {
            policyType?: { enum?: string[] };
            reason?: { enum?: string[] };
            policy?: {
              properties?: {
                engine?: { enum?: string[] };
                ruleType?: { enum?: string[] };
              };
            };
          };
        };
      };
    };
    expect(recordSchema.properties?.reason?.enum).toEqual([
      "max-concurrent-runs-exceeded",
      "lock-acquisition-failed"
    ]);
    expect(recordSchema.properties?.event?.required).toContain("schemaVersion");
    expect(recordSchema.properties?.event?.properties?.policyType?.enum).toEqual(["CONCURRENCY"]);
    expect(recordSchema.properties?.event?.properties?.reason?.enum).toEqual([
      "max-concurrent-runs-exceeded",
      "lock-acquisition-failed"
    ]);
    expect(recordSchema.properties?.policy?.properties?.engine?.enum).toEqual(["athena", "kyverno"]);
    expect(recordSchema.properties?.policy?.properties?.ruleType?.enum).toEqual([
      "concurrency",
      "validate",
      "mutate",
      "generate"
    ]);
    expect(recordSchema.properties?.event?.properties?.policy?.properties?.engine?.enum).toEqual(["athena", "kyverno"]);
  });
});
