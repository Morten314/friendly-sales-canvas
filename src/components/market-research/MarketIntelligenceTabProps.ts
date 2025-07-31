
import { EditRecord, TrendSnapshot, IndustryTrendsRecommendations } from './types';

export interface MarketIntelligenceTabProps {
  // Market Size Section
  isEditing: boolean;
  isSplitView: boolean;
  isExpanded: boolean;
  hasEdits: boolean;
  deletedSections: Set<string>;
  editHistory: EditRecord[];
  executiveSummary: string;
  tamValue: string;
  samValue: string;
  apacGrowthRate: string;
  strategicRecommendations: string[];
  marketEntry: string;
  marketDrivers: string[];
  marketSizeBySegment?: Record<string, string>;
  growthProjections?: Record<string, string>;
  marketSizeDeletedSections: Set<string>;
  isMarketSizeLoading?: boolean;
  marketSizeError?: string | null;
  onMarketSizeRefresh?: () => void;
  
  // Industry Trends Section
  isIndustryTrendsEditing: boolean;
  industryTrendsExpanded: boolean;
  industryTrendsHasEdits: boolean;
  industryTrendsDeletedSections: Set<string>;
  industryTrendsEditHistory: EditRecord[];
  industryTrendsExecutiveSummary: string;
  industryTrendsAiAdoption: string;
  industryTrendsCloudMigration: string;
  industryTrendsRegulatory: string;
  industryTrendSnapshots: TrendSnapshot[];
  industryTrendsRecommendations: IndustryTrendsRecommendations;
  industryTrendsRisks: string[];
  industryTrendsLastEditedField: string;
  
