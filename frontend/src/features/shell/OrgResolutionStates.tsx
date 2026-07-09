import { Button } from "@/components/ui/button";

/** Shell-level shown while org resolution is still pending (spec 48 WS1a). */
export function OrgResolving() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

/**
 * Transient (timeout/5xx/network, no usable cache). A mapped user on a cold or
 * flaky backend — NOT an unprovisioned user — so never the "contact admin" copy
 * (spec 48 WS1f). Bounded auto-retry has stopped; offer a manual retry.
 */
export function OrgReconnecting({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
      <h2 className="text-lg font-semibold">Having trouble reaching your workspace</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        We couldn&apos;t confirm your workspace. This is usually temporary.
      </p>
      <Button onClick={onRetry}>Try again</Button>
    </div>
  );
}

/** Authoritative no-org (real 404 / 2xx-without-org — the onboarding gap). */
export function NoOrgState() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-6">
      <h2 className="text-lg font-semibold">Your workspace isn&apos;t set up yet</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Your account isn&apos;t linked to a workspace. Please contact your admin.
      </p>
    </div>
  );
}
