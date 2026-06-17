import type { ControlPlaneServices } from "../../control-plane/services.js";
import {
  parseCursorPageQuery,
  parsePolicyConcurrencyRejectionsQuery,
  parsePolicyPutRequest,
  parseRejectionsQuery,
  parseScheduleRunRequest,
  parseScheduleTickRequest,
  parseScheduleUpsertRequest,
  parseTailQuery
} from "../request-parsers/index.js";
import type { RouteParams } from "../router.js";
import { emitEventBestEffort, readJson, writeSuccess } from "../route-helpers.js";
import { requireString } from "../validation.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const SCHEDULE_ROUTES = defineApiRoutes("schedules", [
  { method: "POST", path: "/api/v1/schedules/tick", handler: handleTickSchedulesRoute },
  { method: "GET", path: "/api/v1/schedules", handler: handleListSchedulesRoute },
  { method: "POST", path: "/api/v1/schedules", handler: handleCreateScheduleRoute },
  { method: "POST", path: "/api/v1/schedules/:id/run", handler: handleRunScheduleRoute },
  { method: "POST", path: "/api/v1/schedules/:id/enable", handler: handleEnableScheduleRoute },
  { method: "POST", path: "/api/v1/schedules/:id/disable", handler: handleDisableScheduleRoute },
  { method: "GET", path: "/api/v1/schedules/:id", handler: handleGetScheduleRoute },
  { method: "GET", path: "/api/v1/schedules/:id/logs", handler: handleGetScheduleLogsRoute },
  { method: "PUT", path: "/api/v1/schedules/:id", handler: handleUpdateScheduleRoute },
  { method: "DELETE", path: "/api/v1/schedules/:id", handler: handleDeleteScheduleRoute }
]);

export const POLICY_ROUTES = defineApiRoutes("operations-events-policy", [
  { method: "GET", path: "/api/v1/rejections", handler: handleListRejectionsRoute },
  { method: "GET", path: "/api/v1/policy/rejections", handler: handleListPolicyConcurrencyRejectionsRoute },
  { method: "GET", path: "/api/v1/policy", handler: handleGetPolicyRoute },
  { method: "PUT", path: "/api/v1/policy", handler: handlePutPolicyRoute }
]);

async function handleListSchedulesRoute(context: ApiRouteContext): Promise<void> {
  const query = parseCursorPageQuery(context.requestUrl);
  const schedules = await context.services.scheduleService.list();
  const offset = decodeCursorOffset(query.cursor);
  const page = schedules.slice(offset, offset + query.limit);
  const nextOffset = offset + page.length;
  writeSuccess(context.res, "listSchedules", 200, {
    items: page,
    ...(nextOffset < schedules.length ? { nextCursor: encodeCursorOffset(nextOffset) } : {})
  });
}

async function handleCreateScheduleRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  const scheduleRequest = parseScheduleUpsertRequest(body, "schedules.create");
  const result = await context.services.scheduleService.upsert({
    id: requireString(body, "id", "schedules.create"),
    ...scheduleRequest
  });
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "schedule.upserted",
    sessionId: result.sessionId,
    payload: {
      id: result.id,
      enabled: result.enabled
    }
  });
  writeSuccess(context.res, "createSchedule", 200, result);
}

async function handleUpdateScheduleRoute(
  context: ApiRouteContext,
  params: RouteParams
): Promise<void> {
  const body = await readJson(context.req);
  const scheduleRequest = parseScheduleUpsertRequest(body, "schedules.update");
  const result = await context.services.scheduleService.upsert({
    id: decodeRouteParam(params, "id"),
    ...scheduleRequest
  });
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "schedule.upserted",
    sessionId: result.sessionId,
    payload: {
      id: result.id,
      enabled: result.enabled
    }
  });
  writeSuccess(context.res, "updateSchedule", 200, result);
}

async function handleDeleteScheduleRoute(
  context: ApiRouteContext,
  params: RouteParams
): Promise<void> {
  const id = decodeRouteParam(params, "id");
  const removed = await context.services.scheduleService.remove(id);
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "schedule.removed",
    payload: {
      id,
      removed
    }
  });
  writeSuccess(context.res, "deleteSchedule", 200, { id, removed });
}

async function handleGetScheduleRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const id = decodeRouteParam(params, "id");
  const schedule = await context.services.scheduleService.get(id);
  if (!schedule) {
    writeSuccess(context.res, "getSchedule", 200, null);
    return;
  }
  writeSuccess(context.res, "getSchedule", 200, schedule);
}

async function handleRunScheduleRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const body = await readJson(context.req);
  const runRequest = parseScheduleRunRequest(body);
  const id = decodeRouteParam(params, "id");
  const result = await context.services.scheduleService.run(id, runRequest);
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "schedule.run.triggered",
    sessionId: result.sessionId,
    payload: {
      id: result.id,
      status: result.status
    }
  });
  writeSuccess(context.res, "runSchedule", 200, result);
}

async function handleTickSchedulesRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  const tickRequest = parseScheduleTickRequest(body);
  const result = await context.services.scheduleService.runDue(tickRequest.at, {
    ...(tickRequest.provider ? { provider: tickRequest.provider } : {}),
    ...(tickRequest.model ? { model: tickRequest.model } : {})
  });
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "schedule.tick.executed",
    payload: {
      at: tickRequest.at.toISOString(),
      run: result.run.length,
      skipped: result.skipped
    }
  });
  writeSuccess(context.res, "tickSchedules", 200, {
    at: tickRequest.at.toISOString(),
    ...result
  });
}

async function handleEnableScheduleRoute(
  context: ApiRouteContext,
  params: RouteParams
): Promise<void> {
  const result = await setScheduleEnabled(context.services, decodeRouteParam(params, "id"), true);
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "schedule.enabled",
    ...(result.schedule?.sessionId ? { sessionId: result.schedule.sessionId } : {}),
    payload: {
      id: result.id,
      updated: result.updated
    }
  });
  writeSuccess(context.res, "enableSchedule", 200, result);
}

async function handleDisableScheduleRoute(
  context: ApiRouteContext,
  params: RouteParams
): Promise<void> {
  const result = await setScheduleEnabled(context.services, decodeRouteParam(params, "id"), false);
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "schedule.disabled",
    ...(result.schedule?.sessionId ? { sessionId: result.schedule.sessionId } : {}),
    payload: {
      id: result.id,
      updated: result.updated
    }
  });
  writeSuccess(context.res, "disableSchedule", 200, result);
}

async function handleGetScheduleLogsRoute(
  context: ApiRouteContext,
  params: RouteParams
): Promise<void> {
  const query = parseTailQuery(context.requestUrl);
  writeSuccess(
    context.res,
    "getScheduleLogs",
    200,
    await context.services.scheduleService.logs(decodeRouteParam(params, "id"), { limit: query.limit })
  );
}

async function handleGetPolicyRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "getPolicy", 200, (await context.services.policyService.get()) ?? null);
}

async function handleListRejectionsRoute(context: ApiRouteContext): Promise<void> {
  const query = parseRejectionsQuery(context.requestUrl);
  const result = await context.services.policyService.listConcurrencyRejections(query);
  writeSuccess(
    context.res,
    "listRejections",
    200,
    result.items.map((item) => item.event)
  );
}

async function handleListPolicyConcurrencyRejectionsRoute(context: ApiRouteContext): Promise<void> {
  const query = parsePolicyConcurrencyRejectionsQuery(context.requestUrl);
  writeSuccess(
    context.res,
    "listPolicyConcurrencyRejections",
    200,
    await context.services.policyService.listConcurrencyRejections(query)
  );
}

async function handlePutPolicyRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  const parsed = parsePolicyPutRequest(body);
  const previous = await context.services.policyService.get();
  const policy = await context.services.policyService.put(parsed.policy);
  const updatedBy = context.auth?.subject;
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "policy.updated",
    payload: {
      schemaVersion: policy.schemaVersion,
      updatedAt: policy.updatedAt,
      ...(parsed.auditComment ? { auditComment: parsed.auditComment } : {}),
      ...(updatedBy ? { updatedBy } : {}),
      ...(previous ? { before: previous } : {}),
      after: policy
    }
  });
  writeSuccess(context.res, "putPolicy", 200, policy);
}

async function setScheduleEnabled(services: ControlPlaneServices, id: string, enabled: boolean) {
  const schedules = await services.scheduleService.list();
  const current = schedules.find((task) => task.id === id);
  if (!current) {
    return {
      id,
      updated: false
    };
  }
  const updated = await services.scheduleService.upsert({
    id: current.id,
    name: current.name,
    targetType: current.targetType ?? "task",
    targetId: current.targetId ?? current.sessionId,
    inputBindings: current.inputBindings,
    ...(current.rrule ? { rrule: current.rrule } : { runAt: current.nextRunAt }),
    ...(current.timezone ? { timezone: current.timezone } : {}),
    status: enabled ? "active" : "paused",
    failurePolicy: current.failurePolicy,
    enabled
  });
  return {
    id,
    updated: true,
    schedule: updated
  };
}

function encodeCursorOffset(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

function decodeCursorOffset(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = Number.parseInt(decoded, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return parsed;
  } catch {
    return 0;
  }
}

function decodeRouteParam(params: RouteParams, key: string): string {
  return decodeURIComponent(params[key] ?? "");
}
