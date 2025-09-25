import React, { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Check, X, MessageCircle, Search, ChevronDown, FileText, TrendingUp, Users, Target, BarChart, Clock, ArrowUpRight, AlertCircle, CheckCircle, History, ArrowRight, ChevronRight, Lightbulb, Activity, Link2, Filter, Download, Share, Linkedin, Mail, FolderPlus, Bot, Eye, ExternalLink } from 'lucide-react';
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
  status: 'pending' | 'accepted' | 'dismissed' | 'draft' | 'completed' | 'needs-review';
  type: 'report' | 'analysis' | 'insight' | 'proposal' | 'enrichment' | 'playbook';
  // New fields for enhanced structure
  actionDelegated: string;
  whyTriggered: string;
  actionPerformed: string;
  outputSummary: string;
  outputDetails: string;
  recommendations: string[];
  consequence: string;
  actionLog: string[];
  versionHistory?: string[];
  crossLinks?: {
    id: string;
    title: string;
    relationship: string;
  }[];
}

// Mock data for demonstration
const mockArtefacts: ArtefactItem[] = [{
  id: '1',
  agentName: 'Scout',
  agentIcon: '🛰',
  agentColor: 'bg-blue-500',
  title: 'Competitor Pricing Analysis',
  description: 'Scout generated a comprehensive competitor pricing analysis for SMB segment, identifying key pricing gaps and opportunities.',
  timestamp: '2h ago',
  tags: ['Competitor Analysis', 'Pricing', 'SMB'],
  status: 'pending',
  type: 'analysis',
  actionDelegated: 'Scout, analyze Competitor X\'s SMB pricing tier',
  whyTriggered: 'Because your ICP includes Mid-Market SaaS in Healthcare, this action was prioritized',
  actionPerformed: 'Researched Competitor X\'s new SMB pricing model across 12 different SaaS platforms and analyzed pricing structures',
  outputSummary: 'Comprehensive pricing analysis revealing 23% pricing gap in mid-market segment',
  outputDetails: 'Detailed breakdown of competitor pricing tiers, feature comparisons, and market positioning analysis with actionable recommendations.',
  recommendations: ['Implement tiered pricing strategy with 15-20% premium over competitors', 'Add enterprise features to justify higher pricing', 'Consider freemium model for market penetration'],
  consequence: 'Competitive pricing benchmark updated with new SMB tier recommendations',
  actionLog: ['User delegated pricing analysis task', 'Scout initiated competitor research', 'Data collection completed from 12 platforms', 'Analysis generated with recommendations', 'Awaiting user review and approval']
}, {
  id: '2',
  agentName: 'Profiler',
  agentIcon: '🎯',
  agentColor: 'bg-purple-500',
  title: 'ICP Enrichment Report',
  description: 'Profiler enriched your ICP data with 47 new qualified leads and behavioral insights from recent market research.',
  timestamp: '4h ago',
  tags: ['ICP Enrichment', 'Lead Generation', 'Market Research'],
  status: 'completed',
  type: 'enrichment',
  actionDelegated: 'Profiler, enrich ICP with EU fintech startup leads',
  whyTriggered: 'Expansion into European markets requires updated ICP profiles for fintech vertical',
  actionPerformed: 'Enriched 52 raw leads with verified contact details and behavioral data analysis',
  outputSummary: 'Successfully enriched 47 qualified leads with 94% contact accuracy',
  outputDetails: 'Complete lead enrichment including company size, tech stack, funding stage, and decision-maker contact information.',
  recommendations: ['Prioritize Series A companies for immediate outreach', 'Focus on companies using Stripe or similar payment processors', 'Target CTOs and Head of Engineering roles for technical decisions'],
  consequence: 'Added 47 new enriched leads to CRM with automated nurture sequences activated',
  actionLog: ['User requested EU fintech ICP enrichment', 'Profiler processed 52 raw lead records', 'Contact verification completed with 94% success rate', 'Behavioral analysis and scoring applied', 'Leads automatically added to CRM system']
}, {
  id: '4',
  agentName: 'Scout',
  agentIcon: '🛰',
  agentColor: 'bg-blue-500',
  title: 'Market Size Analysis',
  description: 'Scout analyzed the addressable market size for the fintech vertical, providing TAM, SAM, and SOM calculations.',
  timestamp: '2d ago',
  tags: ['Market Analysis', 'Fintech', 'TAM/SAM'],
  status: 'dismissed',
  type: 'analysis',
  actionDelegated: 'Scout, calculate TAM/SAM/SOM for fintech vertical expansion',
  whyTriggered: 'Required for investor presentations and strategic planning discussions',
  actionPerformed: 'Analyzed addressable market size for fintech vertical with detailed TAM, SAM, and SOM breakdowns',
  outputSummary: 'Market analysis showing $47B TAM, $2.3B SAM, and $180M SOM for target segments',
  outputDetails: 'Comprehensive market sizing analysis with geographic breakdown, competitive landscape, and growth projections.',
  recommendations: ['Focus on $180M serviceable obtainable market initially', 'Prioritize payment processing and lending software segments', 'Consider geographic expansion to DACH region within 18 months'],
  consequence: 'Market analysis dismissed due to conflicting data sources - new analysis requested',
  actionLog: ['User requested fintech market sizing analysis', 'Scout gathered data from multiple market research sources', 'TAM/SAM/SOM calculations completed', 'Analysis delivered with methodology breakdown', 'User dismissed due to data source concerns']
}];
const Artefacts = () => {
  usePageTitle('Artefacts - Brewra');
  const [artefacts, setArtefacts] = useState<ArtefactItem[]>(mockArtefacts);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedChat, setExpandedChat] = useState<string | null>(null);
  const [expandedDeliverable, setExpandedDeliverable] = useState<string | null>(null);
  const filteredArtefacts = artefacts.filter(artefact => {
    const matchesSearch = artefact.title.toLowerCase().includes(searchQuery.toLowerCase()) || artefact.description.toLowerCase().includes(searchQuery.toLowerCase()) || artefact.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });
  const handleAccept = (id: string) => {
    setArtefacts(prev => prev.map(artefact => artefact.id === id ? {
      ...artefact,
      status: 'accepted' as const
    } : artefact));
  };
  const handleDismiss = (id: string) => {
    setArtefacts(prev => prev.map(artefact => artefact.id === id ? {
      ...artefact,
      status: 'dismissed' as const
    } : artefact));
  };
  const toggleChat = (id: string) => {
    setExpandedChat(expandedChat === id ? null : id);
  };

  const toggleDeliverable = (id: string) => {
    setExpandedDeliverable(expandedDeliverable === id ? null : id);
  };
  const getTypeIcon = (type: ArtefactItem['type']) => {
    switch (type) {
      case 'report':
        return FileText;
      case 'analysis':
        return TrendingUp;
      case 'insight':
        return Target;
      case 'proposal':
        return BarChart;
      case 'enrichment':
        return Users;
      case 'playbook':
        return Target;
      default:
        return FileText;
    }
  };
  const ArtefactCard = ({
    artefact
  }: {
    artefact: ArtefactItem;
  }) => {
    const TypeIcon = getTypeIcon(artefact.type);
    const isExpanded = expandedChat === artefact.id;
    const isDeliverableExpanded = expandedDeliverable === artefact.id;
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'completed':
          return 'bg-green-100 text-green-800 border-green-200';
        case 'accepted':
          return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'needs-review':
          return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'pending':
          return 'bg-orange-100 text-orange-800 border-orange-200';
        case 'dismissed':
          return 'bg-red-100 text-red-800 border-red-200';
        case 'draft':
          return 'bg-gray-100 text-gray-800 border-gray-200';
        default:
          return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    };
    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'completed':
          return CheckCircle;
        case 'accepted':
          return CheckCircle;
        case 'needs-review':
          return AlertCircle;
        case 'pending':
          return Clock;
        case 'dismissed':
          return X;
        case 'draft':
          return FileText;
        default:
          return Clock;
      }
    };
    const StatusIcon = getStatusIcon(artefact.status);
    return <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-primary/20">
        {/* 1. Artefact Header (Meta Layer) */}
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className={cn('text-white text-sm font-medium', artefact.agentColor)}>
                  {artefact.agentIcon}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-base">{artefact.agentName}</span>
                  <TypeIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Generated {artefact.timestamp}</span>
                </div>
              </div>
            </div>
            
          </div>
          
          {/* Action Delegated by User */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <ArrowRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-700">Action Delegated</p>
                <p className="text-sm text-muted-foreground">"{artefact.actionDelegated}"</p>
              </div>
            </div>
            
            {/* Why it was triggered */}
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-700">Context & Rationale</p>
                <p className="text-sm text-muted-foreground">{artefact.whyTriggered}</p>
              </div>
            </div>

            {/* System Impact */}
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700">System Impact</p>
                <p className="text-sm text-muted-foreground">{artefact.consequence}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* 2. Deliverable File Preview */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Deliverable File Preview</h4>
            </div>
            
            {/* File Preview Card */}
            <div 
              className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 hover:border-primary/40 transition-colors cursor-pointer group"
              onClick={() => toggleDeliverable(artefact.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-sm">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">
                    Competitor X SMB Launch Analysis
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {artefact.outputSummary}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>PDF • 12 pages</span>
                    <span>•</span>
                    <span>Generated {artefact.timestamp}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors">
                    Click to preview
                  </span>
                </div>
              </div>
            </div>

            {/* Expanded Deliverable View */}
            {isDeliverableExpanded && (
              <div className="bg-muted/30 rounded-lg p-6 space-y-4 border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Competitor X SMB Launch Analysis</h3>
                  <Button variant="ghost" size="sm" onClick={() => toggleDeliverable(artefact.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Executive Summary</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {artefact.outputSummary}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Detailed Analysis</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {artefact.outputDetails}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Action Performed</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {artefact.actionPerformed}
                    </p>
                  </div>

                  {artefact.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Key Recommendations</h4>
                      <ul className="space-y-2">
                        {artefact.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <ChevronRight className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. Output Tags */}
          <div className="flex flex-wrap gap-1">
            {artefact.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          {/* 5. History & Traceability */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Action Log</h4>
            </div>
            <div className="space-y-2">
              {artefact.actionLog.map((log, index) => <div key={index} className="flex items-center gap-3 text-xs">
                  <div className="w-2 h-2 bg-primary/60 rounded-full flex-shrink-0"></div>
                  <span className="text-muted-foreground">{log}</span>
                </div>)}
            </div>
          </div>

          {/* Cross-links */}
          {artefact.crossLinks && artefact.crossLinks.length > 0 && <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm">Related Artefacts</h4>
              </div>
              <div className="space-y-2">
                {artefact.crossLinks.map((link, index) => <div key={index} className="flex items-start gap-2 p-2 bg-muted/20 rounded text-xs">
                    <ArrowRight className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <span className="font-medium">{link.title}</span>
                      <p className="text-muted-foreground">{link.relationship}</p>
                    </div>
                  </div>)}
              </div>
            </div>}

          {/* Action Bar */}
          <div className="border-t pt-4 mt-6">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Save as PDF
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Share className="h-4 w-4" />
                Share on Slack
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Linkedin className="h-4 w-4" />
                Share as LinkedIn Post
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Mail className="h-4 w-4" />
                Email to Colleague
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <FolderPlus className="h-4 w-4" />
                Save to Insights
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Bot className="h-4 w-4" />
                Ask Agent
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          {(artefact.status === 'pending' || artefact.status === 'needs-review') && <div className="flex items-center gap-2 pt-4 border-t">
              {/* No action buttons for now */}
            </div>}

        </CardContent>
      </Card>;
  };
  const EmptyState = () => <div className="text-center py-12">
      <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No artefacts yet</h3>
      <p className="text-muted-foreground max-w-sm mx-auto">
        Delegate tasks from Signals to see outputs here. Your AI agents will generate reports, insights, and analyses that appear in this workspace.
      </p>
    </div>;
  return <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Artefacts</h1>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search artefacts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 w-80" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {filteredArtefacts.length === 0 ? <EmptyState /> : <div className="grid gap-6">
              {filteredArtefacts.map(artefact => <ArtefactCard key={artefact.id} artefact={artefact} />)}
            </div>}
        </div>
      </div>
    </Layout>;
};
export default Artefacts;