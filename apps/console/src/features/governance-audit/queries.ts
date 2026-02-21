import { useQuery } from "@tanstack/react-query";
import { fetchGovernanceAuditHistory } from "./api";
import type { GovernanceAuditHistoryQuery } from "./types";

export function useGovernanceAuditHistoryQuery(query: GovernanceAuditHistoryQuery) {
  return useQuery({
    queryKey: ["governance-audit", query],
    queryFn: () => fetchGovernanceAuditHistory(query)
  });
}
