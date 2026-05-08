# Brewra Software Architecture Document

**Document Version**: 1.0
**Last Updated**: 2025-04-24
**Status**: Production Architecture Analysis

---

## Executive Summary

Brewra implements a **microservices-oriented AI sales execution platform** with a polyglot data architecture. The system combines graph databases, document databases, vector databases, and LLM services to provide intelligent market insights and sales execution capabilities.

**Architecture Style**: Multi-tier REST API with PWA frontend
**Technology Stack**: Python FastAPI backend + React TypeScript frontend
**Data Architecture**: Polyglot persistence (Neo4j, MongoDB, Pinecone, S3)
**AI/LLM Integration**: LangChain with Groq and Together AI

**Current Status**: 70% architecturally complete with critical security gaps

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Frontend (PWA - React/TypeScript)                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   Scout Agent   │  │  Profiler Agent │  │  Strategist*    │      │
│  │  (Market Intel) │  │ (Customer Intel)│  │  (Signals Only) │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
│                                                                         │
│  State: React Context + Custom Hooks + localStorage                    │
│  UI: shadcn/ui (51 components) + Tailwind CSS                          │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Backend API (FastAPI/Python)                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   Lead API      │  │  Market API     │  │  Signal API     │      │
│  │  (CRUD, Scoring)│  │  (Research)     │  │  (Generation)   │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
│                                                                         │
│  LLM Layer: LangChain + Groq Llama 3.3 70B + Together Qwen 235B        │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Data Layer (Polyglot)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │   Neo4j     │  │   MongoDB   │  │  Pinecone   │  │    S3       ││
│  │  (Graph DB) │  │ (Doc DB)   │  │ (Vector DB) │  │ (Object DB) ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      External Services                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │   Groq      │  │  Together   │  │   Tavily    │  │   LinkedIn  ││
│  │   (LLM)     │  │   (LLM)     │  │   (Search)  │  │   (API)     ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘│
│  ┌─────────────┐  ┌─────────────┐                                   │
│  │  Firebase   │  │  RapidAPI   │                                   │
│  │   (Auth)    │  │  (Services) │                                   │
│  └─────────────┘  └─────────────┘                                   │
└─────────────────────────────────────────────────────────────────────┘
```

*Note: Strategist agent not fully implemented

---

## Frontend Architecture

### Technology Stack

**Core Framework**:
- React 18 with TypeScript
- Vite with SWC for fast builds
- React Router v6 for routing
- Progressive Web App (PWA) support

**UI Layer**:
- shadcn/ui (51 components based on Radix UI)
- Tailwind CSS v3.4.11 for styling
- Lucide React for icons
- next-themes for dark mode support

**State Management**:
- React Context API (Auth, Tenant, Sidebar contexts)
- Custom hooks (useAuth, useTenant, useAuthenticatedApi)
- React Query configured but underutilized
- localStorage for persistence
- sessionStorage for ephemeral state

**Build & Deploy**:
- Vite for development and production builds
- Vercel for frontend hosting
- Environment-aware API proxy configuration

### Frontend Directory Structure

```
src/
├── components/
│   ├── agents/          # Agent-specific components
│   ├── market-research/ # Scout agent components (35+)
│   ├── customers/       # Profiler agent components (10)
│   ├── signals/         # Strategist agent components (5)
│   ├── ui/              # shadcn/ui components (51)
│   ├── layout/          # Layout components (Header, Sidebar)
│   ├── common/          # Shared utility components
│   └── dashboard/       # Dashboard widgets (5)
├── pages/               # Page-level components (17)
├── contexts/            # React Context providers
├── hooks/               # Custom React hooks
├── lib/                 # Utility libraries
├── services/            # API service layer
├── utils/               # Helper functions
└── styles/              # Global styles
```

### Frontend Architectural Patterns

#### 1. Component Architecture Pattern

**Page Structure**:
```
Layout
├── Sidebar (navigation)
├── Header (page-specific actions)
└── Main Content
    ├── Tabs (feature organization)
    ├── Components (feature implementation)
    └── Drawers/Modals (detail views)
```

**Example: MarketResearch Page**:
```
Layout
├── Tabs (Market Intelligence, Lead Stream, Chat)
├── MarketIntelligenceTab
│   ├── RecentMarketResearch
│   ├── ScoutCapabilities
│   ├── MarketRankings
│   ├── CompetitorAnalysis
│   └── EmergingTrends
└── ChatWithScout
```

#### 2. State Management Architecture

**Three-Tier State Management**:

**Tier 1: React Context** (Global state)
```typescript
// AuthContext - User authentication
interface AuthContextType {
  currentUser: User | null;
  orgId: string | null;
  orgName: string | null;
  login: (email, password) => Promise<void>;
  logout: () => Promise<void>;
}

// TenantContext - Multi-tenancy
interface TenantContextType {
  selectedTenant: Tenant | null;
  availableTenants: Tenant[];
  selectTenant: (tenant) => void;
}

