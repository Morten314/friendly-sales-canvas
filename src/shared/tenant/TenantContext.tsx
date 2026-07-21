import type { ReactNode } from "react";
import React, { createContext, useContext, useState, useEffect } from "react";

import { useAuth } from "@/shared/auth";

export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  logo?: string;
}

interface TenantContextType {
  selectedTenant: Tenant | null;
  selectTenant: (tenant: Tenant) => void;
  clearTenant: () => void;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
};

interface TenantProviderProps {
  children: ReactNode;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const { currentUser, orgId, orgName, loading: authLoading } = useAuth();
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const selectTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    // Store in localStorage with user-specific key for persistence
    if (currentUser?.uid) {
      localStorage.setItem(`selectedTenant_${currentUser.uid}`, JSON.stringify(tenant));
    }
  };

  const clearTenant = () => {
    setSelectedTenant(null);
    // Clear tenant for all users (cleanup)
    if (currentUser?.uid) {
      localStorage.removeItem(`selectedTenant_${currentUser.uid}`);
    }
    // Also clear old format for backward compatibility
    localStorage.removeItem("selectedTenant");
  };

  // Load tenant from localStorage on mount or when user changes
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    setLoading(true);

    if (currentUser?.uid) {
      const storedTenant = localStorage.getItem(`selectedTenant_${currentUser.uid}`);
      if (storedTenant) {
        try {
          const parsedTenant = JSON.parse(storedTenant);
          // Update tenant name if org_name is available from AuthContext
          if (orgName && parsedTenant.id === orgId) {
            parsedTenant.name = orgName;
            setSelectedTenant(parsedTenant);
            // Update localStorage with the latest org_name
            localStorage.setItem(`selectedTenant_${currentUser.uid}`, JSON.stringify(parsedTenant));
          } else {
            setSelectedTenant(parsedTenant);
          }
        } catch (error) {
          console.error("Error parsing stored tenant:", error);
          localStorage.removeItem(`selectedTenant_${currentUser.uid}`);
          setSelectedTenant(null);
        }
      } else if (orgId && orgName) {
        // If no stored tenant but we have org_id and org_name from AuthContext, set it
        const tenant = {
          id: orgId,
          name: orgName,
          domain: `${orgId}.com`,
        };
        setSelectedTenant(tenant);
        localStorage.setItem(`selectedTenant_${currentUser.uid}`, JSON.stringify(tenant));
      } else {
        // Clear tenant if no stored tenant for this user
        setSelectedTenant(null);
      }
    } else {
      // Clear tenant when user logs out
      setSelectedTenant(null);
    }

    setLoading(false);
  }, [currentUser?.uid, authLoading, orgId, orgName]);

  const value = {
    selectedTenant,
    selectTenant,
    clearTenant,
    loading,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};
