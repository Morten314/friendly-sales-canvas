import type { EditRecord } from "../../types";

import type {
  UntypedBackendApiResponse,
  UntypedBackendProfile,
} from "@/shared/types/escape-hatches";

export type { EditRecord, UntypedBackendApiResponse, UntypedBackendProfile };

export interface DataPoint {
  label: string;
  value: string;
}

export interface RegionShare {
  name: string;
  data: Record<string, string>;
}

export interface SwotEntity {
  name: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface MnaInsight {
  label: string;
  description: string;
}

export interface TrendChart {
  name: string;
  xAxis: string | string[];
}

export interface Metric {
  label: string;
  value: string;
  trend?: string;
}

export interface CompetitorLandscapeSectionProps {
  isEditing: boolean;
  isSplitView: boolean;
  isExpanded: boolean;
  hasEdits: boolean;
  deletedSections: Set<string>;
  editHistory: EditRecord[];
  executiveSummary: string;
  topPlayerShare: string;
  emergingPlayers: string;
  fundingNews: string[];
  onToggleEdit: () => void;
  onScoutIconClick: (
    context?: "market-size" | "industry-trends" | "competitor-landscape",
    hasEdits?: boolean,
    customMessage?: string,
  ) => void;
  onEditHistoryOpen: () => void;
  onDeleteSection: (sectionId: string) => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onExpandToggle: (expanded: boolean) => void;
  onExecutiveSummaryChange: (value: string) => void;
  onTopPlayerShareChange: (value: string) => void;
  onEmergingPlayersChange: (value: string) => void;
  onFundingNewsChange: (news: string[]) => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
  // Add refresh props
  isRefreshing?: boolean;
  companyProfile?: UntypedBackendProfile;
}
