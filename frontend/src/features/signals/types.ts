// Feature-local types for `signals`. Signal/card shapes consumed by the page
// and the pure card helpers in `./components/signalCards`.

export type Agent = "scout" | "profiler";

export interface ContextualSuggestion {
  icon: string;
  text: string;
}

/** Recommendation from API: nba shown to user, prompt passed to future LLM API */
export interface NBAItem {
  nba: string;
  prompt: string;
}

/** Source citation: display text and link URL */
export interface SourceCitation {
  citation: string;
  url: string;
}

export interface SignalCard {
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
