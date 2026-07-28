import type { NBAItem, SignalCard, SourceCitation } from "../types";

import type { UntypedBackendSignal } from "@/shared/types/escape-hatches";

const BLOCKED_SOURCE_HOSTS = new Set(["api.tavily.com"]);

/**
 * Trim trailing prose/markdown punctuation without dropping characters that
 * belong to the URL. Always-junk trailing chars (' " . , ;) are removed; a
 * closing ')' or ']' is removed only when UNBALANCED (more closers than
 * openers), so a balanced pair inside the path — e.g. a Wikipedia
 * 'Foo_(bar)' link — survives instead of being mangled into a 404 URL.
 */
function stripTrailingUrlPunct(url: string): string {
  const count = (s: string, ch: string) => s.split(ch).length - 1;
  let s = url;
  while (s.length > 0) {
    const last = s[s.length - 1];
    if (`'".,;`.includes(last)) {
      s = s.slice(0, -1);
      continue;
    }
    if (last === ")" && count(s, ")") > count(s, "(")) {
      s = s.slice(0, -1);
      continue;
    }
    if (last === "]" && count(s, "]") > count(s, "[")) {
      s = s.slice(0, -1);
      continue;
    }
    break;
  }
  return s;
}

/** Strip junk punctuation and block non-article Tavily API endpoints. */
export function sanitizeSourceUrl(url: string | undefined | null): string {
  if (!url || typeof url !== "string") return "";
  const cleaned = stripTrailingUrlPunct(url.trim());
  if (!/^https?:\/\//i.test(cleaned)) return "";
  try {
    const host = new URL(cleaned).hostname.toLowerCase();
    if (BLOCKED_SOURCE_HOSTS.has(host)) return "";
    return cleaned;
  } catch {
    return "";
  }
}

function normalizeSourceCitation(
  citation: string,
  url: string | undefined | null,
): SourceCitation | null {
  const safeUrl = sanitizeSourceUrl(url);
  if (!safeUrl) return null;
  const label = citation.trim();
  return { citation: label || safeUrl, url: safeUrl };
}

// Helper function to generate a stable content-based ID for a signal
export const getSignalContentHash = (signal: SignalCard): string => {
  const content = `${signal.headline}-${signal.snippet}-${signal.description || ""}-${signal.agent}`;
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `signal-${Math.abs(hash).toString(36)}`;
};

// Helper function to parse timestamp and return a comparable number (higher = newer)
export const parseTimestamp = (timestamp: string): number => {
  // Try parsing as ISO 8601 date first
  const isoDate = new Date(timestamp);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.getTime();
  }

  // Handle relative timestamps
  const now = Date.now();
  const lowerTimestamp = timestamp.toLowerCase().trim();

  // Handle "Today"
  if (lowerTimestamp === "today") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  }

  // Handle "Xh ago", "Xm ago", "Xd ago", etc.
  const hourMatch = lowerTimestamp.match(/(\d+)\s*h\s*ago/);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    return now - hours * 60 * 60 * 1000;
  }

  const minuteMatch = lowerTimestamp.match(/(\d+)\s*m\s*ago/);
  if (minuteMatch) {
    const minutes = parseInt(minuteMatch[1], 10);
    return now - minutes * 60 * 1000;
  }

  const dayMatch = lowerTimestamp.match(/(\d+)\s*d\s*ago/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    return now - days * 24 * 60 * 60 * 1000;
  }

  // If we can't parse it, return 0 (will be sorted to the end)
  console.warn("Unable to parse timestamp:", timestamp);
  return 0;
};

export function applyRejectedFilterAndSort(
  preReject: SignalCard[],
  rejectedHashes: Set<string>,
): SignalCard[] {
  const filtered = preReject.filter((signal) => {
    const contentHash = getSignalContentHash(signal);
    return !rejectedHashes.has(contentHash);
  });
  return [...filtered].sort((a, b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp));
}

