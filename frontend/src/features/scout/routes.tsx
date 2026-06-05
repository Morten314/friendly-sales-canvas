import { Route } from "react-router-dom";

import ScoutDeploymentPage from "./pages/ScoutDeploymentPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

/** Scout route surface. Composed (append-only) by `src/app/routes.tsx`. */
export const scoutRoutes = [
  <Route
    key="scout-deployment"
    path="/scout-deployment"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Scout Deployment">
          <ScoutDeploymentPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
