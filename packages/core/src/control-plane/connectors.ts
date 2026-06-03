import type { AppStateDatabase } from "./app-state/index.js";

export type ConnectorAuthType = "none" | "api-token" | "oauth" | "local-secret";
export type ConnectorCredentialBindingRequirement = "none" | "required" | "optional";
export type ConnectorOperationClass = "read" | "external-write";
export type ConnectorReadinessStatus = "configured" | "missing-credentials" | "missing-scopes" | "rate-limited" | "degraded" | "blocked";

export interface ConnectorMetadata {
  service: {
    id: string;
    name: string;
    homepage?: string;
    dataResidency?: string;
  };
  auth: {
    type: ConnectorAuthType;
    credentialBinding: ConnectorCredentialBindingRequirement;
    instructions?: string;
  };
  scopes: ConnectorScopeDeclaration[];
  rateLimits?: ConnectorRateLimitDeclaration[];
  retry?: {
    maxAttempts?: number;
    backoff?: "none" | "linear" | "exponential";
  };
  operations: ConnectorOperationDeclaration[];
}

export interface ConnectorScopeDeclaration {
  id: string;
  label: string;
  required: boolean;
  access: "read" | "write" | "read-write";
  reason?: string;
}

export interface ConnectorRateLimitDeclaration {
  id: string;
  limit: number;
  windowSeconds: number;
  appliesTo?: string[];
}

export interface ConnectorOperationDeclaration {
  id: string;
  class: ConnectorOperationClass;
  label?: string;
  scopes: string[];
  approvalRequired?: boolean;
}

export interface ConnectorCredentialBindingUpsert {
  pluginId: string;
  pluginVersion: string;
  serviceId: string;
  bindingRef: string;
  displayName?: string;
  scopes?: string[];
  status?: "bound" | "invalid" | "revoked";
  now?: Date;
}

