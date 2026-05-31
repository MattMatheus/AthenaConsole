import { assertApiResponseSchema } from "../../control-plane/api-schemas.js";
import type { ControlPlaneServices } from "../../control-plane/services.js";
import {
  parseEventsListQuery,
  parseOperationsCostReportQuery,
  parseProviderCostSettingsPutRequest,
  parseTailQuery
} from "../request-parsers/index.js";
import { readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

const EVENT_STREAM_POLL_MS = 1_000;
const EVENT_STREAM_HEARTBEAT_MS = 15_000;

export const OPERATIONS_EVENTS_ROUTES = defineApiRoutes("operations-events-policy", [
  { method: "GET", path: "/api/operations/summary", handler: handleGetOperationsSummaryRoute },
  { method: "GET", path: "/api/v1/operations/summary", handler: handleGetOperationsSummaryRoute },
  { method: "GET", path: "/api/operations/cost/settings", handler: handleGetOperationsProviderCostSettingsRoute },
  { method: "GET", path: "/api/v1/operations/cost/settings", handler: handleGetOperationsProviderCostSettingsRoute },
  { method: "PUT", path: "/api/operations/cost/settings", handler: handlePutOperationsProviderCostSettingsRoute },
  { method: "PUT", path: "/api/v1/operations/cost/settings", handler: handlePutOperationsProviderCostSettingsRoute },
  { method: "GET", path: "/api/operations/cost/report.csv", handler: handleGetOperationsCostCsvRoute },
  { method: "GET", path: "/api/v1/operations/cost/report.csv", handler: handleGetOperationsCostCsvRoute },
  { method: "GET", path: "/api/events", handler: handleListEventsRoute },
  { method: "GET", path: "/api/v1/events/stream", handler: handleStreamEventsRoute },
  { method: "GET", path: "/api/v1/events", handler: handleListEventsRoute }
]);

async function handleGetOperationsSummaryRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "getOperationsSummary", 200, await context.services.operationsService.getSummary());
}

async function handleGetOperationsProviderCostSettingsRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "getOperationsProviderCostSettings",
    200,
    await context.services.operationsService.getOperationsProviderCostSettings()
  );
}

async function handlePutOperationsProviderCostSettingsRoute(context: ApiRouteContext): Promise<void> {
  const request = parseProviderCostSettingsPutRequest(await readJson(context.req));
  writeSuccess(
    context.res,
    "putOperationsProviderCostSettings",
    200,
    await context.services.operationsService.updateProviderCostSettings(request)
  );
}

async function handleGetOperationsCostCsvRoute(context: ApiRouteContext): Promise<void> {
  await writeCostCsv(context, "getOperationsCostReportCsv", "operations-cost-report");
}

async function writeCostCsv(context: ApiRouteContext, operationId: string, filenamePrefix: string): Promise<void> {
  const query = parseOperationsCostReportQuery(context.requestUrl);
  const csv = await context.services.operationsService.exportMonthlyCostCsv(query);
  context.res.writeHead(200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename=\"${filenamePrefix}-${query.month ?? "current"}.csv\"`
  });
  assertApiResponseSchema(operationId, csv);
  context.res.end(csv);
}

async function handleListEventsRoute(context: ApiRouteContext): Promise<void> {
  const query = parseEventsListQuery(context.requestUrl);
  writeSuccess(context.res, "listEvents", 200, await context.services.eventService.list(query));
}

async function handleStreamEventsRoute(context: ApiRouteContext): Promise<void> {
  const query = parseTailQuery(context.requestUrl);
  const initialCursor = query.after ?? context.req.headers["last-event-id"];
  const cursor = typeof initialCursor === "string" ? initialCursor : undefined;
  await streamEvents(context.services, context.res, {
    ...(cursor ? { cursor } : {}),
    limit: query.limit
  });
}

async function streamEvents(
  services: ControlPlaneServices,
  res: ApiRouteContext["res"],
  options: { cursor?: string; limit: number }
): Promise<void> {
  let cursor = options.cursor;
  let lastHeartbeatAt = Date.now();
  let closed = false;

  res.on("close", () => {
    closed = true;
  });

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive"
  });
  res.write("retry: 2000\n");

  while (!closed) {
    const result = await services.eventService.list({
      ...(cursor ? { cursor } : {}),
      limit: options.limit
    });
    if (result.events.length > 0) {
      for (const event of result.events) {
        assertApiResponseSchema("streamEvents", { ok: true, data: event });
        res.write(`id: ${event.id}\n`);
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        cursor = event.id;
      }
    } else if (Date.now() - lastHeartbeatAt >= EVENT_STREAM_HEARTBEAT_MS) {
      res.write(": heartbeat\n\n");
      lastHeartbeatAt = Date.now();
    }
    await new Promise((resolve) => setTimeout(resolve, EVENT_STREAM_POLL_MS));
  }
}
