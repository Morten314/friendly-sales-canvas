import React from 'react';
import { BarChart3, Bot, Edit, Target, TrendingUp, PieChart, X, FileText, Save, Share, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import MiniPieChart from '@/components/ui/MiniPieChart';
import MiniLineChart from '@/components/ui/MiniLineChart';
import { useAuth } from '@/contexts/AuthContext';
import { setUserLocalStorage } from '@/utils/cacheUtils';
import { useToast } from '@/hooks/use-toast';

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
  GrowthRate: string;
  strategicRecommendations: string[];
  marketEntry: string;
  marketDrivers: string[];
  marketSizeBySegment?: Record<string, string>;
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
  onGrowthRateChange: (value: string) => void;
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
  GrowthRate,
  strategicRecommendations,
  marketEntry,
  marketDrivers,
  marketSizeBySegment,
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
  onGrowthRateChange,
  onStrategicRecommendationsChange,
  onMarketEntryChange,
  onMarketDriversChange,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink,
  showScoutChat,
  scoutChatPanel
}) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  // Local state for editing - these are the source of truth for display
  const [localExecutiveSummary, setLocalExecutiveSummary] = React.useState(executiveSummary || '');
  const [localTamValue, setLocalTamValue] = React.useState(tamValue || '');
  const [localSamValue, setLocalSamValue] = React.useState(samValue || '');
  const [localGrowthRate, setLocalGrowthRate] = React.useState(GrowthRate || '');
  const [localMarketEntry, setLocalMarketEntry] = React.useState(marketEntry || '');
  const [localStrategicRecommendations, setLocalStrategicRecommendations] = React.useState([...strategicRecommendations]);
  const [localMarketDrivers, setLocalMarketDrivers] = React.useState([...marketDrivers]);
  
  // Force re-render trigger to ensure UI updates immediately after save
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  // Track if we just saved to prevent useEffect from overwriting our changes
  const justSavedRef = React.useRef(false);
  const savedLocalStateRef = React.useRef<{
    executiveSummary: string;
    tamValue: string;
    samValue: string;
    GrowthRate: string;
    marketEntry: string;
    strategicRecommendations: string[];
    marketDrivers: string[];
  } | null>(null);

  // Sync local state with props when they change, but NEVER overwrite if we just saved
  // Local state is the source of truth for display - props are only synced when safe
  React.useEffect(() => {
    // If we just saved, NEVER overwrite local state until props match what we saved
    if (justSavedRef.current && savedLocalStateRef.current) {
      const propsMatchSaved = 
        (executiveSummary || '') === savedLocalStateRef.current.executiveSummary &&
        (tamValue || '') === savedLocalStateRef.current.tamValue &&
        (samValue || '') === savedLocalStateRef.current.samValue &&
        (GrowthRate || '') === savedLocalStateRef.current.GrowthRate &&
        (marketEntry || '') === savedLocalStateRef.current.marketEntry;
      
      if (propsMatchSaved) {
        // Props have caught up - safe to reset flag and sync
        justSavedRef.current = false;
        savedLocalStateRef.current = null;
      } else {
        // Props haven't caught up yet - DO NOT overwrite local state
        console.log('🛡️ Market Size - Preserving local state, props not caught up yet');
        return; // Exit early, don't overwrite
      }
    }
    
    // Only sync when not editing (and either not just saved, or props have caught up)
    if (!isEditing) {
      // Check if local state differs from props - if so, and we're not just saved, sync
      const localDiffers = 
        localExecutiveSummary !== (executiveSummary || '') ||
        localTamValue !== (tamValue || '') ||
        localSamValue !== (samValue || '') ||
        localGrowthRate !== (GrowthRate || '') ||
        localMarketEntry !== (marketEntry || '');
      
      // Only sync if local differs AND we're not in a "just saved" state
      if (localDiffers && !justSavedRef.current) {
        console.log('🔄 Market Size - Syncing local state with props');
        setLocalExecutiveSummary(executiveSummary || '');
        setLocalTamValue(tamValue || '');
        setLocalSamValue(samValue || '');
        setLocalGrowthRate(GrowthRate || '');
        setLocalMarketEntry(marketEntry || '');
        setLocalStrategicRecommendations([...strategicRecommendations]);
        setLocalMarketDrivers([...marketDrivers]);
      }
    }
  }, [executiveSummary, tamValue, samValue, GrowthRate, marketEntry, strategicRecommendations, marketDrivers, isEditing, localExecutiveSummary, localTamValue, localSamValue, localGrowthRate, localMarketEntry]);

  // Use local state for display to ensure immediate UI updates after save
  // Local state is synced with props when not editing, and updated immediately during editing
  // This ensures UI reflects changes immediately without waiting for parent prop updates
  // IMPORTANT: These display variables use local state, which is updated during editing
  // and preserved after save, so UI will show changes immediately
  const displayExecutiveSummary = localExecutiveSummary || executiveSummary || '';
  const displayTamValue = localTamValue || tamValue || '';
  const displaySamValue = localSamValue || samValue || '';
  const displayGrowthRate = localGrowthRate || GrowthRate || '';
  const displayMarketEntry = localMarketEntry || marketEntry || '';
  const displayStrategicRecommendations = localStrategicRecommendations.length > 0 ? localStrategicRecommendations : strategicRecommendations;
  const displayMarketDrivers = localMarketDrivers.length > 0 ? localMarketDrivers : marketDrivers;
  
  // Debug: Log display values when isEditing changes
  React.useEffect(() => {
    if (!isEditing) {
      console.log('👁️ Market Size - View mode display values:', {
        displayExecutiveSummary: displayExecutiveSummary.substring(0, 50),
        displayTamValue: displayTamValue,
        displaySamValue: displaySamValue,
        localExecutiveSummary: localExecutiveSummary.substring(0, 50),
        propExecutiveSummary: (executiveSummary || '').substring(0, 50),
        justSaved: justSavedRef.current
      });
    }
  }, [isEditing, displayExecutiveSummary, displayTamValue, displaySamValue, localExecutiveSummary, executiveSummary]);

  // Debug logging
  React.useEffect(() => {
    console.log('🔍 DEBUGGING: Component state and props:', {
      isEditing,
      localExecutiveSummary: localExecutiveSummary.substring(0, 50) + '...',
      propExecutiveSummary: (executiveSummary || '').substring(0, 50) + '...',
      timestamp: Date.now()
    });
  }, [isEditing, localExecutiveSummary, executiveSummary]);

  const handleMarketSizeSaveChanges = async () => {
    try {
      console.log('🚀 Market Size & Opportunity - Starting save operation');
      
      // Prepare original data
      const originalData = {
        section: 'market-size',
        executiveSummary: executiveSummary || '',
        tamValue: tamValue || '',
        samValue: samValue || '',
        GrowthRate: GrowthRate || '',
        strategicRecommendations: strategicRecommendations || [],
        marketEntry: marketEntry || '',
        marketDrivers: marketDrivers || []
      };

      // Prepare modified data using local state
      const modifiedData = {
        section: 'market-size',
        executiveSummary: localExecutiveSummary,
        tamValue: localTamValue,
        samValue: localSamValue,
        GrowthRate: localGrowthRate,
        strategicRecommendations: localStrategicRecommendations,
        marketEntry: localMarketEntry,
        marketDrivers: localMarketDrivers
      };

      console.log('📤 Market Size & Opportunity - original_json:', originalData);
      console.log('📤 Market Size & Opportunity - modified_json:', modifiedData);

      // Store data for /ask API (user-specific)
      if (currentUser?.uid) {
        setUserLocalStorage('market-size_original_json', JSON.stringify(originalData), currentUser.uid);
        setUserLocalStorage('market-size_modified_json', JSON.stringify(modifiedData), currentUser.uid);
      }

      // Call GET API to save edits using /ask endpoint with query parameters
      const queryParams = new URLSearchParams({
        original_json: JSON.stringify(originalData),
        modified_json: JSON.stringify(modifiedData),
        edit_type: "modification",
        section: "market_size"
      });
      
      const response = await fetch(`/api/ask?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 GET /ask status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // IMPORTANT: Set the flag FIRST before any state updates to prevent useEffect from overwriting
      justSavedRef.current = true;
      savedLocalStateRef.current = {
        executiveSummary: localExecutiveSummary,
        tamValue: localTamValue,
        samValue: localSamValue,
        GrowthRate: localGrowthRate,
        marketEntry: localMarketEntry,
        strategicRecommendations: [...localStrategicRecommendations],
        marketDrivers: [...localMarketDrivers]
      };

      console.log('💾 Market Size - Saving with local state:', {
        exec: localExecutiveSummary.substring(0, 30),
        tam: localTamValue,
        sam: localSamValue
      });

      // Update parent state with local values (trust the user's edits)
      // These updates are async, so local state will show immediately while props catch up
      onExecutiveSummaryChange(localExecutiveSummary);
      onTamValueChange(localTamValue);
      onSamValueChange(localSamValue);
      onGrowthRateChange(localGrowthRate);
      onStrategicRecommendationsChange(localStrategicRecommendations);
      onMarketEntryChange(localMarketEntry);
      onMarketDriversChange(localMarketDrivers);
      
      console.log('✅ Market Size & Opportunity - Parent state updated with local edits');
      console.log('✅ Market Size & Opportunity - Local state preserved for immediate UI refresh');
      console.log('✅ Market Size & Opportunity - Display values will be:', {
        displayExecutiveSummary: localExecutiveSummary.substring(0, 50),
        displayTamValue: localTamValue,
        displaySamValue: localSamValue
      });
      
      // Call the parent save function (this may set isEditing to false)
      // The flag is already set, so useEffect won't overwrite local state
      onSaveChanges();
      
      // Force a re-render AFTER onSaveChanges to ensure UI updates with local state
      // This ensures that when isEditing becomes false, the view mode renders with correct local state
      setTimeout(() => {
        forceUpdate();
        console.log('🔄 Market Size - Forced re-render after save');
      }, 10);
    } catch (error) {
      console.error('❌ Market Size & Opportunity - Error saving changes:', error);
      
      // Even if API fails, update parent state with local values
      justSavedRef.current = true;
      savedLocalStateRef.current = {
        executiveSummary: localExecutiveSummary,
        tamValue: localTamValue,
        samValue: localSamValue,
        GrowthRate: localGrowthRate,
        marketEntry: localMarketEntry,
        strategicRecommendations: [...localStrategicRecommendations],
        marketDrivers: [...localMarketDrivers]
      };
      
      onExecutiveSummaryChange(localExecutiveSummary);
      onTamValueChange(localTamValue);
      onSamValueChange(localSamValue);
      onGrowthRateChange(localGrowthRate);
      onStrategicRecommendationsChange(localStrategicRecommendations);
      onMarketEntryChange(localMarketEntry);
      onMarketDriversChange(localMarketDrivers);
      
      // Force a re-render to ensure UI updates immediately with local state values
      forceUpdate();
      
      // Still call the original save function even if API fails
      onSaveChanges();
    }
  };

  // Convert marketSizeBySegment from backend to chart format
  // Backend format: { "Enterprise": "45%", "Mid-Market": "35%", "SMB": "20%" }
  // Chart format: [{ name: "Enterprise", value: 45, color: "#..." }, ...]
  const segmentChartData = React.useMemo(() => {
    if (!marketSizeBySegment || Object.keys(marketSizeBySegment).length === 0) {
      return [];
    }
    
    const colors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'];
    return Object.entries(marketSizeBySegment).map(([segment, percentage], index) => {
      // Remove % sign and convert to number
      const value = parseFloat(percentage.replace('%', ''));
      return {
        name: segment,
        value: isNaN(value) ? 0 : value,
        color: colors[index % colors.length]
      };
    });
  }, [marketSizeBySegment]);

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
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              console.log('🔧 EDIT BUTTON CLICKED - Current isEditing:', isEditing);
              onToggleEdit();
            }} 
            className="text-blue-800 hover:text-blue-900"
          >
            <Edit className="h-4 w-4" />
          </Button>
          {!isSplitView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    onScoutIconClick('market-size');
                  }} 
                  className="text-blue-600 hover:text-blue-700 transition-all duration-200 relative"
                >
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                  <Bot className="h-5 w-5 relative z-10" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Chat with Scout</p>
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
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSection('executive-summary')} className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50 pointer-events-auto z-50">
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
                  value={localExecutiveSummary} 
                  onChange={(e) => {
                    console.log('🔧 Executive Summary onChange:', e.target.value);
                    setLocalExecutiveSummary(e.target.value);
                    onExecutiveSummaryChange(e.target.value);
                  }} 
                  className="w-full h-32 resize-none" 
                  placeholder="Enter executive summary..." 
                  autoFocus={false}
                />
              </div>
            </div>
          )}

          {/* Key Metrics Edit */}
          {!deletedSections.has('key-metrics') && (
            <div className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSection('key-metrics')} className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50 pointer-events-auto z-50">
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
                      value={localTamValue} 
                      onChange={(e) => {
                        console.log('🔧 TAM Value onChange:', e.target.value);
                        setLocalTamValue(e.target.value);
                        onTamValueChange(e.target.value);
                      }}
                      className="text-2xl font-bold text-blue-600 border-blue-200 focus:border-blue-400"
                      placeholder="e.g., $4.2B"
                    />
                  </div>
                  <div>
                    <Label htmlFor="samValue" className="text-sm font-medium text-gray-700 mb-2 block">
                      Serviceable Addressable Market
                    </Label>
                    <Input 
                      id="samValue"
                      value={localSamValue} 
                      onChange={(e) => {
                        console.log('🔧 SAM Value onChange:', e.target.value);
                        setLocalSamValue(e.target.value);
                        onSamValueChange(e.target.value);
                      }}
                      className="text-2xl font-bold text-green-600 border-green-200 focus:border-green-400"
                      placeholder="e.g., $2.1B"
                    />
                  </div>
                  <div>
                    <Label htmlFor="GrowthRate" className="text-sm font-medium text-gray-700 mb-2 block">
                      Growth Rate
                    </Label>
                    <Input 
                      id="GrowthRate"
                      value={localGrowthRate} 
                      onChange={(e) => {
                        console.log('🔧 Growth Rate onChange:', e.target.value);
                        setLocalGrowthRate(e.target.value);
                        onGrowthRateChange(e.target.value);
                      }}
                      className="text-2xl font-bold text-purple-600 border-purple-200 focus:border-purple-400"
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
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSection('strategic-recommendations')} className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50 pointer-events-auto z-50">
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
                {localStrategicRecommendations.map((rec, index) => (
                  <Textarea 
                    key={index} 
                    value={rec || ''} 
                    onChange={e => {
                      console.log(`🔧 Strategic Recommendation ${index} onChange:`, e.target.value);
                      const newRecs = [...localStrategicRecommendations];
                      newRecs[index] = e.target.value;
                      setLocalStrategicRecommendations(newRecs);
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
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSection('market-entry')} className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50 pointer-events-auto z-50">
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
                  value={localMarketEntry} 
                  onChange={(e) => {
                    console.log('🔧 Market Entry onChange:', e.target.value);
                    setLocalMarketEntry(e.target.value);
                    onMarketEntryChange(e.target.value);
                  }} 
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
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSection('market-drivers')} className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50 pointer-events-auto z-50">
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
                {localMarketDrivers.map((driver, index) => (
                  <Textarea 
                    key={index} 
                    value={driver || ''} 
                    onChange={e => {
                      console.log(`🔧 Market Driver ${index} onChange:`, e.target.value);
                      const newDrivers = [...localMarketDrivers];
                      newDrivers[index] = e.target.value;
                      setLocalMarketDrivers(newDrivers);
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
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    onScoutIconClick('market-size');
                  }} 
                  className="text-blue-600 hover:text-blue-700 transition-all duration-200 relative"
                >
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                  <Bot className="h-4 w-4 relative z-10" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Chat with Scout</p>
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
            <p className="text-gray-700 mb-6">{displayExecutiveSummary}</p>

            {/* Key Metrics Cards - Always Visible */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-blue-600">{displayTamValue}</div>
                <div className="text-sm font-medium text-gray-900">Total Addressable Market</div>
                <div className="text-xs text-gray-600">Growing 15% YoY</div>
              </div>
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-green-600">{displaySamValue}</div>
                <div className="text-sm font-medium text-gray-900">Serviceable Addressable Market</div>
                <div className="text-xs text-gray-600">Mid-market focus</div>
              </div>
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
                <div className="text-2xl font-bold text-purple-600">{displayGrowthRate}</div>
                <div className="text-sm font-medium text-gray-900">Growth Rate</div>
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
                      {displayStrategicRecommendations.map((rec, index) => (
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
                    <p className="text-gray-700">{displayMarketEntry}</p>
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
                      {displayMarketDrivers.map((driver, index) => (
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

                {/* Market Size by Segment Chart */}
                {segmentChartData.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-indigo-600" />
                      Market Size by Segment
                    </h3>
                    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                      <MiniPieChart 
                        data={segmentChartData}
                        title="Market Share by Segment"
                      />
                    </div>
                  </div>
                )}

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