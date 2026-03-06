import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, Bot, Edit, Target, TrendingUp, PieChart, X, FileText, Save, Share, Clock, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import MiniPieChart from '@/components/ui/MiniPieChart';
import MiniLineChart from '@/components/ui/MiniLineChart';
import { EditRecord } from './types';
import { executeWithRateLimit } from '@/lib/rateLimitManager';
import { apiFetchJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { getUserLocalStorage, setUserLocalStorage, removeUserLocalStorage } from '@/utils/cacheUtils';

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
  GrowthRate: string;
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
  onGrowthRateChange: (value: string) => void;
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
  isRefreshing?: boolean;
  companyProfile?: any;
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
  GrowthRate,
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
  onGrowthRateChange,
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
  onRefresh,
  isRefreshing,
  companyProfile
}) => {
  const { currentUser, orgId } = useAuth();
  const orgIdToUse = orgId || 'brewra'; // Fallback to 'brewra' for backward compatibility
  // Track previous user to detect user switches
  const previousUserRef = useRef<string | null | undefined>(currentUser?.uid);
  // Track if we just cleared due to user switch (to prevent immediate sync with stale props)
  const justClearedRef = useRef<boolean>(false);
  
  // API data fetching state
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [errorData, setErrorData] = useState<string | null>(null);
  const [marketSizeData, setMarketSizeData] = useState<any>(null);

  // Local editing state for inline editing - initialize once and keep values
  const [localExecutiveSummary, setLocalExecutiveSummary] = useState(executiveSummary || '');
  const [localTamValue, setLocalTamValue] = useState(tamValue || '');
  const [localSamValue, setLocalSamValue] = useState(samValue || '');
  const [localGrowthRate, setLocalGrowthRate] = useState(GrowthRate || '');
  const [localMarketEntry, setLocalMarketEntry] = useState(marketEntry || '');
  const [localStrategicRecommendations, setLocalStrategicRecommendations] = useState<string[]>(strategicRecommendations || []);
  const [localMarketDrivers, setLocalMarketDrivers] = useState<string[]>(marketDrivers || []);
  const [localMarketSizeBySegment, setLocalMarketSizeBySegment] = useState<Record<string, string>>(marketSizeBySegment || {});
  const [localGrowthProjections, setLocalGrowthProjections] = useState<Record<string, string>>(growthProjections || {});
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Track if we just saved to prevent useEffect from overwriting our changes
  const justSavedRef = useRef(false);
  const savedLocalStateRef = useRef<{
    executiveSummary: string;
    tamValue: string;
    samValue: string;
    GrowthRate: string;
    marketEntry: string;
    strategicRecommendations: string[];
    marketDrivers: string[];
  } | null>(null);

  // Debug logging for state changes removed

  const { toast } = useToast();

  // Handle section delete
  const handleSectionDelete = () => {
    // Implementation for section deletion
    onDeleteSection('market-size');
  };

  const handleModify = () => {
    onToggleEdit();
  };

  // Reset local values when editing starts
  useEffect(() => {
    if (isEditing) {
      console.log('📝 Editing started - Setting local values:', {
        executiveSummary,
        tamValue,
        samValue,
        GrowthRate,
        marketEntry,
        strategicRecommendations,
        marketDrivers,
        marketSizeBySegment,
        growthProjections
      });
      
      setLocalExecutiveSummary(executiveSummary || '');
      setLocalTamValue(tamValue || '');
      setLocalSamValue(samValue || '');
      setLocalGrowthRate(GrowthRate || '');
      setLocalMarketEntry(marketEntry || '');
      setLocalStrategicRecommendations(strategicRecommendations || []);
      setLocalMarketDrivers(marketDrivers || []);
      setLocalMarketSizeBySegment(marketSizeBySegment || {});
      setLocalGrowthProjections(growthProjections || {});
    }
  }, [isEditing]);

  // Sync local state with props when they change (but only when not editing and not just saved)
  // IMPORTANT: Never overwrite local state if we just saved until props catch up
  useEffect(() => {
    if (!isEditing && currentUser?.uid) {
      // Skip syncing if we just cleared due to user switch (prevent syncing with stale props)
      if (justClearedRef.current) {
        return;
      }
      
      // If we just saved, check if props have caught up with our saved state
      if (justSavedRef.current && savedLocalStateRef.current) {
        const propsMatchSaved = 
          (executiveSummary || '') === savedLocalStateRef.current.executiveSummary &&
          (tamValue || '') === savedLocalStateRef.current.tamValue &&
          (samValue || '') === savedLocalStateRef.current.samValue &&
          (GrowthRate || '') === savedLocalStateRef.current.GrowthRate &&
          (marketEntry || '') === savedLocalStateRef.current.marketEntry;
        
        if (propsMatchSaved) {
          // Props have caught up - safe to reset flag and allow normal syncing
          justSavedRef.current = false;
          savedLocalStateRef.current = null;
        } else {
          // Props haven't caught up yet - DO NOT overwrite local state
          return; // Exit early, don't overwrite
        }
      }
      
      // Syncing with props
      
      // Only sync with props when they change (if not editing and not just saved)
      // This ensures we get fresh data from parent/API, but preserves our edits
      if (executiveSummary && executiveSummary !== localExecutiveSummary) {
        setLocalExecutiveSummary(executiveSummary);
      }
      if (tamValue && tamValue !== localTamValue) {
        setLocalTamValue(tamValue);
      }
      if (samValue && samValue !== localSamValue) {
        setLocalSamValue(samValue);
      }
      if (GrowthRate && GrowthRate !== localGrowthRate) {
        setLocalGrowthRate(GrowthRate);
      }
      if (marketEntry && marketEntry !== localMarketEntry) {
        setLocalMarketEntry(marketEntry);
      }
      // Always sync arrays - update if props have data, clear if props are empty
      if (Array.isArray(strategicRecommendations)) {
        const currentStr = JSON.stringify(localStrategicRecommendations);
        const newStr = JSON.stringify(strategicRecommendations);
        if (currentStr !== newStr) {
          setLocalStrategicRecommendations(strategicRecommendations.length > 0 ? [...strategicRecommendations] : []);
        }
      } else if (localStrategicRecommendations.length > 0) {
        // Clear if props are not an array but local has data
        setLocalStrategicRecommendations([]);
      }
      
      if (Array.isArray(marketDrivers)) {
        const currentStr = JSON.stringify(localMarketDrivers);
        const newStr = JSON.stringify(marketDrivers);
        if (currentStr !== newStr) {
          setLocalMarketDrivers(marketDrivers.length > 0 ? [...marketDrivers] : []);
        }
      } else if (localMarketDrivers.length > 0) {
        // Clear if props are not an array but local has data
        setLocalMarketDrivers([]);
      }
    }
  }, [executiveSummary, tamValue, samValue, GrowthRate, marketEntry, strategicRecommendations, marketDrivers, isEditing, currentUser?.uid]);

  // REMOVED: Duplicate sync effect - the above effect handles all syncing

  // Individual box save functions
  const handleSaveExecutiveSummary = () => {
    onExecutiveSummaryChange(localExecutiveSummary);
    toast({
      title: "Saved",
      description: "Executive Summary changes committed.",
    });
  };

  const handleSaveKeyMetrics = () => {
    onTamValueChange(localTamValue);
    onSamValueChange(localSamValue);
    onGrowthRateChange(localGrowthRate);
    toast({
      title: "Saved",
      description: "Key Metrics changes committed.",
    });
  };

  const handleSaveStrategicRecommendations = () => {
    onStrategicRecommendationsChange(localStrategicRecommendations);
    toast({
      title: "Saved",
      description: "Strategic Recommendations changes committed.",
    });
  };

  const handleSaveMarketEntry = () => {
    onMarketEntryChange(localMarketEntry);
    toast({
      title: "Saved",
      description: "Market Entry Strategy changes committed.",
    });
  };

  const handleSaveMarketDrivers = () => {
    onMarketDriversChange(localMarketDrivers);
    toast({
      title: "Saved",
      description: "Market Drivers changes committed.",
    });
  };

  const handleSaveMarketOpportunity = () => {
    // Note: marketSizeBySegment and growthProjections don't have individual change handlers
    // They would need to be added to props if we want to save them individually
    toast({
      title: "Saved",
      description: "Market Opportunity Breakdown changes committed.",
    });
  };

  const handleSave = async () => {
    try {
      // Prepare original and modified data
      const originalData = {
        executiveSummary,
        tamValue,
        samValue,
        GrowthRate,
        marketEntry,
        strategicRecommendations,
        marketDrivers,
        marketSizeBySegment: marketSizeBySegment || {},
        growthProjections: growthProjections || {}
      };

      const modifiedData = {
        executiveSummary: localExecutiveSummary,
        tamValue: localTamValue,
        samValue: localSamValue,
        GrowthRate: localGrowthRate,
        marketEntry: localMarketEntry,
        strategicRecommendations: localStrategicRecommendations,
        marketDrivers: localMarketDrivers,
        marketSizeBySegment: localMarketSizeBySegment,
        growthProjections: localGrowthProjections
      };

      const editData = {
        original_json: originalData,
        modified_json: modifiedData,
        edit_type: "modification"
      };

      console.log('📤 Market Size - original_json:', originalData);
      console.log('📤 Market Size - modified_json:', modifiedData);

      // Store data for /ask API (user-specific)
      setUserLocalStorage('market-size_original_json', JSON.stringify(originalData), currentUser?.uid);
      setUserLocalStorage('market-size_modified_json', JSON.stringify(modifiedData), currentUser?.uid);

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

      // IMPORTANT: Set the flag FIRST before any state updates to prevent useEffect from overwriting
      justSavedRef.current = true;
      savedLocalStateRef.current = {
        executiveSummary: localExecutiveSummary,
        tamValue: localTamValue,
        samValue: localSamValue,
        GrowthRate: localGrowthRate,
        marketEntry: localMarketEntry,
        strategicRecommendations: [...localStrategicRecommendations],
        marketDrivers: [...localMarketDrivers]
      };

      // Update parent state with local values (trust the user's edits)
      onExecutiveSummaryChange(localExecutiveSummary);
      onTamValueChange(localTamValue);
      onSamValueChange(localSamValue);
      onGrowthRateChange(localGrowthRate);
      onMarketEntryChange(localMarketEntry);
      onStrategicRecommendationsChange(localStrategicRecommendations);
      onMarketDriversChange(localMarketDrivers);
      
      console.log('✅ Market Size - Local state preserved for immediate UI refresh:', {
        exec: localExecutiveSummary.substring(0, 30),
        tam: localTamValue,
        sam: localSamValue,
        apac: localGrowthRate
      });
      
      // Call the original save function to trigger chat panel
      onSaveChanges();
      
    } catch (error) {
      console.error('❌ Market Size - Error saving changes:', error);
      
      // IMPORTANT: Set the flag even if API fails to prevent useEffect from overwriting
      justSavedRef.current = true;
      savedLocalStateRef.current = {
        executiveSummary: localExecutiveSummary,
        tamValue: localTamValue,
        samValue: localSamValue,
        GrowthRate: localGrowthRate,
        marketEntry: localMarketEntry,
        strategicRecommendations: [...localStrategicRecommendations],
        marketDrivers: [...localMarketDrivers]
      };
      
      // Even if API fails, update parent state with local values
      onExecutiveSummaryChange(localExecutiveSummary);
      onTamValueChange(localTamValue);
      onSamValueChange(localSamValue);
      onGrowthRateChange(localGrowthRate);
      onMarketEntryChange(localMarketEntry);
      onStrategicRecommendationsChange(localStrategicRecommendations);
      onMarketDriversChange(localMarketDrivers);
      
      
      // Still call the original save function even if API fails
      onSaveChanges();
    }
  };

  const fetchUpdatedData = async () => {
    if (!currentUser?.uid) {
      console.error('User not authenticated');
      return;
    }
    try {
      const data = await executeWithRateLimit(
        () => apiFetchJson('market-research', {
          method: 'POST',
          body: { component_name: "market_size", org_id: orgIdToUse }
        }),
        'Market Size Update'
      );
      // The parent component should handle updating the data
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error fetching updated data:', error);
    }
  };

  // Fetch Market Size data from API
  const fetchMarketSizeData = async (refresh = false) => {
    try {
      setIsLoadingData(true);
      setErrorData(null);

      // Get company profile data for dynamic reports (user-specific)
      const profile = companyProfile || JSON.parse(getUserLocalStorage('companyProfile', currentUser?.uid) || '{}');
      
      if (!currentUser?.uid) {
        console.error('User not authenticated');
        setErrorData('User not authenticated');
        setIsLoadingData(false);
        return;
      }
      
      const payload = {
        org_id: orgIdToUse,
        user_id: currentUser.uid,
        component_name: "market size & opportunity", // Exact match from swagger
        refresh: refresh,
        force_refresh: refresh,
        cache_bypass: refresh,
        bypass_all_cache: refresh,
        request_timestamp: Date.now(),
        request_id: Math.random().toString(36).substr(2, 6),
        data: {}
      };


      const result = await executeWithRateLimit(
        () => apiFetchJson('market-research', {
          method: 'POST',
          body: payload
        }),
        'Market Size'
      );

      
      if (result.status === 'success' && result.data) {
        const apiData = result.data;
        
        // Check if we have the expected Market Size data structure
        // Also check for nested data structures that might be in the API response
        const hasDirectData = apiData.executiveSummary || apiData.tamValue || apiData.samValue || apiData.strategicRecommendations;
        const hasNestedData = apiData.market_size_data || apiData.marketSizeData || apiData.marketSize;
        
        if (hasDirectData || hasNestedData) {
          
          // Use nested data if available, otherwise use direct data
          const dataToUse = apiData.market_size_data || apiData.marketSizeData || apiData.marketSize || apiData;
          
          // Store the data
          setMarketSizeData(dataToUse);
          
          // Update parent state with API response data (only if data exists)
          if (dataToUse.executiveSummary) onExecutiveSummaryChange(dataToUse.executiveSummary);
          if (dataToUse.tamValue) onTamValueChange(dataToUse.tamValue);
          if (dataToUse.samValue) onSamValueChange(dataToUse.samValue);
          if (dataToUse.GrowthRate) onGrowthRateChange(dataToUse.GrowthRate);
          if (dataToUse.marketEntry) onMarketEntryChange(dataToUse.marketEntry);
          
          // Handle strategic recommendations - check if it's an array or needs to be converted
          if (dataToUse.strategicRecommendations) {
            let recommendations = dataToUse.strategicRecommendations;
            if (typeof recommendations === 'string') {
              // If it's a string, try to split it or convert to array
              recommendations = recommendations.split('\n').filter(r => r.trim());
            }
            if (Array.isArray(recommendations)) {
              onStrategicRecommendationsChange(recommendations);
            }
          }
          
          // Handle market drivers - check if it's an array or needs to be converted
          if (dataToUse.marketDrivers) {
            let drivers = dataToUse.marketDrivers;
            if (typeof drivers === 'string') {
              // If it's a string, try to split it or convert to array
              drivers = drivers.split('\n').filter(d => d.trim());
            }
            if (Array.isArray(drivers)) {
              onMarketDriversChange(drivers);
            }
          }
          
        } else {
        }
      } else {
      }
      
    } catch (error) {
      console.error('❌ Market Size - Error fetching data:', error);
      setErrorData(error instanceof Error ? error.message : 'Failed to fetch market size data');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Clear state when user changes to prevent data leakage
  useEffect(() => {
    const previousUserId = previousUserRef.current;
    const currentUserId = currentUser?.uid;
    
    // Only clear if user actually changed (not on initial mount)
    if (previousUserId !== undefined && previousUserId !== currentUserId) {
      setMarketSizeData(null);
      setErrorData(null);
      setIsLoadingData(false);
      // Reset local state to empty to force fresh fetch
      setLocalExecutiveSummary('');
      setLocalTamValue('');
      setLocalSamValue('');
      setLocalGrowthRate('');
      setLocalMarketEntry('');
      setLocalStrategicRecommendations([]);
      setLocalMarketDrivers([]);
      // Mark that we just cleared to prevent immediate sync with stale props
      justClearedRef.current = true;
      // Force a small delay to ensure state is cleared before any sync happens
      const clearTimer = setTimeout(() => {
        // Reset the flag after a delay to allow new data to come in
        setTimeout(() => {
          justClearedRef.current = false;
        }, 200);
      }, 50);
      return () => clearTimeout(clearTimer);
    }
    
    // Update ref for next comparison - do this AFTER clearing to prevent race conditions
    const updateTimer = setTimeout(() => {
      previousUserRef.current = currentUserId;
    }, 100);
    
    return () => clearTimeout(updateTimer);
  }, [currentUser?.uid]);

  // Fetch data when component mounts or user changes if no data is available
  useEffect(() => {
    if (!currentUser?.uid) {
      return; // Don't fetch if user is not authenticated
    }
    
    
    // Always check if we have fresh data for this user
    // The parent component should pass fresh data, but if not, we fetch
    const hasData = executiveSummary || tamValue || samValue || GrowthRate || strategicRecommendations.length > 0 || marketEntry || marketDrivers.length > 0;
    
    if (!hasData && !isLoadingData) {
      const timer = setTimeout(() => {
        fetchMarketSizeData(false);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [currentUser?.uid, executiveSummary, tamValue, samValue, GrowthRate, strategicRecommendations.length, marketEntry, marketDrivers.length]);
  
  // Handle refresh when parent triggers it
  useEffect(() => {
    if (isRefreshing) {
      // Clear old data immediately to prevent showing stale data
      setMarketSizeData(null);
      setErrorData(null);
      setIsLoadingData(true);
      fetchMarketSizeData(true);
    }
  }, [isRefreshing]);

  // Check if we have any meaningful data
  const hasData = executiveSummary || tamValue || samValue || GrowthRate || strategicRecommendations.length > 0 || marketEntry || marketDrivers.length > 0;

  // Loading state
  if (isLoadingData && !hasData) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading market size data...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!hasData && !isLoadingData) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No market size data available</p>
          <Button 
            onClick={() => {
              // onScoutIconClick('market-size');
              toast({
                title: "Coming Soon",
                description: "Scout feature is coming soon!",
              });
            }} 
            variant="outline"
            className="opacity-50"
          >
            <Bot className="h-4 w-4 mr-2 text-gray-400" />
            Generate Report with Scout
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${showScoutChat ? 'flex gap-6' : ''}`}>
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${showScoutChat ? 'flex-1' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          Market Size & Opportunity
        </h2>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleModify}
            className="text-blue-800 hover:text-blue-900"
          >
            <Edit className="h-4 w-4" />
          </Button>
          {!isSplitView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    onScoutIconClick('market-size');
                  }} 
                  className="text-blue-600 hover:text-blue-700 transition-all duration-200 relative"
                >
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                  <Bot className="h-5 w-5 relative z-10" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Chat with Scout</p>
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
              <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveExecutiveSummary}
                      className="text-gray-400 hover:text-green-600 hover:bg-green-50"
                      title="Commit changes"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Commit changes</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => onDeleteSection('executive-summary')} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
              </div>
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
              <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveKeyMetrics}
                      className="text-gray-400 hover:text-green-600 hover:bg-green-50"
                      title="Commit changes"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Commit changes</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => onDeleteSection('key-metrics')} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
              </div>
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
                    <Label htmlFor="GrowthRate" className="text-sm font-medium text-gray-700 mb-2 block">
                      Growth Rate
                    </Label>
                    <Input 
                      id="GrowthRate" 
                      value={localGrowthRate} 
                      onChange={(e) => setLocalGrowthRate(e.target.value)} 
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
              <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveStrategicRecommendations}
                      className="text-gray-400 hover:text-green-600 hover:bg-green-50"
                      title="Commit changes"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Commit changes</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => onDeleteSection('strategic-recommendations')} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
              </div>
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
              <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveMarketEntry}
                      className="text-gray-400 hover:text-green-600 hover:bg-green-50"
                      title="Commit changes"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Commit changes</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => onDeleteSection('market-entry')} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
              </div>
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
              <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveMarketDrivers}
                      className="text-gray-400 hover:text-green-600 hover:bg-green-50"
                      title="Commit changes"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Commit changes</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => onDeleteSection('market-drivers')} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
              </div>
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

          {/* Market Opportunity Breakdown Edit */}
          {!deletedSections.has('market-opportunity-breakdown') && (
            <div className="relative group">
              <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveMarketOpportunity}
                      className="text-gray-400 hover:text-green-600 hover:bg-green-50"
                      title="Commit changes"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Commit changes</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => onDeleteSection('market-opportunity-breakdown')} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-purple-600" />
                  Market Opportunity Breakdown
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Market Size by Segment */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <Label className="text-sm font-medium text-gray-900 mb-3 block">
                      Market Size by Segment
                    </Label>
                    <div className="space-y-3">
                      {Object.entries(localMarketSizeBySegment).map(([segment, value], index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            value={segment}
                            onChange={e => {
                              const updated = { ...localMarketSizeBySegment };
                              const oldKey = segment;
                              const newKey = e.target.value;
                              if (newKey !== oldKey) {
                                delete updated[oldKey];
                                updated[newKey] = value;
                              }
                              setLocalMarketSizeBySegment(updated);
                            }}
                            className="flex-1 text-sm"
                            placeholder="Segment name"
                          />
                          <Input
                            type="text"
                            value={value}
                            onChange={e => {
                              const updated = { ...localMarketSizeBySegment };
                              updated[segment] = e.target.value;
                              setLocalMarketSizeBySegment(updated);
                            }}
                            className="w-24 text-sm"
                            placeholder="Value"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = { ...localMarketSizeBySegment };
                              delete updated[segment];
                              setLocalMarketSizeBySegment(updated);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setLocalMarketSizeBySegment({
                            ...localMarketSizeBySegment,
                            ['New Segment']: ''
                          });
                        }}
                        className="mt-2"
                      >
                        Add Segment
                      </Button>
                    </div>
                  </div>

                  {/* Growth Projections */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <Label className="text-sm font-medium text-gray-900 mb-3 block">
                      Growth Projections
                    </Label>
                    <div className="space-y-3">
                      {Object.entries(localGrowthProjections).map(([year, value], index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            value={year}
                            onChange={e => {
                              const updated = { ...localGrowthProjections };
                              const oldKey = year;
                              const newKey = e.target.value;
                              if (newKey !== oldKey) {
                                delete updated[oldKey];
                                updated[newKey] = value;
                              }
                              setLocalGrowthProjections(updated);
                            }}
                            className="flex-1 text-sm"
                            placeholder="Year"
                          />
                          <Input
                            type="text"
                            value={value}
                            onChange={e => {
                              const updated = { ...localGrowthProjections };
                              updated[year] = e.target.value;
                              setLocalGrowthProjections(updated);
                            }}
                            className="w-24 text-sm"
                            placeholder="Value"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = { ...localGrowthProjections };
                              delete updated[year];
                              setLocalGrowthProjections(updated);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setLocalGrowthProjections({
                            ...localGrowthProjections,
                            ['2024']: ''
                          });
                        }}
                        className="mt-2"
                      >
                        Add Year
                      </Button>
                    </div>
                  </div>
                </div>
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
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    onScoutIconClick('market-size');
                  }} 
                  className="text-blue-600 hover:text-blue-700 transition-all duration-200 relative"
                >
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                  <Bot className="h-4 w-4 relative z-10" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Chat with Scout</p>
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
                <div className="text-2xl font-bold text-purple-600">{localGrowthRate || GrowthRate}</div>
                <div className="text-sm font-medium text-gray-900">Growth Rate</div>
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
                className="flex items-center space-x-2 text-sm hover:bg-gray-50"
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
                         return null;
                       })()}
                         {Array.isArray(localStrategicRecommendations) && localStrategicRecommendations.length > 0 ? (
                           localStrategicRecommendations.map((rec, index) => (
                             <li key={index} className="flex items-start gap-2">
                               <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                               {rec}
                             </li>
                           ))
                         ) : Array.isArray(strategicRecommendations) && strategicRecommendations.length > 0 ? (
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
                         if (typeof marketSizeBySegment === 'string') {
                         }
                         return null;
                       })()}
                       <MiniPieChart 
                         data={(() => {
                           const segmentsToUse = Object.keys(localMarketSizeBySegment).length > 0 ? localMarketSizeBySegment : marketSizeBySegment;
                           if (!segmentsToUse || Object.keys(segmentsToUse).length === 0) {
                             return [
                               { name: "Enterprise", value: 45, color: "#3B82F6" },
                               { name: "Mid-Market", value: 35, color: "#10B981" },
                               { name: "SMB", value: 20, color: "#8B5CF6" }
                             ];
                           }
                           
                           // If marketSizeBySegment is a string, try to parse it as JSON first
                           if (typeof segmentsToUse === 'string') {
                             try {
                               const parsedSegments = JSON.parse(segmentsToUse);
                               if (parsedSegments && typeof parsedSegments === 'object') {
                                 return Object.entries(parsedSegments).map(([name, value], index) => ({
                                   name,
                                   value: parseInt(value.toString().replace('%', '')),
                                   color: ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B"][index % 4]
                                 }));
                               }
                             } catch (parseError) {
                             }
                             
                             // Only use fallback data if parsing fails
                             return [
                               { name: "Enterprise", value: 45, color: "#3B82F6" },
                               { name: "Mid-Market", value: 35, color: "#10B981" },
                               { name: "SMB", value: 20, color: "#8B5CF6" }
                             ];
                           }
                           
                           // If it's an object, use it directly
                           return Object.entries(segmentsToUse).map(([name, value], index) => ({
                             name,
                             value: parseInt(value.toString().replace('%', '')),
                             color: ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B"][index % 4]
                           }));
                         })()} 
                         title="" 
                       />
                    </div>
                     <div className="bg-white border border-gray-200 rounded-lg p-4">
                       <h4 className="font-medium text-gray-900 mb-3">Growth Projections</h4>
                       {(() => {
                         if (typeof growthProjections === 'string') {
                         }
                         return null;
                       })()}
                        <MiniLineChart 
                          data={(() => {
                            const projectionsToUse = Object.keys(localGrowthProjections).length > 0 ? localGrowthProjections : growthProjections;
                            if (!projectionsToUse || Object.keys(projectionsToUse).length === 0) {
                              return [
                                { name: "2023", value: 100 },
                                { name: "2024", value: 115 },
                                { name: "2025", value: 132 },
                                { name: "2026", value: 152 }
                              ];
                            }
                            
                            // If growthProjections is a string, try to parse it as JSON first
                            if (typeof projectionsToUse === 'string') {
                              try {
                                const parsedProjections = JSON.parse(projectionsToUse);
                                if (parsedProjections && typeof parsedProjections === 'object') {
                                  return Object.entries(parsedProjections).map(([year, value]) => {
                                    const numericValue = parseFloat(value.toString());
                                    return {
                                      name: year,
                                      value: isNaN(numericValue) ? 100 : numericValue * 100
                                    };
                                  });
                                }
                              } catch (parseError) {
                              }
                              
                              // Only use fallback data if parsing fails
                              return [
                                { name: "2023", value: 100 },
                                { name: "2024", value: 120 },
                                { name: "2025", value: 144 },
                                { name: "2026", value: 173 }
                              ];
                            }
                            
                            // If it's an object, transform it safely
                            return Object.entries(projectionsToUse).map(([year, value]) => {
                              const numericValue = parseFloat(value.toString());
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
                       {(Array.isArray(localMarketDrivers) && localMarketDrivers.length > 0 ? localMarketDrivers : marketDrivers || []).map((driver, index) => (
                         <li key={index} className="flex items-start gap-2">
                           <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></div>
                           {driver}
                         </li>
                       ))}
                       {(!localMarketDrivers || localMarketDrivers.length === 0) && (!marketDrivers || marketDrivers.length === 0) && (
                         <li className="flex items-start gap-2">
                           <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></div>
                           No market drivers available
                         </li>
                       )}
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