// SidebarContext - UI state
interface SidebarContextType {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}
```

**Tier 2: Custom Hooks** (Reusable logic)
```typescript
// useAuth - Enhanced auth with JWT
const useAuth = () => {
  const firebaseAuth = useFirebaseAuth();
  const jwtToken = jwtManager.getToken();
  return { ...firebaseAuth, jwtToken };
};

// useTenant - Tenant management
const useTenant = () => useContext(TenantContext);

// useAuthenticatedApi - JWT-aware API calls
const useAuthenticatedApi = () => {
  const client = new AuthenticatedApiClient(jwtToken);
  return { get: client.get, post: client.post };
};
```

**Tier 3: Component State** (Local state)
```typescript
// useState for component-specific state
const [activeTab, setActiveTab] = useState("tab1");
const [data, setData] = useState(null);

// useEffect for side effects
useEffect(() => {
  fetchData().then(setData);
}, [activeTab]);
```

#### 3. API Integration Architecture

**Three-Tier API System**:

**Tier 1: Base API** (`/src/lib/api.ts`)
```typescript
export const API_BASE_URL = (isDevelopment || isVercel)
  ? '/api'
  : 'https://backend-11kr.onrender.com';

export const apiFetch = async (endpoint: string, options: ApiFetchOptions = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers }
  });
  return response.json();
};
```

**Tier 2: Enhanced API** (`/src/lib/enhancedApi.ts`)
```typescript
class EnhancedApiClient {
  // Rate limiting with exponential backoff
  private async executeWithRateLimit(fn: Function, retries = 1): Promise<any>

  // In-memory caching with TTL
  private setCache(cacheKey: string, data: any, ttl: number = 300000): void

  // Fallback to production backend
  private async fetchWithFallback(url: string): Promise<Response>
}
```

**Tier 3: Authenticated API** (`/src/lib/authenticatedApi.ts`)
```typescript
class AuthenticatedApiClient {
  // Automatic JWT injection
  private async getAuthHeader(): Promise<string>

  // Token refresh on 401
  private async refreshAccessToken(): Promise<string>

  // Authenticated API calls
  async get<T>(endpoint: string): Promise<T>
  async post<T>(endpoint: string, data: any): Promise<T>
}
```

#### 4. Caching Strategy

**Four-Layer Caching System**:

**Layer 1: In-Memory Cache** (Enhanced API)
```typescript
const apiCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

// Default TTL: 5 minutes
cache.set(cacheKey, { data, timestamp: Date.now(), ttl: 300000 });
```

**Layer 2: localStorage** (Persistent)
```typescript
// User-specific cache keys
const cacheKey = `marketIntelligenceData_${userId}`;
localStorage.setItem(cacheKey, JSON.stringify(data));

// Organization-specific caching
const orgKey = `companyProfile_${uid}:${orgId}`;
```

**Layer 3: sessionStorage** (Ephemeral)
```typescript
// Chat contexts (survives page refresh, not tab close)
sessionStorage.setItem('signalsChatContext', JSON.stringify(context));
sessionStorage.setItem('leadStreamChatContext', JSON.stringify(context));
```

**Layer 4: Session Cache** (In-Memory Scoped)
```typescript
// Mission Control ↔ Profiler cache invalidation
let missionValid: boolean;
let missionCompanyJson: Record<string, unknown> | null;
let profilerValid: boolean;
let profilerSnapshot: ProfilerSessionSnapshot | null;

// Scope-based invalidation (uid + orgId)
function invalidateSession(scope: { uid: string; orgId: string }): void
```

#### 5. Authentication Flow

**Multi-Layer Authentication**:

**Layer 1: Firebase Authentication**
```typescript
// Firebase config (⚠️ API keys should be in environment variables)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID
};

// Firebase auth
await signInWithEmailAndPassword(auth, email, password);
```

**Layer 2: JWT Token Management**
```typescript
class JWTManager {
  // Generate JWT with tenant context
  async generateToken(user: User, tenantId?: string): Promise<string>

  // Token storage in localStorage
  getToken(): string | null

  // Automatic token refresh
  async refreshAccessToken(): Promise<string>

  // Bearer token injection
  async getAuthHeader(): Promise<string>
}
```

**Layer 3: Combined Auth Hook**
```typescript
const useAuth = () => {
  const firebaseAuth = useFirebaseAuth();
  const { selectedTenant } = useTenant();

  // Auto-generate JWT when user + tenant available
  useEffect(() => {
    if (firebaseAuth.currentUser && selectedTenant) {
      jwtManager.generateToken(firebaseAuth.currentUser, selectedTenant.id);
    }
  }, [firebaseAuth.currentUser, selectedTenant]);

  return { ...firebaseAuth, jwtToken };
};
```

**Authentication Flow**:
1. User logs in via Firebase
2. AuthContext fetches org_id from `/api/org?user_id={uid}`
3. TenantContext auto-selects tenant from org_id
4. JWT token generated with tenant context
5. All API calls include JWT authorization header
6. Token refresh on 401 responses

#### 6. Routing Architecture

**Protected Route Pattern**:
```typescript
const ProtectedRoute = ({ children, requireTenant }) => {
  const { currentUser } = useAuth();
  const { selectedTenant } = useTenant();

  if (!currentUser) return <Navigate to="/login" />;
  if (requireTenant && !selectedTenant) return <Navigate to="/tenant-selection" />;

  return children;
};
```

**Route Structure**:
```
/ (public)
├── /login (public)
├── /tenant-selection (auth required)
└── / (auth + tenant required)
    ├── /mission-control
    ├── /signals
    ├── /customers
    ├── /your-ai-team/scout/:tab
    ├── /your-ai-team/strategist/:tab
    ├── /calendar
    ├── /reports
    └── /settings
