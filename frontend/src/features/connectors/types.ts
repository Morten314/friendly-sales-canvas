export type ApolloTileState =
  | "disconnected"
  | "locked"
  | "unlocked"
  | "running"
  | "complete"
  | "complete_empty"
  | "complete_partial"
  | "error";

export interface ApolloConnectErrorShape {
  httpStatus: number; // FE-constructed (camelCase) — not a backend field; distinct from the `status` string on other schemas
  code?: string; // "profile_incomplete" | "master_key_required" | ...
  detail?: string;
  missing_section?: string;
}

export type DiscoveryPromptKind = "none" | "rediscovery_guard" | "keep_replace_download";
export type DiscoverMode = "keep" | "replace";
