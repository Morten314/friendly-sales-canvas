import type { UntypedBackendApiResponse } from "@/shared/types/escape-hatches";

/**
 * The 16 company-profile form fields (snake_case + camelCase tolerated, trimmed).
 */
export interface CompanyProfileFields {
  companyName: string;
  headquarters: string;
  employeeSize: string;
  industry: string;
  revenue: string;
  gtmModel: string;
  regionFocus: string;
  dealSize: string;
  companyUrl: string;
  keyBuyerPersona: string;
  goals: string;
  painPoints: string;
  targetSegments: string;
  excludeSegments: string;
  compliance: string;
  constraints: string;
}

/**
 * Map a company-profile API payload → the form-shaped fields. Returns null for an
 * empty payload. The company profile is org-owned, not per-user, so a `user_id` on
 * the payload that differs from the caller does NOT blank it — any member of the
 * org may read/hydrate it (Plan 48 Task 13; previously a stray per-user guard
 * incorrectly blanked the profile for other org members). Shared by
 * CompanyProfileForm (editable form hydration) and MissionControlPage (the
 * read-driven localStorage backup write) — both derived the same transform;
 * unified per phase-6 impl-review-1.
 */
export const mapApiDataToCompanyProfileFields = (
  data: UntypedBackendApiResponse,
  // Retained for call-site/signature stability (org-owned data no longer needs the
  // caller's id to decide whether to map it — see the doc comment above).
  _userId: string,
): CompanyProfileFields | null => {
  if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
    return null;
  }
  return {
    companyName: (data.company_name || data.companyName || "").trim(),
    headquarters: (data.headquarters || "").trim(),
    employeeSize: (data.employee_size || data.employeeSize || "").trim(),
    industry: (data.industry || "").trim(),
    revenue: (data.revenue_band || data.revenue || "").trim(),
    gtmModel: (data.gtm_model || data.gtmModel || "").trim(),
    regionFocus: (data.region_focus || data.regionFocus || "").trim(),
    dealSize: (data.typical_deal_size || data.dealSize || "").trim(),
    companyUrl: (data.company_url || data.companyUrl || "").trim(),
    keyBuyerPersona: (data.key_buyer_persona || data.keyBuyerPersona || "").trim(),
    goals: (data.goals || "").trim(),
    painPoints: (data.pain_points || data.painPoints || "").trim(),
    targetSegments: (data.target_segments || data.targetSegments || "").trim(),
    excludeSegments: (data.exclude_segments || data.excludeSegments || "").trim(),
    compliance: (data.compliance || "").trim(),
    constraints: (data.constraints || "").trim(),
  };
};
