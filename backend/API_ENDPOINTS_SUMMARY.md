# API Endpoints Summary

Complete list of all API endpoints with descriptions and usage.

The backend is a layered FastAPI service: endpoints live in per-domain routers
under `app/routers/`, with paginated successors under `app/routers/v2/` (mounted
at the `/v2` prefix). They are not in a single `api.py` file. Paths below are the
routes as served by the backend process (bare, no app-level prefix). The frontend
reaches them through its `/api/*` Vite proxy, so the same routes appear as
`/api/...` (and `/api/v2/...`) from the browser. Several handlers lack a
`response_model`; for those the response is described by purpose rather than a
fabricated JSON body.

Entries added during the router reconciliation use sub-numbers (5a, 5b, …) under
their nearest base entry; these are full production routes, not lower-priority
supplements.

See the **v2 (Paginated) Endpoints** section at the end for the versioned list
routes and the shared `PaginatedResponse` envelope.

---

## 📋 Lead Management Endpoints

### 1. **GET `/leads`** - Fetch All Leads
- **Description**: Get all leads filtered by user_id and org_id (multitenant)
- **Parameters**: 
  - `user_id` (Query, required)
  - `org_id` (Query, required)
- **Returns**: List of Lead objects with company, contact, and tech stack information
- **Multitenancy**: ✅ Yes (filters by user_id and org_id)
- **Deprecation**: ⚠️ Deprecated — responds with `Deprecation: true` and a `Link` header to the paginated successor `GET /api/v2/leads`

### 2. **POST `/leads`** - Add Single Lead
- **Description**: Add a single lead manually with flexible key-value pairs. Automatically maps and stores in Neo4j with user_id and org_id
- **Request Body**: 
  ```json
  {
    "user_id": "string",
    "org_id": "string",
    "data": {
      "company": "string",
      "industry": "string",
      "stage": "string",
      // ... any other flexible key-value pairs
    }
  }
  ```
- **Returns**: Success message with generated lead_id
- **Features**: Auto-creates Company, Contact, and Tech nodes as needed
- **Multitenancy**: ✅ Yes

### 3. **POST `/leads/batch-upload`** - Batch Upload Leads from CSV
- **Description**: Upload multiple leads from CSV file. Column headings become keys and row values become values
- **Parameters**: 
  - `file` (Form, required) - CSV file
  - `user_id` (Form, required)
  - `org_id` (Form, required)
- **Returns**: Summary with created_count, error_count, and error details
- **Features**: 
  - Processes each CSV row as a lead
  - Flexible column name mapping
  - Error handling per row
- **Multitenancy**: ✅ Yes

### 4. **PUT `/leads/{lead_id}`** - Modify Single Lead
- **Description**: Update a single lead with flexible key-value pairs while maintaining multitenancy
- **Parameters**: 
  - `lead_id` (Path, required)
- **Request Body**: 
  ```json
  {
    "user_id": "string",
    "org_id": "string",
    "data": {
      // ... flexible key-value pairs to update
    }
  }
  ```
- **Returns**: Success message with lead_id
- **Security**: Verifies ownership before updating
- **Multitenancy**: ✅ Yes

### 5. **DELETE `/leads/{lead_id}`** - Delete Lead
- **Description**: Delete a single lead. Verifies multitenancy before deletion
- **Parameters**: 
  - `lead_id` (Path, required)
  - `user_id` (Query, required)
  - `org_id` (Query, required)
- **Returns**: Success message with lead_id
- **Security**: Verifies ownership before deletion
- **Multitenancy**: ✅ Yes

### 5a. **GET `/leads/by-file`** - List Leads by Source File
- **Description**: List leads associated with a specific uploaded file, ordered by `created_at DESC`
- **Parameters**: 
  - `org_id` (Query, required)
  - `file_id` (Query, required)
- **Returns**: List of lead objects (returns up to 500; silent cap)
- **Deprecation**: ⚠️ Deprecated — responds with `Deprecation: true` and a `Link` header to the paginated successor `GET /api/v2/leads/by-file`

### 5b. **GET `/leads/stream/status`** - Lead Stream Upload Status
- **Description**: List lead-stream uploads (the file_id registry / processing status) for an org
- **Parameters**: 
  - `org_id` (Query, required)
- **Returns**: `StreamStatusResponse` — list of stream file entries with status

