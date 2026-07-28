---
name: Strategist Cohort Architecture
description: Direct landing shows agentic cohort table (Strike Now/Nurture/Educate); contextual entry from Scout/Profiler skips to auto-generated workspace
type: feature
---
Strategist has three entry points with different behaviors:

1. **Direct landing** (`/your-ai-team/strategist/workspace` with no context) → renders `StrategistCohortTable` showing pre-built plays grouped by Urgency × Opportunity: Strike Now (Tier 1), Nurture (Tier 2), Educate (Tier 3).
2. **From Scout Lead Stream** → sessionStorage `strategistContext` is set, skips cohort table, lands on `StrategistWorkspace` with auto-generated strategy.
3. **From Profiler Lead Stream** → same pattern as Scout entry.

Cohort table structure (agentic = each row's actions actually do work):
- Columns: Cohort | Leads (count + source chips) | Play & Signal | Confidence | Action
- Primary CTA per row: "Launch Sequence" / "Build Campaign" / "Queue Awareness" — sets strategistContext and navigates to workspace
- Overflow menu: Refine Strategy, View Leads, Send to Artefacts, Ask Strategist
- Expandable rows reveal strategy reasoning + lead list with ICP fit % and origin

Background intelligence treatment:
- `StrategistSyncBreadcrumbs` (always visible): "Last synced 2m ago · Scout · Profiler · Mission Control" with counts
- `StrategistWhatsNewBanner` (dismissible, persisted in localStorage `strategistWhatsNewDismissed`): change summary on landing

Data layer: `src/components/strategist/cohortData.ts` derives cohorts from `heatmapLeads`, simulates Profiler ICP fit % and Scout/Profiler origin attribution per lead.
