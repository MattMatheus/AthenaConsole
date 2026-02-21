import type { IncomingMessage, ServerResponse } from "node:http";
import type { ControlPlaneServices } from "../control-plane/services.js";
import { assertApiResponseSchema } from "../control-plane/api-schemas.js";
import { AthenaError } from "../runtime/errors.js";
import { parseJsonObject } from "./validation.js";

const MAX_REQUEST_BODY_BYTES = 1_000_000;

export function writeSuccess(res: ServerResponse, operationId: string, status: number, data: unknown): void {
  const payloadData = data === undefined ? null : data;
  assertApiResponseSchema(operationId, payloadData);
  const body = JSON.stringify(
    {
      ok: true,
      data: payloadData
    },
    null,
    2
  );
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8"
  });
  res.end(body);
}

export function writeError(
  res: ServerResponse,
  status: number,
  error: { code?: string; error?: string; message?: string; retryable?: boolean; traceId?: string }
): void {
  const body = JSON.stringify(
    {
      ok: false,
      error: {
        code: error.code ?? "UNKNOWN_ERROR",
        message: error.message ?? error.error ?? "Unknown error",
        retryable: error.retryable ?? false,
        ...(error.traceId ? { traceId: error.traceId } : {})
      }
    },
    null,
    2
  );
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8"
  });
  res.end(body);
}

export async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const contentLength = req.headers["content-length"];
  if (typeof contentLength === "string") {
    const declared = Number.parseInt(contentLength, 10);
    if (!Number.isFinite(declared) || declared < 0) {
      throw new AthenaError("CONFIG_ERROR", "request.body content-length must be a non-negative integer.");
    }
    if (declared > MAX_REQUEST_BODY_BYTES) {
      throw new AthenaError(
        "PAYLOAD_TOO_LARGE",
        `request.body exceeds ${MAX_REQUEST_BODY_BYTES} bytes.`
      );
    }
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      throw new AthenaError(
        "PAYLOAD_TOO_LARGE",
        `request.body exceeds ${MAX_REQUEST_BODY_BYTES} bytes.`
      );
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  try {
    return parseJsonObject(JSON.parse(raw) as unknown, "request.body");
  } catch (error) {
    if (error instanceof AthenaError) {
      throw error;
    }
    throw new AthenaError("CONFIG_ERROR", "request.body must contain valid JSON.");
  }
}

export async function emitEventBestEffort(
  services: ControlPlaneServices,
  event: { traceId: string; type: string; sessionId?: string; payload: Record<string, unknown> }
): Promise<void> {
  try {
    await services.eventService.emit({
      traceId: event.traceId,
      type: event.type,
      ...(event.sessionId ? { sessionId: event.sessionId } : {}),
      payload: event.payload
    });
  } catch {
    // Events are observability metadata and should not break primary API operations.
  }
}
