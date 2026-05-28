# Scout Components JSON Structure

This document outlines the JSON structure and keys for each of the 5 Scout components.

## General API Response Wrapper

All components return responses in this format:

```json
{
  "status": "success",
  "data": {
    // Component-specific data structure (see below)
    "timestamp": "2024-01-15T10:30:00Z",
    "user_id": "user123"
  }
}
```

---

## 1. Market Size & Opportunity

**Component Name:** `"market size & opportunity"`

### JSON Structure:

```json
{
  "status": "success",
  "data": {
    "executiveSummary": "string",
    "tamValue": "string",
    "samValue": "string",
    "GrowthRate": "string",
    "strategicRecommendations": ["string", "string"],
    "marketEntry": "string",
    "marketDrivers": ["string", "string"],
    "marketSizeBySegment": {
      "segment1": "value1",
      "segment2": "value2"
    },
    "growthProjections": {
      "year1": "projection1",
      "year2": "projection2"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "user_id": "user123"
  }
}
```

### Key Fields:

- `executiveSummary` (string): Executive summary of market size analysis
- `tamValue` (string): Total Addressable Market value
- `samValue` (string): Serviceable Addressable Market value
- `GrowthRate` (string): Growth rate
- `strategicRecommendations` (string[]): Array of strategic recommendations
- `marketEntry` (string): Market entry strategy
- `marketDrivers` (string[]): Array of market drivers
- `marketSizeBySegment` (object): Market size broken down by segments
- `growthProjections` (object): Growth projections by time period
- `timestamp` (string): ISO timestamp of when data was generated
- `user_id` (string): User ID for multi-tenancy

---

## 2. Industry Trends Report

**Component Name:** `"industry trends report"`

### JSON Structure:

```json
{
  "status": "success",
  "data": {
    "executiveSummary": "string",
    "aiAdoption": "string",
    "cloudMigration": "string",
    "regulatory": "string",
    "trendSnapshots": [
      {
        "title": "string",
        "metric": "string",
        "type": "growth" | "performance" | "adoption"
      }
    ],
    "recommendations": {
      "primaryFocus": "string",
      "marketEntry": "string"
    },
    "regionalHotspots": {
      "APAC": "string",
      "Europe": "string",
      "North America": "string"
    },
    "visualCharts": {
      "aiAdoptionTrends": [
        "Q1",
        "Q2",
        "Q3",
        "Q4"
      ],
      "technologyBudgetAllocation": {
        "AI/ML": "string",
        "Cloud": "string",
        "Security": "string"
      }
    },
    "risks": [
      "string",
      "string"
    ],
    "timestamp": "2024-01-15T10:30:00Z",
    "user_id": "user123"
  }
}
```

### Key Fields:

- `executiveSummary` (string): Executive summary of industry trends
- `aiAdoption` (string): AI adoption percentage/rate
- `cloudMigration` (string): Cloud migration percentage/rate
- `regulatory` (string): Regulatory impact information
- `trendSnapshots` (array): Array of trend snapshot objects
  - `title` (string): Snapshot title
  - `metric` (string): Metric value
  - `type` (enum): "growth" | "performance" | "adoption"
- `recommendations` (object): Strategic recommendations
  - `primaryFocus` (string): Primary focus area
  - `marketEntry` (string): Market entry recommendation
- `regionalHotspots` (object): Regional hotspot data by region
- `visualCharts` (object): Visual chart data
  - `aiAdoptionTrends` (string[]): Array of quarters or time periods
  - `technologyBudgetAllocation` (object): Budget allocation by technology
- `risks` (string[]): Array of identified risks
- `timestamp` (string): ISO timestamp
- `user_id` (string): User ID

---

## 3. Regulatory & Compliance Highlights

**Component Name:** `"regulatory & compliance highlights"`

### JSON Structure:

```json
{
  "status": "success",
  "data": {
    "executiveSummary": "string",
    "euAiActDeadline": "string",
    "gdprCompliance": "string",
    "potentialFines": "string",
    "dataLocalization": "string",
    "keyUpdates": [
      {
        "title": "string",
        "description": "string",
        "date": "string"
      }
    ],
    "visualDataCards": [
      {
        "type": "bar-chart" | "timeline" | "percentage",
        "title": "string",
        "data": [
          {
            "name": "string",
            "value": "number",
            "color": "string"
          }
        ]
      }
    ],
    "regionalData": [
      {
        "region": "string",
        "compliance": "string",
        "deadline": "string"
      }
    ],
    "strategicRecommendations": {
      "mitigateRegulatoryRisks": [
        "string"
      ],
      "competitivePositioning": [
        "string"
      ],
      "goToMarketStrategy": [
        "string"
      ]
    },
    "uiComponents": [
      {
        "type": "string",
        "data": {}
      }
    ],
    "timestamp": "2024-01-15T10:30:00Z",
    "user_id": "user123"
  }
}
```

### Key Fields:

