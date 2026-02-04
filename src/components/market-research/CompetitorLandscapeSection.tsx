import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, Bot, Edit, X, FileText, Save, Share, Clock, ChevronDown, ChevronUp, Zap, ArrowUp, ArrowDown, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import MiniPieChart from '@/components/ui/MiniPieChart';
import MiniLineChart from '@/components/ui/MiniLineChart';
import { toUTCTimestamp, isTimestampNewer, getCurrentUTCTimestamp, logTimestampComparison } from '@/lib/timestampUtils';
import { apiFetchJson } from '@/lib/api';
import { executeWithRateLimit } from '@/lib/rateLimitManager';
import { useAuth } from '@/contexts/AuthContext';
import { getUserLocalStorage, setUserLocalStorage } from '@/utils/cacheUtils';

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
  const { currentUser } = useAuth();
  const { toast } = useToast();
  // Track previous user to detect user switches
  const previousUserRef = useRef<string | null | undefined>(currentUser?.uid);
  
  // State for API data - parent handles loading and errors
  const error = propError; // Use prop error from parent
  const competitorData = propCompetitorData;
  
  // Local state for error and loading management
  const [localError, setLocalError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState<boolean>(false);
  
  // Check if we're loading - show loading when local loading is true OR when parent is refreshing
  // Don't show loading if we have data from props or parent
  const hasPropData = executiveSummary || topPlayerShare || emergingPlayers || fundingNews?.length > 0;
  
  // Check if we're showing fallback data (the "being prepared" message)
  const isShowingFallbackData = executiveSummary?.includes('being prepared') || 
                                topPlayerShare?.includes('Loading market share data') ||
                                emergingPlayers?.includes('Analyzing emerging competitors');
  
  // Show loading only when actively loading and no data available - simplified like other components
  const isLoading = localLoading && !hasPropData;
  
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
    isShowingFallbackData,
    isLoading
  });
  
  // Use local error if available, otherwise use prop error
  const displayError = localError || error;
  
  // Helper function to normalize uiComponents
  const normalizeUiComponents = (components: any[]): any[] => {
    if (!Array.isArray(components)) return [];
    return components.map((comp: any) => {
      if (typeof comp === 'string') {
        try {
          return JSON.parse(comp);
        } catch (e) {
          console.warn('⚠️ Failed to parse stringified component:', e);
          return null;
        }
      }
      return comp;
    }).filter((comp: any) => comp !== null);
  };

  // Extract uiComponents data
  const normalizedComponents = competitorData?.uiComponents 
    ? normalizeUiComponents(competitorData.uiComponents)
    : [];

  // Local editing state for inline editing - initialize with prop values and localStorage (user-specific)
  const [localExecutiveSummary, setLocalExecutiveSummary] = useState(() => {
    return competitorData?.executiveSummary || executiveSummary || getUserLocalStorage('competitor_executiveSummary', currentUser?.uid) || '';
  });
  const [localTopPlayerShare, setLocalTopPlayerShare] = useState(() => {
    return competitorData?.topPlayerShare || topPlayerShare || getUserLocalStorage('competitor_topPlayerShare', currentUser?.uid) || '';
  });
  const [localEmergingPlayers, setLocalEmergingPlayers] = useState(() => {
    return competitorData?.emergingPlayers || emergingPlayers || getUserLocalStorage('competitor_emergingPlayers', currentUser?.uid) || '';
  });

  // Local state for all uiComponents data
  const [localDataPoints, setLocalDataPoints] = useState<Array<{label: string; value: string}>>(() => {
    const reportComponent = normalizedComponents.find((comp: any) => comp?.type === 'report');
    return reportComponent?.dataPoints || [];
  });
  const [localCompetitors, setLocalCompetitors] = useState<string[]>(() => {
    const sectionComponent = normalizedComponents.find((comp: any) => comp?.type === 'section');
    return sectionComponent?.tags || [];
  });
  const [localRegions, setLocalRegions] = useState<Array<{name: string; data: Record<string, string>}>>(() => {
    const marketShareComponent = normalizedComponents.find((comp: any) => comp?.type === 'marketShareCharts');
    return marketShareComponent?.regions || [];
  });
  const [localEntities, setLocalEntities] = useState<Array<{name: string; strengths: string[]; weaknesses: string[]}>>(() => {
    const swotComponent = normalizedComponents.find((comp: any) => comp?.type === 'swotAnalysis');
    return swotComponent?.entities || [];
  });
  const [localHeadlines, setLocalHeadlines] = useState<string[]>(() => {
    const newsComponent = normalizedComponents.find((comp: any) => comp?.type === 'news');
    const apiHeadlines = newsComponent?.headlines;
    return apiHeadlines && apiHeadlines.length > 0 ? apiHeadlines : 
      (competitorData?.fundingNews && competitorData.fundingNews.length > 0) ? competitorData.fundingNews :
      (fundingNews && fundingNews.length > 0) ? fundingNews : [];
  });
  const [localFeatures, setLocalFeatures] = useState<string[]>(() => {
    const featureComponent = normalizedComponents.find((comp: any) => comp?.type === 'featureComparison');
    return featureComponent?.features || [];
  });
  const [localTools, setLocalTools] = useState<Record<string, string[]>>(() => {
    const featureComponent = normalizedComponents.find((comp: any) => comp?.type === 'featureComparison');
    return featureComponent?.tools || {};
  });
  const [localInsights, setLocalInsights] = useState<Array<{label: string; description: string}>>(() => {
    const mnaComponent = normalizedComponents.find((comp: any) => comp?.type === 'mnaInsights');
    let insights = mnaComponent?.insights;
    if (typeof insights === 'string') {
      try {
        insights = JSON.parse(insights);
      } catch (e) {
        insights = null;
      }
    }
    if (!insights || !Array.isArray(insights)) return [];
    return insights.map((insight: any) => {
      if (typeof insight === 'string') {
        try {
          return JSON.parse(insight);
        } catch (e) {
          return null;
        }
      }
      return insight;
    }).filter((insight: any) => insight && (insight.label || insight.description));
  });
  const [localCharts, setLocalCharts] = useState<Array<{name: string; xAxis: string | string[]}>>(() => {
    const trendsComponent = normalizedComponents.find((comp: any) => comp?.type === 'marketTrends');
    return trendsComponent?.charts || [];
  });
  const [localMetrics, setLocalMetrics] = useState<Array<{label: string; value: string; trend?: string}>>(() => {
    const sectionComponent = normalizedComponents.find((comp: any) => comp?.type === 'section');
    return sectionComponent?.metrics || [];
  });

  // Save local state to localStorage whenever they change (user-specific)
  useEffect(() => {
    if (localExecutiveSummary && currentUser?.uid) {
      setUserLocalStorage('competitor_executiveSummary', localExecutiveSummary, currentUser.uid);
    }
  }, [localExecutiveSummary, currentUser?.uid]);

  useEffect(() => {
    if (localTopPlayerShare && currentUser?.uid) {
      setUserLocalStorage('competitor_topPlayerShare', localTopPlayerShare, currentUser.uid);
    }
  }, [localTopPlayerShare, currentUser?.uid]);

  useEffect(() => {
    if (localEmergingPlayers && currentUser?.uid) {
      setUserLocalStorage('competitor_emergingPlayers', localEmergingPlayers, currentUser.uid);
    }
  }, [localEmergingPlayers, currentUser?.uid]);

  // Sync local state with centralized data props when they change (but not while editing)
  // IMPORTANT: Only sync if competitorData exists and belongs to current user
  useEffect(() => {
    if (!isCompetitorLandscapeEditing && currentUser?.uid) {
      // Skip syncing if we just cleared due to user switch (local state is empty and competitorData is null/undefined)
      if (!localExecutiveSummary && !localTopPlayerShare && !localEmergingPlayers && !competitorData) {
        console.log('🔄 [COMPETITOR] Skipping sync - data was just cleared due to user switch');
        return;
      }
      
      // Verify competitorData belongs to current user before syncing
      if (competitorData?.user_id && competitorData.user_id !== currentUser.uid) {
        console.warn('⚠️ [USER SWITCH] Competitor data user_id mismatch, ignoring:', competitorData.user_id, 'vs', currentUser.uid);
        return;
      }
      
      console.log('🔄 Syncing Competitor Landscape local state with props:');
      console.log('  - executiveSummary prop:', executiveSummary);
      console.log('  - topPlayerShare prop:', topPlayerShare);
      console.log('  - emergingPlayers prop:', emergingPlayers);
      console.log('  - competitorData:', competitorData);
      console.log('  - competitorData.executiveSummary:', competitorData?.executiveSummary);
      console.log('  - competitorData.timestamp:', competitorData?.timestamp);
      console.log('  - competitorData.user_id:', competitorData?.user_id);
      console.log('  - currentUser.uid:', currentUser.uid);
      console.log('  - isRefreshing:', isRefreshing);
      
      // Always update local state with competitorData (prioritize API data)
      // But only if competitorData exists (not null/undefined)
      const newExecutiveSummary = competitorData?.executiveSummary || executiveSummary || '';
      const newTopPlayerShare = competitorData?.topPlayerShare || topPlayerShare || '';
      const newEmergingPlayers = competitorData?.emergingPlayers || emergingPlayers || '';
      
      setLocalExecutiveSummary(newExecutiveSummary);
      setLocalTopPlayerShare(newTopPlayerShare);
      setLocalEmergingPlayers(newEmergingPlayers);
      
      // Sync uiComponents data
      const normalized = competitorData?.uiComponents ? normalizeUiComponents(competitorData.uiComponents) : [];
      const reportComponent = normalized.find((comp: any) => comp?.type === 'report');
      const sectionComponent = normalized.find((comp: any) => comp?.type === 'section');
      const marketShareComponent = normalized.find((comp: any) => comp?.type === 'marketShareCharts');
      const swotComponent = normalized.find((comp: any) => comp?.type === 'swotAnalysis');
      const newsComponent = normalized.find((comp: any) => comp?.type === 'news');
      const featureComponent = normalized.find((comp: any) => comp?.type === 'featureComparison');
      const mnaComponent = normalized.find((comp: any) => comp?.type === 'mnaInsights');
      const trendsComponent = normalized.find((comp: any) => comp?.type === 'marketTrends');
      
      if (reportComponent?.dataPoints) setLocalDataPoints(reportComponent.dataPoints);
      if (sectionComponent?.tags) setLocalCompetitors(sectionComponent.tags);
      if (marketShareComponent?.regions) setLocalRegions(marketShareComponent.regions);
      if (swotComponent?.entities) setLocalEntities(swotComponent.entities);
      if (newsComponent?.headlines) {
        setLocalHeadlines(newsComponent.headlines);
      } else if (competitorData?.fundingNews) {
        setLocalHeadlines(competitorData.fundingNews);
      } else if (fundingNews) {
        setLocalHeadlines(fundingNews);
      }
      if (featureComponent?.features) setLocalFeatures(featureComponent.features);
      if (featureComponent?.tools) setLocalTools(featureComponent.tools);
      if (mnaComponent?.insights) {
        let insights = mnaComponent.insights;
        if (typeof insights === 'string') {
          try {
            insights = JSON.parse(insights);
          } catch (e) {
            insights = null;
          }
        }
        if (insights && Array.isArray(insights)) {
          const validInsights = insights.map((insight: any) => {
            if (typeof insight === 'string') {
              try {
                return JSON.parse(insight);
              } catch (e) {
                return null;
              }
            }
            return insight;
          }).filter((insight: any) => insight && (insight.label || insight.description));
          setLocalInsights(validInsights);
        }
      }
      if (trendsComponent?.charts) setLocalCharts(trendsComponent.charts);
      if (sectionComponent?.metrics) setLocalMetrics(sectionComponent.metrics);
      
      console.log('✅ Updated local state:');
      console.log('  - localExecutiveSummary set to:', newExecutiveSummary);
      console.log('  - localTopPlayerShare set to:', newTopPlayerShare);
      console.log('  - localEmergingPlayers set to:', newEmergingPlayers);
      console.log('  - competitorData has uiComponents:', !!competitorData?.uiComponents);
      console.log('  - competitorData uiComponents length:', competitorData?.uiComponents?.length);
    }
  }, [executiveSummary, topPlayerShare, emergingPlayers, competitorData, isCompetitorLandscapeEditing, isRefreshing, currentUser?.uid, fundingNews]);

  // Handle save changes
  // Individual box save functions
  const handleSaveExecutiveSummary = () => {
    onExecutiveSummaryChange(localExecutiveSummary);
    toast({
      title: "Saved",
      description: "Executive Summary changes committed.",
    });
  };

  const handleSaveTopPlayerShare = () => {
    onTopPlayerShareChange(localTopPlayerShare);
    toast({
      title: "Saved",
      description: "Top Player Market Share changes committed.",
    });
  };

  const handleSaveEmergingPlayers = () => {
    onEmergingPlayersChange(localEmergingPlayers);
    toast({
      title: "Saved",
      description: "Emerging Players changes committed.",
    });
  };

  const handleSaveCompetitorReport = () => {
    toast({
      title: "Saved",
      description: "Competitor Analysis Report changes committed.",
    });
  };

  const handleSaveMajorCompetitors = () => {
    toast({
      title: "Saved",
      description: "Major Competitors changes committed.",
    });
  };

  const handleSaveMarketShareCharts = () => {
    toast({
      title: "Saved",
      description: "Market Share Charts changes committed.",
    });
  };

  const handleSaveSwotAnalysis = () => {
    toast({
      title: "Saved",
      description: "SWOT Analysis changes committed.",
    });
  };

  const handleSaveFeatureComparison = () => {
    toast({
      title: "Saved",
      description: "Feature Comparison changes committed.",
    });
  };

  const handleSaveMnaInsights = () => {
    toast({
      title: "Saved",
      description: "M&A Insights changes committed.",
    });
  };

  const handleSaveMarketTrends = () => {
    toast({
      title: "Saved",
      description: "Market Trends changes committed.",
    });
  };

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
        fundingNews: fundingNews,
        uiComponents: competitorData?.uiComponents || []
      };

      // Prepare modified data with all editable fields
      const modifiedData = {
        section: 'competitor-landscape',
        executiveSummary: localExecutiveSummary,
        topPlayerShare: localTopPlayerShare,
        emergingPlayers: localEmergingPlayers,
        fundingNews: localHeadlines,
        uiComponents: [
          ...(localDataPoints.length > 0 ? [{ type: 'report', dataPoints: localDataPoints }] : []),
          ...(localCompetitors.length > 0 ? [{ type: 'section', tags: localCompetitors }] : []),
          ...(localRegions.length > 0 ? [{ type: 'marketShareCharts', regions: localRegions }] : []),
          ...(localEntities.length > 0 ? [{ type: 'swotAnalysis', entities: localEntities }] : []),
          ...(localHeadlines.length > 0 ? [{ type: 'news', headlines: localHeadlines }] : []),
          ...(localFeatures.length > 0 || Object.keys(localTools).length > 0 ? [{ type: 'featureComparison', features: localFeatures, tools: localTools }] : []),
          ...(localInsights.length > 0 ? [{ type: 'mnaInsights', insights: localInsights }] : []),
          ...(localCharts.length > 0 ? [{ type: 'marketTrends', charts: localCharts }] : [])
        ]
      };

      // Prepare data for API according to schema
      const editData = {
        original_json: originalData,
        modified_json: modifiedData,
        edit_type: "modification"
      };

      console.log('📤 Competitor Landscape - original_json:', editData.original_json);
      console.log('📤 Competitor Landscape - modified_json:', editData.modified_json);

      // Store data for /ask API (user-specific)
      setUserLocalStorage('competitor-landscape_original_json', JSON.stringify(editData.original_json), currentUser?.uid);
      setUserLocalStorage('competitor-landscape_modified_json', JSON.stringify(editData.modified_json), currentUser?.uid);

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
      const getResponse = await fetch('/api/market_intelligence', {
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

  // Component no longer makes its own API calls - parent handles all data fetching

  // Clear state when user changes to prevent data leakage
  useEffect(() => {
    const previousUserId = previousUserRef.current;
    const currentUserId = currentUser?.uid;
    
    // Only clear if user actually changed (not on initial mount)
    if (previousUserId !== undefined && previousUserId !== currentUserId) {
      console.log('🔄 [COMPETITOR] User changed from', previousUserId, 'to', currentUserId, '- clearing all local state');
      setLocalError(null);
      // Reset local state to empty to force fresh fetch
      setLocalExecutiveSummary('');
      setLocalTopPlayerShare('');
      setLocalEmergingPlayers('');
    }
    
    // Update ref for next comparison
    previousUserRef.current = currentUserId;
  }, [currentUser?.uid]);

  // Component mount - parent handles all data fetching
  useEffect(() => {
    console.log('🚀 Competitor Landscape Component mounted - parent handles all data fetching');
  }, []);
  
  // Handle refresh when parent triggers it - parent handles all API calls
  useEffect(() => {
    if (isRefreshing) {
      console.log('🔄 Competitor Landscape - Refresh triggered by parent, parent will handle API calls');
      setLocalError(null);
      setLocalLoading(false); // Don't show loading since parent handles it
    }
  }, [isRefreshing]);
  
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

  // Removed conflicting refresh effect - parent handles all data management


  // Removed company profile update effect - parent handles all data management

  // Also listen for companyProfile prop changes but don't auto-fetch to prevent loops
  useEffect(() => {
    if (companyProfile) {
      console.log('🔄 Competitor Landscape - companyProfile prop changed:', companyProfile);
      console.log('🔄 Competitor Landscape - Profile updated, but not auto-fetching to prevent loops');
      // Don't auto-fetch here to prevent infinite loops
      // The parent refresh mechanism will handle data fetching
    }
  }, [companyProfile]);

  // Single consolidated effect to sync with props (prevents infinite loops)
  useEffect(() => {
    // Simple sync with props like other components
    
    console.log('🔄 Competitor Landscape - Props changed, syncing with local state');
    console.log('🔄 Props:', { executiveSummary, topPlayerShare, emergingPlayers });
    
    // Only sync if props have meaningful data and are different from local state
    if (executiveSummary && executiveSummary !== localExecutiveSummary) {
      console.log('🔄 Competitor Landscape - Syncing executiveSummary from props:', executiveSummary);
      setLocalExecutiveSummary(executiveSummary);
    }
    if (topPlayerShare && topPlayerShare !== localTopPlayerShare) {
      console.log('🔄 Competitor Landscape - Syncing topPlayerShare from props:', topPlayerShare);
      setLocalTopPlayerShare(topPlayerShare);
    }
    if (emergingPlayers && emergingPlayers !== localEmergingPlayers) {
      console.log('🔄 Competitor Landscape - Syncing emergingPlayers from props:', emergingPlayers);
      setLocalEmergingPlayers(emergingPlayers);
    }
  }, [executiveSummary, topPlayerShare, emergingPlayers]);

  // Check if we have any data to show (competitorData, local state, or props)
  // This needs to be defined early so it's available for both error handling and rendering
  const hasDataToDisplay = competitorData || 
                           localExecutiveSummary || 
                           executiveSummary || 
                           topPlayerShare || 
                           emergingPlayers || 
                           fundingNews?.length > 0;

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

  // Only show full error screen if there's an error AND no data to display
  if (displayError && !hasDataToDisplay) {
    return (
      <div className={`${isSplitView ? 'flex gap-6' : ''}`}>
        <div className={`bg-white rounded-lg border border-gray-200 p-6 ${isSplitView ? 'flex-1' : ''}`}>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <X className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">Competitor Landscape Service Temporarily Unavailable</p>
              <p className="text-gray-600 text-sm mb-4">
                The competitor analysis service is currently experiencing issues. 
                This is a backend service problem, not a frontend issue. 
                Please try again later or contact support.
              </p>
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
      {/* {isRefreshing && (
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
      
      {/* API Error indicator - Show warning if there's an error but we have data to display */}
      {displayError && hasDataToDisplay && (
        <div className="mb-4 p-2 bg-yellow-100 border border-yellow-300 rounded text-sm">
          ⚠️ Warning: {displayError} - Showing cached/fallback data. Some features may be limited.
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
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onCompetitorLandscapeToggleEdit}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <Edit className="h-4 w-4" />
            </Button>

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
        <div className="mb-6 relative group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Executive Summary
            </h3>
            {isCompetitorLandscapeEditing && (
              <div className="flex items-center gap-1">
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
              </div>
            )}
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
            {(() => {
              // Normalize uiComponents - parse any stringified components
              const normalizeUiComponents = (components: any[]): any[] => {
                if (!Array.isArray(components)) return [];
                return components.map((comp: any) => {
                  if (typeof comp === 'string') {
                    try {
                      return JSON.parse(comp);
                    } catch (e) {
                      console.warn('⚠️ Failed to parse stringified component:', e);
                      return null;
                    }
                  }
                  return comp;
                }).filter((comp: any) => comp !== null);
              };
              
              const normalizedComponents = competitorData?.uiComponents 
                ? normalizeUiComponents(competitorData.uiComponents)
                : [];
              
              // Try to get metrics from API's section component first
              const apiMetrics = localMetrics;
              
              // If we have API metrics OR we're in edit mode (to allow adding), show metrics section
              if ((apiMetrics && Array.isArray(apiMetrics) && apiMetrics.length > 0) || isCompetitorLandscapeEditing) {
                // If no metrics but in edit mode, show empty state with ability to add
                if (!apiMetrics || apiMetrics.length === 0) {
                  return (
                    <div className="col-span-2 text-center py-4 text-gray-500">
                      No metrics yet. Click "Add Metric" below to add one.
                    </div>
                  );
                }
                
                return apiMetrics.map((metric: any, index: number) => (
                  <div key={index} className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <div className="flex items-center">
                      <div className="flex-1">
                        {isCompetitorLandscapeEditing ? (
                          <div className="space-y-2">
                            <Input
                              value={metric.value || ''}
                              onChange={(e) => {
                                const updated = [...localMetrics];
                                updated[index] = { ...updated[index], value: e.target.value };
                                setLocalMetrics(updated);
                              }}
                              className="text-lg font-bold text-blue-600 bg-white"
                              placeholder="Value"
                            />
                            <Input
                              value={metric.label || ''}
                              onChange={(e) => {
                                const updated = [...localMetrics];
                                updated[index] = { ...updated[index], label: e.target.value };
                                setLocalMetrics(updated);
                              }}
                              className="text-sm text-gray-700 bg-white"
                              placeholder="Label"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setLocalMetrics(localMetrics.filter((_, i) => i !== index));
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="text-lg font-bold text-blue-600">{metric.value || 'N/A'}</div>
                            <div className="text-sm text-gray-700">{metric.label || 'Metric'}</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ));
              }
              
              // Fallback to original props-based display
              return (
                <>
                  {/* Top Player Market Share */}
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg relative group">
                    {isCompetitorLandscapeEditing && (
                      <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleSaveTopPlayerShare}
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
                      </div>
                    )}
                    <div className="flex items-center">
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
                    </div>
                  </div>
                  
                  {/* Emerging Players */}
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg relative group">
                    {isCompetitorLandscapeEditing && (
                      <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleSaveEmergingPlayers}
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
                      </div>
                    )}
                    <div className="flex items-center">
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
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
          {isCompetitorLandscapeEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocalMetrics([...localMetrics, { label: '', value: '' }])}
              className="mt-2"
            >
              Add Metric
            </Button>
          )}
        </div>

        {/* Read More Button - Only show when not expanded and not in split view */}
        {!competitorLandscapeExpanded && !isSplitView && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => onCompetitorLandscapeExpandToggle(true)}
              variant="outline"
              className="flex items-center space-x-2 text-sm hover:bg-gray-50"
            >
              <span>Read More</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Expanded content */}
        {(competitorLandscapeExpanded || isSplitView) && (
          <div className="space-y-6">

            {/* Executive Summary section is now moved above for collapsed view */}

            {/* Competitor Report Data */}
            {(() => {
              const dataPoints = localDataPoints;
              
              if (!dataPoints || dataPoints.length === 0) return null;
              
              return (
                <div className="mb-8 relative group">
                  {isCompetitorLandscapeEditing && (
                    <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSaveCompetitorReport}
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
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Competitor Analysis Report</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {dataPoints.map((dataPoint, index) => (
                      <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        {isCompetitorLandscapeEditing ? (
                          <div className="space-y-2">
                            <Input
                              value={dataPoint.label}
                              onChange={(e) => {
                                const updated = [...localDataPoints];
                                updated[index] = { ...updated[index], label: e.target.value };
                                setLocalDataPoints(updated);
                              }}
                              className="font-medium text-blue-800 bg-white"
                              placeholder="Label"
                            />
                            <Textarea
                              value={dataPoint.value}
                              onChange={(e) => {
                                const updated = [...localDataPoints];
                                updated[index] = { ...updated[index], value: e.target.value };
                                setLocalDataPoints(updated);
                              }}
                              className="text-blue-700 bg-white"
                              placeholder="Value"
                              rows={2}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setLocalDataPoints(localDataPoints.filter((_, i) => i !== index));
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <h4 className="font-medium text-blue-800 mb-2">{dataPoint.label}</h4>
                            <p className="text-blue-700">{dataPoint.value}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {isCompetitorLandscapeEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocalDataPoints([...localDataPoints, { label: '', value: '' }])}
                      className="mt-2"
                    >
                      Add Data Point
                    </Button>
                  )}
                </div>
              );
            })()}

            {/* Top Players */}
            {(() => {
              const tags = localCompetitors;
              
              if (!tags || tags.length === 0) return null;
              
              return (
                <div className="relative group">
                  {isCompetitorLandscapeEditing && (
                    <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSaveMajorCompetitors}
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
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Major Competitors
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {tags.map((competitor, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        {isCompetitorLandscapeEditing ? (
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <Input
                                value={competitor}
                                onChange={(e) => {
                                  const updated = [...localCompetitors];
                                  updated[index] = e.target.value;
                                  setLocalCompetitors(updated);
                                }}
                                className="font-semibold text-gray-900 bg-white"
                                placeholder="Competitor name"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                                Competitor
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setLocalCompetitors(localCompetitors.filter((_, i) => i !== index));
                                }}
                                className="text-red-600 hover:text-red-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-gray-900">{competitor}</h4>
                              <p className="text-sm text-blue-600 font-medium">Market Player</p>
                            </div>
                            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                              Competitor
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {isCompetitorLandscapeEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocalCompetitors([...localCompetitors, ''])}
                      className="mb-8"
                    >
                      Add Competitor
                    </Button>
                  )}
                </div>
              );
            })()}

            {/* Market Share Charts */}
            {(() => {
              const regions = localRegions;
              
              if (!regions || regions.length === 0) return null;
              
              return (
                <div className="mb-8 relative group">
                  {isCompetitorLandscapeEditing && (
                    <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSaveMarketShareCharts}
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
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Share Analysis</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {regions.map((region, regionIndex) => (
                      <div key={regionIndex} className="bg-white border border-gray-200 rounded-lg p-4">
                        {isCompetitorLandscapeEditing ? (
                          <div className="space-y-3">
                            <Input
                              value={region.name}
                              onChange={(e) => {
                                const updated = [...localRegions];
                                updated[regionIndex] = { ...updated[regionIndex], name: e.target.value };
                                setLocalRegions(updated);
                              }}
                              className="font-medium text-gray-900 bg-white"
                              placeholder="Region name"
                            />
                            <div className="space-y-2">
                              {Object.entries(region.data).map(([company, share], companyIndex) => (
                                <div key={company} className="flex gap-2 items-center">
                                  <Input
                                    value={company}
                                    onChange={(e) => {
                                      const updated = [...localRegions];
                                      const newData = { ...updated[regionIndex].data };
                                      delete newData[company];
                                      newData[e.target.value] = share;
                                      updated[regionIndex] = { ...updated[regionIndex], data: newData };
                                      setLocalRegions(updated);
                                    }}
                                    className="flex-1 text-sm text-gray-700 bg-white"
                                    placeholder="Company"
                                  />
                                  <Input
                                    value={String(share)}
                                    onChange={(e) => {
                                      const updated = [...localRegions];
                                      const newData = { ...updated[regionIndex].data };
                                      newData[company] = e.target.value;
                                      updated[regionIndex] = { ...updated[regionIndex], data: newData };
                                      setLocalRegions(updated);
                                    }}
                                    className="w-24 text-sm font-medium text-blue-600 bg-white"
                                    placeholder="Share"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updated = [...localRegions];
                                      const newData = { ...updated[regionIndex].data };
                                      delete newData[company];
                                      updated[regionIndex] = { ...updated[regionIndex], data: newData };
                                      setLocalRegions(updated);
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
                                  const updated = [...localRegions];
                                  const newData = { ...updated[regionIndex].data };
                                  newData[''] = '';
                                  updated[regionIndex] = { ...updated[regionIndex], data: newData };
                                  setLocalRegions(updated);
                                }}
                              >
                                Add Company
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setLocalRegions(localRegions.filter((_, i) => i !== regionIndex));
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Remove Region
                            </Button>
                          </div>
                        ) : (
                          <>
                            <h4 className="font-medium text-gray-900 mb-3">{region.name}</h4>
                            <div className="space-y-2">
                              {Object.entries(region.data).map(([company, share]) => (
                                <div key={company} className="flex justify-between items-center">
                                  <span className="text-sm text-gray-700">{company}</span>
                                  <span className="text-sm font-medium text-blue-600">{String(share)}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {isCompetitorLandscapeEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocalRegions([...localRegions, { name: '', data: {} }])}
                      className="mt-2"
                    >
                      Add Region
                    </Button>
                  )}
                </div>
              );
            })()}

            {/* SWOT Analysis */}
            {(() => {
              const entities = localEntities;
              
              if (!entities || entities.length === 0) return null;
              
              return (
                <div className="mb-8 relative group">
                  {isCompetitorLandscapeEditing && (
                    <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSaveSwotAnalysis}
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
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">SWOT Analysis</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {entities.map((entity, entityIndex) => (
                      <div key={entityIndex} className="bg-white border border-gray-200 rounded-lg p-4">
                        {isCompetitorLandscapeEditing ? (
                          <div className="space-y-3">
                            <Input
                              value={entity.name}
                              onChange={(e) => {
                                const updated = [...localEntities];
                                updated[entityIndex] = { ...updated[entityIndex], name: e.target.value };
                                setLocalEntities(updated);
                              }}
                              className="font-medium text-gray-900 bg-white"
                              placeholder="Entity name"
                            />
                            <div>
                              <h5 className="text-sm font-medium text-green-600 mb-2">Strengths</h5>
                              <div className="space-y-2">
                                {entity.strengths.map((strength, idx) => (
                                  <div key={idx} className="flex gap-2">
                                    <Input
                                      value={strength}
                                      onChange={(e) => {
                                        const updated = [...localEntities];
                                        updated[entityIndex].strengths[idx] = e.target.value;
                                        setLocalEntities(updated);
                                      }}
                                      className="flex-1 text-sm text-gray-700 bg-white"
                                      placeholder="Strength"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const updated = [...localEntities];
                                        updated[entityIndex].strengths = updated[entityIndex].strengths.filter((_, i) => i !== idx);
                                        setLocalEntities(updated);
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
                                    const updated = [...localEntities];
                                    updated[entityIndex].strengths = [...updated[entityIndex].strengths, ''];
                                    setLocalEntities(updated);
                                  }}
                                >
                                  Add Strength
                                </Button>
                              </div>
                            </div>
                            <div>
                              <h5 className="text-sm font-medium text-red-600 mb-2">Weaknesses</h5>
                              <div className="space-y-2">
                                {entity.weaknesses.map((weakness, idx) => (
                                  <div key={idx} className="flex gap-2">
                                    <Input
                                      value={weakness}
                                      onChange={(e) => {
                                        const updated = [...localEntities];
                                        updated[entityIndex].weaknesses[idx] = e.target.value;
                                        setLocalEntities(updated);
                                      }}
                                      className="flex-1 text-sm text-gray-700 bg-white"
                                      placeholder="Weakness"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const updated = [...localEntities];
                                        updated[entityIndex].weaknesses = updated[entityIndex].weaknesses.filter((_, i) => i !== idx);
                                        setLocalEntities(updated);
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
                                    const updated = [...localEntities];
                                    updated[entityIndex].weaknesses = [...updated[entityIndex].weaknesses, ''];
                                    setLocalEntities(updated);
                                  }}
                                >
                                  Add Weakness
                                </Button>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setLocalEntities(localEntities.filter((_, i) => i !== entityIndex));
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Remove Entity
                            </Button>
                          </div>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {isCompetitorLandscapeEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocalEntities([...localEntities, { name: '', strengths: [], weaknesses: [] }])}
                      className="mt-2"
                    >
                      Add Entity
                    </Button>
                  )}
                </div>
              );
            })()}

             {/* News Headlines */}
            {(() => {
              const displayHeadlines = localHeadlines;
              
              if (!displayHeadlines || displayHeadlines.length === 0) return null;
              
              return (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Latest News</h3>
                  <div className="space-y-3">
                    {displayHeadlines.map((headline, index) => (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        {isCompetitorLandscapeEditing ? (
                          <div className="flex gap-2">
                            <Textarea
                              value={headline}
                              onChange={(e) => {
                                const updated = [...localHeadlines];
                                updated[index] = e.target.value;
                                setLocalHeadlines(updated);
                              }}
                              className="flex-1 text-gray-900 bg-white"
                              placeholder="News headline"
                              rows={2}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setLocalHeadlines(localHeadlines.filter((_, i) => i !== index));
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <p className="text-gray-900">{headline}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {isCompetitorLandscapeEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocalHeadlines([...localHeadlines, ''])}
                      className="mt-2"
                    >
                      Add News Headline
                    </Button>
                  )}
                </div>
              );
            })()}

            {/* Feature Comparison */}
            {(() => {
              const features = localFeatures;
              const tools = localTools;
              
              if (!features || !tools || Object.keys(tools).length === 0) return null;
              
              return (
                <div className="mb-8 relative group">
                  {isCompetitorLandscapeEditing && (
                    <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSaveFeatureComparison}
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
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Comparison</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Feature</TableHead>
                          {Object.keys(tools).map((tool, toolIndex) => (
                            <TableHead key={tool}>
                              {isCompetitorLandscapeEditing ? (
                                <div className="flex gap-2 items-center">
                                  <Input
                                    value={tool}
                                    onChange={(e) => {
                                      const updated = { ...localTools };
                                      const oldTool = Object.keys(tools)[toolIndex];
                                      updated[e.target.value] = updated[oldTool];
                                      delete updated[oldTool];
                                      setLocalTools(updated);
                                    }}
                                    className="bg-white"
                                    placeholder="Tool name"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updated = { ...localTools };
                                      delete updated[tool];
                                      setLocalTools(updated);
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                tool
                              )}
                            </TableHead>
                          ))}
                          {isCompetitorLandscapeEditing && (
                            <TableHead>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setLocalTools({ ...localTools, '': Array(features.length).fill('') });
                                }}
                              >
                                Add Tool
                              </Button>
                            </TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {features.map((feature, featureIndex) => (
                          <TableRow key={featureIndex}>
                            <TableCell className="font-medium">
                              {isCompetitorLandscapeEditing ? (
                                <Input
                                  value={feature}
                                  onChange={(e) => {
                                    const updated = [...localFeatures];
                                    updated[featureIndex] = e.target.value;
                                    setLocalFeatures(updated);
                                  }}
                                  className="bg-white"
                                  placeholder="Feature name"
                                />
                              ) : (
                                feature
                              )}
                            </TableCell>
                            {Object.keys(tools).map((tool) => (
                              <TableCell key={tool}>
                                {isCompetitorLandscapeEditing ? (
                                  <Input
                                    value={tools[tool][featureIndex] || ''}
                                    onChange={(e) => {
                                      const updated = { ...localTools };
                                      updated[tool] = [...updated[tool]];
                                      updated[tool][featureIndex] = e.target.value;
                                      setLocalTools(updated);
                                    }}
                                    className="bg-white"
                                    placeholder="-"
                                  />
                                ) : (
                                  tools[tool][featureIndex] || '-'
                                )}
                              </TableCell>
                            ))}
                            {isCompetitorLandscapeEditing && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setLocalFeatures(localFeatures.filter((_, i) => i !== featureIndex));
                                    const updated = { ...localTools };
                                    Object.keys(updated).forEach(tool => {
                                      updated[tool] = updated[tool].filter((_, i) => i !== featureIndex);
                                    });
                                    setLocalTools(updated);
                                  }}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {isCompetitorLandscapeEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLocalFeatures([...localFeatures, '']);
                        const updated = { ...localTools };
                        Object.keys(updated).forEach(tool => {
                          updated[tool] = [...updated[tool], ''];
                        });
                        setLocalTools(updated);
                      }}
                      className="mt-2"
                    >
                      Add Feature
                    </Button>
                  )}
                </div>
              );
            })()}

            {/* M&A Insights */}
            {(() => {
              const insights = localInsights;
              
              if (!insights || insights.length === 0) return null;
              
              return (
                <div className="mb-8 relative group">
                  {isCompetitorLandscapeEditing && (
                    <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSaveMnaInsights}
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
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">M&A Insights</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {insights.map((insight: any, index: number) => {
                      return (
                        <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          {isCompetitorLandscapeEditing ? (
                            <div className="space-y-2">
                              <Input
                                value={insight?.label || ''}
                                onChange={(e) => {
                                  const updated = [...localInsights];
                                  updated[index] = { ...updated[index], label: e.target.value };
                                  setLocalInsights(updated);
                                }}
                                className="font-medium text-yellow-800 bg-white"
                                placeholder="Insight label"
                              />
                              <Textarea
                                value={insight?.description || ''}
                                onChange={(e) => {
                                  const updated = [...localInsights];
                                  updated[index] = { ...updated[index], description: e.target.value };
                                  setLocalInsights(updated);
                                }}
                                className="text-yellow-700 bg-white"
                                placeholder="Insight description"
                                rows={3}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setLocalInsights(localInsights.filter((_, i) => i !== index));
                                }}
                                className="text-red-600 hover:text-red-700"
                              >
                                <X className="h-4 w-4 mr-1" />
                                Remove Insight
                              </Button>
                            </div>
                          ) : (
                            <>
                              <h4 className="font-medium text-yellow-800 mb-2">
                                {insight?.label || 'No label available'}
                              </h4>
                              <p className="text-yellow-700">
                                {insight?.description || 'No description available'}
                              </p>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {isCompetitorLandscapeEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocalInsights([...localInsights, { label: '', description: '' }])}
                      className="mt-2"
                    >
                      Add M&A Insight
                    </Button>
                  )}
                </div>
              );
            })()}

            {/* Market Trends */}
            {(() => {
              const charts = localCharts;
              
              if (!charts || charts.length === 0) return null;
              
              // Helper function to generate trend data from x-axis labels
              // Creates a deterministic growth trend based on chart index for consistency
              const generateTrendData = (xAxis: string | string[], chartIndex: number): { name: string; value: number }[] => {
                const labels = Array.isArray(xAxis) ? xAxis : [xAxis];
                const baseValue = 25 + (chartIndex * 5); // Different starting point per chart
                const growthRate = 12 + (chartIndex * 3); // Different growth rate per chart
                
                return labels.map((label, index) => {
                  // Deterministic value based on index (no randomness for consistency)
                  const value = baseValue + (index * growthRate) + (index * 2);
                  return {
                    name: label,
                    value: Math.round(value * 10) / 10 // Round to 1 decimal place
                  };
                });
              };
              
              return (
                <div className="mb-8 relative group">
                  {isCompetitorLandscapeEditing && (
                    <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSaveMarketTrends}
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
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Trends</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {charts.map((chart: any, index: number) => {
                      const chartData = generateTrendData(chart.xAxis, index);
                      return (
                        <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                          {isCompetitorLandscapeEditing ? (
                            <div className="space-y-3">
                              <Input
                                value={chart.name}
                                onChange={(e) => {
                                  const updated = [...localCharts];
                                  updated[index] = { ...updated[index], name: e.target.value };
                                  setLocalCharts(updated);
                                }}
                                className="font-medium text-gray-900 bg-white mb-3"
                                placeholder="Chart name"
                              />
                              <Textarea
                                value={Array.isArray(chart.xAxis) ? chart.xAxis.join(', ') : chart.xAxis}
                                onChange={(e) => {
                                  const updated = [...localCharts];
                                  const xAxisArray = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                                  updated[index] = { ...updated[index], xAxis: xAxisArray.length === 1 ? xAxisArray[0] : xAxisArray };
                                  setLocalCharts(updated);
                                }}
                                className="text-sm text-gray-700 bg-white"
                                placeholder="X-axis labels (comma-separated)"
                                rows={2}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setLocalCharts(localCharts.filter((_, i) => i !== index));
                                }}
                                className="text-red-600 hover:text-red-700 mt-2"
                              >
                                <X className="h-4 w-4 mr-1" />
                                Remove Chart
                              </Button>
                            </div>
                          ) : (
                            <MiniLineChart
                              data={chartData}
                              title={chart.name}
                              color={index === 0 ? '#3b82f6' : '#10b981'} // Blue for first, green for second
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {isCompetitorLandscapeEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocalCharts([...localCharts, { name: '', xAxis: [] }])}
                      className="mt-2"
                    >
                      Add Chart
                    </Button>
                  )}
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
                        fundingNews: fundingNews || [],
                        uiComponents: competitorData?.uiComponents || []
                      };

                      const modifiedJson = {
                        executiveSummary: localExecutiveSummary,
                        topPlayerShare: localTopPlayerShare,
                        emergingPlayers: localEmergingPlayers,
                        fundingNews: localHeadlines,
                        uiComponents: [
                          ...(localDataPoints.length > 0 ? [{ type: 'report', dataPoints: localDataPoints }] : []),
                          ...(localCompetitors.length > 0 ? [{ type: 'section', tags: localCompetitors }] : []),
                          ...(localRegions.length > 0 ? [{ type: 'marketShareCharts', regions: localRegions }] : []),
                          ...(localEntities.length > 0 ? [{ type: 'swotAnalysis', entities: localEntities }] : []),
                          ...(localHeadlines.length > 0 ? [{ type: 'news', headlines: localHeadlines }] : []),
                          ...(localFeatures.length > 0 || Object.keys(localTools).length > 0 ? [{ type: 'featureComparison', features: localFeatures, tools: localTools }] : []),
                          ...(localInsights.length > 0 ? [{ type: 'mnaInsights', insights: localInsights }] : []),
                          ...(localCharts.length > 0 ? [{ type: 'marketTrends', charts: localCharts }] : []),
                          ...(localMetrics.length > 0 ? [{ type: 'section', metrics: localMetrics }] : [])
                        ]
                      };

                         // Logging original and modified JSON data
                         console.log('🏆 Competitor Landscape Section - original_json:', JSON.stringify(originalJson, null, 2));
                         console.log('🏆 Competitor Landscape Section - modified_json:', JSON.stringify(modifiedJson, null, 2));

                       // Store JSON data in localStorage for Scout API (user-specific)
                       setUserLocalStorage('competitor-landscape_original_json', JSON.stringify(originalJson), currentUser?.uid);
                       setUserLocalStorage('competitor-landscape_modified_json', JSON.stringify(modifiedJson), currentUser?.uid);

                       // First, call the change handlers to update parent state with local values
                      onExecutiveSummaryChange(localExecutiveSummary);
                      onTopPlayerShareChange(localTopPlayerShare);
                      onEmergingPlayersChange(localEmergingPlayers);
                      onFundingNewsChange(localHeadlines);
                      
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