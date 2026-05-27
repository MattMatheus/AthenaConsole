import { useQuery } from "@tanstack/react-query";
import { fetchAgentCatalogAgents, fetchAgentCatalogPlugins } from "./api";
import type { AgentCatalogAgentListQuery } from "./types";

export function useAgentCatalogPluginsQuery() {
  return useQuery({
    queryKey: ["agent-catalog", "plugins"],
    queryFn: fetchAgentCatalogPlugins,
    staleTime: 10_000,
  });
}

export function useAgentCatalogAgentsQuery(query: AgentCatalogAgentListQuery = {}) {
  return useQuery({
    queryKey: ["agent-catalog", "agents", query],
    queryFn: () => fetchAgentCatalogAgents(query),
    staleTime: 10_000,
  });
}
