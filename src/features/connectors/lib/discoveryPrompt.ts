import type { DiscoveryPromptKind } from "../types";

export function selectDiscoveryPrompt(input: {
  icpChanged: boolean;
  hasPriorDiscovery: boolean; // proxy: status.last_discovery_at != null (G5)
}): DiscoveryPromptKind {
  if (!input.hasPriorDiscovery) return "none";
  // Prior discovery exists:
  if (!input.icpChanged) return "rediscovery_guard"; // UC7
  return "keep_replace_download"; // UC5
}
