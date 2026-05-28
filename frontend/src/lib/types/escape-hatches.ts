/**
 * Phase 2a strict-TS escape hatches.
 *
 * Each entry must:
 *  1. Have a `// TODO(phase-13):` comment (greppable marker for the phase-13 audit).
 *  2. Cite the call site (file:line) where the escape is consumed.
 *  3. Provide a one-line justification for why proper typing was unreasonable
 *     during phase 2a (do NOT pin a specific future phase as the owner — the
 *     TODO marker is enough).
 *  4. Use the `Untyped*` type-name prefix.
 *
 * Spec 17 §3 Step 3 escape-hatches policy.
 */

// TODO(phase-13): replace with the report data union once backend contracts are typed.
// src/pages/MarketResearch.tsx:4472, :5384, :7019, :7268, :9225, :9305, :9357, :9409,
// :9465, :9839, :9883, :9927, :9971, :10019, :10080, :10141, :10202, :10555, :10599,
// :10643, :10687, :10731, :10965, :10977, :10989, :11001, :11013, :11025, :11037, :11049,
// :11184, :11268, :11348, :11428, :11508, :11592, :11676, :11752, :11902, :11914, :11926,
// src/components/market-research/MarketEntrySection.tsx:2216, :2277
// — useState setState callbacks accept `prev` shaped by untyped backend responses.
export type UntypedReportState = any;

// TODO(phase-13): replace with a UiComponent interface once the backend contract is defined.
// src/pages/MarketResearch.tsx:6778
// — `uiComponents[]` array items found via Array.find() from untyped backend payload.
export type UntypedUiComponent = any;

// TODO(phase-13): replace with a RegulatoryUpdate interface once the backend contract is defined.
// src/components/market-research/RegulatoryComplianceSection.tsx:1082, :1995
// — `keyDataPoints[]` (derived from `keyUpdates[]`) array items shaped by untyped backend payload.
export type UntypedRegulatoryUpdate = any;

// TODO(phase-13): replace with a VisualDataCard interface when card shape is contracted.
// src/components/market-research/RegulatoryComplianceSection.tsx:1174, :2055
// — `visualDataCards[]` array items shaped by untyped backend payload.
export type UntypedVisualDataCard = any;

// TODO(phase-13): replace with a RegionData interface when contract is defined.
// src/components/market-research/RegulatoryComplianceSection.tsx:1508, :2183
// — `regionalData[]` array items shaped by untyped backend payload.
export type UntypedRegionData = any;

// TODO(phase-13): replace with typed report-section payloads (paragraphs, barriers, diffs, recommendations, risks).
// src/components/market-research/MarketEntrySection.tsx:2934, :2977, :2992, :3008, :3022
// — MarketEntry report-section array items (executiveSummary lines, entryBarriers,
//   competitiveDifferentiation, strategicRecommendations, riskAssessment) shaped by untyped backend payload.
export type UntypedReportSection = any;
