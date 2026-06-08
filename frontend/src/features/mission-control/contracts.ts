import { z } from "zod";

/**
 * A lead-stream file row — GET /api/leads/stream/status. Loose: the backend
 * mixes `processing_status` / `status` / `tracking_status` aliases.
 * `.passthrough()` tolerates extra fields (confirm-live before relying on any
 * single one — Spec 25 §12).
 */
export const LeadStreamFileRowSchema = z
  .object({
    file_id: z.string(),
    filename: z.string(),
    uploaded_at: z.string().nullish(),
    last_processed_at: z.string().nullish(),
    total_rows: z.number().nullish(),
    created_count: z.number().nullish(),
    error_count: z.number().nullish(),
    processing_status: z.string().nullish(),
    status: z.string().nullish(),
    tracking_status: z.string().nullish(),
  })
  .passthrough();

/** GET /api/leads/stream/status returns `{ files: [...] }` or a bare array. */
export const LeadStreamStatusSchema = z.union([
  z.array(LeadStreamFileRowSchema),
  z.object({ files: z.array(LeadStreamFileRowSchema).nullish() }).passthrough(),
]);
export type LeadStreamStatusResponse = z.infer<typeof LeadStreamStatusSchema>;

/** A single uploaded document — kept opaque (the consumer maps ~20 snake/camel
 *  fields; see `UntypedBackendDocument`). The service returns these raw; the
 *  data-sources component maps them to `DataSource[]` (stage 5). */
export const UserDocumentSchema = z.object({}).passthrough();

/** GET /api/user-documents returns a bare array or `{ documents|files|data }`.
 *  Legacy v1 shape — the active `fetchDataSources` now reads the v2 paginated
 *  envelope (Spec 34); this schema is retained only for its contract test. */
export const DataSourceListSchema = z.union([
  z.array(UserDocumentSchema),
  z
    .object({
      documents: z.array(UserDocumentSchema).nullish(),
      files: z.array(UserDocumentSchema).nullish(),
      data: z.array(UserDocumentSchema).nullish(),
    })
    .passthrough(),
]);
export type DataSourceListResponse = z.infer<typeof DataSourceListSchema>;
