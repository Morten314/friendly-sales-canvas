# Signals API Schema Documentation

## Overview
This document defines the API schema for the Signals page with Next Best Moves functionality. The Signals page displays market intelligence signals from Scout and Profiler agents, allowing users to accept, reject, and interact with contextual suggestions.

---

## Data Models

### SignalCard Interface

```typescript
interface SignalCard {
  id: string;                    // Unique signal identifier (signal_id from backend)
  agent: 'scout' | 'profiler';  // Agent that generated the signal
  timestamp: string;             // ISO 8601 date string or relative time (e.g., "1h ago", "Today")
  headline: string;              // Main signal title (required)
  snippet: string;               // Brief summary text (required)
  description: string;           // Full paragraph with detailed ICP/customer context (required)
  sourceUrl: string;            // URL to original source (required)
  sourceLabel: string;           // Display label for source (e.g., "LinkedIn post link", "Press release link")
  nextBestMoves: string[];      // Array of suggested action questions (required, can be empty array)
  contextualSuggestions: ContextualSuggestion[]; // Array of contextual action suggestions (required, can be empty array)
}
```

### ContextualSuggestion Interface

```typescript
interface ContextualSuggestion {
  icon: string;  // Emoji or icon identifier (e.g., "🔗", "💬", "📊")
  text: string;  // Action description text (e.g., "Get Company X's Website & Press Release")
}
```

---

## API Endpoints

### 1. Fetch Signals

**Endpoint:** `GET /api/fetch-signals`

**Query Parameters:**
- `user_id` (string, required): User ID to fetch signals for
- `limit` (number, optional): Maximum number of signals to return (default: 10)

**Request Example:**
```
GET /api/fetch-signals?user_id=0DGXbam3jDf45dxBIfpr30OhRqP2&limit=10
```

**Response Schema:**
```json
{
  "status": "success",
  "signals": [
    {
      "signal_id": "signal-123-abc",
      "id": "signal-123-abc",
      "agent": "scout",
      "timestamp": "2026-03-01T11:32:13.647Z",
      "headline": "Competitor X launches SMB pricing tier.",
      "snippet": "Likely to impact your ICP accounts in mid-market SaaS segment.",
      "description": "This competitive pricing move by Company X directly impacts your SMB segment in the mid-market SaaS space. With 40% of your current pipeline falling into this category, this development could accelerate decision timelines or create pricing pressure. The launch targets companies with 50-200 employees—your core ICP—and includes features that overlap with your value proposition. Consider monitoring early adoption signals and preparing competitive differentiation messaging that emphasizes your unique ROI model and enterprise-grade capabilities.",
      "sourceUrl": "https://example.com/press-release",
      "sourceLabel": "Press release link",
      "nextBestMoves": [
        "Would you like me to check how many of your target ICPs fall under the SMB segment and could be influenced by this move?",
        "Do you want me to model a competitive bundle or ROI-driven value pitch against this pricing shift?",
        "Should I track customer sentiment on LinkedIn, G2 reviews, or forums to see if it's gaining traction?"
      ],
      "contextualSuggestions": [
        {
          "icon": "🔗",
          "text": "Get Company X's Website & Press Release"
        },
        {
          "icon": "🧑‍💼",
          "text": "Identify decision makers at Company X"
        },
        {
          "icon": "📊",
          "text": "Compare SMB pricing vs. our offering"
        },
        {
          "icon": "🚀",
          "text": "Monitor early adoption signals from Company X"
        },
        {
          "icon": "📅",
          "text": "Track mentions of SMB tier in LinkedIn updates"
        }
      ]
    }
  ]
}
```

