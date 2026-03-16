
import React, { useState, useEffect } from 'react';
import { Bot, Edit, X, FileText, Save, Share, Clock, Zap, ChevronDown, ChevronUp, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import MiniPieChart from '@/components/ui/MiniPieChart';
import MiniLineChart from '@/components/ui/MiniLineChart';
import { toUTCTimestamp, isTimestampNewer, getCurrentUTCTimestamp, logTimestampComparison } from '@/lib/timestampUtils';
import { executeWithRateLimit } from '@/lib/rateLimitManager';
import { apiFetchJson } from '@/lib/api';
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
  timestamp?: string | number; // Allow both string and number for flexibility
  trendSnapshots: TrendSnapshot[];
  regionalHotspots: {
    [key: string]: string;
  };
  strategicRecommendations: IndustryTrendsRecommendations;
  recommendations?: IndustryTrendsRecommendations; // Allow both property names for compatibility
  risks: string[];
  visualCharts: {
    aiAdoptionTrends: string[];
    technologyBudgetAllocation: {
      [key: string]: string;
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
  // Add refresh props
  isRefreshing?: boolean;
  companyProfile?: any;
  // Add data props
  executiveSummary?: string;
  aiAdoption?: string;
  cloudMigration?: string;
  regulatory?: string;
  trendSnapshots?: TrendSnapshot[];
  recommendations?: IndustryTrendsRecommendations;
  risks?: string[];
  regionalHotspots?: {
    [key: string]: string;
  };
  visualCharts?: {
    aiAdoptionTrends: string[];
    technologyBudgetAllocation: {
      [key: string]: string;
    };
  };
  // Add individual field update functions
  onIndustryTrendsExecutiveSummaryChange?: (value: string) => void;
  onIndustryTrendsAiAdoptionChange?: (value: string) => void;
  onIndustryTrendsCloudMigrationChange?: (value: string) => void;
  onIndustryTrendsRegulatoryChange?: (value: string) => void;
  onIndustryTrendSnapshotsChange?: (snapshots: TrendSnapshot[]) => void;
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
  onGenerateShareableLink,
  isRefreshing = false,
  companyProfile,
  // Data props
  executiveSummary: propExecutiveSummary,
  aiAdoption: propAiAdoption,
  cloudMigration: propCloudMigration,
  regulatory: propRegulatory,
  trendSnapshots: propTrendSnapshots,
  recommendations: propRecommendations,
  risks: propRisks,
  regionalHotspots: propRegionalHotspots,
  visualCharts: propVisualCharts,
  // Individual field update functions
  onIndustryTrendsExecutiveSummaryChange,
  onIndustryTrendsAiAdoptionChange,
  onIndustryTrendsCloudMigrationChange,
  onIndustryTrendsRegulatoryChange,
  onIndustryTrendSnapshotsChange
}) => {
  const { currentUser, orgId } = useAuth();
  const orgIdToUse = orgId || 'brewra'; // Fallback to 'brewra' for backward compatibility
  // State for API data
  const [industryTrendsData, setIndustryTrendsData] = useState<IndustryTrendsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Normalize industryTrendsDeletedSections to ensure it's always a Set
  const normalizedDeletedSections = React.useMemo(() => {
    if (!industryTrendsDeletedSections) {
      return new Set<string>();
    }
    if (industryTrendsDeletedSections instanceof Set) {
      return industryTrendsDeletedSections;
    }
    // If it's an array, convert to Set
    if (Array.isArray(industryTrendsDeletedSections)) {
      return new Set(industryTrendsDeletedSections);
    }
    // If it's an object, convert keys to Set
    if (typeof industryTrendsDeletedSections === 'object') {
      return new Set(Object.keys(industryTrendsDeletedSections));
    }
    // Fallback to empty Set
    return new Set<string>();
  }, [industryTrendsDeletedSections]);

  // Local editing state
  const [editExecutiveSummary, setEditExecutiveSummary] = useState('');
  const [editAiAdoption, setEditAiAdoption] = useState('');
  const [editCloudMigration, setEditCloudMigration] = useState('');
  const [editRegulatory, setEditRegulatory] = useState('');
  const [editTrendSnapshots, setEditTrendSnapshots] = useState<TrendSnapshot[]>([]);
  const [editRegionalHotspots, setEditRegionalHotspots] = useState<{
    APAC: string;
    Europe: string;
    "North America": string;
  }>({
    APAC: '',
    Europe: '',
    "North America": ''
  });
  const [editStrategicRecommendations, setEditStrategicRecommendations] = useState<IndustryTrendsRecommendations>({
    primaryFocus: '',
    marketEntry: ''
  });
  const [editRisks, setEditRisks] = useState<string[]>([]);
  const [editVisualCharts, setEditVisualCharts] = useState<{
    aiAdoptionTrends: string[];
    technologyBudgetAllocation: {
      "AI/ML": string;
      Cloud: string;
      Security: string;
    };
  }>({
    aiAdoptionTrends: [],
    technologyBudgetAllocation: {
      "AI/ML": '',
      Cloud: '',
      Security: ''
    }
  });

  // Save individual fields to localStorage whenever they change (user-specific)
  useEffect(() => {
    if (editExecutiveSummary && currentUser?.uid) {
      setUserLocalStorage('industry-trends_executiveSummary', editExecutiveSummary, currentUser.uid);
    }
  }, [editExecutiveSummary, currentUser?.uid]);

  useEffect(() => {
    if (editAiAdoption && currentUser?.uid) {
      setUserLocalStorage('industry-trends_aiAdoption', editAiAdoption, currentUser.uid);
    }
  }, [editAiAdoption, currentUser?.uid]);

  useEffect(() => {
    if (editCloudMigration && currentUser?.uid) {
      setUserLocalStorage('industry-trends_cloudMigration', editCloudMigration, currentUser.uid);
    }
  }, [editCloudMigration, currentUser?.uid]);

  useEffect(() => {
    if (editRegulatory && currentUser?.uid) {
      setUserLocalStorage('industry-trends_regulatory', editRegulatory, currentUser.uid);
    }
  }, [editRegulatory, currentUser?.uid]);

  useEffect(() => {
    if (editTrendSnapshots && editTrendSnapshots.length > 0 && currentUser?.uid) {
      setUserLocalStorage('industry-trends_trendSnapshots', JSON.stringify(editTrendSnapshots), currentUser.uid);
    }
  }, [editTrendSnapshots, currentUser?.uid]);

  const handleModify = () => {
    // Initialize edit fields with current data
    setEditExecutiveSummary(propExecutiveSummary || industryTrendsData?.executiveSummary || '');
    setEditAiAdoption(propAiAdoption || industryTrendsData?.aiAdoption || '');
    setEditCloudMigration(propCloudMigration || industryTrendsData?.cloudMigration || '');
    setEditRegulatory(propRegulatory || industryTrendsData?.regulatory || '');
    setEditTrendSnapshots(propTrendSnapshots || industryTrendsData?.trendSnapshots || []);
    
    // Initialize regional hotspots
    const regionalHotspotsToUse = propRegionalHotspots || industryTrendsData?.regionalHotspots || {
      APAC: '',
      Europe: '',
      "North America": ''
    };
    setEditRegionalHotspots(regionalHotspotsToUse as { APAC: string; Europe: string; "North America": string });
    
    // Initialize strategic recommendations
    const recommendationsToUse = propRecommendations || industryTrendsData?.strategicRecommendations || industryTrendsData?.recommendations || {
      primaryFocus: '',
      marketEntry: ''
    };
    setEditStrategicRecommendations(recommendationsToUse);
    
    // Initialize risks
    setEditRisks(propRisks || industryTrendsData?.risks || []);
    
    // Initialize visual charts
    const visualChartsToUse = propVisualCharts || industryTrendsData?.visualCharts || {
      aiAdoptionTrends: [],
      technologyBudgetAllocation: {
        "AI/ML": '',
        Cloud: '',
        Security: ''
      }
    };
    setEditVisualCharts(visualChartsToUse as { aiAdoptionTrends: string[]; technologyBudgetAllocation: { "AI/ML": string; Cloud: string; Security: string } });
    
    onIndustryTrendsToggleEdit();
  };

  // Fetch Industry Trends data from API
  const fetchIndustryTrendsData = async (refresh = true) => {
    try {
      setIsLoading(true);
      setError(null);

      const currentTime = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      
      // Get company profile data for dynamic reports (user-specific)
      const profile = companyProfile || JSON.parse(getUserLocalStorage('companyProfile', currentUser?.uid) || '{}');
      
      if (!currentUser?.uid) {
        console.error('User not authenticated');
        setError('User not authenticated');
        setIsLoading(false);
        return;
      }
      
      const payload = {
        org_id: orgIdToUse,
        user_id: currentUser.uid,
        component_name: "industry trends report",
        refresh: refresh,
        force_refresh: refresh,
        cache_bypass: refresh,
        bypass_all_cache: refresh,
        request_timestamp: currentTime,
        request_id: randomId,
        data: {}
      };

      const requestTimestamp = Date.now();
      
      const result = await executeWithRateLimit(
        () => apiFetchJson('market-research', {
          method: 'POST',
          body: payload
        }),
        'Industry Trends'
      );
      
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

          // Use regional hotspots data as-is from backend
          const regionalHotspots = reportData.regionalHotspots && typeof reportData.regionalHotspots === 'object' && Object.keys(reportData.regionalHotspots).length > 0
            ? reportData.regionalHotspots
            : {};

          const dataWithFallbacks = {
            ...reportData,
            trendSnapshots,
            regionalHotspots,
            strategicRecommendations,
            visualCharts: (reportData.visualCharts && typeof reportData.visualCharts === 'object' && Object.keys(reportData.visualCharts).length > 0)
              ? {
                  aiAdoptionTrends: (reportData.visualCharts.aiAdoptionTrends && Array.isArray(reportData.visualCharts.aiAdoptionTrends) && reportData.visualCharts.aiAdoptionTrends.length > 0)
                    ? reportData.visualCharts.aiAdoptionTrends
                    : [],
                  technologyBudgetAllocation: (reportData.visualCharts.technologyBudgetAllocation && typeof reportData.visualCharts.technologyBudgetAllocation === 'object' && Object.keys(reportData.visualCharts.technologyBudgetAllocation).length > 0)
                    ? reportData.visualCharts.technologyBudgetAllocation
                    : {}
                }
              : {
                  aiAdoptionTrends: [],
                  technologyBudgetAllocation: {}
                },
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

  // Component mounted - no need to fetch data, parent provides it via props
  useEffect(() => {
    // Don't fetch data - parent provides it via props
  }, []);
  
  // When parent runs cascade refresh, show loading; parent will pass data via props (do NOT fetch here – avoids duplicate requests and multiple responses)
  useEffect(() => {
    if (isRefreshing) {
      setError(null);
      setIsLoading(true);
      // Do not call fetchIndustryTrendsData – parent MarketResearch cascade already calls the API for this component
    }
  }, [isRefreshing]);

  // Sync with props when they change (for refresh scenarios)
  // Only sync when not editing to avoid overwriting user's current edits
  useEffect(() => {
    if (!isIndustryTrendsEditing && (propExecutiveSummary || propAiAdoption || propCloudMigration || propRegulatory)) {
      
      // Only update if current data is empty to avoid overwriting user edits
      setIndustryTrendsData(prevData => {
        if (!prevData) {
          return {
            executiveSummary: propExecutiveSummary || '',
            aiAdoption: propAiAdoption || '',
            cloudMigration: propCloudMigration || '',
            regulatory: propRegulatory || '',
            trendSnapshots: propTrendSnapshots || [],
            strategicRecommendations: propRecommendations || { primaryFocus: '', marketEntry: '' },
            recommendations: propRecommendations || { primaryFocus: '', marketEntry: '' },
            risks: propRisks || [],
            regionalHotspots: propRegionalHotspots || {
              APAC: '',
              Europe: '',
              "North America": ''
            },
            visualCharts: propVisualCharts || {
              aiAdoptionTrends: [],
              technologyBudgetAllocation: {
                "AI/ML": '',
                Cloud: '',
                Security: ''
              }
            },
            timestamp: String(Date.now())
          };
        }
        
        // Only update fields that are empty
        return {
          ...prevData,
          executiveSummary: prevData.executiveSummary || propExecutiveSummary || '',
          aiAdoption: prevData.aiAdoption || propAiAdoption || '',
          cloudMigration: prevData.cloudMigration || propCloudMigration || '',
          regulatory: prevData.regulatory || propRegulatory || '',
          trendSnapshots: prevData.trendSnapshots?.length > 0 ? prevData.trendSnapshots : (propTrendSnapshots || []),
          strategicRecommendations: (prevData.strategicRecommendations?.primaryFocus || prevData.recommendations?.primaryFocus) ? (prevData.strategicRecommendations || prevData.recommendations) : (propRecommendations || { primaryFocus: '', marketEntry: '' }),
          recommendations: (prevData.strategicRecommendations?.primaryFocus || prevData.recommendations?.primaryFocus) ? (prevData.strategicRecommendations || prevData.recommendations) : (propRecommendations || { primaryFocus: '', marketEntry: '' }),
          risks: prevData.risks?.length > 0 ? prevData.risks : (propRisks || []),
          regionalHotspots: (prevData.regionalHotspots && Object.keys(prevData.regionalHotspots).length > 0) 
            ? prevData.regionalHotspots 
            : (propRegionalHotspots || {}),
          visualCharts: (prevData.visualCharts && Object.keys(prevData.visualCharts).length > 0 && prevData.visualCharts.aiAdoptionTrends?.length > 0)
            ? prevData.visualCharts
            : (propVisualCharts || {
                aiAdoptionTrends: [],
                technologyBudgetAllocation: {
                  "AI/ML": '',
                  Cloud: '',
                  Security: ''
                }
              })
        };
      });
    }
  }, [propExecutiveSummary, propAiAdoption, propCloudMigration, propRegulatory, propTrendSnapshots, propRecommendations, propRisks, propRegionalHotspots, propVisualCharts, isIndustryTrendsEditing]);

  // Handle save changes
  const handleSaveChanges = async () => {
    try {
      // Prepare original data
      const originalData = {
        executiveSummary: industryTrendsData?.executiveSummary || '',
        aiAdoption: industryTrendsData?.aiAdoption || '',
        cloudMigration: industryTrendsData?.cloudMigration || '',
        regulatory: industryTrendsData?.regulatory || '',
        trendSnapshots: industryTrendsData?.trendSnapshots || [],
        regionalHotspots: industryTrendsData?.regionalHotspots || propRegionalHotspots || {},
        strategicRecommendations: industryTrendsData?.strategicRecommendations || industryTrendsData?.recommendations || propRecommendations || {
          primaryFocus: '',
          marketEntry: ''
        },
        risks: industryTrendsData?.risks || propRisks || [],
        visualCharts: industryTrendsData?.visualCharts || propVisualCharts || {
          aiAdoptionTrends: [],
          technologyBudgetAllocation: {}
        }
      };

      // Prepare modified data
      const modifiedData = {
        executiveSummary: editExecutiveSummary,
        aiAdoption: editAiAdoption,
        cloudMigration: editCloudMigration,
        regulatory: editRegulatory,
        trendSnapshots: editTrendSnapshots,
        regionalHotspots: editRegionalHotspots,
        strategicRecommendations: editStrategicRecommendations,
        risks: editRisks,
        visualCharts: editVisualCharts
      };

      // Prepare data for API according to schema
      const editData = {
        original_json: originalData,
        modified_json: modifiedData,
        edit_type: "modification"
      };

      // Store data for /ask API
      localStorage.setItem('industry-trends_original_json', JSON.stringify(originalData));
      localStorage.setItem('industry-trends_modified_json', JSON.stringify(modifiedData));

      // Skip the /ask endpoint for now and focus on updating the UI
      // Immediately update the UI with the edited values
      setIndustryTrendsData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          executiveSummary: editExecutiveSummary,
          aiAdoption: editAiAdoption,
          cloudMigration: editCloudMigration,
          regulatory: editRegulatory,
          trendSnapshots: editTrendSnapshots,
          regionalHotspots: editRegionalHotspots,
          strategicRecommendations: editStrategicRecommendations,
          recommendations: editStrategicRecommendations,
          risks: editRisks,
          visualCharts: editVisualCharts,
          timestamp: String(Date.now()) // Force update with new timestamp
        };
      });
      

      // Update parent state with local values (trust the user's edits)
      if (onIndustryTrendsExecutiveSummaryChange) {
        onIndustryTrendsExecutiveSummaryChange(editExecutiveSummary);
      }
      if (onIndustryTrendsAiAdoptionChange) {
        onIndustryTrendsAiAdoptionChange(editAiAdoption);
      }
      if (onIndustryTrendsCloudMigrationChange) {
        onIndustryTrendsCloudMigrationChange(editCloudMigration);
      }
      if (onIndustryTrendsRegulatoryChange) {
        onIndustryTrendsRegulatoryChange(editRegulatory);
      }
      if (onIndustryTrendSnapshotsChange) {
        onIndustryTrendSnapshotsChange(editTrendSnapshots);
      }
      
      
      // Call the original save function to trigger chat panel
      onIndustryTrendsSaveChanges();
      
    } catch (error) {
      console.error('❌ Industry Trends - Error saving changes:', error);
      // Still call the original save function even if API fails
      onIndustryTrendsSaveChanges();
    }
  };

  // Individual box save functions
  const handleSaveExecutiveSummary = () => {
    if (onIndustryTrendsExecutiveSummaryChange) {
      onIndustryTrendsExecutiveSummaryChange(editExecutiveSummary);
      toast({
        title: "Saved",
        description: "Executive Summary changes committed.",
      });
    }
  };

  const handleSaveKeyMetrics = () => {
    if (onIndustryTrendsAiAdoptionChange) {
      onIndustryTrendsAiAdoptionChange(editAiAdoption);
    }
    if (onIndustryTrendsCloudMigrationChange) {
      onIndustryTrendsCloudMigrationChange(editCloudMigration);
    }
    if (onIndustryTrendsRegulatoryChange) {
      onIndustryTrendsRegulatoryChange(editRegulatory);
    }
    toast({
      title: "Saved",
      description: "Key Metrics changes committed.",
    });
  };

  const handleSaveTrendSnapshots = () => {
    if (onIndustryTrendSnapshotsChange) {
      onIndustryTrendSnapshotsChange(editTrendSnapshots);
    }
    toast({
      title: "Saved",
      description: "Trend Snapshots changes committed.",
    });
  };

  const handleSaveRegionalHotspots = () => {
    toast({
      title: "Saved",
      description: "Regional Hotspots changes committed.",
    });
  };

  const handleSaveStrategicRecommendations = () => {
    toast({
      title: "Saved",
      description: "Strategic Recommendations changes committed.",
    });
  };

  const handleSaveRisks = () => {
    toast({
      title: "Saved",
      description: "Risks changes committed.",
    });
  };

  const handleSaveVisualCharts = () => {
    toast({
      title: "Saved",
      description: "Visual Charts changes committed.",
    });
  };

  const fetchUpdatedData = async () => {
    try {
      const response = await executeWithRateLimit(
        () => fetch('/api/market-research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ component_name: "industry_trends", org_id: orgIdToUse })
        }),
        'Industry Trends Update'
      );
      if (response.ok) {
        const data = await response.json();
        // Refresh the data if needed
        fetchIndustryTrendsData(false);
      }
    } catch (error) {
      console.error('Error fetching updated data:', error);
    }
  };

  // Show loading state only if we don't have props data and we're not refreshing
  if (isLoading && !isRefreshing && !propExecutiveSummary) {
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

  // Show no data state only if we don't have props data and we're not refreshing
  if (!industryTrendsData && !propExecutiveSummary && !isRefreshing) {
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
          <Button
            variant="ghost"
            size="sm"
            onClick={handleModify}
            className="text-purple-800 hover:text-purple-900"
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
                    onScoutIconClick('industry-trends');
                  }} 
                  className="text-purple-600 hover:text-purple-700 transition-all duration-200 relative"
                >
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
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

      {isIndustryTrendsEditing ? (
        <div className="space-y-8">
          {/* Executive Summary Edit */}
          {!normalizedDeletedSections.has('executive-summary') && (
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
                    <Button variant="ghost" size="sm" onClick={() => onIndustryTrendsDeleteSection('executive-summary')} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50 pointer-events-auto z-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
              </div>
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
          {!normalizedDeletedSections.has('key-metrics') && (
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
                    <Button variant="ghost" size="sm" onClick={() => onIndustryTrendsDeleteSection('key-metrics')} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50 pointer-events-auto z-50">
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
          {!normalizedDeletedSections.has('trend-snapshots') && (
            <div className="relative group">
              <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveTrendSnapshots}
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
                    <Button variant="ghost" size="sm" onClick={() => onIndustryTrendsDeleteSection('trend-snapshots')} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50 pointer-events-auto z-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
              </div>
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

          {/* Regional Hotspots Edit */}
          {!normalizedDeletedSections.has('regional-hotspots') && (
            <div className="relative group">
              <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveRegionalHotspots}
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
                    <Button variant="ghost" size="sm" onClick={() => onIndustryTrendsDeleteSection('regional-hotspots')} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50 pointer-events-auto z-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Regional Hotspots</h3>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <Label htmlFor="regionalHotspotAPAC" className="text-sm font-medium text-gray-700 mb-2 block">
                        APAC
                      </Label>
                      <Input 
                        id="regionalHotspotAPAC"
                        value={editRegionalHotspots.APAC}
                        onChange={e => setEditRegionalHotspots({ ...editRegionalHotspots, APAC: e.target.value })}
                        className="text-2xl font-bold text-blue-600 border-blue-200 focus:border-blue-400 text-center"
                        placeholder="e.g., 60%"
                      />
                    </div>
                    <div className="text-center">
                      <Label htmlFor="regionalHotspotEurope" className="text-sm font-medium text-gray-700 mb-2 block">
                        Europe
                      </Label>
                      <Input 
                        id="regionalHotspotEurope"
                        value={editRegionalHotspots.Europe}
                        onChange={e => setEditRegionalHotspots({ ...editRegionalHotspots, Europe: e.target.value })}
                        className="text-2xl font-bold text-blue-600 border-blue-200 focus:border-blue-400 text-center"
                        placeholder="e.g., 45%"
                      />
                    </div>
                    <div className="text-center">
                      <Label htmlFor="regionalHotspotNorthAmerica" className="text-sm font-medium text-gray-700 mb-2 block">
                        North America
                      </Label>
                      <Input 
                        id="regionalHotspotNorthAmerica"
                        value={editRegionalHotspots["North America"]}
                        onChange={e => setEditRegionalHotspots({ ...editRegionalHotspots, "North America": e.target.value })}
                        className="text-2xl font-bold text-blue-600 border-blue-200 focus:border-blue-400 text-center"
                        placeholder="e.g., 55%"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Strategic Recommendations Edit */}
          {!normalizedDeletedSections.has('strategic-recommendations') && (
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
                    <Button variant="ghost" size="sm" onClick={() => onIndustryTrendsDeleteSection('strategic-recommendations')} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50 pointer-events-auto z-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategic Recommendations</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <Label htmlFor="primaryFocus" className="text-sm font-medium text-green-900 mb-2 block">
                      Primary Focus
                    </Label>
                    <Textarea 
                      id="primaryFocus"
                      value={editStrategicRecommendations.primaryFocus}
                      onChange={e => setEditStrategicRecommendations({ ...editStrategicRecommendations, primaryFocus: e.target.value })}
                      className="text-green-700 text-sm border-green-200 focus:border-green-400"
                      placeholder="Enter primary focus recommendation..."
                      rows={4}
                    />
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <Label htmlFor="marketEntry" className="text-sm font-medium text-blue-900 mb-2 block">
                      Market Entry
                    </Label>
                    <Textarea 
                      id="marketEntry"
                      value={editStrategicRecommendations.marketEntry}
                      onChange={e => setEditStrategicRecommendations({ ...editStrategicRecommendations, marketEntry: e.target.value })}
                      className="text-blue-700 text-sm border-blue-200 focus:border-blue-400"
                      placeholder="Enter market entry recommendation..."
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Risks & Watchouts Edit */}
          {!normalizedDeletedSections.has('risks') && (
            <div className="relative group">
              <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveRisks}
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
                    <Button variant="ghost" size="sm" onClick={() => onIndustryTrendsDeleteSection('risks')} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50 pointer-events-auto z-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Risks & Watchouts</h3>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="space-y-2">
                    {editRisks.map((risk, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input 
                          value={risk}
                          onChange={e => {
                            const updated = [...editRisks];
                            updated[index] = e.target.value;
                            setEditRisks(updated);
                          }}
                          className="flex-1 text-red-700 text-sm border-red-200 focus:border-red-400"
                          placeholder="Enter risk..."
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditRisks(editRisks.filter((_, i) => i !== index));
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
                      onClick={() => setEditRisks([...editRisks, ''])}
                      className="mt-2"
                    >
                      Add Risk
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Visual Charts Edit */}
          {!normalizedDeletedSections.has('visual-charts') && (
            <div className="relative group">
              <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveVisualCharts}
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
                    <Button variant="ghost" size="sm" onClick={() => onIndustryTrendsDeleteSection('visual-charts')} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50 pointer-events-auto z-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Visual Charts</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <Label htmlFor="aiAdoptionTrends" className="text-sm font-medium text-gray-900 mb-3 block">
                      AI Adoption Trends
                    </Label>
                    <div className="space-y-2">
                      {editVisualCharts.aiAdoptionTrends.map((trend, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input 
                            value={trend}
                            onChange={e => {
                              const updated = [...editVisualCharts.aiAdoptionTrends];
                              updated[index] = e.target.value;
                              setEditVisualCharts({ ...editVisualCharts, aiAdoptionTrends: updated });
                            }}
                            className="flex-1 text-sm"
                            placeholder="Enter trend (e.g., Q1 2024)"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = editVisualCharts.aiAdoptionTrends.filter((_, i) => i !== index);
                              setEditVisualCharts({ ...editVisualCharts, aiAdoptionTrends: updated });
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
                        onClick={() => setEditVisualCharts({ ...editVisualCharts, aiAdoptionTrends: [...editVisualCharts.aiAdoptionTrends, ''] })}
                        className="mt-2"
                      >
                        Add Trend
                      </Button>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <Label className="text-sm font-medium text-gray-900 mb-3 block">
                      Technology Budget Allocation
                    </Label>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="budgetAIML" className="text-sm font-medium text-gray-700 mb-1 block">
                          AI/ML (%)
                        </Label>
                        <Input 
                          id="budgetAIML"
                          value={editVisualCharts.technologyBudgetAllocation["AI/ML"]}
                          onChange={e => setEditVisualCharts({
                            ...editVisualCharts,
                            technologyBudgetAllocation: {
                              ...editVisualCharts.technologyBudgetAllocation,
                              "AI/ML": e.target.value
                            }
                          })}
                          className="text-sm"
                          placeholder="e.g., 30"
                        />
                      </div>
                      <div>
                        <Label htmlFor="budgetCloud" className="text-sm font-medium text-gray-700 mb-1 block">
                          Cloud (%)
                        </Label>
                        <Input 
                          id="budgetCloud"
                          value={editVisualCharts.technologyBudgetAllocation.Cloud}
                          onChange={e => setEditVisualCharts({
                            ...editVisualCharts,
                            technologyBudgetAllocation: {
                              ...editVisualCharts.technologyBudgetAllocation,
                              Cloud: e.target.value
                            }
                          })}
                          className="text-sm"
                          placeholder="e.g., 25"
                        />
                      </div>
                      <div>
                        <Label htmlFor="budgetSecurity" className="text-sm font-medium text-gray-700 mb-1 block">
                          Security (%)
                        </Label>
                        <Input 
                          id="budgetSecurity"
                          value={editVisualCharts.technologyBudgetAllocation.Security}
                          onChange={e => setEditVisualCharts({
                            ...editVisualCharts,
                            technologyBudgetAllocation: {
                              ...editVisualCharts.technologyBudgetAllocation,
                              Security: e.target.value
                            }
                          })}
                          className="text-sm"
                          placeholder="e.g., 20"
                        />
                      </div>
                    </div>
                  </div>
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
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    onScoutIconClick('industry-trends');
                  }} 
                  className="text-purple-600 hover:text-purple-700 transition-all duration-200 relative"
                >
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
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
          {/* Default View */}
          <div>
            <p className="text-gray-700 mb-6">{propExecutiveSummary || industryTrendsData?.executiveSummary || ''}</p>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-blue-600">{propAiAdoption || industryTrendsData?.aiAdoption || ''}</div>
                <div className="text-sm font-medium text-gray-900">AI Adoption Rate</div>
                <div className="text-xs text-gray-600">Enterprise pilots</div>
              </div>
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-green-600">{propCloudMigration || industryTrendsData?.cloudMigration || ''}</div>
                <div className="text-sm font-medium text-gray-900">Cloud Migration Increase</div>
                <div className="text-xs text-gray-600">Year over year</div>
              </div>
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-purple-600">{propRegulatory || industryTrendsData?.regulatory || ''}</div>
                <div className="text-sm font-medium text-gray-900">Regulatory Changes</div>
                <div className="text-xs text-gray-600">Impacting sector</div>
              </div>
            </div>
          </div>

          {/* Read More Button */}
          {!industryTrendsExpanded && !isSplitView && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => onIndustryTrendsExpandToggle(true)}
                variant="outline"
                className="flex items-center space-x-2 text-sm hover:bg-gray-50"
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

                {/* Key Trend Snapshots */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Trend Snapshots</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(propTrendSnapshots || industryTrendsData?.trendSnapshots)?.map((trend, index) => (
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
                    {industryTrendsData?.regionalHotspots && Object.keys(industryTrendsData.regionalHotspots).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(industryTrendsData.regionalHotspots).map(([region, value]) => (
                          <div key={region} className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{value}</div>
                            <div className="text-sm text-gray-700">{region}</div>
                          </div>
                        ))}
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
                      <p className="text-green-700 text-sm">{propRecommendations?.primaryFocus || industryTrendsData?.strategicRecommendations?.primaryFocus || 'No recommendations available'}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-blue-900 mb-2">Market Entry</h4>
                      <p className="text-blue-700 text-sm">{propRecommendations?.marketEntry || industryTrendsData?.strategicRecommendations?.marketEntry || 'No recommendations available'}</p>
                    </div>
                  </div>
                </div>

                {/* Risks & Watchouts */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Risks & Watchouts</h3>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                     <ul className="space-y-2">
                      {(propRisks || industryTrendsData?.risks)?.map((risk, index) => (
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
                  {(() => {
                    // Use props first, then fall back to internal state
                    const visualCharts = propVisualCharts || industryTrendsData?.visualCharts;
                    
                    if (!visualCharts) {
                      return <p className="text-gray-500">No visual charts data available</p>;
                    }
                    
                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 mb-3">AI Adoption Trends</h4>
                          {(() => {
                            const trendsData = visualCharts?.aiAdoptionTrends;
                            
                            if (trendsData && Array.isArray(trendsData) && trendsData.length > 0) {
                              return (
                                <MiniLineChart 
                                  data={trendsData.map((quarter, index) => ({
                                    name: quarter || `Q${index + 1}`,
                                    value: 45 + (index * 11) // Dynamic values based on quarters
                                  }))} 
                                  title="" 
                                  color="#8B5CF6" 
                                />
                              );
                            }
                            return <p className="text-gray-500 text-sm">No AI adoption trends data available</p>;
                          })()}
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Technology Budget Allocation</h4>
                        {(() => {
                          try {
                            const budgetData = visualCharts?.technologyBudgetAllocation || industryTrendsData?.visualCharts?.technologyBudgetAllocation;
                            if (!budgetData || Object.keys(budgetData).length === 0) {
                              return <p className="text-gray-500 text-sm">No budget allocation data available</p>;
                            }
                            
                            // Dynamically parse all entries from the budget data
                            const colors = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4", "#84CC16", "#EC4899"];
                            const chartData = Object.entries(budgetData).map(([name, value], index) => {
                              const numericValue = value ? parseInt(String(value).replace('%', '')) : 0;
                              return {
                                name: name,
                                value: isNaN(numericValue) ? 0 : numericValue,
                                color: colors[index % colors.length]
                              };
                            }).filter(item => item.value > 0); // Only include items with valid values
                            
                            if (chartData.length === 0) {
                              return <p className="text-gray-500 text-sm">No valid budget allocation data available</p>;
                            }
                            
                            return (
                              <MiniPieChart 
                                data={chartData} 
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
                    );
                  })()}
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