  // Competitor Landscape Section
  isCompetitorEditing: boolean;
  competitorExpanded: boolean;
  competitorHasEdits: boolean;
  competitorDeletedSections: Set<string>;
  competitorEditHistory: EditRecord[];
  competitorExecutiveSummary: string;
  competitorTopPlayerShare: string;
  competitorEmergingPlayers: string;
  competitorFundingNews: string[];
  // Regulatory Compliance props
  isRegulatoryEditing?: boolean;
  regulatoryExpanded?: boolean;
  regulatoryHasEdits?: boolean;
  regulatoryDeletedSections?: Set<string>;
  regulatoryEditHistory?: EditRecord[];
  regulatoryExecutiveSummary?: string;
  regulatoryEuAiActDeadline?: string;
  regulatoryGdprCompliance?: string;
  regulatoryPotentialFines?: string;
  regulatoryDataLocalization?: string;
  // Market Entry props
  isMarketEntryEditing?: boolean;
  marketEntryExpanded?: boolean;
  marketEntryHasEdits?: boolean;
  marketEntryDeletedSections?: Set<string>;
  marketEntryEditHistory?: EditRecord[];
  marketEntryExecutiveSummary?: string;
  marketEntryBarriers?: string[];
  marketEntryRecommendedChannel?: string;
  marketEntryTimeToMarket?: string;
  marketEntryTopBarrier?: string;
  marketEntryCompetitiveDifferentiation?: string[];
  marketEntryStrategicRecommendations?: string[];
  marketEntryRiskAssessment?: string[];
  // Market Entry loading states and handlers
  isMarketEntryLoading?: boolean;
  marketEntryError?: string | null;
  onMarketEntryRefresh?: () => void;
  onToggleEdit: () => void;
  onMarketSizeScoutIconClick: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape' | 'regulatory-compliance' | 'market-entry', hasEdits?: boolean, lastEditedField?: string) => void;
  onIndustryTrendsScoutIconClick: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape' | 'regulatory-compliance' | 'market-entry', hasEdits?: boolean, lastEditedField?: string) => void;
  onCompetitorScoutIconClick: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape' | 'regulatory-compliance' | 'market-entry', hasEdits?: boolean, lastEditedField?: string) => void;
  onRegulatoryScoutIconClick?: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape' | 'regulatory-compliance' | 'market-entry', hasEdits?: boolean, lastEditedField?: string) => void;
  onMarketEntryScoutIconClick?: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape' | 'regulatory-compliance' | 'market-entry', hasEdits?: boolean, customMessage?: string) => void;
  onEditHistoryOpen: () => void;
  onDeleteSection: (sectionId: string) => void;
  onMarketSizeDeleteSection: (sectionId: string) => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onExpandToggle: (expanded: boolean) => void;
  onExecutiveSummaryChange: (value: string) => void;
  onTamValueChange: (value: string) => void;
  onSamValueChange: (value: string) => void;
  onApacGrowthRateChange: (value: string) => void;
  onStrategicRecommendationsChange: (recommendations: string[]) => void;
  onMarketEntryChange: (value: string) => void;
  onMarketDriversChange: (drivers: string[]) => void;
  // Industry Trends handlers
  onIndustryTrendsToggleEdit: () => void;
  onIndustryTrendsSaveChanges: () => void;
  onIndustryTrendsCancelEdit: () => void;
  onIndustryTrendsDeleteSection: (sectionId: string) => void;
  onIndustryTrendsEditHistoryOpen: () => void;
  onIndustryTrendsExpandToggle: (expanded: boolean) => void;
  onIndustryTrendsExecutiveSummaryChange: (value: string) => void;
  onIndustryTrendsAiAdoptionChange: (value: string) => void;
  onIndustryTrendsCloudMigrationChange: (value: string) => void;
  onIndustryTrendsRegulatoryChange: (value: string) => void;
  onIndustryTrendSnapshotsChange: (snapshots: TrendSnapshot[]) => void;
  // Competitor Landscape handlers (optional to maintain backward compatibility)
  onCompetitorToggleEdit?: () => void;
  onCompetitorSaveChanges?: () => void;
  onCompetitorCancelEdit?: () => void;
  onCompetitorDeleteSection?: (sectionId: string) => void;
  onCompetitorEditHistoryOpen?: () => void;
  onCompetitorExpandToggle?: (expanded: boolean) => void;
  onCompetitorExecutiveSummaryChange?: (value: string) => void;
  onCompetitorTopPlayerShareChange?: (value: string) => void;
  onCompetitorEmergingPlayersChange?: (value: string) => void;
  onCompetitorFundingNewsChange?: (news: string[]) => void;
  // Regulatory Compliance handlers
  onRegulatoryToggleEdit?: () => void;
  onRegulatorySaveChanges?: () => void;
  onRegulatoryCancelEdit?: () => void;
  onRegulatoryDeleteSection?: (sectionId: string) => void;
  onRegulatoryEditHistoryOpen?: () => void;
  onRegulatoryExpandToggle?: (expanded: boolean) => void;
  onRegulatoryExecutiveSummaryChange?: (value: string) => void;
  onRegulatoryEuAiActDeadlineChange?: (value: string) => void;
  onRegulatoryGdprComplianceChange?: (value: string) => void;
  onRegulatoryPotentialFinesChange?: (value: string) => void;
  onRegulatoryDataLocalizationChange?: (value: string) => void;
  // Market Entry handlers
  onMarketEntryToggleEdit?: () => void;
  onMarketEntrySaveChanges?: () => void;
  onMarketEntryCancelEdit?: () => void;
  onMarketEntryDeleteSection?: (sectionId: string) => void;
  onMarketEntryEditHistoryOpen?: () => void;
  onMarketEntryExpandToggle?: (expanded: boolean) => void;
  onMarketEntryExecutiveSummaryChange?: (value: string) => void;
  onMarketEntryBarriersChange?: (barriers: string[]) => void;
  onMarketEntryRecommendedChannelChange?: (value: string) => void;
  onMarketEntryTimeToMarketChange?: (value: string) => void;
  onMarketEntryTopBarrierChange?: (value: string) => void;
  onMarketEntryCompetitiveDifferentiationChange?: (differentiation: string[]) => void;
  onMarketEntryStrategicRecommendationsChange?: (recommendations: string[]) => void;
  onMarketEntryRiskAssessmentChange?: (risks: string[]) => void;
  
  // Scout panel visibility states
  showMarketSizeScoutChat?: boolean;
  showIndustryTrendsScoutChat?: boolean;
  showCompetitorScoutChat?: boolean;
  showRegulatoryScoutChat?: boolean;
  showMarketEntryScoutChat?: boolean;
  
  // Scout panel props
  marketSizeHasEdits?: boolean;
  marketSizeLastEditedField?: string;
  marketSizeCustomMessage?: string;
  // industryTrendsLastEditedField already defined above
  industryTrendsCustomMessage?: string;
  competitorLastEditedField?: string;
  competitorCustomMessage?: string;
  regulatoryLastEditedField?: string;
  regulatoryCustomMessage?: string;
  regulatoryIsPostSave?: boolean;
  marketEntryLastEditedField?: string;
  marketEntryCustomMessage?: string;
  marketEntryIsPostSave?: boolean;
  
  // Scout panel close handlers
  onMarketSizeScoutClose?: () => void;
  onIndustryTrendsScoutClose?: () => void;
  onCompetitorScoutClose?: () => void;
  onRegulatoryScoutClose?: () => void;
  onMarketEntryScoutClose?: () => void;
  
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
}
