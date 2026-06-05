import { z } from "zod";

export const FetchSignalsResponseSchema = z.object({}).passthrough();
export type FetchSignalsResponse = z.infer<typeof FetchSignalsResponseSchema>;

export const GenerateSignalsBatchResponseSchema = z.object({}).passthrough();
export type GenerateSignalsBatchResponse = z.infer<typeof GenerateSignalsBatchResponseSchema>;
