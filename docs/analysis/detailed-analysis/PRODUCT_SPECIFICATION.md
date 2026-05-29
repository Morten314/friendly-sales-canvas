# Brewra Product Specification Document

> **Snapshot — pre-backend-refactor.** This document reflects the backend as the flat `api.py`/`services.py` monolith and is preserved as a point-in-time analysis (authored 2026-05-08). For the **current** backend architecture see [`docs/architecture/BACKEND.md`](../../architecture/BACKEND.md). Frontend sections are likewise a snapshot; the frontend refactor is in progress (see specs 14–21).

**Document Version**: 1.0
**Last Updated**: 2025-04-24
**Status**: Production Implementation Analysis

---

## Executive Summary

Brewra is a B2B sales intelligence and GTM (Go-To-Market) execution platform that combines AI-powered agents with human expertise to help companies break into new markets faster. The platform provides three AI agents that work together to deliver market insights, customer profiling, and strategic recommendations.

**Current Implementation Status**: 70% Complete
- ✅ **Scout Agent** (Researcher): Fully implemented
- ✅ **Profiler Agent** (Analyst): Fully implemented
- ❌ **Strategist Agent** (Orchestrator): Not implemented

**Target Market**: B2B SaaS companies with GTM & Sales teams
**Core Value Proposition**: Reduce market entry time and increase sales efficiency through AI-driven insights

---

## Product Architecture

