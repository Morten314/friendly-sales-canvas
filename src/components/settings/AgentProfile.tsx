import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AgentProfile() {
  const [formData, setFormData] = useState({
    agentName: "",
    assignedTasks: "",
    domain: "",
    generalInstructions: "",
    tone: "",
    autonomyLevel: "",
    frequency: "",
  });

  const [checkedItems, setCheckedItems] = useState({
    leadGeneration: false,
    customerSupport: false,
    contentCreation: false,
    dataAnalysis: false,
    reporting: false,
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (item: string, checked: boolean) => {
    setCheckedItems(prev => ({ ...prev, [item]: checked }));
  };

  const handleSave = () => {
    console.log("Agent Profile saved:", { ...formData, checkedItems });
    // Implementation for saving agent profile
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="p-6 bg-purple-50 rounded-lg border-l-4 border-purple-500">
        <h3 className="text-lg font-semibold text-purple-900 mb-2">Agent Profile Settings</h3>
        <p className="text-sm text-purple-700 mb-4">
          Configure how AI agents should behave and operate within your organization.
        </p>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="agentName">Agent Name</Label>
              <Select value={formData.agentName} onValueChange={(value) => handleInputChange("agentName", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scout">Scout</SelectItem>
                  <SelectItem value="profiler">Profiler</SelectItem>
                  <SelectItem value="strategist">Strategist</SelectItem>
                  <SelectItem value="activator">Activator</SelectItem>
                  <SelectItem value="presenter">Presenter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Domain/Focus Area</Label>
              <Input
                id="domain"
                value={formData.domain}
                onChange={(e) => handleInputChange("domain", e.target.value)}
                placeholder="e.g., Lead generation agent, Customer support"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone">Communication Tone</Label>
              <Select value={formData.tone} onValueChange={(value) => handleInputChange("tone", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="consultative">Consultative</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="autonomyLevel">Autonomy Level</Label>
              <Select value={formData.autonomyLevel} onValueChange={(value) => handleInputChange("autonomyLevel", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select autonomy level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Always ask for approval</SelectItem>
                  <SelectItem value="medium">Medium - Ask for complex decisions</SelectItem>
                  <SelectItem value="high">High - Operate independently</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Check-in Frequency</Label>
              <Select value={formData.frequency} onValueChange={(value) => handleInputChange("frequency", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="ondemand">On-demand only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignedTasks">Assigned Tasks & Domain</Label>
            <Textarea
              id="assignedTasks"
              value={formData.assignedTasks}
              onChange={(e) => handleInputChange("assignedTasks", e.target.value)}
              placeholder="Describe the specific tasks and responsibilities for this agent"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Task Categories</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(checkedItems).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={value}
                    onCheckedChange={(checked) => handleCheckboxChange(key, checked as boolean)}
                  />
                  <Label htmlFor={key} className="text-sm">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="generalInstructions">General Instructions</Label>
            <Textarea
              id="generalInstructions"
              value={formData.generalInstructions}
              onChange={(e) => handleInputChange("generalInstructions", e.target.value)}
              placeholder="Specific guidelines and instructions for how the agent should operate"
              rows={4}
            />
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-purple-200">
          <div className="flex justify-between items-center">
            <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">
              Save Agent Profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
