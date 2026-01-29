import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { getUserLocalStorage, setUserLocalStorage } from '@/utils/cacheUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Scale, 
  Shield, 
  FileText, 
  Globe, 
  AlertTriangle,
  CheckCircle,
  Calendar,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  Check,
  Save,
  X,
  Clock,
  Target,
  Users,
  Building,
  Share,
  Bot,
  MessageSquare,
  Sun,
  BarChart3,
  Factory
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EditRecord } from './types';
import { toUTCTimestamp, isTimestampNewer, getCurrentUTCTimestamp, logTimestampComparison } from '@/lib/timestampUtils';
import MiniPieChart from '../MiniPieChart';
import MiniLineChart from '../MiniLineChart';
import { apiFetchJson } from '@/lib/api';
import { executeWithRateLimit } from '@/lib/rateLimitManager';

interface RegulatoryComplianceSectionProps {
  isEditing: boolean;
  isSplitView: boolean;
  isExpanded: boolean;
  hasEdits: boolean;
  deletedSections: Set<string>;
  editHistory: EditRecord[];
  executiveSummary: string;
  euAiActDeadline: string;
  gdprCompliance: string;
  potentialFines: string;
  dataLocalization: string;
  onToggleEdit: () => void;
  onScoutIconClick: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape' | 'regulatory-compliance', hasEdits?: boolean, customMessage?: string) => void;
  onEditHistoryOpen: () => void;
  onDeleteSection: (sectionId: string) => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onExpandToggle: (expanded: boolean) => void;
  onExecutiveSummaryChange: (value: string) => void;
  onEuAiActDeadlineChange: (value: string) => void;
  onGdprComplianceChange: (value: string) => void;
  onPotentialFinesChange: (value: string) => void;
  onDataLocalizationChange: (value: string) => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
  // Add refresh props
  isRefreshing?: boolean;
  companyProfile?: any;
  
  // Add centralized data prop
  regulatoryData?: any;
}

