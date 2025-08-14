import React, { useState, useEffect } from 'react';
import { BarChart3, Bot, Edit, X, FileText, Save, Share, Clock, ChevronDown, ChevronUp, Zap, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { EditDropdownMenu } from './EditDropdownMenu';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import MiniPieChart from '@/components/ui/MiniPieChart';
import MiniLineChart from '@/components/ui/MiniLineChart';
import { toUTCTimestamp, isTimestampNewer, getCurrentUTCTimestamp, logTimestampComparison } from '@/lib/timestampUtils';

interface EditRecord {
  id: string;
  timestamp: string;
  user: string;
  summary: string;
  field: string;
  oldValue: string;
  newValue: string;
}

interface CompetitorLandscapeSectionProps {
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
  onScoutIconClick: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape', hasEdits?: boolean, customMessage?: string) => void;
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
  companyProfile?: any;
  
  // Add centralized data prop
  competitorData?: any;
  error?: string | null;
}

interface UIComponent {
  type: string;
  title?: string;
  description?: string;
  metrics?: Array<{
    label: string;
    value: string;
    trend: string;
  }>;
  tags?: string[];
  executiveSummary?: string;
  dataPoints?: Array<{
    label: string;
    value: string;
  }>;
  entities?: Array<{
    name: string;
    strengths: string[];
    weaknesses: string[];
  }>;
  headlines?: string[];
  regions?: Array<{
    name: string;
    data: Record<string, string>;
  }>;
  features?: string[];
  tools?: Record<string, string[]>;
  insights?: Array<{
    label: string;
    description: string;
  }>;
  charts?: Array<{
    name: string;
    xAxis: string | string[];
  }>;
}

interface CompetitorLandscapeData {
  uiComponents: UIComponent[];
  user_id: string;
  component_name: string;
  timestamp: string;
}

const CompetitorLandscapeSection: React.FC<CompetitorLandscapeSectionProps> = ({
  isEditing: isCompetitorLandscapeEditing,
  isSplitView,
  isExpanded: competitorLandscapeExpanded,
  hasEdits: competitorLandscapeHasEdits,
  deletedSections: competitorLandscapeDeletedSections,
  editHistory: competitorLandscapeEditHistory,
  executiveSummary,
  topPlayerShare,
  emergingPlayers,
  fundingNews,
  onToggleEdit: onCompetitorLandscapeToggleEdit,
  onScoutIconClick,
  onEditHistoryOpen: onCompetitorLandscapeEditHistoryOpen,
  onDeleteSection: onCompetitorLandscapeDeleteSection,
  onSaveChanges: onCompetitorLandscapeSaveChanges,
  onCancelEdit: onCompetitorLandscapeCancelEdit,
  onExpandToggle: onCompetitorLandscapeExpandToggle,
  onExecutiveSummaryChange,
  onTopPlayerShareChange,
  onEmergingPlayersChange,
  onFundingNewsChange,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink,
  isRefreshing = false,
  companyProfile,
  competitorData: propCompetitorData,
  error: propError
}) => {
  // State for API data - parent handles loading and errors
  const error = propError; // Use prop error from parent
  const competitorData = propCompetitorData;
  
  // Check if we're loading (no competitorData with timestamp means we're still loading)
  const isLoading = !competitorData?.timestamp && !error;
  
  // Local editing state for inline editing - initialize with prop values
  const [localExecutiveSummary, setLocalExecutiveSummary] = useState(executiveSummary || competitorData?.executiveSummary || '');
  const [localTopPlayerShare, setLocalTopPlayerShare] = useState(topPlayerShare || competitorData?.topPlayerShare || '');
  const [localEmergingPlayers, setLocalEmergingPlayers] = useState(emergingPlayers || competitorData?.emergingPlayers || '');

  // Sync local state with centralized data props when they change (but not while editing)
  useEffect(() => {
    if (!isCompetitorLandscapeEditing) {
      console.log('🔄 Syncing Competitor Landscape local state with props:');
      console.log('  - executiveSummary prop:', executiveSummary);
      console.log('  - topPlayerShare prop:', topPlayerShare);
      console.log('  - emergingPlayers prop:', emergingPlayers);
      console.log('  - competitorData:', competitorData);
      console.log('  - competitorData.executiveSummary:', competitorData?.executiveSummary);
      console.log('  - competitorData.timestamp:', competitorData?.timestamp);
      
      // Prioritize competitorData from API over fallback props
      setLocalExecutiveSummary(competitorData?.executiveSummary || executiveSummary || '');
      setLocalTopPlayerShare(competitorData?.topPlayerShare || topPlayerShare || '');
      setLocalEmergingPlayers(competitorData?.emergingPlayers || emergingPlayers || '');
      
      console.log('✅ Updated local state:');
      console.log('  - localExecutiveSummary set to:', executiveSummary || competitorData?.executiveSummary || '');
      console.log('  - localTopPlayerShare set to:', topPlayerShare || competitorData?.topPlayerShare || '');
    }
  }, [executiveSummary, topPlayerShare, emergingPlayers, competitorData, isCompetitorLandscapeEditing]);

  // Also sync when competitorData changes
  useEffect(() => {
    if (!isCompetitorLandscapeEditing && competitorData) {
      console.log('🔄 Competitor Landscape - competitorData updated:', competitorData);
      console.log('🔍 Competitor Landscape - Data analysis:');
      console.log('  - competitorData.executiveSummary:', competitorData.executiveSummary);
      console.log('  - competitorData.topPlayerShare:', competitorData.topPlayerShare);
      console.log('  - competitorData.emergingPlayers:', competitorData.emergingPlayers);
      console.log('  - competitorData.timestamp:', competitorData.timestamp);
      console.log('  - executiveSummary prop:', executiveSummary);
      console.log('  - topPlayerShare prop:', topPlayerShare);
      console.log('  - emergingPlayers prop:', emergingPlayers);
      console.log('  - Current localExecutiveSummary:', localExecutiveSummary);
      console.log('  - Current localTopPlayerShare:', localTopPlayerShare);
      console.log('  - Current localEmergingPlayers:', localEmergingPlayers);
      
      // Always update local state with competitorData (prioritize API data)
      if (competitorData.executiveSummary && competitorData.executiveSummary !== localExecutiveSummary) {
        setLocalExecutiveSummary(competitorData.executiveSummary);
        console.log('📝 Updated executiveSummary from competitorData:', competitorData.executiveSummary);
      }
      if (competitorData.topPlayerShare && competitorData.topPlayerShare !== localTopPlayerShare) {
        setLocalTopPlayerShare(competitorData.topPlayerShare);
        console.log('📝 Updated topPlayerShare from competitorData:', competitorData.topPlayerShare);
      }
      if (competitorData.emergingPlayers && competitorData.emergingPlayers !== localEmergingPlayers) {
        setLocalEmergingPlayers(competitorData.emergingPlayers);
        console.log('📝 Updated emergingPlayers from competitorData:', competitorData.emergingPlayers);
      }
    }
  }, [competitorData, isCompetitorLandscapeEditing, executiveSummary, topPlayerShare, emergingPlayers, localExecutiveSummary, localTopPlayerShare, localEmergingPlayers]);

  // Handle save changes
  const handleCompetitorLandscapeSaveChanges = async () => {
    try {
      console.log('🚀 Competitor Landscape - Starting save operation');
      
      // Apply local edits to props
      onExecutiveSummaryChange(localExecutiveSummary);
      onTopPlayerShareChange(localTopPlayerShare);
      onEmergingPlayersChange(localEmergingPlayers);
      
      // Prepare original data
      const originalData = {
        section: 'competitor-landscape',
        executiveSummary: executiveSummary,
        topPlayerShare: topPlayerShare,
        emergingPlayers: emergingPlayers,
        fundingNews: fundingNews
      };

      // Prepare modified data
      const modifiedData = {
        section: 'competitor-landscape',
        executiveSummary: localExecutiveSummary,
        topPlayerShare: localTopPlayerShare,
        emergingPlayers: localEmergingPlayers,
        fundingNews: fundingNews
      };

      // Prepare data for API according to schema
      const editData = {
        original_json: originalData,
        modified_json: modifiedData,
        edit_type: "modification"
      };

      console.log('📤 Competitor Landscape - original_json:', editData.original_json);
      console.log('📤 Competitor Landscape - modified_json:', editData.modified_json);

      // Store data for /ask API
      localStorage.setItem('competitor-landscape_original_json', JSON.stringify(editData.original_json));
      localStorage.setItem('competitor-landscape_modified_json', JSON.stringify(editData.modified_json));

      // Call POST API to save edits
      const response = await fetch('https://backend-11kr.onrender.com/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editData)
      });

      console.log('📥 POST /edit status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Fetch updated data using GET API
      const getResponse = await fetch('https://backend-11kr.onrender.com/market_intelligence', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

       console.log('📥 GET /market_intelligence status:', getResponse.status);

      if (!getResponse.ok) {
        throw new Error(`HTTP error! status: ${getResponse.status}`);
      }

      const getData = await getResponse.json();
      console.log('✅ Competitor Landscape - GET /market_intelligence successful:', getData);
      
      // Update component with fresh data from API response
      if (getData && getData.competitor_landscape_data) {
        const apiData = getData.competitor_landscape_data;
        
        // Update local state with API response data
        setLocalExecutiveSummary(apiData.executiveSummary || '');
        setLocalTopPlayerShare(apiData.topPlayerShare || '');
        setLocalEmergingPlayers(apiData.emergingPlayers || '');
        
        // Update parent state with API response data
        onExecutiveSummaryChange(apiData.executiveSummary || '');
        onTopPlayerShareChange(apiData.topPlayerShare || '');
        onEmergingPlayersChange(apiData.emergingPlayers || '');
        
        console.log('✅ Competitor Landscape - State updated with API response data');
      }
      
      // Call the original save function
      onCompetitorLandscapeSaveChanges();
    } catch (error) {
      console.error('❌ Competitor Landscape - Error saving changes:', error);
      // Still call the original save function even if API fails
      onCompetitorLandscapeSaveChanges();
    }
  };

  // Removed fetchCompetitorLandscapeData function - parent handles all API calls

  // Fetch data on component mount - let parent handle API calls
  useEffect(() => {
    console.log('🚀 Competitor Landscape Component mounted');
    console.log('🚀 Initial competitorData:', competitorData);
    // Don't make API calls here - parent handles it
  }, []);
  
  // Log when competitorData changes
  useEffect(() => {
    console.log('🔄 CompetitorLandscapeSection - competitorData changed:', competitorData);
    console.log('🔄 competitorData.timestamp:', competitorData?.timestamp);
    console.log('🔄 competitorData.executiveSummary:', competitorData?.executiveSummary);
  }, [competitorData]);

  // Handle refresh when isRefreshing prop changes - let parent handle it
  useEffect(() => {
    if (isRefreshing) {
      console.log('🔄 Competitor Landscape - Refresh triggered, parent will handle API call');
      // Don't make API calls here - parent handles it
    }
  }, [isRefreshing]);

  // Listen for company profile updates - just notify parent
  useEffect(() => {
    const handleCompanyProfileUpdate = () => {
      console.log('🔄 Competitor Landscape - Company profile updated, parent will handle refresh');
      // Don't make API calls here - let parent handle it
    };

    window.addEventListener('companyProfileUpdated', handleCompanyProfileUpdate);
    
    return () => {
      window.removeEventListener('companyProfileUpdated', handleCompanyProfileUpdate);
    };
  }, []);


  // Show loading state when no API data is available yet
  if (isLoading) {
    return (
      <div className={`${isSplitView ? 'flex gap-6' : ''}`}>
        <div className={`bg-white rounded-lg border border-gray-200 p-6 ${isSplitView ? 'flex-1' : ''}`}>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading competitor landscape data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${isSplitView ? 'flex gap-6' : ''}`}>
        <div className={`bg-white rounded-lg border border-gray-200 p-6 ${isSplitView ? 'flex-1' : ''}`}>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <X className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">Error loading competitor landscape data</p>
              <p className="text-gray-600 text-sm mb-4">{error}</p>
              <Button 
                onClick={() => {
                  // Error will be cleared by parent
                  console.log('Retry clicked - parent will handle refresh');
                }}
                variant="outline"
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Debug logging
  console.log('🔍🏆 CompetitorLandscapeSection Debug Info:');
  console.log('- competitorData:', competitorData);
  console.log('- propCompetitorData:', propCompetitorData);
  console.log('- competitorData.timestamp:', competitorData?.timestamp);
  console.log('- executiveSummary prop:', executiveSummary);
  console.log('- topPlayerShare prop:', topPlayerShare);
  console.log('- isRefreshing:', isRefreshing);
  console.log('- isLoading:', isLoading);
  console.log('- error:', error);
  console.log('- competitorLandscapeExpanded:', competitorLandscapeExpanded);
  console.log('- isSplitView:', isSplitView);

  // Always use competitorData when available
  if (!competitorData) {
    console.log('⚠️ No competitorData found - will use fallback props');
  }

  // Ensure we have some data to display - prioritize competitorData from API over fallback props
  const displayExecutiveSummary = localExecutiveSummary || competitorData?.executiveSummary || executiveSummary || 'No data available';
  const displayTopPlayerShare = localTopPlayerShare || competitorData?.topPlayerShare || topPlayerShare || 'No data available';
  const displayEmergingPlayers = localEmergingPlayers || competitorData?.emergingPlayers || emergingPlayers || 'No data available';

  return (
    <div className={`${isSplitView ? 'flex gap-6' : ''}`}>
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${isSplitView ? 'flex-1' : ''}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Competitor Landscape</h2>
              <p className="text-sm text-gray-600">Comprehensive analysis of competitive environment</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {competitorLandscapeHasEdits && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                <Clock className="h-3 w-3 mr-1" />
                Unsaved
              </Badge>
            )}
            
            <EditDropdownMenu
              onModify={onCompetitorLandscapeToggleEdit}
              onComment={() => onScoutIconClick('competitor-landscape', competitorLandscapeHasEdits)}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onScoutIconClick('competitor-landscape', competitorLandscapeHasEdits)}
                  className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                >
                  <Bot className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Chat with Scout about competitor landscape</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Executive Summary - Always visible */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Executive Summary
            </h3>
          </div>
          {isCompetitorLandscapeEditing ? (
            <Textarea
              value={localExecutiveSummary}
              onChange={(e) => setLocalExecutiveSummary(e.target.value)}
              className="w-full"
              rows={4}
              placeholder="Enter executive summary..."
            />
          ) : (
            <p className="text-gray-700 leading-relaxed">{displayExecutiveSummary}</p>
          )}
        </div>

        {/* Key Metrics Section - Always visible */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Player Market Share */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {isCompetitorLandscapeEditing ? (
                    <div className="space-y-2">
                      <Input
                        value={localTopPlayerShare}
                        onChange={(e) => setLocalTopPlayerShare(e.target.value)}
                        className="text-lg font-bold text-blue-600 bg-white"
                        placeholder="Top Player Market Share"
                      />
                      <div className="text-sm text-gray-700">Top Player Market Share</div>
                    </div>
                  ) : (
                    <>
                      <div className="text-lg font-bold text-blue-600">{displayTopPlayerShare}</div>
                      <div className="text-sm text-gray-700">Top Player Market Share</div>
                    </>
                  )}
                </div>
                <div className="text-green-500">
                  <ChevronUp className="h-5 w-5" />
                </div>
              </div>
            </div>
            
            {/* Emerging Players */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {isCompetitorLandscapeEditing ? (
                    <div className="space-y-2">
                      <Input
                        value={localEmergingPlayers}
                        onChange={(e) => setLocalEmergingPlayers(e.target.value)}
                        className="text-lg font-bold text-blue-600 bg-white"
                        placeholder="Emerging Players Added"
                      />
                      <div className="text-sm text-gray-700">Emerging Players Added</div>
                    </div>
                  ) : (
                    <>
                      <div className="text-lg font-bold text-blue-600">{displayEmergingPlayers}</div>
                      <div className="text-sm text-gray-700">Emerging Players Added</div>
                    </>
                  )}
                </div>
                <div className="text-green-500">
                  <ChevronUp className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Read More Button - Show when collapsed */}
        {!competitorLandscapeExpanded && !isSplitView && (
          <div className="flex justify-center mb-6">
            <Button
              variant="outline"
              onClick={() => onCompetitorLandscapeExpandToggle(true)}
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <ChevronDown className="h-4 w-4 mr-2" />
              Read More
            </Button>
          </div>
        )}

        {/* Expanded content */}
        {(competitorLandscapeExpanded || isSplitView) && (
          <div className="space-y-6">

            {/* Executive Summary section is now moved above for collapsed view */}

            {/* Top Players */}
            {(() => {
              const sectionComponent = competitorData?.uiComponents?.find(comp => comp.type === 'section');
              const tags = sectionComponent?.tags;
              
              if (!tags || tags.length === 0) return null;
              
              return (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Major Competitors
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {tags.slice(0, 4).map((competitor, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">{competitor}</h4>
                            <p className="text-sm text-blue-600 font-medium">Market Player</p>
                          </div>
                          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                            Competitor
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Market Share Charts */}
            {(() => {
              const marketShareComponent = competitorData?.uiComponents?.find(comp => comp.type === 'marketShareCharts');
              const regions = marketShareComponent?.regions;
              
              if (!regions || regions.length === 0) return null;
              
              return (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Share Analysis</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {regions.map((region, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">{region.name}</h4>
                        <div className="space-y-2">
                          {Object.entries(region.data).map(([company, share]) => (
                            <div key={company} className="flex justify-between items-center">
                              <span className="text-sm text-gray-700">{company}</span>
                              <span className="text-sm font-medium text-blue-600">{String(share)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* SWOT Analysis */}
            {(() => {
              const swotComponent = competitorData?.uiComponents?.find(comp => comp.type === 'swotAnalysis');
              const entities = swotComponent?.entities;
              
              if (!entities || entities.length === 0) return null;
              
              return (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">SWOT Analysis</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {entities.map((entity, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">{entity.name}</h4>
                        <div className="space-y-3">
                          <div>
                            <h5 className="text-sm font-medium text-green-600 mb-2">Strengths</h5>
                            <ul className="text-sm text-gray-700 space-y-1">
                              {entity.strengths.map((strength, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-green-500 mt-1">•</span>
                                  {strength}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h5 className="text-sm font-medium text-red-600 mb-2">Weaknesses</h5>
                            <ul className="text-sm text-gray-700 space-y-1">
                              {entity.weaknesses.map((weakness, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-red-500 mt-1">•</span>
                                  {weakness}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

             {/* News Headlines */}
            {(() => {
              const newsComponent = competitorData?.uiComponents?.find(comp => comp.type === 'news');
              const apiHeadlines = newsComponent?.headlines;
              
              // Use competitorData funding news directly
              const displayHeadlines = apiHeadlines && apiHeadlines.length > 0 ? apiHeadlines : 
                (competitorData?.fundingNews && competitorData.fundingNews.length > 0) ? competitorData.fundingNews :
                (fundingNews && fundingNews.length > 0) ? fundingNews : null;
              
              if (!displayHeadlines || displayHeadlines.length === 0) return null;
              
              return (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Latest News</h3>
                  <div className="space-y-3">
                    {displayHeadlines.map((headline, index) => (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-gray-900">{headline}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Feature Comparison */}
            {(() => {
              const featureComponent = competitorData?.uiComponents?.find(comp => comp.type === 'featureComparison');
              const features = featureComponent?.features;
              const tools = featureComponent?.tools;
              
              if (!features || !tools) return null;
              
              return (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Comparison</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Feature</TableHead>
                          {Object.keys(tools).map((tool) => (
                            <TableHead key={tool}>{tool}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {features.map((feature, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{feature}</TableCell>
                            {Object.keys(tools).map((tool) => (
                              <TableCell key={tool}>
                                {tools[tool][index] || '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })()}

            {/* M&A Insights */}
            {(() => {
              const mnaComponent = competitorData?.uiComponents?.find(comp => comp.type === 'mnaInsights');
              const insights = mnaComponent?.insights;
              
              if (!insights || insights.length === 0) return null;
              
              return (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">M&A Insights</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {insights.map((insight, index) => (
                      <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-medium text-yellow-800 mb-2">{insight.label}</h4>
                        <p className="text-yellow-700">{insight.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Action Buttons */}
            {isCompetitorLandscapeEditing && (
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      // Log original and modified JSON for debugging
                      const originalJson = {
                        executiveSummary: executiveSummary || '',
                        topPlayerShare: topPlayerShare || '',
                        emergingPlayers: emergingPlayers || '',
                        fundingNews: fundingNews || []
                      };

                      const modifiedJson = {
                        executiveSummary: localExecutiveSummary,
                        topPlayerShare: localTopPlayerShare,
                        emergingPlayers: localEmergingPlayers,
                        fundingNews: fundingNews || []
                      };

                         // Logging original and modified JSON data
                         console.log('🏆 Competitor Landscape Section - original_json:', JSON.stringify(originalJson, null, 2));
                         console.log('🏆 Competitor Landscape Section - modified_json:', JSON.stringify(modifiedJson, null, 2));

                       // Store JSON data in localStorage for Scout API
                       localStorage.setItem('competitor-landscape_original_json', JSON.stringify(originalJson));
                       localStorage.setItem('competitor-landscape_modified_json', JSON.stringify(modifiedJson));

                       // First, call the change handlers to update parent state with local values
                      onExecutiveSummaryChange(localExecutiveSummary);
                      onTopPlayerShareChange(localTopPlayerShare);
                      onEmergingPlayersChange(localEmergingPlayers);
                      
                       // Then call the API save function
                       handleCompetitorLandscapeSaveChanges();
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={onCompetitorLandscapeCancelEdit}>
                    Cancel
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={onExportPDF}>
                    <FileText className="h-4 w-4 mr-1" />
                    Export PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={onSaveToWorkspace}>
                    <Save className="h-4 w-4 mr-1" />
                    Save to Workspace
                  </Button>
                  <Button variant="outline" size="sm" onClick={onGenerateShareableLink}>
                    <Share className="h-4 w-4 mr-1" />
                    Share
                  </Button>
                </div>
              </div>
            )}

            {/* Show Less Button - Only when not in split view */}
            {!isSplitView && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => onCompetitorLandscapeExpandToggle(false)}
                  variant="outline"
                  className="flex items-center space-x-2 text-sm"
                >
                  <span>Show Less</span>
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetitorLandscapeSection;