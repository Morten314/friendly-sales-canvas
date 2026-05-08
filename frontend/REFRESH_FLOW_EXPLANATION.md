# Refresh Flow Explanation

## What Happens When You Click Refresh

### Step 1: User Clicks Refresh Button
- `handleRefresh()` is called (line 9819 in MarketResearch.tsx)
- This calls `smartRefresh(true)` which:
  - Sets `isRefreshing = true`
  - Resets all component statuses to 'pending'
  - Clears some data (but not all)
  - Starts fetching data for all components

### Step 2: Child Components React to Refresh
- All child components have a `useEffect` that watches `isRefreshing`
- When `isRefreshing` becomes `true`, each component:
  - Resets its internal flags (`hasFetchedRef`, `hasTriedSwotFetchRef`)
  - Calls its own `fetchMarketEntryData(true)` function
  - Fetches fresh data from the API

### Step 3: Data Comes Back
- API responses update component state
- Parent component also updates its state
- Components merge API data with existing data

### Step 4: Refresh Completes
- `smartRefresh` sets `isRefreshing = false`
- This triggers ALL useEffects that depend on `isRefreshing` to run again

## THE PROBLEM: Infinite Refresh Loop

### Issue 1: Double useEffect Dependencies
The MarketEntrySection component has TWO useEffects watching `isRefreshing`:

1. **Lines 348-400**: Auto-fetch useEffect
   - Depends on: `[isRefreshing]`
   - Purpose: Check if data is needed and fetch it
   - Problem: Runs when `isRefreshing` changes from `true` → `false`

2. **Lines 403-416**: Refresh handler useEffect
   - Depends on: `[isRefreshing]`
   - Purpose: Handle refresh when parent triggers it
   - Problem: Also runs when `isRefreshing` changes from `true` → `false`

### Issue 2: The Loop
When refresh completes (`isRefreshing` becomes `false`):

1. First useEffect (348-400) runs
2. It checks: "Do I have data? Do I have SWOT?"
3. If SWOT is missing → triggers another fetch
4. This fetch might not return SWOT (or it gets filtered)
5. Component still doesn't have SWOT
6. Next render → checks again → triggers fetch again
7. **INFINITE LOOP**

### Issue 3: Data Inconsistency

**Why fields are inconsistent:**

1. **Race Conditions**:
   - Parent fetches data → updates its state
   - Child fetches data → updates its own state
   - They might get different data or update at different times
   - Props sync might overwrite API data

2. **Props Sync Overwriting**:
   - When parent updates props, child's props sync useEffect runs
   - If timing is wrong, it might overwrite fresh API data with stale props
   - This is why SWOT disappears - props don't have SWOT, so it gets cleared

3. **Multiple Data Sources**:
   - Parent state (`marketEntryData`)
   - Child state (`marketEntryData` in component)
   - Props (passed from parent)
   - localStorage (cached data)
   - All competing and overwriting each other

## The Fix

### Fix 1: Prevent Auto-Fetch After Refresh
The auto-fetch useEffect should NOT run when refresh completes. It should only:
- Run on initial mount
- Run when data is truly missing (not after a refresh)

### Fix 2: Better State Management
- Child component should trust parent's data during refresh
- Don't fetch independently if parent is refreshing
- Only fetch if parent data is missing

### Fix 3: Preserve SWOT Data
- Don't clear SWOT when props sync
- Only update SWOT if new valid SWOT data exists
- Preserve existing SWOT during state updates

