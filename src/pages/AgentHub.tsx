
// import React from 'react';
// import { Layout } from "@/components/layout/Layout";
// import { TodaysFocus } from "@/components/agent-hub/TodaysFocus";
// import { PipelineSnapshot } from "@/components/agent-hub/PipelineSnapshot";
// import { InsightsAnalytics } from "@/components/agent-hub/InsightsAnalytics";
// // import { AgentCards } from "@/components/agent-hub/AgentCards";
// import { AskBrewra } from "@/components/agent-hub/AskBrewra";
// import { WelcomeMessage } from "@/components/agent-hub/WelcomeMessage";
// import { QuotaTracker } from "@/components/agent-hub/QuotaTracker";
// import { AgentsByStatus } from '@/components/agent-hub/AgentsByStatus';

// const AgentHub = () => {
//   return (
//     <Layout>
//       <div className="animate-fade-in space-y-6">
//         {/* Welcome Message */}
//         <WelcomeMessage />
        
//         {/* Section 1: Today's Focus */}
//         <div>
//           <h2 className="text-lg font-bold mb-3">Today's Focus</h2>
//           <TodaysFocus />
//         </div>
        
//         {/* Section 2: Quota Progress Tracker - Elevated as a primary section */}
//         <div>
//           <h2 className="text-lg font-bold mb-3">Your Monthly Progress</h2>
//           <QuotaTracker />
//         </div>
        
//         {/* Section 3: Pipeline Snapshot - More compact */}
//         <div>
//           <h2 className="text-lg font-bold mb-3">Pipeline at a Glance</h2>
//           <PipelineSnapshot />
//         </div>
        
//         {/* Section 4: Insights / Analytics */}
//         <div>
//           <h2 className="text-lg font-bold mb-3">Sales Metrics Over Time</h2>
//           <InsightsAnalytics />
//         </div>
        
//         {/* Section 5: Ask Brewra Agentic AI */}
//         <div className="mt-8">
//           <AskBrewra />
//         </div>
        
//         {/* Section 6: Agentic AI Assist - Now organized by relevance/status */}
//         <div className="mt-8">
//           <h2 className="text-2xl font-bold mb-4">Agentic AI Assist</h2>
//           {/* <AgentCards /> */}
//           <AgentsByStatus />

//         </div>
//       </div>
//     </Layout>
//   );
// };

// export default AgentHub;


import React from "react";
import { Layout } from "@/components/layout/Layout";
import { WelcomeMessage } from "@/components/agent-hub/WelcomeMessage";
import { TodaysFocus } from "@/components/agent-hub/TodaysFocus";
import { QuotaTracker } from "@/components/agent-hub/QuotaTracker";
import { PipelineSnapshot } from "@/components/agent-hub/PipelineSnapshot";
import { InsightsAnalytics } from "@/components/agent-hub/InsightsAnalytics";
import { AgentsByStatus } from "@/components/agent-hub/AgentsByStatus";
import FloatingAskBrewra from "@/components/agent-hub/FloatingAskBrewra";

const AgentHub: React.FC = () => {
  return (
    <Layout>
      <div className="animate-fade-in space-y-6">
        <WelcomeMessage />

        <div>
          <h2 className="text-lg font-bold mb-3">Today's Focus</h2>
          <TodaysFocus />
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3">Your Monthly Progress</h2>
          <QuotaTracker />
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3">Pipeline at a Glance</h2>
          <PipelineSnapshot />
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3">Sales Metrics Over Time</h2>
          <InsightsAnalytics />
        </div>

        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">AI Team Activity</h2>
          <AgentsByStatus />
        </div>
      </div>

      {/* Persistent Floating Ask Brewra Icon */}
      <FloatingAskBrewra />
    </Layout>
  );
};

export default AgentHub;
