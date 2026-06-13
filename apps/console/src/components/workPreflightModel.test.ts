import { describe, expect, it } from "vitest";
import { buildWorkPreflightItems, type WorkPreflightStatus } from "./workPreflightModel";
import type { CapabilityPackMetadata, ProviderReadiness } from "../features/agent-catalog";

describe("work preflight model", () => {
  it("marks a fully configured read-only run as ready", () => {
    const items = buildWorkPreflightItems({
      backingLabel: "Backing agent",
      backingName: "Repository Summary",
      backingEmptyLabel: "Choose an agent",
      repositoryName: "AthenaConsole",
      providerReadiness: providerReadiness({ status: "configured" }),
      providerBlocking: false,
      pack: pack(),
      runModeLabel: "Read-only",
      runModeSummary: "No automatic file mutations.",
      missingInputs: 0,
      requiredInputCount: 2,
    });

    expect(statuses(items)).toEqual(["ready", "ready", "ready", "ready", "ready", "ready", "ready"]);
  });

  it("surfaces permission, memory, and policy requirements as warnings with fix paths", () => {
    const items = buildWorkPreflightItems({
      backingLabel: "Backing workflow",
      backingName: "Release Readiness",
      backingEmptyLabel: "Choose a workflow",
      repositoryName: "AthenaConsole",
      providerReadiness: providerReadiness({ status: "configured" }),
      providerBlocking: false,
      pack: pack({
        credentialRequirements: ["github"],
        memoryRequirements: ["workspace"],
        safety: {
          posture: "proposal",
          externalWrites: true,
          approvalRequiredFor: ["pull-request"],
        },
      }),
      runModeLabel: "Propose changes",
      runModeSummary: "Outputs proposals for review.",
      missingInputs: 0,
      requiredInputCount: 1,
    });

    expect(statuses(items)).toEqual(["ready", "ready", "ready", "warning", "warning", "warning", "ready"]);
    expect(items.find((item) => item.kind === "permissions")?.fixPath).toContain("Connect the required account");
    expect(items.find((item) => item.kind === "memory")?.fixPath).toContain("memory scope");
    expect(items.find((item) => item.kind === "policy")?.detail).toContain("Approval required");
  });

  it("blocks missing launch prerequisites", () => {
    const items = buildWorkPreflightItems({
      backingLabel: "Backing agent",
      backingEmptyLabel: "Choose an agent",
      repositoryDetail: "Repository path is missing.",
      providerReadiness: providerReadiness({ status: "missing", required: true }),
      providerBlocking: true,
      runModeLabel: "Read-only",
      runModeSummary: "No automatic file mutations.",
      missingInputs: 2,
      requiredInputCount: 3,
    });

    expect(items.filter((item) => item.status === "blocked").map((item) => item.kind)).toEqual([
      "backing",
      "repository",
      "provider",
      "inputs",
    ]);
    expect(items.find((item) => item.kind === "repository")?.fixPath).toBe("Select a ready repository context.");
    expect(items.find((item) => item.kind === "provider")?.fixPath).toContain("Configure the required model provider");
  });
});

function statuses(items: Array<{ status: WorkPreflightStatus }>): WorkPreflightStatus[] {
  return items.map((item) => item.status);
}

function providerReadiness(input: { status: ProviderReadiness["status"]; required?: boolean }): ProviderReadiness {
  return {
    status: input.status,
    required: input.required ?? false,
    requirements: [],
    message: input.status === "configured" ? "Provider ready." : "Provider is missing.",
  };
}

function pack(overrides: Partial<CapabilityPackMetadata> = {}): CapabilityPackMetadata {
  return {
    category: "software-team",
    maturity: "preview",
    credentialRequirements: [],
    memoryRequirements: [],
    safety: {
      posture: "read-only",
      externalWrites: false,
    },
    ...overrides,
  };
}
