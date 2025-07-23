
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



import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompanyProfile } from "@/components/settings/CompanyProfile";
import { UserProfile } from "@/components/settings/UserProfile";
import { AgentProfile } from "@/components/settings/AgentProfile";

const Settings = () => {
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
            
            {renderProfileContent()}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;