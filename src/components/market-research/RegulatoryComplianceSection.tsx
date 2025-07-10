import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Scale, 
  Shield, 
  FileText, 
  Globe, 
  AlertTriangle,
  CheckCircle,
  Calendar,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  Save,
  X,
  Clock,
  Target,
  Users,
  Building,
  Share,
  Bot,
  MessageSquare
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EditRecord } from './types';

interface RegulatoryComplianceSectionProps {
  isEditing: boolean;
  isSplitView: boolean;
  isExpanded: boolean;
  hasEdits: boolean;
  deletedSections: Set<string>;
  editHistory: EditRecord[];
  executiveSummary: string;
  euAiActDeadline: string;
  gdprCompliance: string;
  potentialFines: string;
  dataLocalization: string;
  onToggleEdit: () => void;
  onScoutIconClick: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape' | 'regulatory-compliance', hasEdits?: boolean, customMessage?: string) => void;
  onEditHistoryOpen: () => void;
  onDeleteSection: (sectionId: string) => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onExpandToggle: (expanded: boolean) => void;
  onExecutiveSummaryChange: (value: string) => void;
  onEuAiActDeadlineChange: (value: string) => void;
  onGdprComplianceChange: (value: string) => void;
  onPotentialFinesChange: (value: string) => void;
  onDataLocalizationChange: (value: string) => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
}

