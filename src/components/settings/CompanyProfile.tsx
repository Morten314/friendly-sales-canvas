
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CompanyProfile() {
  const [formData, setFormData] = useState({
    industry: "",
    size: "",
    markets: "",
    strategicGoals: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    console.log("Company Profile saved:", formData);
    // Implementation for saving company profile
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="p-6 bg-blue-50 rounded-lg border-l-4 border-blue-500">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Company Profile Settings</h3>
        <p className="text-sm text-blue-700 mb-4">
          Configure your company information to help AI agents understand your business context and goals.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Select value={formData.industry} onValueChange={(value) => handleInputChange("industry", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select your industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="manufacturing">Manufacturing</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="size">Company Size</Label>
            <Select value={formData.size} onValueChange={(value) => handleInputChange("size", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select company size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="startup">Startup (1-10)</SelectItem>
                <SelectItem value="small">Small (11-50)</SelectItem>
                <SelectItem value="medium">Medium (51-200)</SelectItem>
                <SelectItem value="large">Large (201-1000)</SelectItem>
                <SelectItem value="enterprise">Enterprise (1000+)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="markets">Target Markets</Label>
            <Input
              id="markets"
              value={formData.markets}
              onChange={(e) => handleInputChange("markets", e.target.value)}
              placeholder="e.g., North America, Europe, Asia-Pacific"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="strategicGoals">Strategic Goals</Label>
            <Textarea
              id="strategicGoals"
              value={formData.strategicGoals}
              onChange={(e) => handleInputChange("strategicGoals", e.target.value)}
              placeholder="e.g., Expand to UK in 3 years, Increase market share by 25%"
              rows={3}
            />
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-blue-200">
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            Save Company Profile
          </Button>
        </div>
      </div>
    </div>
  );
}
