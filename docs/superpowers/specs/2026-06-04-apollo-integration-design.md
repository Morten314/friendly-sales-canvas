# Apollo.io Integration — Frontend Design Spec
**Date:** 2026-06-04
**Scope:** Frontend only
**Phase:** Apollo lead discovery + connection flow (enrichment and lookalike leads deferred)

---

## 1. Overview

This spec covers the frontend design for integrating Apollo.io into Brewra's Mission Control as a lead discovery source. The integration allows agents (Scout, Profiler, Signals) to work from Apollo-discovered leads in addition to manually uploaded CSV leads.

**In scope for this phase:**
- Apollo API key connection flow
- System warmup gate before discovery is available
- On-demand lead discovery triggered from Mission Control
- Apollo-sourced lead visibility in Scout, Profiler, and Signals
- All 10 use cases defined below

**Deferred to future phases:**
- Lead enrichment (Strategist phase)
- Lookalike lead discovery
- Stale data refresh / re-enrichment
- CRM-connected lead retroactive enrichment

---

## 2. Use Cases

| # | Use Case | Status |
|---|---|---|
| UC1 | No CSV — discover leads from Apollo based on ICP | In scope |
| UC2 | CSV upload + Apollo connected | In scope |
| UC3 | CSV only, no Apollo | Existing — unchanged |
| UC4 | Apollo activation gate — warmup sequence | In scope |
| UC5 | ICP change prompt | In scope |
| UC6 | ICP completeness gate | In scope |
| UC7 | Re-discovery guard | In scope |
| UC8 | Zero results handling | In scope |
| UC9 | API key health | In scope |
| UC10 | Low credit warning | In scope |

---

## 3. Apollo Connection Flow

**Entry point:** Mission Control → Data Sources → Connect a System → Apollo

A **single-step modal** opens containing:
- Apollo logo + one-line description of what it does in Brewra
- Helper link: *"Where do I find my API key?"* pointing to Apollo account settings
- API key input field
- Connect button

### Connection Validation Sequence

Two checks run in order on clicking Connect:

**Check 1 — Customer profile completeness**
- If the customer profile in Mission Control is not fully configured: show error message + button linking directly to the incomplete section
- Connection is blocked until resolved

**Check 2 — API key validity**
- If the key is invalid: show error message *"Invalid key — please check your Apollo account"*

**On both checks passing:**
- Modal transitions to success state: *"Apollo connected. Lead discovery will unlock once your agents are ready."*
- Dismiss button closes the modal
- Apollo tile appears in the Data Sources list in Locked state

---

## 4. Apollo Tile States

Apollo lives as a tile in Mission Control → Data Sources. It has five states.

A **settings (gear) icon** is present on the tile in all states, giving the user access to:
- **Update API key** — input field pre-filled masked (e.g. `••••••••3a9f`), user clears and enters a new key, same two-check validation runs on save (profile complete → key valid)
- **Disconnect Apollo** — removes the connection entirely with a confirmation prompt: *"Existing Apollo-sourced leads will remain in your pool but discovery will be unavailable until you reconnect."*

### 4.1 Locked
Apollo is connected but the warmup sequence is not yet complete.
- Progress indicator: *"X of 4 agents ready"*
- *"View what's remaining"* link pointing to incomplete warmup steps
- Discover Leads button not shown

### 4.2 Unlocked
All four warmup steps are complete. Discovery is available.
- *"Discovery ready"* status
- Active **Discover Leads** button
- If credits are low: persistent warning *"Your Apollo credits are running low"* shown alongside the button (UC10)

### 4.3 Running
Discovery is in progress.
- Spinner with *"Discovering leads…"* text
- Discover Leads button disabled

### 4.4 Complete
Discovery finished successfully.
- *"Discovery complete"* + timestamp of last run
- Discover Leads button restored

### 4.5 Error
Discovery failed (API error, credits exhausted, timeout).
- Error message: *"Discovery failed — check your Apollo credits"*
- Discover Leads button restored to allow retry

### Unlock Notification
When the tile transitions from Locked → Unlocked, a **toast notification** fires wherever the user is in the app:
*"Apollo discovery is now ready. Start finding leads."* with a link to Mission Control.

---

## 5. Warmup Sequence

Apollo discovery is locked until all four conditions are met. Each step must be completed in the system before the next is counted:

1. ICP fully configured in Mission Control
2. Signals generates its first set of signals
3. Scout completes its first market research run
4. Profiler completes its initial ICP analysis

All four steps must pass before the Apollo tile unlocks. This ensures the system has enough context to run a meaningful, high-quality ICP-driven search.

---

## 6. Discovery Flow

When the user clicks **Discover Leads** on the Apollo tile:

### Step 1 — Re-discovery Guard (UC7)
If the ICP has not changed since the last discovery run, a warning prompt appears:
> *"Your ICP hasn't changed since your last discovery on [date]. Running again may return the same leads. Continue anyway?"*

