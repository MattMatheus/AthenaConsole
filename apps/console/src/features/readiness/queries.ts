import { useQuery } from "@tanstack/react-query";
import { fetchReadiness } from "./api";

export function useReadinessQuery() {
  return useQuery({
    queryKey: ["readiness"],
    queryFn: fetchReadiness,
    staleTime: 10_000,
  });
}
