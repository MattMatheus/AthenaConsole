import type { CapabilityPackMetadata, ProviderReadiness } from "../features/agent-catalog";

export type WorkPreflightStatus = "ready" | "warning" | "blocked";

export type WorkPreflightKind =
  | "backing"
  | "repository"
  | "provider"
  | "permissions"
  | "memory"
  | "policy"
  | "inputs";

export type WorkPreflightItem = {
  kind: WorkPreflightKind;
  label: string;
  value: string;
  status: WorkPreflightStatus;
  detail?: string | undefined;
  fixPath?: string | undefined;
};

export type WorkPreflightConfig = {
  backingLabel: string;
  backingName?: string | undefined;
  backingResolving?: boolean | undefined;
  backingEmptyLabel: string;
  repositoryName?: string | undefined;
  repositoryDetail?: string | undefined;
  repositoryBlocked?: boolean | undefined;
  providerReadiness?: ProviderReadiness | undefined;
  providerBlocking?: boolean | undefined;
  pack?: CapabilityPackMetadata | undefined;
  runModeLabel: string;
  runModeSummary: string;
  policyWarning?: boolean | undefined;
  missingInputs: number;
  requiredInputCount: number;
};

export function buildWorkPreflightItems(config: WorkPreflightConfig): WorkPreflightItem[] {
  const credentialRequirements = actionableRequirements(config.pack?.credentialRequirements);
  const memoryRequirements = actionableRequirements(config.pack?.memoryRequirements);
  const approvalRequirements = actionableRequirements(config.pack?.safety.approvalRequiredFor);
  const policyWarns =
    Boolean(config.policyWarning) || Boolean(config.pack?.safety.externalWrites) || approvalRequirements.length > 0;

  return [
    {
      kind: "backing",
      label: config.backingLabel,
      value: config.backingName ?? (config.backingResolving ? `Resolving selected ${config.backingLabel.toLowerCase()}` : config.backingEmptyLabel),
      status: config.backingName ? "ready" : "blocked",
      fixPath: config.backingName ? undefined : `Choose a ${config.backingLabel.toLowerCase()} from the catalog.`,
    },
    {
      kind: "repository",
      label: "Repository",
      value: config.repositoryName ?? "No repo selected",
      status: config.repositoryName && !config.repositoryBlocked ? "ready" : "blocked",
      detail: config.repositoryDetail,
      fixPath: config.repositoryName && !config.repositoryBlocked ? undefined : "Select a ready repository context.",
    },
    {
      kind: "provider",
      label: "Provider",
      value: config.providerReadiness?.status ?? "No provider checked",
      status: !config.providerReadiness || config.providerBlocking ? "blocked" : "ready",
      detail: config.providerReadiness?.message,
      fixPath: !config.providerReadiness || config.providerBlocking ? "Configure the required model provider before starting work." : undefined,
    },
    {
      kind: "permissions",
      label: "Permissions",
      value: credentialRequirements.length > 0 ? `${credentialRequirements.length} required` : "No connector credentials",
      status: credentialRequirements.length > 0 ? "warning" : "ready",
      detail: credentialRequirements.length > 0 ? credentialRequirements.join(", ") : "No extra connector account required.",
      fixPath: credentialRequirements.length > 0 ? "Connect the required account or choose a lower-permission outcome." : undefined,
    },
    {
      kind: "memory",
      label: "Memory",
      value: memoryRequirements.length > 0 ? `${memoryRequirements.length} scope${memoryRequirements.length === 1 ? "" : "s"}` : "No durable memory",
      status: memoryRequirements.length > 0 ? "warning" : "ready",
      detail: memoryRequirements.length > 0 ? memoryRequirements.join(", ") : "Runs without extra memory scope.",
      fixPath: memoryRequirements.length > 0 ? "Confirm the requested memory scope is available for this workspace." : undefined,
    },
    {
      kind: "policy",
      label: "Policy",
      value: config.runModeLabel,
      status: policyWarns ? "warning" : "ready",
      detail: policyDetail(config, approvalRequirements),
      fixPath: policyWarns ? "Use read-only or proposed changes unless approval is available." : undefined,
    },
    {
      kind: "inputs",
      label: "Required inputs",
      value: config.missingInputs > 0 ? `${config.missingInputs} missing` : "Ready",
      status: config.missingInputs > 0 ? "blocked" : "ready",
      detail: `${config.requiredInputCount} required fields`,
      fixPath: config.missingInputs > 0 ? "Fill the missing required inputs before saving." : undefined,
    },
  ];
}

function actionableRequirements(requirements: string[] | undefined): string[] {
  return (requirements ?? []).filter((item) => item.trim().length > 0 && item.trim().toLowerCase() !== "none");
}

function policyDetail(config: WorkPreflightConfig, approvalRequirements: string[]): string {
  const notes = [config.runModeSummary];
  if (config.pack?.safety.externalWrites) {
    notes.push("Pack can perform external writes.");
  }
  if (approvalRequirements.length > 0) {
    notes.push(`Approval required for ${approvalRequirements.join(", ")}.`);
  }
  if (config.pack?.safety.notes) {
    notes.push(config.pack.safety.notes);
  }
  return notes.join(" ");
}
