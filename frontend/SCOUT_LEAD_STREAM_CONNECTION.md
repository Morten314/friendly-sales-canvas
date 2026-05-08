# Scout & Lead Stream Connection — Implementation & Team Presentation Guide

## Overview

This document describes the UI implementation that connects **Lead Stream** with **Scout** functionality on the Scout page, and provides a guide for presenting this feature to your team.

---

## What Was Implemented

### 1. Lead Stream → Scout (Research with Scout)

**Location:** Scout page → Your Lead Stream tab

| Feature | Description |
|--------|-------------|
| **Ask Scout button** | Header button that switches to Chat with Scout tab. Use when you want to ask Scout about leads, find leads, or get market research. |
| **Research with Scout (per lead)** | Message icon on each lead row. Click to open Chat with Scout with that lead's company pre-loaded as context. Scout receives a prompt like: *"I'd like to research [Company] - their market position, competitors, and growth opportunities."* |
| **Empty state CTA** | When there are no leads, an "Ask Scout to find leads" button appears alongside "Upload CSV". |

### 2. Chat with Scout → Lead Stream

**Location:** Scout page → Chat with Scout tab

| Feature | Description |
|--------|-------------|
| **See leads in Lead Stream** | In the empty state (no active chat), a "See leads in Lead Stream" button switches to the Lead Stream tab. |
| **Lead context in chat** | When you arrive from Lead Stream (Ask Scout or Research with Scout), Scout opens with a contextual message based on the lead/company. |

### 3. Scout Deployment in Lead Stream

**Location:** Scout page → Your Lead Stream tab

When Scout is deployed (target market, industry, size, region), the **Scout Deployment Details** card appears at the top of the Lead Stream tab, reinforcing that Scout is finding leads based on your criteria.

---

## User Flows

### Flow A: Research a specific lead
1. User is in **Your Lead Stream**.
2. User clicks the **message icon** on a lead row (e.g., "Acme Corp").
3. App switches to **Chat with Scout** with context: *"I'd like to research Acme Corp - their market position, competitors, and growth opportunities."*
4. User continues the conversation with Scout.

### Flow B: Ask Scout about leads in general
1. User is in **Your Lead Stream**.
2. User clicks **Ask Scout** in the header.
3. App switches to **Chat with Scout**.
4. User can ask Scout to find leads, analyze markets, or get recommendations.

### Flow C: From Chat back to Lead Stream
1. User is in **Chat with Scout** (empty state, no active chat).
2. User clicks **See leads in Lead Stream**.
3. App switches to **Your Lead Stream** tab.

---

## Technical Summary

- **LeadStream** component: New `onAskScout` prop; when provided, shows Ask Scout button and per-lead Research action.
- **MarketResearch** page: Passes `onAskScout` to LeadStream; stores context in `sessionStorage` and switches to trends tab.
- **ScoutChatWithHistory**: Reads `leadStreamChatContext` from sessionStorage; creates a session with `leadContext` and passes `customMessage` to ScoutChatPanel.
- **ScoutChatPanel**: Uses `customMessage` prop when provided for contextual greeting.

---

## How to Present This to Your Team

### 1. Start with the problem

> "Lead Stream and Scout were separate tabs. Users had to manually switch and re-explain context. There was no way to research a lead with Scout or to jump from Scout back to Lead Stream."

### 2. Introduce the solution

> "We've connected Lead Stream and Scout so they work together. You can now research any lead with Scout in one click, ask Scout to help find leads, and move between Lead Stream and Chat with Scout without losing context."

### 3. Demo script (2–3 minutes)

1. **Open Scout page → Your Lead Stream tab**
   - Point out the **Ask Scout** button in the header.
   - If Scout is deployed, point out the deployment card at the top.

2. **Click Research on a lead**
   - Click the message icon on a lead row.
   - Show that Chat with Scout opens with context about that company.
   - Ask Scout a follow-up question to show the flow.

3. **Show the reverse flow**
   - Go to Chat with Scout.
   - If in empty state, show **See leads in Lead Stream**.
   - Click it and show the switch to Lead Stream.

4. **Empty state**
   - If you have no leads, show the "Ask Scout to find leads" option in the empty state.

### 4. Key talking points

| Point | Message |
|-------|---------|
| **Bidirectional** | "The connection works both ways: Lead Stream → Scout and Scout → Lead Stream." |
| **Context-aware** | "When you research a lead, Scout knows which company you're asking about." |
| **Low friction** | "One click from a lead row opens Scout with the right context." |
| **Cohesive experience** | "Scout deployment status is visible in Lead Stream so users see that Scout is actively finding leads." |

### 5. Future enhancements (optional)

- **Add to Lead Stream from Scout:** When Scout suggests companies, add an "Add to Lead Stream" action.
- **Shared filters:** Sync industry/size/region filters between Scout deployment and Lead Stream.
- **Scout insights on leads:** Show Scout-generated insights or scores on lead rows.

---

## Files Changed

- `src/components/market-research/LeadStream.tsx` — Ask Scout button, per-lead Research action, empty state CTA
- `src/components/signals/ScoutChatWithHistory.tsx` — Lead context handling, "See leads in Lead Stream" CTA
- `src/pages/MarketResearch.tsx` — `onAskScout` callback, Scout deployment in Lead Stream tab
