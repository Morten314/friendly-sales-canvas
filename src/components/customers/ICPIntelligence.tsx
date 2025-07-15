
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Building, 
  TrendingUp, 
  Globe, 
  Users, 
  Edit, 
  BarChart3, 
  Target, 
  Clock,
  AlertCircle,
  Cpu,
  CheckCircle,
  X
} from "lucide-react";

const ICPIntelligence = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [icpData, setIcpData] = useState({
    sector: "B2B SaaS",
    industry: "Fintech",
    region: "North America",
    companySize: "200-500 employees",
    tam: "$14.2B",
    cagr: "5.6%",
    keyPain: "Integration challenges with legacy systems",
    emergingTech: "AI-powered fraud detection",
    salesCycle: "6–8 months"
  });

  const handleSave = () => {
    setIsEditing(false);
    // Trigger context-specific chat suggestions
    console.log("ICP data updated, triggering chat suggestions");
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset to previous values if needed
  };

  const dataHighlights = [
    {
      icon: <TrendingUp className="h-4 w-4 text-green-600" />,
      label: "TAM",
      value: `${icpData.tam} (${icpData.cagr} CAGR)`,
      color: "bg-green-50 text-green-700 border-green-200"
    },
    {
      icon: <AlertCircle className="h-4 w-4 text-orange-600" />,
      label: "Key pain",
      value: icpData.keyPain,
      color: "bg-orange-50 text-orange-700 border-orange-200"
    },
    {
      icon: <Cpu className="h-4 w-4 text-blue-600" />,
      label: "Top emerging tech",
      value: icpData.emergingTech,
      color: "bg-blue-50 text-blue-700 border-blue-200"
    },
    {
      icon: <Clock className="h-4 w-4 text-purple-600" />,
      label: "Avg sales cycle",
      value: icpData.salesCycle,
      color: "bg-purple-50 text-purple-700 border-purple-200"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">ICP Intelligence</h1>
        <p className="text-gray-600">Define and refine your Ideal Customer Profile with agent-guided research.</p>
      </div>

      {/* Agent-Level Contextual Mini Report */}
      <Card className="border-2 border-blue-100 bg-gradient-to-r from-blue-50/50 to-purple-50/50">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Current ICP Context</CardTitle>
            </div>
            {!isEditing ? (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsEditing(true)}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
              >
                <Edit className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleCancel}
                  className="text-gray-600 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSave}
                  className="text-green-600 hover:text-green-700 hover:bg-green-100"
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEditing ? (
            <>
              {/* Summary */}
              <div className="space-y-2">
                <p className="text-sm text-gray-600">You're exploring:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    <Building className="h-3 w-3 mr-1" />
                    {icpData.sector}
                  </Badge>
                  <span className="text-gray-400">→</span>
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    <BarChart3 className="h-3 w-3 mr-1" />
                    {icpData.industry}
                  </Badge>
                  <span className="text-gray-400">→</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <Globe className="h-3 w-3 mr-1" />
                    {icpData.region}
                  </Badge>
                  <span className="text-gray-400">→</span>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    <Users className="h-3 w-3 mr-1" />
                    {icpData.companySize}
                  </Badge>
                </div>
              </div>

              {/* Data Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dataHighlights.map((highlight, index) => (
                  <div 
                    key={index} 
                    className={`p-3 rounded-lg border ${highlight.color} flex items-start gap-3`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {highlight.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium opacity-80">{highlight.label}</p>
                      <p className="text-sm font-semibold">{highlight.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Edit Mode */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sector" className="text-sm font-medium">Sector</Label>
                  <Input
                    id="sector"
                    value={icpData.sector}
                    onChange={(e) => setIcpData({...icpData, sector: e.target.value})}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry" className="text-sm font-medium">Industry</Label>
                  <Input
                    id="industry"
                    value={icpData.industry}
                    onChange={(e) => setIcpData({...icpData, industry: e.target.value})}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region" className="text-sm font-medium">Region</Label>
                  <Input
                    id="region"
                    value={icpData.region}
                    onChange={(e) => setIcpData({...icpData, region: e.target.value})}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companySize" className="text-sm font-medium">Company Size</Label>
                  <Input
                    id="companySize"
                    value={icpData.companySize}
                    onChange={(e) => setIcpData({...icpData, companySize: e.target.value})}
                    className="h-9"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="keyPain" className="text-sm font-medium">Key Pain Point</Label>
                  <Textarea
                    id="keyPain"
                    value={icpData.keyPain}
                    onChange={(e) => setIcpData({...icpData, keyPain: e.target.value})}
                    className="h-20 resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergingTech" className="text-sm font-medium">Emerging Technology</Label>
                  <Textarea
                    id="emergingTech"
                    value={icpData.emergingTech}
                    onChange={(e) => setIcpData({...icpData, emergingTech: e.target.value})}
                    className="h-20 resize-none"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Placeholder for additional ICP Intelligence sections */}
      <Card className="border-dashed border-gray-300">
        <CardContent className="p-8 text-center text-gray-500">
          <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">Additional ICP Analysis</h3>
          <p className="text-sm">Market segments, competitor analysis, and detailed insights will appear here.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ICPIntelligence;
