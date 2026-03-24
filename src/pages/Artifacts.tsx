import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FileText, TrendingUp, Users, Target, BarChart, Clock, AlertCircle, CheckCircle, Lightbulb, Download, Bot, Edit, Trash2, FolderOpen, ChevronRight, Mail } from 'lucide-react';

interface ArtefactItem {
  id: string;
  agentName: string;
  agentIcon: string;
  agentColor: string;
  taskNumber: string;
  timestamp: string;
  status: 'new' | 'viewed' | 'updated';
  type: 'report' | 'analysis' | 'insight' | 'proposal' | 'enrichment' | 'playbook';
  actionDelegated: string;
  contextRationale: string;
  systemImpact: string;
  actionPerformed: string;
  outputSummary: string;
  fullReport: {
    title: string;
    executiveSummary: string;
    keyFindings: string[];
    analysis: string;
    recommendations: string[];
    charts?: string[];
  };
}

// Mock data for demonstration
const mockArtefacts: ArtefactItem[] = [
  {
    id: '1',
    agentName: 'Scout',
    agentIcon: '🛰',
    agentColor: 'bg-blue-500',
    taskNumber: 'SCT-2024-001',
    timestamp: '2h ago',
    status: 'new',
    type: 'analysis',
    actionDelegated: 'Scout, analyze Competitor X\'s SMB pricing tier',
    contextRationale: 'Because your ICP includes Mid-Market SaaS in Healthcare, this action was prioritized',
    systemImpact: 'Competitive pricing benchmark updated with new SMB tier recommendations',
    actionPerformed: 'Researched Competitor X\'s new SMB pricing model across 12 different SaaS platforms and analyzed pricing structures',
    outputSummary: 'Comprehensive pricing analysis revealing 23% pricing gap in mid-market segment',
    fullReport: {
      title: 'Competitor X — SMB Pricing Launch: Detailed Impact Analysis',
      executiveSummary: 'Competitor X launched new SMB pricing tiers targeting mid-market SaaS companies in Healthcare vertical, directly competing with our core ICP segment. Analysis reveals 23% pricing gap in our favor across comparable feature sets.',
      keyFindings: [
        '23% pricing gap identified in our favor across comparable feature sets',
        'Competitor targets same healthcare SaaS segment with 47% feature overlap',
        'Limited geographic reach (US only) vs our global presence advantage',
        '12% of our pipeline directly affected by this competitive move'
      ],
      analysis: 'The competitive analysis shows Competitor X is aggressively targeting our core market segment. However, our analysis reveals several strategic advantages including global presence, superior feature set, and established market relationships.',
      recommendations: [
        'Implement competitive pricing response within 2 weeks',
        'Enhance enterprise features to justify premium positioning',
        'Accelerate European market expansion to leverage geographic advantage',
        'Develop counter-positioning campaign highlighting our global capabilities'
      ]
    }
  },
  {
    id: '2',
    agentName: 'Profiler',
    agentIcon: '🎯',
    agentColor: 'bg-purple-500',
    taskNumber: 'PRF-2024-028',
    timestamp: '4h ago',
    status: 'viewed',
    type: 'enrichment',
    actionDelegated: 'Profiler, enrich ICP with EU fintech startup leads',
    contextRationale: 'Expansion into European markets requires updated ICP profiles for fintech vertical',
    systemImpact: 'Added 47 new enriched leads to CRM with automated nurture sequences activated',
    actionPerformed: 'Enriched 52 raw leads with verified contact details and behavioral data analysis',
    outputSummary: 'Successfully enriched 47 qualified leads with 94% contact accuracy',
    fullReport: {
      title: 'EU Fintech ICP Enrichment: Lead Intelligence Report',
      executiveSummary: 'European market expansion requires qualified fintech startup leads with verified contact data and behavioral insights for targeted outreach campaigns. Successfully enriched 47 qualified leads from 52 raw records.',
      keyFindings: [
        '47 qualified leads enriched from 52 raw records (90% success rate)',
        '94% contact accuracy achieved through multi-source verification',
        '73% of leads are Series A-B stage with strong payment infrastructure needs',
        'Average company size: 50-200 employees with $2-10M ARR'
      ],
      analysis: 'The enrichment process revealed high-quality fintech startups across key European markets, with strong concentration in London, Berlin, and Amsterdam. Most companies show clear payment processing and compliance needs.',
      recommendations: [
        'Prioritize Series A companies for immediate outreach',
        'Focus on companies using Stripe or similar payment processors',
        'Target CTOs and Head of Engineering roles for technical decisions',
        'Develop region-specific compliance messaging for EU market'
      ]
    }
  },
  {
    id: '3',
    agentName: 'Scout',
    agentIcon: '🛰',
    agentColor: 'bg-blue-500',
    taskNumber: 'SCT-2024-045',
    timestamp: '2d ago',
    status: 'updated',
    type: 'analysis',
    actionDelegated: 'Scout, calculate TAM/SAM/SOM for fintech vertical expansion',
    contextRationale: 'Required for investor presentations and strategic planning discussions',
    systemImpact: 'Market analysis integrated into strategic planning dashboard for investor deck preparation',
    actionPerformed: 'Analyzed addressable market size for fintech vertical with detailed TAM, SAM, and SOM breakdowns',
    outputSummary: 'Market analysis showing $47B TAM, $2.3B SAM, and $180M SOM for target segments',
    fullReport: {
      title: 'Fintech Vertical Market Sizing: TAM/SAM/SOM Analysis',
      executiveSummary: 'Comprehensive market sizing analysis for fintech vertical expansion, providing detailed TAM, SAM, and SOM calculations with geographic breakdown and competitive landscape assessment.',
      keyFindings: [
        'Total Addressable Market (TAM): $47B globally',
        'Serviceable Addressable Market (SAM): $2.3B in target regions',
        'Serviceable Obtainable Market (SOM): $180M realistic capture',
        'Payment processing represents 42% of addressable opportunity'
      ],
      analysis: 'The fintech vertical shows strong growth potential with increasing digitization and regulatory support. Key opportunities lie in payment processing, lending software, and compliance automation.',
      recommendations: [
        'Focus on $180M serviceable obtainable market initially',
        'Prioritize payment processing and lending software segments',
        'Consider geographic expansion to DACH region within 18 months',
        'Develop partnerships with existing fintech infrastructure providers'
      ]
    }
  }
];

