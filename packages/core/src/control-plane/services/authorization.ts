import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig, AuthzDefaultDecision, AuthzMode } from "../../shared/config.js";
import type {
  AthenaRbacRole,
  IdentityRoleAuditResult,
  IdentityRoleAssignment,
  SessionArtifactRecord,
  SessionArtifactSummary,
  TranscriptEntry
} from "../../shared/contracts.js";
import { getRequestAuthContext } from "../auth.js";
import type {
  A2aFlowService,
  A2aObservabilityService,
  A2aDlqService,
  DirectiveService,
  EventService,
  FleetService,
  GovernanceAuditService,
  IdentityService,
  LspService,
  MemoryService,
  PolicyService,
  RunService,
  ScheduleService,
  SessionService,
  WorkflowService,
  WorkService
} from "../interfaces.js";

interface AuthorizationRequirement {
  operation:
    | "a2aObservability.get"
    | "a2aObservability.alertHistory.list"
    | "a2aObservability.alertHistory.export"
    | "a2aFlow.get"
    | "a2aDlq.discard"
    | "a2aDlq.list"
    | "a2aDlq.requeue"
    | "directives.create"
    | "directives.list"
    | "events.list"
    | "fleet.cost.export"
    | "fleet.cost.settings.read"
    | "fleet.cost.settings.write"
    | "fleet.summary"
    | "governance.audit.list"
    | "identity.audit"
    | "identity.assignments.delete"
    | "identity.assignments.list"
    | "identity.assignments.upsert"
    | "identity.roles.list"
    | "lsp.definition"
    | "lsp.references"
    | "lsp.hover"
    | "lsp.symbols"
    | "memory.get"
    | "memory.search"
    | "policy.put"
    | "runs.cancel"
    | "runs.create"
    | "runs.cancelByRunId"
    | "schedules.remove"
    | "schedules.upsert"
    | "sessions.artifacts"
    | "sessions.get"
    | "sessions.list"
    | "sessions.search"
    | "sessions.transcript"
    | "workflow.create"
    | "workflow.list"
    | "workflow.resume"
    | "workflow.status"
    | "work.drain"
    | "work.enqueue"
    | "work.status";
  requiredRoles: AthenaRbacRole[];
  personaName?: string;
  sessionId?: string;
  runId?: string;
}

type AuthorizationDenyReason = "ROLE_MISSING" | "SCOPED_ACCESS_VIOLATION";

export class ServiceAuthorizer {
  constructor(
    private readonly config: AthenaConfig,
    private readonly eventService: EventService
  ) {}

  async assertAllowed(requirement: AuthorizationRequirement): Promise<void> {
    if (!this.config.auth?.enabled) {
      return;
    }
    const mode = this.resolveAuthzMode();
    if (mode === "off") {
      return;
    }
    const context = getRequestAuthContext();
    if (!context) {
      if (this.shouldDenyInMode(mode, requirement.operation, this.resolveDefaultDecision(mode))) {
        throw new AthenaError("AUTH_IDENTITY_MISSING", "Request identity context is missing.");
      }
      return;
    }
    const denied = this.evaluateDenied(requirement, context);
    if (!denied) {
      return;
    }
    await this.emitDenied({
      subject: context.subject,
      role: context.role,
      denyReason: denied.denyReason,
      ...(denied.denyDetail ? { denyDetail: denied.denyDetail } : {}),
      ...requirement
    });
    if (!this.shouldDenyInMode(mode, requirement.operation, this.resolveDefaultDecision(mode))) {
      return;
    }
    if (denied.denyReason === "ROLE_MISSING") {
      throw new AthenaError(
        "AUTHZ_DENIED",
        `Forbidden: ${requirement.operation} requires role ${joinRoles(requirement.requiredRoles)}.`
      );
    }
    throw new AthenaError("AUTHZ_DENIED", `Forbidden: ${requirement.operation} denied by scope constraints.`);
  }

