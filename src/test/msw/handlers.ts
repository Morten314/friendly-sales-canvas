// Spec 15 §3.2 — MSW handler set (minimal).
//
// Five handlers shipped at 0b:
//   1. Proof-of-pipeline GET /api/_health — used by msw-pipeline.test.ts to
//      assert MSW intercepts fetch under jsdom.
//   2. Firebase sign-in (identitytoolkit) — shape mirrors firebaseSignInResponse
//      from e2e/fixtures/auth.ts so the Vitest and Playwright layers agree.
//   3. Firebase token refresh (securetoken).
//   4. JWT mint POST /api/auth/token.
//   5. JWT refresh POST /api/auth/refresh.
//
// Per-feature handlers (market-research, mission-control, customers, signals,
// scout, settings) are NOT shipped here. They grow per feature as each surface
// adds handlers. Spec §3.2 last paragraph.
import { http, HttpResponse } from "msw";

export const handlers = [
  // 1. Proof-of-pipeline
  http.get("/api/_health", () => HttpResponse.json({ ok: true })),

  // 2. Firebase sign-in. MSW v2 ignores query strings by default, so this
  //    matches /accounts:signInWithPassword?key=API_KEY too. Shape matches
  //    firebaseSignInResponse from e2e/fixtures/auth.ts.
  http.post("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword", () =>
    HttpResponse.json({
      kind: "identitytoolkit#VerifyPasswordResponse",
      idToken: "mock_firebase_token",
      email: "test@brewra.test",
      localId: "test_user_123",
      registered: true,
      refreshToken: "mock_refresh_token",
      expiresIn: "3600",
    }),
  ),

  // 3. Firebase token refresh
  http.post("https://securetoken.googleapis.com/v1/token", () =>
    HttpResponse.json({
      access_token: "mock_firebase_token",
      id_token: "mock_firebase_token",
      refresh_token: "mock_refresh_token",
      expires_in: "3600",
      token_type: "Bearer",
      user_id: "test_user_123",
      project_id: "710721694093",
    }),
  ),

  // 4. JWT mint
  http.post("/api/auth/token", () =>
    HttpResponse.json({ access_token: "mock_jwt_token", expires_in: 3600 }),
  ),

  // 5. JWT refresh
  http.post("/api/auth/refresh", () =>
    HttpResponse.json({ access_token: "mock_jwt_token", expires_in: 3600 }),
  ),

  // 6. Market research — generic + market-entry + regulatory + industry-trends.
  http.post("/api/market-research_claude", async ({ request }) => {
    const body = (await request.json()) as { component_name?: string; user_id?: string };
    const name = body.component_name ?? "market size & opportunity";
    const lower = name.toLowerCase();

    // Error-path probe. A specific user_id on the competitor component
    // forces a 500 so the useCompetitorLandscape hook test can assert isError
    // propagation. Scoped to `competitor` so it can't intercept other sections'
    // tests that might reuse the same user_id.
    if (body.user_id === "competitor-error-user" && lower.includes("competitor")) {
      return new HttpResponse(null, { status: 500 });
    }

    // Market-entry section needs a realistically-shaped payload so
    // useMarketEntry can parse a non-trivial view-model. Match the
    // "market entry & growth strategy" component case-insensitively.
    if (lower === "market entry & growth strategy" || lower.includes("market entry")) {
      return HttpResponse.json({
        status: "success",
        data: {
          executiveSummary: "Test executive summary for market entry.",
          entryBarriers: ["High capital costs", "Established incumbents"],
          recommendedChannel: "Direct-to-consumer",
          timeToMarket: "6-9 months",
          topBarrier: "High capital costs",
          competitiveDifferentiation: ["Local sourcing", "Faster delivery"],
          strategicRecommendations: ["Pilot in one region", "Partner with distributors"],
          riskAssessment: ["Regulatory delay", "Supply volatility"],
          swot: {
            strengths: ["Brand recognition"],
            weaknesses: ["Limited footprint"],
            opportunities: ["Growing segment"],
            threats: ["Price competition"],
          },
        },
      });
    }

    // Industry-trends section needs a realistically-shaped payload so
    // useIndustryTrends can parse a non-trivial view-model. Match the
    // "industry trends report" component case-insensitively.
    if (lower === "industry trends report" || lower.includes("industry trends")) {
      return HttpResponse.json({
        status: "success",
        data: {
          executiveSummary: "AI adoption accelerating across enterprise verticals.",
          aiAdoption: "68% of enterprises piloting AI solutions in 2025.",
          cloudMigration: "Cloud-native architectures now dominant at 74% adoption.",
          regulatory: "EU AI Act compliance deadlines approaching for high-risk systems.",
          risks: ["Talent shortage in AI/ML roles", "Regulatory uncertainty in APAC"],
          trendSnapshots: [
            { title: "AI Adoption Rate", metric: "68%", type: "adoption" },
            { title: "Cloud Migration", metric: "74%", type: "performance" },
          ],
          recommendations: {
            primaryFocus: "Accelerate AI pilot programmes with defined ROI metrics.",
            marketEntry: "Target mid-market enterprises with proven AI use-cases.",
          },
          regionalHotspots: {
            "North America": "Leading AI investment, $120B in 2025.",
            Europe: "Regulatory-driven adoption with strong privacy focus.",
          },
          visualCharts: {
            aiAdoptionTrends: ["2023: 45%", "2024: 58%", "2025: 68%"],
            technologyBudgetAllocation: {
              AI: "32%",
              Cloud: "28%",
              Security: "20%",
              Other: "20%",
            },
          },
        },
      });
    }

    // Regulatory-compliance section needs a realistically-shaped payload.
    // Match the "regulatory & compliance highlights" component case-insensitively.
    if (lower === "regulatory & compliance highlights" || lower.includes("regulatory")) {
      return HttpResponse.json({
        status: "success",
        data: {
          keyUpdates: [{ title: "EU AI Act", description: "starts Q1 2026", tag: "New" }],
          visualDataCards: [
            {
              title: "Compliance Adoption Rates",
              chartType: "bar-chart",
              data: [{ name: "GDPR", value: 80 }],
            },
          ],
          regionalData: [{ region: "EU", deadline: "Q1 2026", requirements: "GDPR + AI Act" }],
          strategicRecommendations: {
            mitigateRegulatoryRisks: ["Conduct DPIA"],
            competitivePositioning: ["Lead on privacy"],
            goToMarketStrategy: ["EU-first launch"],
          },
        },
      });
    }

    // Competitor-landscape section needs a realistically-shaped
    // payload (4 scalars + a uiComponents array) so useCompetitorLandscape and
    // the container auto-hydrate test resolve a non-trivial view-model.
    if (lower === "competitor landscape" || lower.includes("competitor")) {
      return HttpResponse.json({
        status: "success",
        data: {
          executiveSummary: "Test executive summary for competitor landscape.",
          topPlayerShare: "42%",
          emergingPlayers: "7",
          fundingNews: ["Acme raises $20M Series B"],
          uiComponents: [
            { type: "section", tags: ["Acme Corp", "Globex"] },
            { type: "report", dataPoints: [{ label: "Market leader", value: "Acme Corp" }] },
          ],
        },
      });
    }

    // Market-size section needs a realistically-shaped payload so
    // useMarketSize can parse a non-trivial 9-field view-model. Match the
    // "market size & opportunity" component case-insensitively.
    if (lower === "market size & opportunity" || lower.includes("market size")) {
      return HttpResponse.json({
        status: "success",
        data: {
          // Echo the requested component_name like the generic branch, so the 5b
          // service test's ResearchComponentResponse round-trip assertion holds.
          component_name: name,
          executiveSummary: "Test executive summary for market size & opportunity.",
          tamValue: "$50B",
          samValue: "$12B",
          GrowthRate: "14%",
          strategicRecommendations: ["Expand enterprise sales", "Invest in SMB self-serve"],
          marketEntry: "Land-and-expand via mid-market beachhead accounts.",
          marketDrivers: ["Digital transformation budgets", "AI adoption tailwinds"],
          marketSizeBySegment: { Enterprise: "40%", SMB: "35%", Startup: "25%" },
          growthProjections: { "2024": "10", "2025": "14", "2026": "19" },
        },
      });
    }

    // All other components: preserve the existing generic 5b response.
    return HttpResponse.json({
      status: "success",
      data: {
        component_name: name,
        title: "Test",
        summary: "Test summary",
      },
    });
  }),

  // ── customers ────────────────────────────────────────────────────────────────
  // Profiler recommended-ICP read — now /api/v2/icp (Spec 34; was direct-host /icp).
  http.get("/api/v2/icp", () => HttpResponse.json({ items: [], total: 0, limit: 500, offset: 0 })),
  http.get("/api/customer_profile", () => HttpResponse.json({ icps: [] })),
  http.get("/api/profile/company", () => HttpResponse.json({})),
  http.post("/api/customer_profile", () => HttpResponse.json({ success: true })),
  http.post("/api/customer_profile/from_suggested_icp", () =>
    HttpResponse.json({ success: true, data: { id: "persisted-1" } }),
  ),
  http.delete("/api/customer_profile/icp/:icpId", () =>
    HttpResponse.json({ success: true, data: { deleted_icp_id: "x", remaining_count: 0 } }),
  ),
  http.delete("/api/icp/recommended/:icpId", () => HttpResponse.json({ success: true })),
  http.get("/api/v2/leads", () => HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 })),

  // ── signals ──────────────────────────────────────────────────────────────────
  // Shared by useSignalAsk / useSignalAction and the ContextChat substrate.
  http.post("/api/signal_ask_claude", () => HttpResponse.json({ answer: "ok" })),
  http.post("/api/signal_action", () => HttpResponse.json({ success: true })),
  // Page-only signals service (Task 9): read + batch-generate.
  http.get("/api/v2/fetch-signals", () =>
    HttpResponse.json({ items: [], total: 0, limit: 10, offset: 0 }),
  ),
  http.post("/api/generate-signals-batch_claude", () => HttpResponse.json({ signals: [] })),
  http.post("/api/icp-research_claude", async ({ request }) => {
    const body = (await request.json()) as { component_name?: string };
    return HttpResponse.json({
      status: "success",
      data: { component_name: body.component_name ?? "icp summary & market opportunity" },
    });
  }),

  // ── connectors / apollo ───────────────────────────────────────────────────────
  // Default handlers so any test mounting the app shell (ApolloUnlockWatcher)
  // does not hit onUnhandledRequest: "error".
  http.get("/api/connectors/apollo/status", () =>
    HttpResponse.json({
      connected: false,
      status: "disconnected",
      credits_consumed_total: 0,
      last_run_credits: 0,
      low_credit: false,
      icp_changed_since_last_discovery: false,
    }),
  ),
  http.get("/api/connectors/apollo/warmup", () =>
    HttpResponse.json({
      icp_configured: false,
      signals_generated: false,
      scout_completed: false,
      profiler_analyzed: false,
      ready_count: 0,
      unlocked: false,
      missing: [],
    }),
  ),
  http.post("/api/connectors/apollo/connect", () =>
    HttpResponse.json({ connected: true, status: "connected" }),
  ),
  http.post("/api/connectors/apollo/discover", () =>
    HttpResponse.json({ run_id: "mock-run", status: "queued" }),
  ),
  http.get("/api/connectors/apollo/discover/status", () =>
    HttpResponse.json({
      run_id: "mock-run",
      org_id: "o1",
      status: "completed",
      mode: "keep",
      counts: { searched: 0, created: 0, matched: 0, errors: [] },
      credits_consumed: 0,
      progress_percent: 100,
    }),
  ),

  // ── signals / lead-map ────────────────────────────────────────────────────────
  http.post("/api/signal-lead-map_claude", () =>
    HttpResponse.json({
      status: "success",
      data: { mapping: [], generated_at: "t", cached: false },
    }),
  ),
];
