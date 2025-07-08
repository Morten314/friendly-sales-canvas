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
  MoreHorizontal,
  Edit,
  History,
  Trash2,
  Save,
  X
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  onScoutIconClick: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape' | 'regulatory-compliance', hasEdits?: boolean, lastEditedField?: string) => void;
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
            {hasEdits && (
              <div className="flex items-center space-x-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-md text-xs">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                <span>Unsaved changes</span>
              </div>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onToggleEdit} className="flex items-center">
                  <Edit className="h-4 w-4 mr-2" />
                  {isEditing ? 'Exit Edit Mode' : 'Edit Section'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEditHistoryOpen} className="flex items-center">
                  <History className="h-4 w-4 mr-2" />
                  Edit History ({editHistory.length})
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onScoutIconClick('regulatory-compliance', hasEdits)}
                  className="flex items-center"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Re-analyze with Scout
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDeleteSection('regulatory-compliance')}
                  className="flex items-center text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Section
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isEditing && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
            <div className="flex items-center space-x-2">
              <Edit className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Edit Mode Active</span>
            </div>
            <div className="flex space-x-2">
              <Button onClick={onSaveChanges} size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Save className="h-3 w-3 mr-1" />
                Save Changes
              </Button>
              <Button onClick={onCancelEdit} variant="outline" size="sm">
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Executive Summary */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Executive Summary</h4>
          {isEditing ? (
            <textarea
              value={executiveSummary}
              onChange={(e) => onExecutiveSummaryChange(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none"
              rows={3}
              placeholder="Enter executive summary..."
            />
          ) : (
            <p className="text-gray-600 text-sm leading-relaxed">
              {executiveSummary}
            </p>
          )}
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
                      {isEditing ? (
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
                      ) : (
                        <p className="text-sm text-gray-600">{point.value}</p>
                      )}
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

        {/* Read More / Collapse Button */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => onExpandToggle(!isExpanded)}
            variant="outline"
            className="flex items-center space-x-2 text-sm"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                <span>Show Less</span>
              </>
            ) : (
              <>
                <span>Read More</span>
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="space-y-6 pt-6 border-t border-gray-200">
            {/* Regional Breakdown */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Regional Compliance Overview</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h5 className="font-medium text-blue-900 mb-2">Europe (GDPR)</h5>
                  <p className="text-sm text-blue-700">Strict data protection with hefty fines</p>
                  <div className="mt-2">
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">Active</span>
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h5 className="font-medium text-green-900 mb-2">US (CCPA)</h5>
                  <p className="text-sm text-green-700">California privacy rights expansion</p>
                  <div className="mt-2">
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Evolving</span>
                  </div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h5 className="font-medium text-purple-900 mb-2">China</h5>
                  <p className="text-sm text-purple-700">Data localization requirements</p>
                  <div className="mt-2">
                    <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">Mandatory</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Strategic Recommendations */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Strategic Recommendations</h4>
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h5 className="font-medium text-gray-900">Implement Privacy by Design</h5>
                    <p className="text-sm text-gray-600">Build compliance into your product architecture from the ground up</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h5 className="font-medium text-gray-900">Regional Data Strategy</h5>
                    <p className="text-sm text-gray-600">Develop multi-region deployment capabilities for data residency requirements</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h5 className="font-medium text-gray-900">Compliance Monitoring</h5>
                    <p className="text-sm text-gray-600">Establish automated monitoring for regulatory changes and compliance status</p>
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

export default RegulatoryComplianceSection;