  private evaluateDenied(
    requirement: AuthorizationRequirement,
    context: { role: AthenaRbacRole; scope: { global: boolean; personas: string[]; sessionIds: string[]; runIds: string[] } }
  ): { denyReason: AuthorizationDenyReason; denyDetail?: string } | undefined {
    if (!requirement.requiredRoles.includes(context.role)) {
      return {
        denyReason: "ROLE_MISSING"
      };
    }
    const scopeViolation = this.getScopeViolation(requirement, context.scope);
    if (!scopeViolation) {
      return undefined;
    }
    return {
      denyReason: "SCOPED_ACCESS_VIOLATION",
      denyDetail: scopeViolation
    };
  }

  private resolveAuthzMode(): AuthzMode {
    return this.config.authz?.mode ?? "off";
  }

  private resolveDefaultDecision(mode: AuthzMode): AuthzDefaultDecision {
    if (mode === "observe" || mode === "soft-enforce") {
      return this.config.authz?.defaultDecision ?? "allow";
    }
    return "deny";
  }

  private shouldDenyInMode(
    mode: AuthzMode,
    operation: AuthorizationRequirement["operation"],
    defaultDecision: AuthzDefaultDecision
  ): boolean {
    if (mode === "enforce") {
      return true;
    }
    if (mode === "observe") {
      return defaultDecision === "deny";
    }
    if (mode === "soft-enforce") {
      if (isSoftEnforceProtectedOperation(operation)) {
        return true;
      }
      return defaultDecision === "deny";
    }
    return false;
  }

  private async emitDenied(requirement: {
    subject: string;
    role: AthenaRbacRole;
    operation: AuthorizationRequirement["operation"];
    requiredRoles: AthenaRbacRole[];
    denyReason: AuthorizationDenyReason;
    denyDetail?: string;
    personaName?: string;
    sessionId?: string;
    runId?: string;
  }): Promise<void> {
    try {
      await this.eventService.emit({
        type: "authz.denied",
        ...(requirement.sessionId ? { sessionId: requirement.sessionId } : {}),
        ...(requirement.runId ? { runId: requirement.runId } : {}),
        payload: {
          subject: requirement.subject,
          role: requirement.role,
          operation: requirement.operation,
          requiredRoles: requirement.requiredRoles,
          denyReason: requirement.denyReason,
          ...(requirement.denyReason === "SCOPED_ACCESS_VIOLATION"
            ? {
                detailCode: "SCOPED_ACCESS_VIOLATION",
                ...(requirement.denyDetail ? { denyDetail: requirement.denyDetail } : {})
              }
            : {}),
          ...(requirement.personaName ? { personaName: requirement.personaName } : {})
        }
      });
    } catch {
      // Authorization auditing should be best-effort and must not mask deny decisions.
    }
  }

  private getScopeViolation(requirement: AuthorizationRequirement, scope: {
    global: boolean;
    personas: string[];
    sessionIds: string[];
    runIds: string[];
  }): string | undefined {
    if (scope.global) {
      return undefined;
    }
    const personaScoped = isPersonaScopedOperation(requirement.operation);
    if (personaScoped && scope.personas.length > 0) {
      if (!requirement.personaName) {
        return "personaName is required for this scoped operation.";
      }
      if (!scope.personas.includes(requirement.personaName)) {
        return `persona '${requirement.personaName}' is outside allowed scope.`;
      }
    }
    const sessionScoped = isSessionScopedOperation(requirement.operation);
    if (sessionScoped && scope.sessionIds.length > 0) {
      if (!requirement.sessionId) {
        return "sessionId is required for this scoped operation.";
      }
      if (!scope.sessionIds.includes(requirement.sessionId)) {
        return `session '${requirement.sessionId}' is outside allowed scope.`;
      }
    }
    const runScoped = isRunScopedOperation(requirement.operation);
    if (runScoped && scope.runIds.length > 0) {
      if (!requirement.runId) {
        return "runId is required for this scoped operation.";
      }
      if (!scope.runIds.includes(requirement.runId)) {
        return `run '${requirement.runId}' is outside allowed scope.`;
      }
    }
    return undefined;
  }
}

