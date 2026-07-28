import { Suspense } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { FeatureErrorBoundary } from "@/shared/components";

const link = ({ isActive }: { isActive: boolean }) =>
  `block rounded px-3 py-2 text-sm ${isActive ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`;

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Brewra Ops
        </p>
        <nav className="space-y-1">
          <NavLink to="/admin/tenants" className={link}>
            Tenants
          </NavLink>
          <NavLink to="/admin/registrations" className={link}>
            Registrations
          </NavLink>
          <NavLink to="/admin/health" className={link}>
            System Health
          </NavLink>
          <NavLink to="/admin/settings" className={link}>
            Settings
          </NavLink>
        </nav>
      </aside>
      <main className="flex-1 p-6">
        <FeatureErrorBoundary featureName="Admin">
          <Suspense fallback={<div className="p-6">Loading…</div>}>
            <Outlet />
          </Suspense>
        </FeatureErrorBoundary>
      </main>
    </div>
  );
}
