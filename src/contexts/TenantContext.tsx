import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface Tenant {
  id: string;
  name: string;
  domain?: string;
  logo?: string;
}

interface TenantContextType {
  selectedTenant: Tenant | null;
  availableTenants: Tenant[];
  selectTenant: (tenant: Tenant) => void;
  clearTenant: () => void;
  setAvailableTenants: (tenants: Tenant[]) => void;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

interface TenantProviderProps {
  children: ReactNode;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const { currentUser, loading: authLoading } = useAuth();
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
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
    localStorage.removeItem('selectedTenant');
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
          setSelectedTenant(JSON.parse(storedTenant));
        } catch (error) {
          console.error('Error parsing stored tenant:', error);
          localStorage.removeItem(`selectedTenant_${currentUser.uid}`);
          setSelectedTenant(null);
        }
      } else {
        // Clear tenant if no stored tenant for this user
        setSelectedTenant(null);
      }
    } else {
      // Clear tenant when user logs out
      setSelectedTenant(null);
    }
    
    setLoading(false);
  }, [currentUser?.uid, authLoading]);

  const value = {
    selectedTenant,
    availableTenants,
    selectTenant,
    clearTenant,
    setAvailableTenants,
    loading
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};

