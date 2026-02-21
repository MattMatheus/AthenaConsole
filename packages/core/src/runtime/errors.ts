import type { AthenaErrorCode } from "../shared/contracts.js";

export class AthenaError extends Error {
  readonly code: AthenaErrorCode;
  readonly retryable: boolean;
  readonly causeError?: unknown;

  constructor(code: AthenaErrorCode, message: string, retryable = false, causeError?: unknown) {
    super(message);
    this.name = "AthenaError";
    this.code = code;
    this.retryable = retryable;
    this.causeError = causeError;
  }
}

export function asAthenaError(error: unknown): AthenaError {
  if (error instanceof AthenaError) {
    return error;
  }
  if (error instanceof Error) {
    return new AthenaError("PROVIDER_ERROR", error.message, true, error);
  }
  return new AthenaError("PROVIDER_ERROR", "Unknown runtime failure", true, error);
}
