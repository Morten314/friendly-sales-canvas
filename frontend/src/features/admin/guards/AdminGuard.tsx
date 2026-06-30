import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { isAdminEmail } from "../adminAllowlist";

import { useAuth } from "@/shared/auth";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div role="status" className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!currentUser || !isAdminEmail(currentUser.email)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