### 5c. **DELETE `/leads/by-file/{file_id}`** - Delete Leads by Source File
- **Description**: Delete all leads belonging to a specific `file_id`
- **Parameters**: 
  - `file_id` (Path, required)
  - `user_id` (Query, required)
  - `org_id` (Query, required)
- **Returns**: `DeleteLeadsByFileResponse` — deletion summary
- **Multitenancy**: ✅ Yes

### 5d. **POST `/leads/market-scores`** - Compute Lead Market Scores
- **Description**: Compute/return market scores for one or more leads. Scoring runs as a background task
- **Request Body**: `LeadMarketScoresRequest`
- **Returns**: `LeadMarketScoresResponse`

### 5e. **GET `/leads/market-scores/status`** - Market Scoring Progress
- **Description**: Return live scoring progress (`processed/total`), run status, and recent scored-lead description previews
- **Returns**: `LeadMarketScoringStatusResponse`

### 5f. **GET `/leads/{lead_id}/market-score-descriptions`** - Lead Score Descriptions
- **Description**: Return score explanation/description metadata for a single lead
- **Parameters**: 
  - `lead_id` (Path, required)
- **Returns**: `LeadMarketScoreDescriptionsResponse`

---

## 📊 Sales Pipeline Endpoints

### 6. **GET `/Sales_Pipeline`** - Get Sales Pipeline Data
- **Description**: Get sales pipeline statistics with stage counts and conversion rates
- **Parameters**: 
  - `user_id` (Query, required)
  - `timeframe` (Query, required) - Number of days
- **Returns**: Pipeline data with stages, counts, and conversion rates
- **Features**: Maps Neo4j stages to UI stages, calculates conversion rates

---

## 👤 Profile Management Endpoints

### 7. **POST `/profile/{profile_type}`** - Create or Update Profile
- **Description**: Flexible profile endpoint that accepts any JSON structure. Supports company, user, and agent_name profiles
- **Parameters**: 
  - `profile_type` (Path) - "company", "user", or "agent_name"
- **Request Body**: Flexible JSON structure
- **Returns**: Success message
- **Features**: 
  - Company profiles are shared (no user_id)
  - Other profiles are multitenant (user_id required)

### 8. **GET `/profile/{profile_type}`** - Get Profile
- **Description**: Fetch profile by type. For company profiles, also includes customer profiles from MongoDB
- **Parameters**: 
  - `profile_type` (Path) - "company", "user", or "agent_name"
  - `user_id` (Query, optional) - Required for non-company profiles
- **Returns**: Profile data as JSON
- **Features**: 
  - Company profiles are shared
  - Other profiles filtered by user_id

### 9. **POST `/cleanup-company-profiles`** - Cleanup Company Profiles
- **Description**: Ensure only one CompanyProfile exists in Neo4j. Keeps the first one and deletes duplicates
- **Returns**: Cleanup summary with deleted count

---

## 🎯 Prospect Management Endpoints

### 10. **POST `/create-company/`** - Create Prospect
- **Description**: Create a prospect node with predefined questions and answers
- **Request Body**: ProspectData (Name, Company, answers array)
- **Returns**: Success message with created node

### 11. **POST `/upload`** - Upload Prospect List
- **Description**: Upload CSV/Excel file with prospect list and process into Neo4j
- **Parameters**: 
  - `file` (File, required) - CSV or Excel file
- **Returns**: Count of new prospects added
- **Features**: Scores prospects based on answers, skips duplicates

---

## 💬 Engagement & Graph Endpoints

### 12. **POST `/voice_graph/`** - Add Voice Engagement
- **Description**: Add engagement (note, meeting, email) via voice file. Converts audio to text and stores in graph
- **Parameters**: 
  - `prospect_name` (Form, required)
  - `update_type` (Form, required) - "note", "offline meeting", "email", "online meeting"
  - `voice_file` (File, required)
- **Returns**: Success message

### 13. **POST `/text_graph/`** - Add Text Engagement
- **Description**: Add engagement via text input. Stores in graph with timestamp
- **Parameters**: 
  - `prospect_name` (Form, required)
  - `update_type` (Form, required)
  - `text` (Form, required)
- **Returns**: Success message

---

## 🔍 Market Research Endpoints

### 14. **POST `/market-research`** - Market Research
- **Description**: Generate market research reports for various components (market size, trends, competitors, etc.)
- **Request Body**: MarketRequest (user_id, org_id, component_name, data, refresh)
- **Returns**: Research report data
- **Features**: 
  - Caches results in MongoDB
  - Supports refresh flag
  - Multitenant (user_id)

