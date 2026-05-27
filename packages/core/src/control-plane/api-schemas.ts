import type { ApiRouteDefinition } from "./api-contracts.js";
import { API_V1_ROUTES } from "./api-contracts.js";
import { AthenaError } from "../runtime/errors.js";
import { GENERATED_COMPONENT_SCHEMAS } from "./generated-component-schemas.js";

export type ApiSchema =
  | {
      type: "string";
      minLength?: number;
      enum?: string[];
      format?: "date-time";
    }
  | {
      type: "integer";
      minimum?: number;
    }
  | {
      type: "number";
      minimum?: number;
    }
  | {
      type: "boolean";
    }
  | {
      type: "null";
    }
  | {
      type: "array";
      items: ApiSchema;
    }
  | {
      type: "object";
      properties?: Record<string, ApiSchema>;
      required?: string[];
      additionalProperties?: boolean | ApiSchema;
    }
  | {
      anyOf: ApiSchema[];
    }
  | {
      $ref: `#/components/schemas/${string}`;
    };

export interface ApiOperationSchema {
  operationId: string;
  path: string;
  method: ApiRouteDefinition["method"];
  pathParamsSchema?: ApiSchema;
  querySchema?: ApiSchema;
  requestBodySchema?: ApiSchema;
  responseSchema?: ApiSchema;
  stream?: "sse";
}

const API_COMPONENT_SCHEMAS_NON_GENERATED: Record<string, ApiSchema> = {
  AgentCatalogValidationIssue: {
    type: "object",
    additionalProperties: false,
    properties: {
      file: { type: "string" },
      path: { type: "string" },
      message: { type: "string" },
      keyword: { type: "string" },
      resourceType: { type: "string", enum: ["plugin", "agent", "unknown"] }
    },
    required: ["path", "message", "resourceType"]
  },
  AgentCatalogPluginListResult: {
    type: "object",
    additionalProperties: false,
    properties: {
      plugins: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1 },
            version: { type: "string", minLength: 1 },
            path: { type: "string", minLength: 1 },
            enabled: { type: "boolean" },
            status: { type: "string", minLength: 1 },
            sourceType: { type: "string", minLength: 1 },
            sourceScope: { type: "string", enum: ["workspace", "system"] },
            metadata: {
              type: "object",
              additionalProperties: true,
              properties: {
                name: { type: "string", minLength: 1 }
              },
              required: ["name"]
            },
            validationErrors: {
              type: "array",
              items: { $ref: "#/components/schemas/AgentCatalogValidationIssue" }
            },
            agentCount: { type: "integer", minimum: 0 },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" }
          },
          required: [
            "id",
            "version",
            "path",
            "enabled",
            "status",
            "sourceType",
            "sourceScope",
            "metadata",
            "validationErrors",
            "agentCount",
            "createdAt",
            "updatedAt"
          ]
        }
      },
      total: { type: "integer", minimum: 0 }
    },
    required: ["plugins", "total"]
  },
  AgentCatalogAgentListResult: {
    type: "object",
    additionalProperties: false,
    properties: {
      agents: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1 },
            version: { type: "string", minLength: 1 },
            name: { type: "string", minLength: 1 },
            plugin: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string", minLength: 1 },
                version: { type: "string", minLength: 1 },
                name: { type: "string", minLength: 1 },
                sourceType: { type: "string", minLength: 1 },
                sourceScope: { type: "string", enum: ["workspace", "system"] },
                enabled: { type: "boolean" },
                status: { type: "string", minLength: 1 }
              },
              required: ["id", "version", "name", "sourceType", "sourceScope", "enabled", "status"]
            },
            capabilities: {
              type: "array",
              items: { type: "string", minLength: 1 }
            },
            status: { type: "string", minLength: 1 },
            available: { type: "boolean" },
            metadata: {
              type: "object",
              additionalProperties: true
            },
            validationErrors: {
              type: "array",
              items: { $ref: "#/components/schemas/AgentCatalogValidationIssue" }
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" }
          },
          required: [
            "id",
            "version",
            "name",
            "plugin",
            "capabilities",
            "status",
            "available",
            "metadata",
            "validationErrors",
            "createdAt",
            "updatedAt"
          ]
        }
      },
      total: { type: "integer", minimum: 0 },
      filters: {
        type: "object",
        additionalProperties: false,
        properties: {
          capabilities: {
            type: "array",
            items: { type: "string", minLength: 1 }
          }
        }
      }
    },
    required: ["agents", "total", "filters"]
  },
  WorkDrainResult: {
    type: "object",
    additionalProperties: false,
    properties: {
      drainedItems: { type: "integer", minimum: 0 },
      status: { type: "string", enum: ["ok", "already-draining"] },
      queueDepthBefore: { type: "integer", minimum: 0 },
      queueDepthAfter: { type: "integer", minimum: 0 }
    },
    required: ["drainedItems", "status", "queueDepthBefore", "queueDepthAfter"]
  },
  ScheduleRunResult: {
    type: "object",
    additionalProperties: false,
    properties: {
      status: { type: "string", enum: ["ok", "failed", "already-running"] },
      id: { type: "string", minLength: 1 },
      sessionId: { type: "string", minLength: 1 },
      startedAt: { type: "string", format: "date-time" },
      finishedAt: { type: "string", format: "date-time" },
      error: { type: "string" }
    },
    required: ["status", "id", "sessionId", "startedAt", "finishedAt"]
  },
  MemoryGetResult: {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", minLength: 1 },
      text: { type: "string" },
      lineStart: { type: "integer", minimum: 1 },
      lineEnd: { type: "integer", minimum: 1 }
    },
    required: ["path", "text", "lineStart", "lineEnd"]
  },
  PersonaRunResponse: {
    type: "object",
    additionalProperties: false,
    properties: {
      result: {
        type: "object",
        additionalProperties: true,
        properties: {
          schemaVersion: { type: "integer", minimum: 1 },
          runId: { type: "string", minLength: 1 },
          personaName: { type: "string", minLength: 1 },
          sessionId: { type: "string", minLength: 1 },
          status: { type: "string", enum: ["ok", "failed"] },
          startedAt: { type: "string", format: "date-time" },
          finishedAt: { type: "string", format: "date-time" },
          findings: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: true,
              properties: {
                priority: { type: "string", enum: ["P1", "P2", "P3"] },
                confidence: { type: "number", minimum: 0 },
                title: { type: "string" },
                message: { type: "string" }
              },
              required: ["priority", "confidence", "title", "message"]
            }
          },
          mergeGate: { type: "string", enum: ["pass", "fail"] },
          reportMarkdown: { type: "string" }
        },
        required: [
          "schemaVersion",
          "runId",
          "personaName",
          "sessionId",
          "status",
          "startedAt",
          "finishedAt",
          "findings",
          "mergeGate",
          "reportMarkdown"
        ]
      },
      stdout: { type: "string" }
    },
    required: ["result", "stdout"]
  }
};

