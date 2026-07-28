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
import { describe, expect, it } from "vitest";

import {
  buildAnalyticsConnector,
  buildCompetitorConnector,
  buildCrmConnector,
  buildLinkedInConnector,
  buildOtherFileConnector,
  buildProductDocConnector,
  buildSlackConnector,
  buildTwitterConnector,
} from "../connectorFactory";

// ─── CRM ─────────────────────────────────────────────────────────────────────

describe("buildCrmConnector", () => {
  it("returns the correct shape for salesforce", () => {
    const result = buildCrmConnector("salesforce");
    expect(result.id).toBe("conn-salesforce");
    expect(result.name).toBe("Salesforce");
    expect(result.type).toBe("crm");
    expect(result.icon).toBe(Database);
    expect(result.platform).toBe("Salesforce");
    expect(result.description).toBe("Connect your Salesforce CRM");
    expect(result.category).toBe("CRM");
  });

  it("returns the correct shape for hubspot", () => {
    const result = buildCrmConnector("hubspot");
    expect(result.id).toBe("conn-hubspot");
    expect(result.name).toBe("HubSpot");
    expect(result.platform).toBe("HubSpot");
    expect(result.description).toBe("Connect your HubSpot CRM");
  });

  it("derives id and name for pipedrive", () => {
    const result = buildCrmConnector("pipedrive");
    expect(result.id).toBe("conn-pipedrive");
    expect(result.name).toBe("Pipedrive");
  });

  it("derives id and name for zoho", () => {
    const result = buildCrmConnector("zoho");
    expect(result.id).toBe("conn-zoho");
    expect(result.name).toBe("Zoho CRM");
  });
});

// ─── Social ───────────────────────────────────────────────────────────────────

describe("buildLinkedInConnector", () => {
  it("returns the correct static fields", () => {
    const result = buildLinkedInConnector(["https://linkedin.com/company/acme"]);
    expect(result.id).toBe("conn-linkedin");
    expect(result.name).toBe("LinkedIn Sales Navigator");
    expect(result.type).toBe("social");
    expect(result.icon).toBe(Linkedin);
    expect(result.platform).toBe("LinkedIn");
    expect(result.category).toBe("Social");
  });

  it("includes trimmed non-blank URLs in description", () => {
    const result = buildLinkedInConnector([
      "https://linkedin.com/company/acme",
      "  ",
      "https://linkedin.com/company/beta",
    ]);
    expect(result.description).toBe(
      "LinkedIn URLs: https://linkedin.com/company/acme, https://linkedin.com/company/beta",
    );
  });

  it("filters out blank-only URLs from description", () => {
    const result = buildLinkedInConnector(["  "]);
    // blank URL is trimmed away; description ends with empty join
    expect(result.description).toBe("LinkedIn URLs: ");
  });
});

describe("buildTwitterConnector", () => {
  it("returns a fixed-shape connector", () => {
    const result = buildTwitterConnector();
    expect(result.id).toBe("conn-twitter");
    expect(result.name).toBe("X");
    expect(result.type).toBe("social");
    expect(result.icon).toBe(Twitter);
    expect(result.platform).toBe("Twitter");
    expect(result.description).toBe("Connect X account");
    expect(result.category).toBe("Social");
  });
});

// ─── Analytics ────────────────────────────────────────────────────────────────

describe("buildAnalyticsConnector", () => {
  it("uses Globe icon for google-analytics", () => {
    const result = buildAnalyticsConnector("google-analytics");
    expect(result.id).toBe("conn-google-analytics");
    expect(result.name).toBe("Google Analytics");
    expect(result.type).toBe("analytics");
    expect(result.icon).toBe(Globe);
    expect(result.platform).toBe("Google Analytics");
    expect(result.description).toBe("Connect Google Analytics");
    expect(result.category).toBe("Analytics");
  });

  it("uses BarChart3 icon for the non-google-analytics branch (mixpanel)", () => {
    const result = buildAnalyticsConnector("mixpanel");
    expect(result.id).toBe("conn-mixpanel");
    expect(result.name).toBe("Mixpanel");
    expect(result.icon).toBe(BarChart3);
    expect(result.description).toBe("Connect Mixpanel");
    expect(result.category).toBe("Analytics");
  });
});

