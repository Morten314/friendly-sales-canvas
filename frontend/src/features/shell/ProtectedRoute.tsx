import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/shared/auth";
import { useTenant } from "@/shared/tenant";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireTenant?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireTenant = false }) => {
  const { currentUser, loading: authLoading } = useAuth();
  const { selectedTenant, loading: tenantLoading, selectTenant } = useTenant();
  const location = useLocation();

  // Auto-select Brewra if tenant is required but not selected
  useEffect(() => {
    if (!authLoading && !tenantLoading && currentUser && requireTenant && !selectedTenant) {
      selectTenant({
        id: "brewra",
        name: "Brewra",
        domain: "brewra.com",
      });
    }
  }, [authLoading, tenantLoading, currentUser, requireTenant, selectedTenant, selectTenant]);

  // Show loading state while checking authentication or loading tenant
  if (authLoading || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If user is not authenticated, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If tenant is required but not selected yet, show loading while auto-selecting
  if (requireTenant && !selectedTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
