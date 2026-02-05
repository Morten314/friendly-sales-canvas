
// import { useState } from "react";
// import { Layout } from "@/components/layout/Layout";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { CompanyProfile } from "@/components/settings/CompanyProfile";
// import { UserProfile } from "@/components/settings/UserProfile";
// import { AgentProfile } from "@/components/settings/AgentProfile";

// const Settings = () => {
//   const [selectedProfile, setSelectedProfile] = useState<string>("");

//   const renderProfileContent = () => {
//     switch (selectedProfile) {
//       case "company":
//         return <CompanyProfile />;
//       case "user":
//         return <UserProfile />;
//       case "agent":
//         return <AgentProfile />;
//       default:
//         return (
//           <div className="mt-6 p-4 bg-gray-50 rounded-lg">
//             <p className="text-sm text-gray-600">
//               Please select a profile type to manage its settings.
//             </p>
//           </div>
//         );
//     }
//   };

//   return (
//     <Layout>
//       <div className="animate-fade-in">
//         <h1 className="text-2xl font-bold mb-6">Settings</h1>
        
//         <div className="bg-white rounded-lg shadow p-6">
//           <div className="mb-8">
//             <h2 className="text-xl font-semibold mb-4">Profiling</h2>
//             <div className="max-w-md">
//               <label htmlFor="profile-select" className="block text-sm font-medium text-gray-700 mb-2">
//                 Select Profile Type
//               </label>
//               <Select value={selectedProfile} onValueChange={setSelectedProfile}>
//                 <SelectTrigger className="w-full">
//                   <SelectValue placeholder="Choose a profile to manage" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="company">Company Profile</SelectItem>
//                   <SelectItem value="user">User Profile</SelectItem>
//                   <SelectItem value="agent">Agent Profile</SelectItem>
//                 </SelectContent>
//               </Select>
//             </div>
            
//             {renderProfileContent()}
//           </div>
//         </div>
//       </div>
//     </Layout>
//   );
// };

// export default Settings;



import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { buildApiUrl } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CompanyProfile } from "@/components/settings/CompanyProfile";
import { UserProfile } from "@/components/settings/UserProfile";
import { AgentProfile } from "@/components/settings/AgentProfile";
import { Edit, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Settings = () => {
  const { currentUser } = useAuth();
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Function to handle company profile updates
  const handleCompanyProfileUpdate = () => {
    // Emit custom event to notify other components
    const event = new CustomEvent('companyProfileUpdated', {
      detail: { timestamp: new Date().toISOString() }
    });
    window.dispatchEvent(event);
  };

  // Fetch profile data when a profile type is selected
  const fetchProfileData = async (profileType: string) => {
    if (!currentUser?.uid) {
      console.warn('Cannot fetch profile data - user not authenticated');
      setProfileData(null);
      return;
    }

    setLoading(true);
    try {
      // Include user_id in the API call (same pattern as Signals)
      const response = await fetch(buildApiUrl(`api/profile/${profileType}?user_id=${currentUser.uid}`), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json();
        // CRITICAL: Verify the data belongs to the current user - reject if mismatch
        if (data.user_id && data.user_id !== currentUser.uid) {
          console.error('❌ [SETTINGS] Profile data user_id mismatch! API user_id:', data.user_id, 'Current user:', currentUser.uid);
          console.error('❌ [SETTINGS] Rejecting data to prevent data leakage');
          setProfileData(null);
        } else if (!data.user_id) {
          // If no user_id in response, add it to ensure data isolation
          console.warn('⚠️ [SETTINGS] API response has no user_id, adding current user_id');
          setProfileData({
            ...data,
            user_id: currentUser.uid
          });
        } else {
          setProfileData(data);
        }
      } else {
        console.log('No existing profile data found');
        setProfileData(null);
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
      setProfileData(null);
    } finally {
      setLoading(false);
    }
  };

  // Track previous user to detect user changes
  const previousUserIdRef = useRef<string | null | undefined>(currentUser?.uid);

  // Clear profile data when user changes and refetch if profile is selected
  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    const currentUserId = currentUser?.uid;

    // CRITICAL: Clear profile data immediately when user changes
    if (previousUserId !== undefined && previousUserId !== currentUserId) {
      console.log('🔄 [SETTINGS] User changed from', previousUserId, 'to', currentUserId, '- clearing profile data');
      setProfileData(null);
      // Keep selectedProfile but clear the data - component will refetch
    }

    if (!currentUserId) {
      setProfileData(null);
      setSelectedProfile("");
    } else if (selectedProfile) {
      // If user changes and a profile is already selected, refetch the data
      fetchProfileData(selectedProfile);
    }
    
    previousUserIdRef.current = currentUserId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  // Handle profile selection change
  const handleProfileChange = (value: string) => {
    setSelectedProfile(value);
    setIsEditMode(false);
    if (value) {
      fetchProfileData(value);
    }
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

    if (loading) {
      return (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Loading profile data...</p>
        </div>
      );
    }

    const commonProps = {
      isEditMode,
      profileData,
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
              <label htmlFor="profile-select" className="block text-sm font-medium text-gray-700 mb-2">
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

export default Settings;