const API_COMPONENT_SCHEMA_STRICTNESS_HINTS: Record<string, ApiSchema> = {
  ContextRecoveryStep: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["summary", "tool-result-truncation"] },
      beforeChars: { type: "integer", minimum: 0 },
      afterChars: { type: "integer", minimum: 0 }
    }
  },
  ContextCompactionMetadata: {
    type: "object",
    properties: {
      initialStrategy: { type: "string", enum: ["raw", "summary", "distill"] },
      finalStrategy: { type: "string", enum: ["raw", "summary", "distill"] },
      overflowAttempts: { type: "integer", minimum: 0 },
      initialChars: { type: "integer", minimum: 0 },
      finalChars: { type: "integer", minimum: 0 },
      effectiveMaxChars: { type: "integer", minimum: 0 }
    }
  },
  RunResult: {
    type: "object",
    properties: {
      sessionId: { type: "string", minLength: 1 },
      model: { type: "string", minLength: 1 },
      provider: { type: "string", minLength: 1 },
      runId: { type: "string", minLength: 1 },
      verificationStatus: { type: "string", enum: ["passed", "verification-failed"] },
      verificationFailures: {
        type: "array",
        items: {
          type: "object",
          properties: {
            policyId: { type: "string", minLength: 1 },
            kind: { type: "string", minLength: 1 },
            message: { type: "string", minLength: 1 }
          }
        }
      },
      directiveId: { type: "string", minLength: 1 },
      harnessProfileId: { type: "string", minLength: 1 },
      harnessProfileSnapshot: { $ref: "#/components/schemas/HarnessProfile" },
      template: {
        type: "object",
        properties: {
          id: { type: "string", minLength: 1 },
          harnessProfileId: { type: "string", minLength: 1 },
          effectiveParams: {
            type: "object",
            additionalProperties: { type: "string" }
          }
        }
      },
      createdAt: { type: "string", format: "date-time" }
    }
  },
  CancelRunResult: {
    type: "object",
    properties: {
      sessionId: { type: "string", minLength: 1 },
      status: { type: "string", enum: ["cancelled", "not-running"] }
    }
  },
  CancelRunByRunIdResult: {
    type: "object",
    properties: {
      runId: { type: "string", minLength: 1 },
      status: { type: "string", enum: ["cancelled", "not-running"] },
      sessionId: { type: "string", minLength: 1 }
    }
  },
  ActiveRunRecord: {
    type: "object",
    properties: {
      sessionId: { type: "string", minLength: 1 },
      pid: { type: "integer", minimum: 1 },
      startedAt: { type: "string", format: "date-time" },
      runId: { type: "string", minLength: 1 },
      traceId: { type: "string", minLength: 1 }
    }
  },
  CancellationRequestRecord: {
    type: "object",
    properties: {
      sessionId: { type: "string", minLength: 1 },
      requestedAt: { type: "string", format: "date-time" },
      runId: { type: "string", minLength: 1 },
      traceId: { type: "string", minLength: 1 },
      startedAt: { type: "string", format: "date-time" }
    }
  },
  SessionRecord: {
    type: "object",
    properties: {
      schemaVersion: { type: "integer", minimum: 1 },
      id: { type: "string", minLength: 1 },
      transcriptPath: { type: "string", minLength: 1 },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" }
    }
  },
  Directive: {
    type: "object",
    properties: {
      id: { type: "string", minLength: 1 },
      input: { type: "string", minLength: 1 },
      contextRefs: {
        type: "array",
        items: { type: "string", minLength: 1 }
      },
      metadata: {
        type: "object",
        additionalProperties: { type: "string", minLength: 1 }
      },
      createdAt: { type: "string", format: "date-time" }
    }
  },
  DirectiveListResult: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/Directive" }
      },
      nextCursor: { type: "string", minLength: 1 }
    }
  },
  HarnessProfile: {
    type: "object",
    properties: {
      id: { type: "string", minLength: 1 },
      displayName: { type: "string", minLength: 1 },
      version: { type: "string", enum: ["v1", "v2"] },
      config: {
        type: "object",
        properties: {
          provider: { type: "string", minLength: 1 },
          model: { type: "string", minLength: 1 },
          tools: {
            type: "array",
            items: { type: "string", minLength: 1 }
          }
        }
      },
      policies: {
        type: "object",
        properties: {
          timeoutMs: { type: "integer", minimum: 1 },
          retryLimit: { type: "integer", minimum: 1 },
          budgetUsd: { type: "number", minimum: 0 }
        }
      },
      allowedEgress: {
        type: "array",
        items: {
          type: "object",
          properties: {
            host: { type: "string", minLength: 1 },
            port: { type: "integer", minimum: 1 }
          }
        }
      },
      createdAt: { type: "string", format: "date-time" }
    }
  },
  HarnessProfileListResult: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/HarnessProfile" }
      },
      nextCursor: { type: "string", minLength: 1 }
    }
  },
  RunTemplate: {
    type: "object",
    properties: {
      id: { type: "string", minLength: 1 },
      harnessProfileId: { type: "string", minLength: 1 },
      directiveTemplate: { type: "string", minLength: 1 },
      defaultParams: {
        type: "object",
        additionalProperties: { type: "string" }
      },
      createdAt: { type: "string", format: "date-time" }
    }
  },
  RunTemplateListResult: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/RunTemplate" }
      },
      nextCursor: { type: "string", minLength: 1 }
    }
  },
  Workflow: {
    type: "object",
    properties: {
      id: { type: "string", minLength: 1 },
      definition: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", minLength: 1 },
                directiveId: { type: "string", minLength: 1 },
                harnessProfileId: { type: "string", minLength: 1 },
                outputs: {
                  type: "array",
                  items: { type: "string", minLength: 1 }
                }
              }
            }
          },
          dependencies: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from: { type: "string", minLength: 1 },
                to: { type: "string", minLength: 1 },
                mappings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      fromOutput: { type: "string", minLength: 1 },
                      toInput: { type: "string", minLength: 1 }
                    }
                  }
                }
              }
            }
          }
        }
      },
      createdAt: { type: "string", format: "date-time" }
    }
  },
  WorkflowListResult: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/Workflow" }
      },
      nextCursor: { type: "string", minLength: 1 }
    }
  },
  WorkflowRun: {
    type: "object",
    properties: {
      schemaVersion: { type: "integer", minimum: 1 },
      id: { type: "string", minLength: 1 },
      workflowId: { type: "string", minLength: 1 },
      status: { type: "string", enum: ["pending", "running", "ok", "failed"] },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      startedAt: { type: "string", format: "date-time" },
      finishedAt: { type: "string", format: "date-time" }
    }
  },
  TranscriptEntry: {
    type: "object",
    properties: {
      id: { type: "string", minLength: 1 },
      role: { type: "string", enum: ["system", "user", "assistant", "tool"] },
      kind: { type: "string", enum: ["message", "tool-call", "tool-result"] },
      createdAt: { type: "string", format: "date-time" }
    }
  },
  WorkItem: {
    type: "object",
    properties: {
      id: { type: "string", minLength: 1 },
      sessionId: { type: "string", minLength: 1 },
      mode: { type: "string", enum: ["followup", "collect"] },
      createdAt: { type: "string", format: "date-time" }
    }
  },
  WorkQueueState: {
    type: "object",
    properties: {
      schemaVersion: { type: "integer", minimum: 1 },
      sessionId: { type: "string", minLength: 1 },
      updatedAt: { type: "string", format: "date-time" }
    }
  },
  ScheduledTask: {
    type: "object",
    properties: {
      schemaVersion: { type: "integer", minimum: 1 },
      id: { type: "string", minLength: 1 },
      sessionId: { type: "string", minLength: 1 },
      everyMinutes: { type: "integer", minimum: 1 },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      lastRunAt: { type: "string", format: "date-time" },
      nextRunAt: { type: "string", format: "date-time" }
    }
  },
  ScheduleRunLog: {
    type: "object",
    properties: {
      id: { type: "string", minLength: 1 },
      scheduleId: { type: "string", minLength: 1 },
      sessionId: { type: "string", minLength: 1 },
      startedAt: { type: "string", format: "date-time" },
      finishedAt: { type: "string", format: "date-time" },
      status: { type: "string", enum: ["ok", "failed", "already-running"] },
      errorCode: {
        type: "string",
        enum: [
          "CONFIG_ERROR",
          "POLICY_CONCURRENCY_LIMIT_EXCEEDED",
          "PAYLOAD_TOO_LARGE",
          "SESSION_LOCK_TIMEOUT",
          "SESSION_IO_ERROR",
          "CONTEXT_OVERFLOW",
          "PROVIDER_NOT_FOUND",
          "PROVIDER_ERROR",
          "RUN_TIMEOUT",
          "RUN_CANCELLED",
          "SCHEDULE_TIMEOUT"
        ]
      }
    }
  },
  PolicyDocument: {
    type: "object",
    properties: {
      schemaVersion: { type: "integer", minimum: 1 },
      updatedAt: { type: "string", format: "date-time" },
      maxConcurrentRuns: { type: "integer", minimum: 1 },
      defaultRunTimeoutMs: { type: "integer", minimum: 1 },
      defaultScheduleTimeoutMs: { type: "integer", minimum: 1 },
      retryBudgetPerRun: { type: "integer", minimum: 0 },
      costBudgetDailyUsd: { type: "number", minimum: 0 }
    }
  },
  RunRejectionEvent: {
    type: "object",
    properties: {
      schemaVersion: { type: "integer", minimum: 1 },
      timestamp: { type: "string", format: "date-time" },
      policyType: { type: "string", enum: ["CONCURRENCY"] },
      limit: { type: "integer", minimum: 1 },
      rejectedRunDetails: {
        type: "object",
        properties: {
          sessionId: { type: "string", minLength: 1 },
          personaName: { type: "string", minLength: 1 }
        }
      },
      reason: { type: "string", enum: ["max-concurrent-runs-exceeded", "lock-acquisition-failed"] },
      activeRuns: { type: "integer", minimum: 0 },
      policy: { $ref: "#/components/schemas/PolicyOriginDetails" }
    }
  },
  PolicyConcurrencyRejectionRecord: {
    type: "object",
    properties: {
      id: { type: "string", minLength: 1 },
      createdAt: { type: "string", format: "date-time" },
      sessionId: { type: "string", minLength: 1 },
      activeRuns: { type: "integer", minimum: 0 },
      maxConcurrentRuns: { type: "integer", minimum: 1 },
      reason: { type: "string", enum: ["max-concurrent-runs-exceeded", "lock-acquisition-failed"] },
      policy: { $ref: "#/components/schemas/PolicyOriginDetails" },
      event: { $ref: "#/components/schemas/RunRejectionEvent" }
    }
  },
  PolicyWorkloadMetadata: {
    type: "object",
    properties: {
      schemaVersion: { type: "integer", minimum: 1 },
      labels: {
        type: "object",
        properties: {
          "athena.dev/agent-role": { type: "string", minLength: 1 },
          "athena.dev/run-id": { type: "string", minLength: 1 },
          "athena.dev/session-id": { type: "string", minLength: 1 },
          "athena.dev/control-plane": { type: "string", enum: ["v1"] }
        }
      },
      annotations: {
        type: "object",
        properties: {
          "athena.dev/policy-profile": { type: "string", minLength: 1 },
          "athena.dev/cleanup-ttl-seconds": { type: "string", minLength: 1 }
        }
      }
    }
  },
  PolicyOriginDetails: {
    type: "object",
    properties: {
      schemaVersion: { type: "integer", minimum: 1 },
      engine: { type: "string", enum: ["athena", "kyverno"] },
      ruleType: { type: "string", enum: ["concurrency", "validate", "mutate", "generate"] },
      failureAction: { type: "string", enum: ["audit", "enforce"] },
      policyName: { type: "string", minLength: 1 },
      ruleName: { type: "string", minLength: 1 }
    }
  },
  PolicyDecisionEventMetadata: {
    type: "object",
    properties: {
      schemaVersion: { type: "integer", minimum: 1 },
      decision: { type: "string", enum: ["rejected", "mutated", "generated"] },
      workload: { $ref: "#/components/schemas/PolicyWorkloadMetadata" },
      origin: { $ref: "#/components/schemas/PolicyOriginDetails" }
    }
  },
  FleetSummary: {
    type: "object",
    properties: {
      total: { type: "integer", minimum: 0 },
      running: { type: "integer", minimum: 0 },
      pending: { type: "integer", minimum: 0 },
      succeeded: { type: "integer", minimum: 0 },
      failed: { type: "integer", minimum: 0 },
      cpuUsage: { type: "number", minimum: 0 },
      memoryUsage: { type: "number", minimum: 0 }
    }
  },
  CapabilitySet: {
    type: "object",
    properties: {
      executionBackend: { type: "string", enum: ["local", "k8s"] },
      stateStore: { type: "string", enum: ["file", "remote"] }
    }
  },
  EventRecord: {
    type: "object",
    properties: {
      id: { type: "string", minLength: 1 },
      traceId: { type: "string", minLength: 1 },
      type: { type: "string", minLength: 1 },
      createdAt: { type: "string", format: "date-time" },
      policy: { $ref: "#/components/schemas/PolicyDecisionEventMetadata" }
    }
  },
  A2aDlqItem: {
    type: "object",
    properties: {
      id: { type: "string", minLength: 1 },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      status: { type: "string", enum: ["pending", "requeued", "discarded"] }
    }
  },
  MemorySearchResult: {
    type: "object",
    properties: {
      id: { type: "string", minLength: 1 },
      sourcePath: { type: "string", minLength: 1 },
      lineStart: { type: "integer", minimum: 1 },
      lineEnd: { type: "integer", minimum: 1 }
    }
  }
};

