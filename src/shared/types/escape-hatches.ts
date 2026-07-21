/**
 * Phase 2a strict-TS escape hatches.
 *
 * Each entry must:
 *  1. Have a `// TODO:` comment (greppable marker for the escape-hatch audit).
 *  2. Cite the call site (file:line) where the escape is consumed.
 *  3. Provide a one-line justification for why proper typing was unreasonable
 *     during phase 2a (do NOT pin a specific future phase as the owner — the
 *     TODO marker is enough).
 *  4. Use the `Untyped*` type-name prefix.
 *
 * Spec 17 §3 Step 3 escape-hatches policy.
 *
 * The file itself disables `no-explicit-any` because every entry here is
 * intentionally an `any` alias — the audit signal is the `Untyped*` name plus
 * the `TODO` marker, not the rule fire.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

// TODO: replace with the report data union once backend contracts are typed.
// src/pages/MarketResearch.tsx:4472, :5384, :7019, :7268, :9225, :9305, :9357, :9409,
// :9465, :9839, :9883, :9927, :9971, :10019, :10080, :10141, :10202, :10555, :10599,
// :10643, :10687, :10731, :10965, :10977, :10989, :11001, :11013, :11025, :11037, :11049,
// :11184, :11268, :11348, :11428, :11508, :11592, :11676, :11752, :11902, :11914, :11926,
// src/components/market-research/MarketEntrySection.tsx:2216, :2277
// — useState setState callbacks accept `prev` shaped by untyped backend responses.
export type UntypedReportState = any;

// TODO: replace with a UiComponent interface once the backend contract is defined.
// src/pages/MarketResearch.tsx:6778
// — `uiComponents[]` array items found via Array.find() from untyped backend payload.
export type UntypedUiComponent = any;

// TODO: replace with a RegulatoryUpdate interface once the backend contract is defined.
// src/components/market-research/RegulatoryComplianceSection.tsx:1082, :1995
// — `keyDataPoints[]` (derived from `keyUpdates[]`) array items shaped by untyped backend payload.
export type UntypedRegulatoryUpdate = any;

// TODO: replace with a VisualDataCard interface when card shape is contracted.
// src/components/market-research/RegulatoryComplianceSection.tsx:1174, :2055
// — `visualDataCards[]` array items shaped by untyped backend payload.
export type UntypedVisualDataCard = any;

// TODO: replace with a RegionData interface when contract is defined.
// src/components/market-research/RegulatoryComplianceSection.tsx:1508, :2183
// — `regionalData[]` array items shaped by untyped backend payload.
export type UntypedRegionData = any;

// TODO: replace with typed report-section payloads (paragraphs, barriers, diffs, recommendations, risks).
// src/components/market-research/MarketEntrySection.tsx:2934, :2977, :2992, :3008, :3022
// — MarketEntry report-section array items (executiveSummary lines, entryBarriers,
//   competitiveDifferentiation, strategicRecommendations, riskAssessment) shaped by untyped backend payload.
export type UntypedReportSection = any;

// TODO: replace with the customer_profile ICP contract once backend types
// it. The shape mixes snake/camel aliases (`primary_region` vs `primaryRegion`,
// `company_size` vs `companySize`, etc.) and is consumed by `mergeProfilerAcceptedIcpDisplay`,
// `buildCustomerProfileSavePayload`, and friends — plus their callers in
// `src/components/mission-control/ICPManager.tsx` and
// `src/components/customers/SuggestedICPCards.tsx`. Tightening to
// `Record<string, unknown>` requires typing those call-site `merged.X || merged.Y`
// patterns first.
export type UntypedProfilerIcpRecord = any;

// TODO: replace with concrete UserProfile/AgentProfile/CompanyProfile interfaces
// once the backend customer_profile contract is defined.
// src/features/settings/components/UserProfile.tsx:24, src/features/settings/components/AgentProfile.tsx:19,
// src/features/settings/components/CompanyProfile.tsx (companyProfileData prop).
// — Props receive untyped JSON from backend; tightening to `Record<string, unknown>`
// cascades into ~10 TS2322 errors at `setX(profileData?.field)` consumer sites.
export type UntypedBackendProfile = any;

// TODO: replace with a DocumentRecord interface once the backend
// document-status / list-documents contract is typed.
// src/components/mission-control/DataSourcesManager.tsx:449
// — `documents.map((doc: any) => ...)` consumer reads ~20 fields with snake/camel
// aliases (file_id, file_key/fileKey, name/file_name, tags as array|string, etc.).
// Tightening to `Record<string, unknown>` would require narrowing every field access.
export type UntypedBackendDocument = any;

// TODO: replace with a typed backend ApiResponse envelope once the
// component-response contract is defined.
// src/pages/MarketResearch.tsx:253 (validateApiResponseUserId), :1913 (transformReportData),
// :1254, :1277, :1299, :1315, :1336 (localStorage save callbacks),
// :3793 (uiComponentsData bag) — payloads have nested `data?.user_id`, `report?.user_id`,
// snake/camel field aliases, and mixed shapes from many endpoints.
export type UntypedBackendApiResponse = any;

// TODO: replace with a CascadeContext interface once the cascading
// refresh contract between component fetches is typed.
// src/pages/MarketResearch.tsx:2551, :2747, :2842, :3168, :3401, :3665, :3995
// — `previousContext` accumulates prior component responses as keys keyed by
// displayName; the schema is "whatever upstream components returned".
export type UntypedCascadeContext = any;

// TODO: replace with a Lead interface once the strategist lead-stream
// contract is typed.
// src/pages/MarketResearch.tsx:382 (handleChatWithScout), :1530, :1533 (handleSendToStrategist)
// — leads flow from multiple sources (lead-stream API, market-research components,
// strategist persistence) with no single shape.
export type UntypedLead = any;

// TODO: replace with a VisualDataCardRaw interface once the regulatory
// card-data contract is typed.
// src/pages/MarketResearch.tsx:3490, :3499, :3512, :3522
// — `transformVisualDataCards` accepts raw cards with type-discriminated `data`
// arrays (bar-chart / timeline / percentage) and maps each to a UI-shaped object.
export type UntypedVisualDataCardRaw = any;

// TODO: replace with a BackendSignal interface once the
// /api/generate-signals-batch and /api/signals contracts are typed.
// src/features/signals/pages/SignalsPage.tsx:271, :273, :576
// — Raw signal objects from backend mix snake/camel aliases (`signal_id` vs `id`,
// `NBAs`, `nextBestMoves`, `contextualSuggestions`, `source` as array or string) and
// are consumed across `buildSignalCardsFromFetchData` and inline console.log mappings.
// Tightening to `Record<string, unknown>` would require narrowing every field access.
export type UntypedBackendSignal = any;
