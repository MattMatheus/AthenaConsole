import {
  parseDurableMemoryArchiveRequest,
  parseDurableMemoryDeleteRequest,
  parseDurableMemoryGetRequest,
  parseDurableMemoryHealthQuery,
  parseDurableMemoryListRequest,
  parseDurableMemoryProposalCreateRequest,
  parseDurableMemoryProposalReviewRequest,
  parseDurableMemorySearchRequest,
  parseDurableMemorySnapshotCreateRequest,
  parseDurableMemorySnapshotRestoreRequest,
  parseDurableMemoryWriteRequest
} from "../request-parsers/index.js";
import type { RouteParams } from "../router.js";
import { readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const DURABLE_MEMORY_ROUTES = defineApiRoutes("durable-memory", [
  { method: "GET", path: "/api/v1/durable-memory/health", handler: handleDurableMemoryHealthRoute },
  { method: "POST", path: "/api/v1/durable-memory/records", handler: handleWriteDurableMemoryRecordRoute },
  { method: "POST", path: "/api/v1/durable-memory/records/get", handler: handleGetDurableMemoryRecordRoute },
  { method: "POST", path: "/api/v1/durable-memory/records/list", handler: handleListDurableMemoryRecordsRoute },
  { method: "POST", path: "/api/v1/durable-memory/records/search", handler: handleSearchDurableMemoryRecordsRoute },
  { method: "POST", path: "/api/v1/durable-memory/records/:id/archive", handler: handleArchiveDurableMemoryRecordRoute },
  { method: "POST", path: "/api/v1/durable-memory/records/:id/delete", handler: handleDeleteDurableMemoryRecordRoute },
  { method: "POST", path: "/api/v1/durable-memory/proposals", handler: handleCreateDurableMemoryProposalRoute },
  { method: "POST", path: "/api/v1/durable-memory/proposals/list", handler: handleListDurableMemoryProposalsRoute },
  { method: "POST", path: "/api/v1/durable-memory/proposals/:id/approve", handler: handleApproveDurableMemoryProposalRoute },
  { method: "POST", path: "/api/v1/durable-memory/proposals/:id/reject", handler: handleRejectDurableMemoryProposalRoute },
  { method: "POST", path: "/api/v1/durable-memory/proposals/:id/archive", handler: handleArchiveDurableMemoryProposalRoute },
  { method: "POST", path: "/api/v1/durable-memory/snapshots", handler: handleCreateDurableMemorySnapshotRoute },
  { method: "POST", path: "/api/v1/durable-memory/snapshots/list", handler: handleListDurableMemorySnapshotsRoute },
  { method: "POST", path: "/api/v1/durable-memory/snapshots/:id/restore", handler: handleRestoreDurableMemorySnapshotRoute }
]);

async function handleDurableMemoryHealthRoute(context: ApiRouteContext): Promise<void> {
  parseDurableMemoryHealthQuery(context.requestUrl);
  writeSuccess(context.res, "getDurableMemoryHealth", 200, await context.services.durableMemoryService.getHealth());
}

async function handleWriteDurableMemoryRecordRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "writeDurableMemoryRecord",
    201,
    await context.services.durableMemoryService.write(parseDurableMemoryWriteRequest(body))
  );
}

async function handleGetDurableMemoryRecordRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "getDurableMemoryRecord",
    200,
    await context.services.durableMemoryService.get(parseDurableMemoryGetRequest(body))
  );
}

async function handleListDurableMemoryRecordsRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "listDurableMemoryRecords",
    200,
    await context.services.durableMemoryService.list(parseDurableMemoryListRequest(body))
  );
}

async function handleSearchDurableMemoryRecordsRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "searchDurableMemoryRecords",
    200,
    await context.services.durableMemoryService.search(parseDurableMemorySearchRequest(body))
  );
}

async function handleArchiveDurableMemoryRecordRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "archiveDurableMemoryRecord",
    200,
    await context.services.durableMemoryService.archive(parseDurableMemoryArchiveRequest(decodeRouteParam(params, "id"), body))
  );
}

async function handleDeleteDurableMemoryRecordRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "deleteDurableMemoryRecord",
    200,
    await context.services.durableMemoryService.delete(parseDurableMemoryDeleteRequest(decodeRouteParam(params, "id"), body))
  );
}

async function handleCreateDurableMemoryProposalRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "createDurableMemoryProposal",
    201,
    await context.services.durableMemoryService.createProposal(parseDurableMemoryProposalCreateRequest(body))
  );
}

async function handleListDurableMemoryProposalsRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "listDurableMemoryProposals",
    200,
    await context.services.durableMemoryService.listProposals(parseDurableMemoryListRequest(body))
  );
}

async function handleApproveDurableMemoryProposalRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "approveDurableMemoryProposal",
    200,
    await context.services.durableMemoryService.approveProposal(
      parseDurableMemoryProposalReviewRequest(decodeRouteParam(params, "id"), body, "proposal-approve")
    )
  );
}

async function handleRejectDurableMemoryProposalRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "rejectDurableMemoryProposal",
    200,
    await context.services.durableMemoryService.rejectProposal(
      parseDurableMemoryProposalReviewRequest(decodeRouteParam(params, "id"), body, "proposal-reject")
    )
  );
}

async function handleArchiveDurableMemoryProposalRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "archiveDurableMemoryProposal",
    200,
    await context.services.durableMemoryService.archiveProposal(
      parseDurableMemoryProposalReviewRequest(decodeRouteParam(params, "id"), body, "proposal-archive")
    )
  );
}

async function handleCreateDurableMemorySnapshotRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "createDurableMemorySnapshot",
    201,
    await context.services.durableMemoryService.createSnapshot(parseDurableMemorySnapshotCreateRequest(body))
  );
}

async function handleListDurableMemorySnapshotsRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "listDurableMemorySnapshots",
    200,
    await context.services.durableMemoryService.listSnapshots(parseDurableMemoryListRequest(body))
  );
}

async function handleRestoreDurableMemorySnapshotRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "restoreDurableMemorySnapshot",
    200,
    await context.services.durableMemoryService.restoreSnapshot(
      parseDurableMemorySnapshotRestoreRequest(decodeRouteParam(params, "id"), body)
    )
  );
}

function decodeRouteParam(params: RouteParams, key: string): string {
  return decodeURIComponent(params[key] ?? "");
}
