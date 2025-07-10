
import React from 'react';
import { Bot, Edit, X, FileText, Save, Share, Clock, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import MiniPieChart from '@/components/ui/MiniPieChart';
import MiniLineChart from '@/components/ui/MiniLineChart';

interface EditRecord {
  id: string;
  timestamp: string;
  user: string;
  summary: string;
  field: string;
  oldValue: string;
  newValue: string;
}

interface TrendSnapshot {
  title: string;
  metric: string;
  type: 'growth' | 'performance' | 'adoption';
}

interface IndustryTrendsRecommendations {
  primaryFocus: string;
  marketEntry: string;
}

interface IndustryTrendsSectionProps {
  isIndustryTrendsEditing: boolean;
  isSplitView: boolean;
  industryTrendsExpanded: boolean;
  industryTrendsHasEdits: boolean;
  industryTrendsDeletedSections: Set<string>;
  industryTrendsEditHistory: EditRecord[];
  industryTrendsExecutiveSummary: string;
  industryTrendsAiAdoption: string;
  industryTrendsCloudMigration: string;
  industryTrendsRegulatory: string;
  industryTrendSnapshots: TrendSnapshot[];
  industryTrendsRecommendations: IndustryTrendsRecommendations;
  industryTrendsRisks: string[];
  onIndustryTrendsToggleEdit: () => void;
  onIndustryTrendsSaveChanges: () => void;
  onIndustryTrendsCancelEdit: () => void;
  onIndustryTrendsDeleteSection: (sectionId: string) => void;
  onIndustryTrendsEditHistoryOpen: () => void;
  onIndustryTrendsExpandToggle: (expanded: boolean) => void;
  onIndustryTrendsExecutiveSummaryChange: (value: string) => void;
  onIndustryTrendsAiAdoptionChange: (value: string) => void;
  onIndustryTrendsCloudMigrationChange: (value: string) => void;
  onIndustryTrendsRegulatoryChange: (value: string) => void;
  onIndustryTrendSnapshotsChange: (snapshots: TrendSnapshot[]) => void;
  onScoutIconClick: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape') => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
}

const IndustryTrendsSection: React.FC<IndustryTrendsSectionProps> = ({
  isIndustryTrendsEditing,
  isSplitView,
  industryTrendsExpanded,
  industryTrendsHasEdits,
  industryTrendsDeletedSections,
  industryTrendsEditHistory,
  industryTrendsExecutiveSummary,
  industryTrendsAiAdoption,
  industryTrendsCloudMigration,
  industryTrendsRegulatory,
  industryTrendSnapshots,
  industryTrendsRecommendations,
  industryTrendsRisks,
  onIndustryTrendsToggleEdit,
  onIndustryTrendsSaveChanges,
  onIndustryTrendsCancelEdit,
  onIndustryTrendsDeleteSection,
  onIndustryTrendsEditHistoryOpen,
  onIndustryTrendsExpandToggle,
  onIndustryTrendsExecutiveSummaryChange,
  onIndustryTrendsAiAdoptionChange,
  onIndustryTrendsCloudMigrationChange,
  onIndustryTrendsRegulatoryChange,
  onIndustryTrendSnapshotsChange,
  onScoutIconClick,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Zap className="h-5 w-5 text-purple-600" />
          Industry Trends
        </h2>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onIndustryTrendsToggleEdit} className="text-purple-800 hover:text-purple-900">
            <Edit className="h-4 w-4" />
          </Button>
          {!isSplitView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => onScoutIconClick('industry-trends')} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 transition-all duration-200 hover:shadow-md hover:shadow-purple-200/50 relative">
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

      {isIndustryTrendsEditing ? (
        <div className="space-y-8">
          {/* Executive Summary Edit */}
          {!industryTrendsDeletedSections.has('executive-summary') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onIndustryTrendsDeleteSection('executive-summary')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <Label htmlFor="industryTrendsExecutiveSummary" className="text-sm font-medium text-gray-700 mb-2 block">
                  Executive Summary
                </Label>
                <Textarea 
                  id="industryTrendsExecutiveSummary" 
                  value={industryTrendsExecutiveSummary} 
                  onChange={e => onIndustryTrendsExecutiveSummaryChange(e.target.value)} 
                  className="w-full h-32 resize-none" 
                  placeholder="Enter executive summary..." 
                />
              </div>
            </div>
          )}

          {/* Key Metrics Edit */}
          {!industryTrendsDeletedSections.has('key-metrics') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onIndustryTrendsDeleteSection('key-metrics')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="aiAdoption" className="text-sm font-medium text-gray-700 mb-2 block">
                      AI Adoption Rate
                    </Label>
                    <Input 
                      id="aiAdoption"
                      value={industryTrendsAiAdoption} 
                      onChange={e => onIndustryTrendsAiAdoptionChange(e.target.value)}
                      className="text-2xl font-bold text-blue-600 border-blue-200 focus:border-blue-400"
                      placeholder="e.g., 78%"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cloudMigration" className="text-sm font-medium text-gray-700 mb-2 block">
                      Cloud Migration Increase
                    </Label>
                    <Input 
                      id="cloudMigration"
                      value={industryTrendsCloudMigration} 
                      onChange={e => onIndustryTrendsCloudMigrationChange(e.target.value)}
                      className="text-2xl font-bold text-green-600 border-green-200 focus:border-green-400"
                      placeholder="e.g., +45%"
                    />
                  </div>
                  <div>
                    <Label htmlFor="regulatory" className="text-sm font-medium text-gray-700 mb-2 block">
                      Regulatory Changes
                    </Label>
                    <Input 
                      id="regulatory"
                      value={industryTrendsRegulatory} 
                      onChange={e => onIndustryTrendsRegulatoryChange(e.target.value)}
                      className="text-2xl font-bold text-purple-600 border-purple-200 focus:border-purple-400"
                      placeholder="e.g., 12 new"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Trend Snapshots Edit */}
          {!industryTrendsDeletedSections.has('trend-snapshots') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onIndustryTrendsDeleteSection('trend-snapshots')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Trend Snapshots</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {industryTrendSnapshots.map((trend, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="mb-3">
                        <Label htmlFor={`trendTitle-${index}`} className="text-sm font-medium text-gray-700 mb-1 block">
                          Title
                        </Label>
                        <Input 
                          id={`trendTitle-${index}`}
                          value={trend.title}
                          onChange={e => {
                            const updated = [...industryTrendSnapshots];
                            updated[index] = { ...trend, title: e.target.value };
                            onIndustryTrendSnapshotsChange(updated);
                          }}
                          className="font-medium text-gray-900"
                          placeholder="Trend title"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`trendMetric-${index}`} className="text-sm font-medium text-gray-700 mb-1 block">
                          Metric
                        </Label>
                        <Input 
                          id={`trendMetric-${index}`}
                          value={trend.metric}
                          onChange={e => {
                            const updated = [...industryTrendSnapshots];
                            updated[index] = { ...trend, metric: e.target.value };
                            onIndustryTrendSnapshotsChange(updated);
                          }}
                          className="text-sm text-gray-600"
                          placeholder="Trend metric"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Save/Cancel Buttons */}
          <div className="flex items-center gap-3 pt-6 border-t">
            <Button onClick={onIndustryTrendsSaveChanges}>Save Changes</Button>
            <Button variant="outline" onClick={onIndustryTrendsCancelEdit}>Cancel</Button>
            <div className="flex-1"></div>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onIndustryTrendsEditHistoryOpen} className={`text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${industryTrendsEditHistory.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={industryTrendsEditHistory.length === 0}>
                  <Clock className="h-4 w-4" />
                  Edit History
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View changes made to this report</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => onScoutIconClick('industry-trends')} className="text-purple-600 hover:text-purple-700 bg-purple-50 border border-purple-200 hover:shadow-md hover:shadow-purple-200/50 transition-all duration-200 relative">
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                  <Bot className="h-4 w-4 relative z-10" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Explore More with Scout</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Export Options in Edit Mode */}
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
        </div>
      ) : (
        <div className="space-y-6">
          {/* Default View */}
          <div>
            <p className="text-gray-700 mb-6">{industryTrendsExecutiveSummary}</p>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-blue-600">{industryTrendsAiAdoption}</div>
                <div className="text-sm font-medium text-gray-900">AI Adoption Rate</div>
                <div className="text-xs text-gray-600">Enterprise pilots</div>
              </div>
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-green-600">{industryTrendsCloudMigration}</div>
                <div className="text-sm font-medium text-gray-900">Cloud Migration Increase</div>
                <div className="text-xs text-gray-600">Year over year</div>
              </div>
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-purple-600">{industryTrendsRegulatory}</div>
                <div className="text-sm font-medium text-gray-900">Regulatory Changes</div>
                <div className="text-xs text-gray-600">Impacting sector</div>
              </div>
            </div>
          </div>

          {/* Read More Button */}
          {!industryTrendsExpanded && !isSplitView && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => onIndustryTrendsExpandToggle(true)}
                variant="outline"
                className="flex items-center space-x-2 text-sm"
              >
                <span>Read More</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Expanded Content */}
          {(industryTrendsExpanded || isSplitView) && (
            <div className="animate-fade-in space-y-8">
              <div className="border-t pt-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-8">
                  Industry Trends Report
                </h2>

                {/* Executive Summary */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Executive Summary</h3>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{industryTrendsExecutiveSummary}</p>
                </div>

                {/* Key Trend Snapshots */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Trend Snapshots</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {industryTrendSnapshots.map((trend, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">{trend.title}</h4>
                        <p className="text-sm text-gray-600 mb-3">{trend.metric}</p>
                        <div className="h-8 bg-gradient-to-r from-purple-100 to-blue-100 rounded"></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Regional Hotspots */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Regional Hotspots</h3>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-gray-700">APAC leads in AI adoption with 78% of enterprises implementing AI solutions, followed by Europe at 65% and North America at 72%.</p>
                  </div>
                </div>

                {/* Strategic Recommendations */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategic Recommendations</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <h4 className="font-medium text-green-900 mb-2">Primary Focus</h4>
                      <p className="text-green-700 text-sm">{industryTrendsRecommendations.primaryFocus}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-blue-900 mb-2">Market Entry</h4>
                      <p className="text-blue-700 text-sm">{industryTrendsRecommendations.marketEntry}</p>
                    </div>
                  </div>
                </div>

                {/* Risks & Watchouts */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Risks & Watchouts</h3>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <ul className="space-y-2">
                      {industryTrendsRisks.map((risk, index) => (
                        <li key={index} className="flex items-start gap-2 text-red-700 text-sm">
                          <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Visual Charts Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Visual Charts</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">AI Adoption Trends</h4>
                      <MiniLineChart 
                        data={[
                          { name: "Q1", value: 45 },
                          { name: "Q2", value: 58 },
                          { name: "Q3", value: 67 },
                          { name: "Q4", value: 78 }
                        ]} 
                        title="" 
                        color="#8B5CF6" 
                      />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Technology Budget Allocation</h4>
                      <MiniPieChart 
                        data={[
                          { name: "AI/ML", value: 35, color: "#8B5CF6" },
                          { name: "Cloud", value: 40, color: "#3B82F6" },
                          { name: "Security", value: 25, color: "#10B981" }
                        ]} 
                        title="" 
                      />
                    </div>
                  </div>
                </div>

                {/* Export Footer */}
                <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-6 -mb-6 rounded-b-lg">
                  <div className="flex flex-wrap gap-3 justify-center">
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
                      onClick={() => onIndustryTrendsExpandToggle(false)}
                      variant="outline"
                      className="flex items-center space-x-2 text-sm"
                    >
                      <span>Show Less</span>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IndustryTrendsSection;
