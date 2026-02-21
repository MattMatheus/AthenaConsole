import { useMemo } from "react";

export { usePersistentState } from "./usePersistentState";

export function useStableCallback<TArgs extends unknown[], TResult>(
  callback: (...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
  return useMemo(() => callback, [callback]);
}
