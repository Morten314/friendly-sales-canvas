import { z } from "zod";

export const FetchSignalsResponseSchema = z.object({}).passthrough();
export type FetchSignalsResponse = z.infer<typeof FetchSignalsResponseSchema>;

export const GenerateSignalsBatchResponseSchema = z.object({}).passthrough();
export type GenerateSignalsBatchResponse = z.infer<typeof GenerateSignalsBatchResponseSchema>;

// Sub-shapes grounded on the backend's server-normalized _parse_mapping
// (lead_map.py): each lead is rebuilt as {lead_id, company, relevance, why} and
// each entry as {signal_id, headline, leads[]}. KEEP the degrade-never-throw
// guards — the feature depends on them (company || "Unknown company", omit-empty
// why, and avoiding one odd lead throwing an org-wide parse error). No .strict():
// a plain z.object strips FE-ignored extras; .strict() would throw on them.
export const SignalLeadMapLeadSchema = z.object({
  lead_id: z.string(),
  company: z.string().optional().default(""),
  relevance: z.enum(["high", "medium", "low"]).catch("low"),
  why: z.string().optional().default(""),
});

export const SignalLeadMapEntrySchema = z.object({
  signal_id: z.string(),
  headline: z.string().optional().default(""),
  leads: z.array(SignalLeadMapLeadSchema).default([]),
});

export const SignalLeadMapResponseSchema = z.object({
  // _build_result always returns status:"success" — modeled, not passthrough-tolerated.
  status: z.string().optional(),
  data: z.object({
    mapping: z.array(SignalLeadMapEntrySchema).default([]),
    generated_at: z.string().optional(),
    cached: z.boolean().optional(),
  }),
});

export type SignalLeadMapEntry = z.infer<typeof SignalLeadMapEntrySchema>;
export type SignalLeadMapLead = z.infer<typeof SignalLeadMapLeadSchema>;
export type SignalLeadMapResponse = z.infer<typeof SignalLeadMapResponseSchema>;

// POST /api/generate-recommendation-artefact_claude — five LLM playbook sections.
// All optional + .default("") so a malformed/partial backend response still parses
// (degrade-never-throw, consistent with the lead-map schemas). No .strict(): the
// backend may add status/usage extras a plain object harmlessly strips.
export const RecommendationArtefactResponseSchema = z.object({
  what_to_do: z.string().optional().default(""),
  strategy: z.string().optional().default(""),
  how_to_communicate: z.string().optional().default(""),
  communication_channel: z.string().optional().default(""),
  communication_template: z.string().optional().default(""),
});
export type RecommendationArtefactResponse = z.infer<typeof RecommendationArtefactResponseSchema>;