```

#### 7. PWA Architecture

**Service Worker Strategy**:
```typescript
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    skipWaiting: true,
    clientsClaim: true
  }
});
```

**Offline Support**:
- Cache strategy: Stale-while-revalidate
- Offline UI: Graceful degradation
- Background sync: Sync operations when connectivity restored

**App-like Experience**:
- Installable: Web app manifest
- Push notifications: Support for browser push
- Full-screen mode: Display mode for app-like interface

### Frontend Architecture Concerns

**🔴 Critical Issues**:
1. Firebase API keys exposed in client-side code
2. JWT tokens stored in localStorage (XSS vulnerability)
3. No CSRF protection
4. Inconsistent API call patterns (4 different approaches)

**🟡 Medium Issues**:
1. React Query installed but underutilized
2. Fragmented state management (3 different approaches)
3. Potential memory leaks (989 React hooks with cleanup issues)
4. Large page files (MarketResearch.tsx - 227KB)

**🔵 Minor Issues**:
1. Excessive console logging (1,566 statements)
2. Inconsistent naming conventions
3. Limited error boundary coverage
4. No performance monitoring

---

## Backend Architecture

### Technology Stack

**Core Framework**:
- FastAPI (Python 3.x)
- Uvicorn ASGI server
- Pydantic for data validation

**AI/LLM Integration**:
- LangChain framework
- Groq Llama 3.3 70B (primary LLM)
- Together Qwen 235B (secondary LLM)
- Groq Llama 3.2 90B Vision (image analysis)

**Database Technologies**:
- Neo4j (graph database - CRM data)
- MongoDB (document database - analytics & caching)
- Pinecone (vector database - semantic search)
- AWS S3 (object storage - files)

**External APIs**:
- Tavily Search (web search)
- LinkedIn (via RapidAPI)
- Firebase (authentication)

### Backend Directory Structure

```
backend/
├── api.py              # FastAPI application and routes (4,441 lines)
├── models.py           # Pydantic models and schemas (230 lines)
├── services.py         # Business logic and agent workflows (2,540 lines)
├── database.py         # Database connections and utilities (101 lines)
├── llm_config.py       # LLM configuration and prompts (312 lines)
├── config.py           # Configuration and credentials (81 lines)
├── main.py             # Application entry point (15 lines)
├── requirements.txt    # Python dependencies
└── scripts/            # Utility scripts
```

**🔴 Architectural Issue**: Monolithic structure with large files

### API Architecture

#### RESTful API Structure

**Total Endpoints**: 50+ routes across 7 functional areas

**Lead Management (10 endpoints)**:
```
GET    /leads                      # List all leads for org
POST   /leads                      # Create single lead
PUT    /leads/{lead_id}            # Update lead
DELETE /leads/{lead_id}            # Delete lead
POST   /leads/batch-upload         # Bulk upload from CSV/Excel
GET    /leads/by-file              # Get leads by upload file_id
GET    /leads/stream/status        # List upload history/status
DELETE /leads/by-file/{file_id}    # Bulk delete by file
```

**Market Scoring (3 endpoints)**:
```
POST   /leads/market-scores                    # Trigger lead scoring
GET    /leads/market-scores/status             # Check scoring progress
GET    /leads/{lead_id}/market-score-descriptions # Score explanations
```

**Profile Management (8 endpoints)**:
```
POST   /profile/{profile_type}           # Create/update profiles
GET    /profile/{profile_type}            # Retrieve profiles
POST   /customer_profile                  # Create customer ICP
GET    /customer_profile                  # Get customer profiles
POST   /customer_profile/from_suggested_icp  # Convert suggested to saved
DELETE /customer_profile/icp/{icp_id}     # Delete customer profile
```

**Market Research & AI (7 endpoints)**:
```
POST   /market-research               # Generate market reports
GET    /icp                          # Get recommended ICPs
POST   /icp-research                  # Generate ICP suggestions
POST   /signals-research              # Research market signals
POST   /generate-signals-batch        # Batch signal generation
POST   /signal_action                 # Accept/reject signals
POST   /signal_Ask                    # Chat with signal analysis
```

**Document Management (6 endpoints)**:
```
POST   /upload-document               # Upload files to S3 + embeddings
GET    /document-status/{file_key}    # Get processing status
GET    /user-documents                # List user's documents
DELETE /data-source/{file_id}         # Delete document
PUT    /data-source/{file_id}         # Update metadata
```

**Sales Analytics (2 endpoints)**:
```
GET    /Sales_Pipeline                # Get pipeline statistics
POST   /edit                          # Edit market research data
```

**Organization & Registration (5 endpoints)**:
```
GET    /org                           # Get organization details
POST   /org                           # Create organization
POST   /connect_org                   # Connect user to org
POST   /registration                  # Create registration
GET    /registration                  # Get all registrations
```

#### Request/Response Models

**Flexible Schema Design**:
```python
# Lead with completely flexible schema
class LeadCreateRequest(BaseModel):
    user_id: str
    org_id: str
    data: Dict[str, Any]  # ANY fields allowed

