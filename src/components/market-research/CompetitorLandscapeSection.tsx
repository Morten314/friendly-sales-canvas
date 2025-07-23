import React from 'react';
import { Bot, Edit, X, FileText, Save, Share, Clock, Crown, ArrowUp, ArrowDown, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
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

interface CompetitorLandscapeSectionProps {
  isEditing: boolean;
  isSplitView: boolean;
  isExpanded: boolean;
  hasEdits: boolean;
  deletedSections: Set<string>;
  editHistory: EditRecord[];
  executiveSummary: string;
  topPlayerShare: string;
  emergingPlayers: string;
  fundingNews: string[];
  onToggleEdit: () => void;
  onScoutIconClick: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape', hasEdits?: boolean, customMessage?: string) => void;
  onEditHistoryOpen: () => void;
  onDeleteSection: (sectionId: string) => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onExpandToggle: (expanded: boolean) => void;
  onExecutiveSummaryChange: (value: string) => void;
  onTopPlayerShareChange: (value: string) => void;
  onEmergingPlayersChange: (value: string) => void;
  onFundingNewsChange: (news: string[]) => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
}

const CompetitorLandscapeSection: React.FC<CompetitorLandscapeSectionProps> = ({
  isEditing,
  isSplitView,
  isExpanded,
  hasEdits,
  deletedSections,
  editHistory,
  executiveSummary,
  topPlayerShare,
  emergingPlayers,
  fundingNews,
  onToggleEdit,
  onScoutIconClick,
  onEditHistoryOpen,
  onDeleteSection,
  onSaveChanges,
  onCancelEdit,
  onExpandToggle,
  onExecutiveSummaryChange,
  onTopPlayerShareChange,
  onEmergingPlayersChange,
  onFundingNewsChange,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink
}) => {
  const handleCompetitorSaveChanges = () => {
    onSaveChanges();
  };

  const handleFundingNewsChange = (index: number, value: string) => {
    const newNews = [...fundingNews];
    newNews[index] = value;
    onFundingNewsChange(newNews);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 relative">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Crown className="h-5 w-5 text-purple-600" />
            Competitor Landscape
          </h2>
          <p className="text-sm text-gray-600 mt-1">Analyze your competitive environment & market dynamics.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onToggleEdit} className="text-blue-800 hover:text-blue-900">
            <Edit className="h-4 w-4" />
          </Button>
          {!isSplitView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onScoutIconClick('competitor-landscape')}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200 hover:shadow-md hover:shadow-blue-200/50 relative"
                >
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteSection('executive-summary')}
                    className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <Label htmlFor="competitorExecutiveSummary" className="text-sm font-medium text-gray-700 mb-2 block">
                  Executive Summary
                </Label>
                <Textarea
                  id="competitorExecutiveSummary"
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteSection('key-metrics')}
                    className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="topPlayerShare" className="text-sm font-medium text-gray-700 mb-2 block">
                      Top Player Market Share
                    </Label>
                    <Input
                      id="topPlayerShare"
                      value={topPlayerShare}
                      onChange={(e) => onTopPlayerShareChange(e.target.value)}
                      placeholder="e.g., 48%"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergingPlayers" className="text-sm font-medium text-gray-700 mb-2 block">
                      Emerging Players Added
                    </Label>
                    <Input
                      id="emergingPlayers"
                      value={emergingPlayers}
                      onChange={(e) => onEmergingPlayersChange(e.target.value)}
                      placeholder="e.g., 2"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Funding News Edit */}
          {!deletedSections.has('funding-news') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteSection('funding-news')}
                    className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this section</p>
                </TooltipContent>
              </Tooltip>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Funding News & Headlines
                </Label>
                {fundingNews.map((news, index) => (
                  <Textarea
                    key={index}
                    value={news}
                    onChange={(e) => handleFundingNewsChange(index, e.target.value)}
                    className="w-full h-16 resize-none mb-3"
                    placeholder={`News headline ${index + 1}...`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Save/Cancel Buttons */}
          <div className="flex items-center gap-3 pt-6 border-t">
            <Button onClick={handleCompetitorSaveChanges}>Save Changes</Button>
            <Button variant="outline" onClick={onCancelEdit}>Cancel</Button>
            <div className="flex-1"></div>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEditHistoryOpen}
                  className={`text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${
                    editHistory.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={editHistory.length === 0}
                >
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onScoutIconClick('competitor-landscape')}
                  className="text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 hover:shadow-md hover:shadow-blue-200/50 transition-all duration-200 relative"
                >
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
          {/* Executive Summary - Collapsed */}
          <div>
            <p className="text-gray-700 mb-4">
              {executiveSummary}
            </p>
            
            {/* Metric Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-blue-600">{topPlayerShare}</div>
                    <div className="text-sm text-gray-700">Top Player Market Share</div>
                  </div>
                  <ArrowUp className="h-4 w-4 text-green-500" />
                </div>
              </div>
              <div className="border border-green-200 p-4 rounded-lg bg-amber-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-green-600">{emergingPlayers}</div>
                    <div className="text-sm text-gray-700">Emerging Players Added</div>
                  </div>
                  <ArrowDown className="h-4 w-4 text-red-500" />
                </div>
              </div>
            </div>

            {/* Competitor Chips */}
            <div className="flex flex-wrap gap-2 mb-6">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer">
                Microsoft Teams
              </Badge>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 cursor-pointer">
                Slack
              </Badge>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 cursor-pointer">
                Zoom
              </Badge>
              <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 cursor-pointer">
                Notion
              </Badge>
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 cursor-pointer">
                Asana
              </Badge>
            </div>
          </div>

          {/* Read More Button */}
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

          {/* Expanded Content - Full Report */}
          {isExpanded && (
            <div className="animate-fade-in border-t pt-6 space-y-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Competitor Landscape Report
              </h2>

              {/* Executive Summary - Expanded */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Executive Summary</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700 mb-4">
                    The enterprise collaboration tools market is increasingly competitive, with several dominant players holding significant market share. However, emerging startups are introducing disruptive features, shifting the landscape rapidly.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                      <span className="text-gray-700">Top 3 Players: Microsoft Teams (35%), Slack (28%), Zoom (22%)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                      <span className="text-gray-700">Emerging Players: Asana (8%), Notion (7%)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></div>
                      <span className="text-gray-700">Key Moves: $300M funding round by Notion; new AI feature launch by Teams</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Competitive SWOT Analyses */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Competitive SWOT Analyses</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Microsoft Teams</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <h5 className="font-medium text-green-700 mb-1">Strengths</h5>
                        <ul className="text-gray-600 space-y-1">
                          <li>• Office 365 integration</li>
                          <li>• Enterprise adoption</li>
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-medium text-red-700 mb-1">Weaknesses</h5>
                        <ul className="text-gray-600 space-y-1">
                          <li>• Complex interface</li>
                          <li>• Resource heavy</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Slack</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <h5 className="font-medium text-green-700 mb-1">Strengths</h5>
                        <ul className="text-gray-600 space-y-1">
                          <li>• Developer-friendly</li>
                          <li>• Third-party apps</li>
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-medium text-red-700 mb-1">Weaknesses</h5>
                        <ul className="text-gray-600 space-y-1">
                          <li>• Limited video features</li>
                          <li>• Premium pricing</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Funding Rounds & News Headlines */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Funding Rounds & News Headlines</h3>
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2 flex-shrink-0"></div>
                      <div>
                        <h4 className="font-medium text-gray-900">Notion raises $300M Series C</h4>
                        <p className="text-sm text-gray-600">Valuation reaches $10B as workspace tools gain traction</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                      <div>
                        <h4 className="font-medium text-gray-900">Microsoft Teams launches AI Copilot</h4>
                        <p className="text-sm text-gray-600">New AI features for meeting summaries and task automation</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></div>
                      <div>
                        <h4 className="font-medium text-gray-900">Slack introduces Workflow Builder 2.0</h4>
                        <p className="text-sm text-gray-600">Enhanced automation capabilities for enterprise customers</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Market Share by Region */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Share % by Region</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">North America</h4>
                    <MiniPieChart data={[{
                  name: "Microsoft Teams",
                  value: 40,
                  color: "#3B82F6"
                }, {
                  name: "Slack",
                  value: 32,
                  color: "#8B5CF6"
                }, {
                  name: "Zoom",
                  value: 18,
                  color: "#10B981"
                }, {
                  name: "Others",
                  value: 10,
                  color: "#6B7280"
                }]} title="" />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">APAC Region</h4>
                    <MiniPieChart data={[{
                  name: "Microsoft Teams",
                  value: 30,
                  color: "#3B82F6"
                }, {
                  name: "Zoom",
                  value: 28,
                  color: "#10B981"
                }, {
                  name: "Slack",
                  value: 22,
                  color: "#8B5CF6"
                }, {
                  name: "Others",
                  value: 20,
                  color: "#6B7280"
                }]} title="" />
                  </div>
                </div>
              </div>

              {/* Feature Comparison Tables */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Comparison Tables</h3>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Feature</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Teams</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Slack</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Zoom</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Notion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-900">Video Conferencing</td>
                        <td className="px-4 py-3 text-center">✓</td>
                        <td className="px-4 py-3 text-center">Limited</td>
                        <td className="px-4 py-3 text-center">✓✓</td>
                        <td className="px-4 py-3 text-center">✗</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">File Sharing</td>
                        <td className="px-4 py-3 text-center">✓✓</td>
                        <td className="px-4 py-3 text-center">✓</td>
                        <td className="px-4 py-3 text-center">✓</td>
                        <td className="px-4 py-3 text-center">✓✓</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-900">Third-party Integrations</td>
                        <td className="px-4 py-3 text-center">✓</td>
                        <td className="px-4 py-3 text-center">✓✓</td>
                        <td className="px-4 py-3 text-center">✓</td>
                        <td className="px-4 py-3 text-center">✓</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">AI Features</td>
                        <td className="px-4 py-3 text-center">✓✓</td>
                        <td className="px-4 py-3 text-center">✓</td>
                        <td className="px-4 py-3 text-center">✓</td>
                        <td className="px-4 py-3 text-center">✓</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* M&A Potential Insights */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">M&A Potential Insights</h3>
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0"></div>
                      <div>
                        <h4 className="font-medium text-gray-900">High Acquisition Likelihood</h4>
                        <p className="text-sm text-gray-600">Notion and Asana showing strong growth metrics attractive to tech giants</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
                      <div>
                        <h4 className="font-medium text-gray-900">Potential Acquirers</h4>
                        <p className="text-sm text-gray-600">Google, Meta, and Salesforce actively seeking collaboration tool acquisitions</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                      <div>
                        <h4 className="font-medium text-gray-900">Market Consolidation Risk</h4>
                        <p className="text-sm text-gray-600">Smaller players may struggle to compete with integrated enterprise suites</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Trends</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Market Share Growth</h4>
                    <MiniLineChart data={[{
                  name: "Q1",
                  value: 25
                }, {
                  name: "Q2",
                  value: 32
                }, {
                  name: "Q3",
                  value: 38
                }, {
                  name: "Q4",
                  value: 48
                }]} title="" color="#3B82F6" />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Feature Adoption Rate</h4>
                    <MiniLineChart data={[{
                  name: "AI Tools",
                  value: 78
                }, {
                  name: "Video",
                  value: 92
                }, {
                  name: "Automation",
                  value: 65
                }, {
                  name: "Integration",
                  value: 84
                }]} title="" color="#8B5CF6" />
                  </div>
                </div>
              </div>

              {/* Export/Share Actions */}
              <div className="border-t pt-6">
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

              {/* Show Less Button */}
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
            </div>
          )}
        </div>
      )}

      {/* Persistent Scout Agent Icon */}
      <div className="absolute bottom-4 right-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onScoutIconClick('competitor-landscape')}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white hover:shadow-lg hover:shadow-blue-300/50 transition-all duration-200"
            >
              <Bot className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Explore More with Scout</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default CompetitorLandscapeSection;
