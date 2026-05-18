export type Treatment = "DIRECT" | "CHANNEL" | "NURTURE" | "EXCLUDE";
export type Priority = "HIGH" | "MEDIUM" | "LOW";
export type ReviewState = "reviewed" | "overridden" | "edited" | "awaiting";
export type ChannelId =
  | "meta"
  | "tiktok"
  | "linkedin"
  | "email"
  | "crm"
  | "figma"
  | "personalized";

export interface Contact {
  name: string;
  role: string;
  recentActivities: string[];
  challenges: string[];
  interests: string[];
}

export interface Account {
  id: string;
  name: string;
  domain: string;
  contacts: Contact[];
}

export interface Cohort {
  id: string;
  name: string;
  treatment: Treatment;
  priority: Priority;
  reviewState: ReviewState;
  definition: string;
  rationale: string;
  killCriterion: string;
  scoring: {
    fit: number;
    intent: number;
    confidence: number;
    composite: number;
  };
  overrideHistory: { at: string; by: string; note: string }[];
  accounts: Account[];
  suggestedChannels: ChannelId[];
}

export interface SEPFile {
  name: string;
  mime: "application/json" | "text/markdown";
  content: string;
}

export interface SEPCohortFolder {
  cohortId: string;
  name: string;
  treatment: Treatment;
  priority: Priority;
  folderName: string;
  channels: ChannelId[];
  accountCount: number;
  files: SEPFile[];
}

export interface SEPImmediateAction {
  cohortId: string;
  action: string;
  priority: Priority;
  channel: ChannelId | "none";
}

export interface SEPManifest {
  id: string;
  version: number;
  status: "draft" | "approved";
  generatedAt: string;
  approvedAt: string | null;
  approvedBy: { roleId: string; name: string } | null;
  boardId: string;
  scope: "board" | "cohort";
  immediateActions: SEPImmediateAction[];
  cohorts: {
    id: string;
    name: string;
    treatment: Treatment;
    priority: Priority;
    folderName: string;
    channels: ChannelId[];
    accountCount: number;
  }[];
}

export interface SEP {
  manifest: SEPManifest;
  cohorts: SEPCohortFolder[];
}

export const CHANNEL_META: Record<
  ChannelId,
  { label: string; description: string }
> = {
  meta: { label: "Meta", description: "Facebook + Instagram paid social" },
  tiktok: { label: "TikTok", description: "TikTok paid + organic" },
  linkedin: { label: "LinkedIn", description: "InMail and sequenced outreach" },
  email: { label: "Email", description: "Sequenced cold email" },
  crm: { label: "CRM", description: "Enroll into existing CRM workflows" },
  figma: { label: "Figma / Design", description: "Creative brief for the design team" },
  personalized: { label: "Personalized outreach", description: "1:1 hand-crafted messages" },
};

export const TREATMENT_META: Record<Treatment, { label: string; tone: string }> = {
  DIRECT: { label: "Direct", tone: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" },
  CHANNEL: { label: "Channel", tone: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800" },
  NURTURE: { label: "Nurture", tone: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800" },
  EXCLUDE: { label: "Exclude", tone: "bg-muted text-muted-foreground border-border" },
};

export const PRIORITY_META: Record<Priority, { label: string; tone: string; rank: number }> = {
  HIGH: { label: "High", tone: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800", rank: 0 },
  MEDIUM: { label: "Medium", tone: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800", rank: 1 },
  LOW: { label: "Low", tone: "bg-muted text-muted-foreground border-border", rank: 2 },
};

export const TREATMENT_RANK: Record<Treatment, number> = {
  DIRECT: 0,
  CHANNEL: 1,
  NURTURE: 2,
  EXCLUDE: 3,
};

export const REVIEW_RANK: Record<ReviewState, number> = {
  reviewed: 0,
  overridden: 0,
  edited: 1,
  awaiting: 2,
};