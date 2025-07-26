import { useState } from "react";
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
} from "@/components/ui/dialog";
import { CompanyProfile } from "@/components/settings/CompanyProfile";
import { UserProfile } from "@/components/settings/UserProfile";
import { AgentProfile } from "@/components/settings/AgentProfile";
import { Label } from "@/components/ui/label";

interface ScoutSettingsFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScoutSettingsForm({ isOpen, onOpenChange }: ScoutSettingsFormProps) {
  const [selectedProfile, setSelectedProfile] = useState<string>("");

  // Function to handle company profile updates
  const handleCompanyProfileUpdate = () => {
    // Emit custom event to notify other components
    const event = new CustomEvent('companyProfileUpdated', {
      detail: { timestamp: new Date().toISOString() }
    });
    window.dispatchEvent(event);
  };

  const renderProfileContent = () => {
    switch (selectedProfile) {
      case "company":
        return <CompanyProfile onProfileUpdate={handleCompanyProfileUpdate} />;
      case "user":
        return <UserProfile />;
      case "agent":
        return <AgentProfile />;
      default:
        return (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              Please select a profile type to manage its settings.
            </p>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Profiling</h2>
            <div className="max-w-md">
              <Label htmlFor="profile-select" className="block text-sm font-medium text-gray-700 mb-2">
                Select Profile Type
              </Label>
              <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a profile to manage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company Profile</SelectItem>
                  <SelectItem value="user">User Profile</SelectItem>
                  <SelectItem value="agent">Agent Profile</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {renderProfileContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}