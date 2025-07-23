
import React, { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { WelcomeMessage } from "@/components/agent-hub/WelcomeMessage";
import { TodaysFocus } from "@/components/agent-hub/TodaysFocus";
import { QuotaTracker } from "@/components/agent-hub/QuotaTracker";
import { PipelineSnapshot } from "@/components/agent-hub/PipelineSnapshot";
import { InsightsAnalytics } from "@/components/agent-hub/InsightsAnalytics";
import { AgentTeamOverview } from "@/components/agent-hub/AgentTeamOverview";
import { AgentActivityKanban } from "@/components/agent-hub/AgentActivityKanban";
import { useLocation } from "react-router-dom";
import FloatingAskBrewra from "@/components/agent-hub/FloatingAskBrewra";

const AgentHub: React.FC = () => {
  const [showAITeam, setShowAITeam] = useState(false);
  const location = useLocation();

  // Check for AI Team view from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setShowAITeam(params.get("view") === "ai-team");
  }, [location]);

  return (
    <Layout>
      {showAITeam ? (
        <div className="animate-fade-in space-y-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-1">Your AI Team</h1>
            <p className="text-gray-600">
              Work with specialized AI agents to accelerate your revenue efforts
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AgentTeamOverview />
          </div>
        </div>
      ) : (
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
            <h2 className="text-2xl font-bold mb-2">AI Agent Activity</h2>
            <p className="text-gray-600 mb-6">Here's what your agents have been up to this week.</p>
            <AgentActivityKanban />
          </div>
        </div>
      )}
      
      {/* Persistent Floating Ask Brewra Icon */}
      <FloatingAskBrewra />
    </Layout>
  );
};

export default AgentHub;