**Response Fields:**
- `status` (string): "success" or "error"
- `signals` (array): Array of SignalCard objects
  - `signal_id` (string): Primary identifier for API calls (required)
  - `id` (string): Fallback identifier if signal_id not present
  - `agent` (string): "scout" or "profiler" (required)
  - `timestamp` (string): ISO 8601 format or relative time (required)
  - `headline` (string): Main signal title (required)
  - `snippet` (string): Brief summary (required)
  - `description` (string): Full detailed context paragraph (required)
  - `sourceUrl` (string): URL to source (required)
  - `sourceLabel` (string): Display label for source (required)
  - `nextBestMoves` (array of strings): Suggested action questions (required, can be empty)
  - `contextualSuggestions` (array): Action suggestions with icons (required, can be empty)

**Error Response:**
```json
{
  "status": "error",
  "message": "Error message here"
}
```

---

### 2. Generate Signals Batch

**Endpoint:** `POST /api/generate-signals-batch`

**Request Body Schema:**
```json
{
  "user_id": "string (required)",
  "org_id": "string (optional, can be derived from user_id)",
  "component_name": "string (optional, default: 'signals')",
  "refresh": true,
  "data": {
    "industry": "string (e.g., 'SaaS', 'FinTech', 'Healthcare')",
    "companySize": "string (e.g., '50-200 employees')",
    "companyUrl": "string (URL)",
    "strategicGoals": "string",
    "primaryGTMModel": "string (e.g., 'Direct sales', 'Product-led')",
    "revenueStage": "string (e.g., 'Growth', 'Scale')",
    "keyBuyerPersona": "string (e.g., 'CTO', 'VP Sales')",
    "targetMarkets": ["string"] // Array of market names
  }
}
```

**Request Example:**
```json
{
  "user_id": "0DGXbam3jDf45dxBIfpr30OhRqP2",
  "component_name": "test",
  "data": {
    "industry": "SaaS",
    "companySize": "50-200 employees",
    "companyUrl": "https://example.com",
    "strategicGoals": "Market expansion",
    "primaryGTMModel": "Direct sales",
    "revenueStage": "Growth",
    "keyBuyerPersona": "CTO",
    "targetMarkets": ["North America", "Europe"]
  },
  "refresh": true
}
```

**Response Schema:**
```json
{
  "status": "success",
  "message": "Signals generated successfully",
  "signals_generated": 5
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "Error message here"
}
```

**Notes:**
- This endpoint triggers the backend to generate new signals based on company profile data
- The `refresh: true` flag indicates this is a refresh operation
- Backend should use the provided `data` object to generate contextually relevant signals
- Generated signals should be stored and associated with the `user_id`

---

### 3. Signal Action (Accept/Reject)

**Endpoint:** `POST /api/signal_action`

**Request Body Schema:**
```json
{
  "org_id": "string (required)",
  "signal_id": "string (required)",
  "action": "accept" | "reject" (required)
}
```

**Request Example:**
```json
{
  "org_id": "b75ce29e-344c-4e6c-964e-5ac236d0b49a",
  "signal_id": "signal-123-abc",
  "action": "accept"
}
```

**Response Schema:**
```json
{
  "status": "success",
  "message": "Signal accepted successfully",
  "signal_id": "signal-123-abc",
  "action": "accept"
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "Error message here"
}
```

**Notes:**
- `signal_id` should match the `signal_id` field from the fetch-signals response
- `action` can be either "accept" or "reject"
- Backend should track user's accept/reject actions for analytics
- Rejected signals should be filtered out in subsequent fetch-signals calls

---

## Field Requirements and Constraints

### Required Fields (All Signals)
- `signal_id` or `id`: Must be unique and stable (same signal content = same ID)
- `agent`: Must be either "scout" or "profiler"
- `timestamp`: ISO 8601 format preferred (e.g., "2026-03-01T11:32:13.647Z") or relative time
- `headline`: Non-empty string, main signal title
- `snippet`: Non-empty string, brief summary
- `description`: Non-empty string, full detailed context paragraph
- `sourceUrl`: Valid URL string
- `sourceLabel`: Non-empty string, display label
- `nextBestMoves`: Array of strings (can be empty array `[]`)
- `contextualSuggestions`: Array of objects (can be empty array `[]`)

