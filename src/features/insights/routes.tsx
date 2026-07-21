import { Route } from "react-router-dom";

import InsightsPage from "./pages/InsightsPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

export const insightsRoutes = [
  <Route
    key="insights"
    path="/insights"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Insights">
          <InsightsPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
