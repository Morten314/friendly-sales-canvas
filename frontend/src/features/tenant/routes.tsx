import { Route } from "react-router-dom";

import TenantSelectionPage from "./pages/TenantSelectionPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

/** Tenant-selection route surface. Composed (append-only) by `src/app/routes.tsx`. */
export const tenantRoutes = [
  <Route
    key="tenant-selection"
    path="/tenant-selection"
    element={
      <ProtectedRoute>
        <FeatureErrorBoundary featureName="Tenant">
          <TenantSelectionPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
