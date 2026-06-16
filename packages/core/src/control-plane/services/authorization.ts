import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig, AuthzDefaultDecision, AuthzMode } from "../../shared/config.js";
import type {
  AthenaRbacRole,
  IdentityRoleAuditResult,
  IdentityRoleAssignment,
  TemplateRunRequest,
  SessionArtifactRecord,
  SessionArtifactSummary,
  TranscriptEntry
} from "../../shared/contracts.js";
import { getRequestAuthContext } from "../auth.js";
import type {
  A2aFlowService,
  A2aObservabilityService,
  AgentCatalogService,
  FailedWorkService,
  DirectiveService,
  EventService,
  OperationsService,
  GovernanceAuditService,
  HarnessProfileService,
  IdentityService,
  LspService,
  MemoryService,
  ConnectedRepositoryService,
  MissionWorkbenchService,
  PolicyService,
  RunService,
  RunTemplateService,
  ScheduleService,
  SessionService,
  ModelProviderConfigService,
  TaskWorkbenchService,
  WorkflowDagExecutorService,
  WorkflowQueueStatusService,
  WorkflowStatusService,
  WorkflowTemplateCatalogService,
  WorkspaceService,
  WorkService
} from "../interfaces.js";
import type { DurableMemoryService } from "./durable-memory.js";