const GENERATED_COMPONENT_SCHEMAS_WITH_STRICTNESS = Object.fromEntries(
  Object.entries(GENERATED_COMPONENT_SCHEMAS).map(([name, schema]) => [
    name,
    applySchemaStrictness(schema, API_COMPONENT_SCHEMA_STRICTNESS_HINTS[name])
  ])
) as Record<string, ApiSchema>;

export const API_COMPONENT_SCHEMAS: Record<string, ApiSchema> = {
  ...API_COMPONENT_SCHEMAS_NON_GENERATED,
  ...GENERATED_COMPONENT_SCHEMAS_WITH_STRICTNESS
};

const STRING_SCHEMA: ApiSchema = { type: "string", minLength: 1 };

const OPTIONAL_STRING_QUERY: ApiSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    cursor: { type: "string" },
    after: { type: "string" },
    limit: { type: "integer", minimum: 1 }
  }
};

export const API_V1_OPERATION_SCHEMAS: Record<string, ApiOperationSchema> = {
  getCapabilities: {
    operationId: "getCapabilities",
    method: "GET",
    path: "/api/v1/capabilities",
    responseSchema: { $ref: "#/components/schemas/CapabilitySet" }
  },
  getHealth: {
    operationId: "getHealth",
    method: "GET",
    path: "/api/v1/health",
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["ok"] },
        now: { type: "string", format: "date-time" }
      },
      required: ["status", "now"]
    }
  },
  getAdminHealth: {
    operationId: "getAdminHealth",
    method: "GET",
    path: "/api/v1/admin/health",
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["ok"] },
        now: { type: "string", format: "date-time" }
      },
      required: ["status", "now"]
    }
  },
  listAgentCatalogPlugins: {
    operationId: "listAgentCatalogPlugins",
    method: "GET",
    path: "/api/v1/agent-catalog/plugins",
    responseSchema: { $ref: "#/components/schemas/AgentCatalogPluginListResult" }
  },
  listAgentCatalogAgents: {
    operationId: "listAgentCatalogAgents",
    method: "GET",
    path: "/api/v1/agent-catalog/agents",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        capability: { type: "string" },
        capabilities: { type: "string" }
      }
    },
    responseSchema: { $ref: "#/components/schemas/AgentCatalogAgentListResult" }
  },
  createRun: {
    operationId: "createRun",
    method: "POST",
    path: "/api/v1/runs",
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        sessionId: STRING_SCHEMA,
        input: { type: "string" },
        directiveId: { type: "string" },
        harnessProfileId: { type: "string" },
        provider: { type: "string" },
        model: { type: "string" },
        metadata: {
          type: "object",
          additionalProperties: { type: "string" }
        }
      },
      required: ["sessionId"]
    },
    responseSchema: { $ref: "#/components/schemas/RunResult" }
  },
  listActiveRuns: {
    operationId: "listActiveRuns",
    method: "GET",
    path: "/api/v1/runs/active",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1 },
        sessionId: { type: "string" },
        runId: { type: "string" }
      }
    },
    responseSchema: { $ref: "#/components/schemas/ActiveRunQueryResult" }
  },
  listCancellationRequests: {
    operationId: "listCancellationRequests",
    method: "GET",
    path: "/api/v1/runs/cancel-requests",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1 },
        sessionId: { type: "string" },
        runId: { type: "string" }
      }
    },
    responseSchema: { $ref: "#/components/schemas/CancellationRequestQueryResult" }
  },
  cancelRun: {
    operationId: "cancelRun",
    method: "POST",
    path: "/api/v1/runs/:sessionId/cancel",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        sessionId: STRING_SCHEMA
      },
      required: ["sessionId"]
    },
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        reason: { type: "string" }
      }
    },
    responseSchema: { $ref: "#/components/schemas/CancelRunResult" }
  },
  cancelRunByRunId: {
    operationId: "cancelRunByRunId",
    method: "POST",
    path: "/api/v1/run-control/by-run/:runId/cancel",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        runId: STRING_SCHEMA
      },
      required: ["runId"]
    },
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        reason: { type: "string" }
      }
    },
    responseSchema: { $ref: "#/components/schemas/CancelRunByRunIdResult" }
  },
  listSessions: {
    operationId: "listSessions",
    method: "GET",
    path: "/api/v1/sessions",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1 }
      }
    },
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        items: { type: "array", items: { $ref: "#/components/schemas/SessionRecord" } },
        nextCursor: { type: "string" }
      },
      required: ["items"]
    }
  },
  searchSessions: {
    operationId: "searchSessions",
    method: "GET",
    path: "/api/v1/sessions/search",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: STRING_SCHEMA,
        personaId: { type: "string" },
        userId: { type: "string" },
        status: { type: "string", enum: ["ok", "failed"] },
        from: { type: "string", format: "date-time" },
        to: { type: "string", format: "date-time" },
        limit: { type: "integer", minimum: 1 }
      }
    },
    responseSchema: { $ref: "#/components/schemas/SessionSearchResult" }
  },
  getSessionTranscript: {
    operationId: "getSessionTranscript",
    method: "GET",
    path: "/api/v1/sessions/:id/transcript",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA
      },
      required: ["id"]
    },
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        after: { type: "string" },
        limit: { type: "integer", minimum: 1 }
      }
    },
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        items: { type: "array", items: { $ref: "#/components/schemas/TranscriptEntry" } }
      },
      required: ["items"]
    }
  },
  listSessionArtifacts: {
    operationId: "listSessionArtifacts",
    method: "GET",
    path: "/api/v1/sessions/:id/artifacts",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA
      },
      required: ["id"]
    },
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: { $ref: "#/components/schemas/SessionArtifactSummary" }
        }
      },
      required: ["items"]
    }
  },
  getSessionArtifact: {
    operationId: "getSessionArtifact",
    method: "GET",
    path: "/api/v1/sessions/:id/artifacts/:runId/:artifactId",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA,
        runId: STRING_SCHEMA,
        artifactId: STRING_SCHEMA
      },
      required: ["id", "runId", "artifactId"]
    },
    responseSchema: { $ref: "#/components/schemas/SessionArtifactRecord" }
  },
  streamSessionTranscript: {
    operationId: "streamSessionTranscript",
    method: "GET",
    path: "/api/v1/sessions/:id/transcript/stream",
    stream: "sse",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA
      },
      required: ["id"]
    },
    querySchema: OPTIONAL_STRING_QUERY,
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        ok: { type: "boolean" },
        data: { $ref: "#/components/schemas/TranscriptEntry" }
      },
      required: ["ok", "data"]
    }
  },
  getSessionWorkQueue: {
    operationId: "getSessionWorkQueue",
    method: "GET",
    path: "/api/v1/sessions/:id/work-queue",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA
      },
      required: ["id"]
    },
    responseSchema: { $ref: "#/components/schemas/WorkQueueState" }
  },
  listDirectives: {
    operationId: "listDirectives",
    method: "GET",
    path: "/api/v1/directives",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1 }
      }
    },
    responseSchema: { $ref: "#/components/schemas/DirectiveListResult" }
  },
  createDirective: {
    operationId: "createDirective",
    method: "POST",
    path: "/api/v1/directives",
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        input: STRING_SCHEMA,
        contextRefs: {
          type: "array",
          items: STRING_SCHEMA
        },
        metadata: {
          type: "object",
          additionalProperties: { type: "string" }
        }
      },
      required: ["input"]
    },
    responseSchema: { $ref: "#/components/schemas/Directive" }
  },
  listHarnessProfiles: {
    operationId: "listHarnessProfiles",
    method: "GET",
    path: "/api/v1/harness-profiles",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1 }
      }
    },
    responseSchema: { $ref: "#/components/schemas/HarnessProfileListResult" }
  },
  createHarnessProfile: {
    operationId: "createHarnessProfile",
    method: "POST",
    path: "/api/v1/harness-profiles",
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        displayName: STRING_SCHEMA,
        version: { type: "string", enum: ["v1", "v2"] },
        config: {
          type: "object",
          additionalProperties: false,
          properties: {
            provider: STRING_SCHEMA,
            model: STRING_SCHEMA,
            tools: {
              type: "array",
              items: STRING_SCHEMA
            }
          },
          required: ["provider", "model", "tools"]
        },
        policies: {
          type: "object",
          additionalProperties: false,
          properties: {
            timeoutMs: { type: "integer", minimum: 1 },
            retryLimit: { type: "integer", minimum: 1 },
            budgetUsd: { type: "number", minimum: 0 }
          },
          required: ["timeoutMs", "retryLimit", "budgetUsd"]
        },
        allowedEgress: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              host: STRING_SCHEMA,
              port: { type: "integer", minimum: 1 }
            },
            required: ["host"]
          }
        },
        verificationPolicies: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: STRING_SCHEMA,
              kind: {
                type: "string",
                enum: ["require-evidence"]
              },
              label: STRING_SCHEMA,
              evidenceType: {
                type: "string",
                enum: ["text", "json", "binary"]
              }
            },
            required: ["id", "kind", "label"]
          }
        }
      },
      required: ["displayName", "version", "config", "policies"]
    },
    responseSchema: { $ref: "#/components/schemas/HarnessProfile" }
  },
  listRunTemplates: {
    operationId: "listRunTemplates",
    method: "GET",
    path: "/api/v1/run-templates",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1 }
      }
    },
    responseSchema: { $ref: "#/components/schemas/RunTemplateListResult" }
  },
  createRunTemplate: {
    operationId: "createRunTemplate",
    method: "POST",
    path: "/api/v1/run-templates",
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        harnessProfileId: STRING_SCHEMA,
        directiveTemplate: STRING_SCHEMA,
        defaultParams: {
          type: "object",
          additionalProperties: { type: "string" }
        }
      },
      required: ["harnessProfileId", "directiveTemplate", "defaultParams"]
    },
    responseSchema: { $ref: "#/components/schemas/RunTemplate" }
  },
  runTemplate: {
    operationId: "runTemplate",
    method: "POST",
    path: "/api/v1/templates/:id/run",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA
      },
      required: ["id"]
    },
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        params: {
          type: "object",
          additionalProperties: { type: "string" }
        }
      }
    },
    responseSchema: { $ref: "#/components/schemas/RunResult" }
  },
  listWorkflows: {
    operationId: "listWorkflows",
    method: "GET",
    path: "/api/v1/workflows",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1 }
      }
    },
    responseSchema: { $ref: "#/components/schemas/WorkflowListResult" }
  },
  createWorkflow: {
    operationId: "createWorkflow",
    method: "POST",
    path: "/api/v1/workflows",
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        definition: {
          type: "object",
          additionalProperties: false,
          properties: {
            steps: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: STRING_SCHEMA,
                  directiveId: STRING_SCHEMA,
                  harnessProfileId: STRING_SCHEMA,
                  outputs: {
                    type: "array",
                    items: STRING_SCHEMA
                  },
                  execution: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      maxAttempts: { type: "integer", minimum: 1 },
                      timeoutMs: { type: "integer", minimum: 1 },
                      metadata: {
                        type: "object",
                        additionalProperties: { type: "string" }
                      }
                    }
                  }
                },
                required: ["id", "directiveId", "harnessProfileId"]
              }
            },
            dependencies: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  from: STRING_SCHEMA,
                  to: STRING_SCHEMA,
                  mappings: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        fromOutput: STRING_SCHEMA,
                        toInput: STRING_SCHEMA
                      },
                      required: ["fromOutput", "toInput"]
                    }
                  }
                },
                required: ["from", "to"]
              }
            }
          },
          required: ["steps", "dependencies"]
        }
      },
      required: ["definition"]
    },
    responseSchema: { $ref: "#/components/schemas/Workflow" }
  },
  resumeWorkflow: {
    operationId: "resumeWorkflow",
    method: "POST",
    path: "/api/v1/workflows/run/:id/resume",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA
      },
      required: ["id"]
    },
    responseSchema: { $ref: "#/components/schemas/WorkflowRun" }
  },
  getWorkflowRun: {
    operationId: "getWorkflowRun",
    method: "GET",
    path: "/api/v1/workflows/run/:id",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA
      },
      required: ["id"]
    },
    responseSchema: { $ref: "#/components/schemas/WorkflowRunObservability" }
  },
  searchMemory: {
    operationId: "searchMemory",
    method: "GET",
    path: "/api/v1/memory/search",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: STRING_SCHEMA,
        maxResults: { type: "integer", minimum: 1 },
        minScore: { type: "number", minimum: 0 }
      },
      required: ["query"]
    },
    responseSchema: {
      type: "array",
      items: { $ref: "#/components/schemas/MemorySearchResult" }
    }
  },
  getMemory: {
    operationId: "getMemory",
    method: "POST",
    path: "/api/v1/memory/get",
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        path: STRING_SCHEMA,
        from: { type: "integer", minimum: 1 },
        lines: { type: "integer", minimum: 1 }
      },
      required: ["path"]
    },
    responseSchema: { $ref: "#/components/schemas/MemoryGetResult" }
  },
  enqueueWork: {
    operationId: "enqueueWork",
    method: "POST",
    path: "/api/v1/work/enqueue",
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        sessionId: STRING_SCHEMA,
        payload: STRING_SCHEMA,
        mode: { type: "string", enum: ["followup", "collect"] }
      },
      required: ["sessionId", "payload", "mode"]
    },
    responseSchema: { $ref: "#/components/schemas/WorkQueueState" }
  },
  drainWork: {
    operationId: "drainWork",
    method: "POST",
    path: "/api/v1/work/:sessionId/drain",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        sessionId: STRING_SCHEMA
      },
      required: ["sessionId"]
    },
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        provider: { type: "string" },
        model: { type: "string" }
      }
    },
    responseSchema: { $ref: "#/components/schemas/WorkDrainResult" }
  },
  getA2aObservability: {
    operationId: "getA2aObservability",
    method: "GET",
    path: "/api/v1/work/observability",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        limit: { type: "integer", minimum: 1 },
        windowMinutes: { type: "integer", minimum: 1 },
        bucketMinutes: { type: "integer", minimum: 1 },
        traceId: { type: "string" }
      }
    },
    responseSchema: { $ref: "#/components/schemas/A2aObservabilityResult" }
  },
  listA2aObservabilityAlerts: {
    operationId: "listA2aObservabilityAlerts",
    method: "GET",
    path: "/api/v1/work/observability/alerts",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1 },
        traceId: { type: "string" },
        stepId: { type: "string" },
        severity: { type: "string", enum: ["warning", "critical"] },
        createdAfter: { type: "string", format: "date-time" },
        createdBefore: { type: "string", format: "date-time" }
      }
    },
    responseSchema: { $ref: "#/components/schemas/A2aStallAlertHistoryResult" }
  },
  exportA2aObservabilityAlertsCsv: {
    operationId: "exportA2aObservabilityAlertsCsv",
    method: "GET",
    path: "/api/v1/work/observability/alerts/export.csv",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        traceId: { type: "string" },
        stepId: { type: "string" },
        severity: { type: "string", enum: ["warning", "critical"] },
        createdAfter: { type: "string", format: "date-time" },
        createdBefore: { type: "string", format: "date-time" }
      }
    },
    responseSchema: { type: "string" }
  },
  getA2aFlowGraph: {
    operationId: "getA2aFlowGraph",
    method: "GET",
    path: "/api/v1/work/flows/:traceId",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        traceId: STRING_SCHEMA
      },
      required: ["traceId"]
    },
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        limit: { type: "integer", minimum: 1 },
        types: { type: "string" }
      }
    },
    responseSchema: { $ref: "#/components/schemas/A2aFlowGraphResult" }
  },
  listSchedules: {
    operationId: "listSchedules",
    method: "GET",
    path: "/api/v1/schedules",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1 }
      }
    },
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        items: { type: "array", items: { $ref: "#/components/schemas/ScheduledTask" } },
        nextCursor: { type: "string" }
      },
      required: ["items"]
    }
  },
  createSchedule: {
    operationId: "createSchedule",
    method: "POST",
    path: "/api/v1/schedules",
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA,
        sessionId: STRING_SCHEMA,
        input: STRING_SCHEMA,
        everyMinutes: { type: "integer", minimum: 1 },
        enabled: { type: "boolean" },
        startNow: { type: "boolean" }
      },
      required: ["id", "sessionId", "input", "everyMinutes"]
    },
    responseSchema: { $ref: "#/components/schemas/ScheduledTask" }
  },
  updateSchedule: {
    operationId: "updateSchedule",
    method: "PUT",
    path: "/api/v1/schedules/:id",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA
      },
      required: ["id"]
    },
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        sessionId: STRING_SCHEMA,
        input: STRING_SCHEMA,
        everyMinutes: { type: "integer", minimum: 1 },
        enabled: { type: "boolean" },
        startNow: { type: "boolean" }
      },
      required: ["sessionId", "input", "everyMinutes"]
    },
    responseSchema: { $ref: "#/components/schemas/ScheduledTask" }
  },
  deleteSchedule: {
    operationId: "deleteSchedule",
    method: "DELETE",
    path: "/api/v1/schedules/:id",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA
      },
      required: ["id"]
    },
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA,
        removed: { type: "boolean" }
      },
      required: ["id", "removed"]
    }
  },
  runSchedule: {
    operationId: "runSchedule",
    method: "POST",
    path: "/api/v1/schedules/:id/run",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA
      },
      required: ["id"]
    },
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        provider: { type: "string" },
        model: { type: "string" }
      }
    },
    responseSchema: { $ref: "#/components/schemas/ScheduleRunResult" }
  },
  tickSchedules: {
    operationId: "tickSchedules",
    method: "POST",
    path: "/api/v1/schedules/tick",
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        at: { type: "string", format: "date-time" },
        provider: { type: "string" },
        model: { type: "string" }
      }
    },
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        at: { type: "string", format: "date-time" },
        run: { type: "array", items: { $ref: "#/components/schemas/ScheduleRunResult" } },
        skipped: { type: "integer", minimum: 0 }
      },
      required: ["at", "run", "skipped"]
    }
  },
  enableSchedule: {
    operationId: "enableSchedule",
    method: "POST",
    path: "/api/v1/schedules/:id/enable",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA
      },
      required: ["id"]
    },
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA,
        updated: { type: "boolean" },
        schedule: { $ref: "#/components/schemas/ScheduledTask" }
      },
      required: ["id", "updated"]
    }
  },
  disableSchedule: {
    operationId: "disableSchedule",
    method: "POST",
    path: "/api/v1/schedules/:id/disable",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA
      },
      required: ["id"]
    },
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA,
        updated: { type: "boolean" },
        schedule: { $ref: "#/components/schemas/ScheduledTask" }
      },
      required: ["id", "updated"]
    }
  },
  getScheduleLogs: {
    operationId: "getScheduleLogs",
    method: "GET",
    path: "/api/v1/schedules/:id/logs",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA
      },
      required: ["id"]
    },
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        after: { type: "string" },
        limit: { type: "integer", minimum: 1 }
      }
    },
    responseSchema: {
      type: "array",
      items: { $ref: "#/components/schemas/ScheduleRunLog" }
    }
  },
  getFleetSummary: {
    operationId: "getFleetSummary",
    method: "GET",
    path: "/api/v1/fleet/summary",
    responseSchema: { $ref: "#/components/schemas/FleetSummary" }
  },
  getProviderCostSettings: {
    operationId: "getProviderCostSettings",
    method: "GET",
    path: "/api/v1/fleet/cost/settings",
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        schemaVersion: { type: "integer", minimum: 1 },
        updatedAt: { type: "string", format: "date-time" },
        providers: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              provider: { type: "string", minLength: 1 },
              inputCostPer1kTokensUsd: { type: "number", minimum: 0 },
              outputCostPer1kTokensUsd: { type: "number", minimum: 0 },
              updatedAt: { type: "string", format: "date-time" }
            },
            required: ["provider", "inputCostPer1kTokensUsd", "outputCostPer1kTokensUsd", "updatedAt"]
          }
        }
      },
      required: ["schemaVersion", "updatedAt", "providers"]
    }
  },
  putProviderCostSettings: {
    operationId: "putProviderCostSettings",
    method: "PUT",
    path: "/api/v1/fleet/cost/settings",
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        providers: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              provider: { type: "string", minLength: 1 },
              inputCostPer1kTokensUsd: { type: "number", minimum: 0 },
              outputCostPer1kTokensUsd: { type: "number", minimum: 0 }
            },
            required: ["provider", "inputCostPer1kTokensUsd", "outputCostPer1kTokensUsd"]
          }
        }
      },
      required: ["providers"]
    },
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        schemaVersion: { type: "integer", minimum: 1 },
        updatedAt: { type: "string", format: "date-time" },
        providers: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              provider: { type: "string", minLength: 1 },
              inputCostPer1kTokensUsd: { type: "number", minimum: 0 },
              outputCostPer1kTokensUsd: { type: "number", minimum: 0 },
              updatedAt: { type: "string", format: "date-time" }
            },
            required: ["provider", "inputCostPer1kTokensUsd", "outputCostPer1kTokensUsd", "updatedAt"]
          }
        }
      },
      required: ["schemaVersion", "updatedAt", "providers"]
    }
  },
  getFleetCostReportCsv: {
    operationId: "getFleetCostReportCsv",
    method: "GET",
    path: "/api/v1/fleet/cost/report.csv",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        month: { type: "string", minLength: 7 }
      }
    },
    responseSchema: { type: "string" }
  },
  listRbacRoles: {
    operationId: "listRbacRoles",
    method: "GET",
    path: "/api/v1/rbac/roles",
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: { $ref: "#/components/schemas/RbacRoleDefinition" }
        }
      },
      required: ["items"]
    }
  },
  listIdentityRoleAssignments: {
    operationId: "listIdentityRoleAssignments",
    method: "GET",
    path: "/api/v1/rbac/assignments",
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: { $ref: "#/components/schemas/IdentityRoleAssignment" }
        }
      },
      required: ["items"]
    }
  },
  upsertIdentityRoleAssignment: {
    operationId: "upsertIdentityRoleAssignment",
    method: "PUT",
    path: "/api/v1/rbac/assignments/:subject",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        subject: STRING_SCHEMA
      },
      required: ["subject"]
    },
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        role: { type: "string", enum: ["Viewer", "Operator", "Admin"] },
        subjectType: { type: "string", enum: ["identity", "service-token"] },
        updatedBy: { type: "string" }
      },
      required: ["role"]
    },
    responseSchema: { $ref: "#/components/schemas/IdentityRoleAssignment" }
  },
  deleteIdentityRoleAssignment: {
    operationId: "deleteIdentityRoleAssignment",
    method: "DELETE",
    path: "/api/v1/rbac/assignments/:subject",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        subject: STRING_SCHEMA
      },
      required: ["subject"]
    },
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        subject: STRING_SCHEMA,
        removed: { type: "boolean" }
      },
      required: ["subject", "removed"]
    }
  },
  auditIdentityPermissions: {
    operationId: "auditIdentityPermissions",
    method: "GET",
    path: "/api/v1/rbac/audit/:subject",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        subject: STRING_SCHEMA
      },
      required: ["subject"]
    },
    responseSchema: { $ref: "#/components/schemas/IdentityRoleAuditResult" }
  },
  listGovernanceAuditTrail: {
    operationId: "listGovernanceAuditTrail",
    method: "GET",
    path: "/api/v1/governance/audit-trail",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1 },
        actor: { type: "string" },
        categories: { type: "string" },
        createdAfter: { type: "string", format: "date-time" },
        createdBefore: { type: "string", format: "date-time" }
      }
    },
    responseSchema: { $ref: "#/components/schemas/GovernanceAuditHistoryResult" }
  },
  listEvents: {
    operationId: "listEvents",
    method: "GET",
    path: "/api/v1/events",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1 },
        traceId: { type: "string" },
        sessionId: { type: "string" },
        types: { type: "string" },
        createdAfter: { type: "string", format: "date-time" },
        createdBefore: { type: "string", format: "date-time" }
      }
    },
    responseSchema: { $ref: "#/components/schemas/EventQueryResult" }
  },
  streamEvents: {
    operationId: "streamEvents",
    method: "GET",
    path: "/api/v1/events/stream",
    stream: "sse",
    querySchema: OPTIONAL_STRING_QUERY,
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        ok: { type: "boolean" },
        data: { $ref: "#/components/schemas/EventRecord" }
      },
      required: ["ok", "data"]
    }
  },
  getPolicy: {
    operationId: "getPolicy",
    method: "GET",
    path: "/api/v1/policy",
    responseSchema: {
      anyOf: [{ $ref: "#/components/schemas/PolicyDocument" }, { type: "null" }]
    }
  },
  listRejections: {
    operationId: "listRejections",
    method: "GET",
    path: "/api/v1/rejections",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cursor: { type: "string" },
        offset: { type: "integer", minimum: 0 },
        limit: { type: "integer", minimum: 1 },
        sessionId: { type: "string" },
        createdAfter: { type: "string", format: "date-time" },
        createdBefore: { type: "string", format: "date-time" }
      }
    },
    responseSchema: {
      type: "array",
      items: { $ref: "#/components/schemas/RunRejectionEvent" }
    }
  },
  listPolicyConcurrencyRejections: {
    operationId: "listPolicyConcurrencyRejections",
    method: "GET",
    path: "/api/v1/policy/rejections",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cursor: { type: "string" },
        offset: { type: "integer", minimum: 0 },
        limit: { type: "integer", minimum: 1 },
        sessionId: { type: "string" },
        createdAfter: { type: "string", format: "date-time" },
        createdBefore: { type: "string", format: "date-time" }
      }
    },
    responseSchema: { $ref: "#/components/schemas/PolicyConcurrencyRejectionQueryResult" }
  },
  putPolicy: {
    operationId: "putPolicy",
    method: "PUT",
    path: "/api/v1/policy",
    requestBodySchema: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            schemaVersion: { type: "integer", minimum: 1 },
            updatedAt: {
              anyOf: [
                { type: "string" },
                { type: "integer" },
                { type: "number" },
                { type: "boolean" },
                { type: "null" },
                {
                  type: "array",
                  items: {
                    anyOf: [
                      { type: "string" },
                      { type: "integer" },
                      { type: "number" },
                      { type: "boolean" },
                      { type: "null" },
                      { type: "object", additionalProperties: true }
                    ]
                  }
                },
                { type: "object", additionalProperties: true }
              ]
            },
            maxConcurrentRuns: { type: "integer", minimum: 1 },
            defaultRunTimeoutMs: { type: "integer", minimum: 1 },
            defaultScheduleTimeoutMs: { type: "integer", minimum: 1 },
            retryBudgetPerRun: { type: "integer", minimum: 0 },
            costBudgetDailyUsd: { type: "number", minimum: 0 }
          },
          required: ["schemaVersion"]
        },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            policy: { $ref: "#/components/schemas/PolicyDocument" },
            auditComment: { type: "string", minLength: 1 }
          },
          required: ["policy", "auditComment"]
        }
      ]
    },
    responseSchema: { $ref: "#/components/schemas/PolicyDocument" }
  },
  runSpecialist: {
    operationId: "runSpecialist",
    method: "POST",
    path: "/api/v1/specialists/run",
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: STRING_SCHEMA,
        repoPath: STRING_SCHEMA,
        headRef: STRING_SCHEMA,
        baseRef: { type: "string" },
        sessionId: { type: "string" },
        provider: { type: "string" },
        model: { type: "string" },
        outJsonPath: { type: "string" },
        outMarkdownPath: { type: "string" },
        stdout: { type: "string", enum: ["summary", "json", "md", "none"] }
      },
      required: ["name", "repoPath", "headRef"]
    },
    responseSchema: { $ref: "#/components/schemas/PersonaRunResponse" }
  },
  runPersona: {
    operationId: "runPersona",
    method: "POST",
    path: "/api/v1/personas/run",
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: STRING_SCHEMA,
        repoPath: STRING_SCHEMA,
        headRef: STRING_SCHEMA,
        baseRef: { type: "string" },
        sessionId: { type: "string" },
        provider: { type: "string" },
        model: { type: "string" },
        outJsonPath: { type: "string" },
        outMarkdownPath: { type: "string" },
        stdout: { type: "string", enum: ["summary", "json", "md", "none"] }
      },
      required: ["name", "repoPath", "headRef"]
    },
    responseSchema: { $ref: "#/components/schemas/PersonaRunResponse" }
  },
  listA2aDlq: {
    operationId: "listA2aDlq",
    method: "GET",
    path: "/api/v1/a2a/dlq",
    querySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1 },
        status: { type: "string", enum: ["pending", "requeued", "discarded"] }
      }
    },
    responseSchema: { $ref: "#/components/schemas/A2aDlqListResult" }
  },
  requeueA2aDlqItem: {
    operationId: "requeueA2aDlqItem",
    method: "POST",
    path: "/api/v1/a2a/dlq/:id/requeue",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA
      },
      required: ["id"]
    },
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        updated: { type: "boolean" },
        item: { $ref: "#/components/schemas/A2aDlqItem" }
      },
      required: ["updated"]
    }
  },
  discardA2aDlqItem: {
    operationId: "discardA2aDlqItem",
    method: "POST",
    path: "/api/v1/a2a/dlq/:id/discard",
    pathParamsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: STRING_SCHEMA
      },
      required: ["id"]
    },
    requestBodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        auditNote: { type: "string", minLength: 1 }
      }
    },
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        updated: { type: "boolean" },
        item: { $ref: "#/components/schemas/A2aDlqItem" }
      },
      required: ["updated"]
    }
  }
};

