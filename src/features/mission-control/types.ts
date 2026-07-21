// Types for the `mission-control` feature.

/** ICP view-model (mapped from the backend customer_profile rows). The public
 *  read surface (index.ts) exports this; the raw rows come from `useICPs`. */
export type FitConfidence = "high" | "medium" | "low";
export interface ICP {
  id: string;
  primaryRegion: string;
  location: string[];
  industry: string[];
  companySize: string[];
  buyerRole: string[];
  accountsOnWatchlist: string[];
  accountsToAvoid: string[];
  fitConfidence: FitConfidence;
  additionalContext: string;
  status: "saved";
  createdAt: Date;
}

/** Data-source read-list view-model (from GET /api/v2/user-documents). NOTE: this
 *  is the simple shape used by the data-sources tab. MissionControl's
 *  connector-catalog uses a separate, richer `DataSource` shape — do NOT unify
 *  them here; the connector/write surface is deferred. */
export type DataSourceType = "url" | "file" | "system";
export type DataSourceStatus = "active" | "failed" | "processing" | "completed";
export interface DataSource {
  id: string;
  /** S3 object key (`org_id/{uuid}_{filename}`) — used for GET /document-status. */
  fileKey?: string;
  fileId?: string;
  type: DataSourceType;
  name: string;
  url?: string;
  fileName?: string;
  description?: string;
  tags: string[];
  status: DataSourceStatus;
  createdAt: Date;
}

/** A lead-stream file row as the backend returns it (GET /api/leads/stream/status). */
export interface LeadStreamFileApiRow {
  file_id: string;
  filename: string;
  uploaded_at?: string;
  last_processed_at?: string;
  total_rows?: number;
  created_count?: number;
  error_count?: number;
  processing_status?: string;
  status?: string;
  tracking_status?: string;
}