# Customer Profile ICP (extensible)
class CustomerProfileICP(BaseModel):
    model_config = ConfigDict(extra='allow')  # Allows any additional fields
    primary_region: str
    industry: List[str]
    company_size: List[str]
    buyer_role: List[str]
```

**Response Standards**:
- Success: 200 OK with JSON payload
- Created: 201 Created with resource ID
- Bad Request: 400 for validation errors
- Not Found: 404 for missing resources
- Server Error: 500 for unexpected failures

#### Error Handling Architecture

**Current Pattern** (Inconsistent):
```python
try:
    # Business logic
    result = service.process(request)
    return JSONResponse(content=result, status_code=200)
except ValidationError as e:
    return JSONResponse(content={"error": str(e)}, status_code=400)
except Exception as e:
    logger.error(f"Unexpected error: {e}")
    raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")
```

**Issues**:
- No global exception handler
- Mixed error response formats
- Generic exception catching
- Exposes internal implementation details

#### Authentication & Authorization

**🔴 CRITICAL SECURITY ISSUE: No Authentication Implemented**

**Current State**:
- **NO JWT implementation** on backend
- **NO API key validation**
- **NO user authentication middleware**
- **NO session management**

**Multi-Tenancy via Parameters Only**:
```python
@app.get("/leads")
def get_all_leads(org_id: str = Query(...)):  # No auth check!
    # Relies on client to provide correct org_id
```

**Access Control Pattern**:
```python
# Verification done via Cypher WHERE clauses only
query = """
MATCH (l:Lead {lead_id: $lead_id})
WHERE l.user_id = $user_id AND l.org_id = $org_id
RETURN l
"""
```

**Security Vulnerabilities**:
1. Parameter-based multi-tenancy (anyone can query any org)
2. No user authentication (user_id trusted without verification)
3. No authorization checks after endpoint access
4. Hardcoded credentials in config.py

### AI/LLM Architecture

#### LLM Service Layer

**Model Configuration**:
```python
# Primary LLM
llm = ChatGroq(model="llama-3.3-70b-versatile", api_key=groq_api_key)

# Secondary LLM (complex reasoning)
llm2 = ChatOpenAI(
    openai_api_base="https://api.together.xyz/v1",
    model="Qwen/Qwen3-235B-A22B-Instruct-2507-tput"
)

# Vision LLM
vision = ChatGroq(model="llama-3.2-90b-vision-preview", api_key=groq_api_key)
```

#### LangChain Integration

**Components Used**:
- **LLMGraphTransformer**: Converts text to graph documents
- **GraphCypherQAChain**: Natural language to Cypher translation
- **ConversationBufferMemory**: Chat history management
- **Agent Tools**: Search, document retrieval, and analysis

**Prompt Engineering**:
```python
template = """Task: Research and compile [specific task]

STEP 1 - COMPANY PROFILE DATA:
Review the complete company profile data below...

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool to find real, up-to-date data...

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format...
"""
```

#### Agent Architecture

**Agent Configuration**:
```python
# Function-based routing (not true orchestration)
ICP_FUNCTIONS = {
    "icp summary & market opportunity": icp_research_1,
    "buyer map & roles, pain points, triggers": icp_research_2,
    "competitive overlap & buying signals": icp_research_3,
    "regulatory, compliance & recommended icp": icp_research_4
}

COMPONENT_FUNCTIONS = {
    "market size & opportunity": Research_Market_1,
    "industry trends report": Research_Market_2,
    "competitor landscape": Research_Market_3,
    "regulatory & compliance highlights": Research_Market_4,
    "market entry & growth strategy": Research_Market_5
}

SIGNALS_FUNCTIONS = {
    "scout": search_signals_scout,
    "profiler": search_signals_profiler
}
```

**Agent Workflows**:

**Scout Agent Workflow**:
1. Parse user request with market context
2. Generate contextual search queries
3. Execute web searches via Tavily
4. Process and rank signals
5. Cache results in MongoDB

**Profiler Agent Workflow**:
1. Analyze existing leads and company profile
2. Generate ICP-specific search queries
3. Research market and competitor data
4. Build refined ICP configurations
5. Enrich lead data with insights

**🔴 Missing Strategist Agent**:
- No agent orchestration layer
- No agent-to-agent communication
- No strategy synthesis capabilities

### Data Architecture

#### Neo4j Graph Database

**Purpose**: CRM-style knowledge graph for relationship-based data

**Schema Design**:

**Node Types**:
```cypher
// Lead node
CREATE (l:Lead {
    lead_id: "unique_id",
    org_id: "organization_id",
    user_id: "owner_id",
    stage: "prospect",
    created_at: "2025-01-01T00:00:00Z",
    file_id: "upload_batch_id",
    // Dynamic properties from CSV
    company_name: "Example Corp",
    lead_name: "John Doe"
})