### 15. **GET `/icp`** - Get or Create ICP Config
- **Description**: Get existing ICP configuration or generate new ICPs from company profile
- **Parameters**: 
  - `user_id` (Query, required)
  - `refresh` (Query, default: false)
- **Returns**: ICP configuration with suggested ICPs
- **Features**: 
  - Caches in MongoDB
  - Generates from shared company profile
  - Multitenant (user_id)
- **Deprecation**: ⚠️ Deprecated — responds with `Deprecation: true` and a `Link` header to the paginated successor `GET /api/v2/icp`, which is the successor for the list portion only (the lazy generate/create behavior has no v2 successor)

### 16. **POST `/icp-research`** - ICP Research
- **Description**: Research specific ICP components (summary, buyer map, competitive overlap, regulatory)
- **Request Body**: MarketRequest (user_id, org_id, component_name, data, refresh)
- **Returns**: ICP research data
- **Features**: 
  - Multiple component types supported
  - Caches results
  - Multitenant (user_id)

### 16a. **POST `/market-research_claude`** - Market Research (Claude backend)
- **Description**: Same as `POST /market-research`, but research is generated with Claude (Tavily + Anthropic) instead of Qwen
- **Request Body**: MarketRequest
- **Returns**: `MarketResponse` (same shape as `/market-research`)
- **Notes**: Returns HTTP 500 if `ANTHROPIC_API_KEY` is not configured

### 16b. **POST `/icp-research_claude`** - ICP Research (Claude backend)
- **Description**: Same as `POST /icp-research`, but research is generated with Claude (Tavily + Anthropic) instead of Qwen
- **Request Body**: MarketRequest
- **Returns**: `ICPResearchResponse` (same shape as `/icp-research`)
- **Notes**: Returns HTTP 500 if `ANTHROPIC_API_KEY` is not configured

### 16c. **DELETE `/icp/recommended/{icp_id}`** - Delete Recommended ICP
- **Description**: Delete a single recommended ICP from `ICP_config` by `icp_id` for a given user
- **Parameters**: 
  - `icp_id` (Path, required)
  - `user_id` (Query, required)
- **Returns**: `ICPDeleteResponse`

---

## 📡 Signals Endpoints

### 17. **POST `/signals-research`** - Research Web Signals
- **Description**: Research web signals for specific agents (scout/profiler)
- **Request Body**: MarketRequest (user_id, org_id, component_name="scout" or "profiler", data, refresh)
- **Returns**: Signals data with headlines, snippets, sources
- **Features**: 
  - Agent-specific signal generation
  - Caches in MongoDB
  - Multitenant (user_id)

### 18. **POST `/generate-signals-batch`** - Generate Signals Batch
- **Description**: Generate 2 signals for scout and 2 signals for profiler in one batch
- **Request Body**: MarketRequest (user_id, org_id, data)
- **Returns**: `GenerateSignalsBatchResponse` (status, message, `data` array of generated signals)
- **Features**: 
  - Batch processing
  - Multitenant (user_id)

### 18a. **POST `/generate-signals-batch_claude`** - Generate Signals Batch (Claude backend)
- **Description**: Same as `POST /generate-signals-batch`, but signal text is produced with Claude (Tavily + Anthropic) instead of Qwen
- **Request Body**: MarketRequest
- **Returns**: `GenerateSignalsBatchResponse` (same shape)
- **Notes**: Returns HTTP 500 if `ANTHROPIC_API_KEY` is not configured

### 19. **GET `/fetch-signals`** - Fetch Signals
- **Description**: Fetch signals for a user, ordered by timestamp (newest first)
- **Parameters**: 
  - `user_id` (Query, required)
  - `limit` (Query, default: 10)
- **Returns**: `FetchSignalsResponse` (status, count, `signals` array)
- **Multitenancy**: ✅ Yes (user_id)
- **Deprecation**: ⚠️ Deprecated — responds with `Deprecation: true` and a `Link` header to the paginated successor `GET /api/v2/fetch-signals`

### 19a. **POST `/signal_action`** - Accept/Reject Signal
- **Description**: Record a user/system action (accept or reject) on a signal
- **Request Body**: `SignalActionRequest`
- **Returns**: `SignalActionResponse` (status, message, signal_id, action, optional org_id)

