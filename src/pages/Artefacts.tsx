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
              <h4 className="font-semibold text-sm">Action Performed</h4>
            </div>
            
            {/* File Preview Card */}
            <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 hover:border-primary/40 transition-colors cursor-pointer group" onClick={() => toggleDeliverable(artefact.id)}>
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
            {isDeliverableExpanded && <div className="bg-background rounded-lg border shadow-sm">
                {/* Document Header */}
                <div className="border-b bg-muted/20 px-6 py-4">
                  <div className="flex items-center justify-between mb-4">
                    <h1 className="text-xl font-bold">
                      {artefact.id === '1' && 'Competitor X — SMB Pricing Launch: Detailed Impact Analysis (v1)'}
                      {artefact.id === '2' && 'EU Fintech ICP Enrichment: Lead Intelligence Report (v1)'}
                      {artefact.id === '4' && 'Fintech Vertical Market Sizing: TAM/SAM/SOM Analysis (v1)'}
                    </h1>
                    <Button variant="ghost" size="sm" onClick={() => toggleDeliverable(artefact.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Header Metadata */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-muted-foreground">Agent:</span>
                      <p className="font-semibold">{artefact.agentName}</p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Action Delegated:</span>
                      <p className="font-medium">"{artefact.actionDelegated}"</p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Generated:</span>
                      <p className="font-medium">{artefact.timestamp}</p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Mission Control Trigger:</span>
                      <p className="font-medium">
                        {artefact.id === '1' && 'ICP Market Expansion'}
                        {artefact.id === '2' && 'EU Market Entry Strategy'}
                        {artefact.id === '4' && 'Strategic Planning Request'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Document Content */}
                <div className="p-6 space-y-8">
                  {/* Executive Summary */}
                  <section>
                    <h2 className="text-lg font-semibold mb-4 border-b pb-2">Snapshot</h2>
                    <div className="space-y-3 text-sm leading-relaxed">
                      {artefact.id === '1' && <>
                          <p><strong>Problem/Trigger:</strong> Competitor X launched new SMB pricing tiers targeting mid-market SaaS companies in Healthcare vertical, directly competing with our core ICP segment.</p>
                          
                          <p><strong>Key Findings:</strong></p>
                          <ul className="list-decimal list-inside ml-4 space-y-1">
                            <li>23% pricing gap identified in our favor across comparable feature sets</li>
                            <li>Competitor targets same healthcare SaaS segment with 47% feature overlap</li>
                            <li>Limited geographic reach (US only) vs our global presence advantage</li>
                          </ul>
                          
                          <p><strong>Recommended Actions:</strong> Implement competitive pricing response within 2 weeks, enhance enterprise features to justify premium, and accelerate European market expansion.</p>
                          
                          <p><strong>Urgency:</strong> High - 12% of our pipeline directly affected, immediate response required to maintain competitive positioning.</p>
                        </>}
                      
                      {artefact.id === '2' && <>
                          <p><strong>Problem/Trigger:</strong> European market expansion requires qualified fintech startup leads with verified contact data and behavioral insights for targeted outreach campaigns.</p>
                          
                          <p><strong>Key Findings:</strong></p>
                          <ul className="list-decimal list-inside ml-4 space-y-1">
                            <li>47 qualified leads enriched from 52 raw records (90% success rate)</li>
                            <li>94% contact accuracy achieved through multi-source verification</li>
                            <li>73% of leads are Series A-B stage with strong payment infrastructure needs</li>
                          </ul>
                          
                          <p><strong>Recommended Actions:</strong> Prioritize Series A companies for immediate outreach, focus on Stripe/payment processor users, and target technical decision makers.</p>
                          
                          <p><strong>Urgency:</strong> Medium - Leads added to automated nurture sequences, follow-up campaigns scheduled for optimal EU timezone engagement.</p>
                        </>}
                      
                      {artefact.id === '4' && <>
                          <p><strong>Problem/Trigger:</strong> Strategic expansion into fintech vertical requires comprehensive market sizing analysis for investor presentations and resource allocation decisions.</p>
                          
                          <p><strong>Key Findings:</strong></p>
                          <ul className="list-decimal list-inside ml-4 space-y-1">
                            <li>$47B Total Addressable Market (TAM) across global fintech software sector</li>
                            <li>$2.3B Serviceable Addressable Market (SAM) for our solution categories</li>
                            <li>$180M Serviceable Obtainable Market (SOM) based on competitive analysis</li>
                          </ul>
                          
                          <p><strong>Recommended Actions:</strong> Focus on $180M SOM initially, prioritize payment processing and lending segments, consider DACH region expansion within 18 months.</p>
                          
                          <p><strong>Urgency:</strong> Low - Analysis dismissed due to conflicting data sources requiring new methodology and updated market research.</p>
                        </>}
                    </div>
                  </section>

                  {/* Scope & Objective */}
                  <section>
                    <h2 className="text-lg font-semibold mb-4 border-b pb-2">Scope & Objective</h2>
                    <div className="grid md:grid-cols-2 gap-6 text-sm">
                      <div>
                        <h3 className="font-medium mb-2">Analysis Covers:</h3>
                        <ul className="space-y-1 text-muted-foreground">
                          {artefact.id === '1' && <>
                              <li>• SMB pricing tier structure and features</li>
                              <li>• Target market positioning and messaging</li>
                              <li>• Geographic rollout strategy</li>
                              <li>• Impact on our current pipeline</li>
                              <li>• Early market and customer reaction</li>
                            </>}
                          {artefact.id === '2' && <>
                              <li>• EU fintech startup lead enrichment</li>
                              <li>• Contact verification and data accuracy</li>
                              <li>• Company profiling and tech stack analysis</li>
                              <li>• Decision maker identification</li>
                              <li>• Behavioral scoring and segmentation</li>
                            </>}
                          {artefact.id === '4' && <>
                              <li>• Global fintech software market sizing</li>
                              <li>• TAM, SAM, and SOM calculations</li>
                              <li>• Geographic market breakdown</li>
                              <li>• Competitive landscape analysis</li>
                              <li>• Growth projections and trends</li>
                            </>}
                        </ul>
                      </div>
                      <div>
                        <h3 className="font-medium mb-2">Intentionally Excludes:</h3>
                        <ul className="space-y-1 text-muted-foreground">
                          {artefact.id === '1' && <>
                              <li>• Enterprise tier analysis (separate report)</li>
                              <li>• Technical integration capabilities</li>
                              <li>• Long-term strategic roadmap speculation</li>
                              <li>• Customer churn and retention metrics</li>
                            </>}
                          {artefact.id === '2' && <>
                              <li>• North American market analysis</li>
                              <li>• Enterprise-level fintech companies</li>
                              <li>• Traditional banking institutions</li>
                              <li>• Cryptocurrency/DeFi segment</li>
                            </>}
                          {artefact.id === '4' && <>
                              <li>• Cryptocurrency and DeFi markets</li>
                              <li>• Traditional banking software</li>
                              <li>• Regulatory compliance solutions</li>
                              <li>• Consumer fintech applications</li>
                            </>}
                        </ul>
                      </div>
                    </div>
                  </section>

                  {/* Methodology & Data Sources */}
                  <section>
                    <h2 className="text-lg font-semibold mb-4 border-b pb-2">Methodology & Data Sources</h2>
                     <div className="space-y-4 text-sm">
                       <div>
                         <h3 className="font-medium mb-2">Data Sources Used:</h3>
                         <div className="grid md:grid-cols-2 gap-4">
                           {artefact.id === '1' && <>
                               <ul className="space-y-1 text-muted-foreground">
                                 <li>• Competitor X pricing page (snapshot: {artefact.timestamp})</li>
                                 <li>• Press release analysis from PR Newswire</li>
                                 <li>• Crunchbase company profile and funding data</li>
                                 <li>• G2 feature comparison and user reviews</li>
                                 <li>• LinkedIn social listening (last 30 days)</li>
                               </ul>
                               <ul className="space-y-1 text-muted-foreground">
                                 <li>• BuiltWith technology stack analysis</li>
                                 <li>• Bombora intent data signals</li>
                                 <li>• Internal CRM pipeline analysis</li>
                                 <li>• Job postings on LinkedIn (target roles)</li>
                                 <li>• Customer support documentation review</li>
                               </ul>
                             </>}
                           {artefact.id === '2' && <>
                               <ul className="space-y-1 text-muted-foreground">
                                 <li>• EU startup databases (Crunchbase, AngelList)</li>
                                 <li>• LinkedIn Sales Navigator for contact data</li>
                                 <li>• BuiltWith for technology stack analysis</li>
                                 <li>• ZoomInfo for contact verification</li>
                                 <li>• Clearbit for company enrichment data</li>
                               </ul>
                               <ul className="space-y-1 text-muted-foreground">
                                 <li>• GDPR-compliant data sources only</li>
                                 <li>• Company websites and career pages</li>
                                 <li>• Social media professional profiles</li>
                                 <li>• Industry reports and funding announcements</li>
                                 <li>• Payment processor integration listings</li>
                               </ul>
                             </>}
                           {artefact.id === '4' && <>
                               <ul className="space-y-1 text-muted-foreground">
                                 <li>• Grand View Research fintech market reports</li>
                                 <li>• McKinsey Global Payments Report 2023</li>
                                 <li>• PwC Global Fintech Survey data</li>
                                 <li>• Statista market sizing databases</li>
                                 <li>• CB Insights fintech funding analysis</li>
                               </ul>
                               <ul className="space-y-1 text-muted-foreground">
                                 <li>• Deloitte fintech trend analysis</li>
                                 <li>• EY Global Fintech Adoption Index</li>
                                 <li>• Regional central bank reports</li>
                                 <li>• Competitive intelligence databases</li>
                                 <li>• Industry association market data</li>
                               </ul>
                             </>}
                         </div>
                       </div>
                       
                       <div>
                         <h3 className="font-medium mb-2">Data Processing:</h3>
                         <p className="text-muted-foreground">
                           {artefact.id === '1' && 'Lead matching performed using company domain + employee count + industry vertical. 47 leads cross-referenced against our existing pipeline using HubSpot API integration.'}
                           {artefact.id === '2' && 'Multi-source verification process using LinkedIn, ZoomInfo, and Clearbit APIs. Lead scoring algorithm applied based on company size, funding stage, and technology stack compatibility.'}
                           {artefact.id === '4' && 'Market data normalized across multiple sources using weighted averages. Regional adjustments applied for currency conversion and market maturity factors. Competitive analysis based on feature parity scoring.'}
                         </p>
                       </div>
                     </div>
                  </section>

                  {/* Detailed Findings */}
                  <section>
                    <h2 className="text-lg font-semibold mb-4 border-b pb-2">Detailed Findings</h2>
                    
                    <div className="space-y-6">
                      {artefact.id === '1' && <>
                          <div>
                            <h3 className="font-medium mb-3">Pricing Structure & Feature Matrix</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full border border-muted text-sm">
                                <thead>
                                  <tr className="bg-muted/50">
                                    <th className="p-3 text-left border-r">Feature</th>
                                    <th className="p-3 text-center border-r">Competitor X SMB ($49/mo)</th>
                                    <th className="p-3 text-center border-r">Our Current ($59/mo)</th>
                                    <th className="p-3 text-center">Gap Analysis</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-t">
                                    <td className="p-3 border-r font-medium">API Calls/Month</td>
                                    <td className="p-3 text-center border-r">10,000</td>
                                    <td className="p-3 text-center border-r">15,000</td>
                                    <td className="p-3 text-center text-green-600">+50% advantage</td>
                                  </tr>
                                  <tr className="border-t bg-muted/20">
                                    <td className="p-3 border-r font-medium">Integrations</td>
                                    <td className="p-3 text-center border-r">25</td>
                                    <td className="p-3 text-center border-r">18</td>
                                    <td className="p-3 text-center text-red-600">-28% gap</td>
                                  </tr>
                                  <tr className="border-t">
                                    <td className="p-3 border-r font-medium">Advanced Analytics</td>
                                    <td className="p-3 text-center border-r">✓</td>
                                    <td className="p-3 text-center border-r">✓</td>
                                    <td className="p-3 text-center text-blue-600">Parity</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                          
                          <div>
                            <h3 className="font-medium mb-3">Pipeline Impact Analysis</h3>
                            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                              <p className="text-sm text-yellow-800 mb-2"><strong>Direct Overlap:</strong> 47 prospects in our pipeline match Competitor X's target profile</p>
                              <p className="text-sm text-yellow-800 mb-2"><strong>Risk Level:</strong> 12% of Q4 pipeline value ($2.3M ARR) potentially affected</p>
                              <p className="text-sm text-yellow-800"><strong>Competitive Deals:</strong> 8 active opportunities now include Competitor X in evaluation</p>
                            </div>
                          </div>
                        </>}
                      
                      {artefact.id === '2' && <>
                          <div>
                            <h3 className="font-medium mb-3">Lead Enrichment Results</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full border border-muted text-sm">
                                <thead>
                                  <tr className="bg-muted/50">
                                    <th className="p-3 text-left border-r">Metric</th>
                                    <th className="p-3 text-center border-r">Raw Input</th>
                                    <th className="p-3 text-center border-r">Enriched Output</th>
                                    <th className="p-3 text-center">Success Rate</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-t">
                                    <td className="p-3 border-r font-medium">Total Leads</td>
                                    <td className="p-3 text-center border-r">52</td>
                                    <td className="p-3 text-center border-r">47</td>
                                    <td className="p-3 text-center text-green-600">90%</td>
                                  </tr>
                                  <tr className="border-t bg-muted/20">
                                    <td className="p-3 border-r font-medium">Contact Accuracy</td>
                                    <td className="p-3 text-center border-r">Unknown</td>
                                    <td className="p-3 text-center border-r">94%</td>
                                    <td className="p-3 text-center text-green-600">Verified</td>
                                  </tr>
                                  <tr className="border-t">
                                    <td className="p-3 border-r font-medium">Decision Makers ID'd</td>
                                    <td className="p-3 text-center border-r">0</td>
                                    <td className="p-3 text-center border-r">41</td>
                                    <td className="p-3 text-center text-green-600">87%</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                          
                          <div>
                            <h3 className="font-medium mb-3">Geographic Distribution</h3>
                            <div className="grid md:grid-cols-3 gap-4">
                              <div className="bg-muted/30 p-4 rounded-lg text-center">
                                <p className="text-2xl font-bold text-primary">28</p>
                                <p className="text-sm text-muted-foreground">UK & Ireland</p>
                              </div>
                              <div className="bg-muted/30 p-4 rounded-lg text-center">
                                <p className="text-2xl font-bold text-primary">12</p>
                                <p className="text-sm text-muted-foreground">DACH Region</p>
                              </div>
                              <div className="bg-muted/30 p-4 rounded-lg text-center">
                                <p className="text-2xl font-bold text-primary">7</p>
                                <p className="text-sm text-muted-foreground">Nordics</p>
                              </div>
                            </div>
                          </div>
                        </>}
                      
                      {artefact.id === '4' && <>
                          <div>
                            <h3 className="font-medium mb-3">Market Size Breakdown</h3>
                            <div className="space-y-4">
                              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                                <h4 className="font-semibold text-blue-800 mb-2">Total Addressable Market (TAM)</h4>
                                <p className="text-3xl font-bold text-blue-900 mb-2">$47.2B</p>
                                <p className="text-sm text-blue-700">Global fintech software market including all segments and verticals</p>
                              </div>
                              
                              <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                                <h4 className="font-semibold text-purple-800 mb-2">Serviceable Addressable Market (SAM)</h4>
                                <p className="text-3xl font-bold text-purple-900 mb-2">$2.3B</p>
                                <p className="text-sm text-purple-700">Payment processing, lending, and API infrastructure solutions</p>
                              </div>
                              
                              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                                <h4 className="font-semibold text-green-800 mb-2">Serviceable Obtainable Market (SOM)</h4>
                                <p className="text-3xl font-bold text-green-900 mb-2">$180M</p>
                                <p className="text-sm text-green-700">Realistically achievable market share based on competitive analysis</p>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <h3 className="font-medium mb-3">Regional Market Distribution</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full border border-muted text-sm">
                                <thead>
                                  <tr className="bg-muted/50">
                                    <th className="p-3 text-left border-r">Region</th>
                                    <th className="p-3 text-center border-r">Market Size</th>
                                    <th className="p-3 text-center border-r">Growth Rate</th>
                                    <th className="p-3 text-center">Opportunity Score</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-t">
                                    <td className="p-3 border-r font-medium">North America</td>
                                    <td className="p-3 text-center border-r">$18.7B</td>
                                    <td className="p-3 text-center border-r">12.3%</td>
                                    <td className="p-3 text-center text-green-600">High</td>
                                  </tr>
                                  <tr className="border-t bg-muted/20">
                                    <td className="p-3 border-r font-medium">Europe</td>
                                    <td className="p-3 text-center border-r">$14.2B</td>
                                    <td className="p-3 text-center border-r">15.7%</td>
                                    <td className="p-3 text-center text-green-600">High</td>
                                  </tr>
                                  <tr className="border-t">
                                    <td className="p-3 border-r font-medium">Asia-Pacific</td>
                                    <td className="p-3 text-center border-r">$11.8B</td>
                                    <td className="p-3 text-center border-r">18.9%</td>
                                    <td className="p-3 text-center text-yellow-600">Medium</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>}
                    </div>
                  </section>
                </div>

                {/* Action Strip */}
                <div className="border-t bg-muted/10 px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="h-4 w-4" />
                      Export PDF
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Download CSV
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Share className="h-4 w-4" />
                      Share to Slack
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Linkedin className="h-4 w-4" />
                      Share LinkedIn Draft
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Mail className="h-4 w-4" />
                      Email to Colleague
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Create Task
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Bot className="h-4 w-4" />
                      Ask Agent
                    </Button>
                  </div>
                </div>
              </div>}
          </div>

          {/* 3. Output Tags */}
          <div className="flex flex-wrap gap-1">
            {artefact.tags.map((tag, index) => <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>)}
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
          

          {/* Action Buttons */}
          {artefact.status === 'pending' || artefact.status === 'needs-review'}

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