// CompanyProfile node
CREATE (c:CompanyProfile {
    org_id: "organization_id",
    industry: "SaaS",
    companySize: "50-200",
    companyUrl: "https://example.com"
})

// Contact node
CREATE (con:Contact {
    Name: "Jane Smith",
    title: "CTO",
    department: "Engineering",
    email: "jane@example.com"
})
```

**Relationship Types**:
```cypher
(Company)-[:Has_Contact]->(Contact)
(Contact)-[:Represents]->(Company)
(Company)-[:Has_Lead]->(Lead)
(Contact)-[:Is_POC_For]->(Lead)
(Lead)-[:Has_Activity]->(Activity)
(Lead)-[:ICPs_Tagged_with]->(ICP)
(Lead)-[:Campaigns_Tagged_With]->(Campaign)
```

**Use Cases**:
- Complex relationship queries between companies, contacts, and leads
- Pipeline analytics with stage transitions
- Network analysis of buying centers
- Recommendation engines based on graph patterns

**Connection Management**:
```python
# Singleton pattern with global driver
driver = GraphDatabase.driver(neo4j_uri, auth=(username, password))
graph = Neo4jGraph(url=uri, username=username, password=password)

# Session-based execution
with driver.session() as session:
    results = session.run(query_string, params=params)
```

#### MongoDB Document Database

**Purpose**: Flexible document storage for configurations, research, and signals

**Database Structure**:

**Database: `Profiler`**
```javascript
// Lead_Market_Scores collection
{
  org_id: "org_123",
  lead_id: "lead_456",
  component_scores: {
    "market size & opportunity": 8.5,
    "industry trends report": 7.2,
    "competitor landscape": 6.8,
    "regulatory & compliance highlights": 9.0,
    "market entry & growth strategy": 7.5
  },
  market_total_score: 7.8,
  scoring_status: "completed",
  scored_at: "2025-01-01T00:00:00Z"
}

// Lead_Market_Score_Runs collection
{
  org_id: "org_123",
  status: "processing",
  total_leads: 150,
  processed_count: 75,
  failed_count: 2,
  run_id: "run_789",
  started_at: "2025-01-01T00:00:00Z"
}
```

**Database: `Scout_Agent`**
```javascript
// Market_Intelligence collection
{
  user_id: "user_123",
  org_id: "org_123",
  component_name: "market size & opportunity",
  research_data: {
    // Complex nested JSON
    tam: 50000000,
    sam: 10000000,
    growth_rate: 0.15
  },
  timestamp: "2025-01-01T00:00:00Z"
}
```

**Database: `File_Processing`**
```javascript
// file_status collection
{
  file_id: "file_abc",
  file_key: "org_123/file_abc_report.pdf",
  user_id: "user_123",
  org_id: "org_123",
  file_name: "market_report.pdf",
  status: "completed",
  embedding_supported: true,
  chunks_count: 42,
  uploaded_at: "2025-01-01T00:00:00Z",
  completed_at: "2025-01-01T00:05:00Z"
}
```

**Indexing Strategy**:
- Compound indexes on (user_id, org_id, timestamp) for multitenancy
- TTL indexes for transient data
- Text indexes for search capabilities

#### Pinecone Vector Database

**Purpose**: Semantic search and document similarity

**Configuration**:
- Index: `brewra-documents`
- Dimension: 1024 (intfloat/multilingual-e5-large-instruct)
- Metric: Cosine similarity
- Namespace: Organization-based isolation

**Document Processing Pipeline**:
```python
# 1. Load document
if file_name.lower().endswith('.pdf'):
    loader = PyPDFLoader(local_file_path)

# 2. Split into chunks
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)
chunks = text_splitter.split_documents(documents)

# 3. Add metadata
chunk.metadata = {
    'file_key': file_key,
    'org_id': org_id,
    'user_id': user_id,
    'file_name': file_name
}

# 4. Embed and store
embeddings = OpenAIEmbeddings(
    model="intfloat/multilingual-e5-large-instruct"
)
vectorstore = PineconeVectorStore.from_documents(
    chunks, embeddings,
    index_name="brewra-documents",
    namespace=org_id  # Multi-tenant isolation
)
```

**Semantic Search Implementation**:
```python
def _fetch_pinecone_supporting_context(
    queries: List[str],
    org_id: Optional[str],
    top_k: int = 3
) -> List[Dict[str, Any]]:
    # Generate embedding for query text
    # Query Pinecone with org_id namespace
    # Return metadata including text content

# Error handling: Graceful degradation
try:
    # Pinecone logic
except Exception as e:
    logger.warning(f"Pinecone unavailable: {e}")
    return []  # Never blocks main flow
