import React from 'react';
import { AgentPersona, AgentPersonaCard } from '@/components/agents/AgentPersonas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Edit, AlertTriangle, Clock, Search, User, Compass, Zap, Presentation } from 'lucide-react';

// Extend the agent persona type with status information
export interface AgentWithStatus extends AgentPersona {
  status: 'approved' | 'revision' | 'pending' | 'inactive';
  lastActivity?: string;
  priority: number;
}

// Sample data with status and priority for ordering
const agentsWithStatus: AgentWithStatus[] = [
  {
    name: "Scout",
    description: "Market Research Agent",
    tagline: "Find the best markets before your competitors do.",
    icon: <Search className="h-6 w-6" />,
    action: "Start Research",
    path: "/market-research",
    color: "bg-blue-50 text-blue-600",
    role: "Market Intelligence",
    strengths: ["Market analysis", "Trend spotting", "Competitor research"],
    status: "approved",
    lastActivity: "2 hours ago",
    priority: 1
  },
  {
    name: "Profiler",
    description: "ICP Builder and Refiner",
    tagline: "Sharpen your targeting with laser precision.",
    icon: <User className="h-6 w-6" />,
    action: "Build ICP",
    path: "/customers",
    color: "bg-purple-50 text-purple-600",
    role: "Customer Analysis",
    strengths: ["Behavioral analysis", "Need identification", "Segmentation"],
    status: "revision",
    lastActivity: "1 day ago",
    priority: 2
  },
  {
    name: "Strategist",
    description: "GTM Strategy Generator",
    tagline: "Launch with a plan, not a gamble.",
    icon: <Compass className="h-6 w-6" />,
    action: "Create Strategy",
    path: "/deals",
    color: "bg-amber-50 text-amber-600",
    role: "Strategy & Planning",
    strengths: ["Market positioning", "Competitive strategy", "Growth planning"],
    status: "approved",
    lastActivity: "3 days ago",
    priority: 3
  },
  {
    name: "Activator",
    description: "Task & Campaign Automation",
    tagline: "Move fast. Book meetings. Fill your pipeline.",
    icon: <Zap className="h-6 w-6" />,
    action: "Start Campaign",
    path: "/calendar",
    color: "bg-green-50 text-green-600",
    role: "Execution & Automation",
    strengths: ["Campaign automation", "Task management", "Follow-up sequences"],
    status: "pending",
    lastActivity: "Just now",
    priority: 4
  },
  {
    name: "Presenter",
    description: "Demo & Deck Generator",
    tagline: "Deliver compelling demos that close deals.",
    icon: <Presentation className="h-6 w-6" />,
    action: "Prepare Demo",
    path: "/reports",
    color: "bg-red-50 text-red-600",
    role: "Communication",
    strengths: ["Visual storytelling", "Value articulation", "Objection handling"],
    status: "inactive",
    priority: 5
  }
];

// Helper function to get status icon
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'approved':
      return <Check className="h-4 w-4 text-green-500" />;
    case 'revision':
      return <Edit className="h-4 w-4 text-amber-500" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-blue-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-gray-400" />;
  }
};

// Helper function to get status text
const getStatusText = (status: string) => {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'revision':
      return 'Needs Revision';
    case 'pending':
      return 'Pending Review';
    default:
      return 'Inactive';
  }
};

// Helper function to get status color
const getStatusColor = (status: string) => {
  switch (status) {
    case 'approved':
      return 'bg-green-50 text-green-600 border-green-200';
    case 'revision':
      return 'bg-amber-50 text-amber-600 border-amber-200';
    case 'pending':
      return 'bg-blue-50 text-blue-600 border-blue-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
};

export function AgentsByStatus() {
  // Sort agents by status priority and then by individual priority
  const sortedAgents = [...agentsWithStatus].sort((a, b) => {
    const statusPriority = {
      'approved': 1,
      'pending': 2,
      'revision': 3,
      'inactive': 4
    };
    
    const statusComparison = statusPriority[a.status] - statusPriority[b.status];
    if (statusComparison !== 0) return statusComparison;
    
    // If status is the same, sort by agent priority
    return a.priority - b.priority;
  });

  // Group agents by status
  const groupedAgents = sortedAgents.reduce((acc, agent) => {
    if (!acc[agent.status]) {
      acc[agent.status] = [];
    }
    acc[agent.status].push(agent);
    return acc;
  }, {} as Record<string, AgentWithStatus[]>);

  // Define the display order of statuses
  const statusOrder = ['approved', 'pending', 'revision', 'inactive'];

  return (
    <div className="space-y-6">
      {statusOrder.map(status => {
        const agents = groupedAgents[status];
        if (!agents || agents.length === 0) return null;
        
        return (
          <Card key={status} className={`border-l-4 ${getStatusColor(status)}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {getStatusIcon(status)}
                {getStatusText(status)} Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent, index) => (
                  <div key={index} className="relative">
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs border flex items-center gap-1 z-10 bg-white/80 backdrop-blur-sm">
                      {getStatusIcon(agent.status)}
                      <span>{agent.lastActivity || 'No recent activity'}</span>
                    </div>
                    <AgentPersonaCard persona={agent} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}