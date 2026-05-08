# Scout API Request Body Schemas

This document contains the request body schemas sent to `/api/market-research` for all 5 Scout components during the working process.

**Note:** Company profile data is fetched by the backend using the `user_id`. The frontend only sends `user_id`, `component_name`, and refresh-related flags. The `data` key is kept but must be empty.

## API Endpoint
**POST** `/api/market-research`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

---

## 1. Market Size & Opportunity

**Component Name:** `"market size & opportunity"`

### Request Body Schema (from MarketResearch.tsx):
```json
{
  "user_id": "string (Firebase UID)",
  "component_name": "market size & opportunity",
  "data": {},
  "refresh": "boolean"
}
```

### Request Body Schema (from MarketSizeSection.tsx - Alternative):
```json
{
  "user_id": "string (Firebase UID)",
  "component_name": "market size & opportunity",
  "refresh": "boolean",
  "force_refresh": "boolean",
  "cache_bypass": "boolean",
  "bypass_all_cache": "boolean",
  "request_timestamp": "number (Unix timestamp)",
  "request_id": "string (random ID)",
  "data": {}
}
```

---

## 2. Industry Trends Report

**Component Name:** `"industry trends report"`

### Request Body Schema (from MarketResearch.tsx):
```json
{
  "user_id": "string (Firebase UID)",
  "component_name": "industry trends report",
  "data": {},
  "refresh": "boolean",
  "_forceRefresh": "boolean",
  "_timestamp": "number (Unix timestamp)",
  "_cacheBust": "string (random string)"
}
```

### Request Body Schema (from IndustryTrendsSection.tsx - Alternative):
```json
{
  "user_id": "string (Firebase UID)",
  "component_name": "industry trends report",
  "refresh": "boolean",
  "force_refresh": "boolean",
  "cache_bypass": "boolean",
  "bypass_all_cache": "boolean",
  "request_timestamp": "number (Unix timestamp)",
  "request_id": "string (random ID)",
  "data": {}
}
```

---

## 3. Regulatory & Compliance Highlights

**Component Name:** `"regulatory & compliance highlights"`

### Request Body Schema (from MarketResearch.tsx):
```json
{
  "user_id": "string (Firebase UID)",
  "component_name": "regulatory & compliance highlights",
  "data": {},
  "refresh": "boolean"
}
```

### Request Body Schema (from RegulatoryComplianceSection.tsx - Alternative):
```json
{
  "user_id": "string (Firebase UID)",
  "component_name": "regulatory & compliance highlights",
  "refresh": "boolean",
  "force_refresh": "boolean",
  "cache_bypass": "boolean",
  "bypass_all_cache": "boolean",
  "request_timestamp": "number (Unix timestamp)",
  "request_id": "string (random ID)",
  "data": {}
}
```

---

## 4. Competitor Landscape

**Component Name:** `"competitor landscape"`

### Request Body Schema (from MarketResearch.tsx):
```json
{
  "user_id": "string (Firebase UID)",
  "component_name": "competitor landscape",
  "data": {},
  "refresh": "boolean",
  "_timestamp": "number (Unix timestamp)",
  "_cache_bust": "string (random string)"
}
```

**Note:** The competitor landscape component uses a simpler payload structure with an empty `data` object.

---

## 5. Market Entry & Growth Strategy

**Component Name:** `"market entry & growth strategy"`

### Request Body Schema (from MarketResearch.tsx):
```json
{
  "user_id": "string (Firebase UID)",
  "component_name": "market entry & growth strategy",
  "data": {},
  "refresh": "boolean",
  "_forceRefresh": "boolean",
  "_timestamp": "number (Unix timestamp)",
  "_cacheBust": "string (random string)"
}
```

### Request Body Schema (from MarketEntrySection.tsx - Alternative):
```json
{
  "user_id": "string (Firebase UID)",
  "component_name": "Market Entry & Growth Strategy",
  "refresh": "boolean",
  "force_refresh": "boolean",
  "cache_bypass": "boolean",
  "bypass_all_cache": "boolean",
  "request_timestamp": "number (Unix timestamp)",
  "request_id": "string (random ID)",
  "data": {}
}
```

---

## Common Fields Summary

### Required Fields (All Components):
- `user_id`: Firebase user UID (string)
- `component_name`: One of the 5 component names (string)
- `data`: Object containing component-specific data

### Optional Fields (Varies by Component):
- `refresh`: Boolean to force refresh
- `force_refresh`: Boolean to force refresh (alternative naming)
- `cache_bypass`: Boolean to bypass cache
- `bypass_all_cache`: Boolean to bypass all cache
- `request_timestamp`: Unix timestamp (number)
- `request_id`: Random ID string
- `_timestamp`: Unix timestamp (number, alternative naming)
- `_cacheBust` / `_cache_bust`: Random string for cache busting
- `_forceRefresh`: Boolean to force refresh (alternative naming)

### Data Object:
- `data`: Must always be an empty object `{}`. Company profile data is fetched by the backend using `user_id`.

---

## Notes

1. **Component Name Variations**: 
   - Market Entry uses `"Market Entry & Growth Strategy"` (with capital letters) in MarketEntrySection.tsx, but `"market entry & growth strategy"` (lowercase) in MarketResearch.tsx

2. **Company Profile Handling**: 
   - Company profile data is fetched by the backend using the `user_id`
   - Frontend should NOT send any company profile data in the request
   - The `data` key must always be an empty object `{}`

3. **Payload Variations**: 
   - The main MarketResearch.tsx page uses a simpler structure
   - The individual component files (MarketSizeSection.tsx, MarketEntrySection.tsx, etc.) may include additional cache-busting fields

4. **Cache Busting**: 
   - Various components use different cache-busting mechanisms (`_timestamp`, `_cacheBust`, `_cache_bust`, `request_timestamp`, `request_id`)

