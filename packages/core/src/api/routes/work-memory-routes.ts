import {
  parseA2aFlowGraphQuery,
  parseA2aObservabilityQuery,
  parseA2aStallAlertCsvExportQuery,
  parseA2aStallAlertHistoryQuery,
  parseMemoryGetRequest,
  parseMemorySearchQuery,
  parseWorkDrainRequest,
  parseWorkEnqueueRequest
} from "../request-parsers/index.js";
import type { RouteParams } from "../router.js";
import { emitEventBestEffort, readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const MEMORY_ROUTES = defineApiRoutes("memory", [
  { method: "GET", path: "/api/v1/memory/search", handler: handleSearchMemoryRoute },
  { method: "POST", path: "/api/v1/memory/get", handler: handleGetMemoryRoute }
]);

export const WORK_ROUTES = defineApiRoutes("work", [
  { method: "POST", path: "/api/v1/work/enqueue", handler: handleEnqueueWorkRoute },
  { method: "POST", path: "/api/v1/work/:sessionId/drain", handler: handleDrainWorkRoute },
  { method: "GET", path: "/api/v1/work/observability", handler: handleGetA2aObservabilityRoute },
  { method: "GET", path: "/api/v1/work/observability/alerts", handler: handleGetA2aAlertHistoryRoute },
  { method: "GET", path: "/api/v1/work/observability/alerts/export.csv", handler: handleGetA2aAlertHistoryCsvRoute },
  { method: "GET", path: "/api/v1/work/flows/:traceId", handler: handleGetA2aFlowRoute }
]);

async function handleSearchMemoryRoute(context: ApiRouteContext): Promise<void> {
  const searchRequest = parseMemorySearchQuery(context.requestUrl);
  writeSuccess(
    context.res,
    "searchMemory",
    200,
    await context.services.memoryService.search(searchRequest.query, searchRequest.options)
  );
}

async function handleGetMemoryRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "getMemory",
    200,
    await context.services.memoryService.get(parseMemoryGetRequest(body))
  );
}

async function handleEnqueueWorkRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  const enqueueRequest = parseWorkEnqueueRequest(body);
  const result = await context.services.workService.enqueue(enqueueRequest);
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "work.enqueued",
    sessionId: result.sessionId,
    payload: {
      queueDepth: result.items.length
    }
  });
  writeSuccess(context.res, "enqueueWork", 200, result);
}

async function handleDrainWorkRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const body = await readJson(context.req);
  const drainRequest = parseWorkDrainRequest(body);
  const sessionId = decodeRouteParam(params, "sessionId");
  const result = await context.services.workService.drain(sessionId, drainRequest);
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "work.drained",
    sessionId,
    payload: {
      status: result.status,
      drainedItems: result.drainedItems,
      queueDepthBefore: result.queueDepthBefore,
      queueDepthAfter: result.queueDepthAfter
    }
  });
  writeSuccess(context.res, "drainWork", 200, result);
}

async function handleGetA2aFlowRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const traceId = decodeRouteParam(params, "traceId");
  const query = parseA2aFlowGraphQuery(context.requestUrl);
  writeSuccess(context.res, "getA2aFlowGraph", 200, await context.services.a2aFlowService.getTrace(traceId, query));
}

async function handleGetA2aObservabilityRoute(context: ApiRouteContext): Promise<void> {
  const query = parseA2aObservabilityQuery(context.requestUrl);
  writeSuccess(context.res, "getA2aObservability", 200, await context.services.a2aObservabilityService.getSnapshot(query));
}

async function handleGetA2aAlertHistoryRoute(context: ApiRouteContext): Promise<void> {
  const query = parseA2aStallAlertHistoryQuery(context.requestUrl);
  writeSuccess(
    context.res,
    "listA2aObservabilityAlerts",
    200,
    await context.services.a2aObservabilityService.listAlertHistory(query)
  );
}

async function handleGetA2aAlertHistoryCsvRoute(context: ApiRouteContext): Promise<void> {
  const query = parseA2aStallAlertCsvExportQuery(context.requestUrl);
  const csv = await context.services.a2aObservabilityService.exportAlertHistoryCsv(query);
  const createdAfter = query.createdAfter ?? "open";
  const createdBefore = query.createdBefore ?? "open";
  context.res.writeHead(200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename=\"a2a-stall-alerts-${createdAfter}-${createdBefore}.csv\"`
  });
  context.res.end(csv);
}

function decodeRouteParam(params: RouteParams, key: string): string {
  return decodeURIComponent(params[key] ?? "");
}