For detailed technology stack information, see:
- [README.md - Technology Stack](README.md#technology-stack)
- [ARCHITECTURE_DOCUMENT.md - High-Level Architecture](ARCHITECTURE_DOCUMENT.md#high-level-architecture)

---

## Core Features

### 1. Scout Agent - The Researcher

**Mission**: Scan markets, signals, and data to uncover next opportunities

**Implementation Status**: ✅ Complete

**Core Capabilities**:

#### Market Research (5 Components)
1. **Market Size & Opportunity**
   - Total addressable market (TAM) analysis
   - Serviceable addressable market (SAM) calculation
   - Market growth projections
   - Opportunity scoring and ranking

2. **Industry Trends Report**
   - Emerging technology trends
   - Industry disruption patterns
   - Market shift indicators
   - Technology adoption curves

3. **Competitor Landscape**
   - Competitive positioning analysis
   - Feature comparison matrices
   - Market share analysis
   - Competitive intelligence gathering

4. **Regulatory & Compliance Highlights**
   - Market-specific regulatory requirements
   - Compliance considerations
   - Risk assessment
   - Legal frameworks

5. **Market Entry & Growth Strategy**
   - Entry strategy recommendations
   - Growth channel identification
   - Go-to-market playbook suggestions
   - Timing and sequencing recommendations

#### Lead Stream
- Real-time lead generation from market research
- Lead filtering and enrichment
- Market opportunity identification
- Split-view interface (Scout research + Lead data)

#### Chat Interface
- Interactive chat with Scout agent
- Context-aware research requests
- Historical conversation tracking

**Technical Implementation**:
- Component-based architecture with independent API calls
- Real-time data refresh capabilities
- MongoDB caching for research results
- Pinecone integration for semantic search context

---

### 2. Profiler Agent - The Analyst

**Mission**: Map ideal customers and stakeholders, show who really matters

**Implementation Status**: ✅ Complete

**Core Capabilities**:

#### ICP Building (4 Research Functions)
1. **ICP Summary & Market Opportunity**
   - Ideal Customer Profile generation
   - Market opportunity sizing
   - Customer segment analysis
   - Persona development

2. **Buyer Map & Roles, Pain Points, Triggers**
   - Decision-maker mapping
   - Buyer persona development
   - Pain point identification
   - Trigger event analysis

3. **Competitive Overlap & Buying Signals**
   - Competitive landscape analysis
   - Buying signal detection
   - Market positioning insights
   - Differentiation opportunities

4. **Regulatory, Compliance & Recommended ICP**
   - Compliance requirements
   - Regulatory considerations
   - Refined ICP recommendations
   - Risk assessment

#### Customer Profile Management
- ICP configuration saving and management
- Customer profile creation from suggested ICPs
- ICP editing and versioning
- Historical ICP tracking

#### Lead Stream
- ICP-filtered lead management
- Lead scoring based on ICP alignment
- Customer buying center analysis
- Hidden champion detection

#### Data Enrichment
- LinkedIn profile integration (basic)
- Contact data enhancement
- Company profile enrichment
- Social selling metrics

**Technical Implementation**:
- Customer page with tabbed interface
- ICP intelligence panels with historical data
- Lead stream with real-time updates
- Chat interface for profiling assistance

---

### 3. Strategist Agent - The Orchestrator

**Mission**: Connect strategy and execution, recommend next best actions

**Implementation Status**: ❌ **NOT IMPLEMENTED**

**Intended Capabilities** (based on product vision):

#### Signal Generation & Management
- Convert Scout and Profiler insights into actionable signals
- Real-time signal processing and recommendation engine
- Context-aware suggestion system
- Action tracking and follow-up workflows

#### GTM Strategy Development
- Turn insights into actionable GTM plays
- Recommend next best actions per account
- Align sales, marketing, and partner outreach
- Strategy-to-execution mapping

#### Performance Analytics
- Track signal effectiveness and ROI
- Measure strategy execution success
- Account-based performance tracking
- Cross-functional alignment metrics

**Current Implementation**:
- Signals page exists with card-based interface
- Basic signal generation from Scout/Profiler
- No true strategy orchestration
- No agent-to-agent communication

---

## Lead Management System

### Core Lead Operations

**CRUD Operations**:
- Create single lead with flexible schema
- Bulk lead upload via CSV/Excel
- Update lead with flexible schema
- Delete individual leads
- Bulk delete by upload file

**Lead Data Model**:
- Company information (name, industry, size, location)
- Contact information (name, title, email, phone)
- Lead stage tracking (customizable pipeline stages)
- Lead source tracking
- Custom fields support (flexible schema)

### Market Scoring System

**Scoring Components** (5 dimensions):
1. Market Size & Opportunity score
2. Industry Trends score
3. Competitor Landscape score
4. Regulatory & Compliance score
5. Market Entry & Growth Strategy score

**Scoring Process**:
- Background job processing (async)
- Progress tracking via MongoDB
- Individual lead scoring against market components
- Overall market score calculation
- Detailed score descriptions and explanations

**Scoring Management**:
- Trigger scoring on-demand
- Check scoring progress in real-time
- View detailed scoring explanations
- Historical scoring runs tracking

---

## Document Processing System

### File Upload & Processing

**Supported File Types**:
- PDF documents (.pdf)
- Text files (.txt)
- CSV files (.csv)
- Excel files (.xlsx)
- URLs as data sources

**Processing Pipeline**:
1. File upload → S3 storage
2. Background processing → Document parsing
3. Text extraction → Chunking (1000 chars, 200 overlap)
4. Embedding generation → Pinecone vector storage
5. Status tracking → MongoDB file_status collection

**Embedding Strategy**:
- Model: `intfloat/multilingual-e5-large-instruct`
- Vector dimensions: 1024
- Similarity metric: Cosine
- Multi-tenant isolation via Pinecone namespaces

**Document Management**:
- List user's uploaded documents
- Check processing status
- Delete documents
- Update document metadata
- Tag and description support

---

## Multi-Tenancy & User Management

### Multi-Tenancy Architecture

**Tenant Isolation**:
- Organization-based data isolation
- User-specific tenant selection
- Tenant context in API calls
- Tenant-aware caching strategies

**Tenant Management**:
- Tenant selection interface
- Tenant switching capabilities
- Tenant-specific data isolation
- User-tenant relationship mapping

### Authentication & Authorization

**Current Implementation**:
- Firebase Authentication for user login/signup
- JWT token generation with tenant context
- Organization ID fetching from backend
- Token storage in localStorage

**⚠️ CRITICAL SECURITY ISSUE**: Backend API has **NO authentication** implemented
- See [ARCHITECTURE_DOCUMENT.md - Authentication & Authorization](ARCHITECTURE_DOCUMENT.md#authentication--authorization) for details
- All endpoints are publicly accessible
- Multi-tenancy enforced only via query parameters
- No API key validation
- No user authentication middleware

---

## Integration Capabilities

### Implemented Integrations

**LinkedIn Integration** (Basic):
- Profile data retrieval
- Follower count tracking
- Recent activity monitoring
- Via RapidAPI integration

**Tavily Search**:
- Real-time web search for market research
- Competitor intelligence gathering
- Industry trend monitoring
- Market signal detection

**Firebase**:
- User authentication
- Organization management
- Multi-tenant user management

### Planned/Not Implemented Integrations

**❌ Apollo.io**:
- Mentioned in product vision
- Not implemented in codebase

**❌ LinkedIn Sales Navigator**:
- Advanced LinkedIn features
- Not implemented

**❌ CRM Systems**:
- Salesforce integration
- HubSpot integration
- Not implemented

---

## User Interface

### Main Pages (17 total)

**Dashboard Pages**:
- Index (Welcome dashboard with agent personas)
- AgentHub (Main dashboard with metrics and analytics)
- MissionControl (Business configuration)

**Agent Pages**:
- MarketResearch (Scout agent - 227KB)
- Customers (Profiler agent)
- Signals (Strategist agent - 74KB)
- Calendar (Activator agent - campaign management)
- Reports (Presenter agent - demo preparation)

**Utility Pages**:
- Settings (User, company, agent profiles)
- Insights (Reporting and analytics)
- Artifacts (Artefact repository)
- Login (Authentication)
- TenantSelection (Multi-tenancy selection)

### UI/UX Features

**Design System**: See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for complete design system documentation
- 51 shadcn/ui components (Radix UI primitives)
- Tailwind CSS with dark mode support
- Lucide React icons
- Responsive mobile-first design
- PWA capabilities (installable, offline support)

**Navigation**:
- Collapsible sidebar (mobile sheet, desktop persistent)
- Tab-based navigation within pages
- Context-aware header actions
- Breadcrumbs for deep navigation

**Interactive Features**:
- Real-time data updates
- Background task progress tracking
- Chat interfaces with agents
- Drawer/modal patterns for details
- Custom event system for cross-component communication

---

## Data Models

### Core Entities

**Lead**:
- Lead ID, organization ID, user ID
- Company information (flexible schema)
- Contact information (flexible schema)
- Stage, score, timestamps
- Custom fields support

**Company**:
- Company profile (industry, size, location)
- Strategic goals, GTM model
- Target markets, URLs
- Organization-scoped

**ICP (Ideal Customer Profile)**:
- Industry, company size, buyer role
- Primary region, revenue stage
- Pain points, triggers
- Recommended vs saved status

**Signal**:
- Agent type (scout/profiler)
- Headline, description, snippet
- Source URL and citations
- Next best actions
- Contextual suggestions

**Market Intelligence**:
- Component name (5 types)
- Research data (complex JSON)
- Timestamp, user ID, org ID
- Cached results

---

## Performance & Scalability

### Current Implementation

**Caching Strategy**: MongoDB caching, Pinecone semantic search, localStorage, in-memory cache

**Background Processing**: FastAPI BackgroundTasks, MongoDB progress tracking, status polling

**Data Storage**: Neo4j (unlimited), MongoDB (Atlas scaling), Pinecone (namespace isolation), S3 (unlimited)

For detailed performance analysis, see [ARCHITECTURE_DOCUMENT.md - Performance & Scalability](ARCHITECTURE_DOCUMENT.md#performance--scalability)

### Performance Concerns

**⚠️ Issues Identified**:
- No pagination on list endpoints (fetches up to 5000 leads)
- Synchronous database operations in async functions
- No query optimization for large datasets
- No connection pooling for MongoDB
- Potential memory leaks in frontend (989 React hooks)

---

## Technical Debt & Limitations

### Critical Issues

**🔴 Security**: See [ARCHITECTURE_DOCUMENT.md - Security Architecture](ARCHITECTURE_DOCUMENT.md#security-architecture)
- No authentication on backend endpoints
- Hardcoded API keys in source code
- No input validation on user inputs
- No rate limiting on API endpoints
- Firebase API keys exposed in frontend

**🔴 Architecture**: See [ARCHITECTURE_DOCUMENT.md - Technical Debt Analysis](ARCHITECTURE_DOCUMENT.md#technical-debt-analysis)
- No Strategist agent implementation
- Monolithic API file (4,995 lines as of 2026-05-09; +554 from new Claude-backed endpoints)
- No agent orchestration or communication
- Tight coupling between frontend and backend

**🔴 Quality**: See [README.md - Critical Issues Summary](README.md#critical-issues-summary)
- Limited test coverage — characterization tests (BE pytest + FE Playwright) added 2026-05-08; pre-existing 4 `backend/test_*.py` smoke scripts still hit live production. No CI wiring yet.
- Excessive console logging (1,566 statements)
- Inconsistent error handling
- No API documentation
- Minimal code documentation

### Functional Limitations

**Missing Features**:
- Strategist agent orchestration
- Agent-to-agent communication
- CRM integrations (Salesforce, HubSpot)
- Advanced LinkedIn features
- Apollo.io integration
- Real-time streaming updates
- Automated workflows

**Usability Issues**:
- Large page files (MarketResearch.tsx - 227KB)
- Complex component hierarchy
- Inconsistent state management
- Mixed API call patterns

---

## Future Roadmap

For detailed roadmap and recommendations, see [README.md - Recommendations](README.md#recommendations)

### Feature Priorities

**Immediate (Weeks 1-2)**:
- Security hardening (authentication, credentials, validation)
- Architecture refactoring (split monolithic API, add pagination)

**Short-term (Months 1-3)**:
- Strategist agent orchestration
- Agent-to-agent communication
- CRM integrations (Salesforce, HubSpot)
- Comprehensive test suite

**Medium-term (Months 3-6)**:
- Redis caching layer
- Job queue for background tasks
- Real-time streaming updates
- Advanced analytics dashboard

**Long-term (Months 6-12)**:
- Enterprise features (SSO, SAML)
- Compliance certifications (SOC2, GDPR)
- Fine-tuned industry-specific models
- Predictive lead scoring

---

## Success Metrics

For detailed success metrics, see [README.md - Success Metrics](README.md#success-metrics)

### Key Metrics

**User Engagement**:
- Daily active users (DAU)
- Session duration
- Feature adoption rates
- Agent usage patterns

**Business Impact**:
- Sales cycle reduction
- Lead conversion improvement
- Market expansion speed
- Customer acquisition cost reduction

**Technical Performance**:
- API response times (< 200ms p50)
- Background job success rate (> 99%)
- System uptime (> 99.9%)
- Error rates (< 0.1%)

---

## Conclusion

Brewra is a **feature-rich** AI-powered sales intelligence platform with strong market research and customer profiling capabilities. However, the product has **critical security vulnerabilities** and incomplete agent orchestration that prevent production deployment.

**Key Strengths**:
- Comprehensive market research (5 components)
- Advanced ICP building and customer profiling
- Flexible lead management with market scoring
- Robust document processing with semantic search
- Multi-tenant architecture with PWA support

**Critical Gaps**:
- No backend authentication (security risk)
- Strategist agent not implemented
- No agent orchestration or communication
- Missing CRM integrations
- Test coverage early-stage (characterization tests added 2026-05-08, no CI yet)

**Recommendation**: Address critical security issues immediately, then focus on completing the Strategist agent and implementing proper agent orchestration to fulfill the product vision.

---

**Document Owner**: CTO
**Review Cycle**: Monthly
**Next Review**: 2025-05-24
