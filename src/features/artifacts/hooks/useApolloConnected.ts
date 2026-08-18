import { useApolloStatus } from "@/features/connectors";
import { useAuth } from "@/shared/auth";

/**
 * Whether the Apollo data connector is live for this org. Contact-data
 * enrichment (email / phone / LinkedIn) is AI-inferred without it, so the sheet
 * marks those values low confidence with a (!) instead of hiding the option.
 */
export function useApolloConnected(): boolean {
  const { orgId } = useAuth();
  const { data } = useApolloStatus(orgId ?? "", Boolean(orgId));
  return Boolean(data?.connected);
}
