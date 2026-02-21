import type { RouteParams } from "../router.js";
import { emitEventBestEffort, readJson, writeError, writeSuccess } from "../route-helpers.js";
import { parseA2aDlqDiscardRequest, parseA2aDlqListQuery } from "../request-parsers/index.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const A2A_ROUTES = defineApiRoutes("a2a", [
  { method: "GET", path: "/api/v1/a2a/dlq", handler: handleListA2aDlqRoute },
  { method: "POST", path: "/api/v1/a2a/dlq/:id/requeue", handler: handleRequeueA2aDlqRoute },
  { method: "POST", path: "/api/v1/a2a/dlq/:id/discard", handler: handleDiscardA2aDlqRoute }
]);

async function handleListA2aDlqRoute(context: ApiRouteContext): Promise<void> {
  const query = parseA2aDlqListQuery(context.requestUrl);
  writeSuccess(
    context.res,
    "listA2aDlq",
    200,
    await context.services.a2aDlqService.list({
      ...(query.cursor ? { cursor: query.cursor } : {}),
      limit: query.limit,
      ...(query.status ? { status: query.status } : {})
    })
  );
}

async function handleRequeueA2aDlqRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const id = decodeRouteParam(params, "id");
  const result = await context.services.a2aDlqService.requeue(id);
  if (!result.updated) {
    writeError(context.res, 404, {
      code: "UNKNOWN_ERROR",
      error: `DLQ item '${id}' not found.`,
      traceId: context.traceId
    });
    return;
  }
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "a2a.dlq.requeued",
    payload: { id }
  });
  writeSuccess(context.res, "requeueA2aDlqItem", 200, result);
}

async function handleDiscardA2aDlqRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const body = await readJson(context.req);
  const parsed = parseA2aDlqDiscardRequest(body);
  const id = decodeRouteParam(params, "id");
  const result = await context.services.a2aDlqService.discard(id);
  if (!result.updated) {
    writeError(context.res, 404, {
      code: "UNKNOWN_ERROR",
      error: `DLQ item '${id}' not found.`,
      traceId: context.traceId
    });
    return;
  }
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "a2a.dlq.discarded",
    payload: {
      id,
      ...(parsed.auditNote ? { auditNote: parsed.auditNote } : {})
    }
  });
  writeSuccess(context.res, "discardA2aDlqItem", 200, result);
}

function decodeRouteParam(params: RouteParams, key: string): string {
  return decodeURIComponent(params[key] ?? "");
}
