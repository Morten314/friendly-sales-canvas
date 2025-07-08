
import React from 'react';
import MarketSizeSection from './MarketSizeSection';
import IndustryTrendsSection from './IndustryTrendsSection';
import CompetitorLandscapeSection from './CompetitorLandscapeSection';
import RegulatoryComplianceSection from './RegulatoryComplianceSection';
import { MarketIntelligenceTabProps } from './MarketIntelligenceTabProps';

interface MarketIntelligenceSectionsProps extends MarketIntelligenceTabProps {}

const MarketIntelligenceSections: React.FC<MarketIntelligenceSectionsProps> = (props) => {
  return (
    <>
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
        onScoutIconClick={props.onMarketSizeScoutIconClick}
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
        onScoutIconClick={props.onIndustryTrendsScoutIconClick}
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
        onScoutIconClick={props.onCompetitorScoutIconClick}
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

      {/* Regulatory & Compliance Highlights Section */}
      <RegulatoryComplianceSection
        isEditing={props.isRegulatoryEditing || false}
        isSplitView={props.isSplitView}
        isExpanded={props.regulatoryExpanded || false}
        hasEdits={props.regulatoryHasEdits || false}
        deletedSections={props.regulatoryDeletedSections || new Set()}
        editHistory={props.regulatoryEditHistory || []}
        executiveSummary={props.regulatoryExecutiveSummary || 'The regulatory landscape for SaaS companies continues to evolve rapidly, with new compliance requirements emerging across multiple jurisdictions. Organizations must navigate an increasingly complex web of data protection, AI governance, and industry-specific regulations.'}
        euAiActDeadline={props.regulatoryEuAiActDeadline || 'February 2, 2025'}
        gdprCompliance={props.regulatoryGdprCompliance || '68%'}
        potentialFines={props.regulatoryPotentialFines || 'Up to 6% of annual revenue'}
        dataLocalization={props.regulatoryDataLocalization || 'Mandatory for customer data'}
        onToggleEdit={props.onRegulatoryToggleEdit || (() => {})}
        onScoutIconClick={props.onRegulatoryScoutIconClick || props.onMarketSizeScoutIconClick}
        onEditHistoryOpen={props.onRegulatoryEditHistoryOpen || (() => {})}
        onDeleteSection={props.onRegulatoryDeleteSection || (() => {})}
        onSaveChanges={props.onRegulatorySaveChanges || (() => {})}
        onCancelEdit={props.onRegulatoryCancelEdit || (() => {})}
        onExpandToggle={props.onRegulatoryExpandToggle || (() => {})}
        onExecutiveSummaryChange={props.onRegulatoryExecutiveSummaryChange || (() => {})}
        onEuAiActDeadlineChange={props.onRegulatoryEuAiActDeadlineChange || (() => {})}
        onGdprComplianceChange={props.onRegulatoryGdprComplianceChange || (() => {})}
        onPotentialFinesChange={props.onRegulatoryPotentialFinesChange || (() => {})}
        onDataLocalizationChange={props.onRegulatoryDataLocalizationChange || (() => {})}
        onExportPDF={props.onExportPDF}
        onSaveToWorkspace={props.onSaveToWorkspace}
        onGenerateShareableLink={props.onGenerateShareableLink}
      />
    </>
  );
};

export default MarketIntelligenceSections;
