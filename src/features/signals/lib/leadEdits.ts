// Per-signal, user-authored corrections to matched leads.
//
// Scope is deliberately *per signal* (the same person can legitimately be a
// high-relevance lead for one signal and low for another), so the storage key
// carries the signal id. Edits survive collapse/reload via localStorage and are
// applied before the leads reach the table, the cohort plan, the exports and
// the Strategist handoff — so an override changes everything downstream.

import type { SignalLeadMapLead } from "../contracts";

export type EditableLeadField = "name" | "title" | "company" | "relevance" | "why";

export interface LeadEdit {
  name?: string;
  title?: string;
  company?: string;
  relevance?: SignalLeadMapLead["relevance"];
  why?: string;
  /** Set when the user marks the lead "not a fit"; drops it from the table. */
  dismissed?: boolean;
  dismissReason?: string;
}

export type SignalLeadEdits = Record<string, LeadEdit>;

const STORAGE_KEY = "brewra.signals.leadEdits.v1";

export const DISMISS_REASONS = [
  "Not a fit",
  "Wrong persona",
  "Wrong region",
  "Already a customer",
  "Left the company",
  "Duplicate",
] as const;

type AllEdits = Record<string, SignalLeadEdits>;

let cache: AllEdits | null = null;

function readAll(): AllEdits {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as AllEdits) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function writeAll(next: AllEdits) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — edits still live in the in-memory cache */
  }
  emit();
}

// ─── Subscription (useSyncExternalStore) ─────────────────────────────────────

const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribeLeadEdits(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLeadEditsVersion(): number {
  return version;
}

// ─── Reads / writes ──────────────────────────────────────────────────────────

export function getSignalLeadEdits(signalId: string): SignalLeadEdits {
  return readAll()[signalId] ?? {};
}

export function setLeadEdit(signalId: string, leadId: string, patch: LeadEdit) {
  const all = readAll();
  const forSignal = { ...(all[signalId] ?? {}) };
  const merged = { ...(forSignal[leadId] ?? {}), ...patch };
  forSignal[leadId] = merged;
  writeAll({ ...all, [signalId]: forSignal });
}

export function clearLeadEdit(signalId: string, leadId: string) {
  const all = readAll();
  const forSignal = { ...(all[signalId] ?? {}) };
  delete forSignal[leadId];
  writeAll({ ...all, [signalId]: forSignal });
}

export function dismissLead(signalId: string, leadId: string, reason: string) {
  setLeadEdit(signalId, leadId, { dismissed: true, dismissReason: reason });
}

export function restoreLead(signalId: string, leadId: string) {
  setLeadEdit(signalId, leadId, { dismissed: false, dismissReason: undefined });
}

export function restoreAllLeads(signalId: string) {
  const all = readAll();
  const forSignal = { ...(all[signalId] ?? {}) };
  Object.keys(forSignal).forEach((leadId) => {
    forSignal[leadId] = { ...forSignal[leadId], dismissed: false, dismissReason: undefined };
  });
  writeAll({ ...all, [signalId]: forSignal });
}

// ─── Application ─────────────────────────────────────────────────────────────

/** True when the user changed at least one visible field on this lead. */
export function isLeadEdited(edit: LeadEdit | undefined): boolean {
  if (!edit) return false;
  return (["name", "title", "company", "relevance", "why"] as const).some(
    (f) => edit[f] !== undefined && edit[f] !== "",
  );
}

export interface AppliedLeads {
  /** Leads with overrides applied, dismissed ones removed. */
  leads: SignalLeadMapLead[];
  /** Lead ids the user marked "not a fit" (kept so they can be restored). */
  dismissed: SignalLeadMapLead[];
  edits: SignalLeadEdits;
}

export function applyLeadEdits(signalId: string, leads: SignalLeadMapLead[]): AppliedLeads {
  const edits = getSignalLeadEdits(signalId);
  const kept: SignalLeadMapLead[] = [];
  const dismissed: SignalLeadMapLead[] = [];
  leads.forEach((lead) => {
    const edit = edits[lead.lead_id];
    const merged: SignalLeadMapLead = edit
      ? {
          ...lead,
          name: edit.name ?? lead.name,
          title: edit.title ?? lead.title,
          company: edit.company ?? lead.company,
          relevance: edit.relevance ?? lead.relevance,
          why: edit.why ?? lead.why,
        }
      : lead;
    if (edit?.dismissed) dismissed.push(merged);
    else kept.push(merged);
  });
  return { leads: kept, dismissed, edits };
}
