# High-Level API Documentation

Excluded endpoints: `1, 3, 4, 5, 6, 7, 8`

## Company and Profile Management

- `POST /create-company/`  
  Creates a new company record/context used by downstream workflows.
- `POST /profile/{profile_type}`  
  Creates or updates a profile for a given type (dynamic profile category).
- `GET /profile/{profile_type}`  
  Fetches profile details for the given profile type.
- `POST /cleanup-company-profiles`  
  Triggers cleanup/normalization of stored company profiles.

## Lead Management

- `GET /leads`  
  Returns lead list, typically with filtering/pagination support.
- `POST /leads`  
  Creates a new lead.
- `PUT /leads/{lead_id}`  
  Updates an existing lead by ID.
- `DELETE /leads/{lead_id}`  
  Deletes a lead by ID.
- `POST /leads/batch-upload`  
  Bulk creates/imports leads from uploaded dataset.
- `GET /leads/by-file`  
  Lists leads associated with uploaded file(s).
- `GET /leads/stream/status`  
  Checks status of ongoing lead streaming/processing job.
- `DELETE /leads/by-file/{file_id}`  
  Deletes leads tied to a specific source file.
- `POST /leads/market-scores`  
  Computes/returns market scores for one or more leads.
- `GET /leads/market-scores/status`  
  Returns live scoring progress (`processed/total`), run status, and recent scored lead description previews.
- `GET /leads/{lead_id}/market-score-descriptions`  
  Returns score explanation/description metadata for a lead.

## Sales Pipeline

- `GET /Sales_Pipeline`  
  Fetches high-level sales pipeline data/insights.

## Research and Signals

- `POST /market-research`  
  Runs market research workflow and returns structured output.
- `GET /icp`  
  Retrieves ICP (Ideal Customer Profile) data.
- `POST /icp-research`  
  Generates/refines ICP research results.
- `POST /signals-research`  
  Runs signal discovery/research process.
- `POST /generate-signals-batch`  
  Batch generates signals, likely async or long-running.
- `GET /test-llm`  
  Health/test endpoint for LLM integration.
- `GET /fetch-signals`  
  Returns generated/fetched signals.
- `POST /signal_action`  
  Applies user/system action on a signal.
- `POST /signal_Ask`  
  Query/assistant endpoint for signal-related Q&A/editing.
- `POST /edit`  
  Generic edit/update endpoint in research/signal workflow.

## Customer Profile and ICP

- `POST /customer_profile`  
  Creates/updates customer profile.
- `GET /customer_profile`  
  Fetches customer profile data.
- `POST /customer_profile/from_suggested_icp`  
  Creates customer profile based on suggested ICP.
- `DELETE /customer_profile/icp/{icp_id}`  
  Removes ICP from customer profile context.
- `DELETE /icp/recommended/{icp_id}`  
  Deletes a recommended ICP entry.

## Organization Management

- `GET /org`  
  Fetches organization details/configuration.
- `POST /org`  
  Creates or updates organization metadata.
- `POST /connect_org`  
  Connects/links organization to external/internal context.

## Registration

- `POST /registration`  
  Registers a new entity/user/workflow entry.
- `GET /registration`  
  Lists registration records.

## Document and Data Source Management

- `POST /upload-document`  
  Uploads a document for processing/indexing.
- `GET /document-status/{file_key:path}`  
  Returns processing status for a specific document.
- `GET /user-documents`  
  Lists documents uploaded by current user/context.
- `DELETE /data-source/{file_id}`  
  Deletes a data source/document reference by ID.
- `PUT /data-source/{file_id}`  
  Updates metadata/configuration of a data source.
