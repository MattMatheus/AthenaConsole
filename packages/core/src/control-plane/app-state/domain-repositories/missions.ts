import type Database from "better-sqlite3";

export type MissionStatus = "draft" | "ready" | "running" | "blocked" | "completed" | "failed" | "cancelled" | "archived";

interface MissionRow {
  id: string;
  title: string;
  goal: string;
  context_json: string;
  status: MissionStatus;
  task_order_json: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface MissionRecord {
  id: string;
  title: string;
  goal: string;
  context: unknown;
  status: MissionStatus;
  taskOrder: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface CreateMissionInput {
  id: string;
  title: string;
  goal?: string;
  context?: unknown;
  status?: MissionStatus;
  taskOrder?: string[];
  now?: Date;
}

export interface UpdateMissionInput {
  title?: string;
  goal?: string;
  context?: unknown;
  status?: MissionStatus;
  taskOrder?: string[];
  now?: Date;
}

export class MissionRepository {
  private readonly getStatement: Database.Statement;
  private readonly listStatement: Database.Statement;
  private readonly insertStatement: Database.Statement;
  private readonly updateStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getStatement = db.prepare(missionSelectSql("where id = ?"));
    this.listStatement = db.prepare(missionSelectSql("order by updated_at desc, created_at desc"));
    this.insertStatement = db.prepare(`
      insert into missions (id, title, goal, context_json, status, task_order_json, created_at, updated_at, archived_at)
      values (@id, @title, @goal, @contextJson, @status, @taskOrderJson, @createdAt, @updatedAt, @archivedAt)
    `);
    this.updateStatement = db.prepare(`
      update missions set
        title = @title,
        goal = @goal,
        context_json = @contextJson,
        status = @status,
        task_order_json = @taskOrderJson,
        updated_at = @updatedAt,
        archived_at = @archivedAt
      where id = @id
    `);
  }

  create(input: CreateMissionInput): MissionRecord {
    const status = input.status ?? "draft";
    const now = (input.now ?? new Date()).toISOString();
    this.insertStatement.run({
      id: input.id,
      title: input.title,
      goal: input.goal ?? "",
      contextJson: JSON.stringify(input.context ?? {}),
      status,
      taskOrderJson: JSON.stringify(input.taskOrder ?? []),
      createdAt: now,
      updatedAt: now,
      archivedAt: status === "archived" ? now : null
    });
    return this.require(input.id);
  }

  get(id: string): MissionRecord | undefined {
    const row = this.getStatement.get(id) as MissionRow | undefined;
    return row ? mapMissionRow(row) : undefined;
  }

  require(id: string): MissionRecord {
    const mission = this.get(id);
    if (!mission) {
      throw new Error(`Mission not found: ${id}`);
    }
    return mission;
  }

  list(options: { includeArchived?: boolean } = {}): MissionRecord[] {
    return this.listStatement
      .all()
      .map((row) => mapMissionRow(row as MissionRow))
      .filter((mission) => (options.includeArchived ? true : mission.status !== "archived"));
  }

  update(id: string, input: UpdateMissionInput): MissionRecord {
    const existing = this.require(id);
    const status = input.status ?? existing.status;
    const updatedAt = (input.now ?? new Date()).toISOString();
    this.updateStatement.run({
      id,
      title: input.title ?? existing.title,
      goal: input.goal ?? existing.goal,
      contextJson: JSON.stringify(input.context ?? existing.context),
      status,
      taskOrderJson: JSON.stringify(input.taskOrder ?? existing.taskOrder),
      updatedAt,
      archivedAt: status === "archived" ? existing.archivedAt ?? updatedAt : existing.archivedAt ?? null
    });
    return this.require(id);
  }

  archive(id: string, now: Date = new Date()): MissionRecord {
    return this.update(id, { status: "archived", now });
  }
}

function missionSelectSql(suffix: string): string {
  return `select id, title, goal, context_json, status, task_order_json, created_at, updated_at, archived_at from missions ${suffix}`;
}

function mapMissionRow(row: MissionRow): MissionRecord {
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    context: JSON.parse(row.context_json) as unknown,
    status: row.status,
    taskOrder: JSON.parse(row.task_order_json) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.archived_at ? { archivedAt: row.archived_at } : {})
  };
}
