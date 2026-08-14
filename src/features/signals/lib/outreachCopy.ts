import type { SignalLeadMapLead } from "../contracts";
import type { OutreachPlanStep, OutreachTouch, RelevanceTier } from "./aggregateOutreachPlan";

/** A touch with sendable copy attached. Subject is empty for LinkedIn/call touches. */
export interface TouchCopy extends OutreachTouch {
  subject: string;
  body: string;
}

/** Merge tokens left unresolved when writing copy for a whole cohort. */
const TOKENS = {
  firstName: "{{firstName}}",
  company: "{{company}}",
  title: "{{title}}",
};

const firstName = (full: string) => (full || "").trim().split(/\s+/)[0] || "";

/** Resolve merge tokens against one lead; leave them intact when no lead is picked. */
export function resolveTokens(text: string, lead?: SignalLeadMapLead | null): string {
  if (!lead) return text;
  return text
    .split(TOKENS.firstName)
    .join(firstName(lead.name) || "there")
    .split(TOKENS.company)
    .join(lead.company || "your team")
    .split(TOKENS.title)
    .join(lead.title || "your role");
}

interface TemplateInput {
  headline: string;
  snippet: string;
}

/**
 * Deterministic, offline copy for one touch. Tier drives the posture:
 * high = signal-led with a call ask, medium = market context, low = nurture.
 */
function templateFor(touch: OutreachTouch, tier: RelevanceTier, s: TemplateInput): TouchCopy {
  const h = s.headline;
  const ctx = s.snippet?.trim() || h;
  const base = { ...touch, subject: "", body: "" };

  if (touch.channel === "call") {
    return {
      ...base,
      body: `Call opener for ${TOKENS.firstName} at ${TOKENS.company}:\n\n"Hi ${TOKENS.firstName} — I'm calling because of ${h}. Teams in your position usually have to decide fast whether it changes anything for them. Worth 15 minutes to compare notes?"\n\nIf voicemail: reference the same point and say a short email is following.`,
    };
  }

  if (touch.channel === "linkedin") {
    const note =
      tier === "high"
        ? `${TOKENS.firstName} — reaching out after ${h}. We're seeing this land hardest on teams like ${TOKENS.company}. Happy to share what we're hearing.`
        : `${TOKENS.firstName} — following ${h} and the effect it's having across the sector. Sending a connect in case it's useful to compare notes later.`;
    return { ...base, body: note };
  }

  // email
  if (tier === "high") {
    return touch.day <= 1
      ? {
          ...base,
          subject: `${h} — what it means for ${TOKENS.company}`,
          body: `Hi ${TOKENS.firstName},\n\n${ctx}\n\nGiven your remit as ${TOKENS.title}, this is the kind of change that usually forces a decision within a quarter — either you move early or you absorb the cost later.\n\nWe've helped teams in exactly this position get ahead of it. Worth 15 minutes this week to see whether it applies to ${TOKENS.company}?\n\nBest,\n[Your name]`,
        }
      : {
          ...base,
          subject: `Re: ${h}`,
          body: `Hi ${TOKENS.firstName},\n\nFollowing up with one proof point: teams that acted on this early cut the scramble later — same headcount, far less disruption.\n\nIf it's easier, I can send a one-page summary instead of a call. Which would you prefer?\n\nBest,\n[Your name]`,
        };
  }

  if (tier === "medium") {
    return touch.day <= 1
      ? {
          ...base,
          subject: `Context on ${h}`,
          body: `Hi ${TOKENS.firstName},\n\n${ctx}\n\nNot a pitch — we're tracking how this is landing across the sector and thought the read might be useful given what you own at ${TOKENS.company}.\n\nHappy to share what we're seeing if it's relevant.\n\nBest,\n[Your name]`,
        }
      : {
          ...base,
          subject: `Useful read on ${h}`,
          body: `Hi ${TOKENS.firstName},\n\nSharing a short breakdown of how comparable teams are responding to ${h}.\n\nIf any of it maps to what you're planning, I'm glad to go deeper — otherwise, no action needed.\n\nBest,\n[Your name]`,
        };
  }

  return touch.day <= 1
    ? {
        ...base,
        subject: `Adding you to our sector briefing`,
        body: `Hi ${TOKENS.firstName},\n\nWe publish a short briefing on developments like ${h}. Adding you in case it's useful — unsubscribe any time, no follow-up from me.\n\nBest,\n[Your name]`,
      }
    : {
        ...base,
        subject: `Quick check-in`,
        body: `Hi ${TOKENS.firstName},\n\nChecking in a quarter on. ${h} has continued to move — if priorities at ${TOKENS.company} have shifted, happy to pick it up.\n\nBest,\n[Your name]`,
      };
}

/** Template copy for every touch in a cohort. Always available, no network. */
export function buildCohortCopy(step: OutreachPlanStep, signal: TemplateInput): TouchCopy[] {
  return step.touches.map((t) => templateFor(t, step.relevance, signal));
}

/* ------------------------------------------------------------------ */
/* Persistence: AI-personalised + hand-edited copy, per signal+cohort  */
/* ------------------------------------------------------------------ */

const STORE_KEY = "signalOutreachCopy";

type CopyStore = Record<string, TouchCopy[]>;

export const copyKey = (signalId: string, cohortLabel: string) => `${signalId}::${cohortLabel}`;

function readStore(): CopyStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as CopyStore) : {};
  } catch {
    return {};
  }
}

export function loadCohortCopy(signalId: string, cohortLabel: string): TouchCopy[] | null {
  return readStore()[copyKey(signalId, cohortLabel)] ?? null;
}

export function saveCohortCopy(signalId: string, cohortLabel: string, copy: TouchCopy[]): void {
  try {
    const store = readStore();
    store[copyKey(signalId, cohortLabel)] = copy;
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // storage full / unavailable — copy stays in-memory for this session
  }
}

export function clearCohortCopy(signalId: string, cohortLabel: string): void {
  try {
    const store = readStore();
    delete store[copyKey(signalId, cohortLabel)];
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

/** Compose a mailto/webmail draft URL for one email touch. */
export function composeUrl(
  provider: "gmail" | "outlook",
  to: string,
  subject: string,
  body: string,
): string {
  const s = encodeURIComponent(subject);
  const b = encodeURIComponent(body);
  const t = encodeURIComponent(to || "");
  return provider === "gmail"
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${t}&su=${s}&body=${b}`
    : `https://outlook.office.com/mail/deeplink/compose?to=${t}&subject=${s}&body=${b}`;
}