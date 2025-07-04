import React from 'react';
import MarketIntelligenceTab from '@/components/market-research/MarketIntelligenceTab';
import ScoutChatPanel from '@/components/market-research/ScoutChatPanel';

interface EditRecord {
  id: string;
  timestamp: string;
  user: string;
  summary: string;
  field: string;
  oldValue: string;
  newValue: string;
}

const MarketResearch = () => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSplitView, setIsSplitView] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [hasEdits, setHasEdits] = React.useState(false);
  const [deletedSections, setDeletedSections] = React.useState<Set<string>>(new Set());
  const [editHistory, setEditHistory] = React.useState<EditRecord[]>([]);
  const [executiveSummary, setExecutiveSummary] = React.useState("The enterprise collaboration tools market is increasingly competitive, with several dominant players holding significant market share. However, emerging startups are introducing disruptive features, shifting the landscape rapidly.");
  const [tamValue, setTamValue] = React.useState("$4.2B");
  const [samValue, setSamValue] = React.useState("$2.1B");
  const [apacGrowthRate, setApacGrowthRate] = React.useState("25%");
  const [strategicRecommendations, setStrategicRecommendations] = React.useState([
    "Expand into the APAC market with a focus on mobile-first solutions.",
    "Develop AI-powered features to enhance user engagement.",
  ]);
  const [marketEntry, setMarketEntry] = React.useState("A phased approach, starting with key partnerships and pilot programs.");
  const [marketDrivers, setMarketDrivers] = React.useState([
    "Increasing demand for remote work solutions.",
    "Growing adoption of cloud-based technologies.",
  ]);

  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  const handleScoutIconClick = () => {
    setIsSplitView(!isSplitView);
  };

  const handleEditHistoryOpen = () => {
    // Placeholder for edit history functionality
    console.log('Edit history opened');
  };

  const handleDeleteSection = (sectionId: string) => {
    setDeletedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const handleSaveChanges = () => {
    setHasEdits(true);
    setIsEditing(false);

    // Create a new edit record
    const newEdit: EditRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: 'John Doe',
      summary: 'Updated market analysis',
      field: 'Executive Summary',
      oldValue: 'Previous summary',
      newValue: executiveSummary,
    };

    // Add the new edit record to the edit history
    setEditHistory(prevHistory => [...prevHistory, newEdit]);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleExportPDF = () => {
    alert('Exporting to PDF...');
  };

  const handleSaveToWorkspace = () => {
    alert('Saving to workspace...');
  };

  const handleGenerateShareableLink = () => {
    alert('Generating shareable link...');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white py-6 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:flex lg:items-center lg:justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Market Research
              </h2>
              <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:mt-0 sm:space-x-6">
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  {hasEdits ? (
                    <span className="text-green-500">
                      <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.431-2.569a6 6 0 10-8.862 0 6 6 0 008.862 0zM13 10a3 3 0 11-6 0 3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Updated today
                    </span>
                  ) : (
                    <span className="text-gray-500">
                      <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 11.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                      </svg>
                      Created January 1, 2024
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-5 flex lg:mt-0 lg:ml-4">
              <span className="hidden sm:block">
                <button type="button" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 8V2H7v6H2l4 4 4-4h-1zM21 15.73l-1.41-1.42L15 19.59V12h-2v7.59l-4.59-4.58L3 15.73l9 9 9-9z" />
                  </svg>
                  Download
                </button>
              </span>

              <span className="sm:ml-3">
                <button type="button" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  <svg className="-ml-1 mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                    <path d="M15 8a2 2 0 012-2h0a2 2 0 012 2v5a2 2 0 01-2 2h-2v4l-3-3h-2a2 2 0 01-2-2V8a2 2 0 012-2h2a2 2 0 012 2v3h3V8z" />
                  </svg>
                  Share
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-6">
          <MarketIntelligenceTab
            isEditing={isEditing}
            isSplitView={isSplitView}
            isExpanded={isExpanded}
            hasEdits={hasEdits}
            deletedSections={deletedSections}
            editHistory={editHistory}
            executiveSummary={executiveSummary}
            tamValue={tamValue}
            samValue={samValue}
            apacGrowthRate={apacGrowthRate}
            strategicRecommendations={strategicRecommendations}
            marketEntry={marketEntry}
            marketDrivers={marketDrivers}
            onToggleEdit={handleToggleEdit}
            onScoutIconClick={handleScoutIconClick}
            onEditHistoryOpen={handleEditHistoryOpen}
            onDeleteSection={handleDeleteSection}
            onSaveChanges={handleSaveChanges}
            onCancelEdit={handleCancelEdit}
            onExpandToggle={setIsExpanded}
            onExecutiveSummaryChange={setExecutiveSummary}
            onTamValueChange={setTamValue}
            onSamValueChange={setSamValue}
            onApacGrowthRateChange={setApacGrowthRate}
            onStrategicRecommendationsChange={setStrategicRecommendations}
            onMarketEntryChange={setMarketEntry}
            onMarketDriversChange={setMarketDrivers}
            onExportPDF={handleExportPDF}
            onSaveToWorkspace={handleSaveToWorkspace}
            onGenerateShareableLink={handleGenerateShareableLink}
          />

          {isSplitView && (
            <ScoutChatPanel 
              showScoutChat={isSplitView}
              isSplitView={isSplitView}
              hasEdits={hasEdits}
              showEditHistory={false}
              editHistory={editHistory}
              lastEditedField=""
              onClose={() => setIsSplitView(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketResearch;
