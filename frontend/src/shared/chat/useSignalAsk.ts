import { useMutation } from "@tanstack/react-query";

import { SignalAskResponseSchema, type SignalAskResponse } from "@/shared/api/contracts";

export interface SignalAskBody {
  org_id: string;
  user_id: string;
  question: string;
  history: { user: string; assistant: string }[];
}

/** POST /api/signal_Ask. Shared by the signals page + the SignalsContextChat substrate. */
export function useSignalAsk() {
  return useMutation<SignalAskResponse, Error, SignalAskBody>({
    mutationFn: async (body) => {
      const res = await fetch("/api/signal_Ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`signal_Ask failed: ${res.status} ${text}`);
      }
      return SignalAskResponseSchema.parse(await res.json());
    },
  });
}
