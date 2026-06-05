import { z } from "zod";

// POST /api/signal_Ask + POST /api/signal_action responses. Permissive
// (`z.object({}).passthrough()`) on purpose: the backend is suspended/variable
// and the existing callers (SignalsPage + the ContextChat substrate) read
// the JSON loosely (e.g. `data.answer`). `.parse` validates the envelope is an
// object without rejecting real responses or extra fields. Phase 10 tightens
// these against a live capture.
export const SignalAskResponseSchema = z.object({}).passthrough();
export type SignalAskResponse = z.infer<typeof SignalAskResponseSchema>;

export const SignalActionResponseSchema = z.object({}).passthrough();
export type SignalActionResponse = z.infer<typeof SignalActionResponseSchema>;