```

**Use Cases**:
- Document embeddings for uploaded files
- Semantic similarity search in research
- Context retrieval for agent responses
- Content-based recommendations

#### AWS S3 Object Storage

**Purpose**: File storage for documents and uploads

**Configuration**:
- Bucket: `brewra-data-sources`
- Region: `eu-north-1`

**Bucket Structure**:
```
brewra-data-sources/
├── {org_id}/
│   ├── {file_id}_{filename}
│   ├── original/
│   └── processed/
└── temp/
    ├── uploads/
    └── processing/
```

**File Upload Flow**:
```python
# 1. Generate file key
file_key = f"{org_id}/{file_id}_{file.filename}"

# 2. Upload to S3
s3_client.put_object(
    Bucket=s3_bucket,
    Key=file_key,
    Body=file_content,
    ContentType=file.content_type
)

# 3. Create status document in MongoDB
collection.insert_one({
    "file_key": file_key,
    "status": "processing",
    "uploaded_at": datetime.now(timezone.utc)
})

# 4. Queue background processing
background_tasks.add_task(
    process_file_to_embeddings,
    file_key, user_id, file_name, org_id, file_id
)
```

**Supported File Types**:
- **For Embedding**: PDF, TXT, CSV, XLSX
- **Storage Only**: Images, videos, presentations

**Access Control**:
- IAM user: `brewra-ai`
- Required permissions: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`

### Background Processing Architecture

#### FastAPI BackgroundTasks

**Pattern**:
```python
@app.post("/leads/market-scores")
async def get_or_refresh_lead_market_scores(
    background_tasks: BackgroundTasks,
    request: LeadMarketScoresRequest
):
    run_id = str(uuid.uuid4())

    # Queue background processing
    background_tasks.add_task(
        _run_market_scoring_for_org,
        request.user_id,
        request.org_id,
        run_id
    )

    # Returns immediately with run_id
    return JSONResponse(content={"run_id": run_id, "status": "queued"})
```

#### Long-Running Operations

**Market Scoring Pipeline**:
```python
def _run_market_scoring_for_org(user_id, org_id, run_id):
    # 1. Update status to processing
    run_coll.update_one({"run_id": run_id}, {"$set": {"status": "processing"}})

    # 2. Fetch all leads (up to 5000)
    leads = fetch_leads_for_org(org_id, limit=5000)

    # 3. Fetch company profile and market reports
    company_profile = get_company_profile_for_org(org_id)
    market_reports = get_market_reports_for_org(user_id, org_id)

    # 4. Process each lead sequentially
    for lead in leads:
        try:
            scoring_payload = score_single_lead_against_market(
                lead, company_profile, market_reports
            )
            _persist_market_score_for_lead(...)
            processed_count += 1
        except Exception:
            failed_count += 1

        # Update progress after each lead
        run_coll.update_one(
            {"run_id": run_id},
            {"$set": {
                "processed_count": processed_count,
                "failed_count": failed_count,
                "progress_percent": (processed_count / total_leads) * 100
            }}
        )

    # 5. Update final status
    run_coll.update_one(
        {"run_id": run_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}}
    )
```

**Progress Tracking**:
- MongoDB `Lead_Market_Score_Runs` collection tracks:
  - Status: `queued` → `processing` → `completed`/`failed`
  - Progress: `processed_count`, `failed_count`, `progress_percent`
  - Timestamps: `created_at`, `started_at`, `completed_at`

**Stale Run Detection**:
```python
def _is_stale_queued_run(run_doc, stale_after_seconds=300):
    # Auto-fail runs stuck in "queued" > 5 minutes
    if run_doc.get("status") != "queued":
        return False
    age_seconds = (datetime.now(timezone.utc) - reference_time).total_seconds()
    return age_seconds >= stale_after_seconds
```

### Integration Architecture

#### External API Integrations

**Tavily Search API**:
```python
search_tool = TavilySearchResults(
    k=10,  # Number of results
    tavily_api_key=tavily_api_key
)

# Usage in agent workflows
tools = [
    Tool(
        name="WebSearch",
        func=search_tool.run,
        description="Use this to gather up-to-date market data..."
    )
]
```

**LinkedIn Data API (RapidAPI)**:
```python
def get_linkedin_followers(username: str) -> dict:
    # Basic LinkedIn integration
    url = f"https://linkedin-data-api.p.rapidapi.com/{username}"
    headers = {"X-RapidAPI-Key": rapidapi_key}
    response = requests.get(url, headers=headers)
    return response.json()
```

**Firebase Integration**:
```python
# Firebase config (⚠️ API keys exposed in frontend - should use environment variables)
firebase_config = {
    "apiKey": process.env.FIREBASE_API_KEY,  # Currently hardcoded
    "authDomain": process.env.FIREBASE_AUTH_DOMAIN,
    "projectId": process.env.FIREBASE_PROJECT_ID
}
```

#### Data Flow Patterns

**Ingestion Flow**:
```
Upload → Validate → Store (S3) → Process → Embed (Pinecone) → Index (MongoDB)
```

**Research Flow**:
```
Request → Check Cache (MongoDB) → Research (LLM + Web) → Cache → Return
```

**Signal Flow**:
```
Detect → Classify → Prioritize → Store (MongoDB) → Retrieve → Display
```

**Enrichment Flow**:
```
Analyze → Enhance (LLM) → Update (Neo4j/MongoDB) → Notify → Cache
```

### Performance & Scalability

#### Current Optimizations

**Caching**:
- MongoDB for research results
- Pinecone for semantic search
- localStorage for user preferences
- In-memory cache for API responses

**Async Processing**:
- FastAPI BackgroundTasks for heavy operations
- Progress tracking via MongoDB
- Status polling for long-running jobs

**Connection Management**:
- Neo4j connection pooling
- Singleton S3 client
- Stateless Pinecone HTTP calls

**🔴 Performance Issues**:
1. No pagination (fetches up to 5000 leads)
2. Synchronous operations in async functions
3. No query optimization for large datasets
4. No connection pooling for MongoDB

#### Scalability Considerations

**Database Scaling**:
- **Neo4j**: Read replicas, sharding
- **MongoDB**: Sharding, read replicas
- **Pinecone**: Namespace-based isolation, indexing strategy
- **S3**: Lifecycle policies, CDN integration

**API Scaling**:
- Load balancing
- Horizontal scaling
- API versioning
- Rate limiting

**AI/ML Scaling**:
- Model caching
- Result caching
- Batch processing
- Queue-based processing

---

## Security Architecture

### Current Security Posture

**🔴 CRITICAL SECURITY GAPS**:

**1. No Backend Authentication**:
```python
# All endpoints are publicly accessible
@app.get("/leads")
def get_all_leads(org_id: str = Query(...)):  # No auth check!
    # Anyone can access any organization's data
```

**2. Hardcoded Credentials**:
```python
# config.py - exposed in version control (⚠️ SECRETS REMOVED)
groq_api_key = os.getenv("GROQ_API_KEY") or "HARDCODED_KEY_PRESENT"
neo4j_password = os.getenv("NEO4J_PASSWORD") or "HARDCODED_PASSWORD_PRESENT"
together_api_key = os.getenv("TOGETHER_API_KEY") or "HARDCODED_KEY_PRESENT"
```

**3. SQL/Cypher Injection Risks**:
```python
# Direct string interpolation in Cypher queries
cypher_query = f"""
CREATE (p:Prospect {{
    Name: {json.dumps(Name)},
    {attributes}  # Still risky if not sanitized
}}
"""
```

**4. Firebase API Keys Exposed**:
```typescript
// firebase.ts - visible to all users (⚠️ API KEY REMOVED)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,  // Currently hardcoded in source
  authDomain: "multi-tenant-50161.firebaseapp.com"
};
```

### Multi-Tenancy Security

**Current Implementation**:
- Organization-based data isolation via `org_id` parameter
- Namespace-based isolation in Pinecone
- User-specific cache keys in frontend

**🔴 Security Issues**:
- No verification that user belongs to specified org
- Parameter-based multi-tenancy easily bypassed
- No role-based access control
- No audit logging

### Recommended Security Architecture

**Immediate Actions**:

**1. Implement JWT Authentication**:
```python
# Authentication middleware
from fastapi import Security, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Protected endpoint
@app.get("/leads", dependencies=[Depends(verify_token)])
def get_all_leads(org_id: str = Query(...)):
    # Now protected
```

**2. Remove Hardcoded Credentials**:
```python
# config.py - NO FALLBACK VALUES
groq_api_key = os.getenv("GROQ_API_KEY")  # Raises if not set
neo4j_password = os.getenv("NEO4J_PASSWORD")
```

**3. Implement Parameterized Queries**:
```python
# Use parameterized Cypher queries
query = """
CREATE (p:Prospect {Name: $name, Company: $company})
"""
session.run(query, name=Name, company=Company)
```

**4. Add Rate Limiting**:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/market-research")
@limiter.limit("10/minute")
async def market_research(request: Request):
    # Rate limited
```

**5. Implement RBAC**:
```python
# Role-based access control
class Role(str, Enum):
    ADMIN = "admin"
    USER = "user"
    VIEWER = "viewer"

def check_role(required_role: Role):
    def role_checker(current_user = Depends(get_current_user)):
        if current_user.role != required_role:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    return role_checker

@app.post("/admin/settings", dependencies=[Depends(check_role(Role.ADMIN))])
def admin_settings():
    # Admin only
```

---

## Deployment Architecture

### Environment Strategy

**Development**:
- Local containers with hot reload
- Mock APIs for development
- Environment variables for configuration

**Staging**:
- Cloud deployment with feature flags
- Pre-production testing
- Configuration validation

**Production**:
- Render hosting (backend-11kr.onrender.com)
- Vercel hosting (frontend)
- High-availability with auto-scaling (future)

### Infrastructure as Code

**Current Implementation**:
- Manual deployment to Render
- Manual deployment to Vercel
- Environment variables via dashboard

**Recommended Future State**:
```yaml
# Terraform for cloud resources
resource "aws_eks_cluster" "brewra" {
  # Kubernetes cluster
}

