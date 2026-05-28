const DEFAULT_APP_STATE_LIST_LIMIT = 500;
const MAX_APP_STATE_LIST_LIMIT = 1000;

export function clampAppStateListLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_APP_STATE_LIST_LIMIT;
  }
  if (!Number.isFinite(limit)) {
    return DEFAULT_APP_STATE_LIST_LIMIT;
  }
  return Math.max(1, Math.min(Math.trunc(limit), MAX_APP_STATE_LIST_LIMIT));
}

export function jsonOrNull(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}
