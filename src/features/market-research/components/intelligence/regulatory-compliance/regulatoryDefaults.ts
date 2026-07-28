// Single source of truth for the regulatory-compliance fallback datasets.
// Previously inlined three times in RegulatoryComplianceSection.tsx (TD-FE-24).

export const DEFAULT_REGIONAL_DATA = [
  {
    region: "European Union",
    framework: "GDPR + AI Act",
    deadline: "Q1 2026",
    impact: "High",
    status: "Active",
    requirements: "Data protection, AI governance",
  },
  {
    region: "United States",
    framework: "CCPA + State Laws",
    deadline: "Ongoing",
    impact: "Medium",
    status: "Evolving",
    requirements: "Privacy rights, data handling",
  },
  {
    region: "China",
    framework: "PIPL + Cybersecurity Law",
    deadline: "Active",
    impact: "High",
    status: "Mandatory",
    requirements: "Data localization, security",
  },
  {
    region: "United Kingdom",
    framework: "UK GDPR + DPA",
    deadline: "Active",
    impact: "Medium",
    status: "Active",
    requirements: "Data protection, transfers",
  },
];

export const DEFAULT_VISUAL_DATA_CARDS = [
  {
    title: "Compliance Adoption Rates",
    type: "bar-chart",
    data: [
      { name: "GDPR", value: 68, color: "#10b981" },
      { name: "CCPA", value: 45, color: "#3b82f6" },
      { name: "SOC 2", value: 72, color: "#8b5cf6" },
      { name: "ISO 27001", value: 38, color: "#f59e0b" },
    ],
  },
  {
    title: "Regulatory Timeline",
    type: "timeline",
    data: [
      { date: "Q1 2025", event: "EU AI Act Phase 1", status: "upcoming" },
      { date: "Q3 2025", event: "GDPR Updates", status: "upcoming" },
      { date: "Q1 2026", event: "EU AI Act Full Enforcement", status: "critical" },
    ],
  },
  {
    title: "Risk Indicators",
    type: "percentage",
    data: [
      { metric: "Data Breach Risk", value: 23, trend: "down" },
      { metric: "Non-compliance Penalties", value: 15, trend: "up" },
      { metric: "Audit Readiness", value: 67, trend: "up" },
    ],
  },
];
