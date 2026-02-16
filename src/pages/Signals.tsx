import { Filter, Check, X, Bookmark, MessageCircle, Info, Share2, Download, Bot, Send, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
type Agent = 'scout' | 'profiler';
type ActionType = 'accept' | 'dismiss' | 'save' | 'ask';
interface SignalCard {
  id: string;
  agent: Agent;
  timestamp: string;
  headline: string;
  snippet: string;
  sourceUrl: string;
  sourceLabel: string;
}
// API functions
const generateSignalsBatch = async (userId: string) => {
  try {
    const response = await fetch('/api/generate-signals-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        component_name: "test",
        data: {
          industry: "SaaS",
          companySize: "50-200 employees",
          companyUrl: "https://example.com",
          strategicGoals: "Market expansion",
          primaryGTMModel: "Direct sales",
          revenueStage: "Growth",
          keyBuyerPersona: "CTO",
          targetMarkets: ["North America", "Europe"]
        },
        refresh: true
      })
    });
    
    console.log('Generate signals response status:', response.status);
    console.log('Generate signals response headers:', response.headers);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Generate signals error response:', errorText);
      throw new Error(`Failed to generate signals: ${response.status} ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response:', text);
      throw new Error('Server returned non-JSON response');
    }
    
    return response.json();
  } catch (error) {
    console.error('Generate signals API error:', error);
    throw error;
  }
};

const fetchSignals = async (userId: string) => {
  try {
    const response = await fetch(`/api/fetch-signals?user_id=${userId}&limit=10`);
    
    console.log('Fetch signals response status:', response.status);
    console.log('Fetch signals response headers:', response.headers);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Fetch signals error response:', errorText);
      throw new Error(`Failed to fetch signals: ${response.status} ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response:', text);
      throw new Error('Server returned non-JSON response');
    }
    
    return response.json();
  } catch (error) {
    console.error('Fetch signals API error:', error);
    throw error;
  }
};

// Helper function to generate a stable content-based ID for a signal
const getSignalContentHash = (signal: SignalCard): string => {
  const content = `${signal.headline}-${signal.snippet}-${signal.agent}`;
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `signal-${Math.abs(hash).toString(36)}`;
};

