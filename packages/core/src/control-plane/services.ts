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
import type { IFleetMetricsProvider } from "./backends/fleet-metrics-provider.js";
import { K8sMetricsProvider, type K8sMetricsProviderOptions } from "./backends/k8s-metrics-provider.js";
import {
  AuthorizedA2aObservabilityService,
  AuthorizedA2aFlowService,
  AuthorizedA2aDlqService,
  AuthorizedDirectiveService,
  AuthorizedEventService,
  AuthorizedFleetService,
  AuthorizedGovernanceAuditService,
  AuthorizedLspService,
  AuthorizedMemoryService,
  AuthorizedIdentityService,
  AuthorizedPolicyService,
  AuthorizedRunService,
  AuthorizedScheduleService,
  AuthorizedSessionService,
  AuthorizedWorkService,
  AuthorizedWorkflowService,
  AuthorizedWorkflowStatusService,
  ServiceAuthorizer
} from "./services/authorization.js";
import { LocalA2aDlqService, LocalEventService } from "./services/event-dlq.js";
import { LocalA2aFlowService } from "./services/a2a-flow.js";
import { LocalA2aObservabilityService } from "./services/a2a-observability.js";
import { LocalAgentCatalogService } from "./services/agent-catalog.js";
import { LocalMissionWorkbenchService } from "./services/mission-workbench.js";
import { LocalTaskWorkbenchService } from "./services/task-workbench.js";
import { LocalCapabilityService, LocalFleetMetricsProvider, LocalFleetService } from "./services/fleet.js";
import { AzureBillingFleetCostProvider } from "./azure-billing-cost-provider.js";
import { LocalIdentityService } from "./services/identity.js";
import { LocalGovernanceAuditService } from "./services/governance-audit.js";
import {
  LocalDirectiveService,
  LocalHarnessProfileService,
  LocalMemoryService,
  LocalSpecialistService,
  LocalRunTemplateService,
  LocalScheduleService,
  LocalSessionService,
  LocalWorkService
} from "./services/local-services.js";
import { LocalLspService, type LocalLspServiceOptions } from "./services/lsp.js";
import { LocalPolicyService, PolicyAwareExecutionBackend } from "./services/policy.js";
import { LocalRunService } from "./services/run-service.js";
import { LocalWorkflowService } from "./services/workflow-service.js";
import { LocalWorkflowStatusService } from "./services/workflow-status.js";
import { LocalWorkflowTemplateCatalogService } from "./services/workflow-template-catalog.js";
import { recoverStaleTaskAndMissionRuns } from "./services/stale-run-recovery.js";
import type {
  A2aDlqService,
  A2aFlowService,
  A2aObservabilityService,
  AgentCatalogService,
  CapabilityService,
  DirectiveService,
  HarnessProfileService,
  LspService,
  MissionWorkbenchService,
  RunTemplateService,
  EventService,
  FleetService,
  GovernanceAuditService,
  IdentityService,
  MemoryService,
  PersonaService,
  SpecialistService,
  PolicyService,
  RunService,
  ScheduleService,
  SessionService,
  TaskWorkbenchService,
  WorkflowService,
  WorkflowStatusService,
  WorkflowTemplateCatalogService,
  WorkService
} from "./interfaces.js";
import { FileStateStore, type StateStore } from "./state-store.js";
import { openAppStateDatabase } from "./app-state/index.js";

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
  fleetMetricsProvider?: "local" | "k8s";
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
  workflowService: WorkflowService;
  workflowStatusService: WorkflowStatusService;
  workflowTemplateCatalogService: WorkflowTemplateCatalogService;
  workService: WorkService;
  memoryService: MemoryService;
  lspService: LspService;
  specialistService: SpecialistService;
  personaService: PersonaService;
  scheduleService: ScheduleService;
  policyService: PolicyService;
  eventService: EventService;
  a2aDlqService: A2aDlqService;
  a2aFlowService: A2aFlowService;
  a2aObservabilityService: A2aObservabilityService;
  fleetService: FleetService;
  governanceAuditService: GovernanceAuditService;
  identityService: IdentityService;
  capabilityService: CapabilityService;
  agentCatalogService: AgentCatalogService;
  missionWorkbenchService: MissionWorkbenchService;
  taskWorkbenchService: TaskWorkbenchService;
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
    recoverStaleTaskAndMissionRuns(appState);
  } finally {
    appState.close();
  }

  const baseExecutionBackend = options.executionBackend ?? new LocalExecutionBackend({ config: options.config });
  const sandboxExecutionBackend = options.sandboxExecutionBackend ?? createSandboxExecutionBackend(options);
  const stateStore = options.stateStore ?? new FileStateStore(options.config);
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
  const selectedFleetMetricsProvider =
    options.fleetMetricsProvider ?? options.config.fleetMetricsProvider ?? executionBackend.kind;
  const fleetMetricsProvider: IFleetMetricsProvider =
    selectedFleetMetricsProvider === "k8s"
      ? new K8sMetricsProvider(executionBackend, options.k8sMetricsProviderOptions)
      : new LocalFleetMetricsProvider(stateStore, runtimeActiveDir, runtimeCancelDir);
  const azureBillingCostProvider = new AzureBillingFleetCostProvider(options.config);

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
  const workflowService = new AuthorizedWorkflowService(new LocalWorkflowService(stateStore, runService), authorizer);
  const workflowStatusService = new AuthorizedWorkflowStatusService(new LocalWorkflowStatusService(options.config), authorizer);
  const workService = new AuthorizedWorkService(new LocalWorkService(options.config, executionBackend), authorizer);
  const memoryService = new AuthorizedMemoryService(new LocalMemoryService(options.config), authorizer);
  const authorizedLspService = new AuthorizedLspService(baseLspService, authorizer);
  const authorizedEventService = new AuthorizedEventService(eventService, authorizer);
  const a2aDlqService = new AuthorizedA2aDlqService(new LocalA2aDlqService(options.config), authorizer);
  const a2aFlowService = new AuthorizedA2aFlowService(new LocalA2aFlowService(eventService), authorizer);
  const a2aObservabilityService = new AuthorizedA2aObservabilityService(
    new LocalA2aObservabilityService(eventService),
    authorizer
  );
  const authorizedPolicyService = new AuthorizedPolicyService(policyService, authorizer);
  const identityService = new AuthorizedIdentityService(new LocalIdentityService(options.config, eventService), authorizer);
  const governanceAuditService = new AuthorizedGovernanceAuditService(new LocalGovernanceAuditService(eventService), authorizer);

  const specialistService = new LocalSpecialistService(options.config, authorizedEventService, authorizedLspService);

  return {
    runService,
    sessionService,
    directiveService,
    harnessProfileService: new LocalHarnessProfileService(stateStore, options.config),
    runTemplateService: new LocalRunTemplateService(stateStore, runService),
    workflowService,
    workflowStatusService,
    workflowTemplateCatalogService: new LocalWorkflowTemplateCatalogService(options.config),
    workService,
    memoryService,
    lspService: authorizedLspService,
    specialistService,
    personaService: specialistService,
    scheduleService,
    policyService: authorizedPolicyService,
    eventService: authorizedEventService,
    a2aDlqService,
    a2aFlowService,
    a2aObservabilityService,
    governanceAuditService,
    identityService,
    fleetService: new AuthorizedFleetService(
      new LocalFleetService(
        options.config,
        fleetMetricsProvider,
        runService,
        eventService,
        azureBillingCostProvider.isEnabled() ? azureBillingCostProvider : undefined
      ),
      authorizer
    ),
    capabilityService: new LocalCapabilityService(executionBackend, fleetMetricsProvider, sandboxExecutionBackend),
    agentCatalogService: new LocalAgentCatalogService(options.config),
    missionWorkbenchService: new LocalMissionWorkbenchService(options.config),
    taskWorkbenchService: new LocalTaskWorkbenchService(options.config),
    shutdown: async () => {
      if (hasShutdown(eventService)) {
        await eventService.shutdown();
      }
      if (hasShutdown(baseLspService)) {
        await baseLspService.shutdown();
      }
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