interface AuthorizationRequirement {
  operation:
    | "a2aObservability.get"
    | "a2aObservability.alertHistory.list"
    | "a2aObservability.alertHistory.export"
    | "a2aFlow.get"
    | "agentCatalog.agents.list"
    | "agentCatalog.connectorReadiness.list"
    | "agentCatalog.plugins.list"
    | "failedWork.discard"
    | "failedWork.list"
    | "failedWork.retry"
    | "directives.create"
    | "directives.list"
    | "durableMemory.archive"
    | "durableMemory.delete"
    | "durableMemory.get"
    | "durableMemory.health"
    | "durableMemory.list"
    | "durableMemory.proposal.approve"
    | "durableMemory.proposal.archive"
    | "durableMemory.proposal.create"
    | "durableMemory.proposal.list"
    | "durableMemory.proposal.reject"
    | "durableMemory.search"
    | "durableMemory.snapshot.create"
    | "durableMemory.snapshot.list"
    | "durableMemory.snapshot.restore"
    | "durableMemory.write"
    | "events.list"
    | "operations.cost.export"
    | "operations.cost.settings.read"
    | "operations.cost.settings.write"
    | "operations.summary"
    | "governance.audit.list"
    | "harnessProfiles.create"
    | "harnessProfiles.list"
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
    | "modelProviders.create"
    | "modelProviders.delete"
    | "modelProviders.get"
    | "modelProviders.list"
    | "modelProviders.test"
    | "modelProviders.update"
    | "missionWorkbench.attachTask"
    | "missionWorkbench.create"
    | "missionWorkbench.createTask"
    | "missionWorkbench.get"
    | "missionWorkbench.getRun"
    | "missionWorkbench.list"
    | "missionWorkbench.listRuns"
    | "missionWorkbench.listTasks"
    | "missionWorkbench.runMission"
    | "missionWorkbench.update"
    | "policy.put"
    | "repositories.create"
    | "repositories.delete"
    | "repositories.get"
    | "repositories.inspect"
    | "repositories.inspectPath"
    | "repositories.list"
    | "runs.cancel"
    | "runs.create"
    | "runs.cancelByRunId"
    | "runTemplates.create"
    | "runTemplates.list"
    | "runTemplates.run"
    | "schedules.remove"
    | "schedules.upsert"
    | "sessions.artifacts"
    | "sessions.get"
    | "sessions.list"
    | "sessions.search"
    | "sessions.transcript"
    | "taskWorkbench.cancelRun"
    | "taskWorkbench.create"
    | "taskWorkbench.get"
    | "taskWorkbench.list"
    | "taskWorkbench.metadata"
    | "taskWorkbench.runEvidenceBundle.export"
    | "taskWorkbench.runArtifact.read"
    | "taskWorkbench.runReadiness"
    | "taskWorkbench.run.read"
    | "taskWorkbench.runTask"
    | "taskWorkbench.update"
    | "workflowQueue.status"
    | "workflowRuns.execute"
    | "workflowRun.status"
    | "workflowTemplates.instantiate"
    | "workflowTemplates.list"
    | "work.drain"
    | "work.enqueue"
    | "work.status"
    | "workspaces.create"
    | "workspaces.delete"
    | "workspaces.get"
    | "workspaces.list"
    | "workspaces.members.delete"
    | "workspaces.members.list"
    | "workspaces.members.upsert"
    | "workspaces.update";
  requiredRoles: AthenaRbacRole[];
  agentName?: string;
  sessionId?: string;
  runId?: string;
  workspaceId?: string;
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
    context: {
      role: AthenaRbacRole;
      scope: { global: boolean; agents: string[]; sessionIds: string[]; runIds: string[]; workspaces?: string[] };
      workspaceMemberships?: { workspaceId: string; role: AthenaRbacRole }[];
    }
  ): { denyReason: AuthorizationDenyReason; denyDetail?: string } | undefined {
    if (!this.hasRequiredRole(requirement, context)) {
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

  private hasRequiredRole(
    requirement: AuthorizationRequirement,
    context: {
      role: AthenaRbacRole;
      scope: { global: boolean; agents: string[]; sessionIds: string[]; runIds: string[]; workspaces?: string[] };
      workspaceMemberships?: { workspaceId: string; role: AthenaRbacRole }[];
    }
  ): boolean {
    if (roleSatisfies(context.role, requirement.requiredRoles)) {
      return true;
    }
    if (!requirement.workspaceId) {
      return isWorkspaceListOperation(requirement.operation)
        ? (workspaceScopeIdsForRoles(context, requirement.requiredRoles) ?? []).length > 0
        : false;
    }
    const membership = context.workspaceMemberships?.find((entry) => entry.workspaceId === requirement.workspaceId);
    return membership ? roleSatisfies(membership.role, requirement.requiredRoles) : false;
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
    agentName?: string;
    sessionId?: string;
    runId?: string;
    workspaceId?: string;
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
          ...(requirement.agentName ? { agentName: requirement.agentName } : {}),
          ...(requirement.workspaceId ? { workspaceId: requirement.workspaceId } : {})
        }
      });
    } catch {
      // Authorization auditing should be best-effort and must not mask deny decisions.
    }
  }

  private getScopeViolation(requirement: AuthorizationRequirement, scope: {
    global: boolean;
    agents: string[];
    sessionIds: string[];
    runIds: string[];
    workspaces?: string[];
  }): string | undefined {
    if (scope.global) {
      return undefined;
    }
    const agentScoped = isAgentScopedOperation(requirement.operation);
    if (agentScoped && scope.agents.length > 0) {
      if (!requirement.agentName) {
        return "agentName is required for this scoped operation.";
      }
      if (!scope.agents.includes(requirement.agentName)) {
        return `agent '${requirement.agentName}' is outside allowed scope.`;
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
    const workspaceScoped = isWorkspaceScopedOperation(requirement.operation);
    const workspaces = scope.workspaces ?? [];
    if (workspaceScoped && (workspaces.length > 0 || requirement.workspaceId)) {
      if (!requirement.workspaceId) {
        return "workspaceId is required for this scoped operation.";
      }
      if (!workspaces.includes(requirement.workspaceId)) {
        return `workspace '${requirement.workspaceId}' is outside allowed scope.`;
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
    const agentName = resolveAgentName(request.metadata);
    await this.authorizer.assertAllowed({
      operation: "runs.create",
      requiredRoles: ["Viewer", "Operator", "Admin"],
      sessionId: request.sessionId,
      ...(agentName ? { agentName } : {})
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
    if (!context || context.scope.global || context.scope.agents.length === 0) {
      return listed;
    }
    const allowed = new Set(context.scope.agents);
    const filtered = listed.items.filter((directive) => {
      const agentName = resolveAgentName(directive.metadata);
      return Boolean(agentName && allowed.has(agentName));
    });
    return {
      ...listed,
      items: filtered
    };
  }

  async create(request: Parameters<DirectiveService["create"]>[0]) {
    const agentName = resolveAgentName(request.metadata);
    await this.authorizer.assertAllowed({
      operation: "directives.create",
      requiredRoles: ["Operator", "Admin"],
      ...(agentName ? { agentName } : {})
    });
    return this.delegate.create(request);
  }
}

export class AuthorizedWorkflowStatusService implements WorkflowStatusService {
  constructor(
    private readonly delegate: WorkflowStatusService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async getStatus(runId: string) {
    await this.authorizer.assertAllowed({
      operation: "workflowRun.status",
      requiredRoles: ["Operator", "Admin"],
      runId
    });
    return this.delegate.getStatus(runId);
  }
}

export class AuthorizedWorkflowQueueStatusService implements WorkflowQueueStatusService {
  constructor(
    private readonly delegate: WorkflowQueueStatusService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async getStatus(query?: Parameters<WorkflowQueueStatusService["getStatus"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "workflowQueue.status",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.getStatus(query);
  }
}

export class AuthorizedHarnessProfileService implements HarnessProfileService {
  constructor(
    private readonly delegate: HarnessProfileService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async list(query?: Parameters<HarnessProfileService["list"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "harnessProfiles.list",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.list(query);
  }

  async create(request: Parameters<HarnessProfileService["create"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "harnessProfiles.create",
      requiredRoles: ["Admin"]
    });
    return this.delegate.create(request);
  }
}

export class AuthorizedRunTemplateService implements RunTemplateService {
  constructor(
    private readonly delegate: RunTemplateService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async list(query?: Parameters<RunTemplateService["list"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "runTemplates.list",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.list(query);
  }

  async create(request: Parameters<RunTemplateService["create"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "runTemplates.create",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.create(request);
  }

  async run(id: string, request?: TemplateRunRequest) {
    await this.authorizer.assertAllowed({
      operation: "runTemplates.run",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.run(id, request);
  }
}

export class AuthorizedWorkflowDagExecutorService implements WorkflowDagExecutorService {
  constructor(
    private readonly delegate: WorkflowDagExecutorService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async execute(runId: string) {
    await this.authorizer.assertAllowed({
      operation: "workflowRuns.execute",
      requiredRoles: ["Operator", "Admin"],
      runId
    });
    return this.delegate.execute(runId);
  }

  async resume(runId: string) {
    await this.authorizer.assertAllowed({
      operation: "workflowRuns.execute",
      requiredRoles: ["Operator", "Admin"],
      runId
    });
    return this.delegate.resume(runId);
  }
}

export class AuthorizedWorkflowTemplateCatalogService implements WorkflowTemplateCatalogService {
  constructor(
    private readonly delegate: WorkflowTemplateCatalogService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async list(query?: Parameters<WorkflowTemplateCatalogService["list"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "workflowTemplates.list",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.list(query);
  }

  async instantiate(id: string, request?: Parameters<WorkflowTemplateCatalogService["instantiate"]>[1]) {
    await this.authorizer.assertAllowed({
      operation: "workflowTemplates.instantiate",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.instantiate(id, request);
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

export class AuthorizedModelProviderConfigService implements ModelProviderConfigService {
  constructor(
    private readonly delegate: ModelProviderConfigService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async list() {
    await this.authorizer.assertAllowed({
      operation: "modelProviders.list",
      requiredRoles: ["Admin"]
    });
    const listed = await this.delegate.list(workspaceListOptionsForRoles(["Admin"]));
    const providers = filterByWorkspaceRoleScope(listed.providers, ["Admin"]);
    return {
      ...listed,
      providers,
      total: providers.length
    };
  }

  async get(id: string) {
    const provider = await this.delegate.get(id);
    await this.authorizer.assertAllowed({
      operation: "modelProviders.get",
      requiredRoles: ["Admin"],
      workspaceId: provider.workspaceId
    });
    return provider;
  }

  async create(request: Parameters<ModelProviderConfigService["create"]>[0]) {
    const workspaceId = resolveMutationWorkspaceId(request.workspaceId);
    await this.authorizer.assertAllowed({
      operation: "modelProviders.create",
      requiredRoles: ["Admin"],
      ...(workspaceId ? { workspaceId } : {})
    });
    return this.delegate.create({
      ...request,
      ...(workspaceId ? { workspaceId } : {})
    });
  }

  async update(id: string, request: Parameters<ModelProviderConfigService["update"]>[1]) {
    const provider = await this.delegate.get(id);
    await this.authorizer.assertAllowed({
      operation: "modelProviders.update",
      requiredRoles: ["Admin"],
      workspaceId: provider.workspaceId
    });
    return this.delegate.update(id, request);
  }

  async delete(id: string) {
    const provider = await this.delegate.get(id);
    await this.authorizer.assertAllowed({
      operation: "modelProviders.delete",
      requiredRoles: ["Admin"],
      workspaceId: provider.workspaceId
    });
    return this.delegate.delete(id);
  }

  async test(id: string) {
    const provider = await this.delegate.get(id);
    await this.authorizer.assertAllowed({
      operation: "modelProviders.test",
      requiredRoles: ["Admin"],
      workspaceId: provider.workspaceId
    });
    return this.delegate.test(id);
  }

  resolveRuntimeConfig(id: string) {
    return this.delegate.resolveRuntimeConfig(id);
  }
}

export class AuthorizedWorkspaceService implements WorkspaceService {
  constructor(
    private readonly delegate: WorkspaceService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async list() {
    await this.authorizer.assertAllowed({
      operation: "workspaces.list",
      requiredRoles: ["Admin"]
    });
    return this.delegate.list();
  }

  async get(id: string) {
    await this.authorizer.assertAllowed({
      operation: "workspaces.get",
      requiredRoles: ["Admin"]
    });
    return this.delegate.get(id);
  }

  async create(request: Parameters<WorkspaceService["create"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "workspaces.create",
      requiredRoles: ["Admin"]
    });
    return this.delegate.create(request);
  }

  async update(id: string, request: Parameters<WorkspaceService["update"]>[1]) {
    await this.authorizer.assertAllowed({
      operation: "workspaces.update",
      requiredRoles: ["Admin"]
    });
    return this.delegate.update(id, request);
  }

  async delete(id: string) {
    await this.authorizer.assertAllowed({
      operation: "workspaces.delete",
      requiredRoles: ["Admin"]
    });
    return this.delegate.delete(id);
  }

  async listMembers(workspaceId: string) {
    await this.authorizer.assertAllowed({
      operation: "workspaces.members.list",
      requiredRoles: ["Admin"],
      workspaceId
    });
    return this.delegate.listMembers(workspaceId);
  }

  async getMembershipsForSubject(subject: string) {
    return this.delegate.getMembershipsForSubject(subject);
  }

  async upsertMember(workspaceId: string, subject: string, request: Parameters<WorkspaceService["upsertMember"]>[2]) {
    await this.authorizer.assertAllowed({
      operation: "workspaces.members.upsert",
      requiredRoles: ["Admin"],
      workspaceId
    });
    return this.delegate.upsertMember(workspaceId, subject, request);
  }

  async removeMember(workspaceId: string, subject: string) {
    await this.authorizer.assertAllowed({
      operation: "workspaces.members.delete",
      requiredRoles: ["Admin"],
      workspaceId
    });
    return this.delegate.removeMember(workspaceId, subject);
  }
}

export class AuthorizedConnectedRepositoryService implements ConnectedRepositoryService {
  constructor(
    private readonly delegate: ConnectedRepositoryService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async list() {
    await this.authorizer.assertAllowed({
      operation: "repositories.list",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    const listed = await this.delegate.list(workspaceListOptions());
    const repositories = filterByWorkspaceScope(listed.repositories);
    return {
      ...listed,
      repositories,
      total: repositories.length
    };
  }

  async get(id: string) {
    const repository = await this.delegate.get(id);
    await this.authorizer.assertAllowed({
      operation: "repositories.get",
      requiredRoles: ["Viewer", "Operator", "Admin"],
      workspaceId: repository.workspaceId
    });
    return repository;
  }

  async create(request: Parameters<ConnectedRepositoryService["create"]>[0]) {
    const workspaceId = resolveMutationWorkspaceId(request.workspaceId);
    await this.authorizer.assertAllowed({
      operation: "repositories.create",
      requiredRoles: ["Operator", "Admin"],
      ...(workspaceId ? { workspaceId } : {})
    });
    return this.delegate.create({
      ...request,
      ...(workspaceId ? { workspaceId } : {})
    });
  }

  async delete(id: string) {
    const repository = await this.delegate.get(id);
    await this.authorizer.assertAllowed({
      operation: "repositories.delete",
      requiredRoles: ["Operator", "Admin"],
      workspaceId: repository.workspaceId
    });
    return this.delegate.delete(id);
  }

  async inspect(id: string) {
    const repository = await this.delegate.get(id);
    await this.authorizer.assertAllowed({
      operation: "repositories.inspect",
      requiredRoles: ["Operator", "Admin"],
      workspaceId: repository.workspaceId
    });
    return this.delegate.inspect(id);
  }

  async inspectPath(workspacePath: string) {
    await this.authorizer.assertAllowed({
      operation: "repositories.inspectPath",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.inspectPath(workspacePath);
  }
}

export class AuthorizedTaskWorkbenchService implements TaskWorkbenchService {
  constructor(
    private readonly delegate: TaskWorkbenchService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async metadata() {
    await this.authorizer.assertAllowed({
      operation: "taskWorkbench.metadata",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.metadata();
  }

  async list(query?: Parameters<TaskWorkbenchService["list"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "taskWorkbench.list",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    const workspaceId = resolveListWorkspaceId(query?.workspaceId);
    const listed = await this.delegate.list({
      ...query,
      ...(workspaceId ? { workspaceId } : {})
    });
    if (workspaceId) {
      return listed;
    }
    const tasks = filterByWorkspaceScope(listed.tasks);
    return {
      ...listed,
      tasks,
      total: tasks.length
    };
  }

  async get(id: string) {
    const task = await this.delegate.get(id);
    await this.authorizer.assertAllowed({
      operation: "taskWorkbench.get",
      requiredRoles: ["Viewer", "Operator", "Admin"],
      workspaceId: task.workspaceId
    });
    return task;
  }

  async create(request: Parameters<TaskWorkbenchService["create"]>[0]) {
    const workspaceId = resolveMutationWorkspaceId(request.workspaceId);
    await this.authorizer.assertAllowed({
      operation: "taskWorkbench.create",
      requiredRoles: ["Operator", "Admin"],
      ...(workspaceId ? { workspaceId } : {})
    });
    return this.delegate.create({
      ...request,
      ...(workspaceId ? { workspaceId } : {})
    });
  }

  async update(id: string, request: Parameters<TaskWorkbenchService["update"]>[1]) {
    const task = await this.delegate.get(id);
    await this.authorizer.assertAllowed({
      operation: "taskWorkbench.update",
      requiredRoles: ["Operator", "Admin"],
      workspaceId: task.workspaceId
    });
    return this.delegate.update(id, request);
  }

  async getRun(runId: string) {
    const detail = await this.delegate.getRun(runId);
    await this.authorizer.assertAllowed({
      operation: "taskWorkbench.run.read",
      requiredRoles: ["Viewer", "Operator", "Admin"],
      runId,
      workspaceId: detail.run.workspaceId
    });
    return detail;
  }

  async exportRunEvidenceBundle(runId: string, request?: Parameters<TaskWorkbenchService["exportRunEvidenceBundle"]>[1]) {
    const detail = await this.delegate.getRun(runId);
    await this.authorizer.assertAllowed({
      operation: "taskWorkbench.runEvidenceBundle.export",
      requiredRoles: ["Viewer", "Operator", "Admin"],
      runId,
      workspaceId: detail.run.workspaceId
    });
    return this.delegate.exportRunEvidenceBundle(runId, request);
  }

  async getRunArtifact(runId: string, artifactId: string) {
    const detail = await this.delegate.getRun(runId);
    await this.authorizer.assertAllowed({
      operation: "taskWorkbench.runArtifact.read",
      requiredRoles: ["Viewer", "Operator", "Admin"],
      runId,
      workspaceId: detail.run.workspaceId
    });
    return this.delegate.getRunArtifact(runId, artifactId);
  }

  async getRunReadiness(id: string) {
    const task = await this.delegate.get(id);
    await this.authorizer.assertAllowed({
      operation: "taskWorkbench.runReadiness",
      requiredRoles: ["Viewer", "Operator", "Admin"],
      workspaceId: task.workspaceId
    });
    return this.delegate.getRunReadiness(id);
  }

  async runTask(id: string, request?: Parameters<TaskWorkbenchService["runTask"]>[1]) {
    const task = await this.delegate.get(id);
    await this.authorizer.assertAllowed({
      operation: "taskWorkbench.runTask",
      requiredRoles: ["Operator", "Admin"],
      workspaceId: task.workspaceId,
      ...(task.assignedAgentId ? { agentName: task.assignedAgentId } : {})
    });
    return this.delegate.runTask(id, request);
  }

  async cancelRun(runId: string, request?: Parameters<TaskWorkbenchService["cancelRun"]>[1]) {
    const detail = await this.delegate.getRun(runId);
    await this.authorizer.assertAllowed({
      operation: "taskWorkbench.cancelRun",
      requiredRoles: ["Operator", "Admin"],
      runId,
      workspaceId: detail.run.workspaceId
    });
    return this.delegate.cancelRun(runId, request);
  }
}

export class AuthorizedMissionWorkbenchService implements MissionWorkbenchService {
  constructor(
    private readonly delegate: MissionWorkbenchService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async list(query?: Parameters<MissionWorkbenchService["list"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "missionWorkbench.list",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.list(query);
  }

  async get(id: string) {
    await this.authorizer.assertAllowed({
      operation: "missionWorkbench.get",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.get(id);
  }

  async create(request: Parameters<MissionWorkbenchService["create"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "missionWorkbench.create",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.create(request);
  }

  async update(id: string, request: Parameters<MissionWorkbenchService["update"]>[1]) {
    await this.authorizer.assertAllowed({
      operation: "missionWorkbench.update",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.update(id, request);
  }

  async listTasks(id: string) {
    await this.authorizer.assertAllowed({
      operation: "missionWorkbench.listTasks",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.listTasks(id);
  }

  async attachTask(id: string, request: Parameters<MissionWorkbenchService["attachTask"]>[1]) {
    await this.authorizer.assertAllowed({
      operation: "missionWorkbench.attachTask",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.attachTask(id, request);
  }

  async createTask(id: string, request: Parameters<MissionWorkbenchService["createTask"]>[1]) {
    await this.authorizer.assertAllowed({
      operation: "missionWorkbench.createTask",
      requiredRoles: ["Operator", "Admin"],
      ...(request.assignedAgentId ? { agentName: request.assignedAgentId } : {})
    });
    return this.delegate.createTask(id, request);
  }

  async runMission(id: string, request?: Parameters<MissionWorkbenchService["runMission"]>[1]) {
    await this.authorizer.assertAllowed({
      operation: "missionWorkbench.runMission",
      requiredRoles: ["Operator", "Admin"],
      runId: request?.runId
    });
    return this.delegate.runMission(id, request);
  }

  async listMissionRuns(id: string) {
    await this.authorizer.assertAllowed({
      operation: "missionWorkbench.listRuns",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.listMissionRuns(id);
  }

  async getMissionRun(runId: string) {
    await this.authorizer.assertAllowed({
      operation: "missionWorkbench.getRun",
      requiredRoles: ["Viewer", "Operator", "Admin"],
      runId
    });
    return this.delegate.getMissionRun(runId);
  }
}

export class AuthorizedAgentCatalogService implements AgentCatalogService {
  constructor(
    private readonly delegate: AgentCatalogService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async listPlugins() {
    await this.authorizer.assertAllowed({
      operation: "agentCatalog.plugins.list",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.listPlugins();
  }

  async listAgents(query?: Parameters<AgentCatalogService["listAgents"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "agentCatalog.agents.list",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.listAgents(query);
  }

  async listConnectorReadiness() {
    await this.authorizer.assertAllowed({
      operation: "agentCatalog.connectorReadiness.list",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.listConnectorReadiness();
  }
}

export class AuthorizedDurableMemoryService implements DurableMemoryService {
  constructor(
    private readonly delegate: DurableMemoryService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async write(request: Parameters<DurableMemoryService["write"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "durableMemory.write",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.write(request);
  }

  async get(request: Parameters<DurableMemoryService["get"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "durableMemory.get",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.get(request);
  }

  async list(request: Parameters<DurableMemoryService["list"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "durableMemory.list",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.list(request);
  }

  async search(request: Parameters<DurableMemoryService["search"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "durableMemory.search",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.search(request);
  }

  async archive(request: Parameters<DurableMemoryService["archive"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "durableMemory.archive",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.archive(request);
  }

  async delete(request: Parameters<DurableMemoryService["delete"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "durableMemory.delete",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.delete(request);
  }

  async createProposal(request: Parameters<DurableMemoryService["createProposal"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "durableMemory.proposal.create",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.createProposal(request);
  }

  async listProposals(request: Parameters<DurableMemoryService["listProposals"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "durableMemory.proposal.list",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.listProposals(request);
  }

  async approveProposal(request: Parameters<DurableMemoryService["approveProposal"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "durableMemory.proposal.approve",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.approveProposal(request);
  }

  async rejectProposal(request: Parameters<DurableMemoryService["rejectProposal"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "durableMemory.proposal.reject",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.rejectProposal(request);
  }

  async archiveProposal(request: Parameters<DurableMemoryService["archiveProposal"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "durableMemory.proposal.archive",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.archiveProposal(request);
  }

  async createSnapshot(request: Parameters<DurableMemoryService["createSnapshot"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "durableMemory.snapshot.create",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.createSnapshot(request);
  }

  async listSnapshots(request: Parameters<DurableMemoryService["listSnapshots"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "durableMemory.snapshot.list",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.listSnapshots(request);
  }

  async restoreSnapshot(request: Parameters<DurableMemoryService["restoreSnapshot"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "durableMemory.snapshot.restore",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.restoreSnapshot(request);
  }

  async getHealth() {
    await this.authorizer.assertAllowed({
      operation: "durableMemory.health",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.getHealth();
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

export class AuthorizedOperationsService implements OperationsService {
  constructor(
    private readonly delegate: OperationsService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async getSummary() {
    await this.authorizer.assertAllowed({
      operation: "operations.summary",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.getSummary();
  }

  async getOperationsProviderCostSettings() {
    await this.authorizer.assertAllowed({
      operation: "operations.cost.settings.read",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.getOperationsProviderCostSettings();
  }

  async updateProviderCostSettings(request: Parameters<OperationsService["updateProviderCostSettings"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "operations.cost.settings.write",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.updateProviderCostSettings(request);
  }

  async exportMonthlyCostCsv(request?: Parameters<OperationsService["exportMonthlyCostCsv"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "operations.cost.export",
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

  async exportJsonl(query?: Parameters<GovernanceAuditService["exportJsonl"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "governance.audit.list",
      requiredRoles: ["Admin"]
    });
    return this.delegate.exportJsonl(query);
  }

  async exportCsv(query?: Parameters<GovernanceAuditService["exportCsv"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "governance.audit.list",
      requiredRoles: ["Admin"]
    });
    return this.delegate.exportCsv(query);
  }
}

export class AuthorizedFailedWorkService implements FailedWorkService {
  constructor(
    private readonly delegate: FailedWorkService,
    private readonly authorizer: ServiceAuthorizer
  ) {}

  async list(query?: Parameters<FailedWorkService["list"]>[0]) {
    await this.authorizer.assertAllowed({
      operation: "failedWork.list",
      requiredRoles: ["Viewer", "Operator", "Admin"]
    });
    return this.delegate.list(query);
  }

  async retry(id: string) {
    await this.authorizer.assertAllowed({
      operation: "failedWork.retry",
      requiredRoles: ["Operator", "Admin"]
    });
    return this.delegate.retry(id);
  }

  async discard(id: string) {
    await this.authorizer.assertAllowed({
      operation: "failedWork.discard",
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

function isAgentScopedOperation(operation: AuthorizationRequirement["operation"]): boolean {
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

function isWorkspaceScopedOperation(operation: AuthorizationRequirement["operation"]): boolean {
  return (
    operation === "modelProviders.create" ||
    operation === "modelProviders.delete" ||
    operation === "modelProviders.get" ||
    operation === "modelProviders.test" ||
    operation === "modelProviders.update" ||
    operation === "repositories.create" ||
    operation === "repositories.delete" ||
    operation === "repositories.get" ||
    operation === "repositories.inspect" ||
    operation === "taskWorkbench.cancelRun" ||
    operation === "taskWorkbench.create" ||
    operation === "taskWorkbench.get" ||
    operation === "taskWorkbench.runArtifact.read" ||
    operation === "taskWorkbench.runEvidenceBundle.export" ||
    operation === "taskWorkbench.runReadiness" ||
    operation === "taskWorkbench.run.read" ||
    operation === "taskWorkbench.runTask" ||
    operation === "taskWorkbench.update" ||
    operation === "workspaces.members.delete" ||
    operation === "workspaces.members.list" ||
    operation === "workspaces.members.upsert"
  );
}

function resolveListWorkspaceId(requested?: string): string | undefined {
  const allowed = workspaceScopeIds();
  if (requested && allowed && !allowed.includes(requested)) {
    throw new AthenaError("AUTHZ_DENIED", `Forbidden: workspace '${requested}' is outside allowed scope.`);
  }
  if (requested) {
    return requested;
  }
  if (allowed?.length === 1) {
    return allowed[0];
  }
  return undefined;
}

function resolveMutationWorkspaceId(requested?: string): string | undefined {
  const allowed = workspaceScopeIds();
  if (!allowed) {
    return requested;
  }
  if (requested) {
    if (!allowed.includes(requested)) {
      throw new AthenaError("AUTHZ_DENIED", `Forbidden: workspace '${requested}' is outside allowed scope.`);
    }
    return requested;
  }
  if (allowed.length === 1) {
    return allowed[0];
  }
  throw new AthenaError("AUTHZ_DENIED", "Forbidden: workspaceId is required for this scoped operation.");
}

function filterByWorkspaceScope<T extends { workspaceId: string }>(items: T[]): T[] {
  const allowed = workspaceScopeIds();
  if (!allowed) {
    return items;
  }
  const allowedSet = new Set(allowed);
  return items.filter((item) => allowedSet.has(item.workspaceId));
}

function filterByWorkspaceRoleScope<T extends { workspaceId: string }>(items: T[], requiredRoles: AthenaRbacRole[]): T[] {
  const allowed = workspaceScopeIdsForRoles(getRequestAuthContext(), requiredRoles);
  if (!allowed) {
    return items;
  }
  const allowedSet = new Set(allowed);
  return items.filter((item) => allowedSet.has(item.workspaceId));
}

function workspaceListOptions(): { workspaceIds?: string[] } {
  const allowed = workspaceScopeIds();
  return allowed ? { workspaceIds: allowed } : {};
}

function workspaceListOptionsForRoles(requiredRoles: AthenaRbacRole[]): { workspaceIds?: string[] } {
  const allowed = workspaceScopeIdsForRoles(getRequestAuthContext(), requiredRoles);
  return allowed ? { workspaceIds: allowed } : {};
}

function workspaceScopeIds(): string[] | undefined {
  const context = getRequestAuthContext();
  if (!context || context.scope.global) {
    return undefined;
  }
  return context.scope.workspaces ?? [];
}

function workspaceScopeIdsForRoles(
  context:
    | {
        role: AthenaRbacRole;
        scope: { global: boolean; workspaces?: string[] };
        workspaceMemberships?: { workspaceId: string; role: AthenaRbacRole }[];
      }
    | undefined,
  requiredRoles: AthenaRbacRole[]
): string[] | undefined {
  if (!context || context.scope.global) {
    return undefined;
  }
  const scopedWorkspaces = context.scope.workspaces ?? [];
  if (scopedWorkspaces.length === 0) {
    return [];
  }
  const scopedSet = new Set(scopedWorkspaces);
  const allowed = new Set<string>();
  for (const membership of context.workspaceMemberships ?? []) {
    if (scopedSet.has(membership.workspaceId) && roleSatisfies(membership.role, requiredRoles)) {
      allowed.add(membership.workspaceId);
    }
  }
  return [...allowed];
}

function isWorkspaceListOperation(operation: AuthorizationRequirement["operation"]): boolean {
  return operation === "modelProviders.list";
}

function roleSatisfies(actual: AthenaRbacRole, allowedRoles: AthenaRbacRole[]): boolean {
  return allowedRoles.some((allowed) => roleRank(actual) >= roleRank(allowed));
}

function roleRank(role: AthenaRbacRole): number {
  if (role === "Admin") {
    return 3;
  }
  if (role === "Operator") {
    return 2;
  }
  return 1;
}

function resolveAgentName(metadata: Record<string, string> | undefined): string | undefined {
  if (!metadata) {
    return undefined;
  }
  const agentName = metadata.agentName ?? metadata.agent ?? metadata.agentName ?? metadata.agent;
  const trimmed = agentName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function isSoftEnforceProtectedOperation(operation: AuthorizationRequirement["operation"]): boolean {
  return (
    operation === "policy.put" ||
    operation === "durableMemory.proposal.approve" ||
    operation === "durableMemory.proposal.reject" ||
    operation === "modelProviders.create" ||
    operation === "modelProviders.delete" ||
    operation === "modelProviders.get" ||
    operation === "modelProviders.list" ||
    operation === "modelProviders.test" ||
    operation === "modelProviders.update" ||
    operation === "harnessProfiles.create" ||
    operation === "runTemplates.create" ||
    operation === "runTemplates.run" ||
    operation === "workflowTemplates.instantiate" ||
    operation === "workflowRuns.execute" ||
    operation === "missionWorkbench.create" ||
    operation === "missionWorkbench.update" ||
    operation === "missionWorkbench.runMission" ||
    operation === "missionWorkbench.createTask" ||
    operation === "missionWorkbench.attachTask" ||
    operation === "repositories.create" ||
    operation === "repositories.delete" ||
    operation === "repositories.inspect" ||
    operation === "repositories.inspectPath" ||
    operation === "taskWorkbench.cancelRun" ||
    operation === "taskWorkbench.create" ||
    operation === "taskWorkbench.runTask" ||
    operation === "taskWorkbench.update" ||
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