const Artefacts = () => {
  usePageTitle('Artefacts - Brewra');
  const [artefacts, setArtefacts] = useState<ArtefactItem[]>(mockArtefacts);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedArtefact, setExpandedArtefact] = useState<string | null>(null);
  const [editingArtefact, setEditingArtefact] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Listen for search events from header
  useEffect(() => {
    const handleSearch = (event: CustomEvent) => {
      setSearchQuery(event.detail.query);
    };

    window.addEventListener('artifactsSearch', handleSearch as EventListener);
    return () => {
      window.removeEventListener('artifactsSearch', handleSearch as EventListener);
    };
  }, []);

  // Listen for new artefacts from Strategist or other agents
  useEffect(() => {
    const handleAddArtefact = (event: CustomEvent) => {
      const newArtefact = event.detail as ArtefactItem;
      setArtefacts(prev => [newArtefact, ...prev]);
      setExpandedArtefact(newArtefact.id);
    };

    window.addEventListener('addArtefact', handleAddArtefact as EventListener);
    return () => {
      window.removeEventListener('addArtefact', handleAddArtefact as EventListener);
    };
  }, []);

  const filteredArtefacts = artefacts.filter(artefact => 
    artefact.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    artefact.taskNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    artefact.actionDelegated.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleArtefactClick = (id: string) => {
    setExpandedArtefact(expandedArtefact === id ? null : id);
  };

  const handleEditClick = (artefact: ArtefactItem, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setEditingArtefact(artefact.id);
    setEditName(artefact.fullReport.title);
  };

  const handleDeleteClick = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setArtefacts(prev => prev.filter(artefact => artefact.id !== id));
  };

  const handleSaveEdit = (id: string) => {
    setArtefacts(prev => prev.map(artefact => 
      artefact.id === id 
        ? { ...artefact, fullReport: { ...artefact.fullReport, title: editName } }
        : artefact
    ));
    setEditingArtefact(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingArtefact(null);
    setEditName('');
  };

  const handleDownloadClick = (artefact: ArtefactItem) => {
    // Mark as viewed if it was new
    if (artefact.status === 'new') {
      setArtefacts(prev => prev.map(a => a.id === artefact.id ? { ...a, status: 'viewed' as const } : a));
    }
    
    // Generate and download PDF
    generateAndDownloadPDF(artefact);
  };

  const generateAndDownloadPDF = (artefact: ArtefactItem) => {
    // Create a simple PDF using jsPDF-like approach
    const pdfContent = createSimplePDF(artefact);
    
    // Create a blob with PDF content
    const blob = new Blob([pdfContent], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link element and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `${artefact.fullReport.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
  };

  const createSimplePDF = (artefact: ArtefactItem) => {
    // Create a minimal PDF structure
    const title = artefact.fullReport.title;
    const agentName = artefact.agentName;
    const timestamp = artefact.timestamp;
    const taskId = artefact.taskNumber;
    const executiveSummary = artefact.fullReport.executiveSummary;
    const keyFindings = artefact.fullReport.keyFindings;
    const analysis = artefact.fullReport.analysis;
    const recommendations = artefact.fullReport.recommendations;
    const date = new Date().toLocaleDateString();

    // Simple PDF content structure
    const pdfData = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
/F2 6 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length 2000
>>
stream
BT
/F1 16 Tf
50 750 Td
(${title}) Tj
0 -30 Td
/F2 10 Tf
(Generated by: ${agentName} | ${timestamp} | Task ID: ${taskId}) Tj
0 -40 Td
/F1 14 Tf
(EXECUTIVE SUMMARY) Tj
0 -20 Td
/F2 10 Tf
(${executiveSummary}) Tj
0 -40 Td
/F1 14 Tf
(KEY FINDINGS) Tj
0 -20 Td
/F2 10 Tf
${keyFindings.map((finding, index) => `(${index + 1}. ${finding}) Tj 0 -15 Td`).join('\n')}
0 -20 Td
/F1 14 Tf
(ANALYSIS) Tj
0 -20 Td
/F2 10 Tf
(${analysis}) Tj
0 -40 Td
/F1 14 Tf
(RECOMMENDATIONS) Tj
0 -20 Td
/F2 10 Tf
${recommendations.map((rec, index) => `(${index + 1}. ${rec}) Tj 0 -15 Td`).join('\n')}
0 -40 Td
/F2 8 Tf
(Generated by Brewra AI • ${date}) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica-Bold
>>
endobj

6 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000002000 00000 n 
0000002500 00000 n 
trailer
<<
/Size 7
/Root 1 0 R
>>
startxref
3000
%%EOF`;

    return pdfData;
  };

  const getTypeIcon = (type: ArtefactItem['type']) => {
    switch (type) {
      case 'report': return FileText;
      case 'analysis': return TrendingUp;
      case 'insight': return Target;
      case 'proposal': return BarChart;
      case 'enrichment': return Users;
      case 'playbook': return Target;
      default: return FileText;
    }
  };

  const getStatusIcon = (status: ArtefactItem['status']) => {
    switch (status) {
      case 'new': return <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />;
      case 'viewed': return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'updated': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return null;
    }
  };

  // Library Card Component (Compact view)
  const LibraryCard = ({ artefact }: { artefact: ArtefactItem }) => {
    const TypeIcon = getTypeIcon(artefact.type);
    const isExpanded = expandedArtefact === artefact.id;
    const isEditing = editingArtefact === artefact.id;

    return (
      <Card className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${isExpanded ? 'ring-2 ring-primary/20' : ''}`}>
        <CardContent className="p-4">
          {/* Library View - Compact */}
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className={`text-white text-sm font-medium ${artefact.agentColor}`}>
                {artefact.agentIcon}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{artefact.agentName}</span>
                <TypeIcon className="h-3 w-3 text-muted-foreground" />
                {getStatusIcon(artefact.status)}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{artefact.taskNumber}</span>
                <span>•</span>
                <Clock className="h-3 w-3" />
                <span>{artefact.timestamp}</span>
              </div>
            </div>
            {/* Edit and Delete Icons */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleEditClick(artefact, e)}
                className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleDeleteClick(artefact.id, e)}
                className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-sm font-semibold"
                placeholder="Enter report title"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleSaveEdit(artefact.id)}
                  className="h-6 px-2 text-xs"
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdit}
                  className="h-6 px-2 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button 
              variant="ghost" 
              className="w-full justify-start p-0 h-auto font-normal"
              onClick={() => handleArtefactClick(artefact.id)}
            >
              <span className="text-sm text-left truncate">
                {artefact.actionDelegated}
              </span>
            </Button>
          )}

          {/* Expanded View */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t space-y-4">
              {/* Context & Rationale */}
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-700 mb-1">Context & Rationale</p>
                  <p className="text-sm text-muted-foreground">{artefact.contextRationale}</p>
                </div>
              </div>

              {/* System Impact */}
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 mb-1">System Impact</p>
                  <p className="text-sm text-muted-foreground">{artefact.systemImpact}</p>
                </div>
              </div>

              {/* Action Performed - File Preview */}
                 <div className="space-y-3">
                 <div className="flex items-center gap-2">
                   <FileText className="h-4 w-4 text-primary" />
                   <h4 className="font-semibold text-sm">Action Performed</h4>
                 </div>
                 
                 <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-4">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-sm">
                       <FileText className="h-5 w-5 text-white" />
                     </div>
                     <div className="flex-1 min-w-0">
                       <h3 
                         className="font-semibold text-sm mb-1 hover:text-primary transition-colors cursor-pointer truncate"
                         onClick={() => handleDownloadClick(artefact)}
                       >
                         {artefact.fullReport.title}
                       </h3>
                       <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                         {artefact.outputSummary}
                       </p>
                       <div className="flex items-center gap-2 text-xs text-muted-foreground">
                         <span>PDF • 12 pages</span>
                         <span>•</span>
                         <span>{artefact.timestamp}</span>
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header - Content moved to main header */}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Artefacts</p>
                  <p className="text-2xl font-bold">{artefacts.length}</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">New</p>
                  <p className="text-2xl font-bold">{artefacts.filter(a => a.status === 'new').length}</p>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Viewed</p>
                  <p className="text-2xl font-bold">{artefacts.filter(a => a.status === 'viewed').length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Updated</p>
                  <p className="text-2xl font-bold">{artefacts.filter(a => a.status === 'updated').length}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Artefacts Library */}
        <div className="space-y-4">
          {filteredArtefacts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No artefacts found</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? 'Try adjusting your search query' : 'Your agents will generate artefacts as they complete tasks'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredArtefacts.map((artefact) => (
              <LibraryCard key={artefact.id} artefact={artefact} />
            ))
          )}
        </div>
      </div>

    </Layout>
  );
};

export default Artefacts;