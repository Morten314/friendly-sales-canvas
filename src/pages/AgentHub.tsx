
import React from 'react';
import { Layout } from "@/components/layout/Layout";
import { TodaysFocus } from "@/components/agent-hub/TodaysFocus";
import { PipelineSnapshot } from "@/components/agent-hub/PipelineSnapshot";
import { InsightsAnalytics } from "@/components/agent-hub/InsightsAnalytics";
import { AgentCards } from "@/components/agent-hub/AgentCards";
import { AskBrewra } from "@/components/agent-hub/AskBrewra";
import { WelcomeMessage } from "@/components/agent-hub/WelcomeMessage";
import { QuotaTracker } from "@/components/agent-hub/QuotaTracker";

const AgentHub = () => {
  return (
    <Layout>
      <div className="animate-fade-in space-y-6">
        {/* Welcome Message */}
        <WelcomeMessage />
        
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {/* Section 1: Today's Focus */}
            <TodaysFocus />
          </div>
          
          <div className="lg:col-span-1">
            {/* Section 2: Quota Progress Tracker */}
            <QuotaTracker />
          </div>
        </div>
        
        {/* Section 3: Pipeline Snapshot */}
        <PipelineSnapshot />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {/* Section 4: Insights / Analytics */}
            <InsightsAnalytics />
          </div>
          
          <div className="lg:col-span-1">
            {/* Section 6: Ask Brewra Agentic AI */}
            <AskBrewra />
          </div>
        </div>
        
        {/* Section 5: Agentic AI Assist - Meet Your Agents */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Agentic AI Assist</h2>
          <AgentCards />
        </div>
      </div>
    </Layout>
  );
};

export default AgentHub;
