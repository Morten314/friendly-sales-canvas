import React from 'react';
import { BarChart3, Bot, Edit, Target, TrendingUp, PieChart, X, FileText, Save, Share, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import MiniPieChart from '@/components/ui/MiniPieChart';
import MiniLineChart from '@/components/ui/MiniLineChart';

// Define the EditRecord interface within this file
interface EditRecord {
  id: string;
  timestamp: string;
  user: string;
  summary: string;
  field: string;
  oldValue: string;
  newValue: string;
}

interface MarketSizeOpportunityComponentProps {
  isEditing: boolean;
  isSplitView: boolean;
  isExpanded: boolean;
  hasEdits: boolean;
  deletedSections: Set<string>;
  editHistory: EditRecord[];
  executiveSummary: string;
  tamValue: string;
  samValue: string;
  apacGrowthRate: string;
  strategicRecommendations: string[];
  marketEntry: string;
  marketDrivers: string[];
  onToggleEdit: () => void;
  onScoutIconClick: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape', hasEdits?: boolean, customMessage?: string) => void;
  onEditHistoryOpen: () => void;
  onDeleteSection: (sectionId: string) => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onExpandToggle: (expanded: boolean) => void;
  onExecutiveSummaryChange: (value: string) => void;
  onTamValueChange: (value: string) => void;
  onSamValueChange: (value: string) => void;
  onApacGrowthRateChange: (value: string) => void;
  onStrategicRecommendationsChange: (recommendations: string[]) => void;
  onMarketEntryChange: (value: string) => void;
  onMarketDriversChange: (drivers: string[]) => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
  // Scout chat panel props
  showScoutChat?: boolean;
  scoutChatPanel?: React.ReactNode;
}

const MarketSizeOpportunityComponent: React.FC<MarketSizeOpportunityComponentProps> = ({
  isEditing,
  isSplitView,
  isExpanded,
  hasEdits,
  deletedSections,
  editHistory,
  executiveSummary,
  tamValue,
  samValue,
  apacGrowthRate,
  strategicRecommendations,
  marketEntry,
  marketDrivers,
  onToggleEdit,
  onScoutIconClick,
  onEditHistoryOpen,
  onDeleteSection,
  onSaveChanges,
  onCancelEdit,
  onExpandToggle,
  onExecutiveSummaryChange,
  onTamValueChange,
  onSamValueChange,
  onApacGrowthRateChange,
  onStrategicRecommendationsChange,
  onMarketEntryChange,
  onMarketDriversChange,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink,
  showScoutChat,
  scoutChatPanel
}) => {
  // Debug logging to track prop changes
  console.log('🔍 DEBUGGING: MarketSizeOpportunityComponent received props:', {
    executiveSummary: executiveSummary?.substring(0, 50) + '...',
    tamValue,
    samValue,
    apacGrowthRate,
    strategicRecommendations: strategicRecommendations?.length,
    marketEntry: marketEntry?.substring(0, 50) + '...',
    marketDrivers: marketDrivers?.length,
    timestamp: Date.now()
  });

  const handleMarketSizeSaveChanges = () => {
    onSaveChanges();
  };

  // Mock data for charts
  const pieChartData = [
    { name: 'North America', value: 40, color: '#3B82F6' },
    { name: 'Europe', value: 30, color: '#10B981' },
    { name: 'APAC', value: 25, color: '#8B5CF6' },
    { name: 'Others', value: 5, color: '#F59E0B' }
  ];

  const lineChartData = [
    { name: 'Jan', value: 2.1 },
    { name: 'Feb', value: 2.3 },
    { name: 'Mar', value: 2.8 },
    { name: 'Apr', value: 3.2 },
    { name: 'May', value: 3.8 },
    { name: 'Jun', value: 4.2 }
  ];

  return (
    <div className={`${showScoutChat ? 'flex gap-6' : ''}`}>
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${showScoutChat ? 'flex-1' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          Market Size & Opportunity
        </h2>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onToggleEdit} className="text-blue-800 hover:text-blue-900">
            <Edit className="h-4 w-4" />
          </Button>
          {!isSplitView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => onScoutIconClick('market-size')} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200 hover:shadow-md hover:shadow-blue-200/50 relative">
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
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

      {isEditing ? (
        <div className="space-y-8">
          {/* Executive Summary Edit */}
          {!deletedSections.has('executive-summary') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSection('executive-summary')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <Label htmlFor="executiveSummary" className="text-sm font-medium text-gray-700 mb-2 block">
                  Executive Summary
                </Label>
                <Textarea 
                  id="executiveSummary" 
                  value={executiveSummary} 
                  onChange={(e) => onExecutiveSummaryChange(e.target.value)} 
                  className="w-full h-32 resize-none" 
                  placeholder="Enter executive summary..." 
                />
              </div>
            </div>
          )}

          {/* Key Metrics Edit */}
          {!deletedSections.has('key-metrics') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSection('key-metrics')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
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
                    <Label htmlFor="tamValue" className="text-sm font-medium text-gray-700 mb-2 block">
                      Total Addressable Market
                    </Label>
                    <Input 
                      id="tamValue" 
                      value={tamValue} 
                      onChange={(e) => onTamValueChange(e.target.value)} 
                      placeholder="e.g., $4.2B" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="samValue" className="text-sm font-medium text-gray-700 mb-2 block">
                      Serviceable Addressable Market
                    </Label>
                    <Input 
                      id="samValue" 
                      value={samValue} 
                      onChange={(e) => onSamValueChange(e.target.value)} 
                      placeholder="e.g., $2.1B" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="apacGrowthRate" className="text-sm font-medium text-gray-700 mb-2 block">
                      APAC Growth Rate
                    </Label>
                    <Input 
                      id="apacGrowthRate" 
                      value={apacGrowthRate} 
                      onChange={(e) => onApacGrowthRateChange(e.target.value)} 
                      placeholder="e.g., 25%" 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Strategic Recommendations Edit */}
          {!deletedSections.has('strategic-recommendations') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSection('strategic-recommendations')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Strategic Recommendations
                </Label>
                {strategicRecommendations.map((rec, index) => (
                  <Textarea 
                    key={index} 
                    value={rec} 
                    onChange={e => {
                      const newRecs = [...strategicRecommendations];
                      newRecs[index] = e.target.value;
                      onStrategicRecommendationsChange(newRecs);
                    }} 
                    className="w-full h-20 resize-none mb-3" 
                    placeholder={`Strategic recommendation ${index + 1}...`} 
                  />
                ))}
              </div>
            </div>
          )}

          {/* Market Entry Edit */}
          {!deletedSections.has('market-entry') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSection('market-entry')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <Label htmlFor="marketEntry" className="text-sm font-medium text-gray-700 mb-2 block">
                  Market Entry Strategy
                </Label>
                <Textarea 
                  id="marketEntry" 
                  value={marketEntry} 
                  onChange={e => onMarketEntryChange(e.target.value)} 
                  className="w-full h-32 resize-none" 
                  placeholder="Enter market entry strategy..." 
                />
              </div>
            </div>
          )}

          {/* Market Drivers Edit */}
          {!deletedSections.has('market-drivers') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSection('market-drivers')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Key Market Drivers
                </Label>
                {marketDrivers.map((driver, index) => (
                  <Textarea 
                    key={index} 
                    value={driver} 
                    onChange={e => {
                      const newDrivers = [...marketDrivers];
                      newDrivers[index] = e.target.value;
                      onMarketDriversChange(newDrivers);
                    }} 
                    className="w-full h-16 resize-none mb-3" 
                    placeholder={`Market driver ${index + 1}...`} 
                  />
                ))}
              </div>
            </div>
          )}

          {/* Save/Cancel Buttons */}
          <div className="flex items-center gap-3 pt-6 border-t">
            <Button onClick={handleMarketSizeSaveChanges}>Save Changes</Button>
            <Button variant="outline" onClick={onCancelEdit}>Cancel</Button>
            <div className="flex-1"></div>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onEditHistoryOpen} className={`text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${editHistory.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={editHistory.length === 0}>
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
                <Button variant="ghost" size="sm" onClick={() => onScoutIconClick('market-size')} className="text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 hover:shadow-md hover:shadow-blue-200/50 transition-all duration-200 relative">
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
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
          {/* Executive Summary - Always Visible */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Executive Summary
            </h3>
            <p className="text-gray-700 mb-6">{executiveSummary}</p>

            {/* Key Metrics Cards - Always Visible */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-blue-600">{tamValue}</div>
                <div className="text-sm font-medium text-gray-900">Total Addressable Market</div>
                <div className="text-xs text-gray-600">Growing 15% YoY</div>
              </div>
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-green-600">{samValue}</div>
                <div className="text-sm font-medium text-gray-900">Serviceable Addressable Market</div>
                <div className="text-xs text-gray-600">Mid-market focus</div>
              </div>
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-purple-600">{apacGrowthRate}</div>
                <div className="text-sm font-medium text-gray-900">APAC Growth Rate</div>
                <div className="text-xs text-gray-600">Fastest growing region</div>
              </div>
            </div>
          </div>

          {/* Read More Button - Only show when not expanded and not in split view */}
          {!isExpanded && !isSplitView && (
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

          {/* Expanded Content */}
          {(isExpanded || isSplitView) && (
            <div className="animate-fade-in space-y-8">
              <div className="border-t pt-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-8">
                  Market Size & Opportunity Report
                </h2>

                {/* Strategic Recommendations */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-600" />
                    Strategic Recommendations
                  </h3>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <ul className="space-y-2 text-gray-700">
                      {strategicRecommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-green-600 font-bold text-lg leading-6">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Market Entry Strategy */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-orange-600" />
                    Market Entry & Growth Strategy
                  </h3>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <p className="text-gray-700">{marketEntry}</p>
                  </div>
                </div>

                {/* Key Market Drivers */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                    Key Market Drivers
                  </h3>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <ul className="space-y-3 text-gray-700">
                      {marketDrivers.map((driver, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <div className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                            {index + 1}
                          </div>
                          <span>{driver}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Regional Distribution Chart */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-indigo-600" />
                    Regional Market Distribution
                  </h3>
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <MiniPieChart 
                      data={pieChartData}
                      title="Market Share by Region"
                    />
                  </div>
                </div>

                {/* Market Growth Trajectory */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Market Growth Trajectory
                  </h3>
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <MiniLineChart 
                      data={lineChartData}
                      title="TAM Growth (in Billions)"
                      color="#10B981"
                    />
                  </div>
                </div>

                {/* Export Options in View Mode */}
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

                {/* Collapse Button */}
                {isExpanded && !isSplitView && (
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
            </div>
          )}
        </div>
      )}
      </div>

      {/* Scout Chat Panel */}
      {showScoutChat && scoutChatPanel && (
        <div className="w-1/2 flex-shrink-0">
          {scoutChatPanel}
        </div>
      )}
    </div>
  );
};

export default MarketSizeOpportunityComponent;