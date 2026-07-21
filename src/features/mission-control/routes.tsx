import { Route } from "react-router-dom";

import MissionControlPage from "./pages/MissionControlPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

/** Mission-control route surface. Composed (append-only) by `src/app/routes.tsx`. */
export const missionControlRoutes = [
  <Route
    key="mission-control"
    path="/mission-control"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Mission Control">
          <MissionControlPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
