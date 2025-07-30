import React from 'react';
import { Bot, Edit, X, FileText, Save, Share, Clock, Users, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EditRecord } from './types';

interface CompetitorAnalysisSectionProps {
  isCompetitorEditing: boolean;
  isSplitView: boolean;
  competitorExpanded: boolean;
  competitorHasEdits: boolean;
  competitorDeletedSections: Set<string>;
  competitorEditHistory: EditRecord[];
  competitorExecutiveSummary: string;
  competitorTopPlayerShare: string;
  competitorEmergingPlayers: string;
  competitorFundingNews: string[];
  onCompetitorToggleEdit: () => void;
  onCompetitorSaveChanges: () => void;
  onCompetitorCancelEdit: () => void;
  onCompetitorDeleteSection: (sectionId: string) => void;
  onCompetitorRestoreSection?: (sectionId: string) => void;
  onCompetitorEditHistoryOpen: () => void;
  onCompetitorExpandToggle: (expanded: boolean) => void;
  onCompetitorExecutiveSummaryChange: (value: string) => void;
  onCompetitorTopPlayerShareChange: (value: string) => void;
  onCompetitorEmergingPlayersChange: (value: string) => void;
  onCompetitorFundingNewsChange: (news: string[]) => void;
  onScoutIconClick: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape' | 'regulatory-compliance' | 'market-entry', hasEdits?: boolean, lastEditedField?: string) => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
  // Scout chat panel props
  showScoutChat?: boolean;
  scoutChatPanel?: React.ReactNode;
}

