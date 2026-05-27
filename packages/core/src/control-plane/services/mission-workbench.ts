import { randomUUID } from "node:crypto";
import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";
import type {
  MissionWorkbenchMission,
  MissionWorkbenchMissionCreateRequest,
  MissionWorkbenchMissionListQuery,
  MissionWorkbenchMissionListResult,
  MissionWorkbenchMissionRun,
  MissionWorkbenchMissionRunChild,
  MissionWorkbenchMissionRunDetail,
  MissionWorkbenchMissionRunListResult,
  MissionWorkbenchMissionRunRequest,
  MissionWorkbenchMissionRunSummary,
  MissionWorkbenchMissionStatus,
  MissionWorkbenchMissionTaskAttachRequest,
  MissionWorkbenchMissionTaskCreateRequest,
  MissionWorkbenchMissionTaskListResult,
  MissionWorkbenchMissionUpdateRequest,
  TaskWorkbenchRunEvent,
  TaskWorkbenchTask,
  TaskWorkbenchTaskRun
} from "../../shared/contracts.js";
import type { AppStateDatabase, MissionRecord, RunEventRecord, RunRecord, TaskRecord } from "../app-state/index.js";
import { openAppStateDatabase } from "../app-state/index.js";
import type { MissionWorkbenchService } from "../interfaces.js";
import { LocalTaskWorkbenchService } from "./task-workbench.js";

export interface LocalMissionWorkbenchServiceOptions {
  appState?: AppStateDatabase;
}

export class LocalMissionWorkbenchService implements MissionWorkbenchService {
  constructor(
    private readonly config: AthenaConfig,
    private readonly options: LocalMissionWorkbenchServiceOptions = {}
  ) {}

  async list(query: MissionWorkbenchMissionListQuery = {}): Promise<MissionWorkbenchMissionListResult> {
    return this.withAppState((appState) => {
      const missions = appState.missions.list(query).map(mapMissionRecord);
      return {
        missions,
        total: missions.length,
        filters: query
      };
    });
  }

  async get(id: string): Promise<MissionWorkbenchMission> {
    return this.withAppState((appState) => mapMissionRecord(requireMission(appState, id)));
  }

  async create(request: MissionWorkbenchMissionCreateRequest): Promise<MissionWorkbenchMission> {
    return this.withAppState((appState) => {
      try {
        return mapMissionRecord(
          appState.missions.create({
            id: request.id ?? `mission-${randomUUID()}`,
            title: request.title,
            ...(request.goal !== undefined ? { goal: request.goal } : {}),
            ...(request.context !== undefined ? { context: request.context } : {}),
            ...(request.status !== undefined ? { status: request.status } : {}),
            ...(request.taskOrder !== undefined ? { taskOrder: uniqueStrings(request.taskOrder) } : {})
          })
        );
      } catch (error) {
        throw normalizeMissionRepositoryError(error);
      }
    });
  }

  async update(id: string, request: MissionWorkbenchMissionUpdateRequest): Promise<MissionWorkbenchMission> {
    return this.withAppState((appState) => {
      requireMission(appState, id);
      try {
        return mapMissionRecord(
          appState.missions.update(id, {
            ...(request.title !== undefined ? { title: request.title } : {}),
            ...(request.goal !== undefined ? { goal: request.goal } : {}),
            ...(request.context !== undefined ? { context: request.context } : {}),
            ...(request.status !== undefined ? { status: request.status } : {}),
            ...(request.taskOrder !== undefined ? { taskOrder: uniqueStrings(request.taskOrder) } : {})
          })
        );
      } catch (error) {
        throw normalizeMissionRepositoryError(error);
      }
    });
  }

  async listTasks(id: string): Promise<MissionWorkbenchMissionTaskListResult> {
    return this.withAppState((appState) => missionTaskListResult(appState, requireMission(appState, id)));
  }

