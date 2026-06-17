import { loadConfig } from "../../shared/config.js";
import { createLocalControlPlaneServices } from "../../control-plane/services.js";
import type { ScheduleStatus, ScheduleTargetType, UpsertScheduleRequest } from "../../shared/contracts.js";
import { createCliApiClient } from "../api-client.js";
import type { CliOptions } from "../types.js";
import { parseArgs } from "../helpers/args.js";
import { parsePositiveInt } from "../helpers/flags.js";
import { runWithSelectedTransport, resolveCliTransport } from "../helpers/transport.js";
import { usage } from "../helpers/usage.js";

export async function runScheduleCli(argv: string[], options: CliOptions): Promise<string> {
  const action = argv[0];
  const parsed = parseArgs(["schedule", ...argv]);
  const config = loadConfig(options.cwd ?? process.cwd());
  const services = createLocalControlPlaneServices({ config });
  const transport = resolveCliTransport(parsed.flags, config);

  if (action === "add") {
    const id = parsed.flags.id;
    const targetType = parsed.flags["target-type"];
    const targetId = parsed.flags["target-id"];
    const runAt = parsed.flags["run-at"];
    const rrule = parsed.flags.rrule;
    if (!id || !targetType || !targetId || (!runAt && !rrule)) {
      throw new Error(`'schedule add' requires --id --target-type --target-id and --run-at or --rrule\n${usage()}`);
    }
    if (targetType !== "task" && targetType !== "mission" && targetType !== "workflow-template") {
      throw new Error(`Invalid --target-type '${targetType}'. Expected task|mission|workflow-template.`);
    }
    if (
      parsed.flags.status &&
      parsed.flags.status !== "active" &&
      parsed.flags.status !== "paused" &&
      parsed.flags.status !== "disabled" &&
      parsed.flags.status !== "error"
    ) {
      throw new Error(`Invalid --status '${parsed.flags.status}'. Expected active|paused|disabled|error.`);
    }
    if (runAt && Number.isNaN(new Date(runAt).getTime())) {
      throw new Error(`Invalid --run-at value '${runAt}'`);
    }
    const request: UpsertScheduleRequest = {
      id,
      targetType: targetType as ScheduleTargetType,
      targetId,
      ...(parsed.flags.name ? { name: parsed.flags.name } : {}),
      ...(runAt ? { runAt: new Date(runAt).toISOString() } : {}),
      ...(rrule ? { rrule } : {}),
      ...(parsed.flags.timezone ? { timezone: parsed.flags.timezone } : {}),
      ...(parsed.flags.status ? { status: parsed.flags.status as ScheduleStatus } : {})
    };
    const task = await runWithSelectedTransport(
      transport,
      async () => services.scheduleService.upsert(request),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.createSchedule(request);
      }
    );
    return JSON.stringify(task, null, 2);
  }

  if (action === "list") {
    const tasks = await runWithSelectedTransport(
      transport,
      async () => services.scheduleService.list(),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        const result = await client.listSchedules(500);
        return result.items;
      }
    );
    return JSON.stringify({ count: tasks.length, tasks }, null, 2);
  }

  if (action === "remove") {
    const id = parsed.flags.id;
    if (!id) {
      throw new Error(`'schedule remove' requires --id\n${usage()}`);
    }
    const response = await runWithSelectedTransport(
      transport,
      async () => ({
        id,
        removed: await services.scheduleService.remove(id)
      }),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.removeSchedule(id);
      }
    );
    return JSON.stringify({ id: response.id, removed: response.removed }, null, 2);
  }

  if (action === "logs") {
    const id = parsed.flags.id;
    if (!id) {
      throw new Error(`'schedule logs' requires --id\n${usage()}`);
    }
    const limit = parsePositiveInt(parsed.flags.limit) ?? 20;
    const logs = await runWithSelectedTransport(
      transport,
      async () => services.scheduleService.logs(id, { limit }),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.getScheduleLogs(id, limit);
      }
    );
    return JSON.stringify({ id, count: logs.length, logs }, null, 2);
  }

  if (action === "run") {
    const id = parsed.flags.id;
    if (!id) {
      throw new Error(`'schedule run' requires --id\n${usage()}`);
    }
    const runRequest = {
      id,
      ...(parsed.flags.provider ? { provider: parsed.flags.provider } : {}),
      ...(parsed.flags.model ? { model: parsed.flags.model } : {})
    };
    const result = await runWithSelectedTransport(
      transport,
      async () =>
        services.scheduleService.run(id, {
          ...(parsed.flags.provider ? { provider: parsed.flags.provider } : {}),
          ...(parsed.flags.model ? { model: parsed.flags.model } : {})
        }),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.runSchedule(runRequest);
      }
    );
    return JSON.stringify(
      {
        ...result,
        summary: {
          ok: result.status === "ok" ? 1 : 0,
          failed: result.status === "failed" ? 1 : 0,
          alreadyRunning: result.status === "already-running" ? 1 : 0
        }
      },
      null,
      2
    );
  }

  if (action === "tick") {
    const at = parsed.flags.at ? new Date(parsed.flags.at) : new Date();
    if (Number.isNaN(at.getTime())) {
      throw new Error(`Invalid --at value '${parsed.flags.at}'`);
    }
    const tickRequest = {
      at: at.toISOString(),
      ...(parsed.flags.provider ? { provider: parsed.flags.provider } : {}),
      ...(parsed.flags.model ? { model: parsed.flags.model } : {})
    };
    const result = await runWithSelectedTransport(
      transport,
      async () =>
        services.scheduleService.runDue(at, {
          ...(parsed.flags.provider ? { provider: parsed.flags.provider } : {}),
          ...(parsed.flags.model ? { model: parsed.flags.model } : {})
        }),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.tickSchedules(tickRequest);
      }
    );
    return JSON.stringify(
      {
        at: at.toISOString(),
        ...result,
        summary: {
          ok: result.run.filter((row) => row.status === "ok").length,
          failed: result.run.filter((row) => row.status === "failed").length,
          alreadyRunning: result.run.filter((row) => row.status === "already-running").length
        }
      },
      null,
      2
    );
  }

  throw new Error(`Unknown schedule action '${action}'.\n${usage()}`);
}