type ApiRefSchema = Extract<ApiSchema, { $ref: `#/components/schemas/${string}` }>;
type ApiAnyOfSchema = Extract<ApiSchema, { anyOf: ApiSchema[] }>;
type ApiTypedSchema = Exclude<ApiSchema, ApiRefSchema | ApiAnyOfSchema>;
type ApiStringSchema = Extract<ApiSchema, { type: "string" }>;
type ApiNumericSchema = Extract<ApiSchema, { type: "number" | "integer" }>;

function applySchemaStrictness(base: ApiSchema, hint: ApiSchema | undefined): ApiSchema {
  if (!hint) {
    return base;
  }

  if (isRefSchema(base) || isRefSchema(hint)) {
    return base;
  }

  if (isAnyOfSchema(base)) {
    if (isAnyOfSchema(hint) && hint.anyOf.length === base.anyOf.length) {
      return {
        anyOf: base.anyOf.map((branch, index) => applySchemaStrictness(branch, hint.anyOf[index]))
      };
    }
    return base;
  }

  if (isAnyOfSchema(hint)) {
    return base;
  }

  if (base.type === "array") {
    if (hint.type !== "array") {
      return base;
    }
    return {
      ...base,
      items: applySchemaStrictness(base.items, hint.items)
    };
  }

  if (base.type === "object") {
    if (hint.type !== "object") {
      return base;
    }
    const strictObject: ApiTypedSchema = {
      ...base,
      ...(base.properties
        ? {
            properties: applyObjectPropertyStrictness(base.properties, hint.properties)
          }
        : {}),
      ...(base.additionalProperties !== undefined
        ? {
            additionalProperties: applyAdditionalPropertiesStrictness(
              base.additionalProperties,
              hint.additionalProperties
            )
          }
        : {})
    };
    return strictObject;
  }

  return applyLeafStrictness(base, hint);
}

