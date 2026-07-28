import type { LucideIcon } from "lucide-react";

import type { EditRecord } from "../../types";

import type {
  UntypedBackendApiResponse,
  UntypedBackendProfile,
  UntypedRegionData,
  UntypedVisualDataCard,
  UntypedRegulatoryUpdate,
} from "@/shared/types/escape-hatches";

export type {
  UntypedBackendApiResponse,
  UntypedBackendProfile,
  UntypedRegionData,
  UntypedVisualDataCard,
  UntypedRegulatoryUpdate,
  EditRecord,
};

/** Derived "key data point" card shape (output of deriveKeyDataPoints). */
export interface RegulatoryKeyDataPoint {
  id: string;
  icon: LucideIcon;
  title: string;
  value: string;
  badge: string;
  badgeColor: string;
  tooltip: string;
}

export interface RegulatoryComplianceSectionProps {
  isEditing: boolean;
  isSplitView: boolean;
  isExpanded: boolean;
  hasEdits: boolean;
  deletedSections: Set<string>;
  editHistory: EditRecord[];
  executiveSummary: string;
  euAiActDeadline: string;
  gdprCompliance: string;
  potentialFines: string;
  dataLocalization: string;
  onToggleEdit: () => void;
  onScoutIconClick: (
    context?: "market-size" | "industry-trends" | "competitor-landscape" | "regulatory-compliance",
    hasEdits?: boolean,
    customMessage?: string,
  ) => void;
  onEditHistoryOpen: () => void;
  onDeleteSection: (sectionId: string) => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onExpandToggle: (expanded: boolean) => void;
  onExecutiveSummaryChange: (value: string) => void;
  onEuAiActDeadlineChange: (value: string) => void;
  onGdprComplianceChange: (value: string) => void;
  onPotentialFinesChange: (value: string) => void;
  onDataLocalizationChange: (value: string) => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
  companyProfile?: UntypedBackendProfile;
}
