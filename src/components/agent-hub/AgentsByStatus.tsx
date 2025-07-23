import React from 'react';
import { AgentPersona } from '@/components/agents/AgentPersonas';
import {
  Check,
  Edit,
  AlertTriangle,
  Clock,
  Search,
  User,
  Compass,
  Zap,
  Presentation
} from 'lucide-react';

export interface AgentWithStatus extends AgentPersona {
  status: 'approved' | 'revision' | 'pending' | 'inactive';
  lastActivity?: string;
  priority: number;
}

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
    lastActivity: "5 days ago",
    priority: 5
  }
];

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

export function AgentsByStatus() {
  const sortedAgents = [...agentsWithStatus].sort((a, b) => {
    const statusPriority = {
      'approved': 1,
      'pending': 2,
      'revision': 3,
      'inactive': 4
    };
    const statusComparison = statusPriority[a.status] - statusPriority[b.status];
    return statusComparison !== 0 ? statusComparison : a.priority - b.priority;
  });

  const groupedAgents = sortedAgents.reduce((acc, agent) => {
    if (!acc[agent.status]) acc[agent.status] = [];
    acc[agent.status].push(agent);
    return acc;
  }, {} as Record<string, AgentWithStatus[]>);

  const statusOrder = ['approved', 'pending', 'revision', 'inactive'];

  return (
    <div className="space-y-10">
      {statusOrder.map(status => {
        const agents = groupedAgents[status];
        if (!agents || agents.length === 0) return null;

        return (
          <div key={status} className="border rounded-md shadow-sm overflow-x-auto">
            <div className="px-4 py-2 bg-gray-100 border-b flex items-center gap-2 text-sm font-semibold">
              {getStatusIcon(status)}
              {getStatusText(status)} Agents
            </div>
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left">Strengths</th>
                  <th className="px-4 py-2 text-left">Last Activity</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {agents.map((agent, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 font-medium">{agent.name}</td>
                    <td className="px-4 py-2">{agent.description}</td>
                    <td className="px-4 py-2">{agent.role}</td>
                    <td className="px-4 py-2">
                      <ul className="list-disc list-inside">
                        {agent.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-2">{agent.lastActivity || 'No recent activity'}</td>
                    <td className="px-4 py-2 flex items-center gap-1">
                      {getStatusIcon(agent.status)}
                      {getStatusText(agent.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
