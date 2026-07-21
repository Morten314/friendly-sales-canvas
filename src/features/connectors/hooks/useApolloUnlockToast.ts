import { useEffect } from "react";

import { useApolloStatus } from "./useApolloStatus";
import { useApolloWarmup } from "./useApolloWarmup";

import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/shared/auth";

function flagKey(orgId: string) {
  return `apollo_unlock_notified:${orgId}`;
}

/**
 * Mount ONCE at the app shell. While Apollo is connected-but-locked it lets the
 * warmup poll run; on the locked→unlocked edge it fires a one-time toast (deduped
 * per org via localStorage, G4) and the poll then stops (unlocked predicate).
 */
export function useApolloUnlockToast() {
  const { orgId: rawOrgId, currentUser } = useAuth();
  const orgId = rawOrgId ?? "";
  const userId = currentUser?.uid ?? "";
  const { toast } = useToast();

  const status = useApolloStatus(orgId).data;
  const connected = !!status?.connected;
  const warmup = useApolloWarmup(orgId, userId, { connected }).data;

  useEffect(() => {
    if (!orgId || !connected || !warmup?.unlocked) return;
    const key = flagKey(orgId);
    if (localStorage.getItem(key) === "1") return;
    localStorage.setItem(key, "1");
    toast({
      title: "Apollo discovery is now ready",
      description: "Start finding leads in Mission Control.",
    });
  }, [orgId, connected, warmup?.unlocked, toast]);
}
