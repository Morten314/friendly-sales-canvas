import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, TrendingUp, Clock, Target, DollarSign, User, Zap, Flame, Users, Swords, TrendingDown, Filter, Shield, Calendar, Brain, CheckCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import MiniLineChart from "@/components/MiniLineChart";
import MiniPieChart from "@/components/MiniPieChart";

interface SuggestedICP {
  id: string;
  industry: string;
  segment: string;
  companySize: string;
  decisionMakers: string[];
  regions: string[];
  keyAttributes: string[];
  growthIndicator?: string;
}

interface ICPSummaryOpportunityProps {
  selectedICP: SuggestedICP | null;
}

export const ICPSummaryOpportunity = ({ selectedICP }: ICPSummaryOpportunityProps) => {
  const [isMarketExpanded, setIsMarketExpanded] = useState(false);
  const [isBuyerMapExpanded, setIsBuyerMapExpanded] = useState(false);
  const [isCompetitiveExpanded, setIsCompetitiveExpanded] = useState(false);
  const [isRegulatoryExpanded, setIsRegulatoryExpanded] = useState(false);
  const [activeCard, setActiveCard] = useState(1);
  const [signalRegionFilter, setSignalRegionFilter] = useState("all");
  const [signalTypeFilter, setSignalTypeFilter] = useState("all");
  const [icpAnalysisData, setIcpAnalysisData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch dynamic ICP analysis data from backend
  const fetchICPAnalysis = async (icp: SuggestedICP) => {
    try {
      console.log("=== FETCHING ICP ANALYSIS DATA ===");
      console.log("Selected ICP:", icp);
      setLoading(true);
      setError(null);
      
      const response = await fetch(`https://backend-11kr.onrender.com/icp`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log("ICP Analysis API Response status:", response.status);
      
      if (!response.ok) {
        console.log("API call failed, using fallback data");
        setIcpAnalysisData(generateFallbackData(icp));
        return;
      }
      
      const data = await response.json();
      console.log("ICP Analysis API Response:", data);
      setIcpAnalysisData(data);
      
    } catch (err) {
      console.error("=== ERROR FETCHING ICP ANALYSIS ===", err);
      console.log("Using fallback data due to error");
      setIcpAnalysisData(generateFallbackData(icp));
    } finally {
      setLoading(false);
    }
  };

  // Generate fallback data based on selected ICP
  const generateFallbackData = (icp: SuggestedICP) => {
    const marketSizeOptions = [8, 12, 15, 18, 25, 32, 45];
    const growthOptions = [15, 18, 23, 28, 32, 35];
    const randomMarketSize = marketSizeOptions[Math.floor(Math.random() * marketSizeOptions.length)];
    const randomGrowth = growthOptions[Math.floor(Math.random() * growthOptions.length)];
    
    return {
      title: `${icp.industry} - ${icp.segment} (${icp.companySize})`,
      blurb: `${icp.segment} companies in ${icp.industry} seeking innovative solutions to scale their operations across ${icp.regions.join(', ')} markets.`,
      marketSize: `€${randomMarketSize}.${Math.floor(Math.random() * 9)}B`,
      growth: `+${randomGrowth}%`,
      urgency: Math.random() > 0.5 ? "High" : "Medium",
      timeToClose: Math.random() > 0.5 ? "4-6 months" : "6-9 months",
      corePersonas: icp.decisionMakers.length,
      topPainPoint: icp.keyAttributes[0] || "System Integration",
      buyingTriggers: Math.floor(Math.random() * 5) + 5,
      buyingTriggersArray: [
        { trigger: "Technology Upgrade", description: `Recent ${icp.industry} platform modernization initiatives.` },
        { trigger: "Regulatory Change", description: `New compliance requirements in ${icp.regions[0]} market.` },
        { trigger: "Growth Milestone", description: "Rapid scaling demands infrastructure improvements." },
        { trigger: "Competitive Pressure", description: `Market rivals launch new ${icp.industry} capabilities.` }
      ],
      competitors: Math.floor(Math.random() * 3) + 3,
      winLossChange: `+${Math.floor(Math.random() * 20) + 5}%`,
      marketAnalysis: {
        totalMarketSize: `€${randomMarketSize}.${Math.floor(Math.random() * 9)}B`,
        servicableMarket: `€${Math.floor(randomMarketSize * 0.4)}.${Math.floor(Math.random() * 9)}B`,
        targetableMarket: `€${Math.floor(randomMarketSize * 0.1)}.${Math.floor(Math.random() * 9)}B`,
        marketGrowth: `+${randomGrowth}%`,
        segments: [
          { name: `Modern ${icp.segment}`, size: `€${Math.floor(randomMarketSize * 0.5)}.${Math.floor(Math.random() * 9)}B`, growth: `+${randomGrowth + 5}%`, share: "50%" },
          { name: `Traditional ${icp.segment}`, size: `€${Math.floor(randomMarketSize * 0.3)}.${Math.floor(Math.random() * 9)}B`, growth: `+${randomGrowth - 5}%`, share: "31%" },
          { name: `Emerging ${icp.segment}`, size: `€${Math.floor(randomMarketSize * 0.2)}.${Math.floor(Math.random() * 9)}B`, growth: `+${randomGrowth + 10}%`, share: "19%" }
        ],
        keyChallenges: [
          `${icp.industry} regulatory compliance complexity across multiple jurisdictions`,
          "Legacy infrastructure modernization costs",
          `Customer acquisition in competitive ${icp.industry} markets`,
          "Pressure to maintain profitability while scaling",
          "Security and data protection requirements"
        ],
        strategicRecommendations: [
          `Focus on ${icp.industry}-specific messaging to address sector pain points`,
          `Develop region-specific strategies for ${icp.regions.join(' and ')} markets`,
          `Create partnerships with existing ${icp.industry} infrastructure providers`,
          "Build case studies showcasing rapid deployment and ROI",
          `Establish thought leadership around ${icp.industry} technology trends`
        ],
        signalsToMonitor: [
          `Funding announcements in ${icp.industry} target segments`,
          `Regulatory updates from ${icp.regions[0]} authorities`,
          "New product launches requiring infrastructure scaling",
          `Executive hiring patterns in ${icp.industry} and technology roles`,
          `Partnership announcements between ${icp.industry} companies`
        ]
      },
      buyerPersonas: icp.decisionMakers.map((role, index) => ({
        role,
        influence: index < 2 ? "High" : "Medium",
        painPoints: [
          `${icp.industry} system scalability`,
          "Integration complexity",
          "Compliance requirements"
        ],
        triggers: [
          "System upgrades",
          "New regulations", 
          "Growth milestones"
        ]
      })),
      painPoints: [
        `${icp.industry} compliance requirements slowing innovation`,
        "Integration challenges with existing systems",
        "Scalability concerns during expansion phases"
      ],
      buyingTriggersDetailed: [
        `New regulatory requirements in ${icp.regions.join(' and ')} markets`,
        "System performance issues during peak usage",
        "New product launches requiring infrastructure scaling",
        `Executive hiring patterns in ${icp.industry} sector`,
        "Strategic partnerships and market expansion plans"
      ],
      competitiveMap: [
        {
          competitor: "Market Leader A",
          segment: icp.segment,
          share: "24%",
          winsLosses: "Strong market presence",
          changeDirection: "up"
        },
        {
          competitor: "Market Leader B", 
          segment: icp.segment,
          share: "18%",
          winsLosses: "Recent customer losses",
          changeDirection: "down"
        },
        {
          competitor: "Emerging Player",
          segment: icp.segment,
          share: "15%",
          winsLosses: "Growing rapidly",
          changeDirection: "up"
        }
      ],
      competitorNews: [
        `Major ${icp.industry} platform launches new API`,
        "Competitor struggles with enterprise rollouts",
        `New regulations impact ${icp.industry} sector`,
        "Market leader expands into new regions",
        "Emerging player raises significant funding"
      ],
      buyingSignals: [
        {
          signalType: "Tech Stack Change",
          description: `Migration to modern ${icp.industry} platform`,
          source: "Company Announcements",
          recency: "2 weeks ago",
          category: "technology"
        },
        {
          signalType: "Funding Event",
          description: `${icp.segment} company raises funding`,
          source: "Crunchbase",
          recency: "3 weeks ago",
          category: "funding"
        },
        {
          signalType: "Leadership Change",
          description: `New CTO hired with ${icp.industry} experience`,
          source: "LinkedIn",
          recency: "5 days ago",
          category: "personnel"
        },
        {
          signalType: "Regulatory",
          description: `New compliance requirements in ${icp.regions[0]} market`,
          source: "Regulatory Filing",
          recency: "1 week ago",
          category: "regulatory"
        },
        {
          signalType: "Partnership",
          description: `Strategic partnership in ${icp.industry} sector`,
          source: "Press Release",
          recency: "1 month ago",
          category: "business"
        }
      ]
    };
  };

  // Fetch ICP analysis when selectedICP changes
  useEffect(() => {
    if (selectedICP) {
      console.log("=== ICP CHANGED - FETCHING ANALYSIS ===");
      console.log("New selected ICP:", selectedICP);
      fetchICPAnalysis(selectedICP);
    }
  }, [selectedICP]);

  const generateICPData = (selectedICP: SuggestedICP | null) => {
    if (!selectedICP) {
      console.log("No ICP selected, using default data");
      return generateFallbackData({
        id: "default",
        industry: "Fintech",
        segment: "Digital Banking",
        companySize: "50-200 employees",
        decisionMakers: ["CTO", "Head of Compliance"],
        regions: ["EU", "DACH"],
        keyAttributes: ["Regulatory compliance", "Scalability"]
      });
    }

    // Use fetched API data if available, otherwise use fallback
    if (icpAnalysisData) {
      console.log("Using API data for ICP analysis");
      return icpAnalysisData;
    }

    console.log("Using fallback data for ICP analysis");
    return generateFallbackData(selectedICP);
  };

  // Mock data for charts
  const mockGrowthData = [
    { name: "2022", value: 8.5 },
    { name: "2023", value: 10.2 },
    { name: "2024", value: 12.3 },
    { name: "2025", value: 15.1 },
    { name: "2026", value: 18.8 }
  ];

  const mockSegmentData = [
    { name: "Digital-only", value: 50, color: "#3b82f6" },
    { name: "Traditional", value: 31, color: "#10b981" },
    { name: "Challenger", value: 19, color: "#f59e0b" }
  ];

  const icpData = generateICPData(selectedICP);

  const toggleSection = (section: string) => {
    switch (section) {
      case 'market':
        setIsMarketExpanded(!isMarketExpanded);
        break;
      case 'buyer':
        setIsBuyerMapExpanded(!isBuyerMapExpanded);
        break;
      case 'competitive':
        setIsCompetitiveExpanded(!isCompetitiveExpanded);
        break;
      case 'regulatory':
        setIsRegulatoryExpanded(!isRegulatoryExpanded);
        break;
    }
  };

  const filteredSignals = icpData.buyingSignals.filter((signal: any) => {
    const regionMatch = signalRegionFilter === "all" || 
      (selectedICP?.regions || []).some(region => 
        signal.description.toLowerCase().includes(region.toLowerCase())
      );
    const typeMatch = signalTypeFilter === "all" || signal.category === signalTypeFilter;
    return regionMatch && typeMatch;
  });

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading ICP analysis...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Error loading ICP analysis: {error}</p>
        <p className="text-gray-500 text-sm mt-2">Using fallback data</p>
      </div>
    );
  }

  if (!selectedICP) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Select an ICP from above to view detailed analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ICP Summary & Market Opportunity */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl text-blue-900">{icpData.title}</CardTitle>
              <CardDescription className="text-blue-700 mt-2">{icpData.blurb}</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSection('market')}
              className="text-blue-600 hover:text-blue-800"
            >
              {isMarketExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-white rounded-lg border border-blue-100">
              <DollarSign className="h-6 w-6 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{icpData.marketSize}</div>
              <div className="text-sm text-blue-600">Market Size</div>
            </div>
            <div className="text-center p-4 bg-white rounded-lg border border-green-100">
              <TrendingUp className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">{icpData.growth}</div>
              <div className="text-sm text-green-600">Growth Rate</div>
            </div>
            <div className="text-center p-4 bg-white rounded-lg border border-orange-100">
              <Flame className="h-6 w-6 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-900">{icpData.urgency}</div>
              <div className="text-sm text-orange-600">Urgency</div>
            </div>
            <div className="text-center p-4 bg-white rounded-lg border border-purple-100">
              <Clock className="h-6 w-6 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">{icpData.timeToClose}</div>
              <div className="text-sm text-purple-600">Time to Close</div>
            </div>
          </div>

          {isMarketExpanded && (
            <div className="space-y-6 pt-6 border-t border-blue-100">
              {/* Market Analysis Section */}
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Market Analysis</h3>
                <p className="text-gray-700 mb-4">
                  Total Market Size: <strong>{icpData.marketAnalysis.totalMarketSize}</strong><br />
                  Serviceable Market: <strong>{icpData.marketAnalysis.servicableMarket}</strong><br />
                  Targetable Market: <strong>{icpData.marketAnalysis.targetableMarket}</strong><br />
                  Market Growth: <strong>{icpData.marketAnalysis.marketGrowth}</strong>
                </p>
                <MiniLineChart 
                  title="Market Growth Trend" 
                  color="#3b82f6"
                  data={mockGrowthData} 
                />
              </div>

              <div>
                <h4 className="text-md font-semibold text-blue-800 mb-2">Market Segments</h4>
                <MiniPieChart 
                  title="Segment Distribution"
                  data={mockSegmentData} 
                />
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {icpData.marketAnalysis.segments.map((segment: any, idx: number) => (
                    <div key={idx} className="p-3 bg-white rounded-lg border border-gray-200">
                      <h5 className="font-semibold text-gray-900">{segment.name}</h5>
                      <p className="text-sm text-gray-600">Size: {segment.size}</p>
                      <p className="text-sm text-gray-600">Growth: {segment.growth}</p>
                      <p className="text-sm text-gray-600">Share: {segment.share}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-md font-semibold text-blue-800 mb-2">Key Challenges</h4>
                <ul className="list-disc list-inside text-gray-700">
                  {icpData.marketAnalysis.keyChallenges.map((challenge: string, idx: number) => (
                    <li key={idx}>{challenge}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-md font-semibold text-blue-800 mb-2">Strategic Recommendations</h4>
                <ul className="list-disc list-inside text-gray-700">
                  {icpData.marketAnalysis.strategicRecommendations.map((rec: string, idx: number) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-md font-semibold text-blue-800 mb-2">Signals to Monitor</h4>
                <ul className="list-disc list-inside text-gray-700">
                  {icpData.marketAnalysis.signalsToMonitor.map((signal: string, idx: number) => (
                    <li key={idx}>{signal}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Buyer Personas Section */}
      <Card className="border-green-200 bg-gradient-to-r from-green-50 to-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl text-green-900">Buyer Personas</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSection('buyer')}
              className="text-green-600 hover:text-green-800"
            >
              {isBuyerMapExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!isBuyerMapExpanded && (
            <p className="text-green-700">Click to expand buyer personas details</p>
          )}
          {isBuyerMapExpanded && (
            <div className="space-y-4">
              {icpData.buyerPersonas.map((persona: any, idx: number) => (
                <div key={idx} className="p-4 bg-white rounded-lg border border-green-100">
                  <h4 className="text-lg font-semibold text-green-900">{persona.role}</h4>
                  <p className="text-green-700 mb-2">Influence: {persona.influence}</p>
                  <div>
                    <h5 className="font-semibold text-green-800">Pain Points</h5>
                    <ul className="list-disc list-inside text-green-700 mb-2">
                      {persona.painPoints.map((point: string, i: number) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-green-800">Buying Triggers</h5>
                    <ul className="list-disc list-inside text-green-700">
                      {persona.triggers.map((trigger: string, i: number) => (
                        <li key={i}>{trigger}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Competitive Landscape Section */}
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl text-orange-900">Competitive Landscape</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSection('competitive')}
              className="text-orange-600 hover:text-orange-800"
            >
              {isCompetitiveExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!isCompetitiveExpanded && (
            <p className="text-orange-700">Click to expand competitive landscape details</p>
          )}
          {isCompetitiveExpanded && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competitor</TableHead>
                    <TableHead>Segment</TableHead>
                    <TableHead>Market Share</TableHead>
                    <TableHead>Wins/Losses</TableHead>
                    <TableHead>Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {icpData.competitiveMap.map((comp: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{comp.competitor}</TableCell>
                      <TableCell>{comp.segment}</TableCell>
                      <TableCell>{comp.share}</TableCell>
                      <TableCell>{comp.winsLosses}</TableCell>
                      <TableCell>
                        {comp.changeDirection === "up" ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-6">
                <h4 className="text-lg font-semibold text-orange-900 mb-2">Recent Competitor News</h4>
                <ul className="list-disc list-inside text-orange-700">
                  {icpData.competitorNews.map((news: string, idx: number) => (
                    <li key={idx}>{news}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Regulatory & Compliance Section */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl text-purple-900">Regulatory & Compliance</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSection('regulatory')}
              className="text-purple-600 hover:text-purple-800"
            >
              {isRegulatoryExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!isRegulatoryExpanded && (
            <p className="text-purple-700">Click to expand regulatory and compliance details</p>
          )}
          {isRegulatoryExpanded && (
            <div>
              <p className="text-purple-700 mb-4">
                Regulatory environment for {selectedICP.industry} in regions: {selectedICP.regions.join(", ")}.
              </p>
              <ul className="list-disc list-inside text-purple-700">
                <li>Compliance requirements vary by jurisdiction and impact product development cycles.</li>
                <li>Recent changes in data privacy laws require enhanced security measures.</li>
                <li>Ongoing monitoring of regulatory filings and announcements is critical.</li>
                <li>Collaboration with legal and compliance teams recommended for market entry.</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Buying Signals Section */}
      <Card className="border-gray-200 bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl text-gray-900">Buying Signals</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={signalRegionFilter} onValueChange={setSignalRegionFilter}>
                <SelectTrigger className="w-32 h-8">
                  <SelectValue placeholder="Filter by Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {(selectedICP?.regions || []).map((region, idx) => (
                    <SelectItem key={idx} value={region.toLowerCase()}>{region}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={signalTypeFilter} onValueChange={setSignalTypeFilter}>
                <SelectTrigger className="w-32 h-8">
                  <SelectValue placeholder="Filter by Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="funding">Funding</SelectItem>
                  <SelectItem value="personnel">Personnel</SelectItem>
                  <SelectItem value="regulatory">Regulatory</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSignals.length === 0 && (
            <p className="text-gray-500">No buying signals match the selected filters.</p>
          )}
          {filteredSignals.length > 0 && (
            <ul className="space-y-3">
              {filteredSignals.map((signal: any, idx: number) => (
                <li key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-900">{signal.signalType}</p>
                      <p className="text-gray-700">{signal.description}</p>
                      <p className="text-gray-500 text-sm">Source: {signal.source} | Recency: {signal.recency}</p>
                    </div>
                    <Badge variant="outline" className="capitalize">{signal.category}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
