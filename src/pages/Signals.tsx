import { Filter, Check, X, Bookmark, MessageCircle, Info, Share2, Download, Bot, Send, RefreshCw, ThumbsUp, ThumbsDown, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { sanitizeAnswerText } from '@/lib/utils';
type Agent = 'scout' | 'profiler';
type ActionType = 'accept' | 'dismiss' | 'save' | 'ask';
interface ContextualSuggestion {
  icon: string;
  text: string;
}

/** Recommendation from API: nba shown to user, prompt passed to future LLM API */
interface NBAItem {
  nba: string;
  prompt: string;
}

/** Source citation: display text and link URL */
interface SourceCitation {
  citation: string;
  url: string;
}

interface SignalCard {
  id: string;
  agent: Agent;
  timestamp: string;
  headline: string;
  snippet: string;
  description: string; // One full paragraph with detailed ICP/customer context
  sourceUrl: string;
  sourceLabel: string;
  /** Citations from API: citation text + url (click opens url) */
  source?: SourceCitation[];
  nextBestMoves: string[]; // Array of suggested actions (legacy)
  /** Recommendations: nba shown to user, prompt for future API */
  NBAs?: NBAItem[];
  contextualSuggestions: ContextualSuggestion[];
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

const signalAsk = async (body: { org_id: string; user_id: string; question: string; history: { user: string; assistant: string }[] }) => {
  try {
    const response = await fetch('/api/signal_Ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`signal_Ask failed: ${response.status} ${text}`);
    }
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('signal_Ask error:', err);
    throw err;
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

const signalAction = async (orgId: string, signalId: string, action: 'accept' | 'reject') => {
  try {
    const response = await fetch('/api/signal_action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        org_id: orgId,
        signal_id: signalId,
        action: action
      })
    });
    
    console.log('Signal action response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Signal action error response:', errorText);
      throw new Error(`Failed to ${action} signal: ${response.status} ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response:', text);
      throw new Error('Server returned non-JSON response');
    }
    
    return response.json();
  } catch (error) {
    console.error('Signal action API error:', error);
    throw error;
  }
};

// Helper function to generate a stable content-based ID for a signal
const getSignalContentHash = (signal: SignalCard): string => {
  const content = `${signal.headline}-${signal.snippet}-${signal.description || ''}-${signal.agent}`;
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `signal-${Math.abs(hash).toString(36)}`;
};

// Helper function to parse timestamp and return a comparable number (higher = newer)
const parseTimestamp = (timestamp: string): number => {
  // Try parsing as ISO 8601 date first
  const isoDate = new Date(timestamp);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.getTime();
  }
  
  // Handle relative timestamps
  const now = Date.now();
  const lowerTimestamp = timestamp.toLowerCase().trim();
  
  // Handle "Today"
  if (lowerTimestamp === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  }
  
  // Handle "Xh ago", "Xm ago", "Xd ago", etc.
  const hourMatch = lowerTimestamp.match(/(\d+)\s*h\s*ago/);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    return now - (hours * 60 * 60 * 1000);
  }
  
  const minuteMatch = lowerTimestamp.match(/(\d+)\s*m\s*ago/);
  if (minuteMatch) {
    const minutes = parseInt(minuteMatch[1], 10);
    return now - (minutes * 60 * 1000);
  }
  
  const dayMatch = lowerTimestamp.match(/(\d+)\s*d\s*ago/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    return now - (days * 24 * 60 * 60 * 1000);
  }
  
  // If we can't parse it, return 0 (will be sorted to the end)
  console.warn('Unable to parse timestamp:', timestamp);
  return 0;
};

const Index = () => {
  const { currentUser, orgId } = useAuth();
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState('signals');
  const [signals, setSignals] = useState<SignalCard[]>([]);
  const [savedInsights, setSavedInsights] = useState<SignalCard[]>([]);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<SignalCard | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  /** Which recommendation's prompt is expanded: { signalId, index } */
  const [expandedRecommendation, setExpandedRecommendation] = useState<{ signalId: string; index: number } | null>(null);
  /** Cached answers from signal_Ask for each recommendation: key = `${signalId}-${index}` */
  const [recommendationAnswers, setRecommendationAnswers] = useState<Record<string, string>>({});
  /** Key of recommendation currently loading answer */
  const [recommendationAnswerLoading, setRecommendationAnswerLoading] = useState<string | null>(null);
  /** Keys of answers that are expanded (full view): `${signalId}-${index}` */
  const [answerExpandedKeys, setAnswerExpandedKeys] = useState<Set<string>>(new Set());

  // Reset answer expanded state when recommendation block is collapsed
  useEffect(() => {
    if (!expandedRecommendation) {
      setAnswerExpandedKeys(new Set());
    }
  }, [expandedRecommendation]);
  /** True when current signals (and recommendations) came from GET /api/fetch-signals; false when using sample fallback */
  const [signalsFromApi, setSignalsFromApi] = useState(false);
  const [savedInsightsFilter, setSavedInsightsFilter] = useState('all');
  const [acceptedSignals, setAcceptedSignals] = useState<Set<string>>(new Set());
  const [rejectedSignalHashes, setRejectedSignalHashes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  // Track pending rejections for undo functionality
  const [pendingRejections, setPendingRejections] = useState<Map<string, {
    signal: SignalCard;
    originalIndex: number;
    timer: ReturnType<typeof setTimeout>;
  }>>(new Map());
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
    const handleSignalsStateChanged = () => {
      if (currentUser?.uid) {
        const storageKey = `signals_${currentUser.uid}`;
        try {
          const savedAccepted = localStorage.getItem(`${storageKey}_accepted`);
          const savedRejected = localStorage.getItem(`${storageKey}_rejected`);
          if (savedAccepted) setAcceptedSignals(new Set(JSON.parse(savedAccepted)));
          if (savedRejected) setRejectedSignalHashes(new Set(JSON.parse(savedRejected)));
          loadSignals();
        } catch (e) {
          console.error('Error syncing signals state:', e);
        }
      }
    };

    window.addEventListener('signalsRefresh', handleSignalsRefresh);
    window.addEventListener('signalsStateChanged', handleSignalsStateChanged);
    return () => {
      window.removeEventListener('signalsRefresh', handleSignalsRefresh);
      window.removeEventListener('signalsStateChanged', handleSignalsStateChanged);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  // Fetch answer when recommendation is expanded (prompt sent to signal_Ask)
  useEffect(() => {
    if (!expandedRecommendation || !currentUser?.uid || !orgId) return;
    const { signalId, index } = expandedRecommendation;
    const signal = signals.find((s) => s.id === signalId);
    if (!signal) return;
    const list: NBAItem[] = (signal.NBAs && signal.NBAs.length > 0)
      ? signal.NBAs
      : (signal.nextBestMoves || []).map((m) => ({ nba: m, prompt: '' }));
    const item = list[index];
    if (!item || !(item.prompt ?? '').trim()) return;
    const key = `${signalId}-${index}`;
    if (recommendationAnswers[key]) return;
    setRecommendationAnswerLoading(key);
    signalAsk({
      org_id: orgId,
      user_id: currentUser.uid,
      question: item.prompt,
      history: [],
    })
      .then((res) => {
        const answer = res?.answer ?? res?.response ?? (typeof res === 'string' ? res : '');
        setRecommendationAnswers((prev) => ({ ...prev, [key]: String(answer) }));
      })
      .catch((err) => {
        console.error('signal_Ask for recommendation error:', err);
        toast({
          title: 'Error',
          description: 'Failed to load recommendation answer. Please try again.',
          variant: 'destructive',
        });
      })
      .finally(() => setRecommendationAnswerLoading(null));
  }, [expandedRecommendation, signals, currentUser?.uid, orgId, recommendationAnswers, toast]);

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
      console.log('Raw signals from API:', rawSignals.map(s => ({ 
        signal_id: s.signal_id, 
        id: s.id, 
        headline: s.headline 
      })));
      console.log('Rejected signal hashes from localStorage:', Array.from(rejectedHashes));
      
      const signalsWithIds = rawSignals.map((signal: any, index: number) => {
        // Use signal_id from API if available, otherwise fall back to id or generate unique ID
        // The API should return signal_id field - use it as the primary identifier for API calls
        let signalId: string;
        if (signal.signal_id) {
          signalId = signal.signal_id;
          console.log(`Using signal_id from API for signal ${index}:`, signalId);
        } else if (signal.id) {
          signalId = signal.id;
          console.warn(`Signal ${index} missing signal_id, using id field instead:`, signalId);
        } else {
          // Generate a truly unique ID for each signal as fallback
          if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            signalId = crypto.randomUUID();
          } else {
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 11);
            const perfNow = (performance?.now() || Math.random() * 1000).toString().replace('.', '');
            signalId = `signal-${timestamp}-${index}-${randomStr}-${perfNow}`;
          }
          console.warn(`Signal ${index} missing both signal_id and id, generated fallback ID:`, signalId);
        }
        
        // Support both schemas: NBAs (nba + prompt) or legacy nextBestMoves
        const nextBestMoves = signal.nextBestMoves || [];
        const NBAs: NBAItem[] = Array.isArray(signal.NBAs) && signal.NBAs.length > 0
          ? signal.NBAs.map((n: { nba?: string; prompt?: string }) => ({
              nba: n.nba ?? '',
              prompt: n.prompt ?? ''
            }))
          : nextBestMoves.map((m: string) => ({ nba: m, prompt: '' }));

        const sourceRaw = signal.source;
        const source: SourceCitation[] = Array.isArray(sourceRaw)
          ? sourceRaw.map((s: SourceCitation | string) =>
              typeof s === 'object' && s !== null && 'citation' in s && 'url' in s
                ? { citation: (s as SourceCitation).citation ?? '', url: (s as SourceCitation).url ?? '' }
                : { citation: typeof s === 'string' ? s : '', url: typeof s === 'string' && /^https?:\/\//i.test(s) ? s : '' }
            ).filter((c) => c.citation || c.url)
          : [];

        return {
          ...signal,
          id: signalId,
          description: signal.description || '',
          source,
          nextBestMoves,
          NBAs,
          contextualSuggestions: signal.contextualSuggestions || []
        } as SignalCard;
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
      
      // Sort signals by timestamp in descending order (newest first)
      const sortedSignals = filteredSignals.sort((a, b) => {
        const timestampA = parseTimestamp(a.timestamp);
        const timestampB = parseTimestamp(b.timestamp);
        return timestampB - timestampA; // Descending order (newest first)
      });
      
      console.log('Filtered signals count:', filteredSignals.length, 'out of', signalsWithIds.length);
      console.log('Signals sorted by timestamp (newest first):', sortedSignals.map(s => ({ timestamp: s.timestamp, headline: s.headline })));
      setSignals(sortedSignals);
      setSignalsFromApi(true);
      if (rawSignals.length > 0) {
        const first = rawSignals[0];
        const hasNBAs = Array.isArray(first.NBAs) && first.NBAs.length > 0;
        console.log('Signals loaded:', { source: 'API (fetch-signals)', firstSignalNBAsFromApi: hasNBAs, firstSignalRecommendationCount: first.NBAs?.length ?? first.nextBestMoves?.length ?? 0 });
      }
    } catch (error) {
      console.error('Error loading signals:', error);
      
      // Fallback to sample data for development
      const sampleSignals: SignalCard[] = [{
        id: '1',
        agent: 'scout',
        timestamp: '1h ago',
        headline: 'Competitor X launches SMB pricing tier.',
        snippet: 'Likely to impact your ICP accounts in mid-market SaaS segment.',
        description: 'This competitive pricing move by Company X directly impacts your SMB segment in the mid-market SaaS space. With 40% of your current pipeline falling into this category, this development could accelerate decision timelines or create pricing pressure. The launch targets companies with 50-200 employees—your core ICP—and includes features that overlap with your value proposition. Consider monitoring early adoption signals and preparing competitive differentiation messaging that emphasizes your unique ROI model and enterprise-grade capabilities.',
        sourceUrl: '#',
        sourceLabel: 'Press release link',
        source: [
          { citation: 'Press Release - Company X SMB Tier', url: 'https://example.com/press-release' },
          { citation: 'Industry report 2024', url: 'https://example.com/industry-report' },
        ],
        nextBestMoves: [
          'Would you like me to check how many of your target ICPs fall under the SMB segment and could be influenced by this move?',
          'Do you want me to model a competitive bundle or ROI-driven value pitch against this pricing shift?',
          'Should I track customer sentiment on LinkedIn, G2 reviews, or forums to see if it\'s gaining traction?'
        ],
        NBAs: [
          { nba: 'Would you like me to check how many of your target ICPs fall under the SMB segment and could be influenced by this move?', prompt: '' },
          { nba: 'Do you want me to model a competitive bundle or ROI-driven value pitch against this pricing shift?', prompt: '' },
          { nba: 'Should I track customer sentiment on LinkedIn, G2 reviews, or forums to see if it\'s gaining traction?', prompt: '' }
        ],
        contextualSuggestions: [
          { icon: '🔗', text: 'Get Company X\'s Website & Press Release' },
          { icon: '🧑‍💼', text: 'Identify decision makers at Company X' },
          { icon: '📊', text: 'Compare SMB pricing vs. our offering' },
          { icon: '🚀', text: 'Monitor early adoption signals from Company X' },
          { icon: '📅', text: 'Track mentions of SMB tier in LinkedIn updates' }
        ]
      }, {
        id: '2',
        agent: 'profiler',
        timestamp: '3h ago',
        headline: 'ICP contact posted about cloud migration struggles.',
        snippet: 'John Doe, CTO @ Acme Corp, shared LinkedIn update relevant to DRaaS.',
        description: 'John Doe, CTO at Acme Corp (a company matching your ICP profile with 150 employees in the FinTech sector), posted about challenges with cloud migration and data recovery strategies. This represents a strong buying signal as Acme Corp is actively evaluating solutions in your space. The post indicates urgency and budget allocation for DRaaS solutions, making this an ideal time for targeted outreach with relevant case studies and ROI messaging.',
        sourceUrl: '#',
        sourceLabel: 'LinkedIn post link',
        source: [{ citation: 'LinkedIn post link', url: 'https://linkedin.com/post/example' }],
        nextBestMoves: [
          'Should I draft a contextual comment or connection request for this post?',
          'Want me to identify other prospects posting about similar challenges?',
          'Do you want me to create a follow-up sequence based on this signal?'
        ],
        NBAs: [
          { nba: 'Should I draft a contextual comment or connection request for this post?', prompt: '' },
          { nba: 'Want me to identify other prospects posting about similar challenges?', prompt: '' },
          { nba: 'Do you want me to create a follow-up sequence based on this signal?', prompt: '' }
        ],
        contextualSuggestions: [
          { icon: '💬', text: 'Draft contextual comment for this post' },
          { icon: '🤝', text: 'Prepare connection request message' },
          { icon: '🔄', text: 'Find similar prospects with same challenges' },
          { icon: '📊', text: 'Analyze engagement patterns' },
          { icon: '📝', text: 'Create follow-up sequence' }
        ]
      }, {
        id: '3',
        agent: 'scout',
        timestamp: '5h ago',
        headline: 'New funding round announced in AI automation space.',
        snippet: 'Series B round indicates growing market confidence in automation solutions.',
        description: 'A Series B funding round of $25M was announced for a competitor in the AI automation space, signaling strong market confidence and potential for aggressive expansion. This development could impact your competitive positioning, especially in the enterprise segment where both companies target similar buyer personas. The funding suggests increased marketing spend and product development, which may accelerate market education but also intensify competition for your target accounts.',
        sourceUrl: '#',
        sourceLabel: 'TechCrunch article',
        source: [{ citation: 'TechCrunch article', url: 'https://techcrunch.com/article-example' }],
        nextBestMoves: [
          'Want me to analyze how this affects your competitive positioning in the market?',
          'Should I identify which of your prospects might be considering this competitor now?',
          'Do you want me to draft messaging that highlights your differentiators against this move?'
        ],
        NBAs: [
          { nba: 'Want me to analyze how this affects your competitive positioning in the market?', prompt: '' },
          { nba: 'Should I identify which of your prospects might be considering this competitor now?', prompt: '' },
          { nba: 'Do you want me to draft messaging that highlights your differentiators against this move?', prompt: '' }
        ],
        contextualSuggestions: [
          { icon: '💰', text: 'Analyze funding impact on market positioning' },
          { icon: '🏢', text: 'Identify potential acquisition targets' },
          { icon: '📈', text: 'Map competitive landscape changes' },
          { icon: '🎯', text: 'Find prospects considering this competitor' },
          { icon: '📋', text: 'Draft competitive differentiation messaging' }
        ]
      }, {
        id: '4',
        agent: 'profiler',
        timestamp: 'Today',
        headline: 'New ICP segment identified: FinTech startups (50–200 employees).',
        snippet: 'High engagement signals found in EU market; strong overlap with your existing SaaS ICP.',
        description: 'Analysis of market signals reveals a new high-value ICP segment: FinTech startups with 50-200 employees, particularly in the EU market. This segment shows strong engagement patterns with solutions similar to yours, with 65% overlap in key buying criteria with your existing SaaS ICP. The segment demonstrates high growth potential and budget allocation for automation tools, making it an ideal expansion target for your sales efforts.',
        sourceUrl: '#',
        sourceLabel: 'Profiler internal analysis',
        source: [
          { citation: 'Internal analysis', url: 'https://example.com/internal' },
          { citation: 'Research report', url: 'https://example.com/research' },
        ],
        nextBestMoves: [
          'Should I prioritize outreach to decision makers in this new segment?',
          'Want me to create a tailored value proposition for this ICP profile?',
          'Do you want me to identify similar companies that match this profile?'
        ],
        NBAs: [
          { nba: 'Should I prioritize outreach to decision makers in this new segment?', prompt: '' },
          { nba: 'Want me to create a tailored value proposition for this ICP profile?', prompt: '' },
          { nba: 'Do you want me to identify similar companies that match this profile?', prompt: '' }
        ],
        contextualSuggestions: [
          { icon: '🎯', text: 'Research FinTech segment decision makers' },
          { icon: '📈', text: 'Analyze EU market penetration opportunities' },
          { icon: '🔍', text: 'Find similar companies matching this profile' },
          { icon: '📋', text: 'Create tailored value proposition' },
          { icon: '📧', text: 'Draft outreach sequences for this segment' }
        ]
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
      
      // Sort sample signals by timestamp in descending order (newest first)
      const sortedSampleSignals = filteredSampleSignals.sort((a, b) => {
        const timestampA = parseTimestamp(a.timestamp);
        const timestampB = parseTimestamp(b.timestamp);
        return timestampB - timestampA; // Descending order (newest first)
      });
      
      setSignals(sortedSampleSignals);
      setSignalsFromApi(false);
      console.log('Recommendations source: sample data (API failed or unavailable)');
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

  /** Strip markdown and special characters from agent response for plain display */
  const formatAgentResponse = (text: string) => {
    if (!text || typeof text !== 'string') return null;
    let out = text
      .replace(/\*\*\*/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\*$/gm, '')
      .replace(/^#+\s*/gm, '')
      .replace(/—/g, ' - ')
      .replace(/[\u2013\u2014]/g, ' - ')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return <span className="whitespace-pre-wrap">{out}</span>;
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

  /** Navigate to Chat with Scout or Profiler, passing recommendation + prompt + answer as context */
  const handleNavigateToAgentChat = (signal: SignalCard, recommendation: string, prompt: string, answer?: string) => {
    const contentHash = getSignalContentHash(signal);
    const context = {
      agent: signal.agent,
      signalId: signal.id,
      contentHash,
      signalHeading: signal.headline,
      recommendation,
      prompt,
      answer: answer ?? undefined,
    };
    sessionStorage.setItem('signalsChatContext', JSON.stringify(context));
    if (signal.agent === 'scout') {
      navigate('/your-ai-team/scout/chatwithscout');
    } else {
      navigate('/customers', { state: { tab: 'chat-profiler' } });
    }
  };

  /** Navigate to Chat from bot icon (signal-level context, uses first recommendation if available) */
  const handleBotIconClick = (signal: SignalCard) => {
    const list: NBAItem[] = (signal.NBAs && signal.NBAs.length > 0)
      ? signal.NBAs
      : (signal.nextBestMoves || []).map((m) => ({ nba: m, prompt: '' }));
    const first = list[0];
    const recommendation = first?.nba ?? signal.headline;
    const prompt = first?.prompt ?? '';
    const answer = first ? recommendationAnswers[`${signal.id}-0`] : undefined;
    handleNavigateToAgentChat(signal, recommendation, prompt, answer);
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
  const handleAcceptSignal = async (signalId: string) => {
    if (!currentUser?.uid || !orgId) return;
    
    // Find the signal to get its content hash
    const signal = signals.find(s => s.id === signalId);
    if (!signal) return;
    
    const contentHash = getSignalContentHash(signal);
    
    // Toggle accept state - if already accepted, unaccept it
    if (acceptedSignals.has(contentHash)) {
      // Unaccept the signal
      const newAccepted = new Set(acceptedSignals);
      newAccepted.delete(contentHash);
      setAcceptedSignals(newAccepted);
      
      // Save to localStorage
      const storageKey = `signals_${currentUser.uid}`;
      try {
        localStorage.setItem(`${storageKey}_accepted`, JSON.stringify(Array.from(newAccepted)));
      } catch (error) {
        console.error('Error saving accepted signals to localStorage:', error);
      }
      
      // Call API to unaccept (action: reject)
      try {
        await signalAction(orgId, signalId, 'reject');
      } catch (error) {
        console.error('Error calling signal action API:', error);
        // Still update UI even if API fails
      }
      
      toast({
        title: "Signal unaccepted",
        description: "This signal has been unaccepted.",
      });
    } else {
      // Accept the signal
      const newAccepted = new Set([...acceptedSignals, contentHash]);
      setAcceptedSignals(newAccepted);
      
      // Save to localStorage
      const storageKey = `signals_${currentUser.uid}`;
      try {
        localStorage.setItem(`${storageKey}_accepted`, JSON.stringify(Array.from(newAccepted)));
      } catch (error) {
        console.error('Error saving accepted signals to localStorage:', error);
      }
      
      // Call API to accept
      try {
        await signalAction(orgId, signalId, 'accept');
        toast({
          title: "Signal accepted",
          description: "This signal has been marked as accepted.",
        });
      } catch (error) {
        console.error('Error calling signal action API:', error);
        toast({
          title: "Error",
          description: "Failed to accept signal. Please try again.",
          variant: "destructive",
        });
        // Revert UI state on error
        const revertedAccepted = new Set(acceptedSignals);
        setAcceptedSignals(revertedAccepted);
        try {
          localStorage.setItem(`${storageKey}_accepted`, JSON.stringify(Array.from(revertedAccepted)));
        } catch (e) {
          console.error('Error reverting accepted signals:', e);
        }
      }
    }
  };

  const handleRejectSignal = (signalId: string) => {
    if (!currentUser?.uid || !orgId) return;
    
    // Find the signal and its index to get its content hash
    const signalIndex = signals.findIndex(s => s.id === signalId);
    const signal = signals[signalIndex];
    if (!signal) return;
    
    const contentHash = getSignalContentHash(signal);
    const storageKey = `signals_${currentUser.uid}`;
    
    // Store the signal and its original index for undo
    const signalToRestore = signal;
    const originalIndex = signalIndex;
    
    // Remove from signals list immediately (UI update)
    setSignals(prev => prev.filter(s => s.id !== signalId));
    
    // Remove from accepted if it was accepted (using content hash)
    setAcceptedSignals(prev => {
      const newSet = new Set(prev);
      newSet.delete(contentHash);
      
      // Update localStorage
      try {
        localStorage.setItem(`${storageKey}_accepted`, JSON.stringify(Array.from(newSet)));
      } catch (error) {
        console.error('Error updating accepted signals in localStorage:', error);
      }
      
      return newSet;
    });
    
    // Add to rejected list (using content hash) - for UI filtering
    const newRejected = new Set([...rejectedSignalHashes, contentHash]);
    setRejectedSignalHashes(newRejected);
    
    // Save rejected signals to localStorage
    try {
      localStorage.setItem(`${storageKey}_rejected`, JSON.stringify(Array.from(newRejected)));
    } catch (error) {
      console.error('Error saving rejected signals to localStorage:', error);
    }
    
    // Set up 5-second timer to call API
    const timer = setTimeout(async () => {
      // Remove from pending rejections
      setPendingRejections(prev => {
        const updated = new Map(prev);
        updated.delete(signalId);
        return updated;
      });
      
      // Call API to reject
      try {
        await signalAction(orgId, signalId, 'reject');
        console.log('Signal rejected via API:', signalId);
      } catch (error) {
        console.error('Error calling signal action API for reject:', error);
        // If API fails, restore the signal
        setSignals(prev => {
          const exists = prev.find(s => s.id === signalToRestore.id);
          if (exists) return prev;
          const insertIndex = Math.min(originalIndex, prev.length);
          const newSignals = [...prev];
          newSignals.splice(insertIndex, 0, signalToRestore);
          return newSignals;
        });
        setRejectedSignalHashes(prev => {
          const updatedRejected = new Set(prev);
          updatedRejected.delete(contentHash);
          try {
            localStorage.setItem(`${storageKey}_rejected`, JSON.stringify(Array.from(updatedRejected)));
          } catch (e) {
            console.error('Error updating rejected signals in localStorage:', e);
          }
          return updatedRejected;
        });
        toast({
          title: "Error",
          description: "Failed to reject signal. It has been restored.",
          variant: "destructive",
        });
      }
    }, 5000); // 5 seconds delay
    
    // Store pending rejection for undo
    setPendingRejections(prev => {
      const updated = new Map(prev);
      updated.set(signalId, {
        signal: signalToRestore,
        originalIndex,
        timer
      });
      return updated;
    });
    
    // Show toast with undo option
    toast({
      title: "Signal removed",
      description: "This signal has been removed from your list.",
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Clear the timer and remove from pending rejections
            setPendingRejections(prev => {
              const updated = new Map(prev);
              const pendingRejection = updated.get(signalId);
              if (pendingRejection) {
                // Clear the timer
                clearTimeout(pendingRejection.timer);
                // Remove from map
                updated.delete(signalId);
              }
              return updated;
            });
            
            // Restore the signal to its original position
            setSignals(prev => {
              // Check if signal already exists (shouldn't, but be safe)
              const exists = prev.find(s => s.id === signalToRestore.id);
              if (exists) return prev;
              
              // Insert at original position, or at the end if original position is beyond current length
              const insertIndex = Math.min(originalIndex, prev.length);
              const newSignals = [...prev];
              newSignals.splice(insertIndex, 0, signalToRestore);
              return newSignals;
            });
            
            // Remove from rejected list
            setRejectedSignalHashes(prev => {
              const updatedRejected = new Set(prev);
              updatedRejected.delete(contentHash);
              
              // Update localStorage
              try {
                localStorage.setItem(`${storageKey}_rejected`, JSON.stringify(Array.from(updatedRejected)));
              } catch (error) {
                console.error('Error updating rejected signals in localStorage:', error);
              }
              
              return updatedRejected;
            });
            
            toast({
              title: "Signal restored",
              description: "The signal has been restored to your list.",
            });
          }}
        >
          Undo
        </Button>
      ),
    });
  };
  
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      pendingRejections.forEach(({ timer }) => {
        clearTimeout(timer);
      });
    };
  }, [pendingRejections]);

  const filteredSavedInsights: SignalCard[] = savedInsightsFilter === 'all' ? savedInsights : savedInsights.filter(insight => {
    if (savedInsightsFilter === 'competitor') return insight.headline.toLowerCase().includes('competitor');
    if (savedInsightsFilter === 'icp') return insight.headline.toLowerCase().includes('icp');
    if (savedInsightsFilter === 'industry') return insight.headline.toLowerCase().includes('industry') || insight.headline.toLowerCase().includes('funding');
    if (savedInsightsFilter === 'linkedin') return insight.sourceLabel.toLowerCase().includes('linkedin');
    return true;
  });

  return (
    <Layout>
      <div className="p-6">
        {currentTab === 'signals' && (
          <div className="w-full max-w-5xl mx-auto space-y-4">
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
                return (
                  <div key={signal.id} className="space-y-0">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-lg transition-all duration-200">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBotIconClick(signal);
                      }}
                      title={signal.agent === 'scout' ? 'Chat with Scout' : 'Chat with Profiler'}
                    >
                      <Bot className="h-4 w-4" />
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
                      {/* Description field - detailed ICP/customer context with Read more/Show less */}
                      {signal.description && (
                        <div className="mt-2">
                          {expandedDescriptions.has(signal.id) ? (
                            <>
                              <p className="text-gray-700 text-sm leading-relaxed mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                {signal.description}
                              </p>
                              {/* Citations from API - bottom left of expanded description; click opens url */}
                              {Array.isArray(signal.source) && signal.source.length > 0 && (
                                <div className="mt-2 flex flex-col gap-1.5 justify-start">
                                  {signal.source.map((src, idx) => {
                                    const label = src.citation || src.url || 'Source';
                                    const hasUrl = src.url && /^https?:\/\//i.test(src.url);
                                    return hasUrl ? (
                                      <a
                                        key={idx}
                                        href={src.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block w-fit"
                                      >
                                        <Badge variant="secondary" className="text-xs font-normal hover:bg-gray-300 cursor-pointer max-w-full text-left">
                                          {label}
                                        </Badge>
                                      </a>
                                    ) : (
                                      <Badge key={idx} variant="secondary" className="text-xs font-normal w-fit">
                                        {label}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              )}
                              {/* Recommendations - click to show corresponding prompt */}
                              {(() => {
                                const recommendationsList: NBAItem[] = (signal.NBAs && signal.NBAs.length > 0)
                                  ? signal.NBAs
                                  : (signal.nextBestMoves || []).map((m) => ({ nba: m, prompt: '' }));
                                if (recommendationsList.length === 0) return null;
                                return (
                                  <div className="mt-4 space-y-2">
                                    <h4 className="text-sm font-medium text-gray-900">Recommendations</h4>
                                    <div className="space-y-2">
                                      {recommendationsList.map((item, index) => {
                                        const isExpanded = expandedRecommendation?.signalId === signal.id && expandedRecommendation?.index === index;
                                        const hasPrompt = (item.prompt ?? '').trim() !== '';
                                        return (
                                          <div key={index} className="rounded-lg border border-gray-100 overflow-hidden">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setExpandedRecommendation(isExpanded ? null : { signalId: signal.id, index });
                                              }}
                                              className={`w-full flex items-start gap-2 p-2.5 text-left cursor-pointer transition-colors ${
                                                isExpanded ? 'bg-blue-50/50 border-blue-200' : 'bg-gray-50 hover:border-blue-200 hover:bg-blue-50/30'
                                              }`}
                                            >
                                              <p className="text-sm text-gray-700 flex-1">{item.nba}</p>
                                            </button>
                                            {isExpanded && (
                                              <div className="px-3 pb-3 pt-1 border-t border-gray-100">
                                                <div className="p-3 rounded-lg bg-gradient-to-br from-slate-50 to-blue-50/50 border border-slate-200 space-y-3">
                                                  <p className="text-sm text-slate-700 leading-relaxed font-semibold">
                                                    {hasPrompt
                                                      ? "Review the answer below. If this signal and its recommendations are relevant to you, accept it. Need more clarity? Chat with the agent to explore further."
                                                      : "If this signal and its recommendations are relevant to you, accept it. Need more clarity? Chat with the agent to explore further."}
                                                  </p>
                                                  {hasPrompt && (
                                                    <div className="rounded-md bg-white/80 border border-slate-200 p-2.5">
                                                      <p className="text-xs font-medium text-slate-600 mb-1.5">Answer</p>
                                                      {recommendationAnswerLoading === `${signal.id}-${index}` ? (
                                                        <div className="flex items-center gap-2 py-4 text-slate-500">
                                                          <Loader2 className="h-4 w-4 animate-spin" />
                                                          <span className="text-sm">Loading answer...</span>
                                                        </div>
                                                      ) : (
                                                        <>
                                                          <div className="relative">
                                                            <p
                                                              className={`text-sm text-slate-800 whitespace-pre-wrap pr-1 ${
                                                                answerExpandedKeys.has(`${signal.id}-${index}`)
                                                                  ? ''
                                                                  : 'max-h-24 overflow-hidden'
                                                              }`}
                                                            >
                                                              {sanitizeAnswerText(recommendationAnswers[`${signal.id}-${index}`] ?? item.prompt)}
                                                            </p>
                                                            {!answerExpandedKeys.has(`${signal.id}-${index}`) && (
                                                              <>
                                                                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
                                                                <Button
                                                                  variant="ghost"
                                                                  size="sm"
                                                                  className="mt-1.5 h-7 px-2 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 -ml-2"
                                                                  onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setAnswerExpandedKeys((prev) => {
                                                                      const next = new Set(prev);
                                                                      next.add(`${signal.id}-${index}`);
                                                                      return next;
                                                                    });
                                                                  }}
                                                                >
                                                                  Show more
                                                                  <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
                                                                </Button>
                                                              </>
                                                            )}
                                                          </div>
                                                          {answerExpandedKeys.has(`${signal.id}-${index}`) && (
                                                            <Button
                                                              variant="ghost"
                                                              size="sm"
                                                              className="mt-1 h-7 px-2 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 -ml-2"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                setAnswerExpandedKeys((prev) => {
                                                                  const next = new Set(prev);
                                                                  next.delete(`${signal.id}-${index}`);
                                                                  return next;
                                                                });
                                                              }}
                                                            >
                                                              Show less
                                                              <ChevronUp className="h-3.5 w-3.5 ml-0.5" />
                                                            </Button>
                                                          )}
                                                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200">
                                                            <Button
                                                              variant="ghost"
                                                              size="sm"
                                                              className={`h-8 w-8 p-0 ${
                                                                isAccepted
                                                                  ? 'text-green-600 bg-green-50'
                                                                  : 'text-slate-500 hover:text-green-600 hover:bg-green-50'
                                                              }`}
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAcceptSignal(signal.id);
                                                              }}
                                                              title={isAccepted ? 'Accepted' : 'Accept signal'}
                                                            >
                                                              <ThumbsUp className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                              variant="ghost"
                                                              size="sm"
                                                              className="h-8 w-8 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRejectSignal(signal.id);
                                                              }}
                                                              title="Reject signal"
                                                            >
                                                              <ThumbsDown className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                              size="sm"
                                                              variant="outline"
                                                              className="text-xs font-medium h-8 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleNavigateToAgentChat(
                                                                  signal,
                                                                  item.nba,
                                                                  item.prompt ?? '',
                                                                  recommendationAnswers[`${signal.id}-${index}`]
                                                                );
                                                              }}
                                                            >
                                                              <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                                                              {signal.agent === 'scout' ? 'Chat with Scout' : 'Chat with Profiler'}
                                                            </Button>
                                                          </div>
                                                        </>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })()}
                              <div className="flex justify-center mt-3">
                                <Button
                                  variant="outline"
                                  size="default"
                                  className="text-blue-600 border-blue-600 hover:text-blue-700 hover:bg-blue-50 text-sm"
                                  onClick={() => {
                                    setExpandedDescriptions(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(signal.id);
                                      return newSet;
                                    });
                                  }}
                                >
                                  Show less
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="flex justify-center">
                              <Button
                                variant="outline"
                                size="default"
                                className="text-blue-600 border-blue-600 hover:text-blue-700 hover:bg-blue-50 text-sm"
                                onClick={() => {
                                  setExpandedDescriptions(prev => new Set([...prev, signal.id]));
                                }}
                              >
                                Read more
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
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
                </div>

                {/* Card Actions */}
                {/* <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300" onClick={() => handleAction(signal.id, 'save')}>
                    <Bookmark className="h-4 w-4 mr-1" />
                    Save for Later
                  </Button>
                </div> */}

              </div>
                  </div>
                );
              })
            )}
          </div>
        )}

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
                    {(selectedSignal.contextualSuggestions && selectedSignal.contextualSuggestions.length > 0
                      ? selectedSignal.contextualSuggestions
                      : getContextualSuggestions(selectedSignal)
                    ).map((suggestion, index) => (
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