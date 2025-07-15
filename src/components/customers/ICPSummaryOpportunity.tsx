import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Edit, Save, MessageSquare, Target, Globe, Settings, DollarSign, TrendingUp, MapPin, Lightbulb, Copy, MoreHorizontal, ChevronDown, Bot } from "lucide-react";
import MiniLineChart from "@/components/MiniLineChart";
import MiniPieChart from "@/components/MiniPieChart";
export const ICPSummaryOpportunity = () => {
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
  const marketSegmentationData = [{
    name: "Compliance",
    value: 35,
    color: "#0064FF"
  }, {
    name: "Risk Analytics",
    value: 28,
    color: "#00A3FF"
  }, {
    name: "Cross-border",
    value: 22,
    color: "#66C2FF"
  }, {
    name: "AI Onboarding",
    value: 15,
    color: "#B3DBFF"
  }];
  const tamGrowthData = [{
    name: "2021",
    value: 11.8
  }, {
    name: "2022",
    value: 12.6
  }, {
    name: "2023",
    value: 13.4
  }, {
    name: "2024",
    value: 14.2
  }];
  if (!isExpanded) {
    // Collapsed Default View
    return <div className="space-y-6">
        {/* Category Header */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 relative max-h-96">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">ICP Summary & Size & Opportunity</h2>
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
              Your current ICP is mid-market technology firms in North America, focused on cloud adoption and digital transformation initiatives.
            </p>

            {/* Quick Highlights Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* TAM */}
              <div className="bg-white rounded-md p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">TAM</Badge>
                </div>
                <p className="text-lg font-semibold text-gray-900">$2.1B</p>
                <p className="text-xs text-gray-500">USD</p>
              </div>

              {/* SAM */}
              <div className="bg-white rounded-md p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-blue-600" />
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">SAM</Badge>
                </div>
                <p className="text-lg font-semibold text-gray-900">$750M</p>
                <p className="text-xs text-gray-500">USD</p>
              </div>

              {/* Key Regions */}
              <div className="bg-white rounded-md p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-4 w-4 text-purple-600" />
                  <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">Regions</Badge>
                </div>
                <p className="text-sm font-medium text-gray-900">North America</p>
                <p className="text-xs text-gray-500">+ DACH</p>
              </div>

              {/* Top Vertical */}
              <div className="bg-white rounded-md p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                  <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">Vertical</Badge>
                </div>
                <p className="text-sm font-medium text-gray-900">Fintech</p>
                <p className="text-xs text-gray-500">Healthcare</p>
              </div>
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
                      Hey! I can help you dive deeper into your ICP analysis. What would you like to explore?
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
              Category A: ICP Summary & Size & Opportunity
            </h2>
            <p className="text-sm text-gray-600">
              High-level snapshot of market fit & revenue potential
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

        {/* Accordion Sections */}
        <Accordion type="multiple" defaultValue={["icp-summary", "size-opportunity"]} className="space-y-4">
          {/* ICP Summary Accordion */}
          <AccordionItem value="icp-summary" className="bg-white rounded-lg border">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                <span className="font-medium">ICP Summary</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              {editingSection === "icp-summary" ? <div className="space-y-3">
                  <textarea className="w-full p-3 border rounded-md resize-none" rows={4} defaultValue="🎯 Targeting mid-sized B2B FinTech companies (200–500 employees)&#10;🌐 Primary region: North America&#10;⚙️ Top use cases: Compliance automation, Risk analytics" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSave("icp-summary")} className="bg-blue-600 hover:bg-blue-700">
                      <Save className="h-4 w-4 mr-1" />
                      Save Changes
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingSection(null)}>
                      Cancel
                    </Button>
                  </div>
                </div> : <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <p className="flex items-center gap-2 text-sm">
                        <Target className="h-4 w-4 text-blue-600" />
                        Targeting mid-sized B2B FinTech companies (200–500 employees)
                      </p>
                      <p className="flex items-center gap-2 text-sm">
                        <Globe className="h-4 w-4 text-green-600" />
                        Primary region: North America
                      </p>
                      <p className="flex items-center gap-2 text-sm">
                        <Settings className="h-4 w-4 text-purple-600" />
                        Top use cases: Compliance automation, Risk analytics
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit("icp-summary")}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>}
            </AccordionContent>
          </AccordionItem>

          {/* Size & Opportunity Accordion */}
          <AccordionItem value="size-opportunity" className="bg-white rounded-lg border">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <span className="font-medium">Size & Opportunity</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">TAM: $14.2B</span>
                      <Button variant="ghost" size="sm" onClick={() => handleCopyInsight("TAM: $14.2B")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">CAGR: 5.6%</span>
                      <Button variant="ghost" size="sm" onClick={() => handleCopyInsight("CAGR: 5.6%")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium">Top region: North America</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium">Emerging pockets: Cross-border payments, AI-driven onboarding</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-fit">
                    Read More
                  </Button>
                </div>
                <div className="flex justify-center">
                  <MiniPieChart data={marketSegmentationData} title="Market Segmentation" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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
                    Hey! I noticed you refined your TAM assumptions. Want me to validate with fresh data or explore subsegments?
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
};