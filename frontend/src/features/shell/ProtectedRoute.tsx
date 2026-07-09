import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { NoOrgState, OrgReconnecting, OrgResolving } from "./OrgResolutionStates";

import { useAuth } from "@/shared/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Org-scoped surfaces: mount children ONLY on the has-org outcome. */
  requireOrg?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireOrg = false }) => {
  const { currentUser, loading: authLoading, orgStatus, retryOrgResolution } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return <OrgResolving />;
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireOrg) {
    // Gate on the HAS-ORG predicate, never on `orgResolved` alone (which is also
    // true for the no-org outcome) — spec 48 WS1a round-3 F3.
    if (orgStatus === "pending") return <OrgResolving />;
    if (orgStatus === "transient") return <OrgReconnecting onRetry={retryOrgResolution} />;
    if (orgStatus === "no-org") return <NoOrgState />;
    // orgStatus === "resolved" → fall through to children
  }

  return <>{children}</>;
};

export default ProtectedRoute;
