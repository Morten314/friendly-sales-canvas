
import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Settings = () => {
  const [selectedProfile, setSelectedProfile] = useState<string>("");

  return (
    <Layout>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Profiling</h2>
            <div className="max-w-md">
              <label htmlFor="profile-select" className="block text-sm font-medium text-gray-700 mb-2">
                Select Profile Type
              </label>
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
            
            {selectedProfile && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  Selected: <span className="font-medium">{selectedProfile.charAt(0).toUpperCase() + selectedProfile.slice(1)} Profile</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Configuration options for this profile will be implemented here.
                </p>
              </div>
            )}
          </div>
          
          <div className="border-t pt-6">
            <p className="text-gray-500">Additional application settings and configuration options will be implemented here.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