resource "aws_rds_cluster" "neo4j" {
  # Managed Neo4j
}

# Ansible for configuration
- name: Deploy Brewra backend
  hosts: servers
  tasks:
    - name: Start FastAPI service
      systemd:
        name: brewra-api
        state: started
```

### CI/CD Pipeline

**Current State**: Manual deployment

**Recommended Pipeline**:
```yaml
# GitHub Actions
stages:
  - test
  - build
  - deploy

jobs:
  test:
    - Unit tests (pytest)
    - Integration tests
    - Linting (pylint, black)
    - Security scanning (bandit)

  build:
    - Docker image build
    - Push to container registry

  deploy:
    - Deploy to Render (backend)
    - Deploy to Vercel (frontend)
    - Run database migrations
    - Configure monitoring
```

---

## Monitoring & Observability

### Current State

**🔴 Minimal Observability**:
- Basic console logging
- No structured logging
- No metrics collection
- No alerting
- No performance monitoring

### Recommended Monitoring Architecture

**Logging**:
```python
# Structured logging with context
import structlog

logger = structlog.get_logger()
logger.info("lead_created",
           user_id=user_id,
           org_id=org_id,
           lead_id=lead_id,
           timestamp=datetime.now(timezone.utc).isoformat())
```

**Metrics**:
```python
# Prometheus metrics
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app)

# Business metrics
leads_created_counter = Counter('leads_created_total', 'Total leads created')
scoring_duration_histogram = Histogram('scoring_duration_seconds', 'Scoring duration')
```

**Tracing**:
```python
# Distributed tracing
from opentelemetry import trace
from opentelemetry.exporter.jaeger import JaegerExporter

tracer = trace.get_tracer(__name__)

with tracer.start_as_current_span("market_research"):
    # Trace execution
```

**Health Checks**:
```python
@app.get("/health")
async def health_check():
    checks = {
        "neo4j": check_neo4j(),
        "mongodb": check_mongodb(),
        "pinecone": check_pinecone(),
        "s3": check_s3(),
        "llm": check_llm()
    }
    return JSONResponse(content=checks)
```

---

## Technical Debt Analysis

### Critical Issues (Immediate Action Required)

**Security**:
1. No authentication on backend endpoints
2. Hardcoded credentials in source code
3. SQL/Cypher injection vulnerabilities
4. No rate limiting
5. Firebase API keys exposed

**Architecture**:
1. Monolithic API file (4,441 lines)
2. No service layer separation
3. Tight coupling between components
4. No error handling hierarchy
5. Inconsistent error responses

**Quality**:
1. Zero test coverage
2. Excessive console logging (1,566 statements)
3. No code documentation
4. No API documentation
5. Magic numbers and hard-coded values

### Medium-Term Concerns

**Performance**:
1. No pagination on list endpoints
2. Synchronous operations in async functions
3. No query optimization
4. No connection pooling for MongoDB
5. Inefficient database queries

**Maintainability**:
1. Code duplication across agents
2. Inconsistent naming conventions
3. Large component files (227KB pages)
4. Complex component hierarchy
5. Potential memory leaks in frontend

**Scalability**:
1. No caching layer (Redis)
2. No job queue for background tasks
3. Limited observability
4. No circuit breakers
5. No API versioning

### Long-Term Considerations

**Architecture Evolution**:
1. Microservices migration
2. Event-driven architecture
3. GraphQL API
4. Real-time streaming (WebSockets)
5. Advanced AI/ML capabilities

**Infrastructure**:
1. Kubernetes orchestration
2. Multi-region deployment
3. Disaster recovery
4. Compliance certifications
5. Cost optimization

---

## Recommendations

For detailed platform-wide recommendations and roadmap, see [README.md - Recommendations](README.md#recommendations)

### Architecture-Specific Priorities

**Immediate (Week 1-2)**:
- Implement JWT authentication on all endpoints
- Remove hardcoded credentials from source code
- Split api.py into router modules by feature
- Add pagination to all list endpoints

**Short-term (Months 1-3)**:
- Implement proper error handling hierarchy
- Create API documentation (OpenAPI/Swagger)
- Add service layer separation

**Medium-term (Months 3-6)**:
- Implement Redis caching layer
- Add database query optimization
- Implement job queue for background tasks
- Add horizontal scaling support

---

## Conclusion

The Brewra architecture demonstrates a **well-designed polyglot persistence** approach with appropriate database selection for different use cases. The AI/LLM integration is sophisticated, leveraging LangChain effectively for market research and customer profiling.

**Key Strengths**:
- Comprehensive multi-database architecture
- Flexible schema design for extensibility
- Effective background task pattern
- Strong LLM integration with LangChain
- Multi-tenant design with data isolation

**Critical Gaps**:
- No backend authentication (security risk)
- Monolithic code structure
- Strategist agent not implemented
- Zero test coverage
- Limited observability

**Recommendation**: Address critical security issues immediately, then refactor the monolithic architecture into modular components. Implement proper testing and monitoring before scaling to production.

---

**Document Owner**: CTO
**Review Cycle**: Monthly
**Next Review**: 2025-05-24