### Optional but Recommended
- `org_id`: Organization ID for multi-tenancy
- `user_id`: User ID who owns the signal
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

## Next Best Moves Requirements

### Format
- Array of strings
- Each string is a question or suggested action
- Typically 2-5 items per signal
- Questions should be actionable and contextual

### Examples:
```json
"nextBestMoves": [
  "Would you like me to check how many of your target ICPs fall under the SMB segment and could be influenced by this move?",
  "Do you want me to model a competitive bundle or ROI-driven value pitch against this pricing shift?",
  "Should I track customer sentiment on LinkedIn, G2 reviews, or forums to see if it's gaining traction?"
]
```

### Content Guidelines:
- Should be questions that prompt user action
- Should be specific to the signal's context
- Should leverage company profile data (ICP, industry, etc.)
- Should be actionable (user can accept to trigger agentic interaction)

---

## Contextual Suggestions Requirements

### Format
- Array of objects with `icon` and `text` properties
- Typically 3-5 items per signal
- Icons are emoji strings or icon identifiers

### Examples:
```json
"contextualSuggestions": [
  {
    "icon": "🔗",
    "text": "Get Company X's Website & Press Release"
  },
  {
    "icon": "🧑‍💼",
    "text": "Identify decision makers at Company X"
  },
  {
    "icon": "📊",
    "text": "Compare SMB pricing vs. our offering"
  }
]
```

### Icon Guidelines:
- Use emoji for visual appeal (🔗, 💬, 📊, 🚀, 📅, 🧑‍💼, etc.)
- Icons should be relevant to the action
- Common icons: 🔗 (link), 💬 (chat), 📊 (analytics), 🚀 (action), 📅 (calendar), 🧑‍💼 (people)

### Text Guidelines:
- Should be concise action descriptions
- Should be specific to the signal context
- Should be actionable (user can click to trigger action)

---

## Agentic Interaction Flow

### When User Accepts a Next Best Move:

1. **Frontend Action:**
   - User clicks "Accept" on a nextBestMove item
   - Frontend calls: `POST /api/signal_action` with `action: "accept"`
   - Frontend opens chat interface with contextual message

2. **Backend Processing:**
   - Backend receives accept action
   - Backend should prepare agentic response based on:
     - The specific nextBestMove question
     - The signal context (headline, description, source)
     - Company profile data (ICP, industry, goals)
   - Backend generates contextual response

3. **Agentic Response:**
   - Backend should provide intelligent response to the nextBestMove question
   - Response should leverage:
     - Signal data (competitor info, market data, etc.)
     - Company profile (ICP, target markets, goals)
     - Historical data (previous signals, interactions)
   - Response should be actionable and specific

### Example Flow:

**User accepts:** "Would you like me to check how many of your target ICPs fall under the SMB segment and could be influenced by this move?"

**Backend should:**
1. Analyze company's ICP data
2. Identify SMB segment companies in pipeline
3. Calculate impact percentage
4. Generate response: "I've analyzed your pipeline and found that 40% of your current deals (12 out of 30) fall into the SMB segment that could be impacted by Company X's pricing move. Here's a breakdown..."

---

## Data Consistency Requirements

### Signal ID Stability
- Same signal content should generate same `signal_id`
- Frontend uses content hash to identify signals
- Backend should use consistent ID generation
- IDs should be URL-safe strings

### Timestamp Format
- Preferred: ISO 8601 format (`2026-03-01T11:32:13.647Z`)
- Alternative: Relative time strings ("1h ago", "Today", "2d ago")
- Frontend can parse both formats

### Multi-Tenancy
- All endpoints should support `org_id` parameter
- Signals should be scoped to organization
- User actions should be tracked per organization

---

## Error Handling

### Standard Error Response:
```json
{
  "status": "error",
  "message": "Human-readable error message",
  "code": "ERROR_CODE (optional)",
  "details": {} // Optional additional error details
}
```

