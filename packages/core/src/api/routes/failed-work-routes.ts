import type { RouteParams } from "../router.js";
import { emitEventBestEffort, readJson, writeError, writeSuccess } from "../route-helpers.js";
import {
  parseFailedWorkDiscardRequest,
  parseFailedWorkListQuery,
  type FailedWorkStatus
} from "../request-parsers/failed-work.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

type ServiceWorkItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: FailedWorkStatus;
  reason?: string;
  payload: Record<string, unknown>;
};

type ServiceWorkListResult = {
  items: ServiceWorkItem[];
  nextCursor?: string;
};

type FailedWorkItem = Omit<ServiceWorkItem, "status"> & {
  status: FailedWorkStatus;
};

type FailedWorkListResult = Omit<ServiceWorkListResult, "items"> & {
  items: FailedWorkItem[];
};

export const FAILED_WORK_ROUTES = defineApiRoutes("failed-work", [
  { method: "GET", path: "/api/v1/failed-work", handler: handleListFailedWorkRoute },
  { method: "POST", path: "/api/v1/failed-work/:id/retry", handler: handleRetryFailedWorkRoute },
  { method: "POST", path: "/api/v1/failed-work/:id/discard", handler: handleDiscardFailedWorkRoute }
]);

async function handleListFailedWorkRoute(context: ApiRouteContext): Promise<void> {
  const query = parseFailedWorkListQuery(context.requestUrl);
  const result = await context.services.failedWorkService.list({
    ...(query.cursor ? { cursor: query.cursor } : {}),
    limit: query.limit,
    ...(query.status ? { status: query.status } : {})
  });
  writeSuccess(context.res, "listFailedWork", 200, mapListResult(result));
}

async function handleRetryFailedWorkRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const id = decodeRouteParam(params, "id");
  const result = await context.services.failedWorkService.retry(id);
  if (!result.updated) {
    writeError(context.res, 404, {
      code: "UNKNOWN_ERROR",
      error: `Failed work item '${id}' not found.`,
      traceId: context.traceId
    });
    return;
  }
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "failed-work.retry-requested",
    payload: { id }
  });
  writeSuccess(context.res, "retryFailedWorkItem", 200, {
    updated: result.updated,
    ...(result.item ? { item: mapItem(result.item) } : {})
  });
}

async function handleDiscardFailedWorkRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const body = await readJson(context.req);
  const parsed = parseFailedWorkDiscardRequest(body);
  const id = decodeRouteParam(params, "id");
  const result = await context.services.failedWorkService.discard(id);
  if (!result.updated) {
    writeError(context.res, 404, {
      code: "UNKNOWN_ERROR",
      error: `Failed work item '${id}' not found.`,
      traceId: context.traceId
    });
    return;
  }
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "failed-work.discarded",
    payload: {
      id,
      ...(parsed.auditNote ? { auditNote: parsed.auditNote } : {})
    }
  });
  writeSuccess(context.res, "discardFailedWorkItem", 200, {
    updated: result.updated,
    ...(result.item ? { item: mapItem(result.item) } : {})
  });
}

function mapListResult(result: ServiceWorkListResult): FailedWorkListResult {
  return {
    items: result.items.map(mapItem),
    ...(result.nextCursor ? { nextCursor: result.nextCursor } : {})
  };
}

function mapItem(item: ServiceWorkItem): FailedWorkItem {
  return item;
}

function decodeRouteParam(params: RouteParams, key: string): string {
  return decodeURIComponent(params[key] ?? "");
}
