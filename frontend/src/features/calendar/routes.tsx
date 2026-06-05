import { Route } from "react-router-dom";

import CalendarPage from "./pages/CalendarPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

export const calendarRoutes = [
  <Route
    key="calendar"
    path="/calendar"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Calendar">
          <CalendarPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
