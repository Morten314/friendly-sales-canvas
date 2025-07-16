
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Search, Users, FileText, Calendar, Presentation, Shield, FileCheck, Target } from "lucide-react";

type Agent = {
  name: string;
  tagline: string;
  icon: React.ReactNode;
  color: string;
  path: string;
};

export function AgentCards() {
  const agents: Agent[] = [
    {
      name: "Scout",
      tagline: "I sniff signals before anyone else does.",
      icon: <Search className="h-4 w-4" />,
      color: "bg-blue-100 text-blue-600",
      path: "/market-research"
    },
    {
      name: "Profiler",
      tagline: "I study people, so you know who to chase.",
      icon: <Users className="h-4 w-4" />,
      color: "bg-purple-100 text-purple-600",
      path: "/customers"
    },
    {
      name: "Strategist",
      tagline: "I craft the perfect GTM game plan.",
      icon: <FileText className="h-4 w-4" />,
      color: "bg-green-100 text-green-600",
      path: "/deals"
    },
    {
      name: "Activator",
      tagline: "I set things in motion—campaigns, cadences, and connections.",
      icon: <Calendar className="h-4 w-4" />,
      color: "bg-red-100 text-red-600",
      path: "/calendar"
    },
    {
      name: "Presenter",
      tagline: "I turn insights into killer decks and talking points.",
      icon: <Presentation className="h-4 w-4" />,
      color: "bg-pink-100 text-pink-600",
      path: "/reports"
    },
    {
      name: "Handler",
      tagline: "I manage objections like a pro negotiator.",
      icon: <Shield className="h-4 w-4" />,
      color: "bg-indigo-100 text-indigo-600",
      path: "/insights"
    },
    {
      name: "Proposer",
      tagline: "I write proposals that are hard to refuse.",
      icon: <FileCheck className="h-4 w-4" />,
      color: "bg-teal-100 text-teal-600",
      path: "/insights"
    }
  ];
  
  const handleAgentClick = (agent: Agent) => {
    const newWindow = window.open(agent.path, '_blank');
    if (newWindow) {
      newWindow.document.title = agent.name;
      
      // Remove existing favicon and add a custom one
      newWindow.addEventListener('load', () => {
        const existingLink = newWindow.document.querySelector('link[rel="icon"]') || newWindow.document.querySelector('link[rel="shortcut icon"]');
        if (existingLink) {
          existingLink.remove();
        }
        
        // Create a simple data URL favicon with just the agent icon (remove heart)
        const link = newWindow.document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        // Create a simple SVG favicon without heart icon
        link.href = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>')}`;
        newWindow.document.head.appendChild(link);
      });
    }
  };
  
  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {agents.map((agent, index) => (
          <Card
            key={index}
            className="cursor-pointer hover:shadow-md transition-all"
            onClick={() => handleAgentClick(agent)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <div className={`p-2 rounded-full ${agent.color} flex-shrink-0`}>
                  {agent.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{agent.name}</h3>
                  <p className="text-xs text-gray-600 mt-1 italic">{agent.tagline}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
