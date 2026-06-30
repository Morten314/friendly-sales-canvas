import { useQuery } from "@tanstack/react-query";

import {
  fetchCompanyProfile,
  fetchCustomerProfiles,
  fetchOrgLeads,
  fetchUserDocuments,
} from "../services/admin";

import { qk } from "@/shared/api/queryKeys";

export function useCompanyProfile(orgId: string) {
  return useQuery({
    queryKey: qk.adminCompanyProfile(orgId),
    queryFn: () => fetchCompanyProfile(orgId),
    enabled: !!orgId,
    retry: false,
  });
}

export function useCustomerProfiles(orgId: string) {
  return useQuery({
    queryKey: qk.adminCustomerProfiles(orgId),
    queryFn: () => fetchCustomerProfiles(orgId),
    enabled: !!orgId,
    retry: false,
  });
}

export function useOrgLeads(orgId: string) {
  return useQuery({
    queryKey: qk.adminOrgLeads(orgId),
    queryFn: () => fetchOrgLeads(orgId),
    enabled: !!orgId,
    retry: false,
  });
}

export function useUserDocuments(orgId: string) {
  return useQuery({
    queryKey: qk.adminUserDocuments(orgId),
    queryFn: () => fetchUserDocuments(orgId),
    enabled: !!orgId,
    retry: false,
  });
}
