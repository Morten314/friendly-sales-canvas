import React, { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Check, 
  X, 
  MessageCircle, 
  Search, 
  ChevronDown,
  FileText,
  TrendingUp,
  Users,
  Target,
  BarChart,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArtefactItem {
  id: string;
  agentName: string;
  agentIcon: string;
  agentColor: string;
  title: string;
  description: string;
  timestamp: string;
  tags: string[];
  status: 'pending' | 'accepted' | 'dismissed';
  type: 'report' | 'analysis' | 'insight' | 'proposal';
}

// Mock data for demonstration
const mockArtefacts: ArtefactItem[] = [
  {
    id: '1',
    agentName: 'Scout',
    agentIcon: '🟦',
    agentColor: 'bg-blue-500',
    title: 'Competitor Pricing Analysis',
    description: 'Scout generated a comprehensive competitor pricing analysis for SMB segment, identifying key pricing gaps and opportunities.',
    timestamp: '2h ago',
    tags: ['Competitor Analysis', 'Pricing', 'SMB'],
    status: 'pending',
    type: 'analysis'
  },
  {
    id: '2',
    agentName: 'Profiler',
    agentIcon: '🟪',
    agentColor: 'bg-purple-500',
    title: 'ICP Enrichment Report',
    description: 'Profiler enriched your ICP data with 47 new qualified leads and behavioral insights from recent market research.',
    timestamp: '4h ago',
    tags: ['ICP Enrichment', 'Lead Generation', 'Market Research'],
    status: 'accepted',
    type: 'report'
  },
  {
    id: '3',
    agentName: 'Strategist',
    agentIcon: '🟧',
    agentColor: 'bg-orange-500',
    title: 'GTM Strategy Proposal',
    description: 'Strategist developed a comprehensive go-to-market strategy for Q1 2024, including channel recommendations and timeline.',
    timestamp: '1d ago',
    tags: ['GTM Strategy', 'Q1 Planning', 'Channel Strategy'],
    status: 'pending',
    type: 'proposal'
  },
  {
    id: '4',
    agentName: 'Scout',
    agentIcon: '🟦',
    agentColor: 'bg-blue-500',
    title: 'Market Size Analysis',
    description: 'Scout analyzed the addressable market size for the fintech vertical, providing TAM, SAM, and SOM calculations.',
    timestamp: '2d ago',
    tags: ['Market Analysis', 'Fintech', 'TAM/SAM'],
    status: 'dismissed',
    type: 'analysis'
  }
];

const Artefacts = () => {
  usePageTitle('Artefacts - Brewra');
  
  const [artefacts, setArtefacts] = useState<ArtefactItem[]>(mockArtefacts);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [expandedChat, setExpandedChat] = useState<string | null>(null);

  const filteredArtefacts = artefacts.filter(artefact => {
    const matchesSearch = artefact.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         artefact.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         artefact.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTab = activeTab === 'all' || artefact.status === activeTab;
    
    return matchesSearch && matchesTab;
  });

  const handleAccept = (id: string) => {
    setArtefacts(prev => prev.map(artefact => 
      artefact.id === id ? { ...artefact, status: 'accepted' as const } : artefact
    ));
  };

  const handleDismiss = (id: string) => {
    setArtefacts(prev => prev.map(artefact => 
      artefact.id === id ? { ...artefact, status: 'dismissed' as const } : artefact
    ));
  };

  const toggleChat = (id: string) => {
    setExpandedChat(expandedChat === id ? null : id);
  };

  const getTypeIcon = (type: ArtefactItem['type']) => {
    switch (type) {
      case 'report': return FileText;
      case 'analysis': return TrendingUp;
      case 'insight': return Target;
      case 'proposal': return BarChart;
      default: return FileText;
    }
  };

  const ArtefactCard = ({ artefact }: { artefact: ArtefactItem }) => {
    const TypeIcon = getTypeIcon(artefact.type);
    const isExpanded = expandedChat === artefact.id;

    return (
      <Card className="hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className={cn('text-white text-xs font-medium', artefact.agentColor)}>
                  {artefact.agentIcon}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{artefact.agentName}</span>
                  <TypeIcon className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Generated {artefact.timestamp}</span>
                </div>
              </div>
            </div>
            <Badge variant={artefact.status === 'accepted' ? 'default' : artefact.status === 'dismissed' ? 'destructive' : 'secondary'}>
              {artefact.status}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold text-base mb-2">{artefact.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{artefact.description}</p>
          </div>

          <div className="flex flex-wrap gap-1">
            {artefact.tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          {artefact.status === 'pending' && (
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => handleAccept(artefact.id)}
                className="flex-1 bg-green-600 hover:bg-green-700"
                size="sm"
              >
                <Check className="h-4 w-4 mr-1" />
                Accept
              </Button>
              <Button 
                onClick={() => handleDismiss(artefact.id)}
                variant="outline"
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                size="sm"
              >
                <X className="h-4 w-4 mr-1" />
                Dismiss
              </Button>
              <Button 
                onClick={() => toggleChat(artefact.id)}
                variant="ghost"
                size="sm"
                className="px-3"
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                Discuss
                <ChevronDown className={cn("h-3 w-3 ml-1 transition-transform", isExpanded && "rotate-180")} />
              </Button>
            </div>
          )}

          {isExpanded && (
            <div className="border-t pt-4 mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className={cn('text-white text-xs', artefact.agentColor)}>
                      {artefact.agentIcon}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{artefact.agentName}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Hi! Let's refine this artefact together. What's missing or needs adjustment?
                </p>
                <div className="flex gap-2">
                  <Input placeholder="Type your feedback..." className="flex-1" />
                  <Button size="sm">
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const EmptyState = () => (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No artefacts yet</h3>
      <p className="text-muted-foreground max-w-sm mx-auto">
        Delegate tasks from Signals to see outputs here. Your AI agents will generate reports, insights, and analyses that appear in this workspace.
      </p>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Artefacts</h1>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search artefacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-80"
              />
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All Artefacts</TabsTrigger>
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
            <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
            <TabsTrigger value="pending">Pending Review</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {filteredArtefacts.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid gap-4">
                {filteredArtefacts.map((artefact) => (
                  <ArtefactCard key={artefact.id} artefact={artefact} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Artefacts;