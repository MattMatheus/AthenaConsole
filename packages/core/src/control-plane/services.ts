import { resolve } from "node:path";
import { AthenaError } from "../runtime/errors.js";
import type { AthenaConfig } from "../shared/config.js";
import {
  DockerSandboxExecutionBackend,
  K8sSandboxExecutionBackend,
  LocalSandboxExecutionBackend,
  LocalExecutionBackend,
  type DockerSandboxExecutionBackendOptions,
  type K8sSandboxExecutionBackendOptions,
  type ExecutionBackend,
  type SandboxExecutionBackend
} from "./backends.js";
import {
  K8sLeaseLockProvider,
  LocalMemoryLock,
  RedisLockProvider,
  type IDistributedLock
} from "./distributed-lock.js";
import type { RejectionEventStore } from "./rejection-event-store.js";
import type { IOperationsMetricsProvider } from "./backends/operations-metrics-provider.js";
import { K8sMetricsProvider, type K8sMetricsProviderOptions } from "./backends/k8s-metrics-provider.js";
import {
  AuthorizedA2aObservabilityService,
  AuthorizedA2aFlowService,
  AuthorizedAgentCatalogService,
  AuthorizedFailedWorkService,
  AuthorizedDirectiveService,
  AuthorizedEventService,
  AuthorizedOperationsService,
  AuthorizedDurableMemoryService,
  AuthorizedGovernanceAuditService,
  AuthorizedHarnessProfileService,
  AuthorizedLspService,
  AuthorizedMemoryService,
  AuthorizedModelProviderConfigService,
  AuthorizedMissionWorkbenchService,
  AuthorizedConnectedRepositoryService,
  AuthorizedIdentityService,
  AuthorizedWorkspaceService,
  AuthorizedPolicyService,
  AuthorizedRunService,
  AuthorizedRunTemplateService,
  AuthorizedScheduleService,
  AuthorizedSessionService,
  AuthorizedTaskWorkbenchService,
  AuthorizedWorkService,
  AuthorizedWorkflowDagExecutorService,
  AuthorizedWorkflowQueueStatusService,
  AuthorizedWorkflowStatusService,
  AuthorizedWorkflowTemplateCatalogService,
  ServiceAuthorizer
} from "./services/authorization.js";
import { LocalFailedWorkService, LocalEventService } from "./services/event-dlq.js";
import { LocalA2aFlowService } from "./services/a2a-flow.js";
import { LocalA2aObservabilityService } from "./services/a2a-observability.js";
import { LocalAgentCatalogService } from "./services/agent-catalog.js";
import { LocalMissionWorkbenchService } from "./services/mission-workbench.js";
import { LocalTaskWorkbenchService } from "./services/task-workbench.js";
import { LocalCapabilityService, LocalOperationsMetricsProvider, LocalOperationsService } from "./services/operations.js";
import { AzureBillingOperationsCostProvider } from "./azure-billing-cost-provider.js";
import { LocalIdentityService } from "./services/identity.js";
import { LocalWorkspaceService } from "./services/workspaces.js";
import { LocalGovernanceAuditService } from "./services/governance-audit.js";
import {
  LocalDirectiveService,
  LocalHarnessProfileService,
  LocalMemoryService,
  LocalRunTemplateService,
  LocalScheduleService,
  LocalSessionService,
  LocalWorkService
} from "./services/local-services.js";
import { LocalLspService, type LocalLspServiceOptions } from "./services/lsp.js";
import { LocalPolicyService, PolicyAwareExecutionBackend } from "./services/policy.js";
import { LocalReadinessService } from "./services/readiness.js";
import { LocalConnectedRepositoryService } from "./services/repositories.js";
import { LocalModelProviderConfigService } from "./services/model-providers.js";
import { LocalRunService } from "./services/run-service.js";
import { LocalStateDiagnosticsService } from "./services/state-diagnostics.js";
import { LocalWorkflowQueueStatusService } from "./services/workflow-queue-status.js";
import { LocalWorkflowStatusService } from "./services/workflow-status.js";
import { LocalWorkflowDagExecutorService } from "./services/workflow-dag-executor.js";
import { LocalWorkflowTemplateCatalogService } from "./services/workflow-template-catalog.js";
import { LocalDurableMemoryService, type DurableMemoryService } from "./services/durable-memory.js";
import { recoverStaleTaskAndMissionRuns, recoverStaleWorkflowDagRuns } from "./services/stale-run-recovery.js";
import type {
  FailedWorkService,
  A2aFlowService,
  A2aObservabilityService,
  AgentCatalogService,
  CapabilityService,
  ConnectedRepositoryService,
  ModelProviderConfigService,
  DirectiveService,
  HarnessProfileService,
  LspService,
  MissionWorkbenchService,
  RunTemplateService,
  EventService,
  OperationsService,
  GovernanceAuditService,
  IdentityService,
  WorkspaceService,
  MemoryService,
  PolicyService,
  ReadinessService,
  RunService,
  ScheduleService,
  SessionService,
  StateDiagnosticsService,
  TaskWorkbenchService,
  WorkflowQueueStatusService,
  WorkflowStatusService,
  WorkflowDagExecutorService,
  WorkflowTemplateCatalogService,
  WorkService
} from "./interfaces.js";
import { FileStateStore, type StateStore } from "./state-store.js";
import { openAppStateDatabase } from "./app-state/index.js";
import { indexConfiguredLocalPlugins } from "./plugins/index.js";
import { SqliteHarnessProfileStateStore } from "./state-store/sqlite-harness-profile-state-store.js";
import { SqliteDurableMemoryServerStorage } from "../durable-memory/server-storage.js";

