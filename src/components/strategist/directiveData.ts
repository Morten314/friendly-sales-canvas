// ─── Strategist Immediate Action Directives ─────────────────────────────────
// Lead-specific actions that require attention today.

export type DirectiveType =
  | "act-now"
  | "change-entry-point"
  | "change-narrative"
  | "build-warmth"
  | "wait"
  | "trigger-based-play"
  | "internal-routing"
  | "sequence-selection";

export interface DirectiveButton {
  label: string;
  icon: "mail" | "linkedin" | "phone" | "clock" | "zap" | "users" | "list";
}

const buttonMap: Record<DirectiveType, DirectiveButton[]> = {
  "act-now": [
    { label: "Email", icon: "mail" },
    { label: "LinkedIn", icon: "linkedin" },
    { label: "Call", icon: "phone" },
  ],
  "change-entry-point": [
    { label: "Email", icon: "mail" },
    { label: "LinkedIn", icon: "linkedin" },
  ],
  "change-narrative": [
    { label: "Email", icon: "mail" },
    { label: "LinkedIn", icon: "linkedin" },
  ],
  "build-warmth": [
    { label: "LinkedIn", icon: "linkedin" },
  ],
  "wait": [
    { label: "Remind me in 5 days", icon: "clock" },
  ],
  "trigger-based-play": [
    { label: "Set Trigger", icon: "zap" },
  ],
  "internal-routing": [
    { label: "Route to teammate", icon: "users" },
  ],
  "sequence-selection": [
    { label: "Enroll in Sequence", icon: "list" },
  ],
};

export interface ActionDirective {
  id: string;
  leadName: string;
  company: string;
  email: string;
  linkedinUrl: string;
  actionType: DirectiveType;
  actionLabel: string;
  instruction: string;
  whyToday: string;
  buttons: DirectiveButton[];
}

function directiveLabel(type: DirectiveType): string {
  switch (type) {
    case "act-now": return "Act now";
    case "change-entry-point": return "Change entry point";
    case "change-narrative": return "Change narrative";
    case "build-warmth": return "Build warmth";
    case "wait": return "Wait";
    case "trigger-based-play": return "Trigger-based play";
    case "internal-routing": return "Internal routing";
    case "sequence-selection": return "Sequence selection";
  }
}

export const actionDirectives: ActionDirective[] = [
  {
    id: "d1",
    leadName: "Sarah Chen",
    company: "Nexova AI",
    email: "sarah@nexova-ai.com",
    linkedinUrl: "linkedin.com/in/sarah-chen",
    actionType: "act-now",
    actionLabel: directiveLabel("act-now"),
    instruction:
      "Send a displacement email referencing their Q2 pricing page update — position your integration layer as a low-risk migration path.",
    whyToday:
      "Scout detected their competitor contract renewal window closes in 9 days; after that, switching cost doubles.",
    buttons: buttonMap["act-now"],
  },
  {
    id: "d2",
    leadName: "Marcus Rivera",
    company: "Helix Health",
    email: "mrivera@helixhealth.io",
    linkedinUrl: "linkedin.com/in/marcus-rivera",
    actionType: "change-entry-point",
    actionLabel: directiveLabel("change-entry-point"),
    instruction:
      "VP Ops was unresponsive — pivot to their newly promoted Head of Data who posted about integration challenges last week.",
    whyToday:
      "The new Head of Data is in their first 30 days and actively evaluating tooling; the influence window is narrow.",
    buttons: buttonMap["change-entry-point"],
  },
  {
    id: "d3",
    leadName: "Priya Kapoor",
    company: "FinLedger",
    email: "priya.k@finledger.com",
    linkedinUrl: "linkedin.com/in/priya-kapoor",
    actionType: "build-warmth",
    actionLabel: directiveLabel("build-warmth"),
    instruction:
      "Engage with her latest LinkedIn post on compliance automation — add a thoughtful comment, don't pitch.",
    whyToday:
      "She posted 4 hours ago and engagement is still low; early meaningful interaction maximises visibility.",
    buttons: buttonMap["build-warmth"],
  },
  {
    id: "d4",
    leadName: "Tom Andersen",
    company: "CloudBridge",
    email: "tom@cloudbridge.dev",
    linkedinUrl: "linkedin.com/in/tom-andersen",
    actionType: "wait",
    actionLabel: directiveLabel("wait"),
    instruction:
      "Board meeting is Thursday — any outreach before the decision will be ignored. Set a follow-up for Monday.",
    whyToday:
      "Reaching out now risks being buried; post-board is when budget conversations actually start.",
    buttons: buttonMap["wait"],
  },
];