### 19b. **POST `/signal_Ask`** - Ask About Signals
- **Description**: Answer a question about signals using company profile, customer profile, history, and WebSearch (Qwen + agent chain)
- **Request Body**: `SignalAskRequest`
- **Returns**: `SignalAskResponse` (status, answer, org_id, user_id, question, optional prompt_meta)

### 19c. **POST `/signal_ask_claude`** - Ask About Signals (Claude backend)
- **Description**: Claude-powered variant of `POST /signal_Ask`, with a local token/run limiter
- **Request Body**: `SignalAskRequest`
- **Returns**: `SignalAskResponse` (same shape as `/signal_Ask`)

---

## 📄 Document Management Endpoints

### 20. **POST `/upload-document`** - Upload Document
- **Description**: Upload a document (or register a URL) to S3 and start a background task to convert it to embeddings in Pinecone
- **Parameters** (multipart form): 
  - `file` (File, optional) - document file
  - `user_id` (Form, required)
  - `org_id` (Form, required)
  - `url` (Form, optional)
  - `name`, `tags`, `description` (Form, optional)
- **Returns**: Upload status (no `response_model`; shape varies by code path — described by purpose)
- **Features**: 
  - Stores in S3
  - Background processing to Pinecone (namespaced by org_id)
  - Status tracking in MongoDB

### 21. **GET `/document-status/{file_key}`** - Get Document Status
- **Description**: Get processing status of a document (processing, completed, failed)
- **Parameters**: 
  - `file_key` (Path, required; matches the full remaining path)
- **Returns**: `DocumentStatusResponse` with status, chunks_count, timestamps

### 22. **GET `/user-documents`** - List User Documents
- **Description**: Get all files uploaded for an org
- **Parameters**: 
  - `org_id` (Query, required)
- **Returns**: `ListUserDocumentsResponse` (status, count, `files` array)
- **Deprecation**: ⚠️ Deprecated — responds with `Deprecation: true` and a `Link` header to the paginated successor `GET /api/v2/user-documents`

### 22a. **DELETE `/data-source/{file_id}`** - Delete Data Source
- **Description**: Delete a data source/document by ID (removes the S3 object, Mongo record, and Pinecone vectors)
- **Parameters**: 
  - `file_id` (Path, required)
- **Returns**: `DataSourceDeleteResponse`

### 22b. **PUT `/data-source/{file_id}`** - Update Data Source
- **Description**: Update metadata/configuration of a data source by ID
- **Parameters**: 
  - `file_id` (Path, required)
- **Request Body**: JSON object of fields to update
- **Returns**: `DataSourceUpdateResponse`

---

## 🎨 Customer Profile Endpoints

### 23. **POST `/customer_profile`** - Create or Update Customer Profile
- **Description**: Create or update customer profiles (ICPs) in MongoDB. Stores within company profile document
- **Request Body**: CustomerProfileRequest (profile_type="customer", icps array)
- **Returns**: Success message with processed ICPs
- **Features**: 
  - Generates IDs if not provided
  - Includes company profile from Neo4j
  - Shared storage (no user_id filtering)

### 24. **GET `/customer_profile`** - Get Customer Profile
- **Description**: Get customer profiles (ICPs) from MongoDB
- **Parameters**: 
  - `org_id` (Query, required)
- **Returns**: `CustomerProfileResponse` — company profile plus customer profiles with ICPs array
- **Features**: Returns both company profile and customer profiles

### 24a. **POST `/customer_profile/from_suggested_icp`** - Save Suggested ICP as Customer Profile
- **Description**: Create a customer profile from a suggested ICP
- **Request Body**: `SuggestedICPToCustomerProfileRequest`
- **Returns**: `SuggestedICPResponse`

### 24b. **DELETE `/customer_profile/icp/{icp_id}`** - Remove ICP from Customer Profile
- **Description**: Remove an ICP from the customer-profile context
- **Parameters**: 
  - `icp_id` (Path, required)
  - `org_id` (Query, required)
- **Returns**: `CustomerProfileDeleteResponse`

---

## 🏢 Organization & Registration Endpoints

### 24c. **GET `/org`** - Get Organization(s) by User
- **Description**: Fetch organization details/configuration for a user
- **Parameters**: 
  - `user_id` (Query, required)
- **Returns**: `OrgResponse` (flexible shape; `extra="allow"`)

### 24d. **POST `/org`** - Create/Update Organization
- **Description**: Create or update organization metadata
- **Request Body**: JSON object (flexible)
- **Returns**: `OrgResponse`

