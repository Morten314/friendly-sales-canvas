
import React, { useState } from 'react';
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, CalendarIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TodaysFocus } from "@/components/agent-hub/TodaysFocus";
import { PipelineSnapshot } from "@/components/agent-hub/PipelineSnapshot";
import { InsightsAnalytics } from "@/components/agent-hub/InsightsAnalytics";
import { AgentCards } from "@/components/agent-hub/AgentCards";
import { AskBrewra } from "@/components/agent-hub/AskBrewra";

const AgentHub = () => {
  return (
    <Layout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Sales Dashboard</h1>
          <p className="text-gray-500 text-sm">Optimize the sales funnel and experience more wins today</p>
        </div>
        
        {/* Section 1: Today's Focus */}
        <TodaysFocus />
        
        {/* Section 2: Pipeline Snapshot */}
        <PipelineSnapshot />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {/* Section 3: Insights / Analytics */}
            <InsightsAnalytics />
          </div>
          
          <div className="lg:col-span-1">
            {/* Section 5: Ask Brewra Agentic AI */}
            <AskBrewra />
          </div>
        </div>
        
        {/* Section 4: Agentic AI Assist - Meet Your Agents */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Agentic AI Assist</h2>
          <AgentCards />
        </div>
      </div>
    </Layout>
  );
};

export default AgentHub;
