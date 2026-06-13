import { describe, expect, it } from "vitest";
import { LocalGovernanceAuditService } from "../src/control-plane/services/governance-audit.js";
import type { EventQuery, EventQueryResult, EventRecord } from "../src/shared/contracts.js";

describe("governance audit taxonomy", () => {
  it("maps representative audit events across enterprise categories", async () => {
    const events: EventRecord[] = [
      event("evt-authz", "authz.denied", {
        subject: "viewer-user",
        role: "Viewer",
        operation: "taskWorkbench.runTask",
        denyReason: "ROLE_MISSING"
      }),
      event("evt-provider", "run.completed", {
        provider: "openai",
        model: "gpt-4.1-mini",
        harnessProfileId: "profile-1"
      }),
      event("evt-secret", "secret.read", {
        reference: {
          kind: "local-file",
          name: "/tmp/provider.key"
        },
        purpose: "model-provider.runtime",
        subject: "operator",
        resourceId: "provider-openai"
      }),
      event("evt-workflow", "workflow.step.completed", {
        runId: "workflow-run-1",
        stepId: "review",
        status: "completed"
      }),
      event("evt-connector", "connector.write.approval_evaluated", {
        serviceId: "github",
        operationId: "pull-request.comment",
        operationClass: "external-write",
        status: "approved"
      }),
      event("evt-jira", "connector.issue.read", {
        serviceId: "jira.atlassian.com",
        operationId: "issue-read",
        operationClass: "read",
        status: "completed",
        issueKey: "ENG-1842"
      }),
      event("evt-artifact", "artifact.created", {
        artifactId: "artifact-summary",
        runId: "run-1",
        storageUri: "memory://task/run-1/summary.md",
        format: "markdown"
      }),
      event("evt-memory", "memory.proposal.created", {
        proposalId: "proposal-1",
        memoryType: "artifact-summary",
        status: "pending",
        runId: "run-1"
      }),
      event("evt-evidence", "evidence-bundle.exported", {
        actor: {
          subject: "operator",
          role: "Operator"
        },
        runId: "run-1",
        taskId: "task-1",
        bundleId: "evidence-bundle-run-1",
        destinationKind: "api-response",
        bundleChecksum: {
          algorithm: "sha256",
          value: "a".repeat(64)
        }
      })
    ];
    const service = new LocalGovernanceAuditService(fakeEventService(events));

    const result = await service.list({ limit: 20 });

    expect(result.items.map((item) => item.category)).toEqual(
      expect.arrayContaining([
        "identity",
        "provider",
        "secret-reference",
        "task-workflow",
        "connector",
        "artifact",
        "memory",
        "evidence"
      ])
    );
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "secret-reference",
          action: "secret.read",
          actor: { subject: "operator" },
          summary: "Secret reference read for model-provider.runtime."
        }),
        expect.objectContaining({
          category: "evidence",
          summary: "Evidence bundle exported: evidence-bundle-run-1.",
          actor: { subject: "operator", role: "Operator" }
        }),
        expect.objectContaining({
          category: "connector",
          action: "connector.issue.read",
          summary: "Connector event connector.issue.read recorded for jira.atlassian.com."
        })
      ])
    );
    const secretEntry = result.items.find((item) => item.category === "secret-reference");
    expect(secretEntry?.diffs.map((diff) => diff.key)).not.toContain("reference.name");
    expect(JSON.stringify(result.items)).not.toContain("/tmp/provider.key");
  });

  it("filters expanded categories before mapping", async () => {
    const service = new LocalGovernanceAuditService(
      fakeEventService([
        event("evt-policy", "policy.updated", { updatedBy: "admin", policy: { maxConcurrentRuns: 2 } }),
        event("evt-memory", "memory.search", { runId: "run-1", resultCount: 3 })
      ])
    );

    const result = await service.list({ categories: ["memory"], limit: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      category: "memory",
      action: "memory.search"
    });
  });

  it("applies combined subject, resource, workspace, date, category, and run filters", async () => {
    const service = new LocalGovernanceAuditService(
      fakeEventService([
        event("evt-other", "evidence-bundle.exported", {
          actor: { subject: "other-operator", role: "Operator" },
          runId: "run-other",
          taskId: "task-other",
          workspaceId: "workspace-1",
          bundleId: "bundle-other",
          destinationKind: "api-response"
        }),
        event("evt-target", "evidence-bundle.exported", {
          actor: { subject: "operator", role: "Operator" },
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          bundleId: "bundle-1",
          destinationKind: "api-response"
        }),
        event("evt-wrong-workspace", "evidence-bundle.exported", {
          actor: { subject: "operator", role: "Operator" },
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-2",
          bundleId: "bundle-1",
          destinationKind: "api-response"
        })
      ])
    );

    const result = await service.list({
      categories: ["evidence"],
      subject: "operator",
      resourceId: "bundle-1",
      workspaceId: "workspace-1",
      runId: "run-1",
      createdAfter: "2026-02-15T00:00:00.000Z",
      createdBefore: "2026-02-17T00:00:00.000Z",
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      eventId: "evt-target",
      category: "evidence",
      actor: { subject: "operator", role: "Operator" }
    });
  });

  it("exports filtered audit entries as JSONL and CSV while auditing the export", async () => {
    const emitted: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const service = new LocalGovernanceAuditService(
      fakeEventService(
        [
          event("evt-secret", "secret.read", {
            reference: {
              kind: "local-file",
              name: "/tmp/provider.key"
            },
            purpose: "model-provider.runtime",
            subject: "operator",
            resourceId: "provider-openai"
          }),
          event("evt-memory", "memory.search", { runId: "run-1", resultCount: 3 })
        ],
        emitted
      )
    );

    const jsonl = await service.exportJsonl({ categories: ["secret-reference"], subject: "operator", resourceId: "provider-openai" });
    const csv = await service.exportCsv({ categories: ["secret-reference"], subject: "operator", resourceId: "provider-openai" });

    const row = JSON.parse(jsonl.trim()) as { category: string; action: string };
    expect(row).toMatchObject({
      category: "secret-reference",
      action: "secret.read"
    });
    expect(csv.split(/\r?\n/)[0]).toBe("id,eventId,category,action,timestamp,actorSubject,actorRole,summary,reason,diffsJson");
    expect(csv).toContain("secret-reference");
    expect(jsonl).not.toContain("/tmp/provider.key");
    expect(csv).not.toContain("/tmp/provider.key");
    expect(emitted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "governance.audit.exported",
          payload: expect.objectContaining({
            format: "jsonl",
            itemCount: 1,
            filters: expect.objectContaining({
              subject: "operator",
              resourceId: "provider-openai"
            })
          })
        }),
        expect.objectContaining({
          type: "governance.audit.exported",
          payload: expect.objectContaining({
            format: "csv",
            itemCount: 1
          })
        })
      ])
    );
  });
});

function event(id: string, type: string, payload: Record<string, unknown>): EventRecord {
  return {
    id,
    traceId: `trace-${id}`,
    type,
    createdAt: "2026-02-16T00:00:00.000Z",
    ...(typeof payload.runId === "string" ? { runId: payload.runId } : {}),
    ...(typeof payload.taskId === "string" ? { taskId: payload.taskId } : {}),
    payload
  };
}

function fakeEventService(events: EventRecord[], emitted: Array<{ type: string; payload: Record<string, unknown> }> = []) {
  return {
    async emit(event: { type: string; payload: Record<string, unknown> }): Promise<void> {
      emitted.push(event);
    },
    async list(query: EventQuery = {}): Promise<EventQueryResult> {
      const filtered = events.filter((item) => {
        if (query.types?.length && !query.types.includes(item.type)) {
          return false;
        }
        if (query.createdAfter && item.createdAt < query.createdAfter) {
          return false;
        }
        if (query.createdBefore && item.createdAt > query.createdBefore) {
          return false;
        }
        return true;
      });
      return { events: filtered.slice(0, query.limit ?? filtered.length) };
    }
  };
}
