import { z } from "zod";

export const FetchSignalsResponseSchema = z.object({}).passthrough();
export type FetchSignalsResponse = z.infer<typeof FetchSignalsResponseSchema>;

export const GenerateSignalsBatchResponseSchema = z.object({}).passthrough();
export type GenerateSignalsBatchResponse = z.infer<typeof GenerateSignalsBatchResponseSchema>;

export const SignalLeadMapLeadSchema = z
  .object({
    lead_id: z.string(),
    company: z.string().optional().default(""),
    relevance: z.enum(["high", "medium", "low"]).catch("low"),
    why: z.string().optional().default(""),
  })
  .passthrough();

export const SignalLeadMapEntrySchema = z
  .object({
    signal_id: z.string(),
    headline: z.string().optional().default(""),
    leads: z.array(SignalLeadMapLeadSchema).default([]),
  })
  .passthrough();

export const SignalLeadMapResponseSchema = z
  .object({
    data: z
      .object({
        mapping: z.array(SignalLeadMapEntrySchema).default([]),
        generated_at: z.string().optional(),
        cached: z.boolean().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type SignalLeadMapEntry = z.infer<typeof SignalLeadMapEntrySchema>;
export type SignalLeadMapLead = z.infer<typeof SignalLeadMapLeadSchema>;
export type SignalLeadMapResponse = z.infer<typeof SignalLeadMapResponseSchema>;
