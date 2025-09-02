import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, TrendingUp, Clock, Target, DollarSign, User, Zap, Flame, Users, Swords, TrendingDown, Filter, Shield, Calendar, Brain, CheckCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import MiniLineChart from "@/components/MiniLineChart";
import MiniPieChart from "@/components/MiniPieChart";
import { apiFetchJson } from "@/lib/api";

interface SuggestedICP {
  id: string;
  industry: string;
  segment: string;
  companySize: string;
  decisionMakers: string[];
  regions: string[];
  keyAttributes: string[];
  growthIndicator?: string;
  // Extended properties for detailed analysis
  title?: string;
  blurb?: string;
  marketSize?: string;
  growth?: string;
  urgency?: string;
  timeToClose?: string;
  corePersonas?: number;
  topPainPoint?: string;
  buyingTriggers?: number;
  competitors?: number;
  winLossChange?: string;
  buyingSignals?: number;
  buyingTriggersArray?: Array<{
    trigger: string;
    description: string;
  }>;
  marketAnalysis?: {
    totalMarketSize: string;
    servicableMarket: string;
    targetableMarket: string;
    marketGrowth: string;
    segments: Array<{
      name: string;
      size: string;
      growth: string;
      share: string;
    }>;
    growthTrajectory?: {
      units: string;
      data: Array<{
        year: number;
        value: number;
      }>;
    };
  };
}

interface BuyerMapData {
  summary: string;
  corePersonas: number;
  topPainPoint: string;
  buyingTriggers: number;
  buyingTriggersArray?: Array<{
    trigger: string;
    description: string;
  }>;
}

interface CompetitiveOverlapData {
  overlapScore: number;
  uniqueDifferentiators: string[];
  sharedBuyingSignals: string[];
  competitiveAdvantage: string;
}

interface ICPSummaryOpportunityProps {
  selectedICP: SuggestedICP | null;
  isLoading?: boolean;
}

export default function ICPSummaryOpportunity({ selectedICP, isLoading }: ICPSummaryOpportunityProps) {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [buyerMapApiData, setBuyerMapApiData] = useState<BuyerMapData | null>(null);
  const [buyerMapLoading, setBuyerMapLoading] = useState(false);
  const [buyerMapError, setBuyerMapError] = useState<string | null>(null);
  const [competitiveOverlapData, setCompetitiveOverlapData] = useState<CompetitiveOverlapData | null>(null);
  const [competitiveOverlapLoading, setCompetitiveOverlapLoading] = useState(false);
  const [competitiveOverlapError, setCompetitiveOverlapError] = useState<string | null>(null);

  // Buyer Map Report Generation
  const handleGenerateBuyerMapReport = async () => {
    if (!selectedICP) {
      console.error("No ICP selected for buyer map report generation");
      return;
    }

    setBuyerMapLoading(true);
    setBuyerMapError(null);
    setBuyerMapApiData(null);

    try {
      console.log("🚀 Making API call for Buyer Map");
      
      const apiResponse = await apiFetchJson('market-research', {
        method: 'POST',
        body: JSON.stringify({
          user_id: "user_123",
          component_name: "buyer map & roles, pain points, triggers",
          data: selectedICP,
          refresh: true
        })
      });
      
      if (apiResponse?.data) {
        const buyerMapResponse = apiResponse.data;
        
        if (buyerMapResponse && typeof buyerMapResponse === 'object') {
          const transformedData = {
            summary: buyerMapResponse.blurb || buyerMapResponse.summary || 'N/A',
            corePersonas: buyerMapResponse.corePersonas || 0,
            topPainPoint: buyerMapResponse.topPainPoint || 'N/A',
            buyingTriggers: buyerMapResponse.buyingTriggers || 0,
            buyingTriggersArray: Array.isArray(buyerMapResponse.buyingTriggersArray) 
              ? buyerMapResponse.buyingTriggersArray 
              : [],
          };

          setBuyerMapApiData(transformedData);
        } else {
          console.warn("❌ Unexpected buyer map API response structure");
          setBuyerMapError("Unexpected API response structure");
        }
      } else {
        throw new Error('Invalid API response');
      }
    } catch (error) {
      console.error("❌ API call failed:", error);
      setBuyerMapError(`API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setBuyerMapLoading(false);
    }
  };

  // Competitive Overlap Report Generation
  const handleGenerateCompetitiveOverlapReport = async () => {
    if (!selectedICP) {
      console.error("No ICP selected for competitive overlap report generation");
      return;
    }

    setCompetitiveOverlapLoading(true);
    setCompetitiveOverlapError(null);
    setCompetitiveOverlapData(null);

    try {
      console.log("🚀 Making API call for Competitive Overlap");
      
      const apiResponse = await apiFetchJson('market-research', {
        method: 'POST',
        body: JSON.stringify({
          user_id: "user_123",
          component_name: "competitive overlap & buying signals",
          data: selectedICP,
          refresh: true
        })
      });
      
      if (apiResponse?.data) {
        const overlapResponse = apiResponse.data;
        
        if (overlapResponse && typeof overlapResponse === 'object') {
          const transformedData = {
            overlapScore: overlapResponse.overlapScore || 0,
            uniqueDifferentiators: Array.isArray(overlapResponse.uniqueDifferentiators) 
              ? overlapResponse.uniqueDifferentiators 
              : [],
            sharedBuyingSignals: Array.isArray(overlapResponse.sharedBuyingSignals) 
              ? overlapResponse.sharedBuyingSignals 
              : [],
            competitiveAdvantage: overlapResponse.competitiveAdvantage || 'N/A'
          };

          setCompetitiveOverlapData(transformedData);
        } else {
          console.warn("❌ Unexpected competitive overlap API response structure");
          setCompetitiveOverlapError("Unexpected API response structure");
        }
      } else {
        throw new Error('Invalid API response');
      }
    } catch (error) {
      console.error("❌ API call failed:", error);
      setCompetitiveOverlapError(`API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCompetitiveOverlapLoading(false);
    }
  };

  // Mock chart data
  const marketGrowthData = [
    { name: "2020", value: 1200 },
    { name: "2021", value: 1580 },
    { name: "2022", value: 1950 },
    { name: "2023", value: 2340 },
    { name: "2024", value: 2890 },
  ];

  const competitorShareData = [
    { name: "Company A", value: 35, color: "#8884d8" },
    { name: "Company B", value: 25, color: "#82ca9d" },
    { name: "Company C", value: 20, color: "#ffc658" },
    { name: "Others", value: 20, color: "#ff7c7c" },
  ];

  const sectionConfigs = [
    { 
      id: 'overview',
      title: 'Overview',
      icon: Target,
      description: 'Market size, growth and key metrics',
      badgeText: selectedICP?.marketSize || 'Market Size',
      badgeVariant: 'default' as const
    },
    { 
      id: 'buyer-map',
      title: 'Buyer Map',
      icon: Users,
      description: 'Decision makers, pain points and triggers',
      badgeText: `${selectedICP?.corePersonas || 0} Personas`,
      badgeVariant: 'secondary' as const
    },
    { 
      id: 'competitive',
      title: 'Competitive Analysis',
      icon: Swords,
      description: 'Overlap analysis and differentiation',
      badgeText: `${selectedICP?.competitors || 0} Competitors`,
      badgeVariant: 'outline' as const
    }
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!selectedICP) {
    return (
      <div className="text-center py-12">
        <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-muted-foreground mb-2">No ICP Selected</h3>
        <p className="text-sm text-muted-foreground">
          Select an ICP from the gallery to view detailed analysis and insights
        </p>
      </div>
    );
  }

  const renderOverviewSection = () => (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Market Size</p>
                <p className="text-2xl font-bold">{selectedICP.marketSize || '$2.3B'}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Growth Rate</p>
                <p className="text-2xl font-bold">{selectedICP.growth || '23%'}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Time to Close</p>
                <p className="text-2xl font-bold">{selectedICP.timeToClose || '90 days'}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Urgency Level</p>
                <p className="text-2xl font-bold">{selectedICP.urgency || 'High'}</p>
              </div>
              <Flame className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Market Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Market Growth Trajectory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MiniLineChart data={marketGrowthData} title="Market Growth" color="#3b82f6" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5" />
              Competitive Landscape
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MiniPieChart data={competitorShareData} title="Market Share" />
          </CardContent>
        </Card>
      </div>

      {/* Market Segments */}
      <Card>
        <CardHeader>
          <CardTitle>Market Segments</CardTitle>
          <CardDescription>
            Breakdown of addressable market segments within this ICP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segment</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Growth</TableHead>
                <TableHead>Market Share</TableHead>
                <TableHead>Opportunity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedICP.marketAnalysis?.segments?.map((segment, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{segment.name}</TableCell>
                  <TableCell>{segment.size}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      {segment.growth}
                    </div>
                  </TableCell>
                  <TableCell>{segment.share}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">Medium</Badge>
                  </TableCell>
                </TableRow>
              )) || (
                <>
                  <TableRow>
                    <TableCell className="font-medium">Enterprise</TableCell>
                    <TableCell>$800M</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        18%
                      </div>
                    </TableCell>
                    <TableCell>15%</TableCell>
                    <TableCell>
                      <Badge variant="default">High</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Mid-Market</TableCell>
                    <TableCell>$950M</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        25%
                      </div>
                    </TableCell>
                    <TableCell>22%</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Medium</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">SMB</TableCell>
                    <TableCell>$550M</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        30%
                      </div>
                    </TableCell>
                    <TableCell>12%</TableCell>
                    <TableCell>
                      <Badge variant="outline">Low</Badge>
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderBuyerMapSection = () => (
    <div className="space-y-6">
      {/* Generate Report Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI-Powered Buyer Map Analysis
              </CardTitle>
              <CardDescription>
                Generate detailed insights about decision makers, pain points, and buying triggers
              </CardDescription>
            </div>
            <Button 
              onClick={handleGenerateBuyerMapReport}
              disabled={buyerMapLoading}
              className="flex items-center gap-2"
            >
              {buyerMapLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Generate Report
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Error Display */}
      {buyerMapError && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <Shield className="h-5 w-5" />
              <span className="font-medium">Error generating buyer map report</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{buyerMapError}</p>
          </CardContent>
        </Card>
      )}

      {/* Generated Report Display */}
      {buyerMapApiData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {buyerMapApiData.summary}
              </p>
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Core Personas</p>
                    <p className="text-2xl font-bold">{buyerMapApiData.corePersonas}</p>
                  </div>
                  <User className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Top Pain Point</p>
                    <p className="text-sm font-bold">{buyerMapApiData.topPainPoint}</p>
                  </div>
                  <Target className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Buying Triggers</p>
                    <p className="text-2xl font-bold">{buyerMapApiData.buyingTriggers}</p>
                  </div>
                  <Zap className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Buying Triggers Detail */}
      {buyerMapApiData?.buyingTriggersArray && buyerMapApiData.buyingTriggersArray.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Key Buying Triggers
            </CardTitle>
            <CardDescription>
              Critical events and signals that indicate purchase readiness
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {buyerMapApiData.buyingTriggersArray.map((trigger, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm mb-1">{trigger.trigger}</h4>
                      <p className="text-sm text-muted-foreground">{trigger.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Default content when no API data */}
      {!buyerMapApiData && !buyerMapLoading && !buyerMapError && (
        <div className="text-center py-12">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Report Generated</h3>
          <p className="text-sm text-muted-foreground">
            Click "Generate Report" to create an AI-powered buyer map analysis
          </p>
        </div>
      )}
    </div>
  );

  const renderCompetitiveSection = () => (
    <div className="space-y-6">
      {/* Generate Report Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Swords className="h-5 w-5" />
                Competitive Overlap Analysis
              </CardTitle>
              <CardDescription>
                Analyze competitive landscape and identify unique positioning opportunities
              </CardDescription>
            </div>
            <Button 
              onClick={handleGenerateCompetitiveOverlapReport}
              disabled={competitiveOverlapLoading}
              className="flex items-center gap-2"
            >
              {competitiveOverlapLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <Swords className="h-4 w-4" />
                  Analyze Competition
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Error Display */}
      {competitiveOverlapError && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <Shield className="h-5 w-5" />
              <span className="font-medium">Error generating competitive analysis</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{competitiveOverlapError}</p>
          </CardContent>
        </Card>
      )}

      {/* Generated Report Display */}
      {competitiveOverlapData && (
        <div className="space-y-6">
          {/* Overview Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Overlap Score</p>
                    <p className="text-2xl font-bold">{competitiveOverlapData.overlapScore}%</p>
                  </div>
                  <Swords className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Differentiators</p>
                    <p className="text-2xl font-bold">{competitiveOverlapData.uniqueDifferentiators.length}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Shared Signals</p>
                    <p className="text-2xl font-bold">{competitiveOverlapData.sharedBuyingSignals.length}</p>
                  </div>
                  <Target className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Competitive Advantage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Competitive Advantage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {competitiveOverlapData.competitiveAdvantage}
              </p>
            </CardContent>
          </Card>

          {/* Unique Differentiators */}
          {competitiveOverlapData.uniqueDifferentiators.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Unique Differentiators
                </CardTitle>
                <CardDescription>
                  Key advantages that set you apart from competitors
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {competitiveOverlapData.uniqueDifferentiators.map((differentiator, index) => (
                    <div key={index} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">{differentiator}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shared Buying Signals */}
          {competitiveOverlapData.sharedBuyingSignals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Shared Buying Signals
                </CardTitle>
                <CardDescription>
                  Common triggers and signals across competitive landscape
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {competitiveOverlapData.sharedBuyingSignals.map((signal, index) => (
                    <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-blue-800">{signal}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Default content when no API data */}
      {!competitiveOverlapData && !competitiveOverlapLoading && !competitiveOverlapError && (
        <div className="text-center py-12">
          <Swords className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Analysis Generated</h3>
          <p className="text-sm text-muted-foreground">
            Click "Analyze Competition" to generate competitive overlap insights
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with ICP Details */}
      <div className="border-b pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">
              {selectedICP.title || `${selectedICP.industry} - ${selectedICP.segment}`}
            </h2>
            <p className="text-muted-foreground mb-3">
              {selectedICP.blurb || `${selectedICP.companySize} companies in ${selectedICP.regions.join(', ')}`}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedICP.keyAttributes?.map((attr, index) => (
                <Badge key={index} variant="outline">
                  {attr}
                </Badge>
              ))}
            </div>
          </div>
          <div className="text-right">
            {selectedICP.growthIndicator && (
              <Badge variant="secondary" className="mb-2">
                {selectedICP.growthIndicator}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="flex flex-wrap gap-2">
        {sectionConfigs.map((section) => {
          const Icon = section.icon;
          return (
            <Button
              key={section.id}
              variant={activeSection === section.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveSection(section.id)}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              {section.title}
              <Badge variant={section.badgeVariant} className="ml-1">
                {section.badgeText}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Section Content */}
      <div className="min-h-[400px]">
        {activeSection === 'overview' && renderOverviewSection()}
        {activeSection === 'buyer-map' && renderBuyerMapSection()}
        {activeSection === 'competitive' && renderCompetitiveSection()}
      </div>
    </div>
  );
}