import { Route } from "react-router-dom";

import LoginPage from "./pages/LoginPage";

import { FeatureErrorBoundary } from "@/shared/components";

/** Auth route surface (public entry). Composed (append-only) by `src/app/routes.tsx`. */
export const authRoutes = [
  <Route
    key="root"
    path="/"
    element={
      <FeatureErrorBoundary featureName="Auth">
        <LoginPage />
      </FeatureErrorBoundary>
    }
  />,
  <Route
    key="login"
    path="/login"
    element={
      <FeatureErrorBoundary featureName="Auth">
        <LoginPage />
      </FeatureErrorBoundary>
    }
  />,
];
