import { z } from "zod";

// GET /api/profile/company response. Permissive (every field nullish +
// passthrough) so a "no profile yet" empty body or extra backend fields parse
// cleanly; reconcile against the live capture in the Slice-1 task (spec 20 §3.5,
// R1). Field names are taken from what CompanyProfile.tsx reads/writes today.
export const SocialMediaUrlSchema = z
  .object({
    platform: z.string(),
    url: z.string(),
  })
  .passthrough();

export const CompanyProfileSchema = z
  .object({
    org_id: z.string().nullish(),
    user_id: z.string().nullish(),
    industry: z.string().nullish(),
    companySize: z.string().nullish(),
    companyUrl: z.string().nullish(),
    website: z.string().nullish(),
    strategicGoals: z.string().nullish(),
    primaryGTMModel: z.string().nullish(),
    gtmModel: z.string().nullish(),
    revenueStage: z.string().nullish(),
    keyBuyerPersona: z.string().nullish(),
    targetMarkets: z.array(z.string()).nullish(),
    socialMediaUrls: z.array(SocialMediaUrlSchema).nullish(),
  })
  .passthrough();
export type CompanyProfileResponse = z.infer<typeof CompanyProfileSchema>;

// Save (POST) response is logged but not consumed by the UI today; validate
// loosely so it never over-fires.
export const CompanyProfileSaveResponseSchema = z.object({}).passthrough();
export type CompanyProfileSaveResponse = z.infer<typeof CompanyProfileSaveResponseSchema>;