const RegulatoryComplianceSection: React.FC<RegulatoryComplianceSectionProps> = ({
  isEditing,
  isSplitView,
  isExpanded,
  hasEdits,
  deletedSections,
  editHistory,
  executiveSummary,
  euAiActDeadline,
  gdprCompliance,
  potentialFines,
  dataLocalization,
  onToggleEdit,
  onScoutIconClick,
  onEditHistoryOpen,
  onDeleteSection,
  onSaveChanges,
  onCancelEdit,
  onExpandToggle,
  onExecutiveSummaryChange,
  onEuAiActDeadlineChange,
  onGdprComplianceChange,
  onPotentialFinesChange,
  onDataLocalizationChange,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink
}) => {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  if (deletedSections.has('regulatory-compliance')) {
    return null;
  }

  const keyDataPoints = [
    {
      id: 'eu-ai-act',
      icon: Scale,
      title: 'EU AI Act enforcement starts Q1 2026',
      value: euAiActDeadline,
      badge: 'New',
      badgeColor: 'bg-blue-100 text-blue-800',
      tooltip: 'New European AI Act comes into effect with strict compliance requirements for AI systems.'
    },
    {
      id: 'gdpr-compliance',
      icon: Shield,
      title: 'GDPR compliance among SaaS providers',
      value: gdprCompliance,
      badge: 'Update',
      badgeColor: 'bg-yellow-100 text-yellow-800',
      tooltip: 'Current adoption rates show varying levels of GDPR compliance across different SaaS categories.'
    },
    {
      id: 'potential-fines',
      icon: AlertTriangle,
      title: 'Potential fines: up to 6% revenue',
      value: potentialFines,
      badge: 'Risk',
      badgeColor: 'bg-red-100 text-red-800',
      tooltip: 'Maximum penalty levels for non-compliance with major data protection regulations.'
    },
    {
      id: 'data-localization',
      icon: Globe,
      title: 'China data localization laws impacting global SaaS',
      value: dataLocalization,
      badge: 'High Priority',
      badgeColor: 'bg-purple-100 text-purple-800',
      tooltip: 'New data residency requirements affecting international SaaS deployment strategies.'
    }
  ];

  const visualDataCards = [
    {
      title: 'Compliance Adoption Rates',
      type: 'bar-chart',
      data: [
        { name: 'GDPR', value: 68, color: '#10b981' },
        { name: 'CCPA', value: 45, color: '#3b82f6' },
        { name: 'SOC 2', value: 72, color: '#8b5cf6' },
        { name: 'ISO 27001', value: 38, color: '#f59e0b' }
      ]
    },
    {
      title: 'Regulatory Timeline',
      type: 'timeline',
      data: [
        { date: 'Q1 2025', event: 'EU AI Act Phase 1', status: 'upcoming' },
        { date: 'Q3 2025', event: 'GDPR Updates', status: 'upcoming' },
        { date: 'Q1 2026', event: 'EU AI Act Full Enforcement', status: 'critical' }
      ]
    },
    {
      title: 'Risk Indicators',
      type: 'percentage',
      data: [
        { metric: 'Data Breach Risk', value: 23, trend: 'down' },
        { metric: 'Non-compliance Penalties', value: 15, trend: 'up' },
        { metric: 'Audit Readiness', value: 67, trend: 'up' }
      ]
    }
  ];

  const regionalData = [
    {
      region: 'European Union',
      framework: 'GDPR + AI Act',
      deadline: 'Q1 2026',
      impact: 'High',
      status: 'Active',
      requirements: 'Data protection, AI governance'
    },
    {
      region: 'United States',
      framework: 'CCPA + State Laws',
      deadline: 'Ongoing',
      impact: 'Medium',
      status: 'Evolving',
      requirements: 'Privacy rights, data handling'
    },
    {
      region: 'China',
      framework: 'PIPL + Cybersecurity Law',
      deadline: 'Active',
      impact: 'High',
      status: 'Mandatory',
      requirements: 'Data localization, security'
    },
    {
      region: 'United Kingdom',
      framework: 'UK GDPR + DPA',
      deadline: 'Active',
      impact: 'Medium',
      status: 'Active',
      requirements: 'Data protection, transfers'
    }
  ];

  return (
    <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <FileText className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                Regulatory & Compliance Highlights
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Current regulatory landscape and compliance requirements
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            
            {/* Edit Icon */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={onToggleEdit}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isEditing ? 'Exit Edit Mode' : 'Edit Section'}</p>
              </TooltipContent>
            </Tooltip>

            {/* Scout Chat Icon */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 relative hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200"
                  onClick={() => onScoutIconClick('regulatory-compliance', hasEdits)}
                >
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-purple-400/20 animate-pulse opacity-75"></div>
                  <Bot className="h-4 w-4 relative z-10 text-blue-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Explore More with Scout</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

      </CardHeader>

      <CardContent className="space-y-6">
        {isEditing ? (
          /* Full Editable Report Mode */
          <div className="space-y-8">
            {/* Executive Summary */}
            {!deletedSections.has('executive-summary') && (
              <div className="relative group border border-gray-200 rounded-lg p-4">
                <button
                  onClick={() => {
                    onDeleteSection('executive-summary');
                    onScoutIconClick('regulatory-compliance', true, 'I noticed you removed the Executive Summary. Want me to help refine or replace it?');
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Executive Summary</h4>
                <textarea
                  value={executiveSummary}
                  onChange={(e) => onExecutiveSummaryChange(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none"
                  rows={4}
                  placeholder="Enter executive summary..."
                />
              </div>
            )}

            {/* Key Regulatory Updates */}
            {!deletedSections.has('key-updates') && (
              <div className="relative group border border-gray-200 rounded-lg p-4">
                <button
                  onClick={() => {
                    onDeleteSection('key-updates');
                    onScoutIconClick('regulatory-compliance', true, 'I noticed you removed the Key Regulatory Updates. Want me to help refine or replace it?');
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Key Regulatory Updates</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {keyDataPoints.map((point) => {
                    const IconComponent = point.icon;
                    return (
                      <div key={point.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <IconComponent className="h-4 w-4 text-gray-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <h5 className="text-sm font-medium text-gray-900 leading-tight">
                                {point.title}
                              </h5>
                              <Badge className={`${point.badgeColor} text-xs`}>
                                {point.badge}
                              </Badge>
                            </div>
                            <input
                              type="text"
                              value={point.value}
                              onChange={(e) => {
                                if (point.id === 'eu-ai-act') onEuAiActDeadlineChange(e.target.value);
                                else if (point.id === 'gdpr-compliance') onGdprComplianceChange(e.target.value);
                                else if (point.id === 'potential-fines') onPotentialFinesChange(e.target.value);
                                else if (point.id === 'data-localization') onDataLocalizationChange(e.target.value);
                              }}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Compliance Analytics */}
            {!deletedSections.has('compliance-analytics') && (
              <div className="relative group border border-gray-200 rounded-lg p-4">
                <button
                  onClick={() => {
                    onDeleteSection('compliance-analytics');
                    onScoutIconClick('regulatory-compliance', true, 'I noticed you removed the Compliance Analytics. Want me to help refine or replace it?');
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
                <h4 className="text-sm font-medium text-gray-700 mb-4">Compliance Analytics</h4>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Compliance Adoption Rates - Bar Chart */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Users className="h-4 w-4 mr-2 text-blue-600" />
                      Compliance Adoption Rates
                    </h5>
                    <div className="space-y-3">
                      {visualDataCards[0].data.map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">{item.name}</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full">
                              <div 
                                className="h-2 rounded-full" 
                                style={{ 
                                  width: `${item.value}%`, 
                                  backgroundColor: item.color 
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-900">{item.value}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Regulatory Timeline */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-orange-600" />
                      Regulatory Timeline
                    </h5>
                    <div className="space-y-3">
                      {visualDataCards[1].data.map((item, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            item.status === 'critical' ? 'bg-red-500' : 'bg-blue-500'
                          }`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{item.event}</p>
                            <p className="text-xs text-gray-500">{item.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Risk Indicators */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                      Risk Indicators
                    </h5>
                    <div className="space-y-3">
                      {visualDataCards[2].data.map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">{item.metric}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">{item.value}%</span>
                            <TrendingUp className={`h-3 w-3 ${
                              item.trend === 'up' ? 'text-green-600' : 'text-red-600'
                            } ${item.trend === 'down' ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Regional Breakdown */}
            {!deletedSections.has('regional-breakdown') && (
              <div className="relative group border border-gray-200 rounded-lg p-4">
                <button
                  onClick={() => {
                    onDeleteSection('regional-breakdown');
                    onScoutIconClick('regulatory-compliance', true, 'I noticed you removed the Regional Compliance Overview. Want me to help refine or replace it?');
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
                <h4 className="text-sm font-medium text-gray-700 mb-4">Regional Compliance Overview</h4>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-medium">Region</TableHead>
                        <TableHead className="font-medium">Framework</TableHead>
                        <TableHead className="font-medium">Deadline</TableHead>
                        <TableHead className="font-medium">Impact</TableHead>
                        <TableHead className="font-medium">Status</TableHead>
                        <TableHead className="font-medium">Key Requirements</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {regionalData.map((region, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{region.region}</TableCell>
                          <TableCell>{region.framework}</TableCell>
                          <TableCell>{region.deadline}</TableCell>
                          <TableCell>
                            <Badge className={`${
                              region.impact === 'High' ? 'bg-red-100 text-red-800' :
                              region.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {region.impact}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${
                              region.status === 'Active' || region.status === 'Mandatory' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {region.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">{region.requirements}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Strategic Recommendations */}
            {!deletedSections.has('strategic-recommendations') && (
              <div className="relative group border border-gray-200 rounded-lg p-4">
                <button
                  onClick={() => {
                    onDeleteSection('strategic-recommendations');
                    onScoutIconClick('regulatory-compliance', true, 'I noticed you removed the Strategic Recommendations. Want me to help refine or replace it?');
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
                <h4 className="text-sm font-medium text-gray-700 mb-4">Strategic Recommendations</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <h5 className="font-medium text-blue-900 mb-2">Mitigate Regulatory Risks</h5>
                        <ul className="text-sm text-blue-700 space-y-1">
                          <li>• Implement privacy by design principles</li>
                          <li>• Establish automated compliance monitoring</li>
                          <li>• Regular risk assessments and audits</li>
                          <li>• Cross-functional compliance team</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Target className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <h5 className="font-medium text-green-900 mb-2">Competitive Positioning</h5>
                        <ul className="text-sm text-green-700 space-y-1">
                          <li>• Market compliance as differentiator</li>
                          <li>• Showcase security certifications</li>
                          <li>• Transparent data handling practices</li>
                          <li>• Industry-leading privacy standards</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Building className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div>
                        <h5 className="font-medium text-purple-900 mb-2">Go-to-Market Strategy</h5>
                        <ul className="text-sm text-purple-700 space-y-1">
                          <li>• Regional deployment capabilities</li>
                          <li>• Compliance-ready product offerings</li>
                          <li>• Legal-friendly contract templates</li>
                          <li>• Enterprise-grade data residency</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save/Cancel buttons and Edit History - positioned at bottom */}
            <div className="flex justify-between items-center pt-6 border-t border-gray-200">
              <div className="flex gap-3">
                <Button 
                  onClick={onSaveChanges}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
                <Button 
                  variant="outline" 
                  onClick={onCancelEdit}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
              
              {/* Edit History Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={onEditHistoryOpen}
                className="flex items-center gap-2 hover:bg-gray-50"
                title="View changes made to this report"
              >
                <Clock className="h-4 w-4" />
                Edit History
              </Button>
            </div>
          </div>
        ) : (
          /* Normal View Mode */
          <>
            {/* Executive Summary */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Executive Summary</h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                {executiveSummary}
              </p>
            </div>

            {/* Key Data Points */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Key Regulatory Updates</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {keyDataPoints.map((point) => {
                  const IconComponent = point.icon;
                  return (
                    <div
                      key={point.id}
                      className="relative p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-pointer"
                      onMouseEnter={() => setHoveredCard(point.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <IconComponent className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="text-sm font-medium text-gray-900 leading-tight">
                              {point.title}
                            </h5>
                            <Badge className={`${point.badgeColor} text-xs`}>
                              {point.badge}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{point.value}</p>
                        </div>
                      </div>

                      {/* Tooltip */}
                      {hoveredCard === point.id && (
                        <div className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg max-w-xs">
                          <p>{point.tooltip}</p>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Read More Button - Only when not expanded */}
            {!isExpanded && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => onExpandToggle(true)}
                  variant="outline"
                  className="flex items-center space-x-2 text-sm"
                >
                  <span>Read More</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Enhanced Expanded Content */}
            {isExpanded && (
              <div className="space-y-8 pt-6 border-t border-gray-200">
                {/* Visual Data Cards */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-4">Compliance Analytics</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Compliance Adoption Rates - Bar Chart */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                        <Users className="h-4 w-4 mr-2 text-blue-600" />
                        Compliance Adoption Rates
                      </h5>
                      <div className="space-y-3">
                        {visualDataCards[0].data.map((item, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{item.name}</span>
                            <div className="flex items-center space-x-2">
                              <div className="w-16 h-2 bg-gray-200 rounded-full">
                                <div 
                                  className="h-2 rounded-full" 
                                  style={{ 
                                    width: `${item.value}%`, 
                                    backgroundColor: item.color 
                                  }}
                                />
                              </div>
                              <span className="text-sm font-medium text-gray-900">{item.value}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Regulatory Timeline */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-orange-600" />
                        Regulatory Timeline
                      </h5>
                      <div className="space-y-3">
                        {visualDataCards[1].data.map((item, index) => (
                          <div key={index} className="flex items-start space-x-3">
                            <div className={`w-2 h-2 rounded-full mt-2 ${
                              item.status === 'critical' ? 'bg-red-500' : 'bg-blue-500'
                            }`} />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{item.event}</p>
                              <p className="text-xs text-gray-500">{item.date}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Risk Indicators */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                        Risk Indicators
                      </h5>
                      <div className="space-y-3">
                        {visualDataCards[2].data.map((item, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{item.metric}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-900">{item.value}%</span>
                              <TrendingUp className={`h-3 w-3 ${
                                item.trend === 'up' ? 'text-green-600' : 'text-red-600'
                              } ${item.trend === 'down' ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Regional Breakdown */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-4">Regional Compliance Overview</h4>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-medium">Region</TableHead>
                          <TableHead className="font-medium">Framework</TableHead>
                          <TableHead className="font-medium">Deadline</TableHead>
                          <TableHead className="font-medium">Impact</TableHead>
                          <TableHead className="font-medium">Status</TableHead>
                          <TableHead className="font-medium">Key Requirements</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {regionalData.map((region, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{region.region}</TableCell>
                            <TableCell>{region.framework}</TableCell>
                            <TableCell>{region.deadline}</TableCell>
                            <TableCell>
                              <Badge className={`${
                                region.impact === 'High' ? 'bg-red-100 text-red-800' :
                                region.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {region.impact}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${
                                region.status === 'Active' || region.status === 'Mandatory' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {region.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">{region.requirements}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Strategic Recommendations */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-4">Strategic Recommendations</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <h5 className="font-medium text-blue-900 mb-2">Mitigate Regulatory Risks</h5>
                          <ul className="text-sm text-blue-700 space-y-1">
                            <li>• Implement privacy by design principles</li>
                            <li>• Establish automated compliance monitoring</li>
                            <li>• Regular risk assessments and audits</li>
                            <li>• Cross-functional compliance team</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Target className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <h5 className="font-medium text-green-900 mb-2">Competitive Positioning</h5>
                          <ul className="text-sm text-green-700 space-y-1">
                            <li>• Market compliance as differentiator</li>
                            <li>• Showcase security certifications</li>
                            <li>• Transparent data handling practices</li>
                            <li>• Industry-leading privacy standards</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Building className="h-5 w-5 text-purple-600 mt-0.5" />
                        <div>
                          <h5 className="font-medium text-purple-900 mb-2">Go-to-Market Strategy</h5>
                          <ul className="text-sm text-purple-700 space-y-1">
                            <li>• Regional deployment capabilities</li>
                            <li>• Compliance-ready product offerings</li>
                            <li>• Legal-friendly contract templates</li>
                            <li>• Enterprise-grade data residency</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Export Options */}
                <div className="border-t pt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Export Options</h4>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" size="sm" onClick={onExportPDF} className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Save PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={onSaveToWorkspace} className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      Save to Workspace
                    </Button>
                    <Button variant="outline" size="sm" onClick={onGenerateShareableLink} className="flex items-center gap-2">
                      <Share className="h-4 w-4" />
                      Shareable Link
                    </Button>
                  </div>
                </div>

                {/* Show Less Button - Only when not in split view */}
                {!isSplitView && (
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={() => onExpandToggle(false)}
                      variant="outline"
                      className="flex items-center space-x-2 text-sm"
                    >
                      <span>Show Less</span>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RegulatoryComplianceSection;