→ Yes / Cancel

### Step 2 — Existing Lead Management Prompt (UC5, when ICP has changed)
If the ICP was updated since the last run, a prompt appears before discovery runs:

```
"You have [N] Apollo-sourced leads from your previous discovery.
What would you like to do?

  ○ Keep existing leads + add new ones
  ○ Replace — remove old and start fresh
  ○ Download existing leads before replacing"

[ Cancel ]    [ Continue ]
```

### Step 3 — Discovery Runs
- Tile switches to Running state (spinner, button disabled)
- Backend job runs Apollo search using the active ICP from Mission Control
- Quality gate applied per lead — leads not meeting minimum data completeness are excluded silently
- Deduplication — leads already in the pool from CSV are skipped

### Step 4 — Completion
- **Success:** Tile updates to Complete state with timestamp. Leads enter the pool flagged as "Apollo-sourced". Scout, Profiler, and Signals consume them automatically.
- **Zero results (UC8):** Tile shows *"No leads found for your current ICP"* with a direct link to widen the ICP in Mission Control.
- **Error (UC9):** Tile shows error state with message and button restored.

---

## 7. Agent Views

Apollo-sourced leads flow automatically into Scout, Profiler, and Signals once discovery completes. **Mission Control is the single control point** — no Apollo controls exist on any agent page.

### Scout — Lead Stream
- Apollo-sourced leads appear in the existing lead table alongside CSV leads
- No visual difference on individual lead rows
- A **source filter** is added to the Lead Stream toolbar:
  - All leads
  - CSV only
  - Apollo only

### Profiler
- Apollo-sourced leads appear in the existing lead table
- Same source filter added to the toolbar
- Profiler uses the combined lead pool (CSV + Apollo) when suggesting new ICPs — no source distinction at this layer

### Signals
- Signals are generated from the combined lead pool
- No source distinction surfaced in the Signals feed

### Strategist (future phase — not in scope)
- Dynamic "Add Column" enrichment on the lead table
- Apollo enrichment capabilities surfaced grouped by: Contact Intelligence, Company Intelligence, Funding Intelligence, Intent & Signals
- Strategist interprets raw Apollo data agentically
- Credit cost shown before enrichment runs

---

## 8. Use Case Handling Summary

### UC1 — No CSV, Apollo discovery only
User connects Apollo → completes warmup → clicks Discover Leads → leads enter pool → Scout and Profiler populate from Apollo leads only.

### UC2 — CSV + Apollo
CSV upload flow unchanged. Apollo adds net-new leads on top. Source filter on Scout and Profiler lets user view CSV vs Apollo leads separately. Duplicates silently skipped.

### UC3 — CSV only
Existing flow completely unchanged. No Apollo UI visible unless the user connects it.

### UC4 — Apollo activation gate
Discover Leads button locked until all four warmup steps complete. Tile shows progress. Toast fires on unlock.

### UC5 — ICP change prompt
When ICP changes: toast fires immediately + tile shows *"ICP updated since last discovery"* badge. When user next clicks Discover Leads: prompt appears to handle existing Apollo leads (keep / replace / download before replacing).

### UC6 — ICP completeness gate
Apollo connection modal checks profile completeness before validating the API key. If incomplete: error message + direct link to the incomplete section. Connection blocked until resolved.

### UC7 — Re-discovery guard
If ICP unchanged since last run: warning prompt fires before discovery. User confirms to proceed or cancels.

### UC8 — Zero results
Tile updates to empty state: *"No leads found for your current ICP"* + direct link to ICP section in Mission Control to widen the search.

### UC9 — API key health
If key expires or is revoked: tile switches to error state with clear message. Existing Apollo-sourced leads in pool remain untouched. Discovery paused until key is fixed in Mission Control.

### UC10 — Low credit warning
When Apollo credits drop below threshold: persistent warning appears on the tile alongside the Discover Leads button. Visible before every run.

---

## 9. Out of Scope (This Phase)

| Item | Deferred To |
|---|---|
| Lead enrichment via Apollo | Strategist phase |
| Lookalike lead discovery | Later phase |
| Stale data refresh / re-enrichment | Later phase |
| Retroactive enrichment of pre-Apollo CSV leads | CRM integration phase |
| OAuth-based Apollo connection | Later phase (API key used for now) |
| Per-agent Apollo on/off controls | Not planned — single control point in Mission Control |
| Live progress during discovery (e.g. "47 leads found so far") | Not in scope — spinner only |

---

## 10. Open Decisions

| Decision | Status |
|---|---|
| Exact Apollo credit threshold for low credit warning | To be confirmed with Apollo API docs |
| Minimum lead completeness criteria for quality gate | Backend decision — to be defined by backend team |
| Maximum leads returned per discovery run | Backend decision — to be defined |
