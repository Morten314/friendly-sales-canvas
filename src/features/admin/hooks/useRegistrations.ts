import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createRegistration, fetchRegistrations } from "../services/admin";

import { qk } from "@/shared/api/queryKeys";

export function useRegistrations(limit: number, offset: number) {
  return useQuery({
    queryKey: qk.adminRegistrations(limit, offset),
    queryFn: () => fetchRegistrations(limit, offset),
  });
}

export function useCreateRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string }) => createRegistration(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "registrations"] }),
  });
}
