import React, { useState, useEffect } from 'react';
import { BarChart3, Bot, Edit, X, FileText, Save, Share, Clock, ChevronDown, ChevronUp, Zap, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
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
  // Scout chat panel props
  showScoutChat?: boolean;
  scoutChatPanel?: React.ReactNode;
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
  showScoutChat,
  scoutChatPanel
}) => {
  // State for API data
  const [competitorData, setCompetitorData] = useState<CompetitorLandscapeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Local editing state
  const [editExecutiveSummary, setEditExecutiveSummary] = useState('');
  const [editTopPlayerShare, setEditTopPlayerShare] = useState('');
  const [editEmergingPlayers, setEditEmergingPlayers] = useState('');
  const [editFundingNews, setEditFundingNews] = useState<string[]>([]);
  
  // Handle save changes - following pattern from other components
  const handleCompetitorSaveChanges = () => {
    // Update the parent with changes
    onExecutiveSummaryChange(editExecutiveSummary);
    onTopPlayerShareChange(editTopPlayerShare);
    onEmergingPlayersChange(editEmergingPlayers);
    onFundingNewsChange(editFundingNews);
    
    // Call parent save handler only - parent handles chat notifications
    onCompetitorLandscapeSaveChanges();
  };

  // Handle delete section - only call parent, no scout calls from child
  const handleDeleteSection = (sectionId: string) => {
    onCompetitorLandscapeDeleteSection(sectionId);
  };

  // Fetch Competitor Landscape data from API
  const fetchCompetitorLandscapeData = async (refresh = true) => {
    try {
      setIsLoading(true);
      setError(null);

      const currentTime = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const payload = {
        user_id: "brewra",
        component_name: "competitor landscape",
        refresh: false, // Changed to false to fetch existing data
        force_refresh: false,
        cache_bypass: false,
        bypass_all_cache: false,
        request_timestamp: currentTime,
        request_id: randomId,
        data: {
          company: "OrbiSelf",
          product: "Convoic.AI", 
          target_market: "Indian college students (Tier 2 & 3)",
          region: "India",
          timestamp: currentTime,
          force_new_data: false // Changed to false to fetch existing report
        }
      };

      const requestTimestamp = Date.now();
      
      const response = await fetch('https://backend-11kr.onrender.com/market-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.status === 'success' && result.data) {
        
        const reportData = result.data;
        
        // Convert timestamps to UTC for comparison
        const currentTimestampUTC = toUTCTimestamp(competitorData?.timestamp);
        const newTimestampUTC = toUTCTimestamp(reportData.timestamp);
        const requestTimeUTC = getCurrentUTCTimestamp();
        
        
        // Determine if we should update
        let shouldUpdate = false;
        let updateReason = '';
        
        if (!competitorData) {
          shouldUpdate = true;
          updateReason = 'No existing data - first load';
        } else if (!currentTimestampUTC) {
          shouldUpdate = true;
          updateReason = 'No existing timestamp - first load';
        } else if (!newTimestampUTC) {
          shouldUpdate = false;
          updateReason = 'Invalid new timestamp';
        } else if (newTimestampUTC > currentTimestampUTC) {
          shouldUpdate = true;
          updateReason = 'Swagger data is newer';
        } else {
          shouldUpdate = false;
          updateReason = 'Current data is up to date or newer';
        }
        
        if (shouldUpdate) {
          setCompetitorData(reportData);
          
          // Initialize edit fields with data from uiComponents
          const reportComponent = reportData.uiComponents?.find(comp => comp.type === 'report');
          setEditExecutiveSummary(reportComponent?.executiveSummary || '');
          
          // Initialize other edit fields with default values or fetch from data
          const sectionComponent = reportData.uiComponents?.find(comp => comp.type === 'section');
          const metrics = sectionComponent?.metrics;
          
          if (metrics && metrics.length > 0) {
            setEditTopPlayerShare(metrics[0]?.value || '');
          }
          
          setEditEmergingPlayers('New emerging players in the market...');
          setEditFundingNews(['Recent funding news 1', 'Recent funding news 2']);
        }
      }
    } catch (err) {
      console.error('Error fetching competitor landscape data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch competitor landscape data');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize edit fields when entering edit mode
  useEffect(() => {
    if (isCompetitorLandscapeEditing && competitorData) {
      const reportComponent = competitorData.uiComponents?.find(comp => comp.type === 'report');
      const sectionComponent = competitorData.uiComponents?.find(comp => comp.type === 'section');
      const metrics = sectionComponent?.metrics;
      
      setEditExecutiveSummary(reportComponent?.executiveSummary || '');
      setEditTopPlayerShare(metrics?.[0]?.value || '');
      setEditEmergingPlayers('New emerging players in the market...');
      setEditFundingNews(['Recent funding news 1', 'Recent funding news 2']);
    }
  }, [isCompetitorLandscapeEditing, competitorData]);

  // Clear previous data and fetch fresh data on component mount
  useEffect(() => {
    setCompetitorData(null);
    setIsLoading(true);
    setError(null);
    
    const timer = setTimeout(() => {
      fetchCompetitorLandscapeData(false); // Changed to false to fetch existing data
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);


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
                onClick={() => fetchCompetitorLandscapeData(false)}
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


  return (
    <div className={`${isSplitView ? 'flex gap-6' : ''}`}>
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${isSplitView ? 'flex-1' : ''}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Competitor Landscape
          </h2>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onCompetitorLandscapeToggleEdit} className="text-blue-800 hover:text-blue-900">
              <Edit className="h-4 w-4" />
            </Button>
            {!isSplitView && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onScoutIconClick('competitor-landscape')} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200 hover:shadow-md hover:shadow-blue-200/50 relative">
                    <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                    <Bot className="h-5 w-5 relative z-10" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Explore More with Scout</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Executive Summary - Always visible */}
        {(() => {
          const reportComponent = competitorData?.uiComponents?.find(comp => comp.type === 'report');
          const executiveSummary = reportComponent?.executiveSummary;
          
          if (!executiveSummary) {
            return null;
          }
          
          return (
            <div className="p-6 rounded-lg mb-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Executive Summary</h3>
                </div>
                {(!competitorLandscapeDeletedSections.has('executive-summary')) && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onCompetitorLandscapeDeleteSection('executive-summary')} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {isCompetitorLandscapeEditing ? (
                <Textarea 
                  value={editExecutiveSummary} 
                  onChange={(e) => setEditExecutiveSummary(e.target.value)} 
                  className="w-full h-32 resize-none" 
                  placeholder="Enter executive summary..." 
                />
              ) : (
                <p className="text-gray-700 leading-relaxed">{executiveSummary}</p>
              )}
            </div>
          );
        })()}

        {/* Always show metrics cards (Top Player Market Share, Emerging Players Added) */}
        {(() => {
          const sectionComponent = competitorData?.uiComponents?.find(comp => comp.type === 'section');
          const metrics = sectionComponent?.metrics;
          
          if (!metrics || metrics.length === 0) return null;
          
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {metrics.map((metric, index) => (
                <div key={index} className="border border-gray-200 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      {isCompetitorLandscapeEditing && index === 0 ? (
                        <div>
                          <Input 
                            value={editTopPlayerShare} 
                            onChange={(e) => setEditTopPlayerShare(e.target.value)} 
                            className="text-lg font-bold text-blue-600 mb-2"
                            placeholder="e.g., 35%" 
                          />
                          <div className="text-sm text-gray-700">{metric.label}</div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-lg font-bold text-blue-600">
                            {metric.value}
                          </div>
                          <div className="text-sm text-gray-700">{metric.label}</div>
                        </div>
                      )}
                    </div>
                    {metric.trend === 'up' ? (
                      <div className="text-green-500">
                        <ChevronUp className="h-5 w-5" />
                      </div>
                    ) : metric.trend === 'down' ? (
                      <div className="text-red-500">
                        <ChevronDown className="h-5 w-5" />
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Read More button when collapsed */}
        {!competitorLandscapeExpanded && !isSplitView && !isCompetitorLandscapeEditing && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => onCompetitorLandscapeExpandToggle(true)}
              variant="outline"
              className="flex items-center space-x-2 text-sm"
            >
              <span>Read More</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Editing Mode Additional Fields */}
        {isCompetitorLandscapeEditing && (competitorLandscapeExpanded || isSplitView) && (
          <div className="space-y-8">
            {/* Emerging Players Edit */}
            {!competitorLandscapeDeletedSections.has('emerging-players') && (
              <div className="relative group">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteSection('emerging-players')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
                <div>
                  <Label htmlFor="emergingPlayers" className="text-sm font-medium text-gray-700 mb-2 block">
                    Emerging Players
                  </Label>
                  <Textarea 
                    id="emergingPlayers" 
                    value={editEmergingPlayers} 
                    onChange={(e) => setEditEmergingPlayers(e.target.value)} 
                    className="w-full h-24 resize-none" 
                    placeholder="Enter emerging players information..." 
                  />
                </div>
              </div>
            )}

            {/* Funding News Edit */}
            {!competitorLandscapeDeletedSections.has('funding-news') && (
              <div className="relative group">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteSection('funding-news')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Funding News
                  </Label>
                  {editFundingNews.map((news, index) => (
                    <Textarea 
                      key={index} 
                      value={news} 
                      onChange={e => {
                        const newFundingNews = [...editFundingNews];
                        newFundingNews[index] = e.target.value;
                        setEditFundingNews(newFundingNews);
                      }} 
                      className="w-full h-20 resize-none mb-3" 
                      placeholder={`Funding news ${index + 1}...`} 
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Save/Cancel Buttons - Only show if not in split view to avoid duplicates */}
            {!isSplitView && (
              <div className="flex items-center gap-3 pt-6 border-t">
                <Button onClick={handleCompetitorSaveChanges}>Save Changes</Button>
                <Button variant="outline" onClick={onCompetitorLandscapeCancelEdit}>Cancel</Button>
                <div className="flex-1"></div>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={onCompetitorLandscapeEditHistoryOpen} className={`text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${competitorLandscapeEditHistory.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={competitorLandscapeEditHistory.length === 0}>
                    <Clock className="h-4 w-4" />
                    Edit History
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View changes made to this report</p>
                </TooltipContent>
              </Tooltip>

              {/* Scout button removed from edit mode to prevent duplicates */}
              </div>
            )}

            {/* Export Options in Edit Mode */}
            <div className="border-t pt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Export Options</h4>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" onClick={onExportPDF} className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Save PDF
                </Button>
                <Button variant="outline" size="sm" onClick={onSaveToWorkspace} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Save to Workspace
                </Button>
                <Button variant="outline" size="sm" onClick={onGenerateShareableLink} className="flex items-center gap-2">
                  <Share className="h-4 w-4" />
                  Shareable Link
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Normal Content View */}
        {!isCompetitorLandscapeEditing && (competitorLandscapeExpanded || isSplitView) && (
          /* Expanded content - Read-only view */
            <div className="space-y-6">

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
                              <span className="text-sm font-medium text-blue-600">{share}</span>
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
              const headlines = newsComponent?.headlines;
              
              if (!headlines || headlines.length === 0) return null;
              
              return (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Latest News</h3>
                  <div className="space-y-3">
                    {headlines.map((headline, index) => (
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
      {isSplitView && scoutChatPanel && (
        <div className="w-1/2">
          {scoutChatPanel}
        </div>
      )}
    </div>
  );
};

export default CompetitorLandscapeSection;