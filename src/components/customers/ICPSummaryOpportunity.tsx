import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Edit, Save, MessageSquare, Target, Globe, Settings, DollarSign, TrendingUp, MapPin, Lightbulb, Copy, MoreHorizontal, ChevronDown, Bot, Users, Building, Download, FileText } from "lucide-react";
import MiniLineChart from "@/components/MiniLineChart";
import MiniPieChart from "@/components/MiniPieChart";

interface ICPSummaryOpportunityProps {
  activeICP?: {
    id: string;
    industry: string;
    segment: string;
  };
}

export const ICPSummaryOpportunity = ({ activeICP }: ICPSummaryOpportunityProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [showProfilerChat, setShowProfilerChat] = useState(false);
  const [editHistory, setEditHistory] = useState<string[]>([]);

  const handleEdit = (section: string) => {
    setEditingSection(section);
    if (!editHistory.includes(section)) {
      setEditHistory([...editHistory, section]);
    }
  };

  const handleSave = (section: string) => {
    setEditingSection(null);
    setShowProfilerChat(true);
  };

  const handleCopyInsight = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Dynamic content based on active ICP
  const getICPContent = () => {
    const defaultContent = {
      blurb: "Neobanks in the fintech sector are rapidly scaling across North America and DACH, driven by high cloud adoption and strong regulatory compliance demands. Mid-sized players (50–200 employees) are emerging as innovators yet face margin pressures and evolving regulatory landscapes. These financial institutions are increasingly investing in advanced API-first infrastructure to compete with traditional banks. The sector shows strong momentum toward embedded finance solutions and customer-centric digital experiences.",
      stats: [
        { icon: TrendingUp, label: "Market Growth", value: "5.6% CAGR", color: "green" },
        { icon: DollarSign, label: "Market Size", value: "$3.2B TAM in North America, $1.1B in DACH", color: "green" },
        { icon: Users, label: "Active Players", value: "~150 Neobank firms in target segments", color: "blue" },
        { icon: Building, label: "Investment Activity", value: "$2.4B raised in past 12 months", color: "orange" }
      ],
      marketSize: "$4.3B",
      sam: "$3.2B",
      regions: "North America + DACH",
      topVertical: "Neobanks",
      cagr: "5.6%",
      reportTitle: "Neobank Market Intelligence Report"
    };

    if (activeICP?.industry === "Fintech" && activeICP?.segment === "Neobanks") {
      return defaultContent;
    }

    // For other ICPs, return different content - this makes it dynamic
    if (activeICP?.industry === "Clean Energy") {
      return {
        blurb: "Solar management platforms in the clean energy sector are experiencing rapid growth across multiple regions, driven by sustainability mandates and IoT integration demands. Companies with 120–500 employees are leading innovation while navigating complex regulatory landscapes.",
        stats: [
          { icon: TrendingUp, label: "Market Growth", value: "18.2% CAGR", color: "green" },
          { icon: DollarSign, label: "Market Size", value: "$5.8B TAM globally", color: "green" },
          { icon: Users, label: "Active Players", value: "~85 Solar Management firms", color: "blue" },
          { icon: Building, label: "Investment Activity", value: "$3.1B raised in past 12 months", color: "orange" }
        ],
        marketSize: "$5.8B",
        sam: "$4.2B",
        regions: "North America + EU + ANZ",
        topVertical: "Solar Management Platforms",
        cagr: "18.2%",
        reportTitle: "Clean Energy Market Intelligence Report"
      };
    }

    return defaultContent;
  };

  const content = getICPContent();

  const marketSegmentationData = [{
    name: "North America",
    value: 65,
    color: "#0064FF"
  }, {
    name: "DACH",
    value: 25,
    color: "#00A3FF"
  }, {
    name: "Other EU",
    value: 10,
    color: "#66C2FF"
  }];

  const tamGrowthData = [{
    name: "2022",
    value: 2.8
  }, {
    name: "2023",
    value: 3.2
  }, {
    name: "2024",
    value: 3.6
  }, {
    name: "2025",
    value: 4.0
  }, {
    name: "2026",
    value: 4.2
  }, {
    name: "2027",
    value: 4.3
  }];

  if (!isExpanded) {
    // Collapsed Default View
    return <div className="space-y-6">
        {/* Category Header */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 relative">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">ICP Summary & Market Opportunity</h2>
              <p className="text-sm text-gray-600">
                High-level snapshot of market fit & revenue potential
              </p>
            </div>
            <div className="flex items-center gap-2">
              {editHistory.length > 0 && <Button variant="ghost" size="sm" className="text-xs text-gray-500">
                  <MoreHorizontal className="h-3 w-3 mr-1" />
                  Edit History
                </Button>}
              <Button variant="ghost" size="sm" onClick={() => handleEdit("summary")} className="text-gray-600 hover:text-gray-800 hover:bg-gray-100" title="Edit ICP">
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Collapsed Content */}
          <div className="space-y-4">
            {/* Introduction Paragraph */}
            <p className="text-gray-700 text-sm leading-relaxed">
              {content.blurb}
            </p>

            {/* Quick Highlights Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {content.stats.map((stat, index) => (
                <div key={index} className="bg-white rounded-md p-3 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <stat.icon className={`h-4 w-4 text-${stat.color}-600`} />
                    <Badge variant="secondary" className={`text-xs bg-${stat.color}-100 text-${stat.color}-700`}>
                      {stat.label}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setIsExpanded(true)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-1">
                Read More
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Floating Profiler Chat Icon */}
          <Button variant="ghost" size="sm" onClick={() => setShowProfilerChat(true)} className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg" title="Explore More with Profiler">
            <Bot className="h-5 w-5" />
          </Button>
        </div>

        {/* Profiler Chat Panel */}
        {showProfilerChat && <Card className="border-blue-200 bg-blue-50/40">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="bg-white rounded-lg p-3 mb-3">
                    <p className="text-sm font-medium text-blue-900 mb-1">Profiler</p>
                    <p className="text-sm text-gray-700">
                      Hey! I can help you dive deeper into your {content.topVertical} ICP analysis. What would you like to explore?
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Button variant="ghost" size="sm" className="justify-start text-xs bg-white hover:bg-blue-50">
                      🔍 Which 3 competitors are growing fastest in this segment?
                    </Button>
                    <Button variant="ghost" size="sm" className="justify-start text-xs bg-white hover:bg-blue-50">
                      🎯 Where's your TAM saturated vs underserved?
                    </Button>
                    <Button variant="ghost" size="sm" className="justify-start text-xs bg-white hover:bg-blue-50">
                      💬 What's your main monetization route in this ICP?
                    </Button>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowProfilerChat(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </Button>
              </div>
            </CardContent>
          </Card>}
      </div>;
  }

  // Expanded Full Report View
  return <div className="space-y-6">
      {/* Category Header */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {content.reportTitle}
            </h2>
            <p className="text-sm text-gray-600">
              Comprehensive market analysis and strategic recommendations
            </p>
          </div>
          <div className="flex items-center gap-2">
            {editHistory.length > 0 && <Button variant="ghost" size="sm" className="text-xs text-gray-500">
                <MoreHorizontal className="h-3 w-3 mr-1" />
                Edit History
              </Button>}
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)} className="text-gray-600 hover:text-gray-800 hover:bg-gray-100" title="Collapse View">
              Collapse
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowProfilerChat(true)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Explore More with Profiler">
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Summary Blurb */}
        <div className="bg-white rounded-lg p-4 mb-4">
          <p className="text-gray-700 leading-relaxed">{content.blurb}</p>
        </div>

        {/* Accordion Sections */}
        <Accordion type="multiple" defaultValue={["market-size", "segment-breakdown", "challenges", "recommendations", "signals"]} className="space-y-4">
          {/* Market Size & Growth */}
          <AccordionItem value="market-size" className="bg-white rounded-lg border">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="font-medium">Market Size & Growth</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <p className="text-gray-700 text-sm leading-relaxed">
                    The neobank sector in North America and DACH is forecasted to reach $4.3B by 2027. Growth is propelled by:
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700 ml-4">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                      Cloud-native banking architectures
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                      Customer demand for digital-first experiences
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                      Agile regulatory frameworks for fintech entrants
                    </li>
                  </ul>
                  <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                    <strong>{content.cagr} CAGR</strong> indicates moderate but sustainable growth, especially in mid-sized firms.
                  </p>
                </div>
                <div className="flex justify-center">
                  <MiniLineChart data={tamGrowthData} title="TAM Growth Forecast ($B)" color="#0064FF" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Segment Breakdown */}
          <AccordionItem value="segment-breakdown" className="bg-white rounded-lg border">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Segment Breakdown</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">North America</h4>
                    <ul className="space-y-1 text-sm text-gray-700 ml-4">
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                        High consumer digital adoption
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                        Regulatory scrutiny increasing around data privacy and AML
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                        Competitive landscape includes Chime, Varo, and new regional entrants
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">DACH</h4>
                    <ul className="space-y-1 text-sm text-gray-700 ml-4">
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0"></div>
                        Fintech hubs emerging in Germany and Switzerland
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0"></div>
                        Preference for strong compliance credentials
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0"></div>
                        Investors attracted to scalable B2B neobank models
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="flex justify-center">
                  <MiniPieChart data={marketSegmentationData} title="Regional Market Share" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Key Challenges */}
          <AccordionItem value="challenges" className="bg-white rounded-lg border">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-orange-600" />
                <span className="font-medium">Key Challenges</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <h4 className="font-medium text-orange-900 mb-2">Market Pressures</h4>
                  <ul className="space-y-1 text-sm text-orange-800">
                    <li>• Tightening margins due to rising customer acquisition costs</li>
                    <li>• Heightened regulatory expectations (Basel IV, PSD2 updates)</li>
                    <li>• Talent competition in digital product and compliance roles</li>
                  </ul>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Strategic Recommendations */}
          <AccordionItem value="recommendations" className="bg-white rounded-lg border">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-purple-600" />
                <span className="font-medium">Strategic Recommendations</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Go-to-Market Strategy</h4>
                  <ul className="space-y-1 text-sm text-gray-700 ml-4">
                    <li>• Prioritize compliance-forward messaging in go-to-market</li>
                    <li>• Explore partnerships with RegTech vendors for differentiation</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Target Profile</h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800 mb-2">Target firms with:</p>
                    <ul className="space-y-1 text-sm text-green-700 ml-4">
                      <li>• High cloud maturity</li>
                      <li>• Digital transformation mandates</li>
                      <li>• New funding rounds in past 12–18 months</li>
                    </ul>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Signals to Monitor */}
          <AccordionItem value="signals" className="bg-white rounded-lg border">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-600" />
                <span className="font-medium">Signals to Monitor</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h5 className="font-medium text-blue-900 text-sm mb-1">Regulatory</h5>
                  <p className="text-xs text-blue-700">New fintech regulations in Europe</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <h5 className="font-medium text-green-900 text-sm mb-1">Funding</h5>
                  <p className="text-xs text-green-700">Funding rounds above $20M in Neobank space</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <h5 className="font-medium text-purple-900 text-sm mb-1">Metrics</h5>
                  <p className="text-xs text-purple-700">Shifts in customer acquisition cost metrics</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
          <Button 
            variant="outline" 
            onClick={() => setIsExpanded(false)}
            className="flex items-center gap-2"
          >
            <ChevronDown className="h-4 w-4 rotate-180" />
            Collapse
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Save Report
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Profiler Chat Panel */}
      {showProfilerChat && <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="bg-white rounded-lg p-3 mb-3">
                  <p className="text-sm font-medium text-blue-900 mb-1">Profiler</p>
                  <p className="text-sm text-gray-700">
                    Great insights on the {content.topVertical} market! Want me to dive deeper into specific areas or explore adjacent opportunities?
                  </p>
                </div>
                <div className="space-y-2">
                  <Button variant="ghost" size="sm" className="justify-start text-xs bg-white hover:bg-blue-50">
                    🏦 Analyze top 5 neobank competitors and their positioning
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start text-xs bg-white hover:bg-blue-50">
                    📊 Deep dive into DACH vs North America opportunity sizing
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start text-xs bg-white hover:bg-blue-50">
                    🎯 Recommend specific neobank prospects to target first
                  </Button>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowProfilerChat(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </Button>
            </div>
          </CardContent>
        </Card>}
    </div>;
};
