import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, TrendingUp, Clock, Target, DollarSign, User, Zap, Flame, Users, Swords, TrendingDown, Filter, Shield, Calendar, Brain, CheckCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import MiniLineChart from "@/components/MiniLineChart";
import MiniPieChart from "@/components/MiniPieChart";

export const ICPSummaryOpportunity = () => {
  const [isMarketExpanded, setIsMarketExpanded] = useState(false);
  const [isBuyerMapExpanded, setIsBuyerMapExpanded] = useState(false);
  const [isCompetitiveExpanded, setIsCompetitiveExpanded] = useState(false);
  const [isRegulatoryExpanded, setIsRegulatoryExpanded] = useState(false);
  const [activeCard, setActiveCard] = useState(1);
  const [signalRegionFilter, setSignalRegionFilter] = useState("all");
  const [signalTypeFilter, setSignalTypeFilter] = useState("all");

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

  const mockData = {
    1: {
      title: "Neobanks (€50M+ ARR)",
      blurb: "Fast-growing digital banks seeking compliance-friendly infrastructure to scale across European markets while maintaining regulatory standards.",
      marketSize: "€12.3B",
      growth: "+23%",
      urgency: "High",
      timeToClose: "4-6 months",
      corePersonas: 3,
      topPainPoint: "Legacy Core Systems",
      buyingTriggers: 7,
      buyingTriggersArray: [
        { trigger: "New Funding Round", description: "Recent capital raises push tech stack upgrades." },
        { trigger: "Regulatory Change", description: "A new law forces compliance investment." },
        { trigger: "Customer Churn Spike", description: "Loss of users sparks urgent digital product fixes." },
        { trigger: "Competitive Move", description: "A rival launches innovative digital services." }
      ],
      competitors: 4,
      winLossChange: "+12%",
      buyingSignals: 8,
      marketAnalysis: {
        totalMarketSize: "€12.3B",
        servicableMarket: "€4.8B",
        targetableMarket: "€1.2B",
        marketGrowth: "+23%",
        segments: [
          { name: "Digital-only Banks", size: "€6.2B", growth: "+28%", share: "50%" },
          { name: "Traditional Bank Digital Arms", size: "€3.8B", growth: "+18%", share: "31%" },
          { name: "Challenger Banks", size: "€2.3B", growth: "+32%", share: "19%" }
        ],
        keyChallenges: [
          "Regulatory compliance complexity across multiple jurisdictions",
          "Legacy infrastructure modernization costs",
          "Customer acquisition in saturated markets",
          "Pressure to maintain profitability while scaling",
          "Cybersecurity and data protection requirements"
        ],
        strategicRecommendations: [
          "Focus on compliance-as-a-service messaging to address regulatory pain points",
          "Develop region-specific go-to-market strategies for DACH vs. UK markets",
          "Create partnership opportunities with existing fintech infrastructure providers",
          "Build case studies showcasing rapid deployment and cost savings",
          "Establish thought leadership around regulatory technology trends"
        ],
        signalsToMonitor: [
          "Series B+ funding announcements in target segments",
          "Regulatory updates from BaFin, FCA, and ECB",
          "New product launches requiring infrastructure scaling",
          "Executive hiring patterns in technology and compliance roles",
          "Partnership announcements between neobanks and traditional institutions"
        ]
      },
      competitiveData: {
        mainCompetitors: ["Temenos", "Mambu", "Thought Machine", "10x Banking"],
        marketShareShifts: "Traditional core banking vendors losing 15% market share to cloud-native solutions",
        recentSignals: [
          { signal: "Funding Announcements", count: 12, trend: "up" },
          { signal: "Regulatory Updates", count: 8, trend: "up" },
          { signal: "Tech Stack Migrations", count: 15, trend: "up" },
          { signal: "Partnership Announcements", count: 6, trend: "stable" }
        ],
        competitiveMap: [
          {
            competitor: "Stripe",
            segment: "Neobanks",
            share: "24%",
            winsLosses: "Won deals in Germany",
            differentiators: "API speed, compliance integrations"
          },
          {
            competitor: "Temenos",
            segment: "Neobanks", 
            share: "18%",
            winsLosses: "Lost several mid-market clients",
            differentiators: "Complex deployments"
          },
          {
            competitor: "Mambu",
            segment: "Neobanks",
            share: "15%",
            winsLosses: "Strong in DACH region",
            differentiators: "Cloud-native core banking"
          },
          {
            competitor: "Thought Machine",
            segment: "Neobanks",
            share: "12%",
            winsLosses: "Growing in enterprise segment",
            differentiators: "Modern architecture, real-time processing"
          }
        ],
        competitiveNews: [
          "Stripe launches instant KYC API for European fintechs",
          "Temenos struggles with mid-market cloud rollouts",
          "New regulations push Neobanks to adopt advanced compliance tools",
          "Mambu expands DACH presence with new partnerships",
          "Thought Machine raises $200M for global expansion"
        ],
        buyingSignalsData: [
          {
            signalType: "Hiring Surge",
            description: "CTO and digital roles open in North America",
            source: "LinkedIn",
            recency: "2 weeks ago",
            region: "North America",
            type: "Hiring"
          },
          {
            signalType: "Regulatory Update",
            description: "New BaFin guidance on SaaS providers",
            source: "News",
            recency: "1 month ago",
            region: "DACH",
            type: "Regulatory"
          },
          {
            signalType: "Funding Event",
            description: "Neobank X raises $40M Series B",
            source: "Crunchbase",
            recency: "3 weeks ago",
            region: "North America",
            type: "Funding"
          },
          {
            signalType: "Tech Adoption",
            description: "Major neobank migrates to cloud infrastructure",
            source: "Industry Report",
            recency: "1 week ago",
            region: "DACH",
            type: "Tech adoption"
          },
          {
            signalType: "Partnership",
            description: "Strategic alliance between fintech and compliance provider",
            source: "Press Release",
            recency: "2 weeks ago",
            region: "DACH",
            type: "Partnership"
          }
        ]
      }
    },
    2: {
      title: "Insurance Companies (€200M+ Premium)",
      blurb: "Established insurers modernizing legacy systems to improve customer experience and meet evolving regulatory requirements in digital transformation.",
      marketSize: "€8.7B",
      growth: "+18%",
      urgency: "Medium",
      timeToClose: "6-9 months",
      corePersonas: 4,
      topPainPoint: "Digital Experience Gap",
      buyingTriggers: 5,
      buyingTriggersArray: [
        { trigger: "Digital Transformation Initiative", description: "Board-level mandate to modernize customer experience." },
        { trigger: "Regulatory Compliance", description: "New insurance regulations require system updates." },
        { trigger: "Customer Experience Metrics", description: "Declining NPS scores drive technology investment." },
        { trigger: "Competitive Pressure", description: "InsurTech competitors gaining market share." }
      ],
      competitors: 5,
      winLossChange: "+8%",
      buyingSignals: 6,
      marketAnalysis: {
        totalMarketSize: "€8.7B",
        servicableMarket: "€3.2B",
        targetableMarket: "€800M",
        marketGrowth: "+18%",
        segments: [
          { name: "Property & Casualty", size: "€4.1B", growth: "+15%", share: "47%" },
          { name: "Life & Health", size: "€2.8B", growth: "+22%", share: "32%" },
          { name: "Specialty Insurance", size: "€1.8B", growth: "+20%", share: "21%" }
        ],
        keyChallenges: [
          "Legacy system modernization without business disruption",
          "Regulatory compliance across multiple insurance markets",
          "Customer expectations for digital-first experiences",
          "Integration complexity with existing ecosystem partners",
          "Data privacy and security in digital transformation"
        ],
        strategicRecommendations: [
          "Target insurers in digital transformation phases",
          "Emphasize low-risk migration strategies and proven implementation methodologies",
          "Develop industry-specific compliance frameworks",
          "Create partnership ecosystem for seamless integrations",
          "Build customer experience improvement case studies"
        ],
        signalsToMonitor: [
          "Digital transformation budget allocations and initiatives",
          "New insurance product launches requiring modern infrastructure",
          "Regulatory changes affecting customer experience requirements",
          "Executive appointments in digital and technology leadership",
          "Customer satisfaction scores and digital adoption metrics"
        ]
      },
      competitiveData: {
        mainCompetitors: ["Guidewire", "Duck Creek", "Sapiens", "Insurity", "Majesco"],
        marketShareShifts: "Cloud-first insurance platforms growing 25% annually vs legacy on-premise solutions",
        recentSignals: [
          { signal: "Digital Initiative Announcements", count: 8, trend: "up" },
          { signal: "Legacy System Replacements", count: 10, trend: "up" },
          { signal: "Customer Experience Investments", count: 7, trend: "up" },
          { signal: "RegTech Partnerships", count: 4, trend: "stable" }
        ],
        competitiveMap: [
          {
            competitor: "Guidewire",
            segment: "Insurance",
            share: "28%",
            winsLosses: "Strong in enterprise segment",
            differentiators: "Comprehensive suite, industry expertise"
          },
          {
            competitor: "Duck Creek",
            segment: "Insurance",
            share: "22%",
            winsLosses: "Growing cloud adoption",
            differentiators: "Modern cloud architecture"
          }
        ],
        competitiveNews: [
          "Guidewire announces new cloud migration tools",
          "Duck Creek expands European presence",
          "New insurance regulations drive modernization"
        ],
        buyingSignalsData: [
          {
            signalType: "Digital Initiative",
            description: "Insurance company announces digital transformation",
            source: "Company Report",
            recency: "1 week ago",
            region: "North America",
            type: "Digital"
          }
        ]
      }
    },
    3: {
      title: "FinTech Scale-ups (€10-50M ARR)",
      blurb: "Rapidly growing financial technology companies needing robust, scalable infrastructure to support expansion while ensuring regulatory compliance.",
      marketSize: "€5.2B",
      growth: "+35%",
      urgency: "Very High",
      timeToClose: "2-4 months",
      corePersonas: 2,
      topPainPoint: "Scaling Infrastructure",
      buyingTriggers: 9,
      buyingTriggersArray: [
        { trigger: "Series B+ Funding", description: "Growth capital necessitates infrastructure scaling." },
        { trigger: "Geographic Expansion", description: "Multi-country rollout requires compliance architecture." },
        { trigger: "Product Launch", description: "New financial products need robust backend systems." },
        { trigger: "Regulatory Audit", description: "Compliance reviews expose infrastructure gaps." }
      ],
      competitors: 3,
      winLossChange: "+18%",
      buyingSignals: 12,
      marketAnalysis: {
        totalMarketSize: "€5.2B",
        servicableMarket: "€2.1B",
        targetableMarket: "€650M",
        marketGrowth: "+35%",
        segments: [
          { name: "Payment Processing", size: "€2.3B", growth: "+40%", share: "44%" },
          { name: "Lending Platforms", size: "€1.6B", growth: "+32%", share: "31%" },
          { name: "Investment Tech", size: "€1.3B", growth: "+30%", share: "25%" }
        ],
        keyChallenges: [
          "Rapid scaling while maintaining regulatory compliance",
          "Technical infrastructure that can handle exponential growth",
          "Multi-jurisdiction regulatory requirements for expansion",
          "Integration complexity with banking and financial partners",
          "Security and fraud prevention at scale"
        ],
        strategicRecommendations: [
          "Focus on rapid deployment and time-to-market advantages",
          "Develop scalable pricing models that grow with customer success",
          "Create regulatory compliance accelerators for new markets",
          "Build strong partner ecosystem for seamless integrations",
          "Emphasize proven track record with high-growth fintech companies"
        ],
        signalsToMonitor: [
          "Series B+ funding rounds and expansion announcements",
          "New product launches and geographic expansion plans",
          "Regulatory approvals and license applications",
          "Technical leadership hiring and team scaling",
          "Partnership announcements with financial institutions"
        ]
      },
      competitiveData: {
        mainCompetitors: ["Stripe", "Plaid", "Adyen"],
        marketShareShifts: "API-first fintech infrastructure providers capturing 40% of new FinTech implementations",
        recentSignals: [
          { signal: "Funding Rounds", count: 18, trend: "up" },
          { signal: "Product Launches", count: 14, trend: "up" },
          { signal: "Expansion Announcements", count: 11, trend: "up" },
          { signal: "Compliance Partnerships", count: 9, trend: "up" }
        ],
        competitiveMap: [
          {
            competitor: "Stripe",
            segment: "FinTech",
            share: "35%",
            winsLosses: "Dominating payment infrastructure",
            differentiators: "Developer experience, global reach"
          },
          {
            competitor: "Plaid",
            segment: "FinTech",
            share: "28%",
            winsLosses: "Strong in account connectivity",
            differentiators: "Banking data APIs, security"
          }
        ],
        competitiveNews: [
          "Stripe launches new compliance tools for FinTechs",
          "Plaid expands European API coverage",
          "New open banking regulations create opportunities"
        ],
        buyingSignalsData: [
          {
            signalType: "Funding Round",
            description: "FinTech startup raises Series B",
            source: "Venture Capital",
            recency: "1 week ago",
            region: "North America",
            type: "Funding"
          }
        ]
      }
    }
  };

  const currentData = mockData[activeCard as keyof typeof mockData];

  const filteredBuyingSignals = currentData.competitiveData.buyingSignalsData.filter(signal => {
    const regionMatch = signalRegionFilter === "all" || signal.region === signalRegionFilter;
    const typeMatch = signalTypeFilter === "all" || signal.type === signalTypeFilter;
    return regionMatch && typeMatch;
  });

  return (
    <div className="space-y-6">
      {/* ICP Summary & Market Opportunity */}
      <div className="space-y-4">
        <Card className="border border-gray-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">ICP Summary & Market Opportunity</CardTitle>
                <CardDescription className="mt-1">
                  Overview of target customer profile and market dynamics
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3].map((cardNum) => (
                  <Button
                    key={cardNum}
                    variant={activeCard === cardNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveCard(cardNum)}
                    className={`text-xs ${
                      activeCard === cardNum 
                        ? "bg-blue-600 text-white hover:bg-blue-700" 
                        : "hover:bg-gray-50"
                    }`}
                  >
                    Card {cardNum}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">{currentData.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {currentData.blurb}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                  <Target className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-600">Market Size</p>
                    <p className="font-semibold text-blue-900">{currentData.marketSize}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-xs text-gray-600">Growth Rate</p>
                    <p className="font-semibold text-green-900">{currentData.growth}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-xs text-gray-600">Urgency</p>
                    <p className="font-semibold text-orange-900">{currentData.urgency}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-xs text-gray-600">Time to Close</p>
                    <p className="font-semibold text-purple-900">{currentData.timeToClose}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button 
                  variant="ghost" 
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => setIsMarketExpanded(!isMarketExpanded)}
                >
                  {isMarketExpanded ? (
                    <>
                      Show Less <ChevronUp className="ml-1 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Read More <ChevronDown className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              {isMarketExpanded && (
                <div className="mt-6 space-y-8 border-t pt-6">
                  {/* Market Size & Growth */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">Market Size & Growth</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-blue-50 rounded-lg">
                            <p className="text-sm font-medium text-blue-900">Total Market Size</p>
                            <p className="text-2xl font-bold text-blue-600">{currentData.marketAnalysis.totalMarketSize}</p>
                          </div>
                          <div className="p-4 bg-green-50 rounded-lg">
                            <p className="text-sm font-medium text-green-900">Market Growth</p>
                            <p className="text-2xl font-bold text-green-600">{currentData.marketAnalysis.marketGrowth}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-purple-50 rounded-lg">
                            <p className="text-sm font-medium text-purple-900">Serviceable Market</p>
                            <p className="text-xl font-bold text-purple-600">{currentData.marketAnalysis.servicableMarket}</p>
                          </div>
                          <div className="p-4 bg-orange-50 rounded-lg">
                            <p className="text-sm font-medium text-orange-900">Targetable Market</p>
                            <p className="text-xl font-bold text-orange-600">{currentData.marketAnalysis.targetableMarket}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h5 className="font-medium mb-3">Market Growth Trajectory</h5>
                        <div className="h-32">
                          <MiniLineChart 
                            data={mockGrowthData}
                            title="Market Growth Trajectory"
                            color="#3b82f6"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Segment Breakdown */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">Segment Breakdown</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        {currentData.marketAnalysis.segments.map((segment, index) => (
                          <div key={index} className="p-4 border rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <h5 className="font-medium">{segment.name}</h5>
                              <Badge variant="outline">{segment.share}</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-600">Market Size</p>
                                <p className="font-semibold">{segment.size}</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Growth Rate</p>
                                <p className="font-semibold text-green-600">{segment.growth}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h5 className="font-medium mb-3">Market Share Distribution</h5>
                        <div className="h-48">
                          <MiniPieChart 
                            data={mockSegmentData}
                            title="Market Share Distribution"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Key Challenges */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">Key Challenges</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentData.marketAnalysis.keyChallenges.map((challenge, index) => (
                        <div key={index} className="p-4 bg-red-50 rounded-lg border-l-4 border-red-400">
                          <p className="text-sm text-red-800">{challenge}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Strategic Recommendations */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">Strategic Recommendations</h4>
                    <div className="space-y-3">
                      {currentData.marketAnalysis.strategicRecommendations.map((recommendation, index) => (
                        <div key={index} className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                          <p className="text-sm text-blue-800">{recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Signals to Monitor */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">Signals to Monitor</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentData.marketAnalysis.signalsToMonitor.map((signal, index) => (
                        <div key={index} className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                          <p className="text-sm text-yellow-800">{signal}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-center gap-3 pt-4 border-t">
                    <Button variant="outline" size="sm">Save Report</Button>
                    <Button variant="outline" size="sm">Export PDF</Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Buyer Map & Roles, Pain Points, Triggers */}
      <div className="space-y-4">
        <Card className="border border-gray-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">Buyer Map & Roles, Pain Points, Triggers</CardTitle>
                <CardDescription className="mt-1">
                  Key stakeholders, challenges, and purchase catalysts
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Primary decision makers include CTOs focused on infrastructure modernization and Heads of Digital 
                  driving customer experience improvements. Key pain points center around legacy system constraints 
                  and regulatory compliance complexity, with funding rounds and competitive pressures serving as 
                  primary buying triggers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                  <User className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-600"># of core buyer personas</p>
                    <p className="font-semibold text-blue-900">{currentData.corePersonas}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                  <Flame className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-xs text-gray-600">Top pain point</p>
                    <p className="font-semibold text-red-900">{currentData.topPainPoint}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="text-xs text-gray-600"># of buying triggers identified</p>
                    <p className="font-semibold text-yellow-900">{currentData.buyingTriggers}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button 
                  variant="ghost" 
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => setIsBuyerMapExpanded(!isBuyerMapExpanded)}
                >
                  {isBuyerMapExpanded ? (
                    <>
                      Show Less <ChevronUp className="ml-1 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Read More <ChevronDown className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              {isBuyerMapExpanded && (
                <div className="mt-6 space-y-6 border-t pt-6">
                  <div>
                    <h4 className="font-semibold mb-4">Buyer Map</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h5 className="font-medium mb-3">Org Chart Visualization</h5>
                      <div className="flex items-center justify-center space-x-8 mb-4">
                        <div className="text-center">
                          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                            <User className="h-8 w-8 text-blue-600" />
                          </div>
                          <p className="text-sm font-medium">CTO</p>
                        </div>
                        <div className="border-t-2 border-dashed border-gray-300 w-16"></div>
                        <div className="text-center">
                          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-2">
                            <User className="h-8 w-8 text-green-600" />
                          </div>
                          <p className="text-sm font-medium">Head of Digital</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                      <div className="p-4 border rounded-lg">
                        <h5 className="font-medium text-blue-900 mb-2">CTO</h5>
                        <p className="text-sm text-gray-600 mb-3">Role focus: Technology strategy, infrastructure modernization</p>
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-1">KPIs:</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li>• Cloud adoption velocity</li>
                            <li>• IT compliance posture</li>
                            <li>• Time-to-market for digital products</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div className="p-4 border rounded-lg">
                        <h5 className="font-medium text-green-900 mb-2">Head of Digital</h5>
                        <p className="text-sm text-gray-600 mb-3">Role focus: Customer experience, digital product rollouts</p>
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-1">KPIs:</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li>• App adoption rates</li>
                            <li>• Customer churn metrics</li>
                            <li>• Regulatory UX compliance</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4">Pain Points</h4>
                    <p className="text-sm text-gray-600 mb-3">For {currentData.title.split(' (')[0]}:</p>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium">Pain Point</th>
                            <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 px-4 py-2 text-sm">Legacy Core Banking Systems</td>
                            <td className="border border-gray-300 px-4 py-2 text-sm">Even newer Neobanks sometimes have inherited legacy systems slowing innovation.</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 px-4 py-2 text-sm">Regulatory Overload</td>
                            <td className="border border-gray-300 px-4 py-2 text-sm">Highly complex rules (e.g. PSD2, Basel IV) strain teams.</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 px-4 py-2 text-sm">Talent Competition</td>
                            <td className="border border-gray-300 px-4 py-2 text-sm">Difficulty attracting compliance-savvy tech talent.</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 px-4 py-2 text-sm">Cost Pressures</td>
                            <td className="border border-gray-300 px-4 py-2 text-sm">Rising CAC and margin compression.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4">Buying Triggers</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium">Trigger</th>
                            <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentData.buyingTriggersArray.map((trigger, index) => (
                            <tr key={index}>
                              <td className="border border-gray-300 px-4 py-2 text-sm font-medium">{trigger.trigger}</td>
                              <td className="border border-gray-300 px-4 py-2 text-sm">{trigger.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4">Recommendations</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm"><strong>Tailor messaging for:</strong></p>
                        <ul className="text-sm text-gray-700 mt-1 space-y-1">
                          <li>• <strong>CTO</strong> → emphasize cloud-native compliance architecture</li>
                          <li>• <strong>Head of Digital</strong> → showcase customer-centric digital capabilities</li>
                        </ul>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-sm"><strong>Time outreach around:</strong></p>
                        <ul className="text-sm text-gray-700 mt-1 space-y-1">
                          <li>• Industry news on regulatory changes</li>
                          <li>• Funding announcements</li>
                        </ul>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <p className="text-sm"><strong>Consider multi-threading both personas early in cycle.</strong></p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center gap-3 pt-4 border-t">
                    <Button variant="outline" size="sm">Save Report</Button>
                    <Button variant="outline" size="sm">Export PDF</Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Competitive Overlap & Buying Signals */}
      <div className="space-y-4">
        <Card className="border border-gray-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">Competitive Overlap & Buying Signals</CardTitle>
                <CardDescription className="mt-1">
                  Competitive landscape analysis and market signals
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Key competitors include {currentData.competitiveData.mainCompetitors.slice(0, 2).join(" and ")} dominating 
                  the established market, while cloud-native solutions gain traction. Recent market signals show increased 
                  funding activity and regulatory-driven technology investments creating new opportunities.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                  <Swords className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-xs text-gray-600">Number of main competitors</p>
                    <p className="font-semibold text-red-900">{currentData.competitors}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-xs text-gray-600">Notable recent win/loss % change</p>
                    <p className="font-semibold text-green-900">{currentData.winLossChange}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg">
                  <Flame className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-xs text-gray-600">Count of active buying signals</p>
                    <p className="font-semibold text-orange-900">{currentData.buyingSignals}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button 
                  variant="ghost" 
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => setIsCompetitiveExpanded(!isCompetitiveExpanded)}
                >
                  {isCompetitiveExpanded ? (
                    <>
                      Show Less <ChevronUp className="ml-1 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Read More <ChevronDown className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              {isCompetitiveExpanded && (
                <div className="mt-6 space-y-6 border-t pt-6">
                  <div>
                    <h4 className="font-semibold mb-4">Competitive Map</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="font-medium">Competitor</TableHead>
                            <TableHead className="font-medium">Segment</TableHead>
                            <TableHead className="font-medium">Share</TableHead>
                            <TableHead className="font-medium">Wins/Losses</TableHead>
                            <TableHead className="font-medium">Differentiators</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentData.competitiveData.competitiveMap.map((competitor, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{competitor.competitor}</TableCell>
                              <TableCell>{competitor.segment}</TableCell>
                              <TableCell>{competitor.share}</TableCell>
                              <TableCell>{competitor.winsLosses}</TableCell>
                              <TableCell>{competitor.differentiators}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4">Competitive News & Events</h4>
                    <div className="space-y-2">
                      {currentData.competitiveData.competitiveNews.map((news, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">"{news}"</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4">Buying Signals</h4>
                    <p className="text-sm text-gray-600 mb-4">For {currentData.title.split(' (')[0]}:</p>
                    
                    <div className="flex gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-gray-500" />
                        <Select value={signalRegionFilter} onValueChange={setSignalRegionFilter}>
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Region" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Regions</SelectItem>
                            <SelectItem value="North America">North America</SelectItem>
                            <SelectItem value="DACH">DACH</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Select value={signalTypeFilter} onValueChange={setSignalTypeFilter}>
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Signal Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="Hiring">Hiring</SelectItem>
                            <SelectItem value="Funding">Funding</SelectItem>
                            <SelectItem value="Tech adoption">Tech Adoption</SelectItem>
                            <SelectItem value="Regulatory">Regulatory</SelectItem>
                            <SelectItem value="Partnership">Partnership</SelectItem>
                            <SelectItem value="Digital">Digital</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="font-medium">Signal Type</TableHead>
                            <TableHead className="font-medium">Description</TableHead>
                            <TableHead className="font-medium">Source</TableHead>
                            <TableHead className="font-medium">Recency</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredBuyingSignals.map((signal, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{signal.signalType}</TableCell>
                              <TableCell>{signal.description}</TableCell>
                              <TableCell>{signal.source}</TableCell>
                              <TableCell>{signal.recency}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4">Recommendations</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm"><strong>Tailor competitive positioning:</strong></p>
                        <ul className="text-sm text-gray-700 mt-1 space-y-1">
                          <li>• Highlight your compliance expertise against Temenos</li>
                          <li>• Emphasize faster API deployment vs. Stripe</li>
                        </ul>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-sm"><strong>Outreach triggers:</strong></p>
                        <ul className="text-sm text-gray-700 mt-1 space-y-1">
                          <li>• Follow-up after news of funding rounds</li>
                          <li>• Leverage regulatory announcements to open discussions</li>
                        </ul>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <p className="text-sm"><strong>Consider region-specific messaging:</strong></p>
                        <ul className="text-sm text-gray-700 mt-1 space-y-1">
                          <li>• DACH → heavy focus on compliance trust</li>
                          <li>• North America → speed and innovation</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center gap-3 pt-4 border-t">
                    <Button variant="outline" size="sm">Save Report</Button>
                    <Button variant="outline" size="sm">Export PDF</Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Regulatory, Compliance & Recommended ICP */}
      <div className="space-y-4">
        <Card className="border border-gray-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">Regulatory, Compliance & Recommended ICP</CardTitle>
                <CardDescription className="mt-1">
                  Regulatory frameworks, compliance requirements, and ICP refinement recommendations
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Neobanks in North America & DACH face increasing compliance requirements, especially around cloud-hosted data and financial KYC/AML. This section recommends refining your ICP to reflect these regulatory triggers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-600">Key Compliance Frameworks</p>
                    <p className="font-semibold text-blue-900">GDPR, PSD2</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-xs text-gray-600">Upcoming Mandates</p>
                    <p className="font-semibold text-orange-900">Cloud audit rules (DACH, Q4 2025)</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-xs text-gray-600">ICP Fit Score</p>
                    <p className="font-semibold text-purple-900">92% match</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-xs text-gray-600">Recommendation Confidence</p>
                    <p className="font-semibold text-green-900">High</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button 
                  variant="ghost" 
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => setIsRegulatoryExpanded(!isRegulatoryExpanded)}
                >
                  {isRegulatoryExpanded ? (
                    <>
                      Show Less <ChevronUp className="ml-1 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Read More <ChevronDown className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              {isRegulatoryExpanded && (
                <div className="mt-6 space-y-8 border-t pt-6">
                  {/* Regulatory Landscape */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">Regulatory Landscape</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="p-4 border rounded-lg">
                          <h5 className="font-medium text-blue-900 mb-2">GDPR (General Data Protection Regulation)</h5>
                          <p className="text-sm text-gray-600 mb-3">EU-wide data protection and privacy regulation affecting all financial services</p>
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-1">Key Requirements:</p>
                            <ul className="text-xs text-gray-600 space-y-1">
                              <li>• Data minimization and purpose limitation</li>
                              <li>• Right to data portability and erasure</li>
                              <li>• Privacy by design and by default</li>
                              <li>• Data breach notification within 72 hours</li>
                            </ul>
                          </div>
                        </div>
                        
                        <div className="p-4 border rounded-lg">
                          <h5 className="font-medium text-green-900 mb-2">PSD2 (Payment Services Directive 2)</h5>
                          <p className="text-sm text-gray-600 mb-3">European regulation for payment services and open banking</p>
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-1">Key Requirements:</p>
                            <ul className="text-xs text-gray-600 space-y-1">
                              <li>• Strong customer authentication (SCA)</li>
                              <li>• Open banking API requirements</li>
                              <li>• Third-party provider access</li>
                              <li>• Enhanced security standards</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 border rounded-lg">
                          <h5 className="font-medium text-orange-900 mb-2">DACH Cloud Audit Rules</h5>
                          <p className="text-sm text-gray-600 mb-3">Upcoming compliance requirements for cloud-hosted financial data</p>
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-1">Timeline & Impact:</p>
                            <ul className="text-xs text-gray-600 space-y-1">
                              <li>• Implementation deadline: Q4 2025</li>
                              <li>• Mandatory cloud audit trails</li>
                              <li>• Data residency requirements</li>
                              <li>• Vendor risk assessment protocols</li>
                            </ul>
                          </div>
                        </div>

                        <div className="p-4 border rounded-lg">
                          <h5 className="font-medium text-red-900 mb-2">KYC/AML Compliance</h5>
                          <p className="text-sm text-gray-600 mb-3">Know Your Customer and Anti-Money Laundering requirements</p>
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-1">Core Elements:</p>
                            <ul className="text-xs text-gray-600 space-y-1">
                              <li>• Customer due diligence (CDD)</li>
                              <li>• Suspicious activity monitoring</li>
                              <li>• Transaction reporting requirements</li>
                              <li>• Risk-based compliance programs</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Compliance Challenges */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">Compliance Challenges</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-red-50 rounded-lg border-l-4 border-red-400">
                        <h5 className="font-medium text-red-800 mb-2">Cross-Border Data Transfers</h5>
                        <p className="text-sm text-red-700">Complex requirements for moving customer data between jurisdictions while maintaining compliance</p>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg border-l-4 border-red-400">
                        <h5 className="font-medium text-red-800 mb-2">Cloud Vendor Management</h5>
                        <p className="text-sm text-red-700">Ensuring third-party cloud providers meet regulatory standards and audit requirements</p>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg border-l-4 border-red-400">
                        <h5 className="font-medium text-red-800 mb-2">Real-time Compliance Monitoring</h5>
                        <p className="text-sm text-red-700">Need for automated systems to detect and prevent compliance violations in real-time</p>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg border-l-4 border-red-400">
                        <h5 className="font-medium text-red-800 mb-2">Regulatory Fragmentation</h5>
                        <p className="text-sm text-red-700">Different requirements across regions making multi-jurisdiction operations complex</p>
                      </div>
                    </div>
                  </div>

                  {/* ICP Refinement Recommendations */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">ICP Refinement Recommendations</h4>
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                        <h5 className="font-medium text-blue-800 mb-2">Target High-Compliance Organizations</h5>
                        <p className="text-sm text-blue-700">Focus on neobanks that have already invested in compliance infrastructure and understand regulatory complexity</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                        <h5 className="font-medium text-blue-800 mb-2">Prioritize Multi-Jurisdiction Players</h5>
                        <p className="text-sm text-blue-700">Companies operating across North America and DACH regions face the highest compliance burden and need</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                        <h5 className="font-medium text-blue-800 mb-2">Focus on Cloud-First Organizations</h5>
                        <p className="text-sm text-blue-700">Target companies already committed to cloud infrastructure who need compliance-ready solutions</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                        <h5 className="font-medium text-blue-800 mb-2">Emphasize Audit-Ready Capabilities</h5>
                        <p className="text-sm text-blue-700">Position solutions that provide built-in audit trails and compliance reporting features</p>
                      </div>
                    </div>
                  </div>

                  {/* Regulatory Triggers & Timing */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">Regulatory Triggers & Timing</h4>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="font-medium">Regulatory Event</TableHead>
                            <TableHead className="font-medium">Timeline</TableHead>
                            <TableHead className="font-medium">Impact</TableHead>
                            <TableHead className="font-medium">Opportunity</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">DACH Cloud Audit Rules</TableCell>
                            <TableCell>Q4 2025</TableCell>
                            <TableCell>Mandatory compliance for cloud infrastructure</TableCell>
                            <TableCell>High - Infrastructure modernization needed</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">PSD2 SCA Updates</TableCell>
                            <TableCell>Q2 2025</TableCell>
                            <TableCell>Enhanced authentication requirements</TableCell>
                            <TableCell>Medium - API and security upgrades</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">GDPR Enforcement Increase</TableCell>
                            <TableCell>Ongoing</TableCell>
                            <TableCell>Higher penalties and stricter audits</TableCell>
                            <TableCell>High - Privacy-by-design solutions</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Basel IV Implementation</TableCell>
                            <TableCell>Q1 2026</TableCell>
                            <TableCell>Capital and risk management changes</TableCell>
                            <TableCell>Medium - Risk calculation systems</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="flex justify-center gap-3 pt-4 border-t">
                    <Button variant="outline" size="sm">Save Report</Button>
                    <Button variant="outline" size="sm">Export PDF</Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
