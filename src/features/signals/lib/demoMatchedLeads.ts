import type { SignalLeadMapLead } from "../contracts";

/**
 * Placeholder matched leads shown when the backend mapping is empty (e.g. the
 * org has no leads uploaded yet), so "Find Matched Leads" still demonstrates the
 * flow. Deterministic per signal id — remove once real leads are synced.
 */
const DEMO_POOL: Omit<SignalLeadMapLead, "lead_id">[] = [
  {
    name: "Rohit Khanna",
    title: "VP Engineering",
    seniority: "VP",
    email: "rohit@northwind.ai",
    email_status: "verified",
    linkedin: "https://www.linkedin.com/in/rohit-khanna",
    phone: "",
    company: "Northwind Analytics",
    relevance: "high",
    why: "Series B SaaS scaling GTM in EMEA — matches the signal's ICP profile.",
  },
  {
    name: "Navneet Yadav",
    title: "CPO",
    seniority: "C-Level",
    email: "navneet@kestrelcloud.com",
    email_status: "verified",
    linkedin: "https://www.linkedin.com/in/navneet-yadav",
    phone: "",
    company: "Kestrel Cloud",
    relevance: "high",
    why: "Recently posted 12 sales roles, indicating active pipeline expansion.",
  },
  {
    name: "Corey Stein",
    title: "SVP Engineering",
    seniority: "SVP",
    email: "corey@lumenretail.com",
    email_status: "guessed",
    linkedin: "https://www.linkedin.com/in/corey-stein",
    phone: "",
    company: "Lumen Retail Group",
    relevance: "medium",
    why: "Mid-market buyer with adjacent use case; needs qualification.",
  },
  {
    name: "Michael Greer",
    title: "Head of Operations",
    seniority: "Head",
    email: "michael@brightpath.io",
    email_status: "verified",
    linkedin: "https://www.linkedin.com/in/michael-greer",
    phone: "",
    company: "Brightpath Logistics",
    relevance: "medium",
    why: "Operates in a target vertical but revenue stage is unconfirmed.",
  },
  {
    name: "Sophie Roberts",
    title: "CTO",
    seniority: "C-Level",
    email: "sophie@velahealth.com",
    email_status: "unverified",
    linkedin: "https://www.linkedin.com/in/sophie-roberts",
    phone: "",
    company: "Vela Health",
    relevance: "low",
    why: "Peripheral fit — monitor for a stronger trigger before outreach.",
  },
];

export function getDemoMatchedLeads(signalId: string): SignalLeadMapLead[] {
  const seed = Array.from(signalId).reduce((n, c) => n + c.charCodeAt(0), 0);
  const count = 3 + (seed % 3); // 3–5 leads
  return Array.from({ length: count }, (_, i) => {
    const base = DEMO_POOL[(seed + i) % DEMO_POOL.length];
    return { ...base, lead_id: `demo-${signalId}-${i}` };
  });
}
