import type { ChannelId, Cohort, SEPFile } from "./sepTypes";

const stringify = (v: unknown) => JSON.stringify(v, null, 2);

export const briefMd = (c: Cohort, channels: ChannelId[]): string => {
  const overrides = c.overrideHistory.length
    ? c.overrideHistory.map((o) => `- ${o.at} — ${o.by}: ${o.note}`).join("\n")
    : "_No overrides recorded._";
  return `# ${c.name}

**Treatment:** ${c.treatment}  ·  **Priority:** ${c.priority}  ·  **Review state:** ${c.reviewState}

## Definition
${c.definition}

## Rationale
${c.rationale}

## Kill criterion
${c.killCriterion}

## Scoring
- Fit: ${c.scoring.fit}
- Intent: ${c.scoring.intent}
- Confidence: ${c.scoring.confidence}
- Composite: **${c.scoring.composite}**

## Channels in this package
${channels.length ? channels.map((ch) => `- ${ch}`).join("\n") : "_None_"}

## Override history
${overrides}
`;
};

export const accountsJson = (c: Cohort): string =>
  stringify(
    c.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      domain: a.domain,
      contacts: a.contacts,
    })),
  );

const audienceLine = (c: Cohort) =>
  `${c.accounts.length} accounts · ${c.definition.split(".")[0]}`;

const metaCampaignBrief = (c: Cohort): SEPFile => ({
  name: "meta-campaign-brief.json",
  mime: "application/json",
  content: stringify({
    objective: "Demand capture + retargeting",
    audience: audienceLine(c),
    messagingAngle: `Lead with ${c.scoring.fit > 70 ? "platform reliability" : "cost reduction"}; secondary angle: developer experience.`,
    budgetGuidance: { weeklyEur: c.priority === "HIGH" ? 6000 : 2500, durationWeeks: 6 },
    accountsRef: "./accounts.json",
  }),
});

const metaAdCopy = (c: Cohort): SEPFile => ({
  name: "meta-ad-copy.md",
  mime: "text/markdown",
  content: `# Meta ad copy — ${c.name}

## Headline variants
1. The platform team's quiet upgrade
2. Less noise. Faster on-call. Same stack.
3. Built for ${c.name.split(" ")[0]} platform teams

## Primary text
Cut alert volume in half without ripping out your stack. Trusted by platform teams scaling past 1k services.

## CTA
Book a 20-minute walkthrough
`,
});

const tiktokCampaignBrief = (c: Cohort): SEPFile => ({
  name: "tiktok-campaign-brief.json",
  mime: "application/json",
  content: stringify({
    objective: "Awareness + cheap top-funnel",
    audience: audienceLine(c),
    messagingAngle: "Founder-led, dev-cultural, behind-the-scenes engineering humour.",
    budgetGuidance: { weeklyEur: 1500, durationWeeks: 4 },
    accountsRef: "./accounts.json",
  }),
});

const tiktokScriptDrafts = (c: Cohort): SEPFile => ({
  name: "tiktok-script-drafts.md",
  mime: "text/markdown",
  content: `# TikTok script drafts — ${c.name}

## Script 1 — "The 3am alert"
Cold open: phone ringing at 3am. Cut to dashboard. Voiceover: "It used to mean something was on fire. Now it just means Tuesday."

## Script 2 — "On-call survival kit"
POV: engineer unpacks a literal toolkit. Each tool is a SaaS logo. Punchline: one tool replaces the box.
`,
});

const linkedinSequence = (c: Cohort): SEPFile => ({
  name: "linkedin-sequence.json",
  mime: "application/json",
  content: stringify({
    objective: "Book qualified meetings",
    audience: audienceLine(c),
    steps: [
      { day: 0, type: "connection_request", template: `Hi {firstName}, saw your post on {recentActivity}. Mind if I connect?` },
      { day: 2, type: "message", template: `Thanks for connecting. We helped teams like yours cut alert noise by 50%. Worth a quick chat?` },
      { day: 6, type: "message", template: `Following up — happy to share a 4-min loom on what we'd do for {company}.` },
      { day: 12, type: "message", template: `Last one — closing the loop. If timing's off, no worries.` },
    ],
    accountsRef: "./accounts.json",
  }),
});