const RegulatoryComplianceSection: React.FC<RegulatoryComplianceSectionProps> = ({
  isEditing,
  isSplitView,
  isExpanded,
  hasEdits,
  deletedSections,
  editHistory,
  executiveSummary,
  euAiActDeadline,
  gdprCompliance,
  potentialFines,
  dataLocalization,
  onToggleEdit,
  onScoutIconClick,
  onEditHistoryOpen,
  onDeleteSection,
  onSaveChanges,
  onCancelEdit,
  onExpandToggle,
  onExecutiveSummaryChange,
  onEuAiActDeadlineChange,
  onGdprComplianceChange,
  onPotentialFinesChange,
  onDataLocalizationChange,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink,
  isRefreshing = false,
  companyProfile,
  regulatoryData: propRegulatoryData
}) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  // Use centralized data from parent instead of local state
  const regulatoryData = propRegulatoryData;
  const [regulatoryTimestamp, setRegulatoryTimestamp] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regulatoryExpanded, setRegulatoryExpanded] = useState(true);

  // Normalize deletedSections to ensure it's always a Set
  const normalizedDeletedSections = React.useMemo(() => {
    if (!deletedSections) {
      return new Set<string>();
    }
    if (deletedSections instanceof Set) {
      return deletedSections;
    }
    // If it's an array, convert to Set
    if (Array.isArray(deletedSections)) {
      return new Set(deletedSections);
    }
    // If it's an object, convert keys to Set
    if (typeof deletedSections === 'object') {
      return new Set(Object.keys(deletedSections));
    }
    // Fallback to empty Set
    return new Set<string>();
  }, [deletedSections]);

  // Local state for editing - prioritize API data over localStorage for fresh updates (user-specific)
  const [localExecutiveSummary, setLocalExecutiveSummary] = useState(() => {
    return regulatoryData?.executiveSummary || executiveSummary || getUserLocalStorage('regulatory_executiveSummary', currentUser?.uid) || '';
  });
  const [localEuAiActDeadline, setLocalEuAiActDeadline] = useState(() => {
    return regulatoryData?.euAiActDeadline || euAiActDeadline || getUserLocalStorage('regulatory_euAiActDeadline', currentUser?.uid) || '';
  });
  const [localGdprCompliance, setLocalGdprCompliance] = useState(() => {
    return regulatoryData?.gdprCompliance || gdprCompliance || getUserLocalStorage('regulatory_gdprCompliance', currentUser?.uid) || '';
  });
  const [localPotentialFines, setLocalPotentialFines] = useState(() => {
    return regulatoryData?.potentialFines || potentialFines || getUserLocalStorage('regulatory_potentialFines', currentUser?.uid) || '';
  });
  const [localDataLocalization, setLocalDataLocalization] = useState(() => {
    return regulatoryData?.dataLocalization || dataLocalization || getUserLocalStorage('regulatory_dataLocalization', currentUser?.uid) || '';
  });

  // Debug: Log when regulatoryData prop changes
  useEffect(() => {
    console.log('🔍 Regulatory Compliance - regulatoryData prop changed:', {
      hasRegulatoryData: !!regulatoryData,
      executiveSummary: regulatoryData?.executiveSummary,
      euAiActDeadline: regulatoryData?.euAiActDeadline,
      gdprCompliance: regulatoryData?.gdprCompliance,
      potentialFines: regulatoryData?.potentialFines,
      dataLocalization: regulatoryData?.dataLocalization,
      timestamp: regulatoryData?.timestamp
    });
  }, [regulatoryData]);

  // Update local state when regulatoryData prop changes (for API data updates)
  useEffect(() => {
    if (regulatoryData && !isEditing) {
      console.log('🔄 Regulatory Compliance - Updating local state with new regulatoryData:', regulatoryData);
      
      // Update local state with new API data
      if (regulatoryData.executiveSummary) {
        setLocalExecutiveSummary(regulatoryData.executiveSummary);
      }
      if (regulatoryData.euAiActDeadline) {
        setLocalEuAiActDeadline(regulatoryData.euAiActDeadline);
      }
      if (regulatoryData.gdprCompliance) {
        setLocalGdprCompliance(regulatoryData.gdprCompliance);
      }
      if (regulatoryData.potentialFines) {
        setLocalPotentialFines(regulatoryData.potentialFines);
      }
      if (regulatoryData.dataLocalization) {
        setLocalDataLocalization(regulatoryData.dataLocalization);
      }
      
      console.log('✅ Regulatory Compliance - Local state updated with new data');
    }
  }, [regulatoryData, isEditing]);
  
  // Dynamic local state for all key data points
  const [localKeyDataValues, setLocalKeyDataValues] = useState<Record<string, string>>({});

  // Local state for regional data (table)
  const [localRegionalData, setLocalRegionalData] = useState<any[]>([]);

  // Local state for visual data cards
  const [localVisualDataCards, setLocalVisualDataCards] = useState<any[]>([]);

  // Local state for strategic recommendations
  const [localStrategicRecommendations, setLocalStrategicRecommendations] = useState<any>({
    mitigateRegulatoryRisks: [],
    competitivePositioning: [],
    goToMarketStrategy: []
  });

  // Save local state to localStorage whenever it changes
  useEffect(() => {
    if (localExecutiveSummary) {
      localStorage.setItem('regulatory_executiveSummary', localExecutiveSummary);
    }
  }, [localExecutiveSummary]);

  useEffect(() => {
    if (localEuAiActDeadline) {
      localStorage.setItem('regulatory_euAiActDeadline', localEuAiActDeadline);
    }
  }, [localEuAiActDeadline]);

  useEffect(() => {
    if (localGdprCompliance) {
      localStorage.setItem('regulatory_gdprCompliance', localGdprCompliance);
    }
  }, [localGdprCompliance]);

  useEffect(() => {
    if (localPotentialFines) {
      localStorage.setItem('regulatory_potentialFines', localPotentialFines);
    }
  }, [localPotentialFines]);

  useEffect(() => {
    if (localDataLocalization) {
      localStorage.setItem('regulatory_dataLocalization', localDataLocalization);
    }
  }, [localDataLocalization]);

  // Sync local state with centralized regulatoryData and props (only on initial load)
  useEffect(() => {
    if (!isEditing) {
      console.log('🔄 Syncing Regulatory Compliance local state with props and data (initial load only):');
      console.log('  - executiveSummary prop:', executiveSummary);
      console.log('  - euAiActDeadline prop:', euAiActDeadline);
      console.log('  - regulatoryData:', regulatoryData);
      console.log('  - Current localExecutiveSummary:', localExecutiveSummary);
      console.log('  - Current localEuAiActDeadline:', localEuAiActDeadline);
      
      // Only update if we have new data and current local state is empty (initial load only)
      if (executiveSummary && !localExecutiveSummary) {
        setLocalExecutiveSummary(executiveSummary);
        console.log('📝 Updated localExecutiveSummary from prop (initial load):', executiveSummary);
      }
      if (regulatoryData?.executiveSummary && !localExecutiveSummary) {
        setLocalExecutiveSummary(regulatoryData.executiveSummary);
        console.log('📝 Updated localExecutiveSummary from regulatoryData (initial load):', regulatoryData.executiveSummary);
      }
      
      if (euAiActDeadline && !localEuAiActDeadline) {
        setLocalEuAiActDeadline(euAiActDeadline);
        console.log('📝 Updated localEuAiActDeadline from prop (initial load):', euAiActDeadline);
      }
      if (regulatoryData?.euAiActDeadline && !localEuAiActDeadline) {
        setLocalEuAiActDeadline(regulatoryData.euAiActDeadline);
        console.log('📝 Updated localEuAiActDeadline from regulatoryData (initial load):', regulatoryData.euAiActDeadline);
      }
      
      if (gdprCompliance && !localGdprCompliance) {
        setLocalGdprCompliance(gdprCompliance);
        console.log('📝 Updated localGdprCompliance from prop (initial load):', gdprCompliance);
      }
      if (regulatoryData?.gdprCompliance && !localGdprCompliance) {
        setLocalGdprCompliance(regulatoryData.gdprCompliance);
        console.log('📝 Updated localGdprCompliance from regulatoryData (initial load):', regulatoryData.gdprCompliance);
      }
      
      if (potentialFines && !localPotentialFines) {
        setLocalPotentialFines(potentialFines);
        console.log('📝 Updated localPotentialFines from prop (initial load):', potentialFines);
      }
      if (regulatoryData?.potentialFines && !localPotentialFines) {
        setLocalPotentialFines(regulatoryData.potentialFines);
        console.log('📝 Updated localPotentialFines from regulatoryData (initial load):', regulatoryData.potentialFines);
      }
      
      if (dataLocalization && !localDataLocalization) {
        setLocalDataLocalization(dataLocalization);
        console.log('📝 Updated localDataLocalization from prop (initial load):', dataLocalization);
      }
      if (regulatoryData?.dataLocalization && !localDataLocalization) {
        setLocalDataLocalization(regulatoryData.dataLocalization);
        console.log('📝 Updated localDataLocalization from regulatoryData (initial load):', regulatoryData.dataLocalization);
      }
    }
  }, [isEditing]); // Removed dependencies that cause constant re-syncing

  // Disabled: Also sync when regulatoryData changes (causes local state to be overwritten)
  // useEffect(() => {
  //   if (!isEditing && regulatoryData) {
  //     console.log('🔄 Regulatory Compliance - regulatoryData updated:', regulatoryData);
  //     // This useEffect was causing local state to be overwritten with original values
  //     // Disabled to preserve user edits
  //   }
  // }, [regulatoryData, isEditing, localExecutiveSummary, localEuAiActDeadline, localGdprCompliance, localPotentialFines, localDataLocalization]);

  // Initialize dynamic key data values after keyDataPoints is available
  useEffect(() => {
    if (!isEditing && regulatoryData?.keyUpdates && Array.isArray(regulatoryData.keyUpdates)) {
      const initialValues: Record<string, string> = {};
      regulatoryData.keyUpdates.forEach((update: any, index: number) => {
        if (update) {
          // Parse if update is a JSON string
          let parsedUpdate = update;
          if (typeof update === 'string') {
            try {
              parsedUpdate = JSON.parse(update);
            } catch (e) {
              console.warn(`⚠️ Failed to parse update[${index}] as JSON in useEffect:`, e);
              parsedUpdate = update;
            }
          }
          
          // Try multiple possible field names for title and value/description
          const title = parsedUpdate.title || parsedUpdate.name || parsedUpdate.label || parsedUpdate.heading || `Update ${index + 1}`;
          const value = parsedUpdate.description || parsedUpdate.value || parsedUpdate.content || parsedUpdate.text || parsedUpdate.details || '';
          
          if (title && title !== `Update ${index + 1}`) {
            const id = title.toLowerCase().replace(/\s+/g, '-');
            initialValues[id] = value;
          }
        }
      });
      setLocalKeyDataValues(initialValues);
    }
  }, [regulatoryData?.keyUpdates, isEditing]);

  // Handle modify button click - initialize edit fields with current data
  const handleModify = () => {
    // Initialize all edit fields with current data
    setLocalExecutiveSummary(regulatoryData?.executiveSummary || executiveSummary || '');
    setLocalEuAiActDeadline(regulatoryData?.euAiActDeadline || euAiActDeadline || '');
    setLocalGdprCompliance(regulatoryData?.gdprCompliance || gdprCompliance || '');
    setLocalPotentialFines(regulatoryData?.potentialFines || potentialFines || '');
    setLocalDataLocalization(regulatoryData?.dataLocalization || dataLocalization || '');
    
    // Initialize dynamic key data values
    if (regulatoryData?.keyUpdates && Array.isArray(regulatoryData.keyUpdates)) {
      const initialValues: Record<string, string> = {};
      regulatoryData.keyUpdates.forEach((update: any, index: number) => {
        if (update) {
          // Parse if update is a JSON string
          let parsedUpdate = update;
          if (typeof update === 'string') {
            try {
              parsedUpdate = JSON.parse(update);
            } catch (e) {
              console.warn(`⚠️ Failed to parse update[${index}] as JSON in handleModify:`, e);
              parsedUpdate = update;
            }
          }
          
          // Try multiple possible field names for title and value/description
          const title = parsedUpdate.title || parsedUpdate.name || parsedUpdate.label || parsedUpdate.heading || `Update ${index + 1}`;
          const value = parsedUpdate.description || parsedUpdate.value || parsedUpdate.content || parsedUpdate.text || parsedUpdate.details || '';
          
          if (title && title !== `Update ${index + 1}`) {
            const id = title.toLowerCase().replace(/\s+/g, '-');
            initialValues[id] = value;
          }
        }
      });
      setLocalKeyDataValues(initialValues);
    }
    
    // Initialize regional data
    const defaultRegionalData = [
      {
        region: 'European Union',
        framework: 'GDPR + AI Act',
        deadline: 'Q1 2026',
        impact: 'High',
        status: 'Active',
        requirements: 'Data protection, AI governance'
      },
      {
        region: 'United States',
        framework: 'CCPA + State Laws',
        deadline: 'Ongoing',
        impact: 'Medium',
        status: 'Evolving',
        requirements: 'Privacy rights, data handling'
      },
      {
        region: 'China',
        framework: 'PIPL + Cybersecurity Law',
        deadline: 'Active',
        impact: 'High',
        status: 'Mandatory',
        requirements: 'Data localization, security'
      },
      {
        region: 'United Kingdom',
        framework: 'UK GDPR + DPA',
        deadline: 'Active',
        impact: 'Medium',
        status: 'Active',
        requirements: 'Data protection, transfers'
      }
    ];
    const regionalDataToUse = regulatoryData?.regionalData || defaultRegionalData;
    setLocalRegionalData(regionalDataToUse && regionalDataToUse.length > 0 ? [...regionalDataToUse] : [...defaultRegionalData]);
    
    // Initialize visual data cards
    const defaultVisualDataCards = [
      {
        title: 'Compliance Adoption Rates',
        type: 'bar-chart',
        data: [
          { name: 'GDPR', value: 68, color: '#10b981' },
          { name: 'CCPA', value: 45, color: '#3b82f6' },
          { name: 'SOC 2', value: 72, color: '#8b5cf6' },
          { name: 'ISO 27001', value: 38, color: '#f59e0b' }
        ]
      },
      {
        title: 'Regulatory Timeline',
        type: 'timeline',
        data: [
          { date: 'Q1 2025', event: 'EU AI Act Phase 1', status: 'upcoming' },
          { date: 'Q3 2025', event: 'GDPR Updates', status: 'upcoming' },
          { date: 'Q1 2026', event: 'EU AI Act Full Enforcement', status: 'critical' }
        ]
      },
      {
        title: 'Risk Indicators',
        type: 'percentage',
        data: [
          { metric: 'Data Breach Risk', value: 23, trend: 'down' },
          { metric: 'Non-compliance Penalties', value: 15, trend: 'up' },
          { metric: 'Audit Readiness', value: 67, trend: 'up' }
        ]
      }
    ];
    const visualDataCardsToUse = regulatoryData?.visualDataCards || defaultVisualDataCards;
    setLocalVisualDataCards(visualDataCardsToUse && visualDataCardsToUse.length > 0 ? [...visualDataCardsToUse] : [...defaultVisualDataCards]);
    
    // Initialize strategic recommendations
    if (regulatoryData?.strategicRecommendations) {
      setLocalStrategicRecommendations({
        mitigateRegulatoryRisks: regulatoryData.strategicRecommendations.mitigateRegulatoryRisks || [],
        competitivePositioning: regulatoryData.strategicRecommendations.competitivePositioning || [],
        goToMarketStrategy: regulatoryData.strategicRecommendations.goToMarketStrategy || []
      });
    } else {
      setLocalStrategicRecommendations({
        mitigateRegulatoryRisks: [
          'Implement privacy by design principles',
          'Establish automated compliance monitoring',
          'Regular risk assessments and audits',
          'Cross-functional compliance team'
        ],
        competitivePositioning: [
          'Market compliance as differentiator',
          'Showcase security certifications',
          'Transparent data handling practices',
          'Industry-leading privacy standards'
        ],
        goToMarketStrategy: [
          'Regional deployment capabilities',
          'Compliance-ready product offerings',
          'Legal-friendly contract templates',
          'Enterprise-grade data residency'
        ]
      });
    }
    
    onToggleEdit();
  };

  // Disabled: Update local state when regulatoryData prop changes (causes local state to be overwritten)
  // useEffect(() => {
  //   if (regulatoryData && !isEditing) {
  //     console.log('🔄 RegulatoryComplianceSection: regulatoryData prop changed, updating local state:', regulatoryData);
  //     // This useEffect was causing local state to be overwritten with original values
  //     // Disabled to preserve user edits
  //   }
  // }, [regulatoryData, isEditing, localExecutiveSummary, localEuAiActDeadline, localGdprCompliance, localPotentialFines, localDataLocalization]);

  // Handle save changes
  const handleRegulatoryComplianceSaveChanges = async () => {
    try {
      console.log('🚀 Regulatory Compliance - Starting save operation');
      
      // Apply local edits to props
      onExecutiveSummaryChange(localExecutiveSummary);
      onEuAiActDeadlineChange(localEuAiActDeadline);
      onGdprComplianceChange(localGdprCompliance);
      onPotentialFinesChange(localPotentialFines);
      onDataLocalizationChange(localDataLocalization);
      
      // Prepare original data
      const originalData = {
        section: 'regulatory-compliance',
        executiveSummary: executiveSummary,
        euAiActDeadline: euAiActDeadline,
        gdprCompliance: gdprCompliance,
        potentialFines: potentialFines,
        dataLocalization: dataLocalization
      };

      // Prepare modified data
      const modifiedData = {
        section: 'regulatory-compliance',
        executiveSummary: localExecutiveSummary,
        euAiActDeadline: localEuAiActDeadline,
        gdprCompliance: localGdprCompliance,
        potentialFines: localPotentialFines,
        dataLocalization: localDataLocalization
      };

      // Prepare data for API according to schema
      const editData = {
        original_json: originalData,
        modified_json: modifiedData,
        edit_type: "modification"
      };

      console.log('📤 Regulatory Compliance - original_json:', originalData);
      console.log('📤 Regulatory Compliance - modified_json:', modifiedData);

      // Store data for /ask API
      localStorage.setItem('regulatory-compliance_original_json', JSON.stringify(originalData));
      localStorage.setItem('regulatory-compliance_modified_json', JSON.stringify(modifiedData));

      // Skip the /ask endpoint for now and focus on updating the UI
      console.log('📤 Regulatory Compliance - Skipping /ask endpoint, updating UI directly');
      
      // The local state variables are already updated with the edited values
      // The UI will automatically reflect these changes since it uses local state
      console.log('✅ Regulatory Compliance - UI will reflect local state changes');
      console.log('✅ Regulatory Compliance - Current local values:', {
        localExecutiveSummary,
        localEuAiActDeadline,
        localGdprCompliance,
        localPotentialFines,
        localDataLocalization
      });
      
      // Call the original save function to trigger chat panel
      onSaveChanges();
    } catch (error) {
      console.error('❌ Regulatory Compliance - Error saving changes:', error);
      // Still call the original save function even if API fails
      onSaveChanges();
    }
  };

  // Fetch Regulatory Compliance data from API (like working components do)
  const fetchRegulatoryComplianceData = async (refresh = false) => {
    console.log('⚖️ RegulatoryComplianceSection: Starting fetchRegulatoryComplianceData with refresh:', refresh);
    try {
      setIsLoading(true);
      setError(null);

      const currentTime = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      
      // Get company profile data for dynamic reports (user-specific)
      const profile = companyProfile || JSON.parse(getUserLocalStorage('companyProfile', currentUser?.uid) || '{}');
      console.log('🔍 Regulatory Compliance - Company profile being used:', profile);
      console.log('🔍 Regulatory Compliance - companyProfile prop:', companyProfile);
      console.log('🔍 Regulatory Compliance - localStorage profile (user-specific):', JSON.parse(getUserLocalStorage('companyProfile', currentUser?.uid) || '{}'));
      
      if (!currentUser?.uid) {
        console.error('User not authenticated');
        setError('User not authenticated');
        setIsLoading(false);
        return;
      }
      
      const payload = {
        user_id: currentUser.uid,
        component_name: "regulatory & compliance highlights", // Exact match for regulatory compliance
        refresh: refresh,
        force_refresh: refresh,
        cache_bypass: refresh,
        bypass_all_cache: refresh,
        request_timestamp: currentTime,
        request_id: randomId,
        data: {}
      };

      console.log('📤 RegulatoryComplianceSection: Sending API request with payload:', payload);

      const result = await executeWithRateLimit(
        () => apiFetchJson('market-research', {
          method: 'POST',
          body: payload
        }),
        'Regulatory Compliance'
      );
      console.log('📊 RegulatoryComplianceSection: API result:', result);
      
      if (result.status === 'success' && result.data) {
        const apiData = result.data;
        console.log('✅ RegulatoryComplianceSection: Processing API data:', apiData);
        
        // Extract data from API response like working components do
        const executiveSummary = apiData.executiveSummary || '';
        const euAiActDeadline = apiData.euAiActDeadline || '';
        const gdprCompliance = apiData.gdprCompliance || '';
        const potentialFines = apiData.potentialFines || '';
        const dataLocalization = apiData.dataLocalization || '';
        
        // Update local state with API data
        setLocalExecutiveSummary(executiveSummary);
        setLocalEuAiActDeadline(euAiActDeadline);
        setLocalGdprCompliance(gdprCompliance);
        setLocalPotentialFines(potentialFines);
        setLocalDataLocalization(dataLocalization);
        
        // Update parent state with API data
        onExecutiveSummaryChange(executiveSummary);
        onEuAiActDeadlineChange(euAiActDeadline);
        onGdprComplianceChange(gdprCompliance);
        onPotentialFinesChange(potentialFines);
        onDataLocalizationChange(dataLocalization);
        
        // Update dynamic key data values if available
        if (apiData.keyUpdates) {
          const initialValues: Record<string, string> = {};
          apiData.keyUpdates.forEach((update: any) => {
            const id = update.title.toLowerCase().replace(/\s+/g, '-');
            initialValues[id] = update.description || '';
          });
          setLocalKeyDataValues(initialValues);
        }
        
        console.log('✅ RegulatoryComplianceSection: Data updated from API');
      } else {
        console.log('⚠️ RegulatoryComplianceSection: No data in API response, using fallback');
      }
    } catch (error) {
      console.error('❌ RegulatoryComplianceSection: Error fetching data:', error);
      
      // Handle errors with fallback logic
      const errorMessage = error instanceof Error ? error.message : 'Failed to load regulatory data';
      const isTimeout = errorMessage.includes('timeout');
      const isApiError = errorMessage.includes('API error');
      
      if (isTimeout || isApiError) {
        console.log('🔄 Regulatory Compliance: API failed, using fallback data');
        
        // Set fallback data to prevent empty state
        const fallbackData = {
          executiveSummary: 'Regulatory compliance analysis is being prepared. Please try refreshing in a few moments.',
          euAiActDeadline: 'Loading...',
          gdprCompliance: 'Loading...',
          potentialFines: 'Loading...',
          dataLocalization: 'Loading...'
        };
        
        setLocalExecutiveSummary(fallbackData.executiveSummary);
        setLocalEuAiActDeadline(fallbackData.euAiActDeadline);
        setLocalGdprCompliance(fallbackData.gdprCompliance);
        setLocalPotentialFines(fallbackData.potentialFines);
        setLocalDataLocalization(fallbackData.dataLocalization);
        
        onExecutiveSummaryChange(fallbackData.executiveSummary);
        onEuAiActDeadlineChange(fallbackData.euAiActDeadline);
        onGdprComplianceChange(fallbackData.gdprCompliance);
        onPotentialFinesChange(fallbackData.potentialFines);
        onDataLocalizationChange(fallbackData.dataLocalization);
        
        setError('Data is being prepared. Please refresh in a few moments.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Clear previous data and fetch fresh data on component mount
  useEffect(() => {
    // Clear any existing data immediately to prevent showing stale data
    setIsLoading(true);
    setError(null);
    
    // Reduced delay for faster loading
    const timer = setTimeout(() => {
      console.log('🚀 Regulatory Compliance Component mounted - fetching initial data');
      fetchRegulatoryComplianceData(false); // refresh = false for initial load
    }, 1000);

    return () => clearTimeout(timer);
  }, []);
  
  // Handle refresh when isRefreshing prop changes
  useEffect(() => {
    if (isRefreshing) {
      console.log('🔄 Regulatory Compliance - Refresh triggered by parent, fetching fresh data');
      setError(null);
      setIsLoading(true);
      fetchRegulatoryComplianceData(true); // refresh = true for forced refresh
    }
  }, [isRefreshing]);

  // Listen for company profile updates from settings
  useEffect(() => {
    const handleCompanyProfileUpdate = async () => {
      console.log('🔄 Regulatory Compliance - Company profile updated, fetching latest profile and then fresh data');
      setError(null);
      setIsLoading(true);
      
      // Wait a bit for the backend to process the profile update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fetch the latest company profile from backend (with user_id)
      try {
        const profileUrl = currentUser?.uid 
          ? `https://backend-11kr.onrender.com/profile/company?user_id=${currentUser.uid}`
          : 'https://backend-11kr.onrender.com/profile/company';
        const profileResponse = await fetch(profileUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        if (profileResponse.ok) {
          const latestProfile = await profileResponse.json();
          console.log('📋 Regulatory Compliance - Retrieved latest company profile:', latestProfile);
          // Verify profile belongs to current user before storing
          if (latestProfile.user_id === currentUser?.uid || !latestProfile.user_id) {
            // Store in user-specific localStorage so the API call can use it
            setUserLocalStorage('companyProfile', JSON.stringify(latestProfile), currentUser?.uid);
            setUserLocalStorage('companyProfileForRefresh', JSON.stringify(latestProfile), currentUser?.uid);
          } else {
            console.warn('⚠️ Regulatory Compliance - Profile user_id mismatch, not storing');
          }
        }
      } catch (error) {
        console.warn('⚠️ Regulatory Compliance - Could not fetch latest profile:', error);
      }
      
      fetchRegulatoryComplianceData(true); // refresh = true for company profile changes
    };

    window.addEventListener('companyProfileUpdated', handleCompanyProfileUpdate);
    
    return () => {
      window.removeEventListener('companyProfileUpdated', handleCompanyProfileUpdate);
    };
  }, []);

  // Also listen for companyProfile prop changes
  useEffect(() => {
    if (companyProfile) {
      console.log('🔄 Regulatory Compliance - companyProfile prop changed:', companyProfile);
      console.log('🔄 Regulatory Compliance - Fetching fresh data with new profile');
      setError(null);
      setIsLoading(true);
      fetchRegulatoryComplianceData(true); // refresh = true for company profile prop changes
    }
  }, [companyProfile]);

  console.log('🎨 RegulatoryComplianceSection RENDER DEBUG:');
  console.log('  - isLoading:', isLoading);
  console.log('  - error:', error);
  console.log('  - regulatoryData exists:', !!regulatoryData);
  console.log('  - propRegulatoryData exists:', !!propRegulatoryData);
  console.log('  - regulatoryData content:', regulatoryData);
  console.log('  - regulatoryExpanded:', regulatoryExpanded);

  if (normalizedDeletedSections.has('regulatory-compliance')) {
    return null;
  }

  // Always use regulatoryData when available
  if (!regulatoryData) {
    console.log('⚠️ No regulatoryData found - will use fallback props');
    console.log('  - propRegulatoryData:', propRegulatoryData);
    console.log('  - isRefreshing:', isRefreshing);
    console.log('  - companyProfile:', companyProfile);
    // Don't return null, let it continue with fallback props
  }

  // Use API data if available, otherwise fall back to props
  const getIconByName = (iconName: string) => {
    switch (iconName) {
      case 'sun': return Sun;
      case 'chart': 
      case 'chart-line': return BarChart3;
      case 'government': return Building;
      case 'competition': return Factory;
      case 'arrow-up': return TrendingUp;
      case 'users': return Users;
      case 'gavel': return Scale;
      case 'scale': return Scale;
      default: return Scale;
    }
  };

  const getBadgeColor = (tag: string) => {
    switch (tag) {
      case 'New': return 'bg-blue-100 text-blue-800';
      case 'Update': return 'bg-yellow-100 text-yellow-800';
      case 'Support': return 'bg-green-100 text-green-800';
      case 'Competitive': return 'bg-purple-100 text-purple-800';
      case 'Risk': return 'bg-red-100 text-red-800';
      case 'Market Leaders': return 'bg-green-100 text-green-800';
      case 'Regulatory': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Create fallback key data points using local state values first, then regulatoryData properties
  const fallbackKeyDataPoints = [
    {
      id: 'eu-ai-act-deadline',
      icon: Scale,
      title: 'EU AI Act Deadline',
      value: localEuAiActDeadline || regulatoryData?.euAiActDeadline || euAiActDeadline || 'February 2, 2025',
      badge: 'New',
      badgeColor: 'bg-blue-100 text-blue-800',
      tooltip: 'Upcoming deadline for EU AI Act compliance'
    },
    {
      id: 'gdpr-compliance',
      icon: Building,
      title: 'GDPR Compliance',
      value: localGdprCompliance || regulatoryData?.gdprCompliance || gdprCompliance || '68%',
      badge: 'Update',
      badgeColor: 'bg-yellow-100 text-yellow-800',
      tooltip: 'Current GDPR compliance percentage'
    },
    {
      id: 'potential-fines',
      icon: Factory,
      title: 'Potential Fines',
      value: localPotentialFines || regulatoryData?.potentialFines || potentialFines || 'Up to 6% of annual revenue',
      badge: 'Risk',
      badgeColor: 'bg-red-100 text-red-800',
      tooltip: 'Maximum regulatory fines'
    },
    {
      id: 'data-localization',
      icon: BarChart3,
      title: 'Data Localization',
      value: localDataLocalization || regulatoryData?.dataLocalization || dataLocalization || 'Mandatory for customer data',
      badge: 'Support',
      badgeColor: 'bg-green-100 text-green-800',
      tooltip: 'Data storage requirements'
    }
  ];

  // Debug logging for keyDataPoints
  console.log('🔍 RegulatoryComplianceSection - regulatoryData:', regulatoryData);
  console.log('🔍 RegulatoryComplianceSection - regulatoryData?.keyUpdates:', regulatoryData?.keyUpdates);
  console.log('🔍 RegulatoryComplianceSection - regulatoryData?.keyUpdates type:', typeof regulatoryData?.keyUpdates);
  console.log('🔍 RegulatoryComplianceSection - regulatoryData?.keyUpdates isArray:', Array.isArray(regulatoryData?.keyUpdates));
  console.log('🔍 RegulatoryComplianceSection - regulatoryData?.keyUpdates length:', regulatoryData?.keyUpdates?.length);
  
  if (regulatoryData?.keyUpdates && Array.isArray(regulatoryData.keyUpdates)) {
    console.log('🔍 RegulatoryComplianceSection - keyUpdates details:');
    regulatoryData.keyUpdates.forEach((update: any, index: number) => {
      if (update) {
        console.log(`  [${index}] Full update object:`, JSON.stringify(update, null, 2));
        console.log(`  [${index}] title: "${update.title}", description: "${update.description}", tag: "${update.tag}"`);
        console.log(`  [${index}] Alternative fields - name: "${update.name}", label: "${update.label}", value: "${update.value}", content: "${update.content}"`);
        console.log(`  [${index}] All keys:`, Object.keys(update));
        console.log(`  [${index}] Type of update:`, typeof update);
        console.log(`  [${index}] Is update truthy:`, !!update);
      } else {
        console.log(`  [${index}] Update is falsy/null/undefined`);
      }
    });
  } else {
    console.log('⚠️ RegulatoryComplianceSection - keyUpdates is not an array or does not exist');
    console.log('  - regulatoryData?.keyUpdates:', regulatoryData?.keyUpdates);
    console.log('  - Type:', typeof regulatoryData?.keyUpdates);
  }
  console.log('🔍 RegulatoryComplianceSection - euAiActDeadline:', euAiActDeadline);
  console.log('🔍 RegulatoryComplianceSection - gdprCompliance:', gdprCompliance);
  console.log('🔍 RegulatoryComplianceSection - potentialFines:', potentialFines);
  console.log('🔍 RegulatoryComplianceSection - dataLocalization:', dataLocalization);

  const keyDataPoints = (regulatoryData?.keyUpdates && Array.isArray(regulatoryData.keyUpdates)) ? regulatoryData.keyUpdates.filter((update: any) => update).map((update: any, index: number) => {
    // Parse if update is a JSON string
    let parsedUpdate = update;
    if (typeof update === 'string') {
      try {
        parsedUpdate = JSON.parse(update);
      } catch (e) {
        console.warn(`⚠️ Failed to parse update[${index}] as JSON:`, e);
        parsedUpdate = update;
      }
    }
    
    // Try multiple possible field names for title and value/description
    const title = parsedUpdate.title || parsedUpdate.name || parsedUpdate.label || parsedUpdate.heading || `Update ${index + 1}`;
    const value = parsedUpdate.description || parsedUpdate.value || parsedUpdate.content || parsedUpdate.text || parsedUpdate.details || '';
    
    return {
      id: title?.toLowerCase().replace(/\s+/g, '-') || `update-${index}`,
      icon: getIconByName(parsedUpdate.icon || 'scale'),
      title: title,
      value: value,
      badge: parsedUpdate.tag || parsedUpdate.badge || parsedUpdate.category || 'Update',
      badgeColor: getBadgeColor(parsedUpdate.tag || parsedUpdate.badge || parsedUpdate.category),
      tooltip: value || title
    };
  }) : [
    {
      id: 'eu-ai-act',
      icon: Scale,
      title: 'EU AI Act enforcement starts Q1 2026',
      value: euAiActDeadline,
      badge: 'New',
      badgeColor: 'bg-blue-100 text-blue-800',
      tooltip: 'New European AI Act comes into effect with strict compliance requirements for AI systems.'
    },
    {
      id: 'gdpr-compliance',
      icon: Shield,
      title: 'GDPR compliance among SaaS providers',
      value: gdprCompliance,
      badge: 'Update',
      badgeColor: 'bg-yellow-100 text-yellow-800',
      tooltip: 'Current adoption rates show varying levels of GDPR compliance across different SaaS categories.'
    },
    {
      id: 'potential-fines',
      icon: AlertTriangle,
      title: 'Potential fines: up to 6% revenue',
      value: potentialFines,
      badge: 'Risk',
      badgeColor: 'bg-red-100 text-red-800',
      tooltip: 'Maximum penalty levels for non-compliance with major data protection regulations.'
    },
    {
      id: 'data-localization',
      icon: Globe,
      title: 'China data localization laws impacting global SaaS',
      value: dataLocalization,
      badge: 'High Priority',
      badgeColor: 'bg-purple-100 text-purple-800',
      tooltip: 'New data residency requirements affecting international SaaS deployment strategies.'
    }
  ];

  console.log('🔍 RegulatoryComplianceSection - keyDataPoints:', keyDataPoints);
  console.log('🔍 RegulatoryComplianceSection - keyDataPoints length:', keyDataPoints.length);
  if (keyDataPoints.length > 0) {
    console.log('🔍 RegulatoryComplianceSection - keyDataPoints details:');
    keyDataPoints.forEach((point, index) => {
      console.log(`  [${index}] id: "${point.id}", title: "${point.title}", value: "${point.value}"`);
    });
  }

  const visualDataCards = regulatoryData?.visualDataCards || [
    {
      title: 'Compliance Adoption Rates',
      type: 'bar-chart',
      data: [
        { name: 'GDPR', value: 68, color: '#10b981' },
        { name: 'CCPA', value: 45, color: '#3b82f6' },
        { name: 'SOC 2', value: 72, color: '#8b5cf6' },
        { name: 'ISO 27001', value: 38, color: '#f59e0b' }
      ]
    },
    {
      title: 'Regulatory Timeline',
      type: 'timeline',
      data: [
        { date: 'Q1 2025', event: 'EU AI Act Phase 1', status: 'upcoming' },
        { date: 'Q3 2025', event: 'GDPR Updates', status: 'upcoming' },
        { date: 'Q1 2026', event: 'EU AI Act Full Enforcement', status: 'critical' }
      ]
    },
    {
      title: 'Risk Indicators',
      type: 'percentage',
      data: [
        { metric: 'Data Breach Risk', value: 23, trend: 'down' },
        { metric: 'Non-compliance Penalties', value: 15, trend: 'up' },
        { metric: 'Audit Readiness', value: 67, trend: 'up' }
      ]
    }
  ];

  const regionalData = regulatoryData?.regionalData || [
    {
      region: 'European Union',
      framework: 'GDPR + AI Act',
      deadline: 'Q1 2026',
      impact: 'High',
      status: 'Active',
      requirements: 'Data protection, AI governance'
    },
    {
      region: 'United States',
      framework: 'CCPA + State Laws',
      deadline: 'Ongoing',
      impact: 'Medium',
      status: 'Evolving',
      requirements: 'Privacy rights, data handling'
    },
    {
      region: 'China',
      framework: 'PIPL + Cybersecurity Law',
      deadline: 'Active',
      impact: 'High',
      status: 'Mandatory',
      requirements: 'Data localization, security'
    },
    {
      region: 'United Kingdom',
      framework: 'UK GDPR + DPA',
      deadline: 'Active',
      impact: 'Medium',
      status: 'Active',
      requirements: 'Data protection, transfers'
    }
  ];

  // Initialize local state for regional data and visual data cards when not editing
  useEffect(() => {
    if (!isEditing) {
      const defaultRegionalData = [
        {
          region: 'European Union',
          framework: 'GDPR + AI Act',
          deadline: 'Q1 2026',
          impact: 'High',
          status: 'Active',
          requirements: 'Data protection, AI governance'
        },
        {
          region: 'United States',
          framework: 'CCPA + State Laws',
          deadline: 'Ongoing',
          impact: 'Medium',
          status: 'Evolving',
          requirements: 'Privacy rights, data handling'
        },
        {
          region: 'China',
          framework: 'PIPL + Cybersecurity Law',
          deadline: 'Active',
          impact: 'High',
          status: 'Mandatory',
          requirements: 'Data localization, security'
        },
        {
          region: 'United Kingdom',
          framework: 'UK GDPR + DPA',
          deadline: 'Active',
          impact: 'Medium',
          status: 'Active',
          requirements: 'Data protection, transfers'
        }
      ];
      
      const defaultVisualDataCards = [
        {
          title: 'Compliance Adoption Rates',
          type: 'bar-chart',
          data: [
            { name: 'GDPR', value: 68, color: '#10b981' },
            { name: 'CCPA', value: 45, color: '#3b82f6' },
            { name: 'SOC 2', value: 72, color: '#8b5cf6' },
            { name: 'ISO 27001', value: 38, color: '#f59e0b' }
          ]
        },
        {
          title: 'Regulatory Timeline',
          type: 'timeline',
          data: [
            { date: 'Q1 2025', event: 'EU AI Act Phase 1', status: 'upcoming' },
            { date: 'Q3 2025', event: 'GDPR Updates', status: 'upcoming' },
            { date: 'Q1 2026', event: 'EU AI Act Full Enforcement', status: 'critical' }
          ]
        },
        {
          title: 'Risk Indicators',
          type: 'percentage',
          data: [
            { metric: 'Data Breach Risk', value: 23, trend: 'down' },
            { metric: 'Non-compliance Penalties', value: 15, trend: 'up' },
            { metric: 'Audit Readiness', value: 67, trend: 'up' }
          ]
        }
      ];
      
      const regionalDataToUse = regulatoryData?.regionalData || defaultRegionalData;
      if (regionalDataToUse && regionalDataToUse.length > 0) {
        setLocalRegionalData([...regionalDataToUse]);
      }
      
      const visualDataCardsToUse = regulatoryData?.visualDataCards || defaultVisualDataCards;
      if (visualDataCardsToUse && visualDataCardsToUse.length > 0) {
        setLocalVisualDataCards([...visualDataCardsToUse]);
      }
    }
  }, [regulatoryData, isEditing]);

  const currentExecutiveSummary = localExecutiveSummary || regulatoryData?.executiveSummary || executiveSummary;

  return (
    <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <FileText className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                Regulatory & Compliance Highlights
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Current regulatory landscape and compliance requirements
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            
            {/* Edit Button - Always visible */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleModify}
                  className="h-8 w-8 text-blue-800 hover:text-blue-900 pointer-events-auto"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit</p>
              </TooltipContent>
            </Tooltip>

            {/* Scout Chat Icon */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 relative hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200"
                  onClick={() => onScoutIconClick('regulatory-compliance', hasEdits)}
                >
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-purple-400/20 animate-pulse opacity-75"></div>
                  <Bot className="h-4 w-4 relative z-10 text-blue-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Explore More with Scout</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

      </CardHeader>

      <CardContent className="space-y-6">
        {isEditing ? (
          /* Full Editable Report Mode */
          <div className="space-y-8">
            {/* Executive Summary */}
            {!normalizedDeletedSections.has('executive-summary') && (
              <div className="relative group border border-gray-200 rounded-lg p-4">
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  <button
                    onClick={() => {
                      onExecutiveSummaryChange(localExecutiveSummary);
                      toast({
                        title: "Saved",
                        description: "Executive Summary changes committed.",
                      });
                    }}
                    className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                    title="Commit changes"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      onDeleteSection('executive-summary');
                      onScoutIconClick('regulatory-compliance', true, 'I noticed you removed the Executive Summary. Want me to help refine or replace it?');
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </button>
                </div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Executive Summary</h4>
                <textarea
                  value={localExecutiveSummary}
                  onChange={(e) => {
                    setLocalExecutiveSummary(e.target.value);
                    onExecutiveSummaryChange(e.target.value);
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none"
                  rows={4}
                  placeholder="Enter executive summary..."
                />
              </div>
            )}

            {/* Key Regulatory Updates */}
            {!normalizedDeletedSections.has('key-updates') && (
              <div className="relative group border border-gray-200 rounded-lg p-4">
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  <button
                    onClick={() => {
                      toast({
                        title: "Saved",
                        description: "Key Regulatory Updates changes committed.",
                      });
                    }}
                    className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                    title="Commit changes"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      onDeleteSection('key-updates');
                      onScoutIconClick('regulatory-compliance', true, 'I noticed you removed the Key Regulatory Updates. Want me to help refine or replace it?');
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </button>
                </div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Key Regulatory Updates</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {keyDataPoints.map((point) => {
                    const IconComponent = point.icon;
                    return (
                      <div key={point.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <IconComponent className="h-4 w-4 text-gray-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <h5 className="text-sm font-medium text-gray-900 leading-tight">
                                {point.title}
                              </h5>
                              <Badge className={`${point.badgeColor} text-xs`}>
                                {point.badge}
                              </Badge>
                            </div>
                            <input
                              type="text"
                              value={
                                point.id === 'eu-ai-act' ? localEuAiActDeadline :
                                point.id === 'gdpr-compliance' ? localGdprCompliance :
                                point.id === 'potential-fines' ? localPotentialFines :
                                point.id === 'data-localization' ? localDataLocalization :
                                localKeyDataValues[point.id] || point.value
                              }
                              onKeyDown={(e) => {
                                console.log(`🔍 Key Regulatory Updates - Key pressed: ${e.key} for field: ${point.id}`);
                              }}
                              onInput={(e) => {
                                console.log(`🔍 Key Regulatory Updates - Input event for field: ${point.id}, value: ${(e.target as HTMLInputElement).value}`);
                              }}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                console.log(`🔍 Key Regulatory Updates - onChange for field: ${point.id}, newValue: ${newValue}`);
                                if (point.id === 'eu-ai-act') {
                                  console.log(`🔍 Setting localEuAiActDeadline to: ${newValue}`);
                                  setLocalEuAiActDeadline(newValue);
                                  onEuAiActDeadlineChange(newValue);
                                } else if (point.id === 'gdpr-compliance') {
                                  console.log(`🔍 Setting localGdprCompliance to: ${newValue}`);
                                  setLocalGdprCompliance(newValue);
                                  onGdprComplianceChange(newValue);
                                } else if (point.id === 'potential-fines') {
                                  console.log(`🔍 Setting localPotentialFines to: ${newValue}`);
                                  setLocalPotentialFines(newValue);
                                  onPotentialFinesChange(newValue);
                                } else if (point.id === 'data-localization') {
                                  console.log(`🔍 Setting localDataLocalization to: ${newValue}`);
                                  setLocalDataLocalization(newValue);
                                  onDataLocalizationChange(newValue);
                                } else {
                                  // Handle dynamic fields
                                  console.log(`🔍 Setting dynamic field ${point.id} to: ${newValue}`);
                                  setLocalKeyDataValues(prev => ({
                                    ...prev,
                                    [point.id]: newValue
                                  }));
                                }
                              }}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Compliance Analytics */}
            {!normalizedDeletedSections.has('compliance-analytics') && (
              <div className="relative group border border-gray-200 rounded-lg p-4">
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  <button
                    onClick={() => {
                      toast({
                        title: "Saved",
                        description: "Compliance Analytics changes committed.",
                      });
                    }}
                    className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                    title="Commit changes"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      onDeleteSection('compliance-analytics');
                      onScoutIconClick('regulatory-compliance', true, 'I noticed you removed the Compliance Analytics. Want me to help refine or replace it?');
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </button>
                </div>
                <h4 className="text-sm font-medium text-gray-700 mb-4">Compliance Analytics</h4>
                {(isEditing ? localVisualDataCards : visualDataCards) && (isEditing ? localVisualDataCards : visualDataCards).length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {(isEditing ? localVisualDataCards : visualDataCards).map((card: any, cardIndex: number) => {
                      // Find card by type dynamically
                      if (card.type === 'bar-chart') {
                        return (
                          <div key={cardIndex} className="bg-white border border-gray-200 rounded-lg p-4">
                            {isEditing ? (
                              <Input
                                value={card.title || 'Compliance Adoption Rates'}
                                onChange={(e) => {
                                  const updated = [...localVisualDataCards];
                                  updated[cardIndex] = { ...updated[cardIndex], title: e.target.value };
                                  setLocalVisualDataCards(updated);
                                }}
                                className="font-medium text-gray-900 mb-3"
                              />
                            ) : (
                              <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                                <BarChart3 className="h-4 w-4 mr-2 text-blue-600" />
                                {card.title || 'Compliance Adoption Rates'}
                              </h5>
                            )}
                            <div className="space-y-3">
                              {card.data && card.data.length > 0 ? (() => {
                                // Find max value to normalize progress bars
                                const maxValue = Math.max(...card.data.map((item: any) => Number(item.value) || Number(item.name?.value) || 0));
                                const normalizeValue = (val: number) => maxValue > 100 ? Math.min((val / maxValue) * 100, 100) : Math.min(val, 100);
                                
                                return card.data.map((item: any, index: number) => {
                                  const numericValue = Number(item.value) || 0;
                                  const normalizedWidth = normalizeValue(numericValue);
                                  const itemName = item.name || item.label || '';
                                  
                                  return (
                                    <div key={index} className="flex items-center justify-between gap-2">
                                      {isEditing ? (
                                        <>
                                          <Input
                                            value={itemName}
                                            onChange={(e) => {
                                              const updated = [...localVisualDataCards];
                                              updated[cardIndex].data[index] = { ...updated[cardIndex].data[index], name: e.target.value, label: e.target.value };
                                              setLocalVisualDataCards(updated);
                                            }}
                                            className="flex-1 text-sm"
                                            placeholder="Name"
                                          />
                                          <Input
                                            type="number"
                                            value={item.value || ''}
                                            onChange={(e) => {
                                              const updated = [...localVisualDataCards];
                                              updated[cardIndex].data[index] = { ...updated[cardIndex].data[index], value: Number(e.target.value) || 0 };
                                              setLocalVisualDataCards(updated);
                                            }}
                                            className="w-20 text-sm"
                                            placeholder="Value"
                                          />
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              const updated = [...localVisualDataCards];
                                              updated[cardIndex].data = updated[cardIndex].data.filter((_: any, i: number) => i !== index);
                                              setLocalVisualDataCards(updated);
                                            }}
                                            className="text-red-600 hover:text-red-700"
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-sm text-gray-600">{itemName}</span>
                                          <div className="flex items-center space-x-2">
                                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                              <div 
                                                className="h-2 rounded-full" 
                                                style={{ 
                                                  width: `${normalizedWidth}%`, 
                                                  backgroundColor: item.color || `hsl(${index * 60}, 70%, 50%)`,
                                                  maxWidth: '100%'
                                                }}
                                              />
                                            </div>
                                            <span className="text-sm font-medium text-gray-900">{item.value}{card.title?.includes('Growth') ? 'B' : ''}</span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  );
                                });
                              })() : <p className="text-gray-500 text-sm">No data available</p>}
                              {isEditing && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const updated = [...localVisualDataCards];
                                    updated[cardIndex].data = [...(updated[cardIndex].data || []), { name: '', value: 0, color: '#3b82f6' }];
                                    setLocalVisualDataCards(updated);
                                  }}
                                >
                                  Add Item
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      } else if (card.type === 'timeline') {
                        return (
                          <div key={cardIndex} className="bg-white border border-gray-200 rounded-lg p-4">
                            {isEditing ? (
                              <Input
                                value={card.title || 'Regulatory Timeline'}
                                onChange={(e) => {
                                  const updated = [...localVisualDataCards];
                                  updated[cardIndex] = { ...updated[cardIndex], title: e.target.value };
                                  setLocalVisualDataCards(updated);
                                }}
                                className="font-medium text-gray-900 mb-3"
                              />
                            ) : (
                              <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                                <Clock className="h-4 w-4 mr-2 text-orange-600" />
                                {card.title || 'Regulatory Timeline'}
                              </h5>
                            )}
                            <div className="space-y-3">
                              {card.data && card.data.length > 0 ? card.data.map((item: any, index: number) => (
                                <div key={index} className="flex items-start space-x-3">
                                  {!isEditing && (
                                    <div className={`w-2 h-2 rounded-full mt-2 ${
                                      item.status === 'critical' ? 'bg-red-500' : 'bg-blue-500'
                                    }`} />
                                  )}
                                  <div className="flex-1 space-y-2">
                                    {isEditing ? (
                                      <>
                                        <Input
                                          value={item.event || item.label || ''}
                                          onChange={(e) => {
                                            const updated = [...localVisualDataCards];
                                            updated[cardIndex].data[index] = { ...updated[cardIndex].data[index], event: e.target.value, label: e.target.value };
                                            setLocalVisualDataCards(updated);
                                          }}
                                          className="text-sm"
                                          placeholder="Event"
                                        />
                                        <Input
                                          value={item.date || item.time || ''}
                                          onChange={(e) => {
                                            const updated = [...localVisualDataCards];
                                            updated[cardIndex].data[index] = { ...updated[cardIndex].data[index], date: e.target.value, time: e.target.value };
                                            setLocalVisualDataCards(updated);
                                          }}
                                          className="text-xs"
                                          placeholder="Date"
                                        />
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const updated = [...localVisualDataCards];
                                            updated[cardIndex].data = updated[cardIndex].data.filter((_: any, i: number) => i !== index);
                                            setLocalVisualDataCards(updated);
                                          }}
                                          className="text-red-600 hover:text-red-700"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <p className="text-sm font-medium text-gray-900">{item.event || item.label}</p>
                                        <p className="text-xs text-gray-500">{item.date || item.time}</p>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )) : <p className="text-gray-500 text-sm">No timeline data available</p>}
                              {isEditing && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const updated = [...localVisualDataCards];
                                    updated[cardIndex].data = [...(updated[cardIndex].data || []), { event: '', date: '', status: 'upcoming' }];
                                    setLocalVisualDataCards(updated);
                                  }}
                                >
                                  Add Timeline Item
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      } else if (card.type === 'percentage') {
                        return (
                          <div key={cardIndex} className="bg-white border border-gray-200 rounded-lg p-4">
                            {isEditing ? (
                              <Input
                                value={card.title || 'GTM Model Effectiveness'}
                                onChange={(e) => {
                                  const updated = [...localVisualDataCards];
                                  updated[cardIndex] = { ...updated[cardIndex], title: e.target.value };
                                  setLocalVisualDataCards(updated);
                                }}
                                className="font-medium text-gray-900 mb-3"
                              />
                            ) : (
                              <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                                <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
                                {card.title || 'GTM Model Effectiveness'}
                              </h5>
                            )}
                            <div className="space-y-3">
                              {card.data && card.data.length > 0 ? card.data.map((item: any, index: number) => (
                                <div key={index} className="flex items-center justify-between gap-2">
                                  {isEditing ? (
                                    <>
                                      <Input
                                        value={item.metric || item.label || ''}
                                        onChange={(e) => {
                                          const updated = [...localVisualDataCards];
                                          updated[cardIndex].data[index] = { ...updated[cardIndex].data[index], metric: e.target.value, label: e.target.value };
                                          setLocalVisualDataCards(updated);
                                        }}
                                        className="flex-1 text-sm"
                                        placeholder="Metric"
                                      />
                                      <Input
                                        type="number"
                                        value={item.value || ''}
                                        onChange={(e) => {
                                          const updated = [...localVisualDataCards];
                                          updated[cardIndex].data[index] = { ...updated[cardIndex].data[index], value: Number(e.target.value) || 0 };
                                          setLocalVisualDataCards(updated);
                                        }}
                                        className="w-20 text-sm"
                                        placeholder="Value"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const updated = [...localVisualDataCards];
                                          updated[cardIndex].data = updated[cardIndex].data.filter((_: any, i: number) => i !== index);
                                          setLocalVisualDataCards(updated);
                                        }}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-sm text-gray-600">{item.metric || item.label}</span>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-sm font-medium text-gray-900">{item.value}%</span>
                                        <TrendingUp className={`h-3 w-3 ${
                                          item.trend === 'up' ? 'text-green-600' : 'text-red-600'
                                        } ${item.trend === 'down' ? 'rotate-180' : ''}`} />
                                      </div>
                                    </>
                                  )}
                                </div>
                              )) : <p className="text-gray-500 text-sm">No percentage data available</p>}
                              {isEditing && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const updated = [...localVisualDataCards];
                                    updated[cardIndex].data = [...(updated[cardIndex].data || []), { metric: '', value: 0, trend: 'up' }];
                                    setLocalVisualDataCards(updated);
                                  }}
                                >
                                  Add Metric
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No compliance analytics data available</p>
                )}
              </div>
            )}

            {/* Regional Breakdown */}
            {!normalizedDeletedSections.has('regional-breakdown') && (
              <div className="relative group border border-gray-200 rounded-lg p-4">
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  <button
                    onClick={() => {
                      toast({
                        title: "Saved",
                        description: "Regional Breakdown changes committed.",
                      });
                    }}
                    className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                    title="Commit changes"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      onDeleteSection('regional-breakdown');
                      onScoutIconClick('regulatory-compliance', true, 'I noticed you removed the Regional Compliance Overview. Want me to help refine or replace it?');
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </button>
                </div>
                <h4 className="text-sm font-medium text-gray-700 mb-4">Regional Compliance Overview</h4>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-medium">Region</TableHead>
                        <TableHead className="font-medium">Framework</TableHead>
                        <TableHead className="font-medium">Deadline</TableHead>
                        <TableHead className="font-medium">Impact</TableHead>
                        <TableHead className="font-medium">Status</TableHead>
                        <TableHead className="font-medium">Key Requirements</TableHead>
                        {isEditing && <TableHead className="font-medium">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(isEditing ? localRegionalData : regionalData).map((region, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {isEditing ? (
                              <Input
                                value={region.region || ''}
                                onChange={(e) => {
                                  const updated = [...localRegionalData];
                                  updated[index] = { ...updated[index], region: e.target.value };
                                  setLocalRegionalData(updated);
                                }}
                                className="w-full text-sm"
                              />
                            ) : (
                              region.region
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                value={region.framework || ''}
                                onChange={(e) => {
                                  const updated = [...localRegionalData];
                                  updated[index] = { ...updated[index], framework: e.target.value };
                                  setLocalRegionalData(updated);
                                }}
                                className="w-full text-sm"
                              />
                            ) : (
                              region.framework
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                value={region.deadline || ''}
                                onChange={(e) => {
                                  const updated = [...localRegionalData];
                                  updated[index] = { ...updated[index], deadline: e.target.value };
                                  setLocalRegionalData(updated);
                                }}
                                className="w-full text-sm"
                              />
                            ) : (
                              region.deadline
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                value={region.impact || ''}
                                onChange={(e) => {
                                  const updated = [...localRegionalData];
                                  updated[index] = { ...updated[index], impact: e.target.value };
                                  setLocalRegionalData(updated);
                                }}
                                className="w-full text-sm"
                              />
                            ) : (
                              <Badge className={`${
                                region.impact === 'High' ? 'bg-red-100 text-red-800' :
                                region.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {region.impact}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                value={region.status || ''}
                                onChange={(e) => {
                                  const updated = [...localRegionalData];
                                  updated[index] = { ...updated[index], status: e.target.value };
                                  setLocalRegionalData(updated);
                                }}
                                className="w-full text-sm"
                              />
                            ) : (
                              <Badge className={`${
                                region.status === 'Active' || region.status === 'Mandatory' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {region.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {isEditing ? (
                              <Input
                                value={region.requirements || ''}
                                onChange={(e) => {
                                  const updated = [...localRegionalData];
                                  updated[index] = { ...updated[index], requirements: e.target.value };
                                  setLocalRegionalData(updated);
                                }}
                                className="w-full text-sm"
                              />
                            ) : (
                              region.requirements
                            )}
                          </TableCell>
                          {isEditing && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setLocalRegionalData(localRegionalData.filter((_, i) => i !== index));
                                }}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {isEditing && (
                    <div className="p-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setLocalRegionalData([...localRegionalData, {
                            region: '',
                            framework: '',
                            deadline: '',
                            impact: 'Medium',
                            status: 'Active',
                            requirements: ''
                          }]);
                        }}
                      >
                        Add Region
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Strategic Recommendations */}
            {!normalizedDeletedSections.has('strategic-recommendations') && (
              <div className="relative group border border-gray-200 rounded-lg p-4">
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  <button
                    onClick={() => {
                      toast({
                        title: "Saved",
                        description: "Strategic Recommendations changes committed.",
                      });
                    }}
                    className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                    title="Commit changes"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      onDeleteSection('strategic-recommendations');
                      onScoutIconClick('regulatory-compliance', true, 'I noticed you removed the Strategic Recommendations. Want me to help refine or replace it?');
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </button>
                </div>
                <h4 className="text-sm font-medium text-gray-700 mb-4">Strategic Recommendations</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        {isEditing ? (
                          <Input
                            value="Mitigate Regulatory Risks"
                            className="font-medium text-blue-900 mb-2"
                            readOnly
                          />
                        ) : (
                          <h5 className="font-medium text-blue-900 mb-2">Mitigate Regulatory Risks</h5>
                        )}
                        <div className="space-y-2">
                          {(isEditing ? localStrategicRecommendations.mitigateRegulatoryRisks : [
                            'Implement privacy by design principles',
                            'Establish automated compliance monitoring',
                            'Regular risk assessments and audits',
                            'Cross-functional compliance team'
                          ]).map((item: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              {isEditing ? (
                                <>
                                  <Input
                                    value={item}
                                    onChange={(e) => {
                                      const updated = [...localStrategicRecommendations.mitigateRegulatoryRisks];
                                      updated[idx] = e.target.value;
                                      setLocalStrategicRecommendations({ ...localStrategicRecommendations, mitigateRegulatoryRisks: updated });
                                    }}
                                    className="flex-1 text-sm text-blue-700"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updated = localStrategicRecommendations.mitigateRegulatoryRisks.filter((_: string, i: number) => i !== idx);
                                      setLocalStrategicRecommendations({ ...localStrategicRecommendations, mitigateRegulatoryRisks: updated });
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <li className="text-sm text-blue-700">• {item}</li>
                              )}
                            </div>
                          ))}
                          {isEditing && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLocalStrategicRecommendations({
                                  ...localStrategicRecommendations,
                                  mitigateRegulatoryRisks: [...localStrategicRecommendations.mitigateRegulatoryRisks, '']
                                });
                              }}
                            >
                              Add Item
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Target className="h-5 w-5 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        {isEditing ? (
                          <Input
                            value="Competitive Positioning"
                            className="font-medium text-green-900 mb-2"
                            readOnly
                          />
                        ) : (
                          <h5 className="font-medium text-green-900 mb-2">Competitive Positioning</h5>
                        )}
                        <div className="space-y-2">
                          {(isEditing ? localStrategicRecommendations.competitivePositioning : [
                            'Market compliance as differentiator',
                            'Showcase security certifications',
                            'Transparent data handling practices',
                            'Industry-leading privacy standards'
                          ]).map((item: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              {isEditing ? (
                                <>
                                  <Input
                                    value={item}
                                    onChange={(e) => {
                                      const updated = [...localStrategicRecommendations.competitivePositioning];
                                      updated[idx] = e.target.value;
                                      setLocalStrategicRecommendations({ ...localStrategicRecommendations, competitivePositioning: updated });
                                    }}
                                    className="flex-1 text-sm text-green-700"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updated = localStrategicRecommendations.competitivePositioning.filter((_: string, i: number) => i !== idx);
                                      setLocalStrategicRecommendations({ ...localStrategicRecommendations, competitivePositioning: updated });
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <li className="text-sm text-green-700">• {item}</li>
                              )}
                            </div>
                          ))}
                          {isEditing && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLocalStrategicRecommendations({
                                  ...localStrategicRecommendations,
                                  competitivePositioning: [...localStrategicRecommendations.competitivePositioning, '']
                                });
                              }}
                            >
                              Add Item
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Building className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div className="flex-1">
                        {isEditing ? (
                          <Input
                            value="Go-to-Market Strategy"
                            className="font-medium text-purple-900 mb-2"
                            readOnly
                          />
                        ) : (
                          <h5 className="font-medium text-purple-900 mb-2">Go-to-Market Strategy</h5>
                        )}
                        <div className="space-y-2">
                          {(isEditing ? localStrategicRecommendations.goToMarketStrategy : [
                            'Regional deployment capabilities',
                            'Compliance-ready product offerings',
                            'Legal-friendly contract templates',
                            'Enterprise-grade data residency'
                          ]).map((item: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              {isEditing ? (
                                <>
                                  <Input
                                    value={item}
                                    onChange={(e) => {
                                      const updated = [...localStrategicRecommendations.goToMarketStrategy];
                                      updated[idx] = e.target.value;
                                      setLocalStrategicRecommendations({ ...localStrategicRecommendations, goToMarketStrategy: updated });
                                    }}
                                    className="flex-1 text-sm text-purple-700"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updated = localStrategicRecommendations.goToMarketStrategy.filter((_: string, i: number) => i !== idx);
                                      setLocalStrategicRecommendations({ ...localStrategicRecommendations, goToMarketStrategy: updated });
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <li className="text-sm text-purple-700">• {item}</li>
                              )}
                            </div>
                          ))}
                          {isEditing && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLocalStrategicRecommendations({
                                  ...localStrategicRecommendations,
                                  goToMarketStrategy: [...localStrategicRecommendations.goToMarketStrategy, '']
                                });
                              }}
                            >
                              Add Item
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save/Cancel buttons and Edit History - positioned at bottom */}
            <div className="flex justify-between items-center pt-6 border-t border-gray-200">
              <div className="flex gap-3">
                <Button 
                  onClick={() => {
                    // Log original and modified JSON for debugging
                    const originalJson = {
                      executiveSummary: executiveSummary || '',
                      euAiActDeadline: euAiActDeadline || '',
                      gdprCompliance: gdprCompliance || '',
                      potentialFines: potentialFines || '',
                      dataLocalization: dataLocalization || '',
                      keyUpdates: regulatoryData?.keyUpdates || []
                    };

                    const modifiedJson = {
                      executiveSummary: localExecutiveSummary,
                      euAiActDeadline: localEuAiActDeadline,
                      gdprCompliance: localGdprCompliance,
                      potentialFines: localPotentialFines,
                      dataLocalization: localDataLocalization,
                      keyUpdates: regulatoryData?.keyUpdates?.map((update: any) => {
                        const id = update.title.toLowerCase().replace(/\s+/g, '-');
                        let localValue = localKeyDataValues[id];
                        
                        // Check for specific fixed fields that have their own local state
                        if (id === 'eu-ai-act-deadline' || id === 'eu-ai-act') {
                          localValue = localEuAiActDeadline;
                        } else if (id === 'gdpr-compliance') {
                          localValue = localGdprCompliance;
                        } else if (id === 'potential-fines') {
                          localValue = localPotentialFines;
                        } else if (id === 'data-localization') {
                          localValue = localDataLocalization;
                        }
                        
                        if (localValue !== undefined) {
                          return { ...update, description: localValue };
                        }
                        return update;
                      }) || []
                    };

                     console.log('⚖️ Regulatory Compliance Section - original_json:', JSON.stringify(originalJson, null, 2));
                     console.log('⚖️ Regulatory Compliance Section - modified_json:', JSON.stringify(modifiedJson, null, 2));

                     // Store JSON data in localStorage for Scout API (user-specific)
                     setUserLocalStorage('regulatory-compliance_original_json', JSON.stringify(originalJson), currentUser?.uid);
                     setUserLocalStorage('regulatory-compliance_modified_json', JSON.stringify(modifiedJson), currentUser?.uid);

                     // First, call all the change handlers to update parent state with local values
                    onExecutiveSummaryChange(localExecutiveSummary);
                    onEuAiActDeadlineChange(localEuAiActDeadline);
                    onGdprComplianceChange(localGdprCompliance);
                    onPotentialFinesChange(localPotentialFines);
                    onDataLocalizationChange(localDataLocalization);
                    
                    // Update key data points if regulatoryData exists
                    if (regulatoryData?.keyUpdates && Array.isArray(regulatoryData.keyUpdates)) {
                      // For key updates, we need to update the regulatoryData directly since there's no individual change handlers
                      const updatedKeyUpdates = regulatoryData.keyUpdates.filter((update: any) => update && update.title).map((update: any) => {
                        const id = update.title.toLowerCase().replace(/\s+/g, '-');
                        const localValue = localKeyDataValues[id];
                        if (localValue !== undefined) {
                          return { ...update, description: localValue };
                        }
                        return update;
                      });
                      
                      // Update the regulatory data with new key updates
                      // Update regulatory data would be handled by parent component
                    }
                    
                    // Then call the API save function
                    handleRegulatoryComplianceSaveChanges();
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
                <Button 
                  variant="outline" 
                  onClick={onCancelEdit}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
              
              {/* Edit History Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={onEditHistoryOpen}
                className="flex items-center gap-2 hover:bg-gray-50"
                title="View changes made to this report"
              >
                <Clock className="h-4 w-4" />
                Edit History
              </Button>
            </div>
          </div>
        ) : (
          /* Normal View Mode */
          <>
            {/* Executive Summary */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Executive Summary</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                 {currentExecutiveSummary || 'The regulatory landscape for SaaS companies continues to evolve rapidly, with new compliance requirements emerging across multiple jurisdictions.'}
               </p>
            </div>

            {/* Key Data Points */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Key Regulatory Updates</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {keyDataPoints.map((point) => {
                  const IconComponent = point.icon;
                  return (
                    <div
                      key={point.id}
                      className="relative p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-pointer"
                      onMouseEnter={() => setHoveredCard(point.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <IconComponent className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="text-sm font-medium text-gray-900 leading-tight">
                              {point.title}
                            </h5>
                            <Badge className={`${point.badgeColor} text-xs`}>
                              {point.badge}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{point.value}</p>
                        </div>
                      </div>

                      {/* Tooltip */}
                      {hoveredCard === point.id && (
                        <div className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg max-w-xs">
                          <p>{point.tooltip}</p>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Read More Button - Only when not expanded */}
            {!isExpanded && (
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

            {/* Enhanced Expanded Content */}
            {isExpanded && (
              <div className="space-y-8 pt-6 border-t border-gray-200">
                {/* Visual Data Cards */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-4">Compliance Analytics</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {visualDataCards.map((card, cardIndex) => (
                      <div key={cardIndex} className="bg-white border border-gray-200 rounded-lg p-4">
                        <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                          {card.type === 'pie-chart' && <Users className="h-4 w-4 mr-2 text-blue-600" />}
                          {card.type === 'line-chart' && <TrendingUp className="h-4 w-4 mr-2 text-green-600" />}
                          {card.type === 'bar-chart' && <BarChart3 className="h-4 w-4 mr-2 text-purple-600" />}
                          {!card.type && <Users className="h-4 w-4 mr-2 text-blue-600" />}
                          {card.title}
                        </h5>

                        {/* Render based on chart type */}
                        {card.type === 'pie-chart' ? (
                          <MiniPieChart 
                            data={card.data.map((item: any) => ({
                              name: item.label,
                              value: item.value,
                              color: `hsl(${cardIndex * 137 + item.value * 2}, 70%, 50%)`
                            }))}
                            title={card.title}
                          />
                        ) : card.type === 'line-chart' ? (
                          <MiniLineChart 
                            data={card.data.map((item: any) => ({
                              name: item.label,
                              value: item.value
                            }))}
                            title={card.title}
                            color={`hsl(${cardIndex * 120}, 70%, 50%)`}
                          />
                        ) : card.type === 'bar-chart' ? (
                          <div className="space-y-3">
                            {(() => {
                              // Find max value to normalize progress bars
                              const maxValue = Math.max(...card.data.map((item: any) => Number(item.value) || 0));
                              const normalizeValue = (val: number) => maxValue > 100 ? Math.min((val / maxValue) * 100, 100) : Math.min(val, 100);
                              
                              return card.data.map((item: any, index: number) => {
                                const numericValue = Number(item.value) || 0;
                                const normalizedWidth = normalizeValue(numericValue);
                                
                                return (
                                  <div key={index} className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">{item.label || item.name}</span>
                                    <div className="flex items-center space-x-2">
                                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div 
                                          className="h-2 rounded-full" 
                                          style={{ 
                                            width: `${normalizedWidth}%`, 
                                            backgroundColor: item.color || `hsl(${index * 60}, 70%, 50%)`,
                                            maxWidth: '100%'
                                          }}
                                        />
                                      </div>
                                      <span className="text-sm font-medium text-gray-900">{item.value}{card.title?.includes('Growth') ? 'B' : ''}</span>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        ) : card.type === 'timeline' ? (
                          <div className="space-y-3">
                            {card.data.map((item: any, index: number) => (
                              <div key={index} className="flex items-start space-x-3">
                                <div className={`w-2 h-2 rounded-full mt-2 ${
                                  item.status === 'critical' ? 'bg-red-500' : 'bg-blue-500'
                                }`} />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">{item.event || item.label}</p>
                                  <p className="text-xs text-gray-500">{item.date || item.time}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : card.type === 'percentage' ? (
                          <div className="space-y-3">
                            {card.data.map((item: any, index: number) => (
                              <div key={index} className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">{item.metric || item.label}</span>
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-medium text-gray-900">{item.value}%</span>
                                  <TrendingUp className={`h-3 w-3 ${
                                    item.trend === 'up' ? 'text-green-600' : 'text-red-600'
                                  } ${item.trend === 'down' ? 'rotate-180' : ''}`} />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          /* Fallback for unknown types or old format */
                          <div className="space-y-3">
                            {card.data.map((item: any, index: number) => (
                              <div key={index} className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">{item.metric || item.name || item.label}</span>
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-medium text-gray-900">{item.value}%</span>
                                  {item.trend && (
                                    <TrendingUp className={`h-3 w-3 ${
                                      item.trend === 'up' ? 'text-green-600' : 'text-red-600'
                                    } ${item.trend === 'down' ? 'rotate-180' : ''}`} />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Regional Breakdown */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-4">Regional Compliance Overview</h4>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-medium">Region</TableHead>
                          <TableHead className="font-medium">Framework</TableHead>
                          <TableHead className="font-medium">Deadline</TableHead>
                          <TableHead className="font-medium">Impact</TableHead>
                          <TableHead className="font-medium">Status</TableHead>
                          <TableHead className="font-medium">Key Requirements</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {regionalData.map((region, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{region.region}</TableCell>
                            <TableCell>{region.framework}</TableCell>
                            <TableCell>{region.deadline}</TableCell>
                            <TableCell>
                              <Badge className={`${
                                region.impact === 'High' ? 'bg-red-100 text-red-800' :
                                region.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {region.impact}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${
                                region.status === 'Active' || region.status === 'Mandatory' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {region.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">{region.requirements}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Strategic Recommendations */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-4">Strategic Recommendations</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <h5 className="font-medium text-blue-900 mb-2">
                            {regulatoryData?.strategicRecommendations ? 'Mitigate Regulatory Risks' : 'Mitigate Regulatory Risks'}
                          </h5>
                          <ul className="text-sm text-blue-700 space-y-1">
                            {regulatoryData?.strategicRecommendations?.mitigateRegulatoryRisks ? 
                              regulatoryData.strategicRecommendations.mitigateRegulatoryRisks.map((item: string, index: number) => (
                                <li key={index}>• {item}</li>
                              )) : (
                              <>
                                <li>• Implement privacy by design principles</li>
                                <li>• Establish automated compliance monitoring</li>
                                <li>• Regular risk assessments and audits</li>
                                <li>• Cross-functional compliance team</li>
                              </>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Target className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <h5 className="font-medium text-green-900 mb-2">
                            {regulatoryData?.strategicRecommendations ? 'Competitive Positioning' : 'Competitive Positioning'}
                          </h5>
                          <ul className="text-sm text-green-700 space-y-1">
                            {regulatoryData?.strategicRecommendations?.competitivePositioning ? 
                              regulatoryData.strategicRecommendations.competitivePositioning.map((item: string, index: number) => (
                                <li key={index}>• {item}</li>
                              )) : (
                              <>
                                <li>• Market compliance as differentiator</li>
                                <li>• Showcase security certifications</li>
                                <li>• Transparent data handling practices</li>
                                <li>• Industry-leading privacy standards</li>
                              </>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Building className="h-5 w-5 text-purple-600 mt-0.5" />
                        <div>
                          <h5 className="font-medium text-purple-900 mb-2">
                            {regulatoryData?.strategicRecommendations ? 'Go-to-Market Strategy' : 'Go-to-Market Strategy'}
                          </h5>
                          <ul className="text-sm text-purple-700 space-y-1">
                            {regulatoryData?.strategicRecommendations?.goToMarketStrategy ? 
                              regulatoryData.strategicRecommendations.goToMarketStrategy.map((item: string, index: number) => (
                                <li key={index}>• {item}</li>
                              )) : (
                              <>
                                <li>• Regional deployment capabilities</li>
                                <li>• Compliance-ready product offerings</li>
                                <li>• Legal-friendly contract templates</li>
                                <li>• Enterprise-grade data residency</li>
                              </>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
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
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RegulatoryComplianceSection;
