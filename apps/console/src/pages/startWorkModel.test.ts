import { describe, expect, it } from "vitest";
import type { AgentCatalogPluginSummary } from "../features/agent-catalog";
import { buildStartWorkOutcomes, startWorkBlockedReasons, startWorkHrefWithContext } from "./startWorkModel";

describe("start work model", () => {
  it("builds ordered outcomes from pack metadata", () => {
    const outcomes = buildStartWorkOutcomes([
      plugin({
        id: "team-orchestrator.samples.first-run",
        outcomeId: "first-run",
        title: "Run the first-run demo",
        targetKind: "workflow",
        targetId: "first-run.demo.workflow",
        order: 0,
      }),
      plugin({
        id: "team-orchestrator.bundled.software-team",
        outcomeId: "repo-summary",
        title: "Summarize a repository",
        targetKind: "agent",
        targetId: "bundled.software-team.repo-summary.local",
        targetVersion: "0.1.0",
        order: 1,
      }),
    ]);

    expect(outcomes.map((outcome) => outcome.title)).toEqual(["Run the first-run demo", "Summarize a repository"]);
    expect(outcomes[0]?.href).toBe("/workflows?templateId=first-run.demo.workflow&capability=Run%20the%20first-run%20demo");
    expect(outcomes[1]?.href).toBe(
      "/tasks?agentId=bundled.software-team.repo-summary.local&capability=Summarize+a+repository&version=0.1.0",
    );
  });

  it("ignores disabled or invalid plugin metadata", () => {
    const disabled = plugin({
      id: "team-orchestrator.disabled",
      outcomeId: "disabled",
      title: "Disabled",
      targetKind: "workflow",
      targetId: "disabled.workflow",
      order: 0,
    });
    disabled.enabled = false;

    expect(buildStartWorkOutcomes([disabled])).toEqual([]);
  });

  it("adds collected context to internal launch links", () => {
    const [outcome] = buildStartWorkOutcomes([
      plugin({
        id: "team-orchestrator.bundled.software-team",
        outcomeId: "repo-summary",
        title: "Summarize a repository",
        targetKind: "agent",
        targetId: "bundled.software-team.repo-summary.local",
        order: 1,
      }),
    ]);

    expect(outcome).toBeDefined();
    expect(startWorkHrefWithContext(outcome!, { repositoryId: "repo-1", runMode: "propose-changes" })).toBe(
      "/tasks?agentId=bundled.software-team.repo-summary.local&capability=Summarize+a+repository&repoId=repo-1&runMode=propose-changes",
    );
  });

  it("blocks outcomes when required context is missing", () => {
    const [outcome] = buildStartWorkOutcomes([
      plugin({
        id: "team-orchestrator.bundled.software-team",
        outcomeId: "repo-summary",
        title: "Summarize a repository",
        targetKind: "agent",
        targetId: "bundled.software-team.repo-summary.local",
        order: 1,
        contextRequirements: ["repository"],
      }),
    ]);

    expect(startWorkBlockedReasons(outcome!, {
      backingReady: true,
      repositoryReady: false,
      providerReady: false,
    })).toEqual(["Select a ready repository.", "Configure the required model provider."]);
  });
});

function plugin(input: {
  id: string;
  outcomeId: string;
  title: string;
  targetKind: "agent" | "workflow";
  targetId: string;
  targetVersion?: string;
  order: number;
  contextRequirements?: string[];
}): AgentCatalogPluginSummary {
  return {
    id: input.id,
    version: "0.1.0",
    path: "/tmp/plugin",
    enabled: true,
    status: "loaded",
    sourceType: "system",
    sourceScope: "system",
    metadata: {
      name: input.id,
      pack: {
        category: "software-team",
        maturity: "preview",
        credentialRequirements: ["none"],
        memoryRequirements: ["none"],
        safety: {
          posture: "read-only",
          externalWrites: false,
        },
        outcomes: [
          {
            id: input.outcomeId,
            title: input.title,
            description: "Outcome description.",
            target: {
              kind: input.targetKind,
              id: input.targetId,
              ...(input.targetVersion ? { version: input.targetVersion } : {}),
            },
            contextRequirements: input.contextRequirements ?? ["none"],
            expectedArtifacts: [{ label: "Summary", format: "markdown" }],
            executionMode: "deterministic",
            ui: {
              icon: "sparkles",
              order: input.order,
            },
          },
        ],
      },
    },
    validationErrors: [],
    agentCount: 0,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}