function applyObjectPropertyStrictness(
  base: Record<string, ApiSchema>,
  hint: Record<string, ApiSchema> | undefined
): Record<string, ApiSchema> {
  if (!hint) {
    return base;
  }
  const merged: Record<string, ApiSchema> = {};
  for (const [name, schema] of Object.entries(base)) {
    merged[name] = applySchemaStrictness(schema, hint[name]);
  }
  return merged;
}

function applyAdditionalPropertiesStrictness(
  base: boolean | ApiSchema,
  hint: boolean | ApiSchema | undefined
): boolean | ApiSchema {
  if (typeof base === "boolean" || typeof hint === "boolean" || hint === undefined) {
    return base;
  }
  return applySchemaStrictness(base, hint);
}

function applyLeafStrictness(base: ApiTypedSchema, hint: ApiTypedSchema): ApiSchema {
  if (base.type !== hint.type) {
    return base;
  }

  if (base.type === "string") {
    const stringHint = hint as ApiStringSchema;
    return {
      ...base,
      ...(stringHint.minLength !== undefined ? { minLength: stringHint.minLength } : {}),
      ...(stringHint.format !== undefined ? { format: stringHint.format } : {}),
      ...(stringHint.enum !== undefined ? { enum: stringHint.enum } : {})
    };
  }

  if (base.type === "number" || base.type === "integer") {
    const numericHint = hint as ApiNumericSchema;
    return {
      ...base,
      ...(numericHint.minimum !== undefined ? { minimum: numericHint.minimum } : {})
    };
  }

  return base;
}

