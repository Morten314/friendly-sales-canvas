
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Edit, 
  Bot, 
  Building, 
  MapPin, 
  Users, 
  Briefcase, 
  Zap,
  Check,
  X,
  Save
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AgentLevelInfoProps {
  onScoutClick: () => void;
}

const AgentLevelInfo = ({ onScoutClick }: AgentLevelInfoProps) => {
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [agentData, setAgentData] = useState({
    industries: ["Technology", "Healthcare", "Finance"],
    regions: ["United States", "United Kingdom", "Canada"],
    companySize: "50-500 Employees",
    jobTitles: ["VP of Sales", "Director of Marketing", "CTO", "Head of Operations"],
    intentSignals: true
  });

  const handleEdit = (section: string) => {
    setEditingSection(section);
  };

  const handleSave = () => {
    setEditingSection(null);
  };

  const handleCancel = () => {
    setEditingSection(null);
  };

  return (
    <div className="w-full bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border relative">
      {/* Scout Agent Icon */}
      <div className="absolute top-4 right-4">
        <Button
          onClick={onScoutClick}
          size="icon"
          className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg relative group"
          title="Explore More with Scout"
        >
          <Bot className="h-5 w-5 text-white" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pr-16">
        {/* Target Industries */}
        <Card className="relative group hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building className="h-4 w-4 text-blue-600" />
                Target Industries
              </CardTitle>
              {editingSection !== "industries" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleEdit("industries")}
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingSection === "industries" ? (
              <div className="space-y-2">
                <Input 
                  placeholder="Add industry..."
                  className="text-xs"
                />
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={handleSave}>
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancel}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {agentData.industries.map((industry, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {industry}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preferred Regions */}
        <Card className="relative group hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-600" />
                Preferred Regions
              </CardTitle>
              {editingSection !== "regions" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleEdit("regions")}
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingSection === "regions" ? (
              <div className="space-y-2">
                <Select>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select region..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us">United States</SelectItem>
                    <SelectItem value="uk">United Kingdom</SelectItem>
                    <SelectItem value="ca">Canada</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={handleSave}>
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancel}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {agentData.regions.map((region, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    🇺🇸 {region}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Company Size Range */}
        <Card className="relative group hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-600" />
                Company Size
              </CardTitle>
              {editingSection !== "companySize" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleEdit("companySize")}
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingSection === "companySize" ? (
              <div className="space-y-2">
                <Select>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select size..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-10">1-10 Employees</SelectItem>
                    <SelectItem value="11-50">11-50 Employees</SelectItem>
                    <SelectItem value="51-200">51-200 Employees</SelectItem>
                    <SelectItem value="201-1000">201-1000 Employees</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={handleSave}>
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancel}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm font-medium text-gray-700">
                {agentData.companySize}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Job Titles */}
        <Card className="relative group hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-purple-600" />
                Job Titles
              </CardTitle>
              {editingSection !== "jobTitles" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleEdit("jobTitles")}
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingSection === "jobTitles" ? (
              <div className="space-y-2">
                <Input 
                  placeholder="Add job title..."
                  className="text-xs"
                />
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={handleSave}>
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancel}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {agentData.jobTitles.slice(0, 2).map((title, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {title}
                  </Badge>
                ))}
                {agentData.jobTitles.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{agentData.jobTitles.length - 2} more
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Intent Signals */}
        <Card className="relative group hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-600" />
                Intent Signals
              </CardTitle>
              {editingSection !== "intentSignals" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleEdit("intentSignals")}
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingSection === "intentSignals" ? (
              <div className="space-y-2">
                <Select>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enabled">Enabled</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={handleSave}>
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancel}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <Badge 
                variant={agentData.intentSignals ? "default" : "secondary"}
                className={`text-xs ${agentData.intentSignals ? "bg-green-100 text-green-800" : ""}`}
              >
                {agentData.intentSignals ? (
                  <><Check className="h-3 w-3 mr-1" />Enabled</>
                ) : (
                  <><X className="h-3 w-3 mr-1" />Disabled</>
                )}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentLevelInfo;
