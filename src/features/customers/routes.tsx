import { Route } from "react-router-dom";

import CustomersPage from "./pages/CustomersPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

/** Customers route surface. Composed (append-only) by `src/app/routes.tsx`. */
export const customersRoutes = [
  <Route
    key="customers"
    path="/customers"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Customers">
          <CustomersPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
