import type { ApolloTileState } from "../types";

interface ConnState {
  connected: boolean;
  credentialError: boolean; // status.status === "error" (UC9)
}

export function deriveApolloTileState(
  conn: ConnState,
  warmup: { unlocked: boolean } | undefined,
  latestRun: { status: string } | undefined,
): ApolloTileState {
  if (!conn.connected) return "disconnected";
  if (conn.credentialError) return "error";
  if (!warmup?.unlocked) return "locked";

  switch (latestRun?.status) {
    case "queued":
    case "processing":
      return "running";
    case "completed":
      return "complete";
    case "completed_empty":
      return "complete_empty";
    case "partial":
      return "complete_partial";
    case "failed":
      return "error";
    default:
      return "unlocked";
  }
}
