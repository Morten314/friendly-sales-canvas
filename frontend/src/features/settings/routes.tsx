import { Route } from "react-router-dom";

import SettingsPage from "./pages/SettingsPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

/** Settings route surface. Composed (append-only) by `src/app/routes.tsx`. */
export const settingsRoutes = [
  <Route
    key="settings"
    path="/settings"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Settings">
          <SettingsPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
