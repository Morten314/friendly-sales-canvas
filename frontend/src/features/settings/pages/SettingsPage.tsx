import { Edit, Save } from "lucide-react";
import { useState } from "react";

import { AgentProfile } from "../components/AgentProfile";
import { CompanyProfile } from "../components/CompanyProfile";
import { UserProfile } from "../components/UserProfile";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layout } from "@/features/shell";

const SettingsPage = () => {
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Function to handle company profile updates
  const handleCompanyProfileUpdate = () => {
    // Emit custom event to notify other components
    const event = new CustomEvent("companyProfileUpdated", {
      detail: { timestamp: new Date().toISOString() },
    });
    window.dispatchEvent(event);
  };

  // Handle profile selection change. Each profile component self-fetches its own
  // user-id-scoped data (CompanyProfile via useCompanyProfile; User/Agent via
  // useUserProfile/useAgentProfile), so the page no longer fetches here (TD-FE-11).
  const handleProfileChange = (value: string) => {
    setSelectedProfile(value);
    setIsEditMode(false);
  };

  const renderProfileContent = () => {
    if (!selectedProfile) {
      return (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            Please select a profile type to manage its settings.
          </p>
        </div>
      );
    }

    const commonProps = {
      isEditMode,
      onProfileUpdate: handleCompanyProfileUpdate,
    };

    switch (selectedProfile) {
      case "company":
        return <CompanyProfile {...commonProps} />;
      case "user":
        return <UserProfile {...commonProps} />;
      case "agent_name":
        return <AgentProfile {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Profiling</h2>
            <div className="max-w-md">
              <label
                htmlFor="profile-select"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Select Profile Type
              </label>
              <Select value={selectedProfile} onValueChange={handleProfileChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a profile to manage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company Profile</SelectItem>
                  <SelectItem value="user">User Profile</SelectItem>
                  <SelectItem value="agent_name">Agent Profile</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedProfile && (
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={() => setIsEditMode(!isEditMode)}
                  variant={isEditMode ? "default" : "outline"}
                  className="flex items-center gap-2"
                >
                  {isEditMode ? (
                    <>
                      <Save className="h-4 w-4" />
                      View Mode
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4" />
                      Edit Mode
                    </>
                  )}
                </Button>
              </div>
            )}

            {renderProfileContent()}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsPage;
