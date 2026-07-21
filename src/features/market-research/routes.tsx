import { Navigate, Route } from "react-router-dom";

import MarketResearchPage from "./pages/MarketResearchPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

/**
 * Market-research route surface. Composed (append-only) by `src/app/routes.tsx`.
 * Each entry carries a stable `key` so React's reconciler can identify the
 * elements when the array is rendered as `{featureRoutes}` (no "unique key"
 * warning). Self-imports use relative paths (`./pages/...`);
 * cross-feature deps come via index barrels (`@/features/shell`, `@/shared/...`).
 */
export const marketResearchRoutes = [
  <Route
    key="market-research-redirect"
    path="/market-research"
    element={<Navigate to="/your-ai-team/scout/marketintelligence" replace />}
  />,
  <Route
    key="scout-tab"
    path="/your-ai-team/scout/:tab"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Market Research">
          <MarketResearchPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
  <Route
    key="scout-index-redirect"
    path="/your-ai-team/scout"
    element={<Navigate to="/your-ai-team/scout/marketintelligence" replace />}
  />,
];