  async attachTask(id: string, request: MissionWorkbenchMissionTaskAttachRequest): Promise<MissionWorkbenchMissionTaskListResult> {
    return this.withAppState((appState) => {
      const mission = requireMission(appState, id);
      const task = appState.tasks.get(request.taskId);
      if (!task) {
        throw new AthenaError("PROVIDER_NOT_FOUND", `Task not found: ${request.taskId}`);
      }
      appState.tasks.update(task.id, {
        missionId: mission.id,
        ...(request.dependsOn !== undefined ? { dependsOn: uniqueStrings(request.dependsOn) } : {})
      });
      const updatedMission = appState.missions.update(mission.id, {
        taskOrder: insertTaskOrder(mission.taskOrder, task.id, request.position)
      });
      return missionTaskListResult(appState, updatedMission);
    });
  }

  async createTask(id: string, request: MissionWorkbenchMissionTaskCreateRequest): Promise<MissionWorkbenchMissionTaskListResult> {
    return this.withAppStateAsync(async (appState) => {
      const mission = requireMission(appState, id);
      const taskWorkbench = new LocalTaskWorkbenchService(this.config, { appState });
      const task = await taskWorkbench.create({
        ...request,
        id: request.id ?? `task-${randomUUID()}`,
        missionId: mission.id,
        ...(request.dependsOn !== undefined ? { dependsOn: uniqueStrings(request.dependsOn) } : {})
      });
      const updatedMission = appState.missions.update(mission.id, {
        taskOrder: insertTaskOrder(mission.taskOrder, task.id, request.position)
      });
      return missionTaskListResult(appState, updatedMission);
    });
  }

  async runMission(id: string, request: MissionWorkbenchMissionRunRequest = {}): Promise<MissionWorkbenchMissionRunDetail> {
    return this.withAppStateAsync(async (appState) => {
      const mission = requireMission(appState, id);
      if (mission.status !== "ready") {
        throw new AthenaError("CONFIG_ERROR", `Mission ${id} must be ready before it can run.`);
      }
      const orderedTasks = getOrderedMissionTaskRecords(appState, mission);
      if (orderedTasks.length === 0) {
        throw new AthenaError("CONFIG_ERROR", `Mission ${id} has no ordered tasks to run.`);
      }

      const runId = request.runId ?? `mission-run-${randomUUID()}`;
      const startedAt = new Date().toISOString();
      let missionRun = appState.runs.create({
        id: runId,
        targetType: "mission",
        targetId: mission.id,
        status: "running",
        backend: "sequential-mission",
        startedAt,
        output: {
          childRuns: []
        }
      });
      appState.missions.update(mission.id, { status: "running" });
      appendMissionRunEvent(appState, missionRun.id, mission.id, "mission.run.started", "Mission run started.", {
        taskOrder: orderedTasks.map((task) => task.id)
      });

      const taskWorkbench = new LocalTaskWorkbenchService(this.config, { appState });
      const completedTaskIds = new Set<string>();
      const childRuns: MissionWorkbenchMissionRunChild[] = [];
      for (const task of orderedTasks) {
        const missingDependencies = task.dependsOn.filter((dependencyId) => !completedTaskIds.has(dependencyId));
        if (missingDependencies.length > 0) {
          return this.finishMissionRun(appState, missionRun, mission.id, childRuns, {
            status: "failed",
            missionStatus: "failed",
            eventType: "mission.task.dependencies.unsatisfied",
            eventMessage: `Mission task dependencies are unsatisfied: ${task.id}.`,
            failure: {
              reason: "unsatisfied-dependencies",
              taskId: task.id,
              missingDependencies
            }
          });
        }

        appendMissionRunEvent(appState, missionRun.id, mission.id, "mission.task.started", `Mission task started: ${task.id}.`, {
          taskId: task.id
        });
        let childRun: TaskWorkbenchTaskRun;
        try {
          childRun = await taskWorkbench.runTask(task.id);
        } catch (error) {
          return this.finishMissionRun(appState, missionRun, mission.id, childRuns, {
            status: "failed",
            missionStatus: "failed",
            eventType: "mission.task.failed-to-start",
            eventMessage: `Mission task failed to start: ${task.id}.`,
            failure: {
              reason: "task-run-error",
              taskId: task.id,
              error: error instanceof Error ? error.message : String(error)
            }
          });
        }
        childRuns.push({ taskId: task.id, runId: childRun.id, status: childRun.status });
        appendMissionRunEvent(
          appState,
          missionRun.id,
          mission.id,
          childRun.status === "completed" ? "mission.task.completed" : "mission.task.stopped",
          `Mission task ${childRun.status}: ${task.id}.`,
          {
            taskId: task.id,
            childRunId: childRun.id,
            status: childRun.status
          }
        );
        if (childRun.status !== "completed") {
          return this.finishMissionRun(appState, missionRun, mission.id, childRuns, {
            status: childRun.status,
            missionStatus: childRun.status === "cancelled" ? "cancelled" : "failed",
            eventType: "mission.run.stopped",
            eventMessage: `Mission run stopped after task ${task.id} finished with status ${childRun.status}.`,
            failure: childRun.failure ?? {
              reason: "child-run-stopped",
              taskId: task.id,
              childRunId: childRun.id,
              status: childRun.status
            },
            safetyStop: childRun.safetyStop
          });
        }
        completedTaskIds.add(task.id);
        missionRun = appState.runs.update(missionRun.id, {
          output: createMissionRunOutput(childRuns)
        });
      }

      return this.finishMissionRun(appState, missionRun, mission.id, childRuns, {
        status: "completed",
        missionStatus: "completed",
        eventType: "mission.run.completed",
        eventMessage: "Mission run completed."
      });
    });
  }

