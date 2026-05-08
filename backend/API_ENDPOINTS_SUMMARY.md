# API Endpoints Summary

Complete list of all API endpoints with descriptions and usage.

---

## 📋 Lead Management Endpoints

### 1. **GET `/leads`** - Fetch All Leads
- **Description**: Get all leads filtered by user_id and org_id (multitenant)
- **Parameters**: 
  - `user_id` (Query, required)
  - `org_id` (Query, required)
- **Returns**: List of Lead objects with company, contact, and tech stack information
- **Multitenancy**: ✅ Yes (filters by user_id and org_id)

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

### 16. **POST `/icp-research`** - ICP Research
- **Description**: Research specific ICP components (summary, buyer map, competitive overlap, regulatory)
- **Request Body**: MarketRequest (user_id, org_id, component_name, data, refresh)
- **Returns**: ICP research data
- **Features**: 
  - Multiple component types supported
  - Caches results
  - Multitenant (user_id)

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
- **Returns**: Array of 4 generated signals
- **Features**: 
  - Batch processing
  - Includes batch_id for tracking
  - Multitenant (user_id)

### 19. **GET `/fetch-signals`** - Fetch Signals
- **Description**: Fetch signals for a user, ordered by timestamp (newest first)
- **Parameters**: 
  - `user_id` (Query, required)
  - `limit` (Query, default: 10)
- **Returns**: List of signals
- **Multitenancy**: ✅ Yes (user_id)

---

## 📄 Document Management Endpoints

### 20. **POST `/upload-document`** - Upload Document
- **Description**: Upload PDF or TXT file to S3 and start background task to convert to embeddings
- **Parameters**: 
  - `file` (File, required) - PDF or TXT
  - `user_id` (Form, required)
- **Returns**: Upload status with file_key
- **Features**: 
  - Stores in S3
  - Background processing to Pinecone
  - Status tracking in MongoDB

### 21. **GET `/document-status/{file_key}`** - Get Document Status
- **Description**: Get processing status of a document (processing, completed, failed)
- **Parameters**: 
  - `file_key` (Path, required)
- **Returns**: Document status with chunks_count, timestamps

### 22. **GET `/user-documents`** - List User Documents
- **Description**: Get all files uploaded by a user
- **Parameters**: 
  - `user_id` (Query, required)
- **Returns**: List of files with file_name, status, uploaded_at

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
- **Returns**: Customer profiles with ICPs array
- **Features**: Returns both company profile and customer profiles

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

## 📝 Notes

### Multitenancy
- Most endpoints support multitenancy via `user_id` and/or `org_id`
- Lead endpoints: ✅ Full multitenancy (user_id + org_id)
- Profile endpoints: Company profiles are shared, others are multitenant
- Research endpoints: ✅ Multitenant (user_id)

### Data Storage
- **Neo4j**: Leads, Companies, Contacts, Prospects, Engagements, Profiles
- **MongoDB**: Market Intelligence, ICP Configs, Signals, File Processing Status, Customer Profiles
- **S3**: Uploaded documents
- **Pinecone**: Document embeddings

### Authentication
- Currently no authentication middleware
- Multitenancy enforced via user_id/org_id parameters

### Error Handling
- All endpoints use try-catch blocks
- HTTPException for client errors (400, 404, etc.)
- 500 errors for server issues
- Logging for debugging

---

## 🔄 API Version
Current version: v1 (no versioning prefix)

## 📦 Dependencies
All dependencies are listed in `requirements.txt`
