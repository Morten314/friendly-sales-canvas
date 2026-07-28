import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";

import AdminLayout from "./components/AdminLayout";
import { AdminGuard } from "./guards/AdminGuard";

// Lazy so the internal ops console is code-split out of the customer bundle (spec §2).
const TenantsOverviewPage = lazy(() => import("./pages/TenantsOverviewPage"));
const OrgDetailPage = lazy(() => import("./pages/OrgDetailPage"));
const RegistrationsPage = lazy(() => import("./pages/RegistrationsPage"));
const SystemHealthPage = lazy(() => import("./pages/SystemHealthPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

export const adminRoutes = [
  <Route
    key="admin"
    path="/admin"
    element={
      <AdminGuard>
        <AdminLayout />
      </AdminGuard>
    }
  >
    <Route index element={<Navigate to="/admin/tenants" replace />} />
    <Route path="tenants" element={<TenantsOverviewPage />} />
    <Route path="tenants/:orgId" element={<OrgDetailPage />} />
    <Route path="registrations" element={<RegistrationsPage />} />
    <Route path="health" element={<SystemHealthPage />} />
    <Route path="settings" element={<SettingsPage />} />
  </Route>,
];
