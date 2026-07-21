import { useMutation } from "@tanstack/react-query";

import { SignalActionResponseSchema, type SignalActionResponse } from "@/shared/api/contracts";

export interface SignalActionVars {
  orgId: string;
  signalId: string;
  action: "accept" | "reject";
}

/** POST /api/signal_action. Shared by the signals page + the ContextChat substrate. */
export function useSignalAction() {
  return useMutation<SignalActionResponse, Error, SignalActionVars>({
    mutationFn: async ({ orgId, signalId, action }) => {
      const res = await fetch("/api/signal_action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, signal_id: signalId, action }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`signal_action failed: ${res.status} ${text}`);
      }
      return SignalActionResponseSchema.parse(await res.json());
    },
  });
}