export interface ConnectorCredentialBindingRecord {
  pluginId: string;
  pluginVersion: string;
  serviceId: string;
  bindingRef: string;
  displayName?: string;
  scopes: string[];
  status: "bound" | "invalid" | "revoked" | string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorReadinessInput {
  pluginId: string;
  pluginVersion: string;
  connector?: ConnectorMetadata;
  binding?: ConnectorCredentialBindingRecord;
  grantedScopes?: string[];
  rateLimitedOperationIds?: string[];
  degraded?: boolean;
  blockedReasons?: string[];
}

export interface ConnectorReadinessReport {
  status: ConnectorReadinessStatus;
  serviceId?: string;
  serviceName?: string;
  credentialState: "not-required" | "missing" | "bound" | "invalid";
  missingScopes: string[];
  requiredScopes: string[];
  rateLimitedOperations: string[];
  reasons: string[];
  nextStep: string;
}

export interface ExternalWriteApprovalEvaluation {
  operationId: string;
  operationClass: ConnectorOperationClass;
  requiresApproval: boolean;
  approved: boolean;
  blocked: boolean;
  riskClass?: "external-write";
  auditContext: Record<string, unknown>;
  message: string;
}

export function upsertConnectorCredentialBinding(
  appState: AppStateDatabase,
  input: ConnectorCredentialBindingUpsert
): ConnectorCredentialBindingRecord {
  return appState.connectorCredentialBindings.upsert(input);
}

export function getConnectorCredentialBinding(
  appState: AppStateDatabase,
  pluginId: string,
  pluginVersion: string,
  serviceId: string
): ConnectorCredentialBindingRecord | undefined {
  return appState.connectorCredentialBindings.get(pluginId, pluginVersion, serviceId);
}

export function evaluateConnectorReadiness(input: ConnectorReadinessInput): ConnectorReadinessReport {
  const connector = input.connector;
  if (!connector) {
    return {
      status: "blocked",
      credentialState: "not-required",
      missingScopes: [],
      requiredScopes: [],
      rateLimitedOperations: [],
      reasons: ["Connector metadata is not declared."],
      nextStep: "Add connector metadata before using this pack as a connector."
    };
  }

  const requiredScopes = connector.scopes.filter((scope) => scope.required).map((scope) => scope.id).sort();
  const grantedScopes = new Set((input.grantedScopes ?? input.binding?.scopes ?? []).map((scope) => scope.trim()).filter(Boolean));
  const missingScopes = requiredScopes.filter((scope) => !grantedScopes.has(scope));
  const rateLimitedOperations = [...(input.rateLimitedOperationIds ?? [])].sort();
  const blockedReasons = [...(input.blockedReasons ?? [])];
  const credentialState = resolveCredentialState(connector, input.binding);
  const reasons: string[] = [];

  if (credentialState === "missing") {
    reasons.push("Required connector credential binding is missing.");
  }
  if (credentialState === "invalid") {
    reasons.push("Connector credential binding is invalid or revoked.");
  }
  if (missingScopes.length > 0) {
    reasons.push(`Missing required connector scopes: ${missingScopes.join(", ")}.`);
  }
  if (rateLimitedOperations.length > 0) {
    reasons.push(`Connector operations are rate-limited: ${rateLimitedOperations.join(", ")}.`);
  }
  if (input.degraded) {
    reasons.push("Connector is marked degraded by local diagnostics.");
  }
  reasons.push(...blockedReasons);

  const status: ConnectorReadinessStatus =
    blockedReasons.length > 0
      ? "blocked"
      : credentialState === "missing" || credentialState === "invalid"
        ? "missing-credentials"
        : missingScopes.length > 0
          ? "missing-scopes"
          : rateLimitedOperations.length > 0
            ? "rate-limited"
            : input.degraded
              ? "degraded"
              : "configured";

  return {
    status,
    serviceId: connector.service.id,
    serviceName: connector.service.name,
    credentialState,
    missingScopes,
    requiredScopes,
    rateLimitedOperations,
    reasons,
    nextStep: connectorReadinessNextStep(status)
  };
}

export function evaluateExternalWriteApproval(input: {
  connector: ConnectorMetadata;
  operationId: string;
  approvalEvidence?: { approved: boolean; approvedBy?: string; approvalId?: string };
  pluginId?: string;
  runId?: string;
}): ExternalWriteApprovalEvaluation {
  const operation = input.connector.operations.find((candidate) => candidate.id === input.operationId);
  const operationClass: ConnectorOperationClass = operation?.class ?? "external-write";
  const requiresApproval = operationClass === "external-write" || operation?.approvalRequired === true || !operation;
  const approved = requiresApproval ? input.approvalEvidence?.approved === true : true;
  const blocked = requiresApproval && !approved;
  const auditContext = redactConnectorAuditContext({
    pluginId: input.pluginId,
    runId: input.runId,
    serviceId: input.connector.service.id,
    operationId: input.operationId,
    operationClass,
    scopes: operation?.scopes ?? []
  });

  return {
    operationId: input.operationId,
    operationClass,
    requiresApproval,
    approved,
    blocked,
    ...(requiresApproval ? { riskClass: "external-write" as const } : {}),
    auditContext,
    message: blocked
      ? "External connector write is blocked until explicit approval evidence is provided."
      : requiresApproval
        ? "External connector write has explicit approval evidence."
        : "Connector operation is read-only and does not require external-write approval."
  };
}

export function redactConnectorAuditContext(context: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (/secret|token|credential|password|bindingRef/i.test(key)) {
      redacted[key] = "[redacted]";
      continue;
    }
    redacted[key] = Array.isArray(value) ? value.map((item) => String(item)) : value;
  }
  return redacted;
}

function resolveCredentialState(
  connector: ConnectorMetadata,
  binding: ConnectorCredentialBindingRecord | undefined
): ConnectorReadinessReport["credentialState"] {
  if (connector.auth.credentialBinding === "none" || connector.auth.type === "none") {
    return "not-required";
  }
  if (!binding) {
    return "missing";
  }
  if (binding.status !== "bound") {
    return "invalid";
  }
  return "bound";
}

function connectorReadinessNextStep(status: ConnectorReadinessStatus): string {
  switch (status) {
    case "configured":
      return "Connector is locally configured; run fixture-backed checks before live service use.";
    case "missing-credentials":
      return "Bind a connector credential reference without storing the secret in the manifest or task.";
    case "missing-scopes":
      return "Update the credential binding or service authorization to include the required scopes.";
    case "rate-limited":
      return "Wait for the local rate-limit window to reset or choose a lower-volume workflow.";
    case "degraded":
      return "Review connector diagnostics before starting new work.";
    case "blocked":
      return "Resolve the blocking connector diagnostics before running this connector.";
  }
}

