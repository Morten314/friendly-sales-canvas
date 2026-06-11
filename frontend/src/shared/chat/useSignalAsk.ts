import { useMutation } from "@tanstack/react-query";

import { SignalAskResponseSchema, type SignalAskResponse } from "@/shared/api/contracts";
import { buildApiUrl } from "@/shared/api/transport";

export interface SignalAskBody {
  org_id: string;
  user_id: string;
  question: string;
  history: { user: string; assistant: string }[];
}

/** POST /api/signal_ask_claude. Shared by the signals page + the ContextChat substrate. */
export function useSignalAsk() {
  return useMutation<SignalAskResponse, Error, SignalAskBody>({
    mutationFn: async (body) => {
      const res = await fetch(buildApiUrl("signal_ask_claude"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`signal_ask_claude failed: ${res.status} ${text}`);
      }
      return SignalAskResponseSchema.parse(await res.json());
    },
  });
}
