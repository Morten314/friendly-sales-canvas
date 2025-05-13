
import React, { useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search, User, Compass, Zap, Presentation, MessageSquare, FileText, Shield, FileCheck, Target } from "lucide-react";
import { useNavigate } from 'react-router-dom';

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
      icon: <Search className="h-6 w-6" />,
      color: "bg-blue-100 text-blue-600",
      path: "/market-research"
    },
    {
      name: "Profiler",
      tagline: "I study people, so you know who to chase.",
      icon: <User className="h-6 w-6" />,
      color: "bg-purple-100 text-purple-600",
      path: "/customers"
    },
    {
      name: "Strategist",
      tagline: "I craft the perfect GTM game plan.",
      icon: <Compass className="h-6 w-6" />,
      color: "bg-amber-100 text-amber-600",
      path: "/deals"
    },
    {
      name: "Playmaker",
      tagline: "I design plays that sellers can win with.",
      icon: <Target className="h-6 w-6" />,
      color: "bg-green-100 text-green-600",
      path: "/calendar"
    },
    {
      name: "Activator",
      tagline: "I set things in motion—campaigns, cadences, and connections.",
      icon: <Zap className="h-6 w-6" />,
      color: "bg-green-100 text-green-600",
      path: "/calendar"
    },
    {
      name: "Presenter",
      tagline: "I turn insights into killer decks and talking points.",
      icon: <Presentation className="h-6 w-6" />,
      color: "bg-red-100 text-red-600",
      path: "/reports"
    },
    {
      name: "Handler",
      tagline: "I manage objections like a pro negotiator.",
      icon: <Shield className="h-6 w-6" />,
      color: "bg-indigo-100 text-indigo-600",
      path: "/insights"
    },
    {
      name: "Proposer",
      tagline: "I write proposals that are hard to refuse.",
      icon: <FileCheck className="h-6 w-6" />,
      color: "bg-teal-100 text-teal-600",
      path: "/insights"
    },
    {
      name: "Closer",
      tagline: "I chase, nudge, and close the loop.",
      icon: <Target className="h-6 w-6" />,
      color: "bg-rose-100 text-rose-600",
      path: "/insights"
    }
  ];
  
  const scrollContainer = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainer.current) {
      const { current } = scrollContainer;
      const scrollAmount = 300;
      
      if (direction === 'left') {
        current.scrollLeft -= scrollAmount;
      } else {
        current.scrollLeft += scrollAmount;
      }
    }
  };
  
  return (
    <Card className="mb-8 overflow-hidden">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Meet Your Agents</CardTitle>
            <CardDescription>AI specialists ready to assist you</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => scroll('left')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => scroll('right')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-6">
        <div 
          ref={scrollContainer}
          className="flex gap-4 overflow-x-auto pb-4 snap-x scrollbar-hide"
          style={{ scrollBehavior: 'smooth' }}
        >
          {agents.map((agent, index) => (
            <div
              key={index}
              className="flex-none w-[280px] snap-start cursor-pointer hover:shadow-md transition-all"
              onClick={() => navigate(agent.path)}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-3 rounded-lg ${agent.color}`}>
                      {agent.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{agent.name}</h3>
                      <p className="text-sm text-gray-600 italic mt-1">"{agent.tagline}"</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
