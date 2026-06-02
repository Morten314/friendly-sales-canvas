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
// scout, settings) are NOT shipped here. They grow per feature in Phases 5–10
// as unit tests need them. Spec §3.2 last paragraph.
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

  // 6. Market research — Phase 5b (generic) + Phase 5d (market-entry shape).
  http.post("/api/market-research", async ({ request }) => {
    const body = (await request.json()) as { component_name?: string };
    const name = body.component_name ?? "market size & opportunity";

    // Phase 5d: market-entry section needs a realistically-shaped payload so
    // useMarketEntry can parse a non-trivial view-model. Match the
    // "market entry & growth strategy" component case-insensitively.
    const lower = name.toLowerCase();
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

    // Phase 5e: regulatory-compliance section needs a realistically-shaped payload.
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
];