  async listMissionRuns(id: string): Promise<MissionWorkbenchMissionRunListResult> {
    return this.withAppState((appState) => {
      const mission = requireMission(appState, id);
      const runs = appState.runs
        .list({ targetType: "mission", targetId: mission.id })
        .map(mapMissionRunSummaryRecord);
      return {
        mission: mapMissionRecord(mission),
        runs,
        total: runs.length
      };
    });
  }

  async getMissionRun(runId: string): Promise<MissionWorkbenchMissionRunDetail> {
    return this.withAppState((appState) => missionRunDetail(appState, requireMissionRun(appState, runId)));
  }

  private finishMissionRun(
    appState: AppStateDatabase,
    missionRun: RunRecord,
    missionId: string,
    childRuns: MissionWorkbenchMissionRunChild[],
    outcome: {
      status: RunRecord["status"];
      missionStatus: MissionWorkbenchMissionStatus;
      eventType: string;
      eventMessage: string;
      failure?: unknown;
      safetyStop?: unknown;
    }
  ): MissionWorkbenchMissionRunDetail {
    const endedAt = new Date().toISOString();
    const updatedRun = appState.runs.update(missionRun.id, {
      status: outcome.status,
      endedAt,
      output: createMissionRunOutput(childRuns),
      ...(outcome.failure !== undefined ? { failure: outcome.failure } : {}),
      ...(outcome.safetyStop !== undefined ? { safetyStop: outcome.safetyStop } : {})
    });
    appState.missions.update(missionId, { status: outcome.missionStatus });
    appendMissionRunEvent(appState, updatedRun.id, missionId, outcome.eventType, outcome.eventMessage, {
      status: outcome.status,
      childRuns
    });
    return missionRunDetail(appState, updatedRun);
  }

  private withAppState<T>(access: (appState: AppStateDatabase) => T): T {
    if (this.options.appState) {
      return access(this.options.appState);
    }
    const appState = openAppStateDatabase(this.config);
    try {
      return access(appState);
    } finally {
      appState.close();
    }
  }

  private async withAppStateAsync<T>(access: (appState: AppStateDatabase) => Promise<T>): Promise<T> {
    if (this.options.appState) {
      return access(this.options.appState);
    }
    const appState = openAppStateDatabase(this.config);
    try {
      return await access(appState);
    } finally {
      appState.close();
    }
  }
}

function requireMission(appState: AppStateDatabase, id: string): MissionRecord {
  const mission = appState.missions.get(id);
  if (!mission) {
    throw new AthenaError("PROVIDER_NOT_FOUND", `Mission not found: ${id}`);
  }
  return mission;
}

function missionTaskListResult(appState: AppStateDatabase, mission: MissionRecord): MissionWorkbenchMissionTaskListResult {
  const tasksById = new Map(appState.tasks.list({ missionId: mission.id }).map((task) => [task.id, task]));
  const orderedTasks: TaskRecord[] = [];
  for (const taskId of mission.taskOrder) {
    const task = tasksById.get(taskId);
    if (task) {
      orderedTasks.push(task);
      tasksById.delete(taskId);
    }
  }
  const unorderedTasks = [...tasksById.values()].sort(compareTasksDeterministically);
  const tasks = [...orderedTasks, ...unorderedTasks].map(mapTaskRecord);
  return {
    mission: mapMissionRecord(mission),
    tasks,
    total: tasks.length
  };
}

function requireMissionRun(appState: AppStateDatabase, runId: string): RunRecord {
  const run = appState.runs.get(runId);
  if (!run || run.targetType !== "mission") {
    throw new AthenaError("PROVIDER_NOT_FOUND", `Mission run not found: ${runId}`);
  }
  return run;
}

function getOrderedMissionTaskRecords(appState: AppStateDatabase, mission: MissionRecord): TaskRecord[] {
  return mission.taskOrder.map((taskId) => {
    const task = appState.tasks.get(taskId);
    if (!task || task.missionId !== mission.id) {
      throw new AthenaError("CONFIG_ERROR", `Mission task is missing or detached: ${taskId}`);
    }
    return task;
  });
}

function missionRunDetail(appState: AppStateDatabase, run: RunRecord): MissionWorkbenchMissionRunDetail {
  const mission = appState.missions.get(run.targetId);
  const childRuns = readMissionRunChildRuns(run)
    .map((child) => appState.runs.get(child.runId))
    .filter((childRun): childRun is RunRecord => childRun !== undefined && childRun.targetType === "task")
    .map(mapTaskRunRecord);
  return {
    run: mapMissionRunRecord(run),
    ...(mission ? { mission: mapMissionRecord(mission) } : {}),
    childRuns,
    events: appState.runEvents.listForRun(run.id).map(mapRunEventRecord)
  };
}

function createMissionRunOutput(childRuns: MissionWorkbenchMissionRunChild[]): { childRuns: MissionWorkbenchMissionRunChild[] } {
  return {
    childRuns
  };
}

function readMissionRunChildRuns(run: RunRecord): MissionWorkbenchMissionRunChild[] {
  const output = isRecord(run.output) ? run.output : {};
  const childRuns = Array.isArray(output.childRuns) ? output.childRuns : [];
  return childRuns.flatMap((child) => {
    if (!isRecord(child) || typeof child.taskId !== "string" || typeof child.runId !== "string" || typeof child.status !== "string") {
      return [];
    }
    return [{ taskId: child.taskId, runId: child.runId, status: child.status as MissionWorkbenchMissionRunChild["status"] }];
  });
}

function compareTasksDeterministically(left: TaskRecord, right: TaskRecord): number {
  const created = left.createdAt.localeCompare(right.createdAt);
  return created === 0 ? left.id.localeCompare(right.id) : created;
}

