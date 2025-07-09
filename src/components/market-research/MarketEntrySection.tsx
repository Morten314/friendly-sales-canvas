import React from 'react';
import { MapPin, Bot, Edit, Target, Clock, AlertTriangle, X, FileText, Save, Share, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EditRecord } from './types';

interface MarketEntrySectionProps {
  isEditing: boolean;
  isSplitView: boolean;
  isExpanded: boolean;
  hasEdits: boolean;
  deletedSections: Set<string>;
  editHistory: EditRecord[];
  executiveSummary: string;
  entryBarriers: string[];
  recommendedChannel: string;
  timeToMarket: string;
  topBarrier: string;
  competitiveDifferentiation: string[];
  strategicRecommendations: string[];
  riskAssessment: string[];
  onToggleEdit: () => void;
  onScoutIconClick: (context?: 'market-entry') => void;
  onEditHistoryOpen: () => void;
  onDeleteSection: (sectionId: string) => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onExpandToggle: (expanded: boolean) => void;
  onExecutiveSummaryChange: (value: string) => void;
  onEntryBarriersChange: (barriers: string[]) => void;
  onRecommendedChannelChange: (value: string) => void;
  onTimeToMarketChange: (value: string) => void;
  onTopBarrierChange: (value: string) => void;
  onCompetitiveDifferentiationChange: (differentiation: string[]) => void;
  onStrategicRecommendationsChange: (recommendations: string[]) => void;
  onRiskAssessmentChange: (risks: string[]) => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
}