interface LocalControlPlaneOptions {
  config: AthenaConfig;
  executionBackend?: ExecutionBackend;
  sandboxExecutionBackend?: SandboxExecutionBackend;
  sandboxBackendProvider?: "local-placeholder" | "docker" | "k8s";
  dockerSandboxBackendOptions?: DockerSandboxExecutionBackendOptions;
  k8sSandboxBackendOptions?: K8sSandboxExecutionBackendOptions;
  stateStore?: StateStore;
  rejectionEventStore?: RejectionEventStore;
  rejectionEventMaxRecords?: number;
  operationsMetricsProvider?: "local" | "k8s";
  distributedLockProvider?: "local" | "redis" | "k8s-lease";
  distributedLock?: IDistributedLock;
  k8sMetricsProviderOptions?: K8sMetricsProviderOptions;
  lspService?: LspService;
  lspOptions?: LocalLspServiceOptions;
}

// Extracted to services/run-service and services/workflow-service

export interface ControlPlaneServices {
  runService: RunService;
  sessionService: SessionService;
  directiveService: DirectiveService;
  harnessProfileService: HarnessProfileService;
  runTemplateService: RunTemplateService;
  workflowStatusService: WorkflowStatusService;
  workflowQueueStatusService: WorkflowQueueStatusService;
  workflowDagExecutorService: WorkflowDagExecutorService;
  workflowTemplateCatalogService: WorkflowTemplateCatalogService;
  workService: WorkService;
  memoryService: MemoryService;
  durableMemoryService: DurableMemoryService;
  lspService: LspService;
  scheduleService: ScheduleService;
  policyService: PolicyService;
  eventService: EventService;
  failedWorkService: FailedWorkService;
  a2aFlowService: A2aFlowService;
  a2aObservabilityService: A2aObservabilityService;
  operationsService: OperationsService;
  governanceAuditService: GovernanceAuditService;
  identityService: IdentityService;
  workspaceService: WorkspaceService;
  capabilityService: CapabilityService;
  readinessService: ReadinessService;
  stateDiagnosticsService: StateDiagnosticsService;
  agentCatalogService: AgentCatalogService;
  missionWorkbenchService: MissionWorkbenchService;
  taskWorkbenchService: TaskWorkbenchService;
  connectedRepositoryService: ConnectedRepositoryService;
  modelProviderConfigService: ModelProviderConfigService;
  shutdown?: () => Promise<void>;
}

function createDistributedLock(options: LocalControlPlaneOptions): IDistributedLock {
  if (options.distributedLock) {
    return options.distributedLock;
  }
  const provider =
    options.distributedLockProvider ??
    options.config.distributedLockProvider ??
    options.config.lockProviderDefault ??
    "local";
  if (provider === "local") {
    return new LocalMemoryLock();
  }
  if (provider === "redis") {
    if (!options.config.redisUrl) {
      throw new AthenaError(
        "CONFIG_ERROR",
        "ATHENA_DISTRIBUTED_LOCK_PROVIDER=redis requires ATHENA_REDIS_URL to be configured."
      );
    }
    return new RedisLockProvider({
      redisUrl: options.config.redisUrl
    });
  }
  if (provider === "k8s-lease") {
    return new K8sLeaseLockProvider();
  }
  throw new AthenaError("CONFIG_ERROR", `Unsupported distributed lock provider: ${String(provider)}.`);
}

export function createLocalControlPlaneServices(options: LocalControlPlaneOptions): ControlPlaneServices {
  const appState = openAppStateDatabase(options.config);
  try {
    indexConfiguredLocalPlugins(options.config, { appState });
    recoverStaleTaskAndMissionRuns(appState);
    recoverStaleWorkflowDagRuns(appState);
  } finally {
    appState.close();
  }

  const baseExecutionBackend = options.executionBackend ?? new LocalExecutionBackend({ config: options.config });
  const sandboxExecutionBackend = options.sandboxExecutionBackend ?? createSandboxExecutionBackend(options);
  const stateStore = options.stateStore ?? new SqliteHarnessProfileStateStore(new FileStateStore(options.config), options.config);
  const policyService = new LocalPolicyService(options.config, {
    ...(options.rejectionEventStore ? { rejectionEventStore: options.rejectionEventStore } : {}),
    ...(options.rejectionEventMaxRecords !== undefined
      ? { rejectionRetentionMaxRecords: options.rejectionEventMaxRecords }
      : {})
  });
  const eventService = new LocalEventService(options.config);
  const distributedLock = createDistributedLock(options);
  const executionBackend = new PolicyAwareExecutionBackend(
    baseExecutionBackend,
    sandboxExecutionBackend,
    options.config,
    policyService,
    eventService,
    distributedLock
  );
  const runtimeActiveDir = resolve(options.config.workspaceRoot, options.config.stateDir, "runtime", "active");
  const runtimeCancelDir = resolve(options.config.workspaceRoot, options.config.stateDir, "runtime", "cancel");
  const selectedOperationsMetricsProvider =
    options.operationsMetricsProvider ?? options.config.operationsMetricsProvider ?? executionBackend.kind;
  const operationsMetricsProvider: IOperationsMetricsProvider =
    selectedOperationsMetricsProvider === "k8s"
      ? new K8sMetricsProvider(executionBackend, options.k8sMetricsProviderOptions)
      : new LocalOperationsMetricsProvider(stateStore, runtimeActiveDir, runtimeCancelDir);
  const azureBillingCostProvider = new AzureBillingOperationsCostProvider(options.config);

  const authorizer = new ServiceAuthorizer(options.config, eventService);
  const runService = new AuthorizedRunService(
    new LocalRunService(executionBackend, stateStore, options.config, eventService),
    authorizer
  );
  const baseLspService = options.lspService ?? new LocalLspService(options.config, options.lspOptions);
  const scheduleService = new AuthorizedScheduleService(
    new LocalScheduleService(options.config, executionBackend, policyService),
    authorizer
  );
  const sessionService = new AuthorizedSessionService(new LocalSessionService(stateStore, options.config), authorizer);
  const directiveService = new AuthorizedDirectiveService(new LocalDirectiveService(stateStore), authorizer);
  const workflowStatusService = new AuthorizedWorkflowStatusService(new LocalWorkflowStatusService(options.config), authorizer);
  const workflowQueueStatusService = new AuthorizedWorkflowQueueStatusService(
    new LocalWorkflowQueueStatusService(options.config),
    authorizer
  );
  const workService = new AuthorizedWorkService(new LocalWorkService(options.config, executionBackend), authorizer);
  const memoryService = new AuthorizedMemoryService(new LocalMemoryService(options.config), authorizer);
  const durableMemoryDb = openAppStateDatabase(options.config);
  const durableMemoryService = new AuthorizedDurableMemoryService(
    new LocalDurableMemoryService(new SqliteDurableMemoryServerStorage(durableMemoryDb.db)),
    authorizer
  );
  const authorizedLspService = new AuthorizedLspService(baseLspService, authorizer);
  const authorizedEventService = new AuthorizedEventService(eventService, authorizer);
  const failedWorkService = new AuthorizedFailedWorkService(new LocalFailedWorkService(options.config), authorizer);
  const a2aFlowService = new AuthorizedA2aFlowService(new LocalA2aFlowService(eventService), authorizer);
  const a2aObservabilityService = new AuthorizedA2aObservabilityService(
    new LocalA2aObservabilityService(eventService),
    authorizer
  );
  const authorizedPolicyService = new AuthorizedPolicyService(policyService, authorizer);
  const identityService = new AuthorizedIdentityService(new LocalIdentityService(options.config, eventService), authorizer);
  const workspaceService = new AuthorizedWorkspaceService(new LocalWorkspaceService(options.config), authorizer);
  const governanceAuditService = new AuthorizedGovernanceAuditService(new LocalGovernanceAuditService(eventService), authorizer);

  const stateDiagnosticsService = new LocalStateDiagnosticsService(options.config, stateStore);
  const agentCatalogService = new LocalAgentCatalogService(options.config);
  const workflowTemplateCatalogService = new LocalWorkflowTemplateCatalogService(options.config);
  const harnessProfileService = new LocalHarnessProfileService(stateStore, options.config);
  const workflowDagExecutorService = new LocalWorkflowDagExecutorService(options.config);
  const capabilityService = new LocalCapabilityService(executionBackend, operationsMetricsProvider, sandboxExecutionBackend);
  const modelProviderConfigService = new LocalModelProviderConfigService(options.config, { eventService });
  const authorizedModelProviderConfigService = new AuthorizedModelProviderConfigService(modelProviderConfigService, authorizer);
  const readinessService = new LocalReadinessService(options.config, {
    stateDiagnosticsService,
    agentCatalogService,
    workflowTemplateCatalogService,
    capabilityService,
    modelProviderConfigService
  });

  return {
    runService,
    sessionService,
    directiveService,
    harnessProfileService: new AuthorizedHarnessProfileService(harnessProfileService, authorizer),
    runTemplateService: new AuthorizedRunTemplateService(new LocalRunTemplateService(stateStore, runService), authorizer),
    workflowStatusService,
    workflowQueueStatusService,
    workflowDagExecutorService: new AuthorizedWorkflowDagExecutorService(workflowDagExecutorService, authorizer),
    workflowTemplateCatalogService: new AuthorizedWorkflowTemplateCatalogService(workflowTemplateCatalogService, authorizer),
    workService,
    memoryService,
    durableMemoryService,
    lspService: authorizedLspService,
    scheduleService,
    policyService: authorizedPolicyService,
    eventService: authorizedEventService,
    failedWorkService,
    a2aFlowService,
    a2aObservabilityService,
    governanceAuditService,
    identityService,
    workspaceService,
    operationsService: new AuthorizedOperationsService(
      new LocalOperationsService(
        options.config,
        operationsMetricsProvider,
        runService,
        eventService,
        azureBillingCostProvider.isEnabled() ? azureBillingCostProvider : undefined
      ),
      authorizer
    ),
    capabilityService,
    readinessService,
    stateDiagnosticsService,
    agentCatalogService: new AuthorizedAgentCatalogService(agentCatalogService, authorizer),
    missionWorkbenchService: new AuthorizedMissionWorkbenchService(new LocalMissionWorkbenchService(options.config), authorizer),
    taskWorkbenchService: new AuthorizedTaskWorkbenchService(
      new LocalTaskWorkbenchService(options.config, { durableMemoryService, eventService }),
      authorizer
    ),
    connectedRepositoryService: new AuthorizedConnectedRepositoryService(new LocalConnectedRepositoryService(options.config), authorizer),
    modelProviderConfigService: authorizedModelProviderConfigService,
    shutdown: async () => {
      if (hasShutdown(eventService)) {
        await eventService.shutdown();
      }
      if (hasShutdown(baseLspService)) {
        await baseLspService.shutdown();
      }
      durableMemoryDb.close();
    }
  };
}

function hasShutdown<T extends object>(service: T): service is T & { shutdown: () => Promise<void> } {
  return typeof (service as { shutdown?: unknown }).shutdown === "function";
}

function createSandboxExecutionBackend(options: LocalControlPlaneOptions): SandboxExecutionBackend {
  const configuredProvider =
    options.sandboxBackendProvider ??
    (options.config.sandbox?.enabled ? options.config.executionProviderDefault : "local-placeholder");
  if (configuredProvider === "docker") {
    return new DockerSandboxExecutionBackend(options.dockerSandboxBackendOptions);
  }
  if (configuredProvider === "k8s") {
    return new K8sSandboxExecutionBackend(options.k8sSandboxBackendOptions);
  }
  return new LocalSandboxExecutionBackend();
}