export function buildSignalCardsFromFetchData(data: {
  signals?: UntypedBackendSignal[];
}): SignalCard[] {
  const rawSignals = data.signals || [];
  const signalsWithIds = rawSignals.map((signal: UntypedBackendSignal, index: number) => {
    let signalId: string;
    if (signal.signal_id) {
      signalId = signal.signal_id;
    } else if (signal.id) {
      signalId = signal.id;
    } else {
      if (typeof crypto !== "undefined" && crypto.randomUUID) {
        signalId = crypto.randomUUID();
      } else {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 11);
        const perfNow = (performance?.now() || Math.random() * 1000).toString().replace(".", "");
        signalId = `signal-${timestamp}-${index}-${randomStr}-${perfNow}`;
      }
    }

    const nextBestMoves = signal.nextBestMoves || [];
    const NBAs: NBAItem[] =
      Array.isArray(signal.NBAs) && signal.NBAs.length > 0
        ? signal.NBAs.map((n: { nba?: string; prompt?: string }) => ({
            nba: n.nba ?? "",
            prompt: n.prompt ?? "",
          }))
        : nextBestMoves.map((m: string) => ({ nba: m, prompt: "" }));

    const sourceRaw = signal.source;
    const source: SourceCitation[] = Array.isArray(sourceRaw)
      ? sourceRaw
          .map((s: SourceCitation | string) =>
            typeof s === "object" && s !== null && "citation" in s && "url" in s
              ? normalizeSourceCitation(
                  (s as SourceCitation).citation ?? "",
                  (s as SourceCitation).url ?? "",
                )
              : typeof s === "string"
                ? normalizeSourceCitation(s, /^https?:\/\//i.test(s) ? s : "")
                : null,
          )
          .filter((c): c is SourceCitation => c !== null)
      : [];

    const sourceUrl =
      sanitizeSourceUrl(signal.sourceUrl as string | undefined) ||
      sanitizeSourceUrl(signal.source_url as string | undefined) ||
      source.find((c) => c.url)?.url ||
      "";

    return {
      ...signal,
      id: signalId,
      description: signal.description || "",
      sourceUrl,
      source,
      nextBestMoves,
      NBAs,
      contextualSuggestions: signal.contextualSuggestions || [],
    } as SignalCard;
  });

  const ids = signalsWithIds.map((s) => s.id);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    signalsWithIds.forEach((signal, index) => {
      if (typeof crypto !== "undefined" && crypto.randomUUID) {
        signal.id = crypto.randomUUID();
      } else {
        signal.id = `signal-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 11)}-${performance?.now() || Math.random() * 1000}`;
      }
    });
  }

  return signalsWithIds;
}

