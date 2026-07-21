// Typed query-key factory (spec 20 §3.5). Array-tuple keys (the TanStack
// convention) so invalidation targets are not stringly-typed.
export const qk = {
  companyProfile: (orgId: string) => ["company-profile", orgId] as const,
  userProfile: (userId: string) => ["userProfile", userId] as const,
  agentProfile: (userId: string) => ["agentProfile", userId] as const,
  tenants: (userId: string | null | undefined) => ["tenants", userId ?? "anon"] as const,
  marketResearchComponent: (orgId: string, componentName: string) =>
    ["market-research", "component", orgId, componentName] as const,
  icps: (orgId: string) => ["mission-control", "icps", orgId] as const,
  dataSources: (orgId: string) => ["mission-control", "data-sources", orgId] as const,
  leadStreamStatus: (userId: string, orgId: string) =>
    ["mission-control", "lead-stream-status", userId, orgId] as const,
  customersProfile: (userId: string, orgId: string) =>
    ["customers", "profile", userId, orgId] as const,
  customersSuggestedIcps: (userId: string) => ["customers", "suggested-icps", userId] as const,
  signalsFeed: (userId: string) => ["signals", "feed", userId] as const,
  apolloStatus: (orgId: string) => ["connectors", "apollo", "status", orgId] as const,
  apolloWarmup: (orgId: string, userId: string) =>
    ["connectors", "apollo", "warmup", orgId, userId] as const,
  apolloDiscoverStatus: (orgId: string, runId: string | null) =>
    ["connectors", "apollo", "discover-status", orgId, runId] as const,
  signalLeadMap: (orgId: string, userId: string) => ["signals", "lead-map", orgId, userId] as const,
  leads: (orgId: string) => ["leads", orgId] as const,
};
