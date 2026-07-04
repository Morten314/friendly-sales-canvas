import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchAppSettings, updateAppSettings } from "../services/admin";
import type { AppSettings } from "../types";

import { qk } from "@/shared/api/queryKeys";

export function useAppSettings() {
  return useQuery({ queryKey: qk.adminSettings(), queryFn: fetchAppSettings, retry: false });
}

export function useUpdateAppSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: AppSettings) => updateAppSettings(settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.adminSettings() }),
  });
}
