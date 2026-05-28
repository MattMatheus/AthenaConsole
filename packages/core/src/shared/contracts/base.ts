export type ProviderKind = "local" | "remote";
export type ContextStrategy = "raw" | "summary" | "distill" | "symbolic-signatures";
export type AthenaErrorCode =
  | "CONFIG_ERROR"
  | "AUTH_IDENTITY_MISSING"
  | "AUTH_TOKEN_MISSING"
  | "AUTH_TOKEN_INVALID"
  | "AUTHZ_DENIED"
  | "POLICY_CONCURRENCY_LIMIT_EXCEEDED"
  | "PAYLOAD_TOO_LARGE"
  | "SESSION_LOCK_TIMEOUT"
  | "SESSION_IO_ERROR"
  | "CONTEXT_OVERFLOW"
  | "PROVIDER_NOT_FOUND"
  | "PROVIDER_ERROR"
  | "RUN_TIMEOUT"
  | "RUN_CANCELLED"
  | "SCHEDULE_TIMEOUT";

export type AthenaRbacRole = "Viewer" | "Operator" | "Admin";