const Index = () => {
  const { currentUser } = useAuth();
  const [currentTab, setCurrentTab] = useState('signals');
  const [signals, setSignals] = useState<SignalCard[]>([]);
  const [savedInsights, setSavedInsights] = useState<SignalCard[]>([]);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<SignalCard | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [savedInsightsFilter, setSavedInsightsFilter] = useState('all');
  const [expandedChats, setExpandedChats] = useState<{
    [key: string]: boolean;
  }>({});
  const [dismissedSuggestions, setDismissedSuggestions] = useState<{
    [key: string]: number[];
  }>({});
  const [acceptedSignals, setAcceptedSignals] = useState<Set<string>>(new Set());
  const [rejectedSignalHashes, setRejectedSignalHashes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const {
    toast
  } = useToast();

  // Load accepted and rejected signals from localStorage on mount
  useEffect(() => {
    if (currentUser?.uid) {
      const storageKey = `signals_${currentUser.uid}`;
      try {
        const savedAccepted = localStorage.getItem(`${storageKey}_accepted`);
        const savedRejected = localStorage.getItem(`${storageKey}_rejected`);
        
        if (savedAccepted) {
          const acceptedArray = JSON.parse(savedAccepted);
          setAcceptedSignals(new Set(acceptedArray));
        }
        
        if (savedRejected) {
          const rejectedArray = JSON.parse(savedRejected);
          setRejectedSignalHashes(new Set(rejectedArray));
        }
      } catch (error) {
        console.error('Error loading signals from localStorage:', error);
      }
    }
  }, [currentUser?.uid]);

  // Load signals on component mount
  useEffect(() => {
    if (currentUser?.uid) {
      loadSignals();
    }
  }, [currentUser?.uid]);

  // Listen for refresh event from header
  useEffect(() => {
    const handleSignalsRefresh = () => {
      handleRefresh();
    };

    window.addEventListener('signalsRefresh', handleSignalsRefresh);
    
    return () => {
      window.removeEventListener('signalsRefresh', handleSignalsRefresh);
    };
  }, []);

  const loadSignals = async () => {
    if (!currentUser?.uid) {
      console.error('User not authenticated');
      return;
    }
    setIsLoading(true);
    try {
      // Load rejected signals from localStorage directly to ensure they're available
      const storageKey = `signals_${currentUser.uid}`;
      let rejectedHashes = new Set<string>();
      try {
        const savedRejected = localStorage.getItem(`${storageKey}_rejected`);
        if (savedRejected) {
          const rejectedArray = JSON.parse(savedRejected);
          rejectedHashes = new Set(rejectedArray);
          // Also update state
          setRejectedSignalHashes(rejectedHashes);
        }
      } catch (error) {
        console.error('Error loading rejected signals from localStorage:', error);
      }
      
      const data = await fetchSignals(currentUser.uid);
      // Ensure all signals have unique IDs - always generate new unique IDs
      const rawSignals = data.signals || [];
      console.log('Raw signals from API:', rawSignals.map(s => ({ id: s.id, headline: s.headline })));
      console.log('Rejected signal hashes from localStorage:', Array.from(rejectedHashes));
      
      const signalsWithIds = rawSignals.map((signal: SignalCard, index: number) => {
        // Generate a truly unique ID for each signal
        // Use crypto.randomUUID if available, otherwise use a combination of timestamp, index, and random
        let uniqueId: string;
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          uniqueId = crypto.randomUUID();
        } else {
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 11);
          const perfNow = (performance?.now() || Math.random() * 1000).toString().replace('.', '');
          uniqueId = `signal-${timestamp}-${index}-${randomStr}-${perfNow}`;
        }
        
        return {
          ...signal,
          id: uniqueId
        };
      });
      
      // Verify all IDs are unique
      const ids = signalsWithIds.map(s => s.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        console.error('Duplicate signal IDs detected after generation!', ids);
        // Regenerate IDs if duplicates found using crypto.randomUUID or fallback
        signalsWithIds.forEach((signal, index) => {
          if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            signal.id = crypto.randomUUID();
          } else {
            signal.id = `signal-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 11)}-${performance?.now() || Math.random() * 1000}`;
          }
        });
      }
      
      console.log('Signals with unique IDs:', signalsWithIds.map(s => ({ id: s.id, headline: s.headline })));
      
      // Filter out rejected signals using content hash (using localStorage data directly)
      const filteredSignals = signalsWithIds.filter(signal => {
        const contentHash = getSignalContentHash(signal);
        const isRejected = rejectedHashes.has(contentHash);
        if (isRejected) {
          console.log('Filtering out rejected signal:', signal.headline, 'hash:', contentHash);
        }
        return !isRejected;
      });
      
      console.log('Filtered signals count:', filteredSignals.length, 'out of', signalsWithIds.length);
      setSignals(filteredSignals);
    } catch (error) {
      console.error('Error loading signals:', error);
      
      // Fallback to sample data for development
      const sampleSignals: SignalCard[] = [{
        id: '1',
        agent: 'scout',
        timestamp: '1h ago',
        headline: 'Competitor X launches SMB pricing tier.',
        snippet: 'Likely to impact your ICP accounts in mid-market SaaS segment.',
        sourceUrl: '#',
        sourceLabel: 'Press release link'
      }, {
        id: '2',
        agent: 'profiler',
        timestamp: '3h ago',
        headline: 'ICP contact posted about cloud migration struggles.',
        snippet: 'John Doe, CTO @ Acme Corp, shared LinkedIn update relevant to DRaaS.',
        sourceUrl: '#',
        sourceLabel: 'LinkedIn post link'
      }, {
        id: '3',
        agent: 'scout',
        timestamp: '5h ago',
        headline: 'New funding round announced in AI automation space.',
        snippet: 'Series B round indicates growing market confidence in automation solutions.',
        sourceUrl: '#',
        sourceLabel: 'TechCrunch article'
      }, {
        id: '4',
        agent: 'profiler',
        timestamp: 'Today',
        headline: 'New ICP segment identified: FinTech startups (50–200 employees).',
        snippet: 'High engagement signals found in EU market; strong overlap with your existing SaaS ICP.',
        sourceUrl: '#',
        sourceLabel: 'Profiler internal analysis'
      }];
      
      // Load rejected signals from localStorage for sample data too
      const storageKey = `signals_${currentUser.uid}`;
      let rejectedHashes = new Set<string>();
      try {
        const savedRejected = localStorage.getItem(`${storageKey}_rejected`);
        if (savedRejected) {
          const rejectedArray = JSON.parse(savedRejected);
          rejectedHashes = new Set(rejectedArray);
        }
      } catch (error) {
        console.error('Error loading rejected signals from localStorage:', error);
      }
      
      // Filter out rejected sample signals using content hash
      const filteredSampleSignals = sampleSignals.filter(signal => {
        const contentHash = getSignalContentHash(signal);
        return !rejectedHashes.has(contentHash);
      });
      
      setSignals(filteredSampleSignals);
      
      toast({
        title: "API Not Available",
        description: "Using sample data. Please ensure your backend API is running.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!currentUser?.uid) {
      console.error('User not authenticated');
      return;
    }
    setIsRefreshing(true);
    // Notify header that refresh started
    window.dispatchEvent(new CustomEvent('signalsRefreshStart'));
    
    try {
      await generateSignalsBatch(currentUser.uid);
      await loadSignals();
      toast({
        title: "Success",
        description: "New signals generated successfully!",
      });
    } catch (error) {
      console.error('Error refreshing signals:', error);
      toast({
        title: "API Error",
        description: "Failed to generate new signals. Please check if your backend API is running and accessible.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
      // Notify header that refresh ended
      window.dispatchEvent(new CustomEvent('signalsRefreshEnd'));
    }
  };

  const handleSuggestionAccept = (signalId: string, suggestionIndex: number) => {
    const chatKey = `${signalId}-${suggestionIndex}`;
    setExpandedChats(prev => ({
      ...prev,
      [chatKey]: true
    }));
  };
  const handleSuggestionDismiss = (signalId: string, suggestionIndex: number) => {
    setDismissedSuggestions(prev => ({
      ...prev,
      [signalId]: [...(prev[signalId] || []), suggestionIndex]
    }));
    toast({
      title: "Dismissed",
      description: "Suggestion removed from your list",
      action: <Button variant="outline" size="sm" onClick={() => {
        setDismissedSuggestions(prev => ({
          ...prev,
          [signalId]: (prev[signalId] || []).filter(idx => idx !== suggestionIndex)
        }));
      }}>
          Undo
        </Button>
    });
  };
  const handleChatClose = (signalId: string, suggestionIndex: number) => {
    const chatKey = `${signalId}-${suggestionIndex}`;
    setExpandedChats(prev => ({
      ...prev,
      [chatKey]: false
    }));
  };
  const getContextualChatMessage = (signalId: string, suggestionIndex: number) => {
    const signal = signals.find(s => s.id === signalId);
    if (!signal) return "";
    if (signal.headline.toLowerCase().includes('competitor') && signal.headline.toLowerCase().includes('pricing')) {
      const messages = ["Hi Alex, Noted. I'll adjust your competitor landscape and market size reports accordingly. Do you want me to also scan SMB prospects in your current pipeline?", "Perfect! I'll model competitive pricing scenarios for you. Should I also identify which of your current deals might be at risk?", "Great choice! I'll set up sentiment tracking across multiple platforms. Want me to create alerts for specific keywords or competitors?"];
      return messages[suggestionIndex] || messages[0];
    }
    return "Hi Alex, Noted. I'll process this request and update your reports accordingly. Any specific notes or comments you'd like me to capture for this insight?";
  };
  const handleAction = (cardId: string, action: ActionType) => {
    const signal = signals.find(s => s.id === cardId);
    if (!signal) return;
    if (action === 'accept' || action === 'save') {
      if (!savedInsights.find(s => s.id === cardId)) {
        setSavedInsights(prev => [signal, ...prev]);
      }
    } else if (action === 'ask') {
      setSelectedSignal(signal);
      setChatDrawerOpen(true);
    }
    console.log(`Action ${action} on card ${cardId}`);
  };
  const getAgentBadge = (agent: Agent) => {
    if (agent === 'scout') {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
          🔵 From Scout
        </Badge>;
    }
    return <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">
        🟣 From Profiler
      </Badge>;
  };
  const getContextualGreeting = (signal: SignalCard) => {
    const name = "Alex"; // This would come from user context in real app
    return `Hi ${name} 👋, I'm ready to delegate this insight for you. Please instruct.`;
  };
  
  const getContextualSuggestions = (signal: SignalCard) => {
    if (signal.headline.toLowerCase().includes('competitor') && signal.headline.toLowerCase().includes('pricing')) {
      return [
        { icon: '🔗', text: 'Get Company X\'s Website & Press Release' },
        { icon: '🧑‍💼', text: 'Identify decision makers at Company X' },
        { icon: '📊', text: 'Compare SMB pricing vs. our offering' },
        { icon: '🚀', text: 'Monitor early adoption signals from Company X' },
        { icon: '📅', text: 'Track mentions of SMB tier in LinkedIn updates' }
      ];
    }
    
    if (signal.headline.toLowerCase().includes('icp') && signal.headline.toLowerCase().includes('segment')) {
      return [
        { icon: '🎯', text: 'Research FinTech segment decision makers' },
        { icon: '📈', text: 'Analyze EU market penetration opportunities' },
        { icon: '🔍', text: 'Find similar companies matching this profile' },
        { icon: '📋', text: 'Create tailored value proposition' },
        { icon: '📧', text: 'Draft outreach sequences for this segment' }
      ];
    }
    
    if (signal.sourceLabel.toLowerCase().includes('linkedin')) {
      return [
        { icon: '💬', text: 'Draft contextual comment for this post' },
        { icon: '🤝', text: 'Prepare connection request message' },
        { icon: '🔄', text: 'Find similar prospects with same challenges' },
        { icon: '📊', text: 'Analyze engagement patterns' },
        { icon: '📝', text: 'Create follow-up sequence' }
      ];
    }
    
    if (signal.headline.toLowerCase().includes('funding')) {
      return [
        { icon: '💰', text: 'Analyze funding impact on market positioning' },
        { icon: '🏢', text: 'Identify potential acquisition targets' },
        { icon: '📈', text: 'Map competitive landscape changes' },
        { icon: '🎯', text: 'Find prospects considering this competitor' },
        { icon: '📋', text: 'Draft competitive differentiation messaging' }
      ];
    }
    
    // Default suggestions
    return [
      { icon: '🔍', text: 'Research deeper context and implications' },
      { icon: '📊', text: 'Analyze impact on your ICP segments' },
      { icon: '💡', text: 'Generate actionable next steps' },
      { icon: '📈', text: 'Monitor for similar signals' },
      { icon: '📝', text: 'Create summary for weekly digest' }
    ];
  };
  const getNextBestMoves = (signal: SignalCard) => {
    if (signal.headline.toLowerCase().includes('competitor') && signal.headline.toLowerCase().includes('pricing')) {
      return ["Would you like me to check how many of your target ICPs fall under the SMB segment and could be influenced by this move?", "Do you want me to model a competitive bundle or ROI-driven value pitch against this pricing shift?", "Should I track customer sentiment on LinkedIn, G2 reviews, or forums to see if it's gaining traction?"];
    }
    if (signal.headline.toLowerCase().includes('funding') || signal.headline.toLowerCase().includes('competitor')) {
      return ["Want me to analyze how this affects your competitive positioning in the market?", "Should I identify which of your prospects might be considering this competitor now?", "Do you want me to draft messaging that highlights your differentiators against this move?"];
    }
    if (signal.headline.toLowerCase().includes('icp') || signal.headline.toLowerCase().includes('hiring')) {
      return ["Should I prioritize outreach to decision makers in this new segment?", "Want me to create a tailored value proposition for this ICP profile?", "Do you want me to identify similar companies that match this profile?"];
    }
    if (signal.sourceLabel.toLowerCase().includes('linkedin')) {
      return ["Should I draft a contextual comment or connection request for this post?", "Want me to identify other prospects posting about similar challenges?", "Do you want me to create a follow-up sequence based on this signal?"];
    }
    return ["Should I analyze the broader implications of this development for your market?", "Want me to identify opportunities this creates for your sales approach?", "Do you want me to monitor for similar signals in your industry?"];
  };
  const handleAcceptSignal = (signalId: string) => {
    if (!currentUser?.uid) return;
    
    // Find the signal to get its content hash
    const signal = signals.find(s => s.id === signalId);
    if (!signal) return;
    
    const contentHash = getSignalContentHash(signal);
    
    if (!acceptedSignals.has(contentHash)) {
      const newAccepted = new Set([...acceptedSignals, contentHash]);
      setAcceptedSignals(newAccepted);
      
      // Save to localStorage
      const storageKey = `signals_${currentUser.uid}`;
      try {
        localStorage.setItem(`${storageKey}_accepted`, JSON.stringify(Array.from(newAccepted)));
      } catch (error) {
        console.error('Error saving accepted signals to localStorage:', error);
      }
      
      toast({
        title: "Signal accepted",
        description: "This signal has been marked as accepted.",
      });
    }
  };

  const handleRejectSignal = (signalId: string) => {
    if (!currentUser?.uid) return;
    
    // Find the signal to get its content hash
    const signal = signals.find(s => s.id === signalId);
    if (!signal) return;
    
    const contentHash = getSignalContentHash(signal);
    
    // Remove from signals list
    setSignals(prev => prev.filter(s => s.id !== signalId));
    
    // Remove from accepted if it was accepted (using content hash)
    setAcceptedSignals(prev => {
      const newSet = new Set(prev);
      newSet.delete(contentHash);
      
      // Update localStorage
      const storageKey = `signals_${currentUser.uid}`;
      try {
        localStorage.setItem(`${storageKey}_accepted`, JSON.stringify(Array.from(newSet)));
      } catch (error) {
        console.error('Error updating accepted signals in localStorage:', error);
      }
      
      return newSet;
    });
    
    // Add to rejected list (using content hash)
    const newRejected = new Set([...rejectedSignalHashes, contentHash]);
    setRejectedSignalHashes(newRejected);
    
    // Save rejected signals to localStorage
    const storageKey = `signals_${currentUser.uid}`;
    try {
      localStorage.setItem(`${storageKey}_rejected`, JSON.stringify(Array.from(newRejected)));
    } catch (error) {
      console.error('Error saving rejected signals to localStorage:', error);
    }
    
    toast({
      title: "Signal removed",
      description: "This signal has been removed from your list.",
    });
  };

  const filteredSavedInsights = savedInsightsFilter === 'all' ? savedInsights : savedInsights.filter(insight => {
    if (savedInsightsFilter === 'competitor') return insight.headline.toLowerCase().includes('competitor');
    if (savedInsightsFilter === 'icp') return insight.headline.toLowerCase().includes('icp');
    if (savedInsightsFilter === 'industry') return insight.headline.toLowerCase().includes('industry') || insight.headline.toLowerCase().includes('funding');
    if (savedInsightsFilter === 'linkedin') return insight.sourceLabel.toLowerCase().includes('linkedin');
    return true;
  });
  return (
    <Layout>
      <div className="p-6">
        {currentTab === 'signals' && <div className="max-w-4xl mx-auto space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading signals...</p>
              </div>
            ) : signals.length === 0 ? (
              <div className="text-center py-12">
                <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No signals available</h3>
                <p className="text-gray-500 mb-4">Click refresh in the header to generate new signals</p>
              </div>
            ) : (
              signals.map(signal => {
                const contentHash = getSignalContentHash(signal);
                const isAccepted = acceptedSignals.has(contentHash);
                
                return <div key={signal.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-lg transition-all duration-200">
                {/* Card Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    
                    {getAgentBadge(signal.agent)}
                    <span className="text-sm text-gray-500">•</span>
                    <span className="text-sm text-gray-500">{signal.timestamp}</span>
                    {isAccepted && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                        Accepted
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-8 w-8 p-0 ${
                        isAccepted
                          ? 'text-green-600 bg-green-50'
                          : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAcceptSignal(signal.id);
                      }}
                      disabled={isAccepted}
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRejectSignal(signal.id);
                      }}
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Card Body */}
                <div className="mb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {signal.headline}
                        </h3>
                         {/* <div className="flex items-center gap-3">
                           <button 
                             className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                             onClick={() => toast({
                               title: "Added",
                               description: "This insight will be included in your weekly digest and sent to your registered email.",
                               duration: 3000,
                             })}
                           >
                             ➕ Add to my Weekly Digest
                           </button>
                           <button 
                             className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-md text-gray-700 flex items-center gap-1"
                             onClick={() => handleAction(signal.id, 'ask')}
                           >
                             💬 Discuss with Agent
                           </button>
                         </div> */}
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed mb-2">
                        {signal.snippet}
                      </p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Source: {signal.sourceLabel}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  
                  {/* Next Best Moves Section */}
                  {/* <div className="mt-2 pt-2 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Next Best Moves</h4>
                    <div className="space-y-1">
                      {getNextBestMoves(signal).map((move, index) => {
                  const chatKey = `${signal.id}-${index}`;
                  const isDismissed = dismissedSuggestions[signal.id]?.includes(index);
                  const hasExpandedChat = expandedChats[chatKey];
                  if (isDismissed) return null;
                  return <div key={index}>
                            <div className="group relative bg-gray-50 hover:bg-gray-100 p-2 rounded-lg transition-all duration-200 border border-transparent hover:border-gray-200">
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-700 pr-4">{move}</p>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-2">
                                  <Button size="sm" variant="outline" className="h-7 px-3 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100" onClick={() => handleSuggestionAccept(signal.id, index)}>
                                    ✅ Accept
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-3 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100" onClick={() => handleSuggestionDismiss(signal.id, index)}>
                                    ❌ Dismiss
                                  </Button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Inline Chat Expansion */}
                            {/* {hasExpandedChat && <div className="mt-2 bg-white border border-gray-200 rounded-lg p-3 animate-fade-in shadow-sm">
                                <div className="flex items-start gap-3 mb-2">
                                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Bot className="h-4 w-4 text-white" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm text-gray-700 mb-2">
                                      {getContextualChatMessage(signal.id, index)}
                                    </p>
                                  </div>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600" onClick={() => handleChatClose(signal.id, index)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                
                                <div className="flex gap-2 ml-11">
                                  <Input placeholder="Any specific notes or comments you'd like to capture..." className="flex-1 text-sm" />
                                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                    <Send className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>}
                          </div>;
                })}
                    </div>
                  </div> */}
                </div>

                {/* Card Actions */}
                {/* <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300" onClick={() => handleAction(signal.id, 'save')}>
                    <Bookmark className="h-4 w-4 mr-1" />
                    Save for Later
                  </Button>
                </div> */}
              </div>;
              })
            )}
          </div>}

        {currentTab === 'saved' && <div className="max-w-4xl mx-auto">
            {filteredSavedInsights.length === 0 ? <div className="text-center py-12">
                <Bookmark className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No saved insights yet</h3>
                <p className="text-gray-500">Accept or save signals to build your reading list</p>
              </div> : <div className="space-y-3">
                {filteredSavedInsights.map(insight => <div key={insight.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${insight.agent === 'scout' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                            <Bot className="h-3 w-3" />
                          </div>
                          {getAgentBadge(insight.agent)}
                          <span className="text-sm text-gray-500">•</span>
                          <span className="text-sm text-gray-500">{insight.timestamp}</span>
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">{insight.headline}</h4>
                        <p className="text-sm text-gray-600">{insight.snippet}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button variant="ghost" size="sm" onClick={() => handleAction(insight.id, 'ask')}>
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>)}
              </div>}
          </div>}
      </div>

      {/* Chat Drawer */}
      <Drawer open={chatDrawerOpen} onOpenChange={setChatDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div>
                  <DrawerTitle className="text-base font-semibold">Agent Discussion</DrawerTitle>
                  <p className="text-xs text-gray-600">
                    {selectedSignal ? getContextualGreeting(selectedSignal) : 'Let\'s analyze this signal together'}
                  </p>
                </div>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          
          <div className="px-4 pb-4 flex-1 overflow-y-auto">
            {selectedSignal && (
              <div className="space-y-3">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-1">{selectedSignal.headline}</h3>
                  <p className="text-xs text-gray-600">{selectedSignal.snippet}</p>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-900">Quick Actions:</h4>
                  <div className="grid grid-cols-1 gap-1.5">
                    {getContextualSuggestions(selectedSignal).map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start text-left h-auto p-2 bg-white hover:bg-blue-50 border-gray-200 hover:border-blue-300"
                        onClick={() => {
                          toast({
                            title: "Task delegated to Agent",
                            description: suggestion.text,
                          });
                          setChatDrawerOpen(false);
                        }}
                      >
                        <span className="mr-2 text-sm">{suggestion.icon}</span>
                        <span className="text-xs">{suggestion.text}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700">
                    Add specific notes or comments for this insight:
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Type your thoughts, questions, or specific instructions..."
                      className="flex-1 text-sm"
                    />
                    <Button 
                      onClick={() => {
                        if (chatMessage.trim()) {
                          toast({
                            title: "Notes saved",
                            description: "Your comments have been attached to this insight",
                          });
                          setChatMessage('');
                          setChatDrawerOpen(false);
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                      size="sm"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
       </Drawer>
       
       <Toaster />
     </Layout>
   );
 };
 export default Index;