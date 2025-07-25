import React, { useEffect, useState } from 'react';
import { Bot, Edit, X, FileText, Save, Share, Clock, Crown, ArrowUp, ArrowDown, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
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

interface CompetitorLandscapeData {
  majorCompetitors: string[];
  marketShares: Record<string, string>;
  competitiveAdvantages: string[];
  emergingThreats: string[];
  marketPositioning: string;
  swotAnalysis: string[];
  timestamp?: string; // Add timestamp to track data generation time
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
}

interface ApiCompetitorData {
  section?: {
    title?: string;
    description?: string;
    metrics?: Array<{ label: string; value: string; trend?: string }>;
    tags?: string[];
  };
  report?: {
    title?: string;
    executiveSummary?: string;
    dataPoints?: Array<{ label: string; value: string }>;
  };
  swotAnalysis?: {
    entities?: Array<{
      name: string;
      strengths?: string[];
      weaknesses?: string[];
    }>;
  };
  news?: {
    headlines?: string[];
  };
  marketShareCharts?: {
    regions?: Array<{
      name: string;
      data: Record<string, string>;
    }>;
  };
  featureComparison?: {
    features?: string[];
    tools?: Record<string, string[]>;
  };
  mnaInsights?: {
    insights?: Array<{
      label: string;
      description: string;
    }>;
  };
  marketTrends?: {
    charts?: Array<{ name: string; xAxis: any }>;
  };
}

const CompetitorLandscapeSection: React.FC<CompetitorLandscapeSectionProps> = ({
  isEditing,
  isSplitView,
  isExpanded,
  hasEdits,
  deletedSections,
  editHistory,
  executiveSummary,
  topPlayerShare,
  emergingPlayers,
  fundingNews,
  onToggleEdit,
  onScoutIconClick,
  onEditHistoryOpen,
  onDeleteSection,
  onSaveChanges,
  onCancelEdit,
  onExpandToggle,
  onExecutiveSummaryChange,
  onTopPlayerShareChange,
  onEmergingPlayersChange,
  onFundingNewsChange,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink
}) => {
  const [apiData, setApiData] = useState<ApiCompetitorData>({});
  const [competitorData, setCompetitorData] = useState<CompetitorLandscapeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit state variables
  const [editMajorCompetitors, setEditMajorCompetitors] = useState<string[]>([]);
  const [editMarketShares, setEditMarketShares] = useState<Record<string, string>>({});
  const [editCompetitiveAdvantages, setEditCompetitiveAdvantages] = useState<string[]>([]);
  const [editEmergingThreats, setEditEmergingThreats] = useState<string[]>([]);
  const [editMarketPositioning, setEditMarketPositioning] = useState<string>('');
  const [editSwotAnalysis, setEditSwotAnalysis] = useState<string[]>([]);

  useEffect(() => {
    const fetchCompetitorData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Load existing data from localStorage first
        let currentStoredData: CompetitorLandscapeData | null = null;
        try {
          const storedData = localStorage.getItem('competitorLandscapeData');
          if (storedData) {
            currentStoredData = JSON.parse(storedData);
            console.log('📦 Loading stored Competitor Landscape data with timestamp:', currentStoredData?.timestamp);
            setCompetitorData(currentStoredData);
            // Initialize edit fields with stored data
            if (currentStoredData) {
              setEditMajorCompetitors(currentStoredData.majorCompetitors || []);
              setEditMarketShares(currentStoredData.marketShares || {});
              setEditCompetitiveAdvantages(currentStoredData.competitiveAdvantages || []);
              setEditEmergingThreats(currentStoredData.emergingThreats || []);
              setEditMarketPositioning(currentStoredData.marketPositioning || '');
              setEditSwotAnalysis(currentStoredData.swotAnalysis || []);
            }
          }
        } catch (error) {
          console.error('Error loading stored competitor data:', error);
        }
        
        console.log('🔍 Fetching competitor data...');
        console.log('🌐 Testing CORS with Competitor Landscape API call...');
        
        const currentTime = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const payload = {
          user_id: "brewra",
          component_name: "competitor landscape",
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
        
        console.log('📤 Sending API request to:', 'https://backend-11kr.onrender.com/market-research');
        console.log('📦 Competitor Landscape Payload:', payload);
        console.log('📦 Payload keys:', Object.keys(payload));
        console.log('📦 Data keys:', Object.keys(payload.data));

        // Add debugging to track data freshness
        const requestTimestamp = Date.now();
        console.log('⏰ COMPETITOR LANDSCAPE REQUEST TIMESTAMP:', requestTimestamp);
        console.log('🔄 FORCE_REFRESH in payload:', payload.refresh);
        
        const response = await fetch('https://backend-11kr.onrender.com/market-research', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        console.log('📥 Competitor Landscape API response:', response);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('📊 Full API Response Structure:', result);
        console.log('📊 Competitor Landscape Data Keys:', Object.keys(result.data || {}));
        
        if (result.status === 'success' && result.data) {
          const reportData = result.data;
          
          // Debug the original timestamps before conversion
          console.log('🔍 TIMESTAMP DEBUG:');
          console.log('  - Original swagger timestamp from API:', reportData.timestamp);
          console.log('  - Current stored timestamp:', currentStoredData?.timestamp);
          
          // Convert timestamps to UTC for comparison using stored data
          const currentTimestampUTC = toUTCTimestamp(currentStoredData?.timestamp);
          const newTimestampUTC = toUTCTimestamp(reportData.timestamp);
          
          console.log('  - After toUTCTimestamp conversion:');
          console.log('    - Current UTC:', currentTimestampUTC);
          console.log('    - New UTC:', newTimestampUTC);
          
          logTimestampComparison(
            currentStoredData?.timestamp,
            reportData.timestamp,
            'COMPETITOR LANDSCAPE'
          );
          
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
          
          console.log('🔄 COMPETITOR LANDSCAPE UPDATE DECISION:');
          console.log('  - Should update data:', shouldUpdate);
          console.log('  - Current data timestamp:', currentTimestampUTC || 'NO_TIMESTAMP');
          console.log('  - New data timestamp:', newTimestampUTC || 'NO_TIMESTAMP');
          console.log('  - Reason for update:', updateReason);
          
          if (shouldUpdate) {
            console.log('✅ Found data in API response and data is newer - updating');
            console.log('🗺️ Raw API response structure:', reportData);
            
            // Map Swagger API response to frontend data structure
            const strategicRecommendations = reportData.strategic_recommendations || [];
            const marketDrivers = reportData.market_drivers || [];
            
            // Since the API doesn't return competitor-specific data, we need to create
            // meaningful competitor analysis based on the target market and region
            const targetMarket = reportData.target_market || "Target Market";
            const region = reportData.region || "Market Region";
            const company = reportData.company || "Company";
            
            // Generate relevant competitors based on the market context
            let competitorNames: string[] = [];
            let marketShares: Record<string, string> = {};
            
            if (reportData.segment_breakdown) {
              // Use segment data to create competitor categories
              const segments = Object.keys(reportData.segment_breakdown);
              competitorNames = segments.map(segment => {
                switch(segment) {
                  case 'health_conscious': return 'Health-Focused Brands';
                  case 'eco_conscious': return 'Eco-Friendly Companies';
                  case 'both': return 'Hybrid Health-Eco Brands';
                  case 'premium': return 'Premium Market Leaders';
                  case 'budget': return 'Budget Competitors';
                  default: return `${segment.charAt(0).toUpperCase() + segment.slice(1)} Players`;
                }
              });
              
              // Map segment percentages to market shares
              Object.entries(reportData.segment_breakdown).forEach(([key, value], index) => {
                if (competitorNames[index]) {
                  marketShares[competitorNames[index]] = `${value}%`;
                }
              });
            } else {
              // Fallback generic competitors for the market
              competitorNames = [
                'Market Leader',
                'Emerging Player 1', 
                'Emerging Player 2',
                'Niche Competitor'
              ];
              competitorNames.forEach((competitor, index) => {
                const percentages = ['35%', '28%', '22%', '15%'];
                marketShares[competitor] = percentages[index] || '10%';
              });
            }
            
            console.log('🗺️ Mapping Swagger data to frontend structure:');
            console.log('  - Competitors:', competitorNames);
            console.log('  - Market shares:', marketShares);
            console.log('  - Strategic recommendations:', strategicRecommendations);
            console.log('  - Market drivers:', marketDrivers);
            console.log('  - Segment breakdown:', reportData.segment_breakdown);
            
            const updatedData: CompetitorLandscapeData = {
              majorCompetitors: competitorNames,
              marketShares: marketShares,
              competitiveAdvantages: strategicRecommendations,
              emergingThreats: ["New sustainable brands", "Tech-enabled eco platforms"],
              marketPositioning: marketDrivers.join('. '),
              swotAnalysis: [
                ...strategicRecommendations.map((rec: string) => `Opportunity: ${rec}`),
                ...marketDrivers.map((driver: string) => `Driver: ${driver}`)
              ],
              timestamp: reportData.timestamp // Use original swagger timestamp directly
            };
            
            console.log('🔍 TIMESTAMP PRESERVATION CHECK:');
            console.log('  - Original reportData.timestamp:', reportData.timestamp);
            console.log('  - Converted newTimestampUTC:', newTimestampUTC);
            console.log('  - Final updatedData.timestamp:', updatedData.timestamp);
            
            console.log('🔄 Updating Competitor Landscape data with newer report');
            console.log('✅ COMPETITOR LANDSCAPE DATA UPDATED - Component name:', reportData.component_name);
            
            setCompetitorData(updatedData);
            
            // Save updated data to localStorage with UTC timestamp
            localStorage.setItem('competitorLandscapeData', JSON.stringify(updatedData));
            console.log('💾 Saved Competitor Landscape data to localStorage with timestamp:', updatedData.timestamp);
            
            // Initialize edit fields with fetched data
            setEditMajorCompetitors(updatedData.majorCompetitors);
            setEditMarketShares(updatedData.marketShares);
            setEditCompetitiveAdvantages(updatedData.competitiveAdvantages);
            setEditEmergingThreats(updatedData.emergingThreats);
            setEditMarketPositioning(updatedData.marketPositioning);
            setEditSwotAnalysis(updatedData.swotAnalysis);
          } else {
            console.log('⏭️ Competitor Landscape data is up to date - no update needed');
            console.log('  - Current timestamp (UTC):', currentTimestampUTC);
            console.log('  - New timestamp (UTC):', newTimestampUTC);
          }
        }
        
        // Also parse UI components for display purposes
        const apiCompetitorData: ApiCompetitorData = {};
        if (result.uiComponents && Array.isArray(result.uiComponents)) {
          console.log('📊 Processing uiComponents array, length:', result.uiComponents.length);
          result.uiComponents.forEach((component: any, index: number) => {
            console.log(`📊 Component ${index}:`, component.type, component.title);
            switch (component.type) {
              case 'section':
                if (component.title?.toLowerCase().includes('competitor')) {
                  apiCompetitorData.section = component;
                  console.log('✅ Found competitor section component');
                }
                break;
              case 'report':
                if (component.title?.toLowerCase().includes('competitor')) {
                  apiCompetitorData.report = component;
                  console.log('✅ Found competitor report component');
                }
                break;
              case 'swotAnalysis':
                apiCompetitorData.swotAnalysis = component;
                console.log('✅ Found SWOT analysis component');
                break;
              case 'news':
                apiCompetitorData.news = component;
                console.log('✅ Found news component');
                break;
              case 'marketShareCharts':
                apiCompetitorData.marketShareCharts = component;
                console.log('✅ Found market share charts component');
                break;
              case 'featureComparison':
                apiCompetitorData.featureComparison = component;
                console.log('✅ Found feature comparison component');
                break;
              case 'mnaInsights':
                apiCompetitorData.mnaInsights = component;
                console.log('✅ Found M&A insights component');
                break;
              case 'marketTrends':
                apiCompetitorData.marketTrends = component;
                console.log('✅ Found market trends component');
                break;
            }
          });
        }
        
        setApiData(apiCompetitorData);
      } catch (error) {
        console.error('Error fetching competitor data:', error);
        
        // Check if it's a CORS error and provide fallback data
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          console.log('🔄 CORS error detected - using mock data as fallback');
          
          // Create mock data based on your expected API response structure
          const mockApiResponse = {
            status: "success",
            data: {
              market_size: 1.2,
              segment_breakdown: {
                health_conscious: 60,
                eco_conscious: 30,
                both: 10
              },
              strategic_recommendations: [
                "Increase brand awareness through social media campaigns",
                "Partner with eco-friendly suppliers to reduce carbon footprint",
                "Expand product line to cater to diverse consumer preferences"
              ],
              market_drivers: [
                "Growing demand for sustainable products",
                "Increasing awareness about health and wellness",
                "Government initiatives to promote eco-friendly practices"
              ],
              company: "EcoFit India",
              product: "GreenActive Wear",
              target_market: "Health & eco-conscious Indian consumers (urban)",
              region: "India",
              component_name: "competitor landscape",
              timestamp: new Date().toISOString()
            }
          };
          
          // Process the mock data the same way as real API data
          const reportData = mockApiResponse.data;
          
          // Get the stored data for timestamp comparison
          let storedDataForTimestamp: CompetitorLandscapeData | null = null;
          try {
            const storedData = localStorage.getItem('competitorLandscapeData');
            if (storedData) {
              storedDataForTimestamp = JSON.parse(storedData);
            }
          } catch (error) {
            console.error('Error loading stored data for timestamp comparison:', error);
          }
          
          const currentTimestampUTC = toUTCTimestamp(storedDataForTimestamp?.timestamp);
          const newTimestampUTC = toUTCTimestamp(reportData.timestamp);
          
          const strategicRecommendations = reportData.strategic_recommendations || [];
          const marketDrivers = reportData.market_drivers || [];
          const competitorNames = ["EcoFit India", "GreenActive Wear", "Sustainable Brands", "Eco Leaders"];
          
          const marketShares: Record<string, string> = {};
          if (reportData.segment_breakdown) {
            Object.entries(reportData.segment_breakdown).forEach(([key, value], index) => {
              const competitorName = competitorNames[index] || `Competitor ${index + 1}`;
              marketShares[competitorName] = `${value}%`;
            });
          }
          
          const mockData: CompetitorLandscapeData = {
            majorCompetitors: competitorNames,
            marketShares: marketShares,
            competitiveAdvantages: strategicRecommendations,
            emergingThreats: ["New sustainable brands", "Tech-enabled eco platforms"],
            marketPositioning: marketDrivers.join('. '),
            swotAnalysis: [
              ...strategicRecommendations.map((rec: string) => `Opportunity: ${rec}`),
              ...marketDrivers.map((driver: string) => `Driver: ${driver}`)
            ],
            timestamp: newTimestampUTC
          };
          
          console.log('✅ Using mock competitor data due to CORS error');
          setCompetitorData(mockData);
          localStorage.setItem('competitorLandscapeData', JSON.stringify(mockData));
          
          // Initialize edit fields
          setEditMajorCompetitors(mockData.majorCompetitors);
          setEditMarketShares(mockData.marketShares);
          setEditCompetitiveAdvantages(mockData.competitiveAdvantages);
          setEditEmergingThreats(mockData.emergingThreats);
          setEditMarketPositioning(mockData.marketPositioning);
          setEditSwotAnalysis(mockData.swotAnalysis);
        } else {
          setError(error instanceof Error ? error.message : 'Failed to fetch data');
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Add a small delay to prevent race condition with other API calls
    setTimeout(() => {
      fetchCompetitorData();
    }, 500);
  }, []);
  const handleCompetitorSaveChanges = () => {
    onSaveChanges();
  };

  const handleFundingNewsChange = (index: number, value: string) => {
    const newNews = [...fundingNews];
    newNews[index] = value;
    onFundingNewsChange(newNews);
  };

  // Helper functions to get data from API or fallback to props
  const getExecutiveSummary = () => {
    return apiData.report?.executiveSummary || executiveSummary || "The enterprise collaboration tools market is increasingly competitive, with several dominant players holding significant market share.";
  };

  const getTopPlayerShare = () => {
    const metric = apiData.section?.metrics?.find(m => m.label.toLowerCase().includes('market share'));
    return metric?.value || topPlayerShare || "48%";
  };

  const getEmergingPlayers = () => {
    const metric = apiData.section?.metrics?.find(m => m.label.toLowerCase().includes('emerging'));
    return metric?.value || emergingPlayers || "2";
  };

  const getCompetitorTags = () => {
    console.log('🏷️ getCompetitorTags called with:');
    console.log('  - competitorData?.majorCompetitors:', competitorData?.majorCompetitors);
    console.log('  - apiData.section?.tags:', apiData.section?.tags);
    console.log('  - fallback tags:', ["Microsoft Teams", "Slack", "Zoom", "Notion", "Asana"]);
    
    const result = competitorData?.majorCompetitors || apiData.section?.tags || ["Microsoft Teams", "Slack", "Zoom", "Notion", "Asana"];
    console.log('  - returning:', result);
    return result;
  };

  const getNewsHeadlines = () => {
    return apiData.news?.headlines || fundingNews || [
      "Notion raises $300M Series C - Valuation reaches $10B as workspace tools gain traction",
      "Microsoft Teams launches AI Copilot - New AI features for meeting summaries and task automation",
      "Slack introduces Workflow Builder 2.0 - Enhanced automation capabilities for enterprise customers"
    ];
  };

  const getDataPoints = () => {
    return apiData.report?.dataPoints || [
      { label: "Top 3 Players", value: "Microsoft Teams (35%), Slack (28%), Zoom (22%)" },
      { label: "Emerging Players", value: "Asana (8%), Notion (7%)" },
      { label: "Key Moves", value: "$300M funding round by Notion; new AI feature launch by Teams" }
    ];
  };

  const getSwotEntities = () => {
    return apiData.swotAnalysis?.entities || [
      {
        name: "Microsoft Teams",
        strengths: ["Office 365 integration", "Enterprise adoption"],
        weaknesses: ["Complex interface", "Resource heavy"]
      },
      {
        name: "Slack",
        strengths: ["Developer-friendly", "Third-party apps"],
        weaknesses: ["Limited video features", "Premium pricing"]
      }
    ];
  };

  const getMarketShareRegions = () => {
    return apiData.marketShareCharts?.regions || [
      {
        name: "North America",
        data: {
          "Microsoft Teams": "40%",
          "Slack": "32%",
          "Zoom": "18%",
          "Others": "10%"
        }
      },
      {
        name: "APAC Region",
        data: {
          "Microsoft Teams": "30%",
          "Zoom": "28%",
          "Slack": "22%",
          "Others": "20%"
        }
      }
    ];
  };

  const getFeatureComparison = () => {
    return {
      features: apiData.featureComparison?.features || ["Video Conferencing", "File Sharing", "Third-party Integrations", "AI Features"],
      tools: apiData.featureComparison?.tools || {
        "Teams": ["✓", "✓✓", "✓", "✓✓"],
        "Slack": ["Limited", "✓", "✓✓", "✓"],
        "Zoom": ["✓✓", "✓", "✓", "✓"],
        "Notion": ["✗", "✓✓", "✓", "✓"]
      }
    };
  };

  const getMnaInsights = () => {
    return apiData.mnaInsights?.insights || [
      {
        label: "High Acquisition Likelihood",
        description: "Notion and Asana showing strong growth metrics attractive to tech giants"
      },
      {
        label: "Potential Acquirers",
        description: "Google, Meta, and Salesforce actively seeking collaboration tool acquisitions"
      },
      {
        label: "Market Consolidation Risk",
        description: "Smaller players may struggle to compete with integrated enterprise suites"
      }
    ];
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 relative">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading competitor landscape data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 relative">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">Error loading data: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 relative">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Crown className="h-5 w-5 text-purple-600" />
            Competitor Landscape
          </h2>
          <p className="text-sm text-gray-600 mt-1">Analyze your competitive environment & market dynamics.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onToggleEdit} className="text-blue-800 hover:text-blue-900">
            <Edit className="h-4 w-4" />
          </Button>
          {!isSplitView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onScoutIconClick('competitor-landscape')}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200 hover:shadow-md hover:shadow-blue-200/50 relative"
                >
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

      {isEditing ? (
        <div className="space-y-8">
          {/* Executive Summary Edit */}
          {!deletedSections.has('executive-summary') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteSection('executive-summary')}
                    className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <Label htmlFor="competitorExecutiveSummary" className="text-sm font-medium text-gray-700 mb-2 block">
                  Executive Summary
                </Label>
                <Textarea
                  id="competitorExecutiveSummary"
                  value={executiveSummary || getExecutiveSummary()}
                  onChange={(e) => onExecutiveSummaryChange(e.target.value)}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteSection('key-metrics')}
                    className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="topPlayerShare" className="text-sm font-medium text-gray-700 mb-2 block">
                      Top Player Market Share
                    </Label>
                    <Input
                      id="topPlayerShare"
                      value={topPlayerShare || getTopPlayerShare()}
                      onChange={(e) => onTopPlayerShareChange(e.target.value)}
                      placeholder="e.g., 48%"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergingPlayers" className="text-sm font-medium text-gray-700 mb-2 block">
                      Emerging Players Added
                    </Label>
                    <Input
                      id="emergingPlayers"
                      value={emergingPlayers || getEmergingPlayers()}
                      onChange={(e) => onEmergingPlayersChange(e.target.value)}
                      placeholder="e.g., 2"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Funding News Edit */}
          {!deletedSections.has('funding-news') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteSection('funding-news')}
                    className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Funding News & Headlines
                </Label>
                {(fundingNews.length > 0 ? fundingNews : getNewsHeadlines()).map((news, index) => (
                  <Textarea
                    key={index}
                    value={news}
                    onChange={(e) => handleFundingNewsChange(index, e.target.value)}
                    className="w-full h-16 resize-none mb-3"
                    placeholder={`News headline ${index + 1}...`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Save/Cancel Buttons */}
          <div className="flex items-center gap-3 pt-6 border-t">
            <Button onClick={handleCompetitorSaveChanges}>Save Changes</Button>
            <Button variant="outline" onClick={onCancelEdit}>Cancel</Button>
            <div className="flex-1"></div>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEditHistoryOpen}
                  className={`text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${
                    editHistory.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={editHistory.length === 0}
                >
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
                  onClick={() => onScoutIconClick('competitor-landscape')}
                  className="text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 hover:shadow-md hover:shadow-blue-200/50 transition-all duration-200 relative"
                >
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
          {/* Executive Summary - Collapsed */}
          <div>
            <p className="text-gray-700 mb-4">
              {getExecutiveSummary()}
            </p>
            
            {/* Metric Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-blue-600">{getTopPlayerShare()}</div>
                    <div className="text-sm text-gray-700">Top Player Market Share</div>
                  </div>
                  <ArrowUp className="h-4 w-4 text-green-500" />
                </div>
              </div>
              <div className="border border-green-200 p-4 rounded-lg bg-amber-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-green-600">{getEmergingPlayers()}</div>
                    <div className="text-sm text-gray-700">Emerging Players Added</div>
                  </div>
                  <ArrowDown className="h-4 w-4 text-red-500" />
                </div>
              </div>
            </div>

            {/* Competitor Chips */}
            <div className="flex flex-wrap gap-2 mb-6">
              {(() => {
                const tags = getCompetitorTags();
                console.log('🎯 About to render competitor tags:', tags);
                return tags.map((tag, index) => (
                <Badge 
                  key={index}
                  variant="outline" 
                  className={`${
                    index % 5 === 0 ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' :
                    index % 5 === 1 ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' :
                    index % 5 === 2 ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' :
                    index % 5 === 3 ? 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100' :
                    'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                  } cursor-pointer`}
                >
                  {tag}
                </Badge>
              ));
              })()}
            </div>
          </div>

          {/* Read More Button */}
          {!isExpanded && (
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

          {/* Expanded Content - Full Report */}
          {isExpanded && (
            <div className="animate-fade-in border-t pt-6 space-y-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Competitor Landscape Report
              </h2>

              {/* Executive Summary - Expanded */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Executive Summary</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700 mb-4">
                    {getExecutiveSummary()}
                  </p>
                  <div className="space-y-2">
                    {getDataPoints().map((point, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          index % 3 === 0 ? 'bg-blue-500' :
                          index % 3 === 1 ? 'bg-green-500' : 'bg-purple-500'
                        }`}></div>
                        <span className="text-gray-700">{point.label}: {point.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Competitive SWOT Analyses */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Competitive SWOT Analyses</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {getSwotEntities().map((entity, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">{entity.name}</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <h5 className="font-medium text-green-700 mb-1">Strengths</h5>
                          <ul className="text-gray-600 space-y-1">
                            {entity.strengths?.map((strength, idx) => (
                              <li key={idx}>• {strength}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-red-700 mb-1">Weaknesses</h5>
                          <ul className="text-gray-600 space-y-1">
                            {entity.weaknesses?.map((weakness, idx) => (
                              <li key={idx}>• {weakness}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Funding Rounds & News Headlines */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Funding Rounds & News Headlines</h3>
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                  <div className="space-y-3">
                    {getNewsHeadlines().map((headline, index) => {
                      // Split headline into title and description if it contains " - "
                      const parts = headline.split(' - ');
                      const title = parts[0];
                      const description = parts[1] || '';
                      
                      return (
                        <div key={index} className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                            index % 3 === 0 ? 'bg-yellow-500' :
                            index % 3 === 1 ? 'bg-blue-500' : 'bg-purple-500'
                          }`}></div>
                          <div>
                            <h4 className="font-medium text-gray-900">{title}</h4>
                            {description && <p className="text-sm text-gray-600">{description}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Market Share by Region */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Share % by Region</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {getMarketShareRegions().map((region, index) => {
                    const colors = ["#3B82F6", "#8B5CF6", "#10B981", "#6B7280", "#F59E0B"];
                    const chartData = Object.entries(region.data).map(([name, value], idx) => ({
                      name,
                      value: parseInt(value.replace('%', '')) || 0,
                      color: colors[idx % colors.length]
                    }));
                    
                    return (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">{region.name}</h4>
                        <MiniPieChart data={chartData} title="" />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Feature Comparison Tables */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Comparison Tables</h3>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {(() => {
                    const comparison = getFeatureComparison();
                    const toolNames = Object.keys(comparison.tools);
                    
                    return (
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Feature</th>
                            {toolNames.map((tool, index) => (
                              <th key={index} className="px-4 py-3 text-center text-sm font-medium text-gray-700">{tool}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {comparison.features.map((feature, featureIndex) => (
                            <tr key={featureIndex} className={featureIndex % 2 === 1 ? 'bg-gray-50' : ''}>
                              <td className="px-4 py-3 text-sm text-gray-900">{feature}</td>
                              {toolNames.map((tool, toolIndex) => (
                                <td key={toolIndex} className="px-4 py-3 text-center">
                                  {comparison.tools[tool]?.[featureIndex] || '—'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>

              {/* M&A Potential Insights */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">M&A Potential Insights</h3>
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                  <div className="space-y-3">
                    {getMnaInsights().map((insight, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          index % 3 === 0 ? 'bg-orange-500' :
                          index % 3 === 1 ? 'bg-red-500' : 'bg-blue-500'
                        }`}></div>
                        <div>
                          <h4 className="font-medium text-gray-900">{insight.label}</h4>
                          <p className="text-sm text-gray-600">{insight.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Trends</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Market Share Growth</h4>
                    <MiniLineChart data={[{
                  name: "Q1",
                  value: 25
                }, {
                  name: "Q2",
                  value: 32
                }, {
                  name: "Q3",
                  value: 38
                }, {
                  name: "Q4",
                  value: 48
                }]} title="" color="#3B82F6" />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Feature Adoption Rate</h4>
                    <MiniLineChart data={[{
                  name: "AI Tools",
                  value: 78
                }, {
                  name: "Video",
                  value: 92
                }, {
                  name: "Automation",
                  value: 65
                }, {
                  name: "Integration",
                  value: 84
                }]} title="" color="#8B5CF6" />
                  </div>
                </div>
              </div>

              {/* Export/Share Actions */}
              <div className="border-t pt-6">
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

              {/* Show Less Button */}
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
            </div>
          )}
        </div>
      )}

      {/* Persistent Scout Agent Icon */}
      <div className="absolute bottom-4 right-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onScoutIconClick('competitor-landscape')}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white hover:shadow-lg hover:shadow-blue-300/50 transition-all duration-200"
            >
              <Bot className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Explore More with Scout</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default CompetitorLandscapeSection;
