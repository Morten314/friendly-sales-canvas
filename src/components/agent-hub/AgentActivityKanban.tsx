
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  User, 
  Compass, 
  Zap, 
  Presentation, 
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AgentActivity {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  lastActivity: string;
  status: 'approved' | 'pending' | 'needs-attention';
  updates: string[];
  progress?: number;
  path: string;
}

const agentActivities: AgentActivity[] = [
  {
    id: '1',
    name: 'Scout',
    description: 'Finds and recommends high-intent leads',
    icon: <Search className="h-5 w-5" />,
    lastActivity: 'Jun 15, 2:42 PM',
    status: 'approved',
    updates: [
      'Enriched 28 leads',
      'Suggested 2 new campaigns',
      'Flagged 3 ICP-fit accounts'
    ],
    progress: 85,
    path: '/market-research'
  },
  {
    id: '2',
    name: 'Profiler',
    description: 'Builds detailed customer profiles',
    icon: <User className="h-5 w-5" />,
    lastActivity: 'Jun 15, 1:15 PM',
    status: 'pending',
    updates: [
      'Analyzed 15 customer segments',
      'Updated ICP criteria',
      'Generated persona insights'
    ],
    progress: 60,
    path: '/customers'
  },
  {
    id: '3',
    name: 'Strategist',
    description: 'Creates GTM strategies and plans',
    icon: <Compass className="h-5 w-5" />,
    lastActivity: 'Jun 15, 11:30 AM',
    status: 'approved',
    updates: [
      'Developed Q3 strategy',
      'Identified 5 growth channels',
      'Optimized conversion funnel'
    ],
    progress: 90,
    path: '/deals'
  },
  {
    id: '4',
    name: 'Activator',
    description: 'Automates campaigns and outreach',
    icon: <Zap className="h-5 w-5" />,
    lastActivity: 'Jun 14, 4:20 PM',
    status: 'needs-attention',
    updates: [
      'Paused 2 underperforming campaigns',
      'Requires approval for new sequence',
      'Budget allocation needs review'
    ],
    progress: 35,
    path: '/calendar'
  },
  {
    id: '5',
    name: 'Presenter',
    description: 'Creates compelling demos and decks',
    icon: <Presentation className="h-5 w-5" />,
    lastActivity: 'Jun 14, 2:15 PM',
    status: 'pending',
    updates: [
      'Created 3 custom demo flows',
      'Updated sales deck templates',
      'Generated objection responses'
    ],
    progress: 70,
    path: '/reports'
  }
];

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'approved':
      return {
        label: 'Approved',
        variant: 'default' as const,
        className: 'bg-green-100 text-green-800 border-green-200',
        icon: <CheckCircle className="h-3 w-3" />
      };
    case 'pending':
      return {
        label: 'In Review',
        variant: 'secondary' as const,
        className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: <Clock className="h-3 w-3" />
      };
    case 'needs-attention':
      return {
        label: 'Needs Attention',
        variant: 'destructive' as const,
        className: 'bg-red-100 text-red-800 border-red-200',
        icon: <AlertCircle className="h-3 w-3" />
      };
    default:
      return {
        label: 'Unknown',
        variant: 'outline' as const,
        className: 'bg-gray-100 text-gray-800 border-gray-200',
        icon: <Clock className="h-3 w-3" />
      };
  }
};

const KanbanColumn = ({ 
  title, 
  agents, 
  count 
}: { 
  title: string; 
  agents: AgentActivity[]; 
  count: number;
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex-1">
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          {title}
          <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
            {count}
          </span>
        </h3>
      </div>
      
      <div className="space-y-4">
        {agents.map((agent) => {
          const statusConfig = getStatusConfig(agent.status);
          
          return (
            <Card 
              key={agent.id}
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] bg-white rounded-2xl border border-gray-100"
              onClick={() => navigate(agent.path)}
              title="Open Agent"
            >
              <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      {agent.icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{agent.name}</h4>
                      <p className="text-sm text-gray-600">{agent.description}</p>
                    </div>
                  </div>
                  <Badge className={`${statusConfig.className} flex items-center gap-1`}>
                    {statusConfig.icon}
                    {statusConfig.label}
                  </Badge>
                </div>

                {/* Last Activity */}
                <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span>Last Activity: {agent.lastActivity}</span>
                </div>

                {/* Progress Bar */}
                {agent.progress && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Progress</span>
                      <span className="text-sm text-gray-500">{agent.progress}%</span>
                    </div>
                    <Progress value={agent.progress} className="h-2" />
                  </div>
                )}

                {/* Key Updates */}
                <div>
                  <h5 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    Key Updates
                  </h5>
                  <ul className="space-y-1">
                    {agent.updates.map((update, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                        <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                        {update}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export function AgentActivityKanban() {
  const approvedAgents = agentActivities.filter(agent => agent.status === 'approved');
  const pendingAgents = agentActivities.filter(agent => agent.status === 'pending');
  const needsAttentionAgents = agentActivities.filter(agent => agent.status === 'needs-attention');

  return (
    <div className="w-full">
      {/* Desktop/Tablet View */}
      <div className="hidden md:flex gap-6">
        <KanbanColumn 
          title="Approved Agents" 
          agents={approvedAgents} 
          count={approvedAgents.length}
        />
        <KanbanColumn 
          title="Pending Review" 
          agents={pendingAgents} 
          count={pendingAgents.length}
        />
        <KanbanColumn 
          title="Needs Revision" 
          agents={needsAttentionAgents} 
          count={needsAttentionAgents.length}
        />
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-6">
        <KanbanColumn 
          title="Approved Agents" 
          agents={approvedAgents} 
          count={approvedAgents.length}
        />
        <KanbanColumn 
          title="Pending Review" 
          agents={pendingAgents} 
          count={pendingAgents.length}
        />
        <KanbanColumn 
          title="Needs Revision" 
          agents={needsAttentionAgents} 
          count={needsAttentionAgents.length}
        />
      </div>
    </div>
  );
}