- `executiveSummary` (string): Executive summary
- `euAiActDeadline` (string): EU AI Act deadline information
- `gdprCompliance` (string): GDPR compliance status
- `potentialFines` (string): Potential fines information
- `dataLocalization` (string): Data localization requirements
- `keyUpdates` (array): Array of key regulatory updates
- `visualDataCards` (array): Visual data cards for charts
  - `type` (enum): "bar-chart" | "timeline" | "percentage"
  - `title` (string): Card title
  - `data` (array): Chart data points
- `regionalData` (array): Regional compliance data
- `strategicRecommendations` (object): Strategic recommendations by category
- `uiComponents` (array): Additional UI components
- `timestamp` (string): ISO timestamp
- `user_id` (string): User ID

---

## 4. Competitor Landscape

**Component Name:** `"competitor landscape"`

### JSON Structure:

```json
{
  "status": "success",
  "data": {
    "executiveSummary": "string",
    "topPlayerShare": "string",
    "emergingPlayers": "string",
    "fundingNews": [
      {
        "company": "string",
        "amount": "string",
        "date": "string",
        "type": "string"
      }
    ],
    "competitorLandscape": {
      "topPlayers": "string",
      "emergingPlayers": "string",
      "recentMoves": []
    },
    "strategicRecommendations": ["string"],
    "uiComponents": [
      {
        "type": "report",
        "executiveSummary": "string",
        "topPlayerShare": "string",
        "emergingPlayers": "string",
        "fundingNews": []
      }
    ],
    "timestamp": "2024-01-15T10:30:00Z",
    "user_id": "user123"
  }
}
```

### Key Fields:

- `executiveSummary` (string): Executive summary of competitor landscape
- `topPlayerShare` (string): Top player market share information
- `emergingPlayers` (string): Emerging players information
- `fundingNews` (array): Array of funding news items
  - `company` (string): Company name
  - `amount` (string): Funding amount
  - `date` (string): Funding date
  - `type` (string): Funding type
- `competitorLandscape` (object): Nested competitor landscape data (optional)
- `strategicRecommendations` (string[]): Strategic recommendations
- `uiComponents` (array): UI components array (may contain report type)
- `timestamp` (string): ISO timestamp
- `user_id` (string): User ID

**Note:** The API may return data in multiple formats:

1. Direct fields: `executiveSummary`, `topPlayerShare`, etc.
2. Nested: `competitorLandscape.executiveSummary`
3. UI Components: `uiComponents[].executiveSummary` (where type === "report")

---

## 5. Market Entry & Growth Strategy

**Component Name:** `"market entry & growth strategy"`

### JSON Structure:

```json
{
  "status": "success",
  "data": {
    "executiveSummary": "string",
    "entryBarriers": "string",
    "recommendedChannel": "string",
    "timeToMarket": "string",
    "topBarrier": "string",
    "competitiveDifferentiation": "string",
    "strategicRecommendations": ["string"],
    "riskAssessment": "string",
    "swot": {
      "strengths": ["string"],
      "weaknesses": ["string"],
      "opportunities": ["string"],
      "threats": ["string"]
    },
    "timeline": [
      {
        "phase": "string",
        "duration": "string",
        "milestones": ["string"]
      }
    ],
    "marketSizeBySegment": {
      "segment1": "value1",
      "segment2": "value2"
    },
    "growthProjections": {
      "year1": "projection1",
      "year2": "projection2"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "user_id": "user123"
  }
}
```

### Key Fields:

- `executiveSummary` (string): Executive summary
- `entryBarriers` (string): Market entry barriers description
- `recommendedChannel` (string): Recommended entry channel
- `timeToMarket` (string): Time to market estimate
- `topBarrier` (string): Top barrier identification
- `competitiveDifferentiation` (string): Competitive differentiation strategy
- `strategicRecommendations` (string[]): Array of strategic recommendations
- `riskAssessment` (string): Risk assessment summary
- `swot` (object): SWOT analysis
  - `strengths` (string[]): Array of strengths
  - `weaknesses` (string[]): Array of weaknesses
  - `opportunities` (string[]): Array of opportunities
  - `threats` (string[]): Array of threats
- `timeline` (array): Market entry timeline
  - `phase` (string): Phase name
  - `duration` (string): Phase duration
  - `milestones` (string[]): Phase milestones
- `marketSizeBySegment` (object): Market size by segment
- `growthProjections` (object): Growth projections
- `timestamp` (string): ISO timestamp
- `user_id` (string): User ID

---

## Common Fields Across All Components

All components include:

- `status`: "success" or error status
- `data.timestamp`: ISO timestamp string
- `data.user_id`: User ID for multi-tenancy validation
- `data.executiveSummary`: Executive summary (present in all components)

---

## Notes

1. **Multi-tenancy**: All responses should include `user_id` to ensure data isolation
2. **Timestamps**: All timestamps are in ISO 8601 format (UTC)
3. **Optional Fields**: Many fields are optional and may be empty strings or null
4. **Arrays**: Empty arrays `[]` are used when no data is available
5. **Objects**: Empty objects `{}` are used when no data is available
6. **Data Validation**: The frontend validates that `user_id` matches the current user before processing
