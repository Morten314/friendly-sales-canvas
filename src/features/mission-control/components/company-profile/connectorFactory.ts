import {
  BarChart3,
  Database,
  FileText,
  Globe,
  Linkedin,
  Slack,
  Twitter,
  Users,
} from "lucide-react";

import type { Connector } from "./connectorTypes";

// ─── CRM ─────────────────────────────────────────────────────────────────────

const CRM_NAMES: Record<string, string> = {
  salesforce: "Salesforce",
  hubspot: "HubSpot",
  pipedrive: "Pipedrive",
  zoho: "Zoho CRM",
};

export function buildCrmConnector(selectedCrm: string): Connector {
  const name = CRM_NAMES[selectedCrm];
  return {
    id: `conn-${selectedCrm}`,
    name,
    type: "crm",
    icon: Database,
    platform: name,
    description: `Connect your ${name} CRM`,
    category: "CRM",
  };
}

// ─── Social ───────────────────────────────────────────────────────────────────

export function buildLinkedInConnector(linkedInUrls: string[]): Connector {
  return {
    id: "conn-linkedin",
    name: "LinkedIn Sales Navigator",
    type: "social",
    icon: Linkedin,
    platform: "LinkedIn",
    description: `LinkedIn URLs: ${linkedInUrls.filter((u) => u.trim()).join(", ")}`,
    category: "Social",
  };
}

export function buildTwitterConnector(): Connector {
  return {
    id: "conn-twitter",
    name: "X",
    type: "social",
    icon: Twitter,
    platform: "Twitter",
    description: "Connect X account",
    category: "Social",
  };
}

// ─── Analytics ────────────────────────────────────────────────────────────────

const ANALYTICS_NAMES: Record<string, string> = {
  "google-analytics": "Google Analytics",
  mixpanel: "Mixpanel",
};

export function buildAnalyticsConnector(selectedAnalytics: string): Connector {
  const name = ANALYTICS_NAMES[selectedAnalytics];
  return {
    id: `conn-${selectedAnalytics}`,
    name,
    type: "analytics",
    icon: selectedAnalytics === "google-analytics" ? Globe : BarChart3,
    platform: name,
    description: `Connect ${name}`,
    category: "Analytics",
  };
}

// ─── Competitors ──────────────────────────────────────────────────────────────

export function buildCompetitorConnector(
  competitor: { name: string; url: string },
  index: number,
): Connector {
  return {
    id: `conn-competitor-${index}`,
    name: `Competitor: ${competitor.name}`,
    type: "custom",
    icon: Users,
    platform: "Competitor",
    description: `Competitor: ${competitor.name} - ${competitor.url}`,
    category: "Competitors",
  };
}

// ─── Slack ────────────────────────────────────────────────────────────────────

export function buildSlackConnector(
  config: { workspace: string; channel: string },
  index: number,
): Connector {
  return {
    id: `conn-slack-${index}`,
    name: `Slack: ${config.workspace}`,
    type: "communication",
    icon: Slack,
    platform: "Slack",
    description: `Slack: ${config.workspace} - ${config.channel || "All channels"}`,
    category: "Communication",
  };
}

// ─── File Sources ─────────────────────────────────────────────────────────────

export function buildProductDocConnector(
  fileData: { file: File | null; destinationUrl: string },
  index: number,
  totalCount: number,
): Connector {
  return {
    id: `file-product-doc-${index}`,
    name: `Product Documentation${totalCount > 1 ? ` (${index + 1})` : ""}`,
    type: "file",
    icon: FileText,
    platform: "File Upload",
    description: `Docs, API guides, release notes, and specs${fileData.file ? ` - ${fileData.file.name}` : ""}`,
    category: "File Sources",
  };
}

export function buildOtherFileConnector(fileSource: {
  name: string;
  icon: typeof Database;
  description: string;
}): Connector {
  return {
    id: `file-${fileSource.name.toLowerCase().replace(/\s+/g, "-")}`,
    name: fileSource.name,
    type: "file",
    icon: fileSource.icon,
    platform: "File Upload",
    description: fileSource.description,
    category: "File Sources",
  };
}
