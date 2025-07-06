import React, { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { EditRecord } from '@/types';
import MarketIntelligenceTab from '@/components/market-research/MarketIntelligenceTab';
import { ExportPDF } from '@/components/modals/ExportPDF';
import { SaveToWorkspace } from '@/components/modals/SaveToWorkspace';
import { ShareableLink } from '@/components/modals/ShareableLink';

const MarketResearch = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);
  const [deletedSections, setDeletedSections] = useState(new Set<string>());
  const [editHistory, setEditHistory] = useState<EditRecord[]>([]);
  const [executiveSummary, setExecutiveSummary] = useState("The global market size is projected to reach $4.2 billion by 2027, growing at a CAGR of 12.5% from 2020 to 2027.");
  const [tamValue, setTamValue] = useState("$4.2B");
  const [samValue, setSamValue] = useState("$2.1B");
  const [apacGrowthRate, setApacGrowthRate] = useState("25%");
  const [strategicRecommendations, setStrategicRecommendations] = useState([
    "Expand into the APAC region to capitalize on high growth rates.",
    "Focus on mid-market segment for increased market penetration.",
    "Invest in AI-driven solutions to enhance product offerings."
  ]);
  const [marketEntry, setMarketEntry] = useState("A phased approach, starting with key partnerships and localized marketing campaigns.");
  const [marketDrivers, setMarketDrivers] = useState([
    "Increasing adoption of cloud-based solutions.",
    "Growing demand for data analytics and business intelligence.",
    "Rising need for cybersecurity solutions."
  ]);
  const [showScoutChat, setShowScoutChat] = useState(false);
  const [lastEditedField, setLastEditedField] = useState("");

  // Industry Trends state variables
  const [isIndustryTrendsEditing, setIsIndustryTrendsEditing] = useState(false);
  const [industryTrendsExpanded, setIndustryTrendsExpanded] = useState(false);
  const [industryTrendsHasEdits, setIndustryTrendsHasEdits] = useState(false);
  const [industryTrendsDeletedSections, setIndustryTrendsDeletedSections] = useState(new Set<string>());
  const [industryTrendsEditHistory, setIndustryTrendsEditHistory] = useState<EditRecord[]>([]);
  const [industryTrendsExecutiveSummary, setIndustryTrendsExecutiveSummary] = useState("The industry is seeing a rapid shift towards AI adoption and cloud migration, driven by regulatory changes.");
  const [industryTrendsAiAdoption, setIndustryTrendsAiAdoption] = useState("75%");
  const [industryTrendsCloudMigration, setIndustryTrendsCloudMigration] = useState("60%");
  const [industryTrendsRegulatory, setIndustryTrendsRegulatory] = useState("High");
  const [industryTrendSnapshots, setIndustryTrendSnapshots] = useState([
    { title: "AI Adoption", metric: "75% increase", type: "adoption" },
    { title: "Cloud Migration", metric: "60% growth", type: "growth" },
    { title: "Market Performance", metric: "+15% YoY", type: "performance" }
  ]);
  const [industryTrendsRecommendations, setIndustryTrendsRecommendations] = useState({
    primaryFocus: "Invest in AI-driven solutions",
    marketEntry: "Focus on cloud-based offerings"
  });
  const [industryTrendsRisks, setIndustryTrendsRisks] = useState([
    "Regulatory uncertainty",
    "Data privacy concerns",
    "Cybersecurity threats"
  ]);
  const [industryTrendsLastEditedField, setIndustryTrendsLastEditedField] = useState("");

  // Add missing competitor-related state
  const [isCompetitorEditing, setIsCompetitorEditing] = useState(false);
  const [competitorHasEdits, setCompetitorHasEdits] = useState(false);
  const [competitorDeletedSections, setCompetitorDeletedSections] = useState(new Set<string>());
  const [competitorEditHistory, setCompetitorEditHistory] = useState<EditRecord[]>([]);
  const [competitorExecutiveSummary, setCompetitorExecutiveSummary] = useState("The enterprise collaboration tools market is increasingly competitive, with several dominant players holding significant market share. However, emerging startups are introducing disruptive features, shifting the landscape rapidly.");
  const [competitorLastEditedField, setCompetitorLastEditedField] = useState("");
  const [showCompetitorScoutChat, setShowCompetitorScoutChat] = useState(false);

  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      setDeletedSections(new Set());
    }
  };

  const handleScoutIconClick = (context?: 'market-size' | 'industry-trends' | 'competitor-landscape') => {
    setShowScoutChat(true);
  };

  const handleEditHistoryOpen = () => {
    alert('Edit History Modal Opened!');
  };

  const handleDeleteSection = (sectionId: string) => {
    setDeletedSections(prev => new Set([...prev, sectionId]));
  };

  const handleSaveChanges = () => {
    setIsEditing(false);
    setHasEdits(true);
    const editRecord: EditRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: "Alex Chen",
      summary: "Updated market size analysis",
      field: "market-size",
      oldValue: "Previous analysis",
      newValue: executiveSummary
    };
    setEditHistory(prev => [editRecord, ...prev]);
    setLastEditedField("market-size");
    setShowScoutChat(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setDeletedSections(new Set());
  };

  const handleExpandToggle = (expanded: boolean) => {
    setIsExpanded(expanded);
  };

  const handleExecutiveSummaryChange = (value: string) => {
    setExecutiveSummary(value);
  };

  const handleTamValueChange = (value: string) => {
    setTamValue(value);
  };

  const handleSamValueChange = (value: string) => {
    setSamValue(value);
  };

  const handleApacGrowthRateChange = (value: string) => {
    setApacGrowthRate(value);
  };

  const handleStrategicRecommendationsChange = (recommendations: string[]) => {
    setStrategicRecommendations(recommendations);
  };

  const handleMarketEntryChange = (value: string) => {
    setMarketEntry(value);
  };

  const handleMarketDriversChange = (drivers: string[]) => {
    setMarketDrivers(drivers);
  };

  // Industry Trends handlers
  const handleIndustryTrendsToggleEdit = () => {
    setIsIndustryTrendsEditing(!isIndustryTrendsEditing);
    if (!isIndustryTrendsEditing) {
      setIndustryTrendsDeletedSections(new Set());
    }
  };

  const handleIndustryTrendsSaveChanges = () => {
    setIsIndustryTrendsEditing(false);
    setIndustryTrendsHasEdits(true);
    const editRecord: EditRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: "Alex Chen",
      summary: "Updated industry trends analysis",
      field: "industry-trends",
      oldValue: "Previous analysis",
      newValue: industryTrendsExecutiveSummary
    };
    setIndustryTrendsEditHistory(prev => [editRecord, ...prev]);
    setIndustryTrendsLastEditedField("industry-trends");
    setShowScoutChat(true);
  };

  const handleIndustryTrendsCancelEdit = () => {
    setIsIndustryTrendsEditing(false);
    setIndustryTrendsDeletedSections(new Set());
  };

  const handleIndustryTrendsDeleteSection = (sectionId: string) => {
    setIndustryTrendsDeletedSections(prev => new Set([...prev, sectionId]));
  };

  const handleIndustryTrendsEditHistoryOpen = () => {
    alert('Industry Trends Edit History Modal Opened!');
  };

  const handleIndustryTrendsExpandToggle = (expanded: boolean) => {
    setIndustryTrendsExpanded(expanded);
  };

  const handleIndustryTrendsExecutiveSummaryChange = (value: string) => {
    setIndustryTrendsExecutiveSummary(value);
  };

  // Add missing competitor handlers
  const handleCompetitorToggleEdit = () => {
    setIsCompetitorEditing(!isCompetitorEditing);
    if (!isCompetitorEditing) {
      setCompetitorDeletedSections(new Set());
    }
  };

  const handleCompetitorSaveChanges = () => {
    setIsCompetitorEditing(false);
    setCompetitorHasEdits(true);
    const editRecord: EditRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: "Alex Chen",
      summary: "Updated competitor landscape analysis",
      field: "competitor-analysis",
      oldValue: "Previous analysis",
      newValue: competitorExecutiveSummary
    };
    setCompetitorEditHistory(prev => [editRecord, ...prev]);
    setCompetitorLastEditedField("competitor-analysis");
    setShowCompetitorScoutChat(true);
  };

  const handleCompetitorCancelEdit = () => {
    setIsCompetitorEditing(false);
    setCompetitorDeletedSections(new Set());
  };

  const handleCompetitorDeleteSection = (sectionId: string) => {
    setCompetitorDeletedSections(prev => new Set([...prev, sectionId]));
  };

  const handleCompetitorExecutiveSummaryChange = (value: string) => {
    setCompetitorExecutiveSummary(value);
  };

  const handleCompetitorScoutChatClose = () => {
    setShowCompetitorScoutChat(false);
  };

  const [showExportModal, setShowExportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const handleExportPDF = () => {
    setShowExportModal(true);
  };

  const handleSaveToWorkspace = () => {
    setShowSaveModal(true);
  };

  const handleGenerateShareableLink = () => {
    setShowShareModal(true);
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Market Research</h1>
            <p className="text-gray-600 mt-2">AI-powered market intelligence and competitive analysis</p>
          </div>
          <div className="flex gap-3">
            <Input placeholder="Search..." className="max-w-md" />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">Reset All</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will reset all the values in all tabs.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction>Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
            <TabsTrigger value="strategy">Strategy</TabsTrigger>
            <TabsTrigger value="execution">Execution</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(100vh-200px)]">
            <TabsContent value="overview" className="mt-0">
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Market Overview</h2>
                <p>This section provides a high-level overview of the market.</p>
              </div>
            </TabsContent>

            <TabsContent value="intelligence" className="mt-0">
              <MarketIntelligenceTab
                isEditing={isEditing}
                isSplitView={showScoutChat || showCompetitorScoutChat}
                isExpanded={isExpanded}
                hasEdits={hasEdits}
                deletedSections={deletedSections}
                editHistory={editHistory}
                executiveSummary={executiveSummary}
                tamValue={tamValue}
                samValue={samValue}
                apacGrowthRate={apacGrowthRate}
                strategicRecommendations={strategicRecommendations}
                marketEntry={marketEntry}
                marketDrivers={marketDrivers}
                // Industry Trends props
                isIndustryTrendsEditing={isIndustryTrendsEditing}
                industryTrendsExpanded={industryTrendsExpanded}
                industryTrendsHasEdits={industryTrendsHasEdits}
                industryTrendsDeletedSections={industryTrendsDeletedSections}
                industryTrendsEditHistory={industryTrendsEditHistory}
                industryTrendsExecutiveSummary={industryTrendsExecutiveSummary}
                industryTrendsAiAdoption={industryTrendsAiAdoption}
                industryTrendsCloudMigration={industryTrendsCloudMigration}
                industryTrendsRegulatory={industryTrendsRegulatory}
                industryTrendSnapshots={industryTrendSnapshots}
                industryTrendsRecommendations={industryTrendsRecommendations}
                industryTrendsRisks={industryTrendsRisks}
                industryTrendsLastEditedField={industryTrendsLastEditedField}
                // Competitor Landscape props
                isCompetitorEditing={isCompetitorEditing}
                competitorHasEdits={competitorHasEdits}
                competitorDeletedSections={competitorDeletedSections}
                competitorEditHistory={competitorEditHistory}
                competitorExecutiveSummary={competitorExecutiveSummary}
                competitorLastEditedField={competitorLastEditedField}
                showCompetitorScoutChat={showCompetitorScoutChat}
                onToggleEdit={handleToggleEdit}
                onScoutIconClick={handleScoutIconClick}
                onEditHistoryOpen={handleEditHistoryOpen}
                onDeleteSection={handleDeleteSection}
                onSaveChanges={handleSaveChanges}
                onCancelEdit={handleCancelEdit}
                onExpandToggle={handleExpandToggle}
                onExecutiveSummaryChange={handleExecutiveSummaryChange}
                onTamValueChange={handleTamValueChange}
                onSamValueChange={handleSamValueChange}
                onApacGrowthRateChange={handleApacGrowthRateChange}
                onStrategicRecommendationsChange={handleStrategicRecommendationsChange}
                onMarketEntryChange={handleMarketEntryChange}
                onMarketDriversChange={handleMarketDriversChange}
                // Industry Trends handlers
                onIndustryTrendsToggleEdit={handleIndustryTrendsToggleEdit}
                onIndustryTrendsSaveChanges={handleIndustryTrendsSaveChanges}
                onIndustryTrendsCancelEdit={handleIndustryTrendsCancelEdit}
                onIndustryTrendsDeleteSection={handleIndustryTrendsDeleteSection}
                onIndustryTrendsEditHistoryOpen={handleIndustryTrendsEditHistoryOpen}
                onIndustryTrendsExpandToggle={handleIndustryTrendsExpandToggle}
                onIndustryTrendsExecutiveSummaryChange={handleIndustryTrendsExecutiveSummaryChange}
                // Competitor Landscape handlers
                onCompetitorToggleEdit={handleCompetitorToggleEdit}
                onCompetitorSaveChanges={handleCompetitorSaveChanges}
                onCompetitorCancelEdit={handleCompetitorCancelEdit}
                onCompetitorDeleteSection={handleCompetitorDeleteSection}
                onCompetitorExecutiveSummaryChange={handleCompetitorExecutiveSummaryChange}
                onCompetitorScoutChatClose={handleCompetitorScoutChatClose}
                onExportPDF={handleExportPDF}
                onSaveToWorkspace={handleSaveToWorkspace}
                onGenerateShareableLink={handleGenerateShareableLink}
              />
            </TabsContent>

            <TabsContent value="strategy" className="mt-0">
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Market Strategy</h2>
                <p>This section outlines the strategic approach to the market.</p>
              </div>
            </TabsContent>

            <TabsContent value="execution" className="mt-0">
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Market Execution</h2>
                <p>This section details the execution plan for the market strategy.</p>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <ExportPDF isOpen={showExportModal} onClose={() => setShowExportModal(false)} />
        <SaveToWorkspace isOpen={showSaveModal} onClose={() => setShowSaveModal(false)} />
        <ShareableLink isOpen={showShareModal} onClose={() => setShowShareModal(false)} />
      </div>
    </Layout>
  );
};

export default MarketResearch;
