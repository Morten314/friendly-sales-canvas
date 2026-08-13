export interface StrategistContext {
  leads: {
    name: string;
    company: string;
    jobTitle: string;
    email?: string;
    tenure?: string;
    source?: string;
    signals?: string[];
  }[];
  opportunity?: string;
  icp?: string;
  triggerPrompt: string;
  /** When true, Strategist opens the detailed editable sequence immediately. */
  autoSequence?: boolean;
}
