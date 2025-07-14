import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Bot, Building, MapPin, Users, Briefcase, Zap, Check, X, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
interface AgentLevelInfoProps {
  onScoutClick: () => void;
}
const AgentLevelInfo = ({
  onScoutClick
}: AgentLevelInfoProps) => {
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
  return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Target Industries */}
      

      {/* Target Regions */}
      

      {/* Company Size */}
      

      {/* Job Titles */}
      <Card className="relative">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-base">Job Titles</CardTitle>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onScoutClick}>
                <Bot className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit('jobTitles')}>
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {editingSection === 'jobTitles' ? <div className="space-y-2">
              <Input placeholder="Add job title..." />
              <div className="flex gap-1">
                <Button size="sm" onClick={handleSave}>
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div> : <div className="flex flex-wrap gap-1">
              {agentData.jobTitles.slice(0, 2).map((title, index) => <Badge key={index} variant="secondary" className="text-xs">
                  {title}
                </Badge>)}
              {agentData.jobTitles.length > 2 && <Badge variant="outline" className="text-xs">
                  +{agentData.jobTitles.length - 2} more
                </Badge>}
            </div>}
        </CardContent>
      </Card>
    </div>;
};
export default AgentLevelInfo;