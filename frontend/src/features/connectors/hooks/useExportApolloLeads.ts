import { useCallback } from "react";

import { apolloLeadsExportUrl } from "../services/apollo";

/** Triggers a browser download of the org's discovery leads (G2). */
export function useExportApolloLeads(orgId: string) {
  return useCallback(
    (format: "json" | "csv" = "csv") => {
      const url = apolloLeadsExportUrl(orgId, format);
      const a = document.createElement("a");
      a.href = url;
      a.download = `apollo-leads.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    [orgId],
  );
}
