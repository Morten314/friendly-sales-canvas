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
import { apiFetchJson } from '@/lib/api';
import { executeWithRateLimit } from '@/lib/rateLimitManager';

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
  
  // Local state for error and loading management
  const [localError, setLocalError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState<boolean>(false);
  
  // Check if we're loading - show loading when local loading is true OR when parent is refreshing
  // Don't show loading if we have data from props or parent
  const hasPropData = executiveSummary || topPlayerShare || emergingPlayers || fundingNews?.length > 0;
  const isLoading = localLoading || (isRefreshing && !hasPropData);
  
  // Debug loading state
  console.log('🔍 Competitor Landscape Loading State Debug:', {
    localLoading,
    competitorData: !!competitorData,
    hasPropData,
    executiveSummary: !!executiveSummary,
    topPlayerShare: !!topPlayerShare,
    emergingPlayers: !!emergingPlayers,
    fundingNewsLength: fundingNews?.length || 0,
    error: !!error,
    localError: !!localError,
    isLoading
  });
  
  // Use local error if available, otherwise use prop error
  const displayError = localError || error;
  
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
      console.log('  - isRefreshing:', isRefreshing);
      
      // Always update local state with competitorData (prioritize API data)
      const newExecutiveSummary = competitorData?.executiveSummary || executiveSummary || '';
      const newTopPlayerShare = competitorData?.topPlayerShare || topPlayerShare || '';
      const newEmergingPlayers = competitorData?.emergingPlayers || emergingPlayers || '';
      
      setLocalExecutiveSummary(newExecutiveSummary);
      setLocalTopPlayerShare(newTopPlayerShare);
      setLocalEmergingPlayers(newEmergingPlayers);
      
      console.log('✅ Updated local state:');
      console.log('  - localExecutiveSummary set to:', newExecutiveSummary);
      console.log('  - localTopPlayerShare set to:', newTopPlayerShare);
      console.log('  - localEmergingPlayers set to:', newEmergingPlayers);
      console.log('  - competitorData has uiComponents:', !!competitorData?.uiComponents);
      console.log('  - competitorData uiComponents length:', competitorData?.uiComponents?.length);
    }
  }, [executiveSummary, topPlayerShare, emergingPlayers, competitorData, isCompetitorLandscapeEditing, isRefreshing]);

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

      // Call GET API to save edits using /ask endpoint with query parameters
      const queryParams = new URLSearchParams({
        original_json: JSON.stringify(originalData),
        modified_json: JSON.stringify(modifiedData),
        edit_type: "modification",
        section: "competitor_landscape"
      });
      
      const response = await fetch(`/api/ask?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 GET /ask status:', response.status);

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
      
      // Call the original save function to trigger chat panel
      onCompetitorLandscapeSaveChanges();
    } catch (error) {
      console.error('❌ Competitor Landscape - Error saving changes:', error);
      // Still call the original save function even if API fails
      onCompetitorLandscapeSaveChanges();
    }
  };

  // Fetch Competitor Landscape data from API (like working components do)
  const fetchCompetitorLandscapeData = async (refresh = false) => {
    console.log('🏢🏢🏢 CompetitorLandscapeSection: Starting fetchCompetitorLandscapeData with refresh:', refresh);
    console.log('🏢🏢🏢 CompetitorLandscapeSection: Function called at:', new Date().toISOString());
    console.log('🏢🏢🏢 CompetitorLandscapeSection: Current props:', { executiveSummary, topPlayerShare, emergingPlayers });
    try {
        setLocalLoading(true);
        setLocalError(null);

      const currentTime = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      
      // Get company profile data for dynamic reports (same source as parent)
      let profile = null;
      try {
        const profileData = localStorage.getItem('companyProfileForRefresh');
        if (profileData) {
          profile = JSON.parse(profileData);
          console.log('🔍 Competitor Landscape - Using companyProfileForRefresh:', profile);
        } else {
          // Fallback to companyProfile prop or regular localStorage
          profile = companyProfile || JSON.parse(localStorage.getItem('companyProfile') || '{}');
          console.log('🔍 Competitor Landscape - Using fallback profile:', profile);
        }
      } catch (error) {
        console.warn('⚠️ Competitor Landscape - Could not get company profile data:', error);
        profile = companyProfile || JSON.parse(localStorage.getItem('companyProfile') || '{}');
      }
      
      const payload = {
        user_id: "brewra",
        component_name: "competitor landscape", // Match parent component exactly
        data: {
          additionalPrompt: profile.companyUrl ? {
            industry: profile.industry,
            companySize: profile.companySize,
            targetMarkets: profile.targetMarkets,
            strategicGoals: profile.strategicGoals,
            website: profile.website,
            gtmModel: profile.primaryGTMModel,
            revenueStage: profile.revenueStage,
            keyBuyerPersona: profile.keyBuyerPersona
          } : {}
        },
        refresh: refresh
      };

      console.log('📤 CompetitorLandscapeSection: Sending API request with payload:', payload);

      // Try the API call with retry mechanism (like parent component)
      let result;
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          console.log(`🔄 Competitor Landscape - Attempting API call (attempt ${retryCount + 1}/${maxRetries + 1})`);
          
          result = await apiFetchJson('market-research', {
            method: 'POST',
            body: JSON.stringify(payload)
          });

          console.log('✅ Competitor Landscape - API call successful');
          break; // Success, exit retry loop

        } catch (apiError) {
          retryCount++;
          console.error(`❌ Competitor Landscape - API call failed (attempt ${retryCount}/${maxRetries + 1}):`, apiError);
          
          if (retryCount > maxRetries) {
            throw apiError; // Re-throw if we've exhausted retries
          }
          
          // Wait before retrying
          console.log(`⏳ Competitor Landscape - Waiting 2 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      console.log('📨 CompetitorLandscapeSection: API result:', result);
      console.log('📨 CompetitorLandscapeSection: API result.success:', result.success);
      console.log('📨 CompetitorLandscapeSection: API result.status:', result.status);
      console.log('📨 CompetitorLandscapeSection: API result.data exists:', !!result.data);
      console.log('📨 CompetitorLandscapeSection: RAW API result:', JSON.stringify(result, null, 2));

      if (!result.success) {
        console.error('❌ CompetitorLandscapeSection: API error response:', result.error);
        throw new Error(`API error: ${result.error}`);
      }

      console.log('📊 CompetitorLandscapeSection: API data:', result.data);

      if (result.status === 'success' && result.data) {
        const apiData = result.data;
        console.log('🎯 CompetitorLandscapeSection: Processing API data:', apiData);
        console.log('🎯 API Data Keys:', Object.keys(apiData));
        console.log('🎯 API Data uiComponents:', apiData.uiComponents);
        
        // Extract data from uiComponents array (same as parent function)
        let executiveSummary = '';
        let topPlayerShare = '';
        let emergingPlayers = '';
        let fundingNews = [];
        
        if (apiData.uiComponents && Array.isArray(apiData.uiComponents)) {
          console.log('🔍 Found uiComponents array:', apiData.uiComponents);
          
          // Extract data from uiComponents based on the backend schema
          const reportComponent = apiData.uiComponents.find(comp => comp.type === 'report');
          const sectionComponent = apiData.uiComponents.find(comp => comp.type === 'section');
          const newsComponent = apiData.uiComponents.find(comp => comp.type === 'news');
          
          // Extract executive summary from report component
          executiveSummary = reportComponent?.executiveSummary || '';
          
          // Extract metrics from section component
          if (sectionComponent?.metrics) {
            const topPlayerMetric = sectionComponent.metrics.find(m => m.label === 'Top Player Market Share');
            const emergingMetric = sectionComponent.metrics.find(m => m.label === 'Emerging Players Added');
            
            topPlayerShare = topPlayerMetric?.value || '';
            emergingPlayers = emergingMetric?.value || '';
          }
          
          // Extract news from news component
          fundingNews = newsComponent?.headlines || [];
          
          console.log('🔍 Extracted from uiComponents:');
          console.log('  - executiveSummary:', executiveSummary);
          console.log('  - topPlayerShare:', topPlayerShare);
          console.log('  - emergingPlayers:', emergingPlayers);
          console.log('  - fundingNews:', fundingNews);
        }
        
        // Update local state with extracted data
        setLocalExecutiveSummary(executiveSummary);
        setLocalTopPlayerShare(topPlayerShare);
        setLocalEmergingPlayers(emergingPlayers);
        
        // Update parent state with extracted data
        onExecutiveSummaryChange(executiveSummary);
        onTopPlayerShareChange(topPlayerShare);
        onEmergingPlayersChange(emergingPlayers);
        
        console.log('✅ CompetitorLandscapeSection: Data updated successfully');
        console.log('✅ Final extracted data:', {
          executiveSummary,
          topPlayerShare,
          emergingPlayers,
          fundingNews
        });
      } else {
        console.warn('⚠️ CompetitorLandscapeSection: No valid data in response');
        console.warn('⚠️ Response structure:', result);
      }

        setLocalLoading(false);
    } catch (error) {
      console.error('❌ CompetitorLandscapeSection: Error fetching data:', error);
        setLocalError(error instanceof Error ? error.message : 'Failed to fetch competitor landscape data');
        setLocalLoading(false);
    }
  };

  // Fetch data on component mount - DISABLED to prevent conflicts with parent
  useEffect(() => {
    console.log('🚀 Competitor Landscape Component mounted');
    console.log('🚀 Initial competitorData:', competitorData);
    
    // DISABLED: Let parent component handle all API calls to prevent conflicts
    console.log('🔄 Competitor Landscape - Relying on parent component for data fetching');
    
    // Only fetch if we have no data at all and no props
    const hasAnyData = competitorData || executiveSummary || topPlayerShare || emergingPlayers || fundingNews?.length > 0;
    if (!hasAnyData) {
      console.log('🔄 Competitor Landscape - No data available, will wait for parent refresh');
    } else {
      console.log('🔄 Competitor Landscape - Using existing data from props');
    }
  }, []);
  
  // Log when competitorData changes
  useEffect(() => {
    console.log('🔄 CompetitorLandscapeSection - competitorData changed:', competitorData);
    console.log('🔄 competitorData.timestamp:', competitorData?.timestamp);
    console.log('🔄 competitorData.executiveSummary:', competitorData?.executiveSummary);
    console.log('🔄 competitorData.topPlayerShare:', competitorData?.topPlayerShare);
    console.log('🔄 competitorData.emergingPlayers:', competitorData?.emergingPlayers);
    console.log('🔄 competitorData.uiComponents:', competitorData?.uiComponents);
    console.log('🔄 competitorData.uiComponents length:', competitorData?.uiComponents?.length);
    
    // If we have new competitorData and we're not editing, update local state immediately
    if (competitorData && !isCompetitorLandscapeEditing) {
      console.log('🔄 Updating local state with new competitorData');
      setLocalExecutiveSummary(competitorData.executiveSummary || '');
      setLocalTopPlayerShare(competitorData.topPlayerShare || '');
      setLocalEmergingPlayers(competitorData.emergingPlayers || '');
    }
  }, [competitorData, isCompetitorLandscapeEditing]);

  // Handle refresh when isRefreshing prop changes
  useEffect(() => {
    if (isRefreshing) {
      console.log('🔄 Competitor Landscape - Parent is refreshing, clearing local state');
      setLocalError(null);
      setLocalLoading(false); // Don't show loading since parent handles it
      
      // Clear local state immediately to prevent showing stale data
      setLocalExecutiveSummary('');
      setLocalTopPlayerShare('');
      setLocalEmergingPlayers('');
      
      // Don't fetch data here - parent handles all API calls
      console.log('🔄 Competitor Landscape - Parent will handle API calls, just clearing local state');
    }
  }, [isRefreshing]);


  // Listen for company profile updates (but don't fetch data - parent handles it)
  useEffect(() => {
    const handleCompanyProfileUpdate = async () => {
      console.log('🔄 Competitor Landscape - Company profile updated, clearing local state');
      setLocalError(null);
      setLocalLoading(false);
      
      // Clear local state immediately to prevent showing stale data
      setLocalExecutiveSummary('');
      setLocalTopPlayerShare('');
      setLocalEmergingPlayers('');
      
      // Don't fetch data here - parent handles all API calls
      console.log('🔄 Competitor Landscape - Parent will handle API calls after profile update');
    };

    window.addEventListener('companyProfileUpdated', handleCompanyProfileUpdate);
    
    return () => {
      window.removeEventListener('companyProfileUpdated', handleCompanyProfileUpdate);
    };
  }, []);

  // Also listen for companyProfile prop changes but don't auto-fetch to prevent loops
  useEffect(() => {
    if (companyProfile) {
      console.log('🔄 Competitor Landscape - companyProfile prop changed:', companyProfile);
      console.log('🔄 Competitor Landscape - Profile updated, but not auto-fetching to prevent loops');
      // Don't auto-fetch here to prevent infinite loops
      // The parent refresh mechanism will handle data fetching
    }
  }, [companyProfile]);

  // Sync local state with props to prevent data reversion
  useEffect(() => {
    console.log('🔄 Competitor Landscape - Props changed, syncing with local state');
    console.log('🔄 Props:', { executiveSummary, topPlayerShare, emergingPlayers });
    console.log('🔄 Local state:', { localExecutiveSummary, localTopPlayerShare, localEmergingPlayers });
    
    // Always sync with props when they change (even if empty, to clear stale data)
    if (executiveSummary !== localExecutiveSummary) {
      console.log('🔄 Competitor Landscape - Syncing executiveSummary from props:', executiveSummary);
      setLocalExecutiveSummary(executiveSummary);
    }
    if (topPlayerShare !== localTopPlayerShare) {
      console.log('🔄 Competitor Landscape - Syncing topPlayerShare from props:', topPlayerShare);
      setLocalTopPlayerShare(topPlayerShare);
    }
    if (emergingPlayers !== localEmergingPlayers) {
      console.log('🔄 Competitor Landscape - Syncing emergingPlayers from props:', emergingPlayers);
      setLocalEmergingPlayers(emergingPlayers);
    }
  }, [executiveSummary, topPlayerShare, emergingPlayers, localExecutiveSummary, localTopPlayerShare, localEmergingPlayers]);

  // Debug: Log all props received
  useEffect(() => {
    console.log('🔍 Competitor Landscape - All props received:', {
      executiveSummary,
      topPlayerShare,
      emergingPlayers,
      fundingNews: fundingNews?.length || 0,
      isRefreshing,
      companyProfile: !!companyProfile,
      competitorData: !!competitorData
    });
  }, [executiveSummary, topPlayerShare, emergingPlayers, fundingNews, isRefreshing, companyProfile, competitorData]);

  // Force sync when parent data changes (for refresh scenarios)
  useEffect(() => {
    console.log('🔄 Competitor Landscape - Parent data changed, forcing sync');
    console.log('🔄 Parent data:', { executiveSummary, topPlayerShare, emergingPlayers });
    
    // Force update local state with parent data
    setLocalExecutiveSummary(executiveSummary);
    setLocalTopPlayerShare(topPlayerShare);
    setLocalEmergingPlayers(emergingPlayers);
  }, [executiveSummary, topPlayerShare, emergingPlayers]);

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

  if (displayError) {
    return (
      <div className={`${isSplitView ? 'flex gap-6' : ''}`}>
        <div className={`bg-white rounded-lg border border-gray-200 p-6 ${isSplitView ? 'flex-1' : ''}`}>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <X className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">Error loading competitor landscape data</p>
              <p className="text-gray-600 text-sm mb-4">{displayError}</p>
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
  console.log('- emergingPlayers prop:', emergingPlayers);
  console.log('- isRefreshing:', isRefreshing);
  console.log('- isLoading:', isLoading);
  console.log('- error:', error);
  console.log('- competitorLandscapeExpanded:', competitorLandscapeExpanded);
  console.log('- isSplitView:', isSplitView);
  console.log('- localExecutiveSummary:', localExecutiveSummary);
  console.log('- localTopPlayerShare:', localTopPlayerShare);
  console.log('- localEmergingPlayers:', localEmergingPlayers);

  // Always use competitorData when available
  if (!competitorData) {
    console.log('⚠️ No competitorData found - will use fallback props');
  }

  // Debug: Show what we're about to render
  console.log('🔍 Competitor Landscape - About to render:', {
    hasLocalData: !!localExecutiveSummary,
    hasPropData: !!executiveSummary,
    hasCompetitorData: !!competitorData,
    executiveSummary,
    localExecutiveSummary,
    competitorDataExecutiveSummary: competitorData?.executiveSummary,
    competitorDataTimestamp: competitorData?.timestamp,
    isRefreshing
  });

  // Ensure we have some data to display - prioritize fresh API data (competitorData) over local state and fallback props
  const displayExecutiveSummary = competitorData?.executiveSummary || localExecutiveSummary || executiveSummary || 'No data available';
  const displayTopPlayerShare = competitorData?.topPlayerShare || localTopPlayerShare || topPlayerShare || 'No data available';
  const displayEmergingPlayers = competitorData?.emergingPlayers || localEmergingPlayers || emergingPlayers || 'No data available';

  console.log('- displayExecutiveSummary:', displayExecutiveSummary);
  console.log('- displayTopPlayerShare:', displayTopPlayerShare);
  console.log('- displayEmergingPlayers:', displayEmergingPlayers);
  console.log('- isRefreshing:', isRefreshing);
  console.log('- competitorData.timestamp:', competitorData?.timestamp);
  console.log('🔍 Data source priority check:');
  console.log('  - Using competitorData.executiveSummary:', !!competitorData?.executiveSummary);
  console.log('  - Using localExecutiveSummary:', !competitorData?.executiveSummary && !!localExecutiveSummary);
  console.log('  - Using executiveSummary prop:', !competitorData?.executiveSummary && !localExecutiveSummary && !!executiveSummary);
  
  // Debug: Show actual content of competitorData
  console.log('🔍 CompetitorData content analysis:');
  console.log('  - competitorData.executiveSummary:', competitorData?.executiveSummary);
  console.log('  - competitorData.topPlayerShare:', competitorData?.topPlayerShare);
  console.log('  - competitorData.emergingPlayers:', competitorData?.emergingPlayers);
  console.log('  - competitorData.uiComponents length:', competitorData?.uiComponents?.length);
  console.log('  - competitorData keys:', competitorData ? Object.keys(competitorData) : 'null');

  return (
    <div className={`${isSplitView ? 'flex gap-6' : ''}`}>
      {/* Debug info - remove this after testing */}
      {isRefreshing && (
        <div className="mb-4 p-2 bg-yellow-100 border border-yellow-300 rounded text-sm">
          🔄 Refreshing... Latest data: {competitorData?.timestamp || 'No timestamp'}
        </div>
      )}
      {!isRefreshing && competitorData?.timestamp && (
        <div className="mb-4 p-2 bg-green-100 border border-green-300 rounded text-sm">
          ✅ Data updated: {competitorData.timestamp} | Executive Summary: {competitorData.executiveSummary?.substring(0, 50)}...
        </div>
      )}
      {/* Debug company profile data */}
      {isRefreshing && (
        <div className="mb-4 p-2 bg-blue-100 border border-blue-300 rounded text-sm">
          🔍 Company Profile: {companyProfile ? 'Available' : 'Not available'} | 
          Industry: {companyProfile?.industry || 'Unknown'} | 
          Company Size: {companyProfile?.companySize || 'Unknown'}
        </div>
      )}
      
      {/* API Error indicator */}
      {error && (
        <div className="mb-4 p-2 bg-red-100 border border-red-300 rounded text-sm">
          ❌ API Error: {error} | 
          {error.includes('500') ? 'Backend server issue - check server status' : 'Check network connection'}
        </div>
      )}
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

            {/* Competitor Report Data */}
            {(() => {
              const reportComponent = competitorData?.uiComponents?.find(comp => comp.type === 'report');
              const dataPoints = reportComponent?.dataPoints;
              
              if (!dataPoints || dataPoints.length === 0) return null;
              
              return (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Competitor Analysis Report</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {dataPoints.map((dataPoint, index) => (
                      <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-800 mb-2">{dataPoint.label}</h4>
                        <p className="text-blue-700">{dataPoint.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

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

            {/* Market Trends */}
            {(() => {
              const trendsComponent = competitorData?.uiComponents?.find(comp => comp.type === 'marketTrends');
              const charts = trendsComponent?.charts;
              
              if (!charts || charts.length === 0) return null;
              
              return (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Trends</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {charts.map((chart, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">{chart.name}</h4>
                        <div className="text-sm text-gray-600">
                          <p>X-Axis: {Array.isArray(chart.xAxis) ? chart.xAxis.join(', ') : chart.xAxis}</p>
                        </div>
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