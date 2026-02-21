import { useEffect, useState } from "react";

export function usePersistentState<T>(
  key: string,
  createInitialValue: () => T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return createInitialValue();
    }

    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) {
      return createInitialValue();
    }

    try {
      return JSON.parse(rawValue) as T;
    } catch {
      return createInitialValue();
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
