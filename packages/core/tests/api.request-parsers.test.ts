import { describe, expect, it } from "vitest";
import { URL } from "node:url";
import {
  parseA2aFlowGraphQuery,
  parseA2aObservabilityQuery,
  parseA2aStallAlertCsvExportQuery,
  parseA2aStallAlertHistoryQuery,
  parseCreateDirectiveRequest,
  parseCreateHarnessProfileRequest,
  parseCreateRunTemplateRequest,
  parseCreateWorkflowRequest,
  parseTemplateRunRequest,
  parseCursorPageQuery,
  parseCreateRunRequest,
  parseEventsListQuery,
  parseFailedWorkDiscardRequest,
  parseFailedWorkListQuery,
  parseGovernanceAuditHistoryQuery,
  parseIdentityAssignmentUpsertRequest,
  parseMemorySearchQuery,
  parsePolicyConcurrencyRejectionsQuery,
  parsePolicyPutRequest,
  parseRejectionsQuery,
  parseRunControlQuery,
  parseScheduleTickRequest,
  parseScheduleUpsertRequest,
  parseTailQuery
} from "../src/api/request-parsers.js";

describe("api request parsers", () => {
  it("parses create-run requests with optional provider/model", () => {
    expect(
      parseCreateRunRequest({
        sessionId: " s1 ",
        input: " hello ",
        provider: " mock ",
        model: " test-model "
      })
    ).toEqual({
      sessionId: "s1",
      input: "hello",
      provider: "mock",
      model: "test-model"
    });
  });

  it("parses create-run requests with directive/harness IDs", () => {
    expect(
      parseCreateRunRequest({
        sessionId: " s1 ",
        directiveId: " dir-1 ",
        harnessProfileId: " hp-1 "
      })
    ).toEqual({
      sessionId: "s1",
      directiveId: "dir-1",
      harnessProfileId: "hp-1"
    });

    expect(() =>
      parseCreateRunRequest({
        sessionId: "s1"
      } as unknown as Record<string, unknown>)
    ).toThrow("runs.create requires either input or directiveId");

    expect(() =>
      parseCreateRunRequest({
        sessionId: "s1",
        directiveId: "dir-1",
        provider: "mock",
        harnessProfileId: "hp-1"
      })
    ).toThrow("cannot be combined with harnessProfileId");
  });

  it("parses create-directive requests with optional context refs and metadata", () => {
    expect(
      parseCreateDirectiveRequest({
        input: " summarize this ",
        contextRefs: [" MEMORY.md ", " docs/README.md "],
        metadata: {
          category: " planning "
        }
      })
    ).toEqual({
      input: "summarize this",
      contextRefs: ["MEMORY.md", "docs/README.md"],
      metadata: {
        category: "planning"
      }
    });

    expect(() =>
      parseCreateDirectiveRequest({
        input: "ok",
        contextRefs: ["", 5]
      } as unknown as Record<string, unknown>)
    ).toThrow("directives.create.contextRefs");
  });

  it("parses create-harness-profile requests with required nested config and policies", () => {
    expect(
      parseCreateHarnessProfileRequest({
        displayName: " High Security Reviewer ",
        version: "v1",
        config: {
          provider: " mock ",
          model: " mock-model ",
          tools: [" review ", " trace "]
        },
        policies: {
          timeoutMs: 45_000,
          retryLimit: 2,
          budgetUsd: 4.5
        },
        allowedEgress: [{ host: "api.openai.com", port: 443 }]
      })
    ).toEqual({
      displayName: "High Security Reviewer",
      version: "v1",
      config: {
        provider: "mock",
        model: "mock-model",
        tools: ["review", "trace"]
      },
      policies: {
        timeoutMs: 45_000,
        retryLimit: 2,
        budgetUsd: 4.5
      },
      allowedEgress: [{ host: "api.openai.com", port: 443 }]
    });

    expect(() =>
      parseCreateHarnessProfileRequest({
        displayName: "bad",
        version: "v3",
        config: {
          provider: "mock",
          model: "mock-model",
          tools: ["review"]
        },
        policies: {
          timeoutMs: 1,
          retryLimit: 1,
          budgetUsd: 0
        }
      } as unknown as Record<string, unknown>)
    ).toThrow("harnessProfiles.create.version");
  });

  it("parses create-harness-profile verification policies", () => {
    expect(
      parseCreateHarnessProfileRequest({
        displayName: "Policy Harness",
        version: "v1",
        config: {
          provider: "mock",
          model: "mock-model",
          tools: ["review"]
        },
        policies: {
          timeoutMs: 45_000,
          retryLimit: 2,
          budgetUsd: 4.5
        },
        verificationPolicies: [
          {
            id: "require-test-report",
            kind: "require-evidence",
            label: "test-report",
            evidenceType: "json"
          }
        ]
      })
    ).toEqual({
      displayName: "Policy Harness",
      version: "v1",
      config: {
        provider: "mock",
        model: "mock-model",
        tools: ["review"]
      },
      policies: {
        timeoutMs: 45_000,
        retryLimit: 2,
        budgetUsd: 4.5
      },
      verificationPolicies: [
        {
          id: "require-test-report",
          kind: "require-evidence",
          label: "test-report",
          evidenceType: "json"
        }
      ]
    });

    expect(() =>
      parseCreateHarnessProfileRequest({
        displayName: "Policy Harness",
        version: "v1",
        config: {
          provider: "mock",
          model: "mock-model",
          tools: ["review"]
        },
        policies: {
          timeoutMs: 45_000,
          retryLimit: 2,
          budgetUsd: 4.5
        },
        verificationPolicies: [
          {
            id: "dup-policy",
            kind: "require-evidence",
            label: "test-report"
          },
          {
            id: "dup-policy",
            kind: "require-evidence",
            label: "other"
          }
        ]
      })
    ).toThrow("duplicate id");
  });

  it("rejects malformed allowed egress rules in harness profile parser", () => {
    expect(() =>
      parseCreateHarnessProfileRequest({
        displayName: "Policy Harness",
        version: "v1",
        config: {
          provider: "mock",
          model: "mock-model",
          tools: ["review"]
        },
        policies: {
          timeoutMs: 45_000,
          retryLimit: 2,
          budgetUsd: 4.5
        },
        allowedEgress: [{ host: "bad host value" }]
      })
    ).toThrow("allowedEgress");
  });

  it("parses create-run-template requests with required fields", () => {
    expect(
      parseCreateRunTemplateRequest({
        harnessProfileId: " hp-1 ",
        directiveTemplate: "Review {{HEAD_REF}} against {{BASE_REF}}",
        defaultParams: {
          HEAD_REF: " main ",
          BASE_REF: " origin/main "
        }
      })
    ).toEqual({
      harnessProfileId: "hp-1",
      directiveTemplate: "Review {{HEAD_REF}} against {{BASE_REF}}",
      defaultParams: {
        HEAD_REF: "main",
        BASE_REF: "origin/main"
      }
    });

    expect(() =>
      parseCreateRunTemplateRequest({
        harnessProfileId: "hp-1",
        directiveTemplate: "Review {{HEAD_REF}}",
        defaultParams: {
          HEAD_REF: ""
        }
      } as unknown as Record<string, unknown>)
    ).toThrow("runTemplates.create.defaultParams.HEAD_REF");
  });

  it("parses template run requests with optional params", () => {
    expect(
      parseTemplateRunRequest({
        params: {
          HEAD_REF: " feature/main ",
          BASE_REF: " main "
        }
      })
    ).toEqual({
      params: {
        HEAD_REF: "feature/main",
        BASE_REF: "main"
      }
    });

    expect(parseTemplateRunRequest({})).toEqual({});
    expect(() =>
      parseTemplateRunRequest({
        params: {
          HEAD_REF: ""
        }
      } as unknown as Record<string, unknown>)
    ).toThrow("templates.run.params.HEAD_REF");
  });

  it("parses create-workflow requests with definition payload", () => {
    expect(
      parseCreateWorkflowRequest({
        definition: {
          steps: [
            {
              id: "seed",
              directiveId: "dir-1",
              harnessProfileId: "hp-1",
              outputs: ["summary"]
            },
            {
              id: "review",
              directiveId: "dir-2",
              harnessProfileId: "hp-1"
            }
          ],
          dependencies: [
            {
              from: "seed",
              to: "review",
              mappings: [{ fromOutput: "summary", toInput: "upstreamSummary" }]
            }
          ]
        }
      })
    ).toEqual({
      definition: {
        steps: [
          {
            id: "seed",
            directiveId: "dir-1",
            harnessProfileId: "hp-1",
            outputs: ["summary"]
          },
          {
            id: "review",
            directiveId: "dir-2",
            harnessProfileId: "hp-1"
          }
        ],
        dependencies: [
          {
            from: "seed",
            to: "review",
            mappings: [{ fromOutput: "summary", toInput: "upstreamSummary" }]
          }
        ]
      }
    });

    expect(() =>
      parseCreateWorkflowRequest({
        definition: {
          steps: []
        }
      } as unknown as Record<string, unknown>)
    ).toThrow("workflows.create.definition.dependencies");
  });

  it("parses task-target schedule requests", () => {
    expect(
      parseScheduleUpsertRequest(
        {
          name: " Daily task ",
          targetType: "task",
          targetId: " task-1 ",
          inputBindings: { priority: "normal" },
          rrule: " FREQ=DAILY;INTERVAL=1 ",
          timezone: " UTC ",
          status: "paused"
        },
        "schedules.create"
      )
    ).toEqual({
      name: "Daily task",
      targetType: "task",
      targetId: "task-1",
      inputBindings: { priority: "normal" },
      rrule: "FREQ=DAILY;INTERVAL=1",
      timezone: "UTC",
      status: "paused"
    });

    expect(() => parseScheduleUpsertRequest({ targetType: "task", targetId: "task-1" }, "schedules.create")).toThrow(
      "requires runAt or rrule"
    );
  });

  it("parses memory search query and validates bounds", () => {
    const requestUrl = new URL("http://localhost/api/v1/memory/search?query=athena&maxResults=5&minScore=0.25");
    expect(parseMemorySearchQuery(requestUrl)).toEqual({
      query: "athena",
      options: {
        maxResults: 5,
        minScore: 0.25
      }
    });

    const invalidRequestUrl = new URL("http://localhost/api/v1/memory/search?query=athena&maxResults=0");
    expect(() => parseMemorySearchQuery(invalidRequestUrl)).toThrow("memory.search.maxResults");
  });

  it("parses cursor/tail query parameters with normalized bounds", () => {
    const cursorRequestUrl = new URL("http://localhost/api/v1/sessions?cursor=abc&limit=9999");
    expect(parseCursorPageQuery(cursorRequestUrl)).toEqual({
      cursor: "abc",
      limit: 500
    });

    const tailRequestUrl = new URL("http://localhost/api/v1/events/stream?after=evt_1&limit=0");
    expect(parseTailQuery(tailRequestUrl)).toEqual({
      after: "evt_1",
      limit: 1
    });
  });

  it("parses failed work list query with status validation", () => {
    const failedWorkRequestUrl = new URL("http://localhost/api/v1/failed-work?cursor=abc&limit=20&status=pending");
    expect(parseFailedWorkListQuery(failedWorkRequestUrl)).toEqual({
      cursor: "abc",
      limit: 20,
      status: "pending"
    });

    const retriedRequestUrl = new URL("http://localhost/api/v1/failed-work?status=retried");
    expect(parseFailedWorkListQuery(retriedRequestUrl)).toEqual({
      limit: 50,
      status: "retried"
    });

    const invalidStatusUrl = new URL("http://localhost/api/v1/failed-work?status=unknown");
    expect(() => parseFailedWorkListQuery(invalidStatusUrl)).toThrow("failed-work.status");
  });

  it("parses a2a flow graph query filters", () => {
    const requestUrl = new URL("http://localhost/api/v1/work/flows/trace-1?limit=150&types=a2a.sent,a2a.failed");
    expect(parseA2aFlowGraphQuery(requestUrl)).toEqual({
      limit: 150,
      types: ["a2a.sent", "a2a.failed"]
    });

    const defaultRequestUrl = new URL("http://localhost/api/v1/work/flows/trace-1");
    expect(parseA2aFlowGraphQuery(defaultRequestUrl)).toEqual({
      limit: 200
    });
  });

  it("parses a2a observability query filters", () => {
    const requestUrl = new URL(
      "http://localhost/api/v1/work/observability?limit=1800&windowMinutes=90&bucketMinutes=10&traceId=trace-7"
    );
    expect(parseA2aObservabilityQuery(requestUrl)).toEqual({
      limit: 1800,
      windowMinutes: 90,
      bucketMinutes: 10,
      traceId: "trace-7"
    });

    const defaultRequestUrl = new URL("http://localhost/api/v1/work/observability");
    expect(parseA2aObservabilityQuery(defaultRequestUrl)).toEqual({
      limit: 500,
      windowMinutes: 60,
      bucketMinutes: 5
    });
  });

  it("parses a2a observability alert history filters", () => {
    const requestUrl = new URL(
      "http://localhost/api/v1/work/observability/alerts?cursor=abc&limit=120&traceId=trace-7&stepId=planner&severity=critical&createdAfter=2026-02-20T00:00:00.000Z&createdBefore=2026-02-20T01:00:00.000Z"
    );
    expect(parseA2aStallAlertHistoryQuery(requestUrl)).toEqual({
      cursor: "abc",
      limit: 120,
      traceId: "trace-7",
      stepId: "planner",
      severity: "critical",
      createdAfter: "2026-02-20T00:00:00.000Z",
      createdBefore: "2026-02-20T01:00:00.000Z"
    });
    expect(parseA2aStallAlertHistoryQuery(new URL("http://localhost/api/v1/work/observability/alerts"))).toEqual({
      limit: 50
    });
    expect(() =>
      parseA2aStallAlertHistoryQuery(new URL("http://localhost/api/v1/work/observability/alerts?severity=high"))
    ).toThrow("a2a.observability.alerts.severity");
  });

  it("parses a2a observability alert csv export filters", () => {
    const requestUrl = new URL(
      "http://localhost/api/v1/work/observability/alerts/export.csv?traceId=trace-7&stepId=planner&severity=warning&createdAfter=2026-02-20T00:00:00.000Z&createdBefore=2026-02-20T02:00:00.000Z"
    );
    expect(parseA2aStallAlertCsvExportQuery(requestUrl)).toEqual({
      traceId: "trace-7",
      stepId: "planner",
      severity: "warning",
      createdAfter: "2026-02-20T00:00:00.000Z",
      createdBefore: "2026-02-20T02:00:00.000Z"
    });
    expect(() =>
      parseA2aStallAlertCsvExportQuery(new URL("http://localhost/api/v1/work/observability/alerts/export.csv?severity=high"))
    ).toThrow("a2a.observability.alerts.severity");
  });

  it("parses failed work discard payload with optional audit note", () => {
    expect(
      parseFailedWorkDiscardRequest({
        auditNote: " operator validated duplicate message "
      })
    ).toEqual({
      auditNote: "operator validated duplicate message"
    });
    expect(parseFailedWorkDiscardRequest({})).toEqual({});
    expect(() => parseFailedWorkDiscardRequest({ auditNote: 123 })).toThrow("failed-work.discard.auditNote");
  });

  it("parses bounded events list query filters", () => {
    const requestUrl = new URL(
      "http://localhost/api/v1/events?cursor=abc&limit=20&traceId=t-1&sessionId=s1&types=run.created,work.enqueued&createdAfter=2026-02-16T00:00:00.000Z"
    );
    expect(parseEventsListQuery(requestUrl)).toEqual({
      cursor: "abc",
      limit: 20,
      traceId: "t-1",
      sessionId: "s1",
      types: ["run.created", "work.enqueued"],
      createdAfter: "2026-02-16T00:00:00.000Z"
    });

    const invalidDateUrl = new URL("http://localhost/api/v1/events?createdBefore=not-a-date");
    expect(() => parseEventsListQuery(invalidDateUrl)).toThrow("events.list.createdBefore");
  });

  it("parses governance audit history query filters", () => {
    const requestUrl = new URL(
      "http://localhost/api/v1/governance/audit-trail?cursor=abc&limit=20&actor=bootstrap-admin&categories=policy,identity-assignment&createdAfter=2026-02-16T00:00:00.000Z"
    );
    expect(parseGovernanceAuditHistoryQuery(requestUrl)).toEqual({
      cursor: "abc",
      limit: 20,
      actor: "bootstrap-admin",
      categories: ["policy", "identity-assignment"],
      createdAfter: "2026-02-16T00:00:00.000Z"
    });

    const invalidDateUrl = new URL("http://localhost/api/v1/governance/audit-trail?createdBefore=not-a-date");
    expect(() => parseGovernanceAuditHistoryQuery(invalidDateUrl)).toThrow("governance.audit.createdBefore");
  });

  it("rejects invalid schedule tick datetime values", () => {
    expect(() => parseScheduleTickRequest({ at: "not-a-date" })).toThrow("schedules.tick.at");
  });

  it("parses policy put payload with optional enforcement controls", () => {
    const parsed = parsePolicyPutRequest({
      schemaVersion: 1,
      updatedAt: "2026-02-16T00:00:00.000Z",
      maxConcurrentRuns: 2,
      defaultRunTimeoutMs: 10_000,
      defaultScheduleTimeoutMs: 20_000,
      retryBudgetPerRun: 3,
      costBudgetDailyUsd: 5.5
    });
    expect(parsed).toEqual({
      policy: {
        schemaVersion: 1,
        updatedAt: expect.any(String),
        maxConcurrentRuns: 2,
        defaultRunTimeoutMs: 10_000,
        defaultScheduleTimeoutMs: 20_000,
        retryBudgetPerRun: 3,
        costBudgetDailyUsd: 5.5
      }
    });
    expect(parsed.policy.updatedAt).not.toBe("2026-02-16T00:00:00.000Z");
    const parsedWithInvalidClientTimestamp = parsePolicyPutRequest({
      schemaVersion: 1,
      updatedAt: "not-a-date"
    });
    expect(typeof parsedWithInvalidClientTimestamp.policy.updatedAt).toBe("string");
    expect(parsedWithInvalidClientTimestamp.policy.updatedAt).not.toBe("not-a-date");
    const parsedWithoutClientTimestamp = parsePolicyPutRequest({
      schemaVersion: 1,
      maxConcurrentRuns: 2
    });
    expect(parsedWithoutClientTimestamp.policy.schemaVersion).toBe(1);
    expect(parsedWithoutClientTimestamp.policy.maxConcurrentRuns).toBe(2);
    expect(typeof parsedWithoutClientTimestamp.policy.updatedAt).toBe("string");

    const auditedParsed = parsePolicyPutRequest({
      policy: {
        schemaVersion: 1,
        maxConcurrentRuns: 3
      },
      auditComment: "Tune concurrency for queue pressure."
    });
    expect(auditedParsed).toEqual({
      policy: {
        schemaVersion: 1,
        updatedAt: expect.any(String),
        maxConcurrentRuns: 3
      },
      auditComment: "Tune concurrency for queue pressure."
    });

    expect(() =>
      parsePolicyPutRequest({
        schemaVersion: 1,
        updatedAt: "ignored-value",
        retryBudgetPerRun: -1
      })
    ).toThrow("policy.put.retryBudgetPerRun");

    expect(() =>
      parsePolicyPutRequest({
        policy: {
          schemaVersion: 1,
          maxConcurrentRuns: 2
        }
      })
    ).toThrow("policy.put.auditComment");
  });

  it("parses identity assignment upsert payload", () => {
    expect(
      parseIdentityAssignmentUpsertRequest({
        role: "Operator",
        subjectType: "service-token",
        updatedBy: "bootstrap-admin"
      })
    ).toEqual({
      role: "Operator",
      subjectType: "service-token",
      updatedBy: "bootstrap-admin"
    });

    expect(
      parseIdentityAssignmentUpsertRequest({
        role: "Viewer"
      })
    ).toEqual({
      role: "Viewer",
      subjectType: "identity"
    });

    expect(() =>
      parseIdentityAssignmentUpsertRequest({
        role: "SuperAdmin"
      } as unknown as Record<string, unknown>)
    ).toThrow("rbac.assignments.upsert.role");
  });

  it("parses policy concurrency rejection query filters", () => {
    const requestUrl = new URL(
      "http://localhost/api/v1/policy/rejections?cursor=abc&limit=20&sessionId=s1&createdAfter=2026-02-16T00:00:00.000Z"
    );
    expect(parsePolicyConcurrencyRejectionsQuery(requestUrl)).toEqual({
      cursor: "abc",
      limit: 20,
      sessionId: "s1",
      createdAfter: "2026-02-16T00:00:00.000Z"
    });

    const invalidDateUrl = new URL("http://localhost/api/v1/policy/rejections?createdBefore=not-a-date");
    expect(() => parsePolicyConcurrencyRejectionsQuery(invalidDateUrl)).toThrow("policy.rejections.createdBefore");
  });

  it("parses rejections query filters with offset fallback pagination", () => {
    const requestUrl = new URL(
      "http://localhost/api/v1/rejections?offset=20&limit=10&sessionId=s1&createdBefore=2026-02-17T00:00:00.000Z"
    );
    expect(parseRejectionsQuery(requestUrl)).toEqual({
      cursor: "MjA",
      limit: 10,
      sessionId: "s1",
      createdBefore: "2026-02-17T00:00:00.000Z"
    });

    const invalidOffsetUrl = new URL("http://localhost/api/v1/rejections?offset=-1");
    expect(() => parseRejectionsQuery(invalidOffsetUrl)).toThrow("rejections.offset");
  });

  it("parses run-control query filters", () => {
    const requestUrl = new URL("http://localhost/api/v1/runs/active?cursor=abc&limit=25&sessionId=s1&runId=r-1");
    expect(parseRunControlQuery(requestUrl)).toEqual({
      cursor: "abc",
      limit: 25,
      sessionId: "s1",
      runId: "r-1"
    });
  });
});