### HTTP Status Codes:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (authentication required)
- `404`: Not Found (signal not found)
- `500`: Internal Server Error

---

## Rate Limiting Considerations

- `fetch-signals`: Should support reasonable limits (default: 10 signals)
- `generate-signals-batch`: May be rate-limited due to processing cost
- `signal_action`: Should support high frequency (user interactions)

---

## Notes for Backend Developer

1. **Signal Generation:**
   - Use company profile data to generate contextually relevant signals
   - Include detailed `description` with ICP/customer context
   - Generate 2-5 `nextBestMoves` per signal
   - Generate 3-5 `contextualSuggestions` per signal

2. **Agentic Responses:**
   - When user accepts a nextBestMove, prepare intelligent response
   - Leverage signal context + company profile + historical data
   - Responses should be actionable and specific

3. **Data Persistence:**
   - Store signals with user_id and org_id
   - Track accept/reject actions for analytics
   - Filter rejected signals in fetch-signals response

4. **Performance:**
   - `fetch-signals` should be fast (cached if possible)
   - `generate-signals-batch` may take longer (async processing)
   - `signal_action` should be immediate

5. **Multi-Tenancy:**
   - All operations should be scoped to org_id
   - Ensure data isolation between organizations

---

## Example Complete Signal Object

```json
{
  "signal_id": "signal-comp-pricing-2026-03-01",
  "id": "signal-comp-pricing-2026-03-01",
  "agent": "scout",
  "timestamp": "2026-03-01T11:32:13.647Z",
  "headline": "Competitor X launches SMB pricing tier.",
  "snippet": "Likely to impact your ICP accounts in mid-market SaaS segment.",
  "description": "This competitive pricing move by Company X directly impacts your SMB segment in the mid-market SaaS space. With 40% of your current pipeline falling into this category, this development could accelerate decision timelines or create pricing pressure. The launch targets companies with 50-200 employees—your core ICP—and includes features that overlap with your value proposition. Consider monitoring early adoption signals and preparing competitive differentiation messaging that emphasizes your unique ROI model and enterprise-grade capabilities.",
  "sourceUrl": "https://companyx.com/press-release/smb-pricing",
  "sourceLabel": "Press release link",
  "nextBestMoves": [
    "Would you like me to check how many of your target ICPs fall under the SMB segment and could be influenced by this move?",
    "Do you want me to model a competitive bundle or ROI-driven value pitch against this pricing shift?",
    "Should I track customer sentiment on LinkedIn, G2 reviews, or forums to see if it's gaining traction?"
  ],
  "contextualSuggestions": [
    {
      "icon": "🔗",
      "text": "Get Company X's Website & Press Release"
    },
    {
      "icon": "🧑‍💼",
      "text": "Identify decision makers at Company X"
    },
    {
      "icon": "📊",
      "text": "Compare SMB pricing vs. our offering"
    },
    {
      "icon": "🚀",
      "text": "Monitor early adoption signals from Company X"
    },
    {
      "icon": "📅",
      "text": "Track mentions of SMB tier in LinkedIn updates"
    }
  ],
  "org_id": "b75ce29e-344c-4e6c-964e-5ac236d0b49a",
  "user_id": "0DGXbam3jDf45dxBIfpr30OhRqP2",
  "created_at": "2026-03-01T11:32:13.647Z"
}
```

---

## Summary

**Key Points:**
1. All signals must include `nextBestMoves` array (can be empty)
2. All signals must include `contextualSuggestions` array (can be empty)
3. `signal_id` is the primary identifier for API calls
4. `description` field should contain detailed ICP/customer context
5. Agentic interactions should be triggered when user accepts nextBestMoves
6. All endpoints support multi-tenancy via `org_id`

**Priority Fields:**
- `signal_id`, `headline`, `snippet`, `description` (required)
- `nextBestMoves`, `contextualSuggestions` (required, can be empty arrays)
- `sourceUrl`, `sourceLabel`, `agent`, `timestamp` (required)



