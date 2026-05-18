import type { Cohort } from "./sepTypes";

export const BOARD_ID = "kadenza-germany-2026-q2";
export const BOARD_NAME = "Kadenza · Germany Q2 2026";
export const APPROVER = { roleId: "gtm_owner", name: "Sara Chen" };

export const boardCohorts: Cohort[] = [
  {
    id: "dach-enterprise",
    name: "DACH Enterprise",
    treatment: "DIRECT",
    priority: "HIGH",
    reviewState: "reviewed",
    definition:
      "Enterprise accounts (1k+ FTE) headquartered in DACH with platform-engineering teams of 20+ and observable Kubernetes adoption.",
    rationale:
      "ICP fit is highest in DACH (avg 82) and the recent Berlin SaaS Summit produced 11 in-market signals over the last 14 days.",
    killCriterion:
      "Pause if reply rate < 4% after 250 sends or if pipeline contribution < €120k by week 6.",
    scoring: { fit: 82, intent: 71, confidence: 78, composite: 77 },
    overrideHistory: [
      { at: "2026-05-12T09:14:00Z", by: "Sara Chen", note: "Bumped priority to HIGH after summit signal cluster." },
    ],
    suggestedChannels: ["meta", "linkedin", "personalized"],
    accounts: [
      {
        id: "acc-de-001",
        name: "Acme GmbH",
        domain: "acme.de",
        contacts: [
          {
            name: "Klaus Müller",
            role: "VP Engineering",
            recentActivities: ["Attended SaaS Summit Berlin", "Published post on scaling Kubernetes"],
            challenges: ["Team scaling", "Observability tooling"],
            interests: ["Platform engineering", "Cost optimisation"],
          },
        ],
      },
      {
        id: "acc-de-002",
        name: "Nordlicht AG",
        domain: "nordlicht.de",
        contacts: [
          {
            name: "Petra Hoffmann",
            role: "Director of Platform",
            recentActivities: ["Hired 4 SREs in last 60 days", "Published RFP for observability"],
            challenges: ["Vendor consolidation"],
            interests: ["Open standards", "OpenTelemetry"],
          },
        ],
      },
      {
        id: "acc-de-003",
        name: "Bauer Logistik",
        domain: "bauer-logistik.de",
        contacts: [
          {
            name: "Jonas Weber",
            role: "Head of Cloud",
            recentActivities: ["Migrating from on-prem to AWS", "Spoke at KubeCon EU"],
            challenges: ["Cost runaway", "Talent retention"],
            interests: ["FinOps", "Internal developer platforms"],
          },
        ],
      },
      {
        id: "acc-de-004",
        name: "Helios Energie SE",
        domain: "helios-energie.de",
        contacts: [
          {
            name: "Anja Richter",
            role: "CTO",
            recentActivities: ["Announced platform team rebuild", "Quoted in Handelsblatt"],
            challenges: ["Regulated workload reliability"],
            interests: ["Compliance automation", "Audit trail tooling"],
          },
        ],
      },
    ],
  },
  {
    id: "mid-market-emea",
    name: "Mid-Market EMEA",
    treatment: "CHANNEL",
    priority: "HIGH",
    reviewState: "edited",
    definition:
      "200–999 FTE software and fintech companies across EMEA, engineering-led, with public hiring for SRE/Platform roles in the last 60 days.",
    rationale:
      "Volume play: 96 accounts match, intent is medium but tooling-fit pattern is strong. LinkedIn + email sequencing converts at 6.2% historically.",
    killCriterion:
      "Pause if connection-accept rate < 22% after 400 invitations.",
    scoring: { fit: 68, intent: 58, confidence: 71, composite: 65 },
    overrideHistory: [],
    suggestedChannels: ["linkedin", "email"],
    accounts: [
      {
        id: "acc-mm-001",
        name: "Brevio",
        domain: "brevio.io",
        contacts: [
          {
            name: "Marta Silva",
            role: "Head of Platform",
            recentActivities: ["Hired 2 SREs", "Published 'why we left Datadog' post"],
            challenges: ["Cost", "Alert fatigue"],
            interests: ["OpenTelemetry"],
          },
        ],
      },
      {
        id: "acc-mm-002",
        name: "Loftbase",
        domain: "loftbase.com",
        contacts: [
          {
            name: "Daniel Okafor",
            role: "Director of Engineering",
            recentActivities: ["Raised Series B"],
            challenges: ["Scaling on-call"],
            interests: ["Reliability"],
          },
        ],
      },
      {
        id: "acc-mm-003",
        name: "Volterra Pay",
        domain: "volterrapay.com",
        contacts: [
          {
            name: "Sofia Bianchi",
            role: "VP Infrastructure",
            recentActivities: ["PCI-DSS recertification"],
            challenges: ["Audit overhead"],
            interests: ["Compliance"],
          },
        ],
      },
    ],
  },
  {
    id: "smb-dach",
    name: "SMB DACH",
    treatment: "NURTURE",
    priority: "MEDIUM",
    reviewState: "awaiting",
    definition:
      "50–199 FTE DACH SMBs with engineering teams and signs of platform investment but no current budget signal.",
    rationale:
      "Long-tail nurture: keep warm via content + CRM enrollment. Don't burn rep cycles.",
    killCriterion: "N/A — passive nurture only.",
    scoring: { fit: 54, intent: 31, confidence: 62, composite: 49 },
    overrideHistory: [],
    suggestedChannels: ["crm", "email"],
    accounts: [
      {
        id: "acc-smb-001",
        name: "Kleinwerk",
        domain: "kleinwerk.de",
        contacts: [
          {
            name: "Lena Vogt",
            role: "Engineering Lead",
            recentActivities: ["Wrote blog on tooling sprawl"],
            challenges: ["Limited budget"],
            interests: ["Open source"],
          },
        ],
      },
      {
        id: "acc-smb-002",
        name: "Stadtdaten",
        domain: "stadtdaten.de",
        contacts: [
          {
            name: "Felix Braun",
            role: "Tech Lead",
            recentActivities: ["Public RFC on telemetry"],
            challenges: ["Engineering hours"],
            interests: ["Self-hosted"],
          },
        ],
      },
    ],
  },
  {
    id: "us-enterprise",
    name: "US Enterprise",
    treatment: "EXCLUDE",
    priority: "LOW",
    reviewState: "overridden",
    definition:
      "US-based enterprises matching base ICP. Excluded for Q2 due to GTM focus on DACH and EMEA.",
    rationale: "Out of geographic focus this quarter; revisit Q3.",
    killCriterion: "—",
    scoring: { fit: 74, intent: 65, confidence: 72, composite: 70 },
    overrideHistory: [
      { at: "2026-05-10T16:02:00Z", by: "Sara Chen", note: "Excluded for Q2 by GTM owner." },
    ],
    suggestedChannels: [],
    accounts: [],
  },
];

export const getCohort = (id: string) => boardCohorts.find((c) => c.id === id);