function isRefSchema(schema: ApiSchema): schema is ApiRefSchema {
  return "$ref" in schema;
}

function isAnyOfSchema(schema: ApiSchema): schema is ApiAnyOfSchema {
  return "anyOf" in schema;
}

export function assertApiRouteSchemasComplete(): void {
  for (const route of API_V1_ROUTES) {
    const schema = API_V1_OPERATION_SCHEMAS[route.operationId];
    if (!schema) {
      throw new Error(`Missing schema for operation '${route.operationId}'.`);
    }
    if (schema.method !== route.method || schema.path !== route.path) {
      throw new Error(`Schema mismatch for operation '${route.operationId}'.`);
    }
    if (route.stream && schema.stream !== route.stream) {
      throw new Error(`Schema stream mismatch for operation '${route.operationId}'.`);
    }
  }
}

export function assertApiResponseSchema(operationId: string, payload: unknown): void {
  const schema = API_V1_OPERATION_SCHEMAS[operationId]?.responseSchema;
  if (!schema) {
    return;
  }
  const errors = validateSchema(payload, schema, "$response");
  if (errors.length > 0) {
    throw new AthenaError("SESSION_IO_ERROR", `response schema validation failed for ${operationId}: ${errors[0]}`);
  }
}

export function validateSchema(value: unknown, schema: ApiSchema, path = "$", seenRefs = new Set<string>()): string[] {
  if ("$ref" in schema) {
    const refName = schema.$ref.slice("#/components/schemas/".length);
    if (seenRefs.has(refName)) {
      return [];
    }
    const refSchema = API_COMPONENT_SCHEMAS[refName];
    if (!refSchema) {
      return [`${path}: unresolved schema ref '${schema.$ref}'`];
    }
    const nextSeen = new Set(seenRefs);
    nextSeen.add(refName);
    return validateSchema(value, refSchema, path, nextSeen);
  }

  if ("anyOf" in schema) {
    for (const option of schema.anyOf) {
      if (validateSchema(value, option, path, seenRefs).length === 0) {
        return [];
      }
    }
    return [`${path}: expected value to match one of anyOf schemas`];
  }

  if (schema.type === "null") {
    return value === null ? [] : [`${path}: expected null`];
  }

  if (schema.type === "string") {
    if (typeof value !== "string") {
      return [`${path}: expected string`];
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      return [`${path}: expected string length >= ${schema.minLength}`];
    }
    if (schema.enum && !schema.enum.includes(value)) {
      return [`${path}: expected one of [${schema.enum.join(", ")}]`];
    }
    if (schema.format === "date-time" && Number.isNaN(new Date(value).getTime())) {
      return [`${path}: expected RFC3339 date-time string`];
    }
    return [];
  }

  if (schema.type === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      return [`${path}: expected integer`];
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      return [`${path}: expected integer >= ${schema.minimum}`];
    }
    return [];
  }

  if (schema.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return [`${path}: expected number`];
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      return [`${path}: expected number >= ${schema.minimum}`];
    }
    return [];
  }

  if (schema.type === "boolean") {
    return typeof value === "boolean" ? [] : [`${path}: expected boolean`];
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      return [`${path}: expected array`];
    }
    for (let i = 0; i < value.length; i += 1) {
      const itemErrors = validateSchema(value[i], schema.items, `${path}[${i}]`, seenRefs);
      if (itemErrors.length > 0) {
        return itemErrors;
      }
    }
    return [];
  }

  if (!isRecord(value)) {
    return [`${path}: expected object`];
  }

  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  for (const key of required) {
    if (!(key in value)) {
      return [`${path}.${key}: required`];
    }
  }

  for (const [key, child] of Object.entries(properties)) {
    if (!(key in value)) {
      continue;
    }
    const childErrors = validateSchema(value[key], child, `${path}.${key}`, seenRefs);
    if (childErrors.length > 0) {
      return childErrors;
    }
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!(key in properties)) {
        return [`${path}.${key}: additional property not allowed`];
      }
    }
  }

  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    for (const key of Object.keys(value)) {
      if (key in properties) {
        continue;
      }
      const childErrors = validateSchema(value[key], schema.additionalProperties, `${path}.${key}`, seenRefs);
      if (childErrors.length > 0) {
        return childErrors;
      }
    }
  }

  return [];
}

export function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
