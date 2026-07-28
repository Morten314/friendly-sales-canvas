import { Route } from "react-router-dom";

import SignalsPage from "./pages/SignalsPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

/** Signals route surface. Composed (append-only) by `src/app/routes.tsx`. */
export const signalsRoutes = [
  <Route
    key="signals"
    path="/signals"
    element={
      <ProtectedRoute requireOrg>
        <FeatureErrorBoundary featureName="Signals">
          <SignalsPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
  <Route
    key="agent-hub"
    path="/agent-hub"
    element={
      <ProtectedRoute requireOrg>
        <FeatureErrorBoundary featureName="Signals">
          <SignalsPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
