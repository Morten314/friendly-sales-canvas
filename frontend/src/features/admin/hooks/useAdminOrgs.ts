import { useQuery } from "@tanstack/react-query";

import { fetchAdminOrgs } from "../services/admin";

import { qk } from "@/shared/api/queryKeys";

export function useAdminOrgs() {
  return useQuery({ queryKey: qk.adminOrgs(), queryFn: fetchAdminOrgs });
}