const CompetitorAnalysisSection: React.FC<CompetitorAnalysisSectionProps> = ({
  isCompetitorEditing,
  isSplitView,
  competitorExpanded,
  competitorHasEdits,
  competitorDeletedSections,
  competitorEditHistory,
  competitorExecutiveSummary,
  competitorTopPlayerShare,
  competitorEmergingPlayers,
  competitorFundingNews,
  onCompetitorToggleEdit,
  onCompetitorSaveChanges,
  onCompetitorCancelEdit,
  onCompetitorDeleteSection,
  onCompetitorRestoreSection,
  onCompetitorEditHistoryOpen,
  onCompetitorExpandToggle,
  onCompetitorExecutiveSummaryChange,
  onCompetitorTopPlayerShareChange,
  onCompetitorEmergingPlayersChange,
  onCompetitorFundingNewsChange,
  onScoutIconClick,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink,
  showScoutChat,
  scoutChatPanel
}) => {

  const handleCompetitorSaveChanges = () => {
    onCompetitorSaveChanges();
  };

  return (
    <div className={`${showScoutChat ? 'flex gap-6' : ''}`}>
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${showScoutChat ? 'flex-1' : ''}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-green-600" />
            Competitor Landscape
          </h2>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onCompetitorToggleEdit} className="text-green-800 hover:text-green-900">
              <Edit className="h-4 w-4" />
            </Button>
            {!isSplitView && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onScoutIconClick('competitor-landscape')} className="text-green-600 hover:text-green-700 hover:bg-green-50 transition-all duration-200 hover:shadow-md hover:shadow-green-200/50 relative">
                    <div className="absolute inset-0 rounded-md bg-gradient-to-r from-green-400/20 to-blue-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
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

        {isCompetitorEditing ? (
          <div className="space-y-8">
            {/* Executive Summary Edit */}
            {!competitorDeletedSections.has('executive-summary') && (
              <div className="relative group">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => onCompetitorDeleteSection('executive-summary')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
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
                    value={competitorExecutiveSummary} 
                    onChange={e => onCompetitorExecutiveSummaryChange(e.target.value)} 
                    className="w-full h-32 resize-none" 
                    placeholder="Enter executive summary..." 
                  />
                </div>
              </div>
            )}

            {/* Key Metrics Edit */}
            {!competitorDeletedSections.has('key-metrics') && (
              <div className="relative group">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => onCompetitorDeleteSection('key-metrics')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
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
                        key={`top-player-${competitorTopPlayerShare}`}
                        defaultValue={competitorTopPlayerShare} 
                        onBlur={(e) => onCompetitorTopPlayerShareChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="text-2xl font-bold text-blue-600 border-blue-200 focus:border-blue-400"
                        placeholder="e.g., 35%"
                      />
                    </div>
                    <div>
                      <Label htmlFor="emergingPlayers" className="text-sm font-medium text-gray-700 mb-2 block">
                        Emerging Players Count
                      </Label>
                      <Input 
                        id="emergingPlayers"
                        key={`emerging-players-${competitorEmergingPlayers}`}
                        defaultValue={competitorEmergingPlayers}
                        onBlur={(e) => onCompetitorEmergingPlayersChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="text-2xl font-bold text-green-600 border-green-200 focus:border-green-400"
                        placeholder="e.g., 12 companies"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Funding News Edit */}
            {!competitorDeletedSections.has('funding-news') && (
              <div className="relative group">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => onCompetitorDeleteSection('funding-news')} className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Recent Funding News
                  </Label>
                  {competitorFundingNews.map((news, index) => (
                    <Textarea 
                      key={index} 
                      value={news} 
                      onChange={e => {
                        const newNews = [...competitorFundingNews];
                        newNews[index] = e.target.value;
                        onCompetitorFundingNewsChange(newNews);
                      }} 
                      className="w-full h-20 resize-none mb-3" 
                      placeholder={`Funding news ${index + 1}...`} 
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Deleted Sections */}
            {competitorDeletedSections.size > 0 && onCompetitorRestoreSection && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 relative z-50 shadow-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Deleted Sections</h4>
                <div className="space-y-2">
                  {Array.from(competitorDeletedSections).map((sectionId) => {
                    const sectionNames: Record<string, string> = {
                      'executive-summary': 'Executive Summary',
                      'key-metrics': 'Key Metrics',
                      'funding-news': 'Recent Funding News',
                      'market-leaders': 'Market Leaders',
                      'competitive-landscape': 'Competitive Landscape'
                    };
                    
                    return (
                      <div key={sectionId} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                        <span className="text-sm text-gray-600">{sectionNames[sectionId] || sectionId}</span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => onCompetitorRestoreSection(sectionId)}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          Restore
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Save/Cancel Buttons */}
            <div className="flex items-center gap-3 pt-6 border-t">
              <Button onClick={handleCompetitorSaveChanges}>Save Changes</Button>
              <Button variant="outline" onClick={onCompetitorCancelEdit}>Cancel</Button>
              <div className="flex-1"></div>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={onCompetitorEditHistoryOpen} className={`text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${competitorEditHistory.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={competitorEditHistory.length === 0}>
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
                  <Button variant="ghost" size="sm" onClick={() => onScoutIconClick('competitor-landscape')} className="text-green-600 hover:text-green-700 bg-green-50 border border-green-200 hover:shadow-md hover:shadow-green-200/50 transition-all duration-200 relative">
                    <div className="absolute inset-0 rounded-md bg-gradient-to-r from-green-400/20 to-blue-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                    <Bot className="h-5 w-5 relative z-10" />
                    Scout
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Get AI insights and suggestions</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Executive Summary Display */}
            {!competitorDeletedSections.has('executive-summary') && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Executive Summary</h3>
                <p className="text-gray-700 leading-relaxed">
                  {competitorExecutiveSummary || 'No executive summary available'}
                </p>
              </div>
            )}

            {/* Key Metrics Display */}
            {!competitorDeletedSections.has('key-metrics') && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{competitorTopPlayerShare || '35%'}</div>
                    <div className="text-sm text-gray-600">Top Player Market Share</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{competitorEmergingPlayers || '12 companies'}</div>
                    <div className="text-sm text-gray-600">Emerging Players</div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Funding News */}
            {!competitorDeletedSections.has('funding-news') && competitorFundingNews && competitorFundingNews.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Funding News</h3>
                <div className="space-y-3">
                  {competitorFundingNews.map((news, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-gray-700">{news}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Scout Chat Panel */}
      {showScoutChat && scoutChatPanel && (
        <div className="w-96">
          {scoutChatPanel}
        </div>
      )}
    </div>
  );
};

export default CompetitorAnalysisSection;