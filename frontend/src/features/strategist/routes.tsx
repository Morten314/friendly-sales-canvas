import { Navigate, Route } from "react-router-dom";

import StrategistPage from "./pages/StrategistPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

/** Strategist route surface (incl. redirects). Composed append-only by `src/app/routes.tsx`. */
export const strategistRoutes = [
  <Route
    key="strategist-tab"
    path="/your-ai-team/strategist/:tab"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Strategist">
          <StrategistPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
  <Route
    key="strategist-root"
    path="/your-ai-team/strategist"
    element={<Navigate to="/your-ai-team/strategist/workspace" replace />}
  />,
  <Route
    key="deals-redirect"
    path="/deals"
    element={<Navigate to="/your-ai-team/strategist/workspace" replace />}
  />,
];
