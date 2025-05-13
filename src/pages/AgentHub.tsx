
import React, { useState } from 'react';
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, CalendarIcon, BarChart, LineChart } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart as ReBarChart, Bar, LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TodaysFocus } from "@/components/agent-hub/TodaysFocus";
import { PipelineSnapshot } from "@/components/agent-hub/PipelineSnapshot";
import { InsightsAnalytics } from "@/components/agent-hub/InsightsAnalytics";
import { AgentCards } from "@/components/agent-hub/AgentCards";
import { AskBrewra } from "@/components/agent-hub/AskBrewra";

const AgentHub = () => {
  return (
    <Layout>
      <div className="animate-fade-in space-y-8">
        {/* Section 1: Today's Focus */}
        <TodaysFocus />
        
        {/* Section 2: 7-Day Pipeline Snapshot */}
        <PipelineSnapshot />
        
        {/* Section 3: Insights / Analytics */}
        <InsightsAnalytics />
        
        {/* Section 4: Agentic AI Assist - Meet Your Agents */}
        <AgentCards />
        
        {/* Section 5: Ask Brewra Agentic AI */}
        <AskBrewra />
      </div>
    </Layout>
  );
};

export default AgentHub;
