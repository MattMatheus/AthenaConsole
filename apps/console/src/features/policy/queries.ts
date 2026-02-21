import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPolicy, updatePolicy } from "./api";

export function usePolicyQuery() {
  return useQuery({
    queryKey: ["policy", "document"],
    queryFn: fetchPolicy
  });
}

export function useUpdatePolicyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePolicy,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["policy", "document"] });
    }
  });
}