### 24e. **POST `/connect_org`** - Connect User to Organization
- **Description**: Link a user to an organization
- **Request Body**: `user_id` and `org_id` (JSON body fields, both required)
- **Returns**: `OrgResponse`

### 24f. **POST `/registration`** - Create Registration
- **Description**: Register a new entity/user entry
- **Request Body**: `RegistrationRequest` (`name`, `email`)
- **Returns**: `RegistrationResponse` (id, name, email, timestamp)

### 24g. **GET `/registration`** - List Registrations
- **Description**: List registration records (admin-only cross-tenant view; no org_id filter). Reads from the `Registration_DB` database
- **Returns**: List of `RegistrationResponse` (returns up to 500; silent cap)
- **Deprecation**: ⚠️ Deprecated — responds with `Deprecation: true` and a `Link` header to the paginated successor `GET /api/v2/registration`

---

## 🛠️ Utility Endpoints

### 25. **POST `/upload_file/`** - Upload File for Graph Processing
- **Description**: Upload file and process to update Neo4j graph using LangChain
- **Parameters**: 
  - `file` (File, required)
- **Returns**: Success message

### 26. **GET `/ask/`** - Ask Question (LLM Chain)
- **Description**: Ask a question using the LLM chain
- **Parameters**: 
  - `question` (Query, required)
- **Returns**: LLM response

### 27. **GET `/chat/`** - Chat (LLM Chain 2)
- **Description**: Chat using the second LLM chain
- **Parameters**: 
  - `question` (Query, required)
- **Returns**: LLM response

### 28. **GET `/query/`** - Run Cypher Query
- **Description**: Execute a raw Cypher query (for testing/debugging)
- **Parameters**: 
  - `cypher_query` (Query, required)
- **Returns**: Query results
- **Warning**: ⚠️ Use with caution - direct database access

### 29. **POST `/edit`** - Edit Market Intelligence
- **Description**: Edit market intelligence reports (modification or comment)
- **Request Body**: EditRequest (user_id, original_json, modified_json, edit_type)
- **Returns**: Success message with inserted_id
- **Features**: 
  - Supports "modification" and "comment" types
  - Multitenant (user_id)

### 30. **GET `/test-llm`** - Test LLM
- **Description**: Test if LLM is working correctly
- **Returns**: LLM test response

---

## 🔢 v2 (Paginated) Endpoints

These live under `app/routers/v2/` and are mounted at the `/v2` prefix (so
the backend serves them at `/v2/...`; the frontend proxy form is `/api/v2/...`).
They are the paginated successors to the deprecated v1 list routes noted above.
All of them return the shared **`PaginatedResponse[T]`** envelope from
`app/models/pagination.py`:

```json
{
  "items": [ /* T */ ],
  "total": 0,
  "limit": 50,
  "offset": 0
}
```

Common query params: `limit` (default 50, range 1–500) and `offset` (default 0,
min 0), unless noted.

### v2-1. **GET `/v2/leads`** - List Leads (paginated)
- **Successor to**: `GET /leads`
- **Parameters**: `org_id` (Query, required), `limit`, `offset`
- **Returns**: `PaginatedResponse` of lead objects

### v2-2. **GET `/v2/leads/by-file`** - List Leads by File (paginated)
- **Successor to**: `GET /leads/by-file`
- **Parameters**: `org_id` (Query, required), `file_id` (Query, required), `limit`, `offset`
- **Returns**: `PaginatedResponse` of lead objects

### v2-3. **GET `/v2/fetch-signals`** - Fetch Signals (paginated)
- **Successor to**: `GET /fetch-signals`
- **Parameters**: `user_id` (Query, required), `limit` (default 10), `offset`
- **Returns**: `PaginatedResponse` of signal objects

### v2-4. **GET `/v2/icp`** - List ICPs (paginated)
- **Successor to**: `GET /icp` (list portion)
- **Parameters**: `user_id` (Query, required), `refresh` (Query, default false), `limit`, `offset`
- **Returns**: `PaginatedResponse` of ICP objects

### v2-5. **GET `/v2/user-documents`** - List User Documents (paginated)
- **Successor to**: `GET /user-documents`
- **Parameters**: `org_id` (Query, required), `limit`, `offset`
- **Returns**: `PaginatedResponse` of `UserDocumentEntry`

