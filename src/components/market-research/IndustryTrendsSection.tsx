import React, { useState, useEffect } from 'react';
import { Bot, Edit, X, FileText, Save, Share, Clock, Zap, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import MiniPieChart from '@/components/ui/MiniPieChart';
import MiniLineChart from '@/components/ui/MiniLineChart';
import { EditRecord, TrendSnapshot, IndustryTrendsRecommendations } from './types';

interface IndustryTrendsSectionProps {
  isIndustryTrendsEditing: boolean;
  isSplitView: boolean;
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
  onIndustryTrendsToggleEdit: () => void;
  onIndustryTrendsSaveChanges: () => void;
  onIndustryTrendsCancelEdit: () => void;
  onIndustryTrendsDeleteSection: (sectionId: string) => void;
  onIndustryTrendsRestoreSection?: (sectionId: string) => void;
  onIndustryTrendsEditHistoryOpen: () => void;
  onIndustryTrendsExpandToggle: (expanded: boolean) => void;
  onIndustryTrendsExecutiveSummaryChange: (value: string) => void;
  onIndustryTrendsAiAdoptionChange: (value: string) => void;
  onIndustryTrendsCloudMigrationChange: (value: string) => void;
  onIndustryTrendsRegulatoryChange: (value: string) => void;
  onIndustryTrendSnapshotsChange: (snapshots: TrendSnapshot[]) => void;
  onScoutIconClick: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape' | 'regulatory-compliance' | 'market-entry', hasEdits?: boolean, lastEditedField?: string) => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
  // Scout chat panel props
  showScoutChat?: boolean;
  scoutChatPanel?: React.ReactNode;
}

const IndustryTrendsSection: React.FC<IndustryTrendsSectionProps> = ({
  isIndustryTrendsEditing,
  isSplitView,
  industryTrendsExpanded,
  industryTrendsHasEdits,
  industryTrendsDeletedSections,
  industryTrendsEditHistory,
  industryTrendsExecutiveSummary,
  industryTrendsAiAdoption,
  industryTrendsCloudMigration,
  industryTrendsRegulatory,
  industryTrendSnapshots,
  industryTrendsRecommendations,
  industryTrendsRisks,
  onIndustryTrendsToggleEdit,
  onIndustryTrendsSaveChanges,
  onIndustryTrendsCancelEdit,
  onIndustryTrendsDeleteSection,
  onIndustryTrendsRestoreSection,
  onIndustryTrendsEditHistoryOpen,
  onIndustryTrendsExpandToggle,
  onIndustryTrendsExecutiveSummaryChange,
  onIndustryTrendsAiAdoptionChange,
  onIndustryTrendsCloudMigrationChange,
  onIndustryTrendsRegulatoryChange,
  onIndustryTrendSnapshotsChange,
  onScoutIconClick,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink,
  showScoutChat,
  scoutChatPanel
}) => {
  // API integration state
  const [industryTrendsData, setIndustryTrendsData] = useState<any>(null);
  const [industryTrendsTimestamp, setIndustryTrendsTimestamp] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API integration for Industry Trends
  const fetchIndustryTrendsData = async (refresh: boolean = false) => {
    console.log('🚀 Starting fetchIndustryTrendsData with refresh:', refresh);
    
    setIsLoading(true);
    setError(null);
    
    try {
      const requestTimestamp = Date.now();
      const requestId = Math.random().toString(36).substring(2, 8);
      
      const payload = {
        user_id: "brewra",
        component_name: "industry trends",
        refresh: false,
        force_refresh: refresh,
        cache_bypass: false,
        bypass_all_cache: false,
        request_timestamp: requestTimestamp,
        request_id: requestId,
        data: {
          company: "OrbiSelf",
          product: "Convoic.AI", 
          target_market: "Indian college students (Tier 2 & 3)",
          region: "India",
          timestamp: requestTimestamp,
          force_new_data: false
        }
      };

      console.log('📤 Sending API request to: https://backend-11kr.onrender.com/market-research');
      console.log('📦 Industry Trends Payload:', payload);

      const response = await fetch('https://backend-11kr.onrender.com/market-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log('📥 Industry Trends API response:', response);

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📊 Industry Trends API result:', result);

      if (result.status === 'success' && result.data) {
        const apiData = result.data;
        console.log('✅ Industry Trends: Found data - updating component');
        
        // Update component data with API response
        if (apiData.executiveSummary) onIndustryTrendsExecutiveSummaryChange(apiData.executiveSummary);
        if (apiData.aiAdoption) onIndustryTrendsAiAdoptionChange(apiData.aiAdoption);
        if (apiData.cloudMigration) onIndustryTrendsCloudMigrationChange(apiData.cloudMigration);
        if (apiData.regulatory) onIndustryTrendsRegulatoryChange(apiData.regulatory);
        
        setIndustryTrendsData(apiData);
        setIndustryTrendsTimestamp(apiData.timestamp);
      } else {
        console.log('❌ No data in API response or error status');
        setError('No data received from API');
      }
    } catch (error) {
      console.error('❌ Error fetching Industry Trends data:', error);
      setError('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    console.log('🚀 Industry Trends component mounted - fetching fresh data');
    fetchIndustryTrendsData(true);
  }, []);

  const handleIndustryTrendsSaveChanges = () => {
    onIndustryTrendsSaveChanges();
  };

  return (
    <div className={`${showScoutChat ? 'flex gap-6' : ''}`}>
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${showScoutChat ? 'flex-1' : ''}`}>
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
                    value={industryTrendsExecutiveSummary} 
                    onChange={e => onIndustryTrendsExecutiveSummaryChange(e.target.value)} 
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
                        key={`ai-adoption-${industryTrendsAiAdoption}`}
                        defaultValue={industryTrendsAiAdoption} 
                        onBlur={(e) => onIndustryTrendsAiAdoptionChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
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
                        key={`cloud-migration-${industryTrendsCloudMigration}`}
                        defaultValue={industryTrendsCloudMigration}
                        onBlur={(e) => onIndustryTrendsCloudMigrationChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="text-2xl font-bold text-green-600 border-green-200 focus:border-green-400"
                        placeholder="e.g., 45%"
                      />
                    </div>
                    <div>
                      <Label htmlFor="regulatory" className="text-sm font-medium text-gray-700 mb-2 block">
                        Regulatory Changes
                      </Label>
                      <Input 
                        id="regulatory"
                        key={`regulatory-${industryTrendsRegulatory}`}
                        defaultValue={industryTrendsRegulatory}
                        onBlur={(e) => onIndustryTrendsRegulatoryChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="text-2xl font-bold text-orange-600 border-orange-200 focus:border-orange-400"
                        placeholder="e.g., 12 new policies"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Deleted Sections */}
            {industryTrendsDeletedSections.size > 0 && onIndustryTrendsRestoreSection && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 relative z-50 shadow-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Deleted Sections</h4>
                <div className="space-y-2">
                  {Array.from(industryTrendsDeletedSections).map((sectionId) => {
                    const sectionNames: Record<string, string> = {
                      'executive-summary': 'Executive Summary',
                      'key-metrics': 'Key Metrics',
                      'trend-snapshots': 'Trend Snapshots',
                      'regional-hotspots': 'Regional Hotspots',
                      'strategic-recommendations': 'Strategic Recommendations'
                    };
                    
                    return (
                      <div key={sectionId} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                        <span className="text-sm text-gray-600">{sectionNames[sectionId] || sectionId}</span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => onIndustryTrendsRestoreSection(sectionId)}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          Restore
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Save/Cancel Buttons */}
            <div className="flex items-center gap-3 pt-6 border-t">
              <Button onClick={handleIndustryTrendsSaveChanges}>Save Changes</Button>
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
                    <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                    <Bot className="h-5 w-5 relative z-10" />
                    Scout
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Get AI insights and suggestions</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Executive Summary Display */}
            {!industryTrendsDeletedSections.has('executive-summary') && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Executive Summary</h3>
                <p className="text-gray-700 leading-relaxed">
                  {industryTrendsExecutiveSummary || 'No executive summary available'}
                </p>
              </div>
            )}

            {/* Key Metrics Display */}
            {!industryTrendsDeletedSections.has('key-metrics') && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{industryTrendsAiAdoption || '78%'}</div>
                    <div className="text-sm text-gray-600">AI Adoption Rate</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{industryTrendsCloudMigration || '45%'}</div>
                    <div className="text-sm text-gray-600">Cloud Migration Increase</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{industryTrendsRegulatory || '12 new policies'}</div>
                    <div className="text-sm text-gray-600">Regulatory Changes</div>
                  </div>
                </div>
              </div>
            )}

            {/* Trend Snapshots */}
            {!industryTrendsDeletedSections.has('trend-snapshots') && industryTrendSnapshots && industryTrendSnapshots.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Trend Snapshots</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {industryTrendSnapshots.map((snapshot, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-lg font-semibold text-gray-800">{snapshot.title}</div>
                      <div className="text-xl font-bold text-purple-600">{snapshot.metric}</div>
                      <div className="text-sm text-gray-600 capitalize">{snapshot.type}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strategic Recommendations */}
            {!industryTrendsDeletedSections.has('strategic-recommendations') && industryTrendsRecommendations && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategic Recommendations</h3>
                <div className="space-y-3">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-medium text-gray-800">Primary Focus</div>
                    <div className="text-gray-700">{industryTrendsRecommendations.primaryFocus || 'No recommendations available'}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-medium text-gray-800">Market Entry</div>
                    <div className="text-gray-700">{industryTrendsRecommendations.marketEntry || 'No market entry recommendations available'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Risk Factors */}
            {!industryTrendsDeletedSections.has('risk-factors') && industryTrendsRisks && industryTrendsRisks.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Factors</h3>
                <div className="space-y-2">
                  {industryTrendsRisks.map((risk, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-red-500 mt-2"></div>
                      <div className="text-gray-700">{risk}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Scout Chat Panel */}
      {showScoutChat && scoutChatPanel && (
        <div className="w-1/2 flex-shrink-0">
          {scoutChatPanel}
        </div>
      )}
    </div>
  );
};

export default IndustryTrendsSection;