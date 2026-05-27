import { randomUUID } from "node:crypto";
import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";
import type {
  MissionWorkbenchMission,
  MissionWorkbenchMissionCreateRequest,
  MissionWorkbenchMissionListQuery,
  MissionWorkbenchMissionListResult,
  MissionWorkbenchMissionStatus,
  MissionWorkbenchMissionTaskAttachRequest,
  MissionWorkbenchMissionTaskCreateRequest,
  MissionWorkbenchMissionTaskListResult,
  MissionWorkbenchMissionUpdateRequest,
  TaskWorkbenchTask
} from "../../shared/contracts.js";
import type { AppStateDatabase, MissionRecord, TaskRecord } from "../app-state/index.js";
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
