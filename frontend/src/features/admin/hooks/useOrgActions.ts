import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { connectUserToOrg, createOrg, lookupOrgByUser } from "../services/admin";

import { qk } from "@/shared/api/queryKeys";

export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orgName: string) => createOrg(orgName),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.adminOrgs() }),
  });
}

export function useConnectUserToOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; orgId: string }) =>
      connectUserToOrg(vars.userId, vars.orgId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.adminOrgs() }),
  });
}

export function useOrgByUser(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.adminOrgByUser(userId),
    queryFn: () => lookupOrgByUser(userId),
    enabled: enabled && !!userId,
    retry: false,
  });
}
