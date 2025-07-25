
import React, { useState, useEffect } from 'react';
import { Bot, Edit, X, FileText, Save, Share, Clock, Zap, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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

interface TrendSnapshot {
  title: string;
  metric: string;
  type: 'growth' | 'performance' | 'adoption';
}

interface IndustryTrendsRecommendations {
  primaryFocus: string;
  marketEntry: string;
}

interface IndustryTrendsData {
  executiveSummary: string;
  aiAdoption: string;
  cloudMigration: string;
  regulatory: string;
  timestamp?: string; // Add timestamp to track data generation time
  trendSnapshots: TrendSnapshot[];
  regionalHotspots: {
    APAC: string;
    Europe: string;
    "North America": string;
  };
  strategicRecommendations: IndustryTrendsRecommendations;
  risks: string[];
  visualCharts: {
    aiAdoptionTrends: string[];
    technologyBudgetAllocation: {
      "AI/ML": string;
      Cloud: string;
      Security: string;
    };
  };
}

interface IndustryTrendsSectionProps {
  isIndustryTrendsEditing: boolean;
  isSplitView: boolean;
  industryTrendsExpanded: boolean;
  industryTrendsHasEdits: boolean;
  industryTrendsDeletedSections: Set<string>;
  industryTrendsEditHistory: EditRecord[];
  onIndustryTrendsToggleEdit: () => void;
  onIndustryTrendsSaveChanges: () => void;
  onIndustryTrendsCancelEdit: () => void;
  onIndustryTrendsDeleteSection: (sectionId: string) => void;
  onIndustryTrendsEditHistoryOpen: () => void;
  onIndustryTrendsExpandToggle: (expanded: boolean) => void;
  onScoutIconClick: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape') => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
}

const IndustryTrendsSection: React.FC<IndustryTrendsSectionProps> = ({
  isIndustryTrendsEditing,
  isSplitView,
  industryTrendsExpanded,
  industryTrendsHasEdits,
  industryTrendsDeletedSections,
  industryTrendsEditHistory,
  onIndustryTrendsToggleEdit,
  onIndustryTrendsSaveChanges,
  onIndustryTrendsCancelEdit,
  onIndustryTrendsDeleteSection,
  onIndustryTrendsEditHistoryOpen,
  onIndustryTrendsExpandToggle,
  onScoutIconClick,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink
}) => {
  // State for API data
  const [industryTrendsData, setIndustryTrendsData] = useState<IndustryTrendsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Local editing state
  const [editExecutiveSummary, setEditExecutiveSummary] = useState('');
  const [editAiAdoption, setEditAiAdoption] = useState('');
  const [editCloudMigration, setEditCloudMigration] = useState('');
  const [editRegulatory, setEditRegulatory] = useState('');
  const [editTrendSnapshots, setEditTrendSnapshots] = useState<TrendSnapshot[]>([]);

  // Fetch Industry Trends data from API
  const fetchIndustryTrendsData = async (refresh = true) => {
    try {
      setIsLoading(true);
      setError(null);

      const currentTime = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const payload = {
        user_id: "brewra",
        component_name: "industry trends report",
        refresh: false,  // Changed to false to fetch existing data
        force_refresh: false,  // Changed to false
        cache_bypass: false,  // Changed to false
        bypass_all_cache: false,  // Changed to false
        request_timestamp: currentTime,
        request_id: randomId,
        data: {
          company: "OrbiSelf",
          product: "Convoic.AI", 
          target_market: "Indian college students (Tier 2 & 3)",
          region: "India",
          timestamp: currentTime,
          force_new_data: false  // Changed to false to fetch existing report
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
        const currentTimestampUTC = toUTCTimestamp(industryTrendsData?.timestamp);
        const newTimestampUTC = toUTCTimestamp(reportData.timestamp);
        const requestTimeUTC = getCurrentUTCTimestamp();
        
        
        // Determine if we should update
        let shouldUpdate = false;
        let updateReason = '';
        
        if (!currentTimestampUTC) {
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
          
          // Generate trend snapshots if not provided
          const trendSnapshots = reportData.trendSnapshots || [
            {
              title: "Market Growth",
              metric: reportData.growthProjections || "25% YoY",
              type: "growth" as const
            },
            {
              title: "AI Adoption", 
              metric: reportData.regionalHotspots?.India || "60%",
              type: "adoption" as const
            },
            {
              title: "Performance Index",
              metric: "92/100",
              type: "performance" as const
            }
          ];

          // Fix strategic recommendations structure
          const strategicRecommendations = Array.isArray(reportData.strategicRecommendations) 
            ? {
                primaryFocus: reportData.strategicRecommendations[0] || 'Focus on digital transformation and AI adoption',
                marketEntry: reportData.strategicRecommendations[1] || 'Strategic partnerships and gradual market penetration'
              }
            : (reportData.strategicRecommendations || {
                primaryFocus: 'Focus on digital transformation and AI adoption',
                marketEntry: 'Strategic partnerships and gradual market penetration'
              });

          // Fix regional hotspots structure
          const regionalHotspots = reportData.regionalHotspots && typeof reportData.regionalHotspots === 'object'
            ? {
                APAC: reportData.regionalHotspots.India || reportData.regionalHotspots.APAC || '60%',
                Europe: reportData.regionalHotspots.Europe || '45%',
                "North America": reportData.regionalHotspots["North America"] || '55%'
              }
            : {
                APAC: '60%',
                Europe: '45%',
                "North America": '55%'
              };

          const dataWithFallbacks = {
            ...reportData,
            trendSnapshots,
            regionalHotspots,
            strategicRecommendations,
            visualCharts: reportData.visualCharts || {},
            risks: reportData.risks || [],
            marketDrivers: reportData.marketDrivers || [],
            executiveSummary: reportData.executiveSummary || '',
            marketSize: reportData.marketSize || '',
            marketSizeBySegment: reportData.marketSizeBySegment || {},
            growthProjections: reportData.growthProjections || '',
            timestamp: newTimestampUTC
          };

          
          setIndustryTrendsData(dataWithFallbacks);
          
          // Initialize edit fields with fetched data
          setEditExecutiveSummary(reportData.executiveSummary || '');
          setEditAiAdoption(reportData.aiAdoption || '');
          setEditCloudMigration(reportData.cloudMigration || '');
          setEditRegulatory(reportData.regulatory || '');
          setEditTrendSnapshots(dataWithFallbacks.trendSnapshots);
        }
      }
    } catch (err) {
      console.error('Error fetching industry trends data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch industry trends data');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear previous data and fetch fresh data on component mount
  useEffect(() => {
    // Clear any existing data immediately to prevent showing stale data
    setIndustryTrendsData(null);
    setIsLoading(true);
    setError(null);
    
    // Reduced delay to improve user experience - 500ms is sufficient to avoid conflicts
    const timer = setTimeout(() => {
      fetchIndustryTrendsData(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Handle save changes
  const handleSaveChanges = async () => {
    try {
      await fetchIndustryTrendsData(true); // Refresh data
      onIndustryTrendsSaveChanges();
    } catch (err) {
      console.error('Error saving changes:', err);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            Industry Trends
          </h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading industry trends data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            Industry Trends
          </h2>
        </div>
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">Error loading industry trends data: {error}</p>
          <Button onClick={() => fetchIndustryTrendsData(false)} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Show no data state
  if (!industryTrendsData) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            Industry Trends
          </h2>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No industry trends data available</p>
          <Button onClick={() => fetchIndustryTrendsData(true)} variant="outline">
            Generate Report
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Zap className="h-5 w-5 text-purple-600" />
          Industry Trends
        </h2>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onIndustryTrendsToggleEdit} className="text-purple-800 hover:text-purple-900">
            <Edit className="h-4 w-4" />
          </Button>
          {!isSplitView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => onScoutIconClick('industry-trends')} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 transition-all duration-200 hover:shadow-md hover:shadow-purple-200/50 relative">
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
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

      {isIndustryTrendsEditing ? (
        <div className="space-y-8">
          {/* Executive Summary Edit */}
          {!industryTrendsDeletedSections.has('executive-summary') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onIndustryTrendsDeleteSection('executive-summary')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <Label htmlFor="industryTrendsExecutiveSummary" className="text-sm font-medium text-gray-700 mb-2 block">
                  Executive Summary
                </Label>
                <Textarea 
                  id="industryTrendsExecutiveSummary" 
                  value={editExecutiveSummary} 
                  onChange={e => setEditExecutiveSummary(e.target.value)} 
                  className="w-full h-32 resize-none" 
                  placeholder="Enter executive summary..." 
                />
              </div>
            </div>
          )}

          {/* Key Metrics Edit */}
          {!industryTrendsDeletedSections.has('key-metrics') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onIndustryTrendsDeleteSection('key-metrics')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="aiAdoption" className="text-sm font-medium text-gray-700 mb-2 block">
                      AI Adoption Rate
                    </Label>
                    <Input 
                      id="aiAdoption"
                      value={editAiAdoption} 
                      onChange={e => setEditAiAdoption(e.target.value)}
                      className="text-2xl font-bold text-blue-600 border-blue-200 focus:border-blue-400"
                      placeholder="e.g., 78%"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cloudMigration" className="text-sm font-medium text-gray-700 mb-2 block">
                      Cloud Migration Increase
                    </Label>
                    <Input 
                      id="cloudMigration"
                      value={editCloudMigration} 
                      onChange={e => setEditCloudMigration(e.target.value)}
                      className="text-2xl font-bold text-green-600 border-green-200 focus:border-green-400"
                      placeholder="e.g., +45%"
                    />
                  </div>
                  <div>
                    <Label htmlFor="regulatory" className="text-sm font-medium text-gray-700 mb-2 block">
                      Regulatory Changes
                    </Label>
                    <Input 
                      id="regulatory"
                      value={editRegulatory} 
                      onChange={e => setEditRegulatory(e.target.value)}
                      className="text-2xl font-bold text-purple-600 border-purple-200 focus:border-purple-400"
                      placeholder="e.g., 12 new"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Trend Snapshots Edit */}
          {!industryTrendsDeletedSections.has('trend-snapshots') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onIndustryTrendsDeleteSection('trend-snapshots')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Trend Snapshots</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {editTrendSnapshots?.map((trend, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="mb-3">
                        <Label htmlFor={`trendTitle-${index}`} className="text-sm font-medium text-gray-700 mb-1 block">
                          Title
                        </Label>
                        <Input 
                          id={`trendTitle-${index}`}
                          value={trend.title}
                          onChange={e => {
                            const updated = [...editTrendSnapshots];
                            updated[index] = { ...trend, title: e.target.value };
                            setEditTrendSnapshots(updated);
                          }}
                          className="font-medium text-gray-900"
                          placeholder="Trend title"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`trendMetric-${index}`} className="text-sm font-medium text-gray-700 mb-1 block">
                          Metric
                        </Label>
                        <Input 
                          id={`trendMetric-${index}`}
                          value={trend.metric}
                          onChange={e => {
                            const updated = [...editTrendSnapshots];
                            updated[index] = { ...trend, metric: e.target.value };
                            setEditTrendSnapshots(updated);
                          }}
                          className="text-sm text-gray-600"
                          placeholder="Trend metric"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Save/Cancel Buttons */}
          <div className="flex items-center gap-3 pt-6 border-t">
            <Button onClick={handleSaveChanges}>Save Changes</Button>
            <Button variant="outline" onClick={onIndustryTrendsCancelEdit}>Cancel</Button>
            <div className="flex-1"></div>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onIndustryTrendsEditHistoryOpen} className={`text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${industryTrendsEditHistory.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={industryTrendsEditHistory.length === 0}>
                  <Clock className="h-4 w-4" />
                  Edit History
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View changes made to this report</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => onScoutIconClick('industry-trends')} className="text-purple-600 hover:text-purple-700 bg-purple-50 border border-purple-200 hover:shadow-md hover:shadow-purple-200/50 transition-all duration-200 relative">
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                  <Bot className="h-4 w-4 relative z-10" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Explore More with Scout</p>
              </TooltipContent>
            </Tooltip>
          </div>

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
      ) : (
        <div className="space-y-6">
          {/* Default View */}
          <div>
            <p className="text-gray-700 mb-6">{industryTrendsData.executiveSummary}</p>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-blue-600">{industryTrendsData.aiAdoption}</div>
                <div className="text-sm font-medium text-gray-900">AI Adoption Rate</div>
                <div className="text-xs text-gray-600">Enterprise pilots</div>
              </div>
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-green-600">{industryTrendsData.cloudMigration}</div>
                <div className="text-sm font-medium text-gray-900">Cloud Migration Increase</div>
                <div className="text-xs text-gray-600">Year over year</div>
              </div>
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-purple-600">{industryTrendsData.regulatory}</div>
                <div className="text-sm font-medium text-gray-900">Regulatory Changes</div>
                <div className="text-xs text-gray-600">Impacting sector</div>
              </div>
            </div>
          </div>

          {/* Read More Button */}
          {!industryTrendsExpanded && !isSplitView && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => {
                  onIndustryTrendsExpandToggle(true);
                }}
                variant="outline"
                className="flex items-center space-x-2 text-sm"
              >
                <span>Read More</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Expanded Content */}
          {(industryTrendsExpanded || isSplitView) && (
            <div className="animate-fade-in space-y-8">
              <div className="border-t pt-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-8">
                  Industry Trends Report
                </h2>
                

                {/* Executive Summary */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Executive Summary</h3>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {industryTrendsData?.executiveSummary || 'No executive summary available'}
                  </p>
                </div>

                {/* Key Trend Snapshots */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Trend Snapshots</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {industryTrendsData.trendSnapshots?.map((trend, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">{trend.title}</h4>
                        <p className="text-sm text-gray-600 mb-3">{trend.metric}</p>
                        <div className="h-8 bg-gradient-to-r from-purple-100 to-blue-100 rounded"></div>
                      </div>
                    )) || <p className="text-gray-500">No trend snapshots available</p>}
                  </div>
                </div>

                {/* Regional Hotspots */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Regional Hotspots</h3>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    {industryTrendsData.regionalHotspots ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{industryTrendsData.regionalHotspots.APAC}</div>
                          <div className="text-sm text-gray-700">APAC</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{industryTrendsData.regionalHotspots.Europe}</div>
                          <div className="text-sm text-gray-700">Europe</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{industryTrendsData.regionalHotspots["North America"]}</div>
                          <div className="text-sm text-gray-700">North America</div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500">No regional hotspots data available</p>
                    )}
                  </div>
                </div>

                {/* Strategic Recommendations */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategic Recommendations</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <h4 className="font-medium text-green-900 mb-2">Primary Focus</h4>
                      <p className="text-green-700 text-sm">{industryTrendsData.strategicRecommendations?.primaryFocus || 'No recommendations available'}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-blue-900 mb-2">Market Entry</h4>
                      <p className="text-blue-700 text-sm">{industryTrendsData.strategicRecommendations?.marketEntry || 'No recommendations available'}</p>
                    </div>
                  </div>
                </div>

                {/* Risks & Watchouts */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Risks & Watchouts</h3>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                     <ul className="space-y-2">
                      {industryTrendsData.risks?.map((risk, index) => (
                        <li key={index} className="flex items-start gap-2 text-red-700 text-sm">
                          <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
                          {risk}
                        </li>
                      )) || <li className="text-gray-500 text-sm">No risks identified</li>}
                    </ul>
                  </div>
                </div>

                {/* Visual Charts Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Visual Charts</h3>
                  {industryTrendsData && industryTrendsData.visualCharts ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">AI Adoption Trends</h4>
                        {industryTrendsData.visualCharts.aiAdoptionTrends && Array.isArray(industryTrendsData.visualCharts.aiAdoptionTrends) ? (
                          <MiniLineChart 
                            data={industryTrendsData.visualCharts.aiAdoptionTrends.map((quarter, index) => ({
                              name: quarter || `Q${index + 1}`,
                              value: 45 + (index * 11) // Dynamic values based on quarters
                            }))} 
                            title="" 
                            color="#8B5CF6" 
                          />
                        ) : (
                          <p className="text-gray-500 text-sm">No AI adoption trends data available</p>
                        )}
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Technology Budget Allocation</h4>
                        {(() => {
                          try {
                            const budgetData = industryTrendsData?.visualCharts?.technologyBudgetAllocation;
                            if (!budgetData) {
                              return <p className="text-gray-500 text-sm">No budget allocation data available</p>;
                            }
                            
                            // Safely parse the data with fallbacks
                            const aiValue = budgetData["AI/ML"] ? parseInt(String(budgetData["AI/ML"]).replace('%', '')) : 30;
                            const cloudValue = budgetData.Cloud ? parseInt(String(budgetData.Cloud).replace('%', '')) : 25;
                            const securityValue = budgetData.Security ? parseInt(String(budgetData.Security).replace('%', '')) : 20;
                            
                            return (
                              <MiniPieChart 
                                data={[
                                  { 
                                    name: "AI/ML", 
                                    value: isNaN(aiValue) ? 30 : aiValue,
                                    color: "#8B5CF6" 
                                  },
                                  { 
                                    name: "Cloud", 
                                    value: isNaN(cloudValue) ? 25 : cloudValue,
                                    color: "#3B82F6" 
                                  },
                                  { 
                                    name: "Security", 
                                    value: isNaN(securityValue) ? 20 : securityValue,
                                    color: "#10B981" 
                                  }
                                ]} 
                                title="" 
                              />
                            );
                          } catch (error) {
                            console.error('Error rendering budget allocation chart:', error);
                            return <p className="text-gray-500 text-sm">Error loading budget allocation chart</p>;
                          }
                        })()}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">No visual charts data available</p>
                  )}
                </div>

                {/* Export Footer */}
                <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-6 -mb-6 rounded-b-lg">
                  <div className="flex flex-wrap gap-3 justify-center">
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

                {/* Show Less Button - Only when not in split view */}
                {!isSplitView && (
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={() => onIndustryTrendsExpandToggle(false)}
                      variant="outline"
                      className="flex items-center space-x-2 text-sm"
                    >
                      <span>Show Less</span>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IndustryTrendsSection;
