import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, MessageSquare, Send, BarChart3, PieChart, Layers, Globe, TrendingUp, LineChart, ChartLine, ChartBar } from "lucide-react";
import { 
  Drawer, 
  DrawerClose, 
  DrawerContent, 
  DrawerDescription, 
  DrawerFooter, 
  DrawerHeader, 
  DrawerTitle 
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MarketResearch = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "ai", content: "Hello! I'm Scout. How can I help with your market research today?" }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("intelligence");
  const [selectedMarket, setSelectedMarket] = useState<{
    name: string;
    score: string;
    size: string;
    competition: string;
    barriers: string;
    details: any;
  } | null>(null);

  const marketData = {
    "UK Fintech": {
      name: "UK Fintech Market",
      score: "87/100",
      size: "$24.5B",
      competition: "Medium",
      barriers: "Low",
      details: {
        summary: "The UK fintech market shows strong growth potential with a solid regulatory framework and established financial infrastructure.",
        subMarkets: [
          { name: "Digital Banking", size: "$8.7B", growth: "+12% YoY" },
          { name: "Payment Solutions", size: "$6.3B", growth: "+9% YoY" },
          { name: "Wealth Management", size: "$5.2B", growth: "+7% YoY" },
          { name: "Insurtech", size: "$2.8B", growth: "+15% YoY" },
          { name: "Regtech", size: "$1.5B", growth: "+19% YoY" }
        ],
        keyInsights: [
          "Strong regulatory support through FCA's Sandbox program",
          "High digital adoption rate among consumers (78%)",
          "Established financial center with access to capital",
          "Brexit concerns creating some market uncertainty",
          "Growing competition from EU fintech hubs"
        ],
        recommendedActions: [
          "Focus on partnerships with traditional banks",
          "Target digital-first customer segments",
          "Leverage UK's open banking framework",
          "Consider regulatory compliance solutions"
        ]
      }
    },
    "Germany Healthtech": {
      name: "Germany Healthtech Market",
      score: "72/100",
      size: "$18.2B",
      competition: "High",
      barriers: "Medium",
      details: {
        summary: "The German healthtech market presents solid opportunities but comes with regulatory complexities and established competitors.",
        subMarkets: [
          { name: "Digital Health Records", size: "$5.3B", growth: "+8% YoY" },
          { name: "Telemedicine", size: "$4.7B", growth: "+22% YoY" },
          { name: "Health Monitoring", size: "$4.1B", growth: "+11% YoY" },
          { name: "Digital Therapeutics", size: "$2.6B", growth: "+16% YoY" },
          { name: "Healthcare AI", size: "$1.5B", growth: "+25% YoY" }
        ],
        keyInsights: [
          "Strict regulatory framework with recent digital health laws",
          "Aging population driving demand for health solutions",
          "Strong public healthcare system with increasing digital adoption",
          "Conservative approach to new health technologies",
          "High data privacy standards and GDPR compliance requirements"
        ],
        recommendedActions: [
          "Partner with established healthcare providers",
          "Invest in obtaining necessary German certifications",
          "Focus on solutions for chronic disease management",
          "Ensure robust data protection measures"
        ]
      }
    },
    "France SaaS": {
      name: "France SaaS Market",
      score: "65/100",
      size: "$12.8B",
      competition: "Medium",
      barriers: "Medium",
      details: {
        summary: "The French SaaS market shows moderate growth potential with government initiatives supporting digital transformation.",
        subMarkets: [
          { name: "Business Management", size: "$3.9B", growth: "+8% YoY" },
          { name: "Customer Experience", size: "$2.8B", growth: "+11% YoY" },
          { name: "HR & Productivity", size: "$2.5B", growth: "+7% YoY" },
          { name: "Marketing & Sales", size: "$2.1B", growth: "+9% YoY" },
          { name: "Industry Solutions", size: "$1.5B", growth: "+12% YoY" }
        ],
        keyInsights: [
          "Growing adoption of cloud solutions in enterprises",
          "Government initiatives supporting digital transformation",
          "Preference for local vendors with French language support",
          "Concerns about US tech dominance affecting buying decisions",
          "Strong protection for workers affecting HR software requirements"
        ],
        recommendedActions: [
          "Localize products with full French language support",
          "Target mid-market enterprises undergoing digital transformation",
          "Establish local presence or French partnerships",
          "Highlight EU data residency and GDPR compliance"
        ]
      }
    }
  };

  // Market analysis data
  const marketAnalysisData = {
    competitorData: [
      { name: "Rival Fintech", marketShare: "23%", growthRate: "+8%", strengths: "Established brand, Strong partnerships", weaknesses: "Legacy systems, Slow innovation" },
      { name: "Tech Banking", marketShare: "18%", growthRate: "+15%", strengths: "Strong tech stack, Seamless UX", weaknesses: "Limited reach, Higher fees" },
      { name: "Finance Plus", marketShare: "12%", growthRate: "+5%", strengths: "Wide product range, Global presence", weaknesses: "Fragmented offerings, Poor customer service" },
      { name: "NextPay", marketShare: "9%", growthRate: "+22%", strengths: "Rapid innovation, Mobile-first", weaknesses: "Limited features, Small customer base" }
    ],
    swotAnalysis: {
      strengths: ["Innovative product offerings", "Lower operational costs", "Superior user experience", "Faster time-to-market"],
      weaknesses: ["Limited market recognition", "Smaller customer base", "Less regulatory experience", "Capital constraints"],
      opportunities: ["Growing digital adoption", "Underserved market segments", "Open banking regulations", "Strategic partnerships"],
      threats: ["Increasing competition", "Regulatory changes", "Cybersecurity risks", "Economic uncertainty"]
    },
    marketSegments: [
      { segment: "Young Professionals", size: "32%", growthPotential: "High", acquisitionCost: "Medium", needsMatch: "Strong" },
      { segment: "Small Businesses", size: "28%", growthPotential: "Very High", acquisitionCost: "High", needsMatch: "Strong" },
      { segment: "Enterprise Clients", size: "15%", growthPotential: "Medium", acquisitionCost: "Very High", needsMatch: "Moderate" },
      { segment: "Senior Adopters", size: "12%", growthPotential: "Low", acquisitionCost: "High", needsMatch: "Weak" },
      { segment: "Students", size: "13%", growthPotential: "Medium", acquisitionCost: "Low", needsMatch: "Strong" }
    ]
  };

  // Trend spotting data
  const trendSpottingData = {
    emergingTrends: [
      { 
        trend: "Embedded Finance", 
        growthRate: "+35%", 
        adoption: "Early Mainstream", 
        impact: "High",
        description: "Integration of financial services into non-financial platforms and apps"
      },
      { 
        trend: "DeFi Integration", 
        growthRate: "+62%", 
        adoption: "Early Adopters", 
        impact: "Medium",
        description: "Incorporating decentralized finance into traditional financial services"
      },
      { 
        trend: "Hyper-personalization", 
        growthRate: "+28%", 
        adoption: "Early Mainstream", 
        impact: "High",
        description: "AI-powered personalized financial advice and services"
      },
      { 
        trend: "Green Finance", 
        growthRate: "+45%", 
        adoption: "Growing", 
        impact: "Medium-High",
        description: "Sustainable investment options and environmental impact tracking"
      },
      { 
        trend: "Voice Banking", 
        growthRate: "+20%", 
        adoption: "Early", 
        impact: "Medium",
        description: "Voice-activated banking through smart assistants and devices"
      }
    ],
    technologyDrivers: [
      { technology: "Artificial Intelligence", maturity: "Growing", relevance: "Critical", timeToAdopt: "Now" },
      { technology: "Blockchain", maturity: "Emerging", relevance: "High", timeToAdopt: "1-2 Years" },
      { technology: "IoT Financial Services", maturity: "Early", relevance: "Medium", timeToAdopt: "2-3 Years" },
      { technology: "Quantum Computing", maturity: "Experimental", relevance: "Potential", timeToAdopt: "5+ Years" }
    ],
    consumerTrends: [
      { trend: "Financial Wellness Focus", strength: "Strong", persistence: "Long-term", demographics: "All ages" },
      { trend: "Cashless Preference", strength: "Very Strong", persistence: "Long-term", demographics: "Under 40" },
      { trend: "Subscription Model Adoption", strength: "Growing", persistence: "Medium-term", demographics: "Millennials, Gen Z" },
      { trend: "Financial Transparency Demand", strength: "Strong", persistence: "Long-term", demographics: "All ages" }
    ]
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    // Add user message
    setMessages([...messages, { role: "user", content: inputValue }]);
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(current => [...current, { 
        role: "ai", 
        content: "I can analyze this market for you. Would you like me to focus on market size, competitor landscape, or growth potential?"
      }]);
    }, 1000);
    
    setInputValue("");
  };

  const handleViewResults = (marketName: string) => {
    const market = marketData[marketName as keyof typeof marketData];
    setSelectedMarket(market);
    setIsDrawerOpen(true);
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
              <Search className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Market Research (Scout)</h1>
              <p className="text-gray-500">Find the best markets before your competitors do</p>
              <div className="flex gap-2 mt-2">
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">
                  Market Intelligence
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  Market analysis
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  Trend spotting
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => setIsChatOpen(!isChatOpen)}
            >
              <MessageSquare className="h-4 w-4" />
              Chat with Scout
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
              <Search className="h-4 w-4" />
              New Research
            </Button>
          </div>
        </div>

        {isChatOpen && (
          <Card className="border-blue-200 bg-blue-50/40 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-sales-blue" />
                Scout Agent Chat
              </CardTitle>
              <CardDescription>
                Ask Scout about markets, competitor analysis or request new research
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-white rounded-md border border-gray-200 p-4 flex flex-col gap-3">
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {messages.map((message, index) => (
                    <div 
                      key={index}
                      className={`${
                        message.role === "ai" 
                          ? "bg-blue-50 rounded-lg p-3 self-start max-w-[80%]" 
                          : "bg-gray-100 rounded-lg p-3 self-end max-w-[80%] ml-auto"
                      }`}
                    >
                      <p className="text-sm font-medium">
                        {message.role === "ai" ? "Scout" : "You"}
                      </p>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2 mt-2">
                  <Input
                    type="text" 
                    placeholder="Ask Scout about market opportunities..."
                    className="flex-1"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendMessage();
                    }}
                  />
                  <Button 
                    className="bg-sales-blue hover:bg-blue-700 flex items-center gap-2"
                    onClick={handleSendMessage}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <Tabs defaultValue="intelligence" value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="w-full bg-gray-100 p-1 mb-2">
            <TabsTrigger value="intelligence" className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4" />
              Market Intelligence
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2 flex-1">
              <ChartBar className="h-4 w-4" />
              Market Analysis
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-2 flex-1">
              <TrendingUp className="h-4 w-4" />
              Trend Spotting
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="intelligence" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Card className="col-span-1 lg:col-span-2">
                <CardHeader>
                  <CardTitle>Recent Market Research</CardTitle>
                  <CardDescription>Access your previous market analyses</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border rounded-md p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium">UK Fintech Market Analysis</h3>
                          <p className="text-sm text-gray-500">Completed 2 days ago</p>
                        </div>
                        <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full">
                          Completed
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">Analysis of 5 fintech submarkets with TAM calculation and competitor landscape.</p>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Market Score: 87/100</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-sales-blue flex items-center gap-1"
                          onClick={() => handleViewResults("UK Fintech")}
                        >
                          View Results <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded-md p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium">Germany Healthtech Expansion</h3>
                          <p className="text-sm text-gray-500">Completed 1 week ago</p>
                        </div>
                        <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full">
                          Completed
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">Overview of German healthtech market opportunities and regulatory landscape.</p>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Market Score: 72/100</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-sales-blue flex items-center gap-1"
                          onClick={() => handleViewResults("Germany Healthtech")}
                        >
                          View Results <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Scout Capabilities</CardTitle>
                  <CardDescription>What this agent can do for you</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                        1
                      </div>
                      <span className="text-sm">Market size estimation & TAM analysis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                        2
                      </div>
                      <span className="text-sm">Competitor research & positioning</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                        3
                      </div>
                      <span className="text-sm">Industry trends & growth forecasts</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                        4
                      </div>
                      <span className="text-sm">Regulatory & compliance landscape</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                        5
                      </div>
                      <span className="text-sm">Market entry barriers analysis</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Market Rankings</CardTitle>
                <CardDescription>Comparative analysis of potential markets</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left">Market</th>
                        <th className="px-4 py-2 text-left">Score</th>
                        <th className="px-4 py-2 text-left">Size (TAM)</th>
                        <th className="px-4 py-2 text-left">Competition</th>
                        <th className="px-4 py-2 text-left">Barriers</th>
                        <th className="px-4 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="px-4 py-3">UK Fintech</td>
                        <td className="px-4 py-3">
                          <span className="font-medium">87/100</span>
                        </td>
                        <td className="px-4 py-3">$24.5B</td>
                        <td className="px-4 py-3">Medium</td>
                        <td className="px-4 py-3">Low</td>
                        <td className="px-4 py-3">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-sales-blue"
                            onClick={() => handleViewResults("UK Fintech")}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3">Germany Healthtech</td>
                        <td className="px-4 py-3">
                          <span className="font-medium">72/100</span>
                        </td>
                        <td className="px-4 py-3">$18.2B</td>
                        <td className="px-4 py-3">High</td>
                        <td className="px-4 py-3">Medium</td>
                        <td className="px-4 py-3">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-sales-blue"
                            onClick={() => handleViewResults("Germany Healthtech")}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3">France SaaS</td>
                        <td className="px-4 py-3">
                          <span className="font-medium">65/100</span>
                        </td>
                        <td className="px-4 py-3">$12.8B</td>
                        <td className="px-4 py-3">Medium</td>
                        <td className="px-4 py-3">Medium</td>
                        <td className="px-4 py-3">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-sales-blue"
                            onClick={() => handleViewResults("France SaaS")}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="analysis" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" /> Competitor Analysis
                  </CardTitle>
                  <CardDescription>Detailed analysis of key market competitors</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competitor</TableHead>
                        <TableHead>Market Share</TableHead>
                        <TableHead>Growth</TableHead>
                        <TableHead>Strengths</TableHead>
                        <TableHead>Weaknesses</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marketAnalysisData.competitorData.map((competitor, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{competitor.name}</TableCell>
                          <TableCell>{competitor.marketShare}</TableCell>
                          <TableCell className="text-green-600">{competitor.growthRate}</TableCell>
                          <TableCell>{competitor.strengths}</TableCell>
                          <TableCell>{competitor.weaknesses}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ChartLine className="h-5 w-5 text-blue-600" /> Market Segments
                  </CardTitle>
                  <CardDescription>Analysis of key market segments and their potential</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Segment</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Growth</TableHead>
                        <TableHead>Acquisition Cost</TableHead>
                        <TableHead>Needs Match</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marketAnalysisData.marketSegments.map((segment, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{segment.segment}</TableCell>
                          <TableCell>{segment.size}</TableCell>
                          <TableCell>{segment.growthPotential}</TableCell>
                          <TableCell>{segment.acquisitionCost}</TableCell>
                          <TableCell>{segment.needsMatch}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-blue-600" /> SWOT Analysis
                </CardTitle>
                <CardDescription>Strengths, Weaknesses, Opportunities, and Threats</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-green-50 rounded-md p-4 border border-green-100">
                    <h3 className="text-green-700 font-medium mb-2">Strengths</h3>
                    <ul className="space-y-1">
                      {marketAnalysisData.swotAnalysis.strengths.map((strength, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <span className="text-green-600 font-bold">+</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-red-50 rounded-md p-4 border border-red-100">
                    <h3 className="text-red-700 font-medium mb-2">Weaknesses</h3>
                    <ul className="space-y-1">
                      {marketAnalysisData.swotAnalysis.weaknesses.map((weakness, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <span className="text-red-600 font-bold">-</span>
                          <span>{weakness}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-blue-50 rounded-md p-4 border border-blue-100">
                    <h3 className="text-blue-700 font-medium mb-2">Opportunities</h3>
                    <ul className="space-y-1">
                      {marketAnalysisData.swotAnalysis.opportunities.map((opportunity, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <span className="text-blue-600 font-bold">→</span>
                          <span>{opportunity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-amber-50 rounded-md p-4 border border-amber-100">
                    <h3 className="text-amber-700 font-medium mb-2">Threats</h3>
                    <ul className="space-y-1">
                      {marketAnalysisData.swotAnalysis.threats.map((threat, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <span className="text-amber-600 font-bold">!</span>
                          <span>{threat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="trends" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Card className="col-span-1 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" /> Emerging Market Trends
                  </CardTitle>
                  <CardDescription>Key trends shaping the future of the market</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {trendSpottingData.emergingTrends.map((trend, index) => (
                      <div key={index} className="border rounded-md p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-medium text-blue-700">{trend.trend}</h3>
                          <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full">
                            {trend.growthRate}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{trend.description}</p>
                        <div className="flex gap-4 text-xs">
                          <div>
                            <span className="text-gray-500">Adoption:</span>
                            <span className="ml-1 font-medium">{trend.adoption}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Impact:</span>
                            <span className="ml-1 font-medium">{trend.impact}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ChartLine className="h-5 w-5 text-blue-600" /> Consumer Behavior Shifts
                  </CardTitle>
                  <CardDescription>Evolving consumer preferences</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trend</TableHead>
                        <TableHead>Strength</TableHead>
                        <TableHead>Persistence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trendSpottingData.consumerTrends.map((trend, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{trend.trend}</TableCell>
                          <TableCell>{trend.strength}</TableCell>
                          <TableCell>{trend.persistence}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-blue-600" /> Technology Drivers
                </CardTitle>
                <CardDescription>Technologies shaping market evolution</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Technology</TableHead>
                      <TableHead>Maturity Level</TableHead>
                      <TableHead>Business Relevance</TableHead>
                      <TableHead>Time to Adopt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trendSpottingData.technologyDrivers.map((tech, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{tech.technology}</TableCell>
                        <TableCell>{tech.maturity}</TableCell>
                        <TableCell>{tech.relevance}</TableCell>
                        <TableCell>{tech.timeToAdopt}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Results Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="border-b">
            <DrawerTitle className="text-xl flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              {selectedMarket?.name}
            </DrawerTitle>
            <DrawerDescription>
              Market score: <span className="font-medium">{selectedMarket?.score}</span> | 
              TAM: <span className="font-medium">{selectedMarket?.size}</span>
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="p-6 overflow-auto">
            {selectedMarket && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-blue-600" /> Market Summary
                  </h3>
                  <p className="text-gray-700">{selectedMarket.details.summary}</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blue-600" /> Sub-Markets
                  </h3>
                  <div className="bg-white rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="px-4 py-2 text-left">Sub-Market</th>
                          <th className="px-4 py-2 text-left">Size</th>
                          <th className="px-4 py-2 text-left">Growth</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedMarket.details.subMarkets.map((submarket: any, index: number) => (
                          <tr key={index}>
                            <td className="px-4 py-2">{submarket.name}</td>
                            <td className="px-4 py-2">{submarket.size}</td>
                            <td className="px-4 py-2 text-green-600">{submarket.growth}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" /> Key Insights
                    </h3>
                    <ul className="space-y-2">
                      {selectedMarket.details.keyInsights.map((insight: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                            {index + 1}
                          </div>
                          <span className="text-sm">{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                      <Globe className="h-5 w-5 text-blue-600" /> Recommended Actions
                    </h3>
                    <ul className="space-y-2">
                      {selectedMarket.details.recommendedActions.map((action: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="h-5 w-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                            {index + 1}
                          </div>
                          <span className="text-sm">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DrawerFooter className="border-t">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
              Generate Full Report
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Layout>
  );
};

export default MarketResearch;