### v2-6. **GET `/v2/registration`** - List Registrations (paginated)
- **Successor to**: `GET /registration`
- **Parameters**: `limit`, `offset`
- **Returns**: `PaginatedResponse` of `RegistrationResponse`

---

## 🔌 Connector / Lead Discovery (Apollo)

Apollo.io integration (Spec 35), mounted under the `/connectors` prefix in
`app/routers/connectors.py` (frontend proxy form `/api/connectors/...`). The
import / enrich / discover flows run as in-process `BackgroundTasks`, each paired
with a `.../status` poll endpoint.

### A1. **POST `/connectors/apollo/connect`** - Connect Apollo
- **Description**: Store/validate the org's Apollo API key and open the connection
- **Returns**: `ApolloConnectResponse`

### A2. **GET `/connectors/apollo/status`** - Connection Status
- **Returns**: `ApolloStatusResponse`

### A3. **DELETE `/connectors/apollo/connect`** - Disconnect Apollo
- **Returns**: `DisconnectResponse`

### A4. **GET `/connectors/apollo/lists`** - List Apollo Lists
- **Returns**: `ApolloListsResponse`

### A5. **POST `/connectors/apollo/import`** - Import Contacts from a List
- **Description**: Import contacts from an Apollo list into the CRM graph
- **Returns**: `ApolloImportResponse`

### A6. **POST `/connectors/apollo/enrich`** - Enrich Leads (background)
- **Description**: Reveal/enrich contact details via Apollo `people/match`
- **Returns**: `ApolloEnrichResponse`
- **Frontend**: Not called by any frontend surface — this endpoint (and its `enrich/status` poll, A7) is backend-only and currently unreachable from the UI (verified 2026-06-26). The only UI-wired path that spends Apollo reveal credits (`people/match` / `bulk_match`) is discovery (A8); no frontend action triggers an enrich credit spend.

### A7. **GET `/connectors/apollo/enrich/status`** - Enrich Job Status
- **Returns**: `ApolloEnrichStatusResponse`

### A8. **POST `/connectors/apollo/discover`** - ICP-Driven Discovery (background)
- **Description**: Discover net-new prospects from the active ICP (Qwen re-rank)
- **Returns**: `ApolloDiscoverResponse`

### A9. **GET `/connectors/apollo/discover/status`** - Discovery Job Status
- **Returns**: `ApolloDiscoverStatusResponse`

### A10. **GET `/connectors/apollo/warmup`** - Warm Apollo Client
- **Returns**: `ApolloWarmupResponse`

### A11. **GET `/connectors/apollo/leads/export`** - Export Connector Leads
- **Description**: Export the connector's discovered/imported leads (no `response_model`)

---

## 📝 Notes

### Multitenancy
- Most endpoints support multitenancy via `user_id` and/or `org_id`
- Lead endpoints: ✅ Full multitenancy (user_id + org_id)
- Profile endpoints: Company profiles are shared, others are multitenant
- Research endpoints: ✅ Multitenant (user_id)

### Data Storage
- **Neo4j**: Leads, Companies, Contacts, Prospects, Engagements, Profiles
- **MongoDB**: Market Intelligence, Lead Market Scores, ICP Configs, Signals, File Processing Status, Customer Profiles. Registrations live in a separate `Registration_DB`
- **S3**: Uploaded documents
- **Pinecone**: Document embeddings (namespaced by org_id)

### Authentication
- Currently no authentication middleware
- Multitenancy enforced via user_id/org_id parameters

### Error Handling
- All endpoints use try-catch blocks
- HTTPException for client errors (400, 404, etc.)
- 500 errors for server issues
- Logging for debugging

---

## 🔄 API Versions
- **v1** — the original surface (the bulk of the endpoints above). Mounted at the
  bare paths with no version prefix. Several v1 list routes (`/leads`,
  `/leads/by-file`, `/fetch-signals`, `/icp`, `/user-documents`, `/registration`)
  are now **deprecated** in favor of their `/v2` successors and emit `Deprecation` /
  `Link` response headers (the `Link` headers use proxy-form paths, e.g.
  `/api/v2/leads`). (For `/icp`, the `/v2` successor replaces only the list
  portion; the route's lazy generate/create behavior has no v2 successor.)
- **v2** — paginated successors under `app/routers/v2/`, mounted at the `/v2`
  prefix, returning the shared `PaginatedResponse` envelope. See the
  **v2 (Paginated) Endpoints** section above.

## 📦 Dependencies
All dependencies are listed in `requirements.txt`
