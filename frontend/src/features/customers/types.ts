// Feature-local types for `customers`, extracted verbatim from
// SuggestedICPCards.tsx (Spec 26 §3). The escape-hatch `UntypedProfilerIcpRecord`
// retype stays deferred (TD-FE-9/10 posture) — import it from
// "@/shared/types/escape-hatches" where needed.

export interface ExistingICP {
  id: string;
  name: string;
  geography?: string;
  industry?: string;
  companySize?: string;
  buyerRole?: string;
  fitConfidence?: string;
  status?: "active" | "inactive";
}

export interface SuggestedICP {
  id: string;
  name: string;
  type: "refined" | "new";
  sourceICPId?: string;
  sourceICPName?: string;
  industry: string;
  segment: string;
  companySize: string;
  decisionMakers: string[];
  regions: string[];
  keyAttributes: string[];
  growthIndicator?: string;
  whySuggested: string[];
  whatChanged?: string[];
  opportunityUnlocked?: string;
  confidenceScore: "High" | "Medium" | "Low";
  tag?: string;
  marketSize?: string;
  growth?: string;
  topPainPoint?: string;
  buyingTriggers?: string[];
  competitors?: string[];
  /** Full report payload from GET /icp (per card). Shown only after "View Full Report". */
  fullReport?: Record<string, unknown>;
}

export interface ICPCardStatus {
  status: "suggested" | "accepted" | "rejected";
  acceptedAt?: Date;
  rejectedAt?: Date;
}

export interface SuggestedICPCardsProps {
  onICPAccepted?: (icp: SuggestedICP) => void;
  onICPRejected?: (icp: SuggestedICP) => void;
  refreshTrigger?: number;
}

// --- ICP Chip Modal Content (Profiler's interpretation) ---
export interface ICPAnalysis {
  interpretation: string;
  strengths: string[];
  weaknesses: string[];
  missing: string[];
  broadNarrow: string;
  confidence: "High" | "Medium" | "Low";
}

export type PendingRecommendedRejectItem = {
  icp_id: string;
  user_id: string;
  expiresAt: number;
  icpSnapshot?: unknown;
};

export type DismissedRecommendedStore = Record<string, string[]>;
