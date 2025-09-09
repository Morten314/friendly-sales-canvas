import React, { useState, useEffect } from 'react';
import { BarChart3, Bot, Edit, Target, TrendingUp, PieChart, X, FileText, Save, Share, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import MiniPieChart from '@/components/ui/MiniPieChart';
import MiniLineChart from '@/components/ui/MiniLineChart';
import { EditRecord } from './types';
import { EditDropdownMenu } from './EditDropdownMenu';
import { executeWithRateLimit } from '@/lib/rateLimitManager';

interface MarketSizeSectionProps {
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
  onToggleEdit: () => void;
  onScoutIconClick: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape', hasEdits?: boolean, customMessage?: string) => void;
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
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
  // Scout chat panel props
  showScoutChat?: boolean;
  scoutChatPanel?: React.ReactNode;
  // API integration props
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

const MarketSizeSection: React.FC<MarketSizeSectionProps> = ({
  isEditing,
  isSplitView,
  isExpanded,
  hasEdits,
  deletedSections,
  editHistory,
  executiveSummary,
  tamValue,
  samValue,
  apacGrowthRate,
  strategicRecommendations,
  marketEntry,
  marketDrivers,
  marketSizeBySegment,
  growthProjections,
  onToggleEdit,
  onScoutIconClick,
  onEditHistoryOpen,
  onDeleteSection,
  onSaveChanges,
  onCancelEdit,
  onExpandToggle,
  onExecutiveSummaryChange,
  onTamValueChange,
  onSamValueChange,
  onApacGrowthRateChange,
  onStrategicRecommendationsChange,
  onMarketEntryChange,
  onMarketDriversChange,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink,
  showScoutChat,
  scoutChatPanel,
  isLoading,
  error,
  onRefresh
}) => {
  // Local editing state for inline editing - initialize once and keep values
  const [localExecutiveSummary, setLocalExecutiveSummary] = useState(executiveSummary || '');
  const [localTamValue, setLocalTamValue] = useState(tamValue || '');
  const [localSamValue, setLocalSamValue] = useState(samValue || '');
  const [localApacGrowthRate, setLocalApacGrowthRate] = useState(apacGrowthRate || '');
  const [localMarketEntry, setLocalMarketEntry] = useState(marketEntry || '');
  const [localStrategicRecommendations, setLocalStrategicRecommendations] = useState<string[]>(strategicRecommendations || []);
  const [localMarketDrivers, setLocalMarketDrivers] = useState<string[]>(marketDrivers || []);
  const [localError, setLocalError] = useState<string | null>(null);

  const { toast } = useToast();

  // Handle section delete
  const handleSectionDelete = () => {
    // Implementation for section deletion
    onDeleteSection('market-size');
  };

  const handleModify = () => {
    onToggleEdit();
  };

  const handleComment = () => {
    onScoutIconClick('market-size', hasEdits, 'I have a comment about this section');
  };

  // Reset local values when editing starts
  useEffect(() => {
    if (isEditing) {
      console.log('📝 Editing started - Setting local values:', {
        executiveSummary,
        tamValue,
        samValue,
        apacGrowthRate,
        marketEntry,
        strategicRecommendations,
        marketDrivers
      });
      
      setLocalExecutiveSummary(executiveSummary || '');
      setLocalTamValue(tamValue || '');
      setLocalSamValue(samValue || '');
      setLocalApacGrowthRate(apacGrowthRate || '');
      setLocalMarketEntry(marketEntry || '');
      setLocalStrategicRecommendations(strategicRecommendations || []);
      setLocalMarketDrivers(marketDrivers || []);
    }
  }, [isEditing, executiveSummary, tamValue, samValue, apacGrowthRate, marketEntry, strategicRecommendations, marketDrivers]);

  // Sync local state with props when they change (for refresh scenarios)
  useEffect(() => {
    console.log('🔄 Market Size - Props changed, syncing with local state');
    console.log('🔄 Props:', { executiveSummary, tamValue, samValue, apacGrowthRate, marketEntry, strategicRecommendations, marketDrivers });
    
    // Always sync with props when they change (even if empty, to clear stale data)
    setLocalExecutiveSummary(executiveSummary || '');
    setLocalTamValue(tamValue || '');
    setLocalSamValue(samValue || '');
    setLocalApacGrowthRate(apacGrowthRate || '');
    setLocalMarketEntry(marketEntry || '');
    setLocalStrategicRecommendations(strategicRecommendations || []);
    setLocalMarketDrivers(marketDrivers || []);
  }, [executiveSummary, tamValue, samValue, apacGrowthRate, marketEntry, strategicRecommendations, marketDrivers]);

  const handleSave = async () => {
    try {
      // Prepare original and modified data
      const originalData = {
        executiveSummary,
        tamValue,
        samValue,
        apacGrowthRate,
        marketEntry,
        strategicRecommendations,
        marketDrivers
      };

      const modifiedData = {
        executiveSummary: localExecutiveSummary,
        tamValue: localTamValue,
        samValue: localSamValue,
        apacGrowthRate: localApacGrowthRate,
        marketEntry: localMarketEntry,
        strategicRecommendations: localStrategicRecommendations,
        marketDrivers: localMarketDrivers
      };

      const editData = {
        original_json: originalData,
        modified_json: modifiedData,
        edit_type: "modification"
      };

      console.log('📤 Market Size - original_json:', originalData);
      console.log('📤 Market Size - modified_json:', modifiedData);

      // Store data for /ask API
      localStorage.setItem('market-size_original_json', JSON.stringify(originalData));
      localStorage.setItem('market-size_modified_json', JSON.stringify(modifiedData));

      // Call GET API to save edits using /ask endpoint with query parameters
      const queryParams = new URLSearchParams({
        original_json: JSON.stringify(originalData),
        modified_json: JSON.stringify(modifiedData),
        edit_type: "modification",
        section: "market_size"
      });
      
      const response = await fetch(`/api/ask?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 GET /ask status:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.status}`);
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
        throw new Error(`Failed to fetch updated data: ${getResponse.status}`);
      }

      const getData = await getResponse.json();
      console.log('✅ Market Size - GET /market_intelligence successful:', getData);
      
      // Update component with fresh data from API response
      if (getData && getData.market_size_data) {
        const apiData = getData.market_size_data;
        
        // Update local state with API response data
        setLocalExecutiveSummary(apiData.executiveSummary || '');
        setLocalTamValue(apiData.tamValue || '');
        setLocalSamValue(apiData.samValue || '');
        setLocalApacGrowthRate(apiData.apacGrowthRate || '');
        setLocalMarketEntry(apiData.marketEntry || '');
        setLocalStrategicRecommendations(apiData.strategicRecommendations || []);
        setLocalMarketDrivers(apiData.marketDrivers || []);
        
        // Update parent state with API response data
        onExecutiveSummaryChange(apiData.executiveSummary || '');
        onTamValueChange(apiData.tamValue || '');
        onSamValueChange(apiData.samValue || '');
        onApacGrowthRateChange(apiData.apacGrowthRate || '');
        onMarketEntryChange(apiData.marketEntry || '');
        onStrategicRecommendationsChange(apiData.strategicRecommendations || []);
        onMarketDriversChange(apiData.marketDrivers || []);
        
        console.log('✅ Market Size - State updated with API response data');
      } else {
        // Fallback: Update parent state with local values
        onExecutiveSummaryChange(localExecutiveSummary);
        onTamValueChange(localTamValue);
        onSamValueChange(localSamValue);
        onApacGrowthRateChange(localApacGrowthRate);
        onMarketEntryChange(localMarketEntry);
        onStrategicRecommendationsChange(localStrategicRecommendations);
        onMarketDriversChange(localMarketDrivers);
      }
      
      // Also refresh the component data
      await fetchUpdatedData();
      
      // Call the original save function to trigger chat panel
      onSaveChanges();
      
    } catch (error) {
      console.error('❌ Market Size - Error saving changes:', error);
      // Still call the original save function even if API fails
      onSaveChanges();
    }
  };

  const fetchUpdatedData = async () => {
    try {
      const response = await executeWithRateLimit(
        () => fetch('https://backend-11kr.onrender.com/market-research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ component_name: "market_size", user_id: "user_123" })
        }),
        'Market Size Update'
      );
      if (response.ok) {
        const data = await response.json();
        console.log('Updated data fetched:', data);
        // The parent component should handle updating the data
        if (onRefresh) {
          onRefresh();
        }
      }
    } catch (error) {
      console.error('Error fetching updated data:', error);
    }
  };

  return (
    <div className={`${showScoutChat ? 'flex gap-6' : ''}`}>
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${showScoutChat ? 'flex-1' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          Market Size & Opportunity
        </h2>
        <div className="flex items-center gap-3">
          <EditDropdownMenu
            onModify={handleModify}
            onComment={handleComment}
            className="text-blue-800 hover:text-blue-900"
          />
          {!isSplitView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => onScoutIconClick('market-size')} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200 hover:shadow-md hover:shadow-blue-200/50 relative">
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

      {/* Loading and Error States */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading market data...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-red-700 text-sm font-medium">Error loading data</span>
            </div>
            {onRefresh && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onRefresh}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                Retry
              </Button>
            )}
          </div>
          <p className="text-red-600 text-sm mt-2">{error}</p>
        </div>
      )}

      {!isLoading && !error && (
        isEditing ? (
        <div className="space-y-8">
          {/* Executive Summary Edit */}
          {!deletedSections.has('executive-summary') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSection('executive-summary')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <Label htmlFor="executiveSummary" className="text-sm font-medium text-gray-700 mb-2 block">
                  Executive Summary
                </Label>
                <Textarea 
                  id="executiveSummary" 
                  value={localExecutiveSummary} 
                  onChange={(e) => setLocalExecutiveSummary(e.target.value)} 
                  className="w-full h-32 resize-none" 
                  placeholder="Enter executive summary..." 
                />
              </div>
            </div>
          )}

          {/* Key Metrics Edit */}
          {!deletedSections.has('key-metrics') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSection('key-metrics')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
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
                    <Label htmlFor="tamValue" className="text-sm font-medium text-gray-700 mb-2 block">
                      Total Addressable Market
                    </Label>
                    <Input 
                      id="tamValue" 
                      value={localTamValue} 
                      onChange={(e) => setLocalTamValue(e.target.value)} 
                      placeholder="e.g., $4.2B" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="samValue" className="text-sm font-medium text-gray-700 mb-2 block">
                      Serviceable Addressable Market
                    </Label>
                    <Input 
                      id="samValue" 
                      value={localSamValue} 
                      onChange={(e) => setLocalSamValue(e.target.value)} 
                      placeholder="e.g., $2.1B" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="apacGrowthRate" className="text-sm font-medium text-gray-700 mb-2 block">
                      APAC Growth Rate
                    </Label>
                    <Input 
                      id="apacGrowthRate" 
                      value={localApacGrowthRate} 
                      onChange={(e) => setLocalApacGrowthRate(e.target.value)} 
                      placeholder="e.g., 25%" 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Strategic Recommendations Edit */}
          {!deletedSections.has('strategic-recommendations') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSection('strategic-recommendations')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Strategic Recommendations
                </Label>
                {localStrategicRecommendations.map((rec, index) => (
                  <Textarea 
                    key={index} 
                    value={rec} 
                    onChange={e => {
                      const newRecs = [...localStrategicRecommendations];
                      newRecs[index] = e.target.value;
                      setLocalStrategicRecommendations(newRecs);
                    }} 
                    className="w-full h-20 resize-none mb-3" 
                    placeholder={`Strategic recommendation ${index + 1}...`} 
                  />
                ))}
              </div>
            </div>
          )}

          {/* Market Entry Edit */}
          {!deletedSections.has('market-entry') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSection('market-entry')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <Label htmlFor="marketEntry" className="text-sm font-medium text-gray-700 mb-2 block">
                  Market Entry Strategy
                </Label>
                <Textarea 
                  id="marketEntry" 
                  value={localMarketEntry} 
                  onChange={e => setLocalMarketEntry(e.target.value)} 
                  className="w-full h-32 resize-none" 
                  placeholder="Enter market entry strategy..." 
                />
              </div>
            </div>
          )}

          {/* Market Drivers Edit */}
          {!deletedSections.has('market-drivers') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSection('market-drivers')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Key Market Drivers
                </Label>
                {localMarketDrivers.map((driver, index) => (
                  <Textarea 
                    key={index} 
                    value={driver} 
                    onChange={e => {
                      const newDrivers = [...localMarketDrivers];
                      newDrivers[index] = e.target.value;
                      setLocalMarketDrivers(newDrivers);
                    }} 
                    className="w-full h-16 resize-none mb-3" 
                    placeholder={`Market driver ${index + 1}...`} 
                  />
                ))}
              </div>
            </div>
          )}

          {/* Save/Cancel Buttons */}
          <div className="flex items-center gap-3 pt-6 border-t">
            <Button onClick={handleSave}>Save Changes</Button>
            <Button variant="outline" onClick={onCancelEdit}>Cancel</Button>
            <div className="flex-1"></div>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onEditHistoryOpen} className={`text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${editHistory.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={editHistory.length === 0}>
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
                <Button variant="ghost" size="sm" onClick={() => onScoutIconClick('market-size')} className="text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 hover:shadow-md hover:shadow-blue-200/50 transition-all duration-200 relative">
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
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
          {/* Executive Summary - Always Visible */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Executive Summary
            </h3>
            <p className="text-gray-700 mb-6">{localExecutiveSummary || executiveSummary}</p>

            {/* Key Metrics Cards - Always Visible */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-blue-600">{localTamValue || tamValue}</div>
                <div className="text-sm font-medium text-gray-900">Total Addressable Market</div>
                <div className="text-xs text-gray-600">Growing 15% YoY</div>
              </div>
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-green-600">{localSamValue || samValue}</div>
                <div className="text-sm font-medium text-gray-900">Serviceable Addressable Market</div>
                <div className="text-xs text-gray-600">Mid-market focus</div>
              </div>
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-purple-600">{localApacGrowthRate || apacGrowthRate}</div>
                <div className="text-sm font-medium text-gray-900">APAC Growth Rate</div>
                <div className="text-xs text-gray-600">Fastest growing region</div>
              </div>
            </div>
          </div>

          {/* Read More Button - Only show when not expanded and not in split view */}
          {!isExpanded && !isSplitView && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => onExpandToggle(true)}
                variant="outline"
                className="flex items-center space-x-2 text-sm"
              >
                <span>Read More</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Expanded Content */}
          {(isExpanded || isSplitView) && (
            <div className="animate-fade-in space-y-8">
              <div className="border-t pt-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-8">
                  Market Size & Opportunity Report
                </h2>

                {/* Strategic Recommendations */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-600" />
                    Strategic Recommendations
                  </h3>
                   <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                     <ul className="space-y-2 text-gray-700">
                       {(() => {
                         console.log('🎯 RENDER CHECK - strategicRecommendations in MarketSizeSection:', strategicRecommendations);
                         console.log('🎯 RENDER CHECK - Type:', typeof strategicRecommendations);
                         console.log('🎯 RENDER CHECK - Is Array:', Array.isArray(strategicRecommendations));
                         console.log('🎯 RENDER CHECK - Length:', strategicRecommendations?.length);
                         return null;
                       })()}
                         {Array.isArray(strategicRecommendations) ? (
                           strategicRecommendations.map((rec, index) => (
                             <li key={index} className="flex items-start gap-2">
                               <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                               {rec}
                             </li>
                           ))
                         ) : (
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                            No strategic recommendations available
                          </li>
                        )}
                    </ul>
                  </div>
                </div>

                {/* Market Entry */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Market Entry
                  </h3>
                   <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                     <p className="text-gray-700 mb-4">{localMarketEntry || marketEntry}</p>
                   </div>
                </div>

                {/* Market Opportunity Breakdown */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-purple-600" />
                    Market Opportunity Breakdown
                  </h3>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                     <div className="bg-white border border-gray-200 rounded-lg p-4">
                       <h4 className="font-medium text-gray-900 mb-3">Market Size by Segment</h4>
                       {(() => {
                         console.log('🔍 MarketSizeSection - marketSizeBySegment:', marketSizeBySegment);
                         console.log('🔍 MarketSizeSection - marketSizeBySegment exists:', !!marketSizeBySegment);
                         return null;
                       })()}
                       <MiniPieChart 
                         data={marketSizeBySegment ? Object.entries(marketSizeBySegment).map(([name, value], index) => ({
                           name,
                           value: parseInt(value.replace('%', '')),
                           color: ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B"][index % 4]
                         })) : [
                           { name: "Enterprise", value: 45, color: "#3B82F6" },
                           { name: "Mid-Market", value: 35, color: "#10B981" },
                           { name: "SMB", value: 20, color: "#8B5CF6" }
                         ]} 
                         title="" 
                       />
                    </div>
                     <div className="bg-white border border-gray-200 rounded-lg p-4">
                       <h4 className="font-medium text-gray-900 mb-3">Growth Projections</h4>
                       {(() => {
                         console.log('🔍 MarketSizeSection - growthProjections:', growthProjections);
                         console.log('🔍 MarketSizeSection - growthProjections exists:', !!growthProjections);
                         return null;
                       })()}
                        <MiniLineChart 
                          data={(() => {
                            if (!growthProjections) {
                              return [
                                { name: "2023", value: 100 },
                                { name: "2024", value: 115 },
                                { name: "2025", value: 132 },
                                { name: "2026", value: 152 }
                              ];
                            }
                            
                            // If growthProjections is a string, use fallback data
                            if (typeof growthProjections === 'string') {
                              console.log('🔧 growthProjections is string, using fallback data');
                              return [
                                { name: "2023", value: 100 },
                                { name: "2024", value: 120 },
                                { name: "2025", value: 144 },
                                { name: "2026", value: 173 }
                              ];
                            }
                            
                            // If it's an object, transform it safely
                            return Object.entries(growthProjections).map(([year, value]) => {
                              const numericValue = parseFloat(value.toString());
                              console.log(`🔧 Converting ${year}: ${value} -> ${numericValue}`);
                              return {
                                name: year,
                                value: isNaN(numericValue) ? 100 : numericValue * 100
                              };
                            });
                          })()} 
                          title="" 
                          color="#3B82F6" 
                        />
                     </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-3">Key Market Drivers</h4>
                     <ul className="space-y-2 text-gray-700">
                       {marketDrivers.map((driver, index) => (
                         <li key={index} className="flex items-start gap-2">
                           <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></div>
                           {driver}
                         </li>
                       ))}
                     </ul>
                  </div>
                </div>

                {/* Export Options */}
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

                {/* Show Less Button - Only when not in split view */}
                {!isSplitView && (
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={() => onExpandToggle(false)}
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
      ))}
      </div>
      {showScoutChat && scoutChatPanel && (
        <div className="w-1/2 flex-shrink-0">
          {scoutChatPanel}
        </div>
      )}
    </div>
  );
};

export default MarketSizeSection;