import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Edit, Save, MessageSquare, Target, Globe, Settings, DollarSign, TrendingUp, MapPin, Lightbulb, Copy, MoreHorizontal } from "lucide-react";
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
            <Button variant="ghost" size="sm" onClick={() => setShowProfilerChat(true)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Explore More with Profiler">
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Accordion Sections */}
        
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