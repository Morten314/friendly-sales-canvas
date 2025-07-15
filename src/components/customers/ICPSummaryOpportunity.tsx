
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { 
  Edit, 
  Save, 
  MessageSquare, 
  Target, 
  Globe, 
  Settings, 
  DollarSign, 
  TrendingUp, 
  MapPin, 
  Lightbulb,
  Copy,
  MoreHorizontal
} from "lucide-react";
import MiniLineChart from "@/components/MiniLineChart";
import MiniPieChart from "@/components/MiniPieChart";

export const ICPSummaryOpportunity = () => {
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

  const marketSegmentationData = [
    { name: "Compliance", value: 35, color: "#0064FF" },
    { name: "Risk Analytics", value: 28, color: "#00A3FF" },
    { name: "Cross-border", value: 22, color: "#66C2FF" },
    { name: "AI Onboarding", value: 15, color: "#B3DBFF" }
  ];

  const tamGrowthData = [
    { name: "2021", value: 11.8 },
    { name: "2022", value: 12.6 },
    { name: "2023", value: 13.4 },
    { name: "2024", value: 14.2 }
  ];

  return (
    <div className="space-y-6">
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
            {editHistory.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs text-gray-500">
                <MoreHorizontal className="h-3 w-3 mr-1" />
                Edit History
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowProfilerChat(true)}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              title="Explore More with Profiler"
            >
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
                <Target className="h-4 w-4 text-blue-600" />
                <span className="font-medium">ICP Summary</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {editingSection === "icp-summary" ? (
                      <div className="space-y-3">
                        <div className="p-3 border border-blue-200 rounded-lg bg-blue-50">
                          <p className="text-sm text-blue-700">Edit Mode Active - Modify your ICP highlights below</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 p-2 border rounded">
                            <Target className="h-4 w-4 text-blue-600" />
                            <input 
                              type="text" 
                              defaultValue="Targeting mid-sized B2B FinTech companies (200–500 employees)"
                              className="flex-1 bg-transparent border-none outline-none"
                            />
                            <Button variant="ghost" size="sm">❌</Button>
                          </div>
                          <div className="flex items-center gap-2 p-2 border rounded">
                            <Globe className="h-4 w-4 text-green-600" />
                            <input 
                              type="text" 
                              defaultValue="Primary region: North America"
                              className="flex-1 bg-transparent border-none outline-none"
                            />
                            <Button variant="ghost" size="sm">❌</Button>
                          </div>
                          <div className="flex items-center gap-2 p-2 border rounded">
                            <Settings className="h-4 w-4 text-purple-600" />
                            <input 
                              type="text" 
                              defaultValue="Top use cases: Compliance automation, Risk analytics"
                              className="flex-1 bg-transparent border-none outline-none"
                            />
                            <Button variant="ghost" size="sm">❌</Button>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleSave("icp-summary")}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Save Changes
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setEditingSection(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 group">
                          <Target className="h-4 w-4 text-blue-600" />
                          <span className="text-sm text-gray-700">
                            Targeting mid-sized B2B FinTech companies (200–500 employees)
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleCopyInsight("Targeting mid-sized B2B FinTech companies (200–500 employees)")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-3 group">
                          <Globe className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-gray-700">Primary region: North America</span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleCopyInsight("Primary region: North America")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-3 group">
                          <Settings className="h-4 w-4 text-purple-600" />
                          <span className="text-sm text-gray-700">
                            Top use cases: Compliance automation, Risk analytics
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleCopyInsight("Top use cases: Compliance automation, Risk analytics")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  {editingSection !== "icp-summary" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit("icp-summary")}
                      className="text-gray-500 hover:text-blue-600"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button variant="link" size="sm" className="text-blue-600 text-xs">
                    Read More →
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Size & Opportunity Accordion */}
          <AccordionItem value="size-opportunity" className="bg-white rounded-lg border">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="font-medium">Size & Opportunity</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                <div className="flex gap-6">
                  <div className="flex-1 space-y-3">
                    {editingSection === "size-opportunity" ? (
                      <div className="space-y-3">
                        <div className="p-3 border border-green-200 rounded-lg bg-green-50">
                          <p className="text-sm text-green-700">Edit Mode Active - Update market opportunity data</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 p-2 border rounded">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <input 
                              type="text" 
                              defaultValue="TAM: $14.2B"
                              className="flex-1 bg-transparent border-none outline-none"
                            />
                          </div>
                          <div className="flex items-center gap-2 p-2 border rounded">
                            <TrendingUp className="h-4 w-4 text-blue-600" />
                            <input 
                              type="text" 
                              defaultValue="CAGR: 5.6%"
                              className="flex-1 bg-transparent border-none outline-none"
                            />
                          </div>
                          <div className="flex items-center gap-2 p-2 border rounded">
                            <MapPin className="h-4 w-4 text-red-600" />
                            <input 
                              type="text" 
                              defaultValue="Top region: North America"
                              className="flex-1 bg-transparent border-none outline-none"
                            />
                          </div>
                          <div className="flex items-center gap-2 p-2 border rounded">
                            <Lightbulb className="h-4 w-4 text-yellow-600" />
                            <input 
                              type="text" 
                              defaultValue="Emerging pockets: Cross-border payments, AI-driven onboarding"
                              className="flex-1 bg-transparent border-none outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleSave("size-opportunity")}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Save Changes
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setEditingSection(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 group">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-gray-700">TAM: $14.2B</span>
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                            High Value
                          </Badge>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleCopyInsight("TAM: $14.2B")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-3 group">
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                          <span className="text-sm text-gray-700">CAGR: 5.6%</span>
                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                            Steady Growth
                          </Badge>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleCopyInsight("CAGR: 5.6%")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-3 group">
                          <MapPin className="h-4 w-4 text-red-600" />
                          <span className="text-sm text-gray-700">Top region: North America</span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleCopyInsight("Top region: North America")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-3 group">
                          <Lightbulb className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm text-gray-700">
                            Emerging pockets: Cross-border payments, AI-driven onboarding
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleCopyInsight("Emerging pockets: Cross-border payments, AI-driven onboarding")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Visual Charts */}
                  <div className="w-80 space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Market Segmentation</h4>
                      <MiniPieChart 
                        data={marketSegmentationData}
                        title=""
                      />
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">TAM Growth Trend</h4>
                      <MiniLineChart 
                        data={tamGrowthData}
                        title=""
                        color="#0064FF"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  {editingSection !== "size-opportunity" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit("size-opportunity")}
                      className="text-gray-500 hover:text-blue-600"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                  <Button variant="link" size="sm" className="text-blue-600 text-xs ml-auto">
                    Read More →
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Profiler Chat Panel */}
      {showProfilerChat && (
        <Card className="border-blue-200 bg-blue-50/40">
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
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowProfilerChat(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
