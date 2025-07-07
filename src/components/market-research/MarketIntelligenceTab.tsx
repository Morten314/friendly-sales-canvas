
import React from 'react';
import MarketSizeSection from './MarketSizeSection';
import IndustryTrendsSection from './IndustryTrendsSection';
import CompetitorLandscapeSection from './CompetitorLandscapeSection';

interface EditRecord {
  id: string;
  timestamp: string;
  user: string;
  summary: string;
  field: string;
  oldValue: string;
  newValue: string;
}

interface TrendSnapshot {
  title: string;
  metric: string;
  type: 'growth' | 'performance' | 'adoption';
}

interface IndustryTrendsRecommendations {
  primaryFocus: string;
  marketEntry: string;
}

interface MarketIntelligenceTabProps {
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
  // Industry Trends props
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
  // Competitor Landscape props (optional to maintain backward compatibility)
  isCompetitorEditing?: boolean;
  competitorExpanded?: boolean;
  competitorHasEdits?: boolean;
  competitorDeletedSections?: Set<string>;
  competitorEditHistory?: EditRecord[];
  competitorExecutiveSummary?: string;
  competitorTopPlayerShare?: string;
  competitorEmergingPlayers?: string;
  competitorFundingNews?: string[];
  onToggleEdit: () => void;
  onScoutIconClick: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape', hasEdits?: boolean, lastEditedField?: string) => void;
  onEditHistoryOpen: () => void;
  onDeleteSection: (sectionId: string) => void;
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
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
}

const MarketIntelligenceTab: React.FC<MarketIntelligenceTabProps> = (props) => {
  return (
    <div className={`${props.isSplitView ? 'w-3/5' : 'flex-1'} transition-all duration-500 space-y-6`}>
      {/* Market Size & Opportunity Section */}
      <MarketSizeSection
        isEditing={props.isEditing}
        isSplitView={props.isSplitView}
        isExpanded={props.isExpanded}
        hasEdits={props.hasEdits}
        deletedSections={props.deletedSections}
        editHistory={props.editHistory}
        executiveSummary={props.executiveSummary}
        tamValue={props.tamValue}
        samValue={props.samValue}
        apacGrowthRate={props.apacGrowthRate}
        strategicRecommendations={props.strategicRecommendations}
        marketEntry={props.marketEntry}
        marketDrivers={props.marketDrivers}
        onToggleEdit={props.onToggleEdit}
        onScoutIconClick={props.onScoutIconClick}
        onEditHistoryOpen={props.onEditHistoryOpen}
        onDeleteSection={props.onDeleteSection}
        onSaveChanges={props.onSaveChanges}
        onCancelEdit={props.onCancelEdit}
        onExpandToggle={props.onExpandToggle}
        onExecutiveSummaryChange={props.onExecutiveSummaryChange}
        onTamValueChange={props.onTamValueChange}
        onSamValueChange={props.onSamValueChange}
        onApacGrowthRateChange={props.onApacGrowthRateChange}
        onStrategicRecommendationsChange={props.onStrategicRecommendationsChange}
        onMarketEntryChange={props.onMarketEntryChange}
        onMarketDriversChange={props.onMarketDriversChange}
        onExportPDF={props.onExportPDF}
        onSaveToWorkspace={props.onSaveToWorkspace}
        onGenerateShareableLink={props.onGenerateShareableLink}
      />

      {/* Industry Trends Section */}
      <IndustryTrendsSection
        isIndustryTrendsEditing={props.isIndustryTrendsEditing}
        isSplitView={props.isSplitView}
        industryTrendsExpanded={props.industryTrendsExpanded}
        industryTrendsHasEdits={props.industryTrendsHasEdits}
        industryTrendsDeletedSections={props.industryTrendsDeletedSections}
        industryTrendsEditHistory={props.industryTrendsEditHistory}
        industryTrendsExecutiveSummary={props.industryTrendsExecutiveSummary}
        industryTrendsAiAdoption={props.industryTrendsAiAdoption}
        industryTrendsCloudMigration={props.industryTrendsCloudMigration}
        industryTrendsRegulatory={props.industryTrendsRegulatory}
        industryTrendSnapshots={props.industryTrendSnapshots}
        industryTrendsRecommendations={props.industryTrendsRecommendations}
        industryTrendsRisks={props.industryTrendsRisks}
        onIndustryTrendsToggleEdit={props.onIndustryTrendsToggleEdit}
        onIndustryTrendsSaveChanges={props.onIndustryTrendsSaveChanges}
        onIndustryTrendsCancelEdit={props.onIndustryTrendsCancelEdit}
        onIndustryTrendsDeleteSection={props.onIndustryTrendsDeleteSection}
        onIndustryTrendsEditHistoryOpen={props.onIndustryTrendsEditHistoryOpen}
        onIndustryTrendsExpandToggle={props.onIndustryTrendsExpandToggle}
        onIndustryTrendsExecutiveSummaryChange={props.onIndustryTrendsExecutiveSummaryChange}
        onScoutIconClick={props.onScoutIconClick}
        onExportPDF={props.onExportPDF}
        onSaveToWorkspace={props.onSaveToWorkspace}
        onGenerateShareableLink={props.onGenerateShareableLink}
      />

      {/* Competitor Landscape Section */}
      <CompetitorLandscapeSection
        isEditing={props.isCompetitorEditing || false}
        isSplitView={props.isSplitView}
        isExpanded={props.competitorExpanded || false}
        hasEdits={props.competitorHasEdits || false}
        deletedSections={props.competitorDeletedSections || new Set()}
        editHistory={props.competitorEditHistory || []}
        executiveSummary={props.competitorExecutiveSummary || ''}
        topPlayerShare={props.competitorTopPlayerShare || ''}
        emergingPlayers={props.competitorEmergingPlayers || ''}
        fundingNews={props.competitorFundingNews || []}
        onToggleEdit={props.onCompetitorToggleEdit || (() => {})}
        onScoutIconClick={props.onScoutIconClick}
        onEditHistoryOpen={props.onCompetitorEditHistoryOpen || (() => {})}
        onDeleteSection={props.onCompetitorDeleteSection || (() => {})}
        onSaveChanges={props.onCompetitorSaveChanges || (() => {})}
        onCancelEdit={props.onCompetitorCancelEdit || (() => {})}
        onExpandToggle={props.onCompetitorExpandToggle || (() => {})}
        onExecutiveSummaryChange={props.onCompetitorExecutiveSummaryChange || (() => {})}
        onTopPlayerShareChange={props.onCompetitorTopPlayerShareChange || (() => {})}
        onEmergingPlayersChange={props.onCompetitorEmergingPlayersChange || (() => {})}
        onFundingNewsChange={props.onCompetitorFundingNewsChange || (() => {})}
        onExportPDF={props.onExportPDF}
        onSaveToWorkspace={props.onSaveToWorkspace}
        onGenerateShareableLink={props.onGenerateShareableLink}
      />
    </div>
  );
};

export default MarketIntelligenceTab;