export class AuthorizedRunService implements RunService {
  constructor(
    private readonly delegate: RunService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async run(request: Parameters<RunService["run"]>[0], options?: Parameters<RunService["run"]>[1]) {
    const personaName = resolvePersonaName(request.metadata);
    await this.authorizer.assertAllowed({
      operation: "runs.create",
      requiredRoles: ["Viewer", "Operator", "Admin"],
      sessionId: request.sessionId,
      ...(personaName ? { personaName } : {})
    });
    return this.delegate.run(request, options);
  }

  async cancel(request: Parameters<RunService["cancel"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "runs.cancel",
      requiredRoles: ["Operator", "Admin"],
      sessionId: request.sessionId
    });
    return this.delegate.cancel(request);
  }

  async cancelByRunId(request: Parameters<RunService["cancelByRunId"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "runs.cancelByRunId",
      requiredRoles: ["Operator", "Admin"],
      runId: request.runId
    });
    return this.delegate.cancelByRunId(request);
  }

  listActiveRuns(query?: Parameters<RunService["listActiveRuns"]>[0]) {
    return this.delegate.listActiveRuns(query);
  }

  listCancellationRequests(query?: Parameters<RunService["listCancellationRequests"]>[0]) {
    return this.delegate.listCancellationRequests(query);
  }
}

export class AuthorizedScheduleService implements ScheduleService {
  constructor(
    private readonly delegate: ScheduleService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  list() {
    return this.delegate.list();
  }

  get(id: string) {
    return this.delegate.get(id);
  }

  async upsert(request: Parameters<ScheduleService["upsert"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "schedules.upsert",
      requiredRoles: ["Operator", "Admin"],
      ...(request.sessionId ? { sessionId: request.sessionId } : {})
    });
    return this.delegate.upsert(request);
  }

