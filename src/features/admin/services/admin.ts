import { z } from "zod";
import type { ZodType } from "zod";

import {
  AdminOrgListSchema,
  AppSettingsSchema,
  OrgResponseSchema,
  RegistrationSchema,
  SystemHealthSchema,
  type AdminOrgSummary,
  type AppSettings,
  type OrgResponse,
  type Registration,
  type SystemHealth,
} from "../types";

import { apiGet, apiPost, apiRequest } from "@/shared/api/client";
import { paginatedSchema } from "@/shared/api/pagination";
import { auth } from "@/shared/auth/firebase";

const enc = encodeURIComponent;
const Unknown = z.unknown();

// The two /admin/* endpoints are the only backend-enforced surface (spec 44 /
// TD-FE-79): they require a verified Firebase ID token from an allowlisted
// operator. Attach it here; the reused parity/inspection endpoints stay open.
async function adminAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

export async function fetchAdminOrgs(): Promise<AdminOrgSummary[]> {
  return apiRequest("admin/orgs", AdminOrgListSchema as ZodType<AdminOrgSummary[]>, {
    method: "GET",
    headers: await adminAuthHeaders(),
  });
}

export async function fetchSystemHealth(): Promise<SystemHealth> {
  return apiRequest("admin/health", SystemHealthSchema, {
    method: "GET",
    headers: await adminAuthHeaders(),
  });
}

export async function fetchAppSettings(): Promise<AppSettings> {
  return apiRequest("admin/settings", AppSettingsSchema, {
    method: "GET",
    headers: await adminAuthHeaders(),
  });
}

export async function updateAppSettings(settings: AppSettings): Promise<AppSettings> {
  return apiRequest("admin/settings", AppSettingsSchema, {
    method: "PUT",
    body: settings,
    headers: await adminAuthHeaders(),
  });
}

const RegistrationPageSchema = paginatedSchema(RegistrationSchema);
export type RegistrationPage = z.infer<typeof RegistrationPageSchema>;

export function fetchRegistrations(limit: number, offset: number): Promise<RegistrationPage> {
  // v2 paginated envelope — NOT the deprecated/capped v1 GET /registration (spec §5 C).
  return apiGet(
    `v2/registration?limit=${limit}&offset=${offset}`,
    RegistrationPageSchema as ZodType<RegistrationPage>,
  );
}

export function createRegistration(body: { name: string; email: string }): Promise<Registration> {
  return apiPost("registration", body, RegistrationSchema);
}

export function createOrg(orgName: string): Promise<OrgResponse> {
  return apiPost("org", { org_name: orgName }, OrgResponseSchema);
}

export function connectUserToOrg(userId: string, orgId: string): Promise<OrgResponse> {
  return apiPost("connect_org", { user_id: userId, org_id: orgId }, OrgResponseSchema);
}

export function lookupOrgByUser(userId: string): Promise<OrgResponse> {
  return apiGet(`org?user_id=${enc(userId)}`, OrgResponseSchema);
}

// Inspection (read-only). Endpoints are loosely typed — parse tolerantly.
export function fetchCompanyProfile(orgId: string): Promise<unknown> {
  return apiGet(`profile/company?org_id=${enc(orgId)}`, Unknown);
}

export function fetchCustomerProfiles(orgId: string): Promise<unknown> {
  return apiGet(`customer_profile?org_id=${enc(orgId)}`, Unknown);
}

export function fetchOrgLeads(orgId: string): Promise<unknown[]> {
  // Leads are ORG-scoped. Use the v2 paginated envelope — NOT the
  // deprecated/500-capped v1 `GET /leads` (which also requires org_id, not
  // user_id). First page only; the ops view is a spot-check, not an export.
  return apiGet(`v2/leads?org_id=${enc(orgId)}&limit=500&offset=0`, paginatedSchema(Unknown)).then(
    (env) => env.items as unknown[],
  );
}

export function fetchUserDocuments(orgId: string): Promise<unknown[]> {
  // Org-scoped uploaded documents (v2 paginated envelope). First page only.
  return apiGet(
    `v2/user-documents?org_id=${enc(orgId)}&limit=500&offset=0`,
    paginatedSchema(Unknown),
  ).then((env) => env.items as unknown[]);
}
