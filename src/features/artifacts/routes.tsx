import { Route } from "react-router-dom";

import ArtifactsPage from "./pages/ArtifactsPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

export const artifactsRoutes = [
  <Route
    key="artifacts"
    path="/artifacts"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Artifacts">
          <ArtifactsPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