const emailSequence = (c: Cohort): SEPFile => ({
  name: "email-sequence.md",
  mime: "text/markdown",
  content: `# Email sequence — ${c.name}

## Step 1 (day 0)
**Subject:** {firstName}, a quieter on-call for {company}?

Hey {firstName},

Noticed {recentActivity}. Teams at your size usually hit alert fatigue around the 200-service mark — we built something specifically for that. Worth 15 minutes?

## Step 2 (day 3)
**Subject:** Re: a quieter on-call

Following up. Happy to send a 4-minute walkthrough instead of meeting — your call.

## Step 3 (day 8)
**Subject:** closing the loop

If timing isn't right, no worries — I'll stop here. If it is, my calendar's open.
`,
});

const crmEnrollment = (c: Cohort): SEPFile => ({
  name: "crm-enrollment.json",
  mime: "application/json",
  content: stringify({
    workflow: "nurture-q2-2026",
    listName: `${c.name} — Nurture Q2`,
    accountsRef: "./accounts.json",
    cadence: { firstTouchDays: 0, intervalDays: 14, totalTouches: 6 },
    exitCriteria: ["meeting_booked", "unsubscribed", "marked_not_a_fit"],
  }),
});

const figmaPrompt = (c: Cohort): SEPFile => ({
  name: "figma-prompt.md",
  mime: "text/markdown",
  content: `# Figma prompt — ${c.name}

Generate 6 ad creative concepts for ${c.name}.

- Format: 1:1 and 4:5 for Meta, 9:16 for TikTok.
- Tone: confident, dry, engineer-coded. No stock people, no glassmorphism.
- Hero motif: a single visual metaphor for "less noise" (one pixel in a static field, one pin on an empty map, etc.).
- Use brand palette only. Type: monospace headline, sans body.
`,
});

const creativeBrief = (c: Cohort): SEPFile => ({
  name: "creative-brief.md",
  mime: "text/markdown",
  content: `# Creative brief — ${c.name}

**Audience:** ${audienceLine(c)}
**Angle:** ${c.scoring.fit > 70 ? "Reliability without sprawl" : "Cost discipline without lock-in"}
**Proof points:** 50% alert reduction, 30% lower tooling spend, 4-week time-to-value.
**Tone:** Quiet competence. No hype.
**Deliverables:** 6 ad units, 1 hero, 3 carousel.
`,
});

const personalizedMessages = (c: Cohort): SEPFile => ({
  name: "personalized-messages.json",
  mime: "application/json",
  content: stringify(
    c.accounts.flatMap((a) =>
      a.contacts.map((ct) => ({
        accountId: a.id,
        contact: ct.name,
        channel: "linkedin",
        message: `Hi ${ct.name.split(" ")[0]} — saw ${ct.recentActivities[0] ?? "your recent work"}. We've been working with ${c.name} teams on ${ct.challenges[0] ?? "platform scale"}. Open to a quick exchange?`,
      })),
    ),
  ),
});

export const channelFileBuilders: Record<ChannelId, (c: Cohort) => SEPFile[]> = {
  meta: (c) => [metaCampaignBrief(c), metaAdCopy(c)],
  tiktok: (c) => [tiktokCampaignBrief(c), tiktokScriptDrafts(c)],
  linkedin: (c) => [linkedinSequence(c)],
  email: (c) => [emailSequence(c)],
  crm: (c) => [crmEnrollment(c)],
  figma: (c) => [figmaPrompt(c), creativeBrief(c)],
  personalized: (c) => [personalizedMessages(c)],
};