// ─── Competitors ──────────────────────────────────────────────────────────────

describe("buildCompetitorConnector", () => {
  it("derives id, name, description from competitor + index", () => {
    const result = buildCompetitorConnector({ name: "Acme Corp", url: "https://acme.com" }, 2);
    expect(result.id).toBe("conn-competitor-2");
    expect(result.name).toBe("Competitor: Acme Corp");
    expect(result.type).toBe("custom");
    expect(result.icon).toBe(Users);
    expect(result.platform).toBe("Competitor");
    expect(result.description).toBe("Competitor: Acme Corp - https://acme.com");
    expect(result.category).toBe("Competitors");
  });

  it("uses index 0 for the first competitor", () => {
    const result = buildCompetitorConnector({ name: "Beta Inc", url: "https://beta.io" }, 0);
    expect(result.id).toBe("conn-competitor-0");
  });
});

// ─── Slack ────────────────────────────────────────────────────────────────────

describe("buildSlackConnector", () => {
  it("derives id, name, description from config + index", () => {
    const result = buildSlackConnector({ workspace: "engineering", channel: "#general" }, 1);
    expect(result.id).toBe("conn-slack-1");
    expect(result.name).toBe("Slack: engineering");
    expect(result.type).toBe("communication");
    expect(result.icon).toBe(Slack);
    expect(result.platform).toBe("Slack");
    expect(result.description).toBe("Slack: engineering - #general");
    expect(result.category).toBe("Communication");
  });

  it("falls back to 'All channels' when channel is empty string", () => {
    const result = buildSlackConnector({ workspace: "product", channel: "" }, 0);
    expect(result.description).toBe("Slack: product - All channels");
  });
});

// ─── Product Docs ─────────────────────────────────────────────────────────────

describe("buildProductDocConnector", () => {
  it("uses singular name when there is only one doc", () => {
    // totalCount = 1 -> no suffix appended to name
    const fileData = { file: null, destinationUrl: "" };
    const result = buildProductDocConnector(fileData, 0, 1);
    expect(result.id).toBe("file-product-doc-0");
    expect(result.name).toBe("Product Documentation");
    expect(result.type).toBe("file");
    expect(result.icon).toBe(FileText);
    expect(result.platform).toBe("File Upload");
    expect(result.category).toBe("File Sources");
    // No file -> no filename suffix in description
    expect(result.description).toBe("Docs, API guides, release notes, and specs");
  });

  it("appends (N) suffix when totalCount > 1", () => {
    const fileData = { file: null, destinationUrl: "" };
    const result = buildProductDocConnector(fileData, 1, 3);
    // index 1, so display number is 2
    expect(result.name).toBe("Product Documentation (2)");
  });

  it("includes the filename in description when a File is present", () => {
    // jsdom supports the File constructor
    const file = new File([""], "roadmap.pdf", { type: "application/pdf" });
    const result = buildProductDocConnector({ file, destinationUrl: "" }, 0, 1);
    expect(result.description).toBe("Docs, API guides, release notes, and specs - roadmap.pdf");
  });
});

// ─── Other Files ─────────────────────────────────────────────────────────────

describe("buildOtherFileConnector", () => {
  it("passes through name, icon, description from the source object", () => {
    const stubIcon = (() => null) as unknown as typeof Database;
    const result = buildOtherFileConnector({
      name: "CRM Export",
      icon: stubIcon,
      description: "Exported CRM records",
    });
    // id is derived by lowercasing + replacing spaces with hyphens
    expect(result.id).toBe("file-crm-export");
    expect(result.name).toBe("CRM Export");
    expect(result.type).toBe("file");
    expect(result.icon).toBe(stubIcon);
    expect(result.platform).toBe("File Upload");
    expect(result.description).toBe("Exported CRM records");
    expect(result.category).toBe("File Sources");
  });

  it("slugifies multi-word names correctly", () => {
    const result = buildOtherFileConnector({
      name: "Account Data",
      icon: FileText,
      description: "Account export",
    });
    expect(result.id).toBe("file-account-data");
  });
});
