import { z } from "zod";

export const WarmupMissingSchema = z.object({
  step: z.string(),
  label: z.string(),
  deep_link_hint: z.string(),
});

export const ApolloWarmupSchema = z
  .object({
    icp_configured: z.boolean(),
    signals_generated: z.boolean(),
    scout_completed: z.boolean(),
    profiler_analyzed: z.boolean(),
    ready_count: z.number(),
    unlocked: z.boolean(),
    missing: z.array(WarmupMissingSchema).default([]),
  })
  .passthrough();
export type ApolloWarmup = z.infer<typeof ApolloWarmupSchema>;

export const ApolloStatusSchema = z
  .object({
    connected: z.boolean(),
    status: z.string(),
    connected_at: z.string().nullish(),
    credits_consumed_total: z.number().default(0),
    last_run_credits: z.number().default(0),
    low_credit: z.boolean().default(false),
    last_discovery_at: z.string().nullish(),
    last_discovery_icp_fingerprint: z.string().nullish(),
    icp_changed_since_last_discovery: z.boolean().default(false),
  })
  .passthrough();
export type ApolloStatus = z.infer<typeof ApolloStatusSchema>;

export const ApolloDiscoverResponseSchema = z
  .object({ run_id: z.string(), status: z.string() })
  .passthrough();
export type ApolloDiscoverResponse = z.infer<typeof ApolloDiscoverResponseSchema>;

export const DiscoveryCountsSchema = z
  .object({
    searched: z.number().default(0),
    qualified: z.number().default(0),
    selected: z.number().default(0),
    revealed: z.number().default(0),
    verified: z.number().default(0),
    unverified: z.number().default(0),
    created: z.number().default(0),
    matched: z.number().default(0),
    skipped_duplicates: z.number().default(0),
    errors: z.array(z.object({ stage: z.string(), message: z.string() }).passthrough()).default([]),
  })
  .passthrough();

export const ApolloDiscoverStatusSchema = z
  .object({
    run_id: z.string(),
    org_id: z.string(),
    status: z.string(),
    mode: z.string(),
    counts: DiscoveryCountsSchema.default({}),
    credits_consumed: z.number().default(0),
    progress_percent: z.number().default(0),
    icp_fingerprint: z.string().nullish(),
    started_at: z.string().nullish(),
    finished_at: z.string().nullish(),
    message: z.string().nullish(),
  })
  .passthrough();
export type ApolloDiscoverStatus = z.infer<typeof ApolloDiscoverStatusSchema>;

export const DisconnectResponseSchema = z
  .object({ status: z.string(), message: z.string() })
  .passthrough();
export type DisconnectResponse = z.infer<typeof DisconnectResponseSchema>;
