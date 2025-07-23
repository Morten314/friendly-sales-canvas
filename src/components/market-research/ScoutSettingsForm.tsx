import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ScoutSettingsFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScoutSettingsForm({ isOpen, onOpenChange }: ScoutSettingsFormProps) {
  const [formData, setFormData] = useState({
    agentName: "Scout",
    communicationTone: "",
    checkinFrequency: "",
    generalInstructions: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
  try {
    const response = await fetch("https://backend-11kr.onrender.com/profile/agent_name", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Scout settings saved:", result);

    alert("Scout settings saved successfully!");
    onOpenChange(false); // Close the dialog
  } catch (error) {
    console.error("Error saving Scout settings:", error);
    alert("Failed to save settings. Please try again.");
  }
};

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Scout Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="agentName">Agent Name</Label>
            <Input
              id="agentName"
              value={formData.agentName}
              disabled
              className="bg-gray-100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="communicationTone">Communication Tone</Label>
            <Select value={formData.communicationTone} onValueChange={(value) => handleInputChange("communicationTone", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select communication tone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="analytical">Analytical</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkinFrequency">Check-in Frequency</Label>
            <Select value={formData.checkinFrequency} onValueChange={(value) => handleInputChange("checkinFrequency", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select check-in frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="generalInstructions">
              General Instructions <span className="text-sm text-gray-500">(Prioritize high-signal data sources)</span>
            </Label>
            <Input
              id="generalInstructions"
              value={formData.generalInstructions}
              onChange={(e) => handleInputChange("generalInstructions", e.target.value)}
              placeholder="e.g., Crunchbase, G2, LinkedIn, analyst reports"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}