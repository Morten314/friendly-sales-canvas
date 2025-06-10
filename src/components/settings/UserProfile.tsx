
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

export function UserProfile() {
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    department: "",
    experienceLevel: "",
    professionalBackground: "",
    personalKPIs: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    console.log("User Profile saved:", formData);
    // Implementation for saving user profile
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="p-6 bg-green-50 rounded-lg border-l-4 border-green-500">
        <h3 className="text-lg font-semibold text-green-900 mb-2">User Profile Settings</h3>
        <p className="text-sm text-green-700 mb-4">
          Set up your personal profile to customize AI agent interactions and recommendations.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              value={formData.role}
              onChange={(e) => handleInputChange("role", e.target.value)}
              placeholder="E.g., Sales Development Representative, Head of Marketing, RevOps Analyst, Founder & CEO"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Select value={formData.department} onValueChange={(value) => handleInputChange("department", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="revops">RevOps</SelectItem>
                <SelectItem value="founders">Founders</SelectItem>
                <SelectItem value="product">Product</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="experienceLevel">Experience Level</Label>
            <Select value={formData.experienceLevel} onValueChange={(value) => handleInputChange("experienceLevel", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select experience level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
                <SelectItem value="c-level">C-level</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="professionalBackground">Professional Background</Label>
            <Input
              id="professionalBackground"
              value={formData.professionalBackground}
              onChange={(e) => handleInputChange("professionalBackground", e.target.value)}
              placeholder="Brief, 1-2 sentence description."
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="personalKPIs">Personal KPIs</Label>
            <Input
              id="personalKPIs"
              value={formData.personalKPIs}
              onChange={(e) => handleInputChange("personalKPIs", e.target.value)}
              placeholder="E.g.: SQL (Sales Qualified Lead) generation rate"
            />
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-green-200">
          <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
            Save User Profile
          </Button>
        </div>
      </div>
    </div>
  );
}