export function getFallbackSampleSignals(): SignalCard[] {
  return [
    {
      id: "1",
      agent: "scout",
      timestamp: "1h ago",
      headline: "Competitor X launches SMB pricing tier.",
      snippet: "Likely to impact your ICP accounts in mid-market SaaS segment.",
      description:
        "This competitive pricing move by Company X directly impacts your SMB segment in the mid-market SaaS space. With 40% of your current pipeline falling into this category, this development could accelerate decision timelines or create pricing pressure. The launch targets companies with 50-200 employees—your core ICP—and includes features that overlap with your value proposition. Consider monitoring early adoption signals and preparing competitive differentiation messaging that emphasizes your unique ROI model and enterprise-grade capabilities.",
      sourceUrl: "#",
      sourceLabel: "Press release link",
      source: [
        {
          citation: "Press Release - Company X SMB Tier",
          url: "https://example.com/press-release",
        },
        { citation: "Industry report 2024", url: "https://example.com/industry-report" },
      ],
      nextBestMoves: [
        "Would you like me to check how many of your target ICPs fall under the SMB segment and could be influenced by this move?",
        "Do you want me to model a competitive bundle or ROI-driven value pitch against this pricing shift?",
        "Should I track customer sentiment on LinkedIn, G2 reviews, or forums to see if it's gaining traction?",
      ],
      NBAs: [
        {
          nba: "Would you like me to check how many of your target ICPs fall under the SMB segment and could be influenced by this move?",
          prompt: "",
        },
        {
          nba: "Do you want me to model a competitive bundle or ROI-driven value pitch against this pricing shift?",
          prompt: "",
        },
        {
          nba: "Should I track customer sentiment on LinkedIn, G2 reviews, or forums to see if it's gaining traction?",
          prompt: "",
        },
      ],
      contextualSuggestions: [
        { icon: "🔗", text: "Get Company X's Website & Press Release" },
        { icon: "🧑‍💼", text: "Identify decision makers at Company X" },
        { icon: "📊", text: "Compare SMB pricing vs. our offering" },
        { icon: "🚀", text: "Monitor early adoption signals from Company X" },
        { icon: "📅", text: "Track mentions of SMB tier in LinkedIn updates" },
      ],
    },
    {
      id: "2",
      agent: "profiler",
      timestamp: "3h ago",
      headline: "ICP contact posted about cloud migration struggles.",
      snippet: "John Doe, CTO @ Acme Corp, shared LinkedIn update relevant to DRaaS.",
      description:
        "John Doe, CTO at Acme Corp (a company matching your ICP profile with 150 employees in the FinTech sector), posted about challenges with cloud migration and data recovery strategies. This represents a strong buying signal as Acme Corp is actively evaluating solutions in your space. The post indicates urgency and budget allocation for DRaaS solutions, making this an ideal time for targeted outreach with relevant case studies and ROI messaging.",
      sourceUrl: "#",
      sourceLabel: "LinkedIn post link",
      source: [{ citation: "LinkedIn post link", url: "https://linkedin.com/post/example" }],
      nextBestMoves: [
        "Should I draft a contextual comment or connection request for this post?",
        "Want me to identify other prospects posting about similar challenges?",
        "Do you want me to create a follow-up sequence based on this signal?",
      ],
      NBAs: [
        {
          nba: "Should I draft a contextual comment or connection request for this post?",
          prompt: "",
        },
        {
          nba: "Want me to identify other prospects posting about similar challenges?",
          prompt: "",
        },
        { nba: "Do you want me to create a follow-up sequence based on this signal?", prompt: "" },
      ],
      contextualSuggestions: [
        { icon: "💬", text: "Draft contextual comment for this post" },
        { icon: "🤝", text: "Prepare connection request message" },
        { icon: "🔄", text: "Find similar prospects with same challenges" },
        { icon: "📊", text: "Analyze engagement patterns" },
        { icon: "📝", text: "Create follow-up sequence" },
      ],
    },
    {
      id: "3",
      agent: "scout",
      timestamp: "5h ago",
      headline: "New funding round announced in AI automation space.",
      snippet: "Series B round indicates growing market confidence in automation solutions.",
      description:
        "A Series B funding round of $25M was announced for a competitor in the AI automation space, signaling strong market confidence and potential for aggressive expansion. This development could impact your competitive positioning, especially in the enterprise segment where both companies target similar buyer personas. The funding suggests increased marketing spend and product development, which may accelerate market education but also intensify competition for your target accounts.",
      sourceUrl: "#",
      sourceLabel: "TechCrunch article",
      source: [{ citation: "TechCrunch article", url: "https://techcrunch.com/article-example" }],
      nextBestMoves: [
        "Want me to analyze how this affects your competitive positioning in the market?",
        "Should I identify which of your prospects might be considering this competitor now?",
        "Do you want me to draft messaging that highlights your differentiators against this move?",
      ],
      NBAs: [
        {
          nba: "Want me to analyze how this affects your competitive positioning in the market?",
          prompt: "",
        },
        {
          nba: "Should I identify which of your prospects might be considering this competitor now?",
          prompt: "",
        },
        {
          nba: "Do you want me to draft messaging that highlights your differentiators against this move?",
          prompt: "",
        },
      ],
      contextualSuggestions: [
        { icon: "💰", text: "Analyze funding impact on market positioning" },
        { icon: "🏢", text: "Identify potential acquisition targets" },
        { icon: "📈", text: "Map competitive landscape changes" },
        { icon: "🎯", text: "Find prospects considering this competitor" },
        { icon: "📋", text: "Draft competitive differentiation messaging" },
      ],
    },
    {
      id: "4",
      agent: "profiler",
      timestamp: "Today",
      headline: "New ICP segment identified: FinTech startups (50–200 employees).",
      snippet:
        "High engagement signals found in EU market; strong overlap with your existing SaaS ICP.",
      description:
        "Analysis of market signals reveals a new high-value ICP segment: FinTech startups with 50-200 employees, particularly in the EU market. This segment shows strong engagement patterns with solutions similar to yours, with 65% overlap in key buying criteria with your existing SaaS ICP. The segment demonstrates high growth potential and budget allocation for automation tools, making it an ideal expansion target for your sales efforts.",
      sourceUrl: "#",
      sourceLabel: "Profiler internal analysis",
      source: [
        { citation: "Internal analysis", url: "https://example.com/internal" },
        { citation: "Research report", url: "https://example.com/research" },
      ],
      nextBestMoves: [
        "Should I prioritize outreach to decision makers in this new segment?",
        "Want me to create a tailored value proposition for this ICP profile?",
        "Do you want me to identify similar companies that match this profile?",
      ],
      NBAs: [
        { nba: "Should I prioritize outreach to decision makers in this new segment?", prompt: "" },
        { nba: "Want me to create a tailored value proposition for this ICP profile?", prompt: "" },
        {
          nba: "Do you want me to identify similar companies that match this profile?",
          prompt: "",
        },
      ],
      contextualSuggestions: [
        { icon: "🎯", text: "Research FinTech segment decision makers" },
        { icon: "📈", text: "Analyze EU market penetration opportunities" },
        { icon: "🔍", text: "Find similar companies matching this profile" },
        { icon: "📋", text: "Create tailored value proposition" },
        { icon: "📧", text: "Draft outreach sequences for this segment" },
      ],
    },
  ];
}