const MarketEntrySection: React.FC<MarketEntrySectionProps> = ({
  isEditing,
  isSplitView,
  isExpanded,
  hasEdits,
  deletedSections,
  editHistory,
  executiveSummary,
  entryBarriers,
  recommendedChannel,
  timeToMarket,
  topBarrier,
  competitiveDifferentiation,
  strategicRecommendations,
  riskAssessment,
  onToggleEdit,
  onScoutIconClick,
  onEditHistoryOpen,
  onDeleteSection,
  onSaveChanges,
  onCancelEdit,
  onExpandToggle,
  onExecutiveSummaryChange,
  onEntryBarriersChange,
  onRecommendedChannelChange,
  onTimeToMarketChange,
  onTopBarrierChange,
  onCompetitiveDifferentiationChange,
  onStrategicRecommendationsChange,
  onRiskAssessmentChange,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink
}) => {
  const handleMarketEntrySaveChanges = () => {
    onSaveChanges();
  };

  const SwotQuadrant = () => (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="bg-green-50 p-2 rounded border">
        <div className="font-semibold text-green-700">Strengths</div>
        <div className="text-green-600">• Strong tech platform</div>
      </div>
      <div className="bg-blue-50 p-2 rounded border">
        <div className="font-semibold text-blue-700">Opportunities</div>
        <div className="text-blue-600">• Growing market</div>
      </div>
      <div className="bg-orange-50 p-2 rounded border">
        <div className="font-semibold text-orange-700">Weaknesses</div>
        <div className="text-orange-600">• Limited local presence</div>
      </div>
      <div className="bg-red-50 p-2 rounded border">
        <div className="font-semibold text-red-700">Threats</div>
        <div className="text-red-600">• Regulatory changes</div>
      </div>
    </div>
  );

  const TimelineChart = () => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
        <span className="text-xs">Q1 2025: Market Research</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
        <span className="text-xs">Q2 2025: Partnerships</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        <span className="text-xs">Q3 2025: Launch</span>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-purple-600" />
          Market Entry & Growth Strategy
        </h2>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onToggleEdit} className="text-purple-800 hover:text-purple-900">
            <Edit className="h-4 w-4" />
          </Button>
          {hasEdits && (
            <Button variant="ghost" size="sm" onClick={onEditHistoryOpen} className="text-gray-600 hover:text-gray-700">
              <Clock className="h-4 w-4" />
            </Button>
          )}
          {!isSplitView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => onScoutIconClick('market-entry')} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 transition-all duration-200 hover:shadow-md hover:shadow-purple-200/50 relative">
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                  <Bot className="h-5 w-5 relative z-10" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Explore More with Scout</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Collapsed View */}
      {!isExpanded && !isEditing && (
        <div className="space-y-4">
          <div className="text-sm text-gray-700 leading-relaxed">
            {executiveSummary.slice(0, 200)}...
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
              <div className="text-xs font-medium text-purple-700 mb-1">Top Entry Channel</div>
              <div className="text-sm font-semibold text-purple-900">{recommendedChannel}</div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="text-xs font-medium text-blue-700 mb-1">Time to Market</div>
              <div className="text-sm font-semibold text-blue-900">{timeToMarket}</div>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
              <div className="text-xs font-medium text-orange-700 mb-1">Top Barrier</div>
              <div className="text-sm font-semibold text-orange-900">{topBarrier}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">SWOT Analysis</h4>
              <SwotQuadrant />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Timeline Preview</h4>
              <TimelineChart />
            </div>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onExpandToggle(true)}
            className="mt-4"
          >
            Read More
          </Button>
        </div>
      )}

      {/* Expanded View */}
      {isExpanded && !isEditing && (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-600" />
              Executive Summary
            </h3>
            <div className="text-sm text-gray-700 leading-relaxed space-y-3">
              {executiveSummary.split('\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                Entry Barriers
              </h4>
              <ul className="space-y-2">
                {entryBarriers.map((barrier, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-orange-500 mt-1">•</span>
                    {barrier}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
                <Target className="h-4 w-4 text-green-600" />
                Competitive Differentiation
              </h4>
              <ul className="space-y-2">
                {competitiveDifferentiation.map((diff, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    {diff}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Strategic Recommendations
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {strategicRecommendations.map((recommendation, index) => (
                <div key={index} className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="text-sm font-medium text-blue-900">{recommendation}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Risk Assessment
            </h4>
            <div className="space-y-2">
              {riskAssessment.map((risk, index) => (
                <div key={index} className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <div className="text-sm text-red-900">{risk}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-4 border-t">
            <Button variant="outline" size="sm" onClick={onExportPDF}>
              <FileText className="h-4 w-4 mr-1" />
              Save as PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onSaveToWorkspace}>
              <Save className="h-4 w-4 mr-1" />
              Save to Workspace
            </Button>
            <Button variant="outline" size="sm" onClick={onGenerateShareableLink}>
              <Share className="h-4 w-4 mr-1" />
              Shareable Link
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onExpandToggle(false)}>
              Collapse
            </Button>
          </div>
        </div>
      )}

      {/* Edit Mode */}
      {isEditing && (
        <div className="space-y-6">
          <div className="space-y-4">
            <Label htmlFor="market-entry-executive-summary" className="text-sm font-medium text-gray-700">
              Executive Summary
            </Label>
            <Textarea
              id="market-entry-executive-summary"
              value={executiveSummary}
              onChange={(e) => onExecutiveSummaryChange(e.target.value)}
              rows={4}
              className="w-full"
              placeholder="Enter executive summary for market entry strategy..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recommended-channel" className="text-sm font-medium text-gray-700">
                Recommended Entry Channel
              </Label>
              <Input
                id="recommended-channel"
                value={recommendedChannel}
                onChange={(e) => onRecommendedChannelChange(e.target.value)}
                placeholder="e.g., Local partnerships"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time-to-market" className="text-sm font-medium text-gray-700">
                Time to Market
              </Label>
              <Input
                id="time-to-market"
                value={timeToMarket}
                onChange={(e) => onTimeToMarketChange(e.target.value)}
                placeholder="e.g., 12-18 months"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="top-barrier" className="text-sm font-medium text-gray-700">
                Top Barrier
              </Label>
              <Input
                id="top-barrier"
                value={topBarrier}
                onChange={(e) => onTopBarrierChange(e.target.value)}
                placeholder="e.g., Data residency laws"
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-medium text-gray-700">Entry Barriers</Label>
            {entryBarriers.map((barrier, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={barrier}
                  onChange={(e) => {
                    const updated = [...entryBarriers];
                    updated[index] = e.target.value;
                    onEntryBarriersChange(updated);
                  }}
                  placeholder={`Entry barrier ${index + 1}`}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const updated = entryBarriers.filter((_, i) => i !== index);
                    onEntryBarriersChange(updated);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEntryBarriersChange([...entryBarriers, ''])}
            >
              Add Barrier
            </Button>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button onClick={handleMarketEntrySaveChanges} className="bg-green-600 hover:bg-green-700">
              Save Changes
            </Button>
            <Button variant="outline" onClick={onCancelEdit}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => onDeleteSection('market-entry')}>
              Delete Section
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketEntrySection;