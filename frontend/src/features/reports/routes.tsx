import { Route } from "react-router-dom";

import ReportsPage from "./pages/ReportsPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

export const reportsRoutes = [
  <Route
    key="reports"
    path="/reports"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Reports">
          <ReportsPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
