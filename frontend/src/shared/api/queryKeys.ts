// Typed query-key factory (spec 20 §3.5). Array-tuple keys (the TanStack
// convention) so invalidation targets are not stringly-typed.
export const qk = {
  companyProfile: (orgId: string) => ["company-profile", orgId] as const,
  tenants: (userId: string | null | undefined) => ["tenants", userId ?? "anon"] as const,
  marketResearchComponent: (orgId: string, componentName: string) =>
    ["market-research", "component", orgId, componentName] as const,
};
