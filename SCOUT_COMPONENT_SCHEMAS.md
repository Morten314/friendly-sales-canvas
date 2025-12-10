# Scout Component API Request Schemas

This document contains the exact request body schemas for all 5 Scout components sent to `/api/market-research`.

**API Endpoint:** `POST /api/market-research`  
**Headers:** `Content-Type: application/json`

**Important:** The `data` key must always be an empty object `{}`. Company profile data is fetched by the backend using the `user_id`.

---

## 1. Market Size & Opportunity

**Component Name:** `"market size & opportunity"`

### Schema (Primary - from MarketResearch.tsx):
```json
{
  "user_id": "string (Firebase UID)",
  "component_name": "market size & opportunity",
  "data": {},
  "refresh": "boolean"
}
```

### Schema (Alternative - Initial Load):
```json
{
  "component_name": "market size & opportunity",
  "user_id": "string (Firebase UID)",
  "refresh": "boolean",
  "_timestamp": "number (Unix timestamp)",
  "_cache_bust": "string (random string)",
  "data": {}
}
```

**Fields:**
- `user_id` (required): Firebase user UID
- `component_name` (required): `"market size & opportunity"`
- `data` (required): Empty object `{}`
- `refresh` (optional): Boolean to force refresh
- `_timestamp` (optional): Unix timestamp for cache busting
- `_cache_bust` (optional): Random string for cache busting

---

## 2. Industry Trends Report

**Component Name:** `"industry trends report"`

### Schema:
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

**Fields:**
- `user_id` (required): Firebase user UID
- `component_name` (required): `"industry trends report"`
- `data` (required): Empty object `{}`
- `refresh` (optional): Boolean to force refresh
- `_forceRefresh` (optional): Boolean to force refresh (alternative)
- `_timestamp` (optional): Unix timestamp for cache busting
- `_cacheBust` (optional): Random string for cache busting

---

## 3. Regulatory & Compliance Highlights

**Component Name:** `"regulatory & compliance highlights"`

### Schema:
```json
{
  "user_id": "string (Firebase UID)",
  "component_name": "regulatory & compliance highlights",
  "data": {},
  "refresh": "boolean"
}
```

**Fields:**
- `user_id` (required): Firebase user UID
- `component_name` (required): `"regulatory & compliance highlights"`
- `data` (required): Empty object `{}`
- `refresh` (optional): Boolean to force refresh

---

## 4. Competitor Landscape

**Component Name:** `"competitor landscape"`

### Schema:
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

**Fields:**
- `user_id` (required): Firebase user UID
- `component_name` (required): `"competitor landscape"`
- `data` (required): Empty object `{}`
- `refresh` (optional): Boolean to force refresh (default: `true`)
- `_timestamp` (optional): Unix timestamp for cache busting
- `_cache_bust` (optional): Random string for cache busting

---

## 5. Market Entry & Growth Strategy

**Component Name:** `"market entry & growth strategy"`

### Schema:
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

**Fields:**
- `user_id` (required): Firebase user UID
- `component_name` (required): `"market entry & growth strategy"`
- `data` (required): Empty object `{}`
- `refresh` (optional): Boolean to force refresh
- `_forceRefresh` (optional): Boolean to force refresh (alternative)
- `_timestamp` (optional): Unix timestamp for cache busting
- `_cacheBust` (optional): Random string for cache busting

---

## Summary

### Required Fields (All Components):
- `user_id`: Firebase user UID (string)
- `component_name`: Component name (string) - see above for exact values
- `data`: Empty object `{}`

### Optional Fields (Varies by Component):
- `refresh`: Boolean to force refresh
- `_forceRefresh`: Boolean to force refresh (alternative naming)
- `_timestamp`: Unix timestamp (number) for cache busting
- `_cacheBust` / `_cache_bust`: Random string for cache busting

### Component Name Values:
1. `"market size & opportunity"`
2. `"industry trends report"`
3. `"regulatory & compliance highlights"`
4. `"competitor landscape"`
5. `"market entry & growth strategy"`

---

## Example Request

```bash
curl -X POST /api/market-research \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "abc123xyz",
    "component_name": "market size & opportunity",
    "data": {},
    "refresh": false
  }'
```









