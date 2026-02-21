import { assertApiResponseSchema } from "../../control-plane/api-schemas.js";
import type { ControlPlaneServices } from "../../control-plane/services.js";
import {
  parseEventsListQuery,
  parseFleetCostReportQuery,
  parseProviderCostSettingsPutRequest,
  parseTailQuery
} from "../request-parsers/index.js";
import { readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

const EVENT_STREAM_POLL_MS = 1_000;
const EVENT_STREAM_HEARTBEAT_MS = 15_000;

export const FLEET_EVENTS_ROUTES = defineApiRoutes("fleet-events-policy", [
  { method: "GET", path: "/api/fleet/summary", handler: handleGetFleetSummaryRoute },
  { method: "GET", path: "/api/v1/fleet/summary", handler: handleGetFleetSummaryRoute },
  { method: "GET", path: "/api/fleet/cost/settings", handler: handleGetProviderCostSettingsRoute },
  { method: "GET", path: "/api/v1/fleet/cost/settings", handler: handleGetProviderCostSettingsRoute },
  { method: "PUT", path: "/api/fleet/cost/settings", handler: handlePutProviderCostSettingsRoute },
  { method: "PUT", path: "/api/v1/fleet/cost/settings", handler: handlePutProviderCostSettingsRoute },
  { method: "GET", path: "/api/fleet/cost/report.csv", handler: handleGetFleetCostCsvRoute },
  { method: "GET", path: "/api/v1/fleet/cost/report.csv", handler: handleGetFleetCostCsvRoute },
  { method: "GET", path: "/api/events", handler: handleListEventsRoute },
  { method: "GET", path: "/api/v1/events/stream", handler: handleStreamEventsRoute },
  { method: "GET", path: "/api/v1/events", handler: handleListEventsRoute }
]);

async function handleGetFleetSummaryRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "getFleetSummary", 200, await context.services.fleetService.getSummary());
}

async function handleGetProviderCostSettingsRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "getProviderCostSettings", 200, await context.services.fleetService.getProviderCostSettings());
}

async function handlePutProviderCostSettingsRoute(context: ApiRouteContext): Promise<void> {
  const request = parseProviderCostSettingsPutRequest(await readJson(context.req));
  writeSuccess(
    context.res,
    "putProviderCostSettings",
    200,
    await context.services.fleetService.updateProviderCostSettings(request)
  );
}

async function handleGetFleetCostCsvRoute(context: ApiRouteContext): Promise<void> {
  const query = parseFleetCostReportQuery(context.requestUrl);
  const csv = await context.services.fleetService.exportMonthlyCostCsv(query);
  context.res.writeHead(200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename=\"fleet-cost-report-${query.month ?? "current"}.csv\"`
  });
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
        res.write(`data: ${JSON.stringify({ ok: true, data: event })}\n\n`);
      }
      cursor = result.nextCursor ?? incrementOffsetCursor(cursor, result.events.length);
      lastHeartbeatAt = Date.now();
    } else if (Date.now() - lastHeartbeatAt >= EVENT_STREAM_HEARTBEAT_MS) {
      res.write(": heartbeat\n\n");
      lastHeartbeatAt = Date.now();
    }
    await delay(EVENT_STREAM_POLL_MS);
  }
}

function incrementOffsetCursor(cursor: string | undefined, amount: number): string {
  const offset = decodeCursorOffset(cursor);
  return encodeCursorOffset(offset + amount);
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
