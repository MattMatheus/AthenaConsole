import type { ModelProviderConfigRecord } from "../app-state/domain-repositories/model-providers.js";
import type { ModelProviderRequirement, ProviderReadiness } from "../../shared/contracts/provider-readiness.js";
import type { ModelProviderKind } from "../../shared/contracts/model-providers.js";

export function normalizeModelProviderRequirement(value: unknown): ModelProviderRequirement | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const providerKind = normalizeProviderKind(value.providerKind);
  const providerId = typeof value.providerId === "string" && value.providerId.trim() ? value.providerId.trim() : undefined;
  const model = typeof value.model === "string" && value.model.trim() ? value.model.trim() : undefined;
  const label = typeof value.label === "string" && value.label.trim() ? value.label.trim() : undefined;
  const required = value.required !== false;
  return {
    required,
    ...(providerKind ? { providerKind } : {}),
    ...(providerId ? { providerId } : {}),
    ...(model ? { model } : {}),
    ...(label ? { label } : {})
  };
}

export function normalizeModelProviderRequirements(value: unknown): ModelProviderRequirement[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeModelProviderRequirement(item))
      .filter((item): item is ModelProviderRequirement => item !== undefined);
  }
  const single = normalizeModelProviderRequirement(value);
  return single ? [single] : [];
}

export function evaluateProviderReadiness(
  requirements: ModelProviderRequirement[],
  providers: ModelProviderConfigRecord[]
): ProviderReadiness {
  if (requirements.length === 0) {
    return {
      status: "untested",
      required: false,
      requirements: [],
      message: "No model provider requirement declared."
    };
  }

  const checks = requirements.map((requirement) => evaluateSingleRequirement(requirement, providers));
  const blocking = checks.find((check) => check.status === "invalid") ?? checks.find((check) => check.status === "missing");
  if (blocking) {
    return blocking;
  }
  const configured = checks.find((check) => check.status === "configured");
  return configured ?? checks[0]!;
}

export function combineProviderReadiness(checks: ProviderReadiness[]): ProviderReadiness {
  const meaningful = checks.filter((check) => check.status !== "untested");
  if (meaningful.length === 0) {
    return {
      status: "untested",
      required: false,
      requirements: [],
      message: "No model provider requirement declared."
    };
  }
  const blocking = meaningful.find((check) => check.status === "invalid") ?? meaningful.find((check) => check.status === "missing");
  if (blocking) {
    return {
      ...blocking,
      requirements: meaningful.flatMap((check) => check.requirements)
    };
  }
  const configured = meaningful.find((check) => check.status === "configured")!;
  return {
    ...configured,
    requirements: meaningful.flatMap((check) => check.requirements)
  };
}

function evaluateSingleRequirement(
  requirement: ModelProviderRequirement,
  providers: ModelProviderConfigRecord[]
): ProviderReadiness {
  const provider = selectProvider(requirement, providers);
  const providerKind = requirement.providerKind ?? "openai-compatible";
  if (!provider) {
    return {
      status: "missing",
      required: requirement.required,
      requirements: [requirement],
      providerKind,
      ...(requirement.providerId ? { providerId: requirement.providerId } : {}),
      ...(requirement.model ? { model: requirement.model } : {}),
      message: requirement.providerId
        ? `Required model provider is not configured: ${requirement.providerId}`
        : `No configured ${providerKind} model provider matches this requirement.`
    };
  }

  if (provider.status === "configured") {
    return {
      status: "configured",
      required: requirement.required,
      requirements: [requirement],
      providerId: provider.id,
      providerName: provider.name,
      providerKind: provider.providerKind,
      model: requirement.model ?? provider.defaultModel,
      message: `Model provider is configured: ${provider.name}`
    };
  }

  return {
    status: provider.status === "missing" ? "missing" : "invalid",
    required: requirement.required,
    requirements: [requirement],
    providerId: provider.id,
    providerName: provider.name,
    providerKind: provider.providerKind,
    model: requirement.model ?? provider.defaultModel,
    message: provider.statusMessage ?? `Model provider is ${provider.status}: ${provider.name}`
  };
}

function selectProvider(
  requirement: ModelProviderRequirement,
  providers: ModelProviderConfigRecord[]
): ModelProviderConfigRecord | undefined {
  if (requirement.providerId) {
    return providers.find((provider) => provider.id === requirement.providerId);
  }
  const providerKind = requirement.providerKind ?? "openai-compatible";
  const matchingKind = providers.filter((provider) => provider.providerKind === providerKind);
  if (requirement.model) {
    return matchingKind.find((provider) => provider.defaultModel === requirement.model) ?? matchingKind[0];
  }
  return matchingKind[0];
}

function normalizeProviderKind(value: unknown): ModelProviderKind | undefined {
  return value === "openai-compatible" ? "openai-compatible" : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
