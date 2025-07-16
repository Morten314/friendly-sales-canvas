import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, TrendingUp, Clock, Target, DollarSign, User, Zap, Flame, Users, Swords, TrendingDown } from "lucide-react";
import MiniLineChart from "@/components/MiniLineChart";
import MiniPieChart from "@/components/MiniPieChart";

export const ICPSummaryOpportunity = () => {
  const [isMarketExpanded, setIsMarketExpanded] = useState(false);
  const [isBuyerMapExpanded, setIsBuyerMapExpanded] = useState(false);
  const [isCompetitiveExpanded, setIsCompetitiveExpanded] = useState(false);
  const [activeCard, setActiveCard] = useState(1);

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
      competitiveData: {
        mainCompetitors: ["Temenos", "Mambu", "Thought Machine", "10x Banking"],
        marketShareShifts: "Traditional core banking vendors losing 15% market share to cloud-native solutions",
        recentSignals: [
          { signal: "Funding Announcements", count: 12, trend: "up" },
          { signal: "Regulatory Updates", count: 8, trend: "up" },
          { signal: "Tech Stack Migrations", count: 15, trend: "up" },
          { signal: "Partnership Announcements", count: 6, trend: "stable" }
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
      competitiveData: {
        mainCompetitors: ["Guidewire", "Duck Creek", "Sapiens", "Insurity", "Majesco"],
        marketShareShifts: "Cloud-first insurance platforms growing 25% annually vs legacy on-premise solutions",
        recentSignals: [
          { signal: "Digital Initiative Announcements", count: 8, trend: "up" },
          { signal: "Legacy System Replacements", count: 10, trend: "up" },
          { signal: "Customer Experience Investments", count: 7, trend: "up" },
          { signal: "RegTech Partnerships", count: 4, trend: "stable" }
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
      competitiveData: {
        mainCompetitors: ["Stripe", "Plaid", "Adyen"],
        marketShareShifts: "API-first fintech infrastructure providers capturing 40% of new FinTech implementations",
        recentSignals: [
          { signal: "Funding Rounds", count: 18, trend: "up" },
          { signal: "Product Launches", count: 14, trend: "up" },
          { signal: "Expansion Announcements", count: 11, trend: "up" },
          { signal: "Compliance Partnerships", count: 9, trend: "up" }
        ]
      }
    }
  };

  const currentData = mockData[activeCard as keyof typeof mockData];

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
                <div className="mt-6 space-y-6 border-t pt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3">Market Dynamics</h4>
                      <div className="space-y-3">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <h5 className="font-medium text-sm">Total Addressable Market</h5>
                          <p className="text-xs text-gray-600 mt-1">European financial services infrastructure market showing strong growth trajectory</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <h5 className="font-medium text-sm">Market Trends</h5>
                          <p className="text-xs text-gray-600 mt-1">Shift from legacy systems to cloud-native solutions accelerating post-pandemic</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <h5 className="font-medium text-sm">Regulatory Impact</h5>
                          <p className="text-xs text-gray-600 mt-1">Open banking and PSD2 compliance driving infrastructure modernization</p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-3">Opportunity Sizing</h4>
                      <div className="space-y-4">
                        <div className="p-4 border rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Market Penetration</span>
                            <span className="text-sm text-gray-600">23%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '23%' }}></div>
                          </div>
                        </div>
                        
                        <div className="p-4 border rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Competitive Intensity</span>
                            <span className="text-sm text-gray-600">Medium</span>
                          </div>
                          <div className="flex gap-1">
                            <div className="w-4 h-2 bg-green-500 rounded"></div>
                            <div className="w-4 h-2 bg-green-500 rounded"></div>
                            <div className="w-4 h-2 bg-yellow-500 rounded"></div>
                            <div className="w-4 h-2 bg-gray-200 rounded"></div>
                            <div className="w-4 h-2 bg-gray-200 rounded"></div>
                          </div>
                        </div>
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
                    <h4 className="font-semibold mb-4">Main Competitors</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentData.competitiveData.mainCompetitors.map((competitor, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <h5 className="font-medium">{competitor}</h5>
                            <Badge variant="outline" className="text-xs">
                              {index === 0 ? "Market Leader" : index === 1 ? "Strong Player" : "Emerging"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4">Market Share Shifts</h4>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">{currentData.competitiveData.marketShareShifts}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4">Recent Buying Signals</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentData.competitiveData.recentSignals.map((signal, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-sm">{signal.signal}</h5>
                            <div className="flex items-center gap-1">
                              {signal.trend === "up" ? (
                                <TrendingUp className="h-4 w-4 text-green-600" />
                              ) : signal.trend === "down" ? (
                                <TrendingDown className="h-4 w-4 text-red-600" />
                              ) : (
                                <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                              )}
                              <span className="text-lg font-semibold">{signal.count}</span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600">
                            {signal.trend === "up" ? "Increasing activity" : 
                             signal.trend === "down" ? "Decreasing activity" : "Stable activity"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4">Competitive Positioning</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm"><strong>Differentiation Strategy:</strong></p>
                        <p className="text-sm text-gray-700 mt-1">
                          Focus on cloud-native architecture and regulatory compliance automation vs. legacy infrastructure approaches
                        </p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-sm"><strong>Win Themes:</strong></p>
                        <ul className="text-sm text-gray-700 mt-1 space-y-1">
                          <li>• Faster time-to-market for new financial products</li>
                          <li>• Built-in compliance frameworks</li>
                          <li>• API-first architecture for ecosystem integration</li>
                        </ul>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <p className="text-sm"><strong>Competitive Threats:</strong></p>
                        <p className="text-sm text-gray-700 mt-1">
                          Watch for incumbent vendors adding cloud capabilities and new entrants with specialized vertical solutions
                        </p>
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
    </div>
  );
};
