import { useQuery } from "@tanstack/react-query";

import { fetchSystemHealth } from "../services/admin";

import { qk } from "@/shared/api/queryKeys";

export function useSystemHealth() {
  return useQuery({ queryKey: qk.adminHealth(), queryFn: fetchSystemHealth, retry: false });
}