  async remove(id: string) {
    await this.authorizer.assertAllowed({
      operation: "schedules.remove",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.remove(id);
  }

  run(id: string, options?: { provider?: string; model?: string }) {
    return this.delegate.run(id, options);
  }

  runDue(at: Date, options?: { provider?: string; model?: string }) {
    return this.delegate.runDue(at, options);
  }

  logs(id: string, options?: { limit?: number }) {
    return this.delegate.logs(id, options);
  }
}

export class AuthorizedPolicyService implements PolicyService {
  constructor(
    private readonly delegate: PolicyService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  get() {
    return this.delegate.get();
  }

  async put(policy: Parameters<PolicyService["put"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "policy.put",
      requiredRoles: ["Admin"]
    });
    return this.delegate.put(policy);
  }

  listConcurrencyRejections(query?: Parameters<PolicyService["listConcurrencyRejections"]>[0]) {
    return this.delegate.listConcurrencyRejections(query);
  }

  recordConcurrencyRejection(record: Parameters<PolicyService["recordConcurrencyRejection"]>[0]) {
    return this.delegate.recordConcurrencyRejection(record);
  }
}

export class AuthorizedSessionService implements SessionService {
  constructor(
    private readonly delegate: SessionService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async listSessions() {
    await this.authorizer.assertAllowed({
      operation: "sessions.list",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    const sessions = await this.delegate.listSessions();
    const context = getRequestAuthContext();
    if (!context || context.scope.global || context.scope.sessionIds.length === 0) {
      return sessions;
    }
    const allowed = new Set(context.scope.sessionIds);
    return sessions.filter((session) => allowed.has(session.id));
  }

  async getSession(sessionId: string) {
    await this.authorizer.assertAllowed({
      operation: "sessions.get",
      requiredRoles: ["Viewer", "Operator", "Admin"],
      sessionId
    });
    return this.delegate.getSession(sessionId);
  }

  async getTranscript(sessionId: string, options?: { limit?: number; after?: string }) {
    await this.authorizer.assertAllowed({
      operation: "sessions.transcript",
      requiredRoles: ["Viewer", "Operator", "Admin"],
      sessionId
    });
    return this.delegate.getTranscript(sessionId, options);
  }

  async subscribeTranscript(sessionId: string, listener: (entry: TranscriptEntry) => void) {
    await this.authorizer.assertAllowed({
      operation: "sessions.transcript",
      requiredRoles: ["Viewer", "Operator", "Admin"],
      sessionId
    });
    return this.delegate.subscribeTranscript(sessionId, listener);
  }

  async listArtifacts(sessionId: string): Promise<SessionArtifactSummary[]> {
    await this.authorizer.assertAllowed({
      operation: "sessions.artifacts",
      requiredRoles: ["Viewer", "Operator", "Admin"],
      sessionId
    });
    return this.delegate.listArtifacts(sessionId);
  }

  async getArtifact(sessionId: string, runId: string, artifactId: string): Promise<SessionArtifactRecord | undefined> {
    await this.authorizer.assertAllowed({
      operation: "sessions.artifacts",
      requiredRoles: ["Viewer", "Operator", "Admin"],
      sessionId
    });
    return this.delegate.getArtifact(sessionId, runId, artifactId);
  }

  async searchSessions(query: Parameters<SessionService["searchSessions"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "sessions.search",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    const searched = await this.delegate.searchSessions(query);
    const context = getRequestAuthContext();
    if (!context || context.scope.global || context.scope.sessionIds.length === 0) {
      return searched;
    }
    const allowed = new Set(context.scope.sessionIds);
    const filteredItems = searched.items.filter((item) => allowed.has(item.session.id));
    return {
      ...searched,
      items: filteredItems,
      total: filteredItems.length
    };
  }
}

export class AuthorizedDirectiveService implements DirectiveService {
  constructor(
    private readonly delegate: DirectiveService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async list(query?: Parameters<DirectiveService["list"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "directives.list",
      requiredRoles: ["Operator", "Admin"]
    });
    const listed = await this.delegate.list(query);
    const context = getRequestAuthContext();
    if (!context || context.scope.global || context.scope.personas.length === 0) {
      return listed;
    }
    const allowed = new Set(context.scope.personas);
    const filtered = listed.items.filter((directive) => {
      const personaName = resolvePersonaName(directive.metadata);
      return Boolean(personaName && allowed.has(personaName));
    });
    return {
      ...listed,
      items: filtered
    };
  }

  async create(request: Parameters<DirectiveService["create"]>[0]) {
    const personaName = resolvePersonaName(request.metadata);
    await this.authorizer.assertAllowed({
      operation: "directives.create",
      requiredRoles: ["Operator", "Admin"],
      ...(personaName ? { personaName } : {})
    });
    return this.delegate.create(request);
  }
}

export class AuthorizedWorkflowService implements WorkflowService {
  constructor(
    private readonly delegate: WorkflowService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async list(query?: Parameters<WorkflowService["list"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "workflow.list",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.list(query);
  }

  async create(request: Parameters<WorkflowService["create"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "workflow.create",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.create(request);
  }

  async status(id: string) {
    await this.authorizer.assertAllowed({
      operation: "workflow.status",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.status(id);
  }

  async resume(id: string) {
    await this.authorizer.assertAllowed({
      operation: "workflow.resume",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.resume(id);
  }
}

export class AuthorizedWorkService implements WorkService {
  constructor(
    private readonly delegate: WorkService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async enqueue(request: Parameters<WorkService["enqueue"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "work.enqueue",
      requiredRoles: ["Operator", "Admin"],
      sessionId: request.sessionId
    });
    return this.delegate.enqueue(request);
  }

  async status(sessionId: string) {
    await this.authorizer.assertAllowed({
      operation: "work.status",
      requiredRoles: ["Operator", "Admin"],
      sessionId
    });
    return this.delegate.status(sessionId);
  }

  async drain(sessionId: string, options?: Parameters<WorkService["drain"]>[1]) {
    await this.authorizer.assertAllowed({
      operation: "work.drain",
      requiredRoles: ["Operator", "Admin"],
      sessionId
    });
    return this.delegate.drain(sessionId, options);
  }
}

export class AuthorizedMemoryService implements MemoryService {
  constructor(
    private readonly delegate: MemoryService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async search(query: string, options?: Parameters<MemoryService["search"]>[1]) {
    await this.authorizer.assertAllowed({
      operation: "memory.search",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.search(query, options);
  }

  async get(request: Parameters<MemoryService["get"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "memory.get",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.get(request);
  }
}

export class AuthorizedLspService implements LspService {
  constructor(
    private readonly delegate: LspService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async getDefinition(file: string, line: number, character: number) {
    await this.authorizer.assertAllowed({
      operation: "lsp.definition",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.getDefinition(file, line, character);
  }

  async getReferences(file: string, line: number, character: number) {
    await this.authorizer.assertAllowed({
      operation: "lsp.references",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.getReferences(file, line, character);
  }

  async getHoverInfo(file: string, line: number, character: number) {
    await this.authorizer.assertAllowed({
      operation: "lsp.hover",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.getHoverInfo(file, line, character);
  }

  async getDocumentSymbols(file: string) {
    await this.authorizer.assertAllowed({
      operation: "lsp.symbols",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.getDocumentSymbols(file);
  }
}

export class AuthorizedEventService implements EventService {
  constructor(
    private readonly delegate: EventService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async list(query?: Parameters<EventService["list"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "events.list",
      requiredRoles: ["Viewer", "Operator", "Admin"],
      ...(query?.sessionId ? { sessionId: query.sessionId } : {})
    });
    return this.delegate.list(query);
  }

  emit(event: Parameters<EventService["emit"]>[0]) {
    return this.delegate.emit(event);
  }
}

export class AuthorizedFleetService implements FleetService {
  constructor(
    private readonly delegate: FleetService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async getSummary() {
    await this.authorizer.assertAllowed({
      operation: "fleet.summary",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.getSummary();
  }

  async getProviderCostSettings() {
    await this.authorizer.assertAllowed({
      operation: "fleet.cost.settings.read",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.getProviderCostSettings();
  }

  async updateProviderCostSettings(request: Parameters<FleetService["updateProviderCostSettings"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "fleet.cost.settings.write",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.updateProviderCostSettings(request);
  }

  async exportMonthlyCostCsv(request?: Parameters<FleetService["exportMonthlyCostCsv"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "fleet.cost.export",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.exportMonthlyCostCsv(request);
  }
}

export class AuthorizedGovernanceAuditService implements GovernanceAuditService {
  constructor(
    private readonly delegate: GovernanceAuditService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async list(query?: Parameters<GovernanceAuditService["list"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "governance.audit.list",
      requiredRoles: ["Admin"]
    });
    return this.delegate.list(query);
  }
}

export class AuthorizedA2aDlqService implements A2aDlqService {
  constructor(
    private readonly delegate: A2aDlqService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async list(query?: Parameters<A2aDlqService["list"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "a2aDlq.list",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.list(query);
  }

  async requeue(id: string) {
    await this.authorizer.assertAllowed({
      operation: "a2aDlq.requeue",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.requeue(id);
  }

  async discard(id: string) {
    await this.authorizer.assertAllowed({
      operation: "a2aDlq.discard",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.discard(id);
  }
}

export class AuthorizedA2aFlowService implements A2aFlowService {
  constructor(
    private readonly delegate: A2aFlowService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async getTrace(traceId: string, query?: Parameters<A2aFlowService["getTrace"]>[1]) {
    await this.authorizer.assertAllowed({
      operation: "a2aFlow.get",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.getTrace(traceId, query);
  }
}

export class AuthorizedA2aObservabilityService implements A2aObservabilityService {
  constructor(
    private readonly delegate: A2aObservabilityService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async getSnapshot(query?: Parameters<A2aObservabilityService["getSnapshot"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "a2aObservability.get",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.getSnapshot(query);
  }

  async listAlertHistory(query?: Parameters<A2aObservabilityService["listAlertHistory"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "a2aObservability.alertHistory.list",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.listAlertHistory(query);
  }

  async exportAlertHistoryCsv(query: Parameters<A2aObservabilityService["exportAlertHistoryCsv"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "a2aObservability.alertHistory.export",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.exportAlertHistoryCsv(query);
  }
}

export class AuthorizedIdentityService implements IdentityService {
  constructor(
    private readonly delegate: IdentityService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async listRoles() {
    await this.authorizer.assertAllowed({
      operation: "identity.roles.list",
      requiredRoles: ["Admin"]
    });
    return this.delegate.listRoles();
  }

  async listAssignments(): Promise<IdentityRoleAssignment[]> {
    await this.authorizer.assertAllowed({
      operation: "identity.assignments.list",
      requiredRoles: ["Admin"]
    });
    return this.delegate.listAssignments();
  }

  async upsertAssignment(request: Parameters<IdentityService["upsertAssignment"]>[0]): Promise<IdentityRoleAssignment> {
    await this.authorizer.assertAllowed({
      operation: "identity.assignments.upsert",
      requiredRoles: ["Admin"]
    });
    return this.delegate.upsertAssignment(request);
  }

  async removeAssignment(subject: string): Promise<{ subject: string; removed: boolean }> {
    await this.authorizer.assertAllowed({
      operation: "identity.assignments.delete",
      requiredRoles: ["Admin"]
    });
    return this.delegate.removeAssignment(subject);
  }

  async auditPermissions(subject: string): Promise<IdentityRoleAuditResult> {
    await this.authorizer.assertAllowed({
      operation: "identity.audit",
      requiredRoles: ["Admin"]
    });
    return this.delegate.auditPermissions(subject);
  }
}

function isPersonaScopedOperation(operation: AuthorizationRequirement["operation"]): boolean {
  return operation === "directives.create" || operation === "runs.create";
}

function isSessionScopedOperation(operation: AuthorizationRequirement["operation"]): boolean {
  return (
    operation === "sessions.get" ||
    operation === "sessions.artifacts" ||
    operation === "sessions.transcript" ||
    operation === "work.enqueue" ||
    operation === "work.status" ||
    operation === "work.drain" ||
    operation === "runs.cancel"
  );
}

function isRunScopedOperation(operation: AuthorizationRequirement["operation"]): boolean {
  return operation === "runs.cancelByRunId";
}

function resolvePersonaName(metadata: Record<string, string> | undefined): string | undefined {
  if (!metadata) {
    return undefined;
  }
  const personaName = metadata.specialistName ?? metadata.specialist ?? metadata.personaName ?? metadata.persona;
  const trimmed = personaName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function isSoftEnforceProtectedOperation(operation: AuthorizationRequirement["operation"]): boolean {
  return (
    operation === "policy.put" ||
    operation === "runs.cancel" ||
    operation === "runs.cancelByRunId" ||
    operation === "a2aObservability.alertHistory.list" ||
    operation === "a2aObservability.alertHistory.export" ||
    operation === "identity.roles.list" ||
    operation === "identity.assignments.list" ||
    operation === "identity.assignments.upsert" ||
    operation === "identity.assignments.delete" ||
    operation === "identity.audit" ||
    operation === "governance.audit.list"
  );
}

function joinRoles(roles: AthenaRbacRole[]): string {
  if (roles.length === 0) {
    return "none";
  }
  if (roles.length === 1) {
    return roles[0]!;
  }
  return `${roles.slice(0, -1).join(", ")} or ${roles[roles.length - 1]!}`;
}