function insertTaskOrder(existingOrder: string[], taskId: string, position: number | undefined): string[] {
  const order = existingOrder.filter((candidate) => candidate !== taskId);
  if (position === undefined) {
    return [...order, taskId];
  }
  const index = Math.max(0, Math.min(position, order.length));
  return [...order.slice(0, index), taskId, ...order.slice(index)];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeMissionRepositoryError(error: unknown): AthenaError {
  if (error instanceof AthenaError) {
    return error;
  }
  return new AthenaError("PROVIDER_ERROR", error instanceof Error ? error.message : "Mission repository failure", true, error);
}

function mapMissionRecord(record: MissionRecord): MissionWorkbenchMission {
  return {
    id: record.id,
    title: record.title,
    goal: record.goal,
    context: record.context,
    status: record.status as MissionWorkbenchMissionStatus,
    taskOrder: record.taskOrder,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(record.archivedAt ? { archivedAt: record.archivedAt } : {})
  };
}

function mapTaskRecord(record: TaskRecord): TaskWorkbenchTask {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    status: record.status,
    capabilityRequirements: record.capabilityRequirements,
    ...(record.assignedAgentId ? { assignedAgentId: record.assignedAgentId } : {}),
    ...(record.assignedAgentVersion ? { assignedAgentVersion: record.assignedAgentVersion } : {}),
    inputs: record.inputs,
    dependsOn: record.dependsOn,
    ...(record.missionId ? { missionId: record.missionId } : {}),
    ...(record.sourceRunId ? { sourceRunId: record.sourceRunId } : {}),
    ...(record.provenance !== undefined ? { provenance: record.provenance } : {}),
    ...(record.createdBy ? { createdBy: record.createdBy } : {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(record.archivedAt ? { archivedAt: record.archivedAt } : {})
  };
}

function mapMissionRunRecord(record: RunRecord): MissionWorkbenchMissionRun {
  return {
    id: record.id,
    targetType: "mission",
    targetId: record.targetId,
    status: record.status,
    ...(record.backend ? { backend: record.backend } : {}),
    ...(record.startedAt ? { startedAt: record.startedAt } : {}),
    ...(record.endedAt ? { endedAt: record.endedAt } : {}),
    ...(record.output !== undefined ? { output: record.output } : {}),
    ...(record.failure !== undefined ? { failure: record.failure } : {}),
    ...(record.safetyStop !== undefined ? { safetyStop: record.safetyStop } : {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function mapMissionRunSummaryRecord(record: RunRecord): MissionWorkbenchMissionRunSummary {
  return {
    id: record.id,
    targetType: "mission",
    targetId: record.targetId,
    status: record.status as MissionWorkbenchMissionRunSummary["status"],
    ...(record.backend ? { backend: record.backend } : {}),
    ...(record.startedAt ? { startedAt: record.startedAt } : {}),
    ...(record.endedAt ? { endedAt: record.endedAt } : {}),
    childRunCount: readMissionRunChildRuns(record).length,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function mapTaskRunRecord(record: RunRecord): TaskWorkbenchTaskRun {
  return {
    id: record.id,
    targetType: "task",
    targetId: record.targetId,
    status: record.status,
    ...(record.backend ? { backend: record.backend } : {}),
    ...(record.agentId ? { agentId: record.agentId } : {}),
    ...(record.agentVersion ? { agentVersion: record.agentVersion } : {}),
    ...(record.startedAt ? { startedAt: record.startedAt } : {}),
    ...(record.endedAt ? { endedAt: record.endedAt } : {}),
    ...(record.output !== undefined ? { output: record.output } : {}),
    ...(record.failure !== undefined ? { failure: record.failure } : {}),
    ...(record.safetyStop !== undefined ? { safetyStop: record.safetyStop } : {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function mapRunEventRecord(record: RunEventRecord): TaskWorkbenchRunEvent {
  return {
    id: record.id,
    runId: record.runId,
    ...(record.taskId ? { taskId: record.taskId } : {}),
    ...(record.missionId ? { missionId: record.missionId } : {}),
    ...(record.agentId ? { agentId: record.agentId } : {}),
    type: record.type,
    level: record.level,
    timestamp: record.timestamp,
    message: record.message,
    payload: record.payload,
    ...(record.parentEventId ? { parentEventId: record.parentEventId } : {}),
    ...(record.traceId ? { traceId: record.traceId } : {})
  };
}

function appendMissionRunEvent(
  appState: AppStateDatabase,
  runId: string,
  missionId: string,
  type: string,
  message: string,
  payload: unknown
): void {
  appState.runEvents.append({
    id: `event-${randomUUID()}`,
    runId,
    missionId,
    type,
    level: "info",
    message,
    payload
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
