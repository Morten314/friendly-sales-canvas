import type { Database } from "lucide-react";

// Connector-catalog data shapes — the RICHER `DataSource`/`Connector` shapes
// used by the connector-approval cluster (and by the page's read-driven
// data-source state). Distinct from the feature `types.ts` `DataSource`
// (a leaner read-list shape) — do NOT unify the two.

// Data Source Interface
export interface DataSource {
  id: string;
  name: string;
  type: "crm" | "marketing" | "social" | "analytics" | "communication" | "file" | "custom";
  icon: typeof Database;
  platform: string;
  status:
    | "connected"
    | "disconnected"
    | "error"
    | "syncing"
    | "warning"
    | "uploaded"
    | "processing"
    | "empty";
  account?: string;
  connectedDate?: string;
  syncFrequency: "realtime" | "hourly" | "4hours" | "daily" | "weekly" | "manual";
  lastSyncTime?: string;
  lastSyncStatus?: "success" | "failed" | "partial";
  totalRecords: number;
  newRecordsThisWeek: number;
  updatedRecords: number;
  dataQualityScore: number;
  objectsSynced: string[];
  fieldsMapped: number;
  filters: string[];
  description?: string; // For file uploads
  error?: {
    message: string;
    code: string;
    occurredAt: string;
  };
}

// Available Connectors Catalog
export interface Connector {
  id: string;
  name: string;
  type: DataSource["type"];
  icon: typeof Database;
  platform: string;
  description: string;
  category: string;
  isPopular?: boolean;
  isNew?: boolean;
}
