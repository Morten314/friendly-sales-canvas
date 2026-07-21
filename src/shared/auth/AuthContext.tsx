import type { User } from "firebase/auth";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import type { ReactNode } from "react";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

import { auth } from "./firebase";

import { buildApiUrl } from "@/shared/api/transport";

interface AuthContextType {
  currentUser: User | null;
  orgId: string | null;
  orgName: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchOrgId: (userId: string) => Promise<{ orgId: string | null; orgName: string | null }>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const signup = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    // Clear org_id and org_name on logout
    setOrgId(null);
    setOrgName(null);
    if (currentUser?.uid) {
      localStorage.removeItem(`org_id_${currentUser.uid}`);
      localStorage.removeItem(`org_name_${currentUser.uid}`);
    }
  };

  const fetchOrgId = useCallback(
    async (userId: string): Promise<{ orgId: string | null; orgName: string | null }> => {
      try {
        // Check localStorage first
        const storedOrgId = localStorage.getItem(`org_id_${userId}`);
        const storedOrgName = localStorage.getItem(`org_name_${userId}`);
        if (storedOrgId && storedOrgName) {
          setOrgId(storedOrgId);
          setOrgName(storedOrgName);
          return { orgId: storedOrgId, orgName: storedOrgName };
        }

        // Fetch from API
        const response = await fetch(`${buildApiUrl("org")}?user_id=${userId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          console.error("Failed to fetch org data:", response.status, response.statusText);
          return { orgId: null, orgName: null };
        }

        const data = await response.json();

        if (data.status === "success" && data.org_id) {
          // Store in state and localStorage
          const fetchedOrgId = data.org_id;
          const fetchedOrgName = data.org_name || null;

          setOrgId(fetchedOrgId);
          setOrgName(fetchedOrgName);
          localStorage.setItem(`org_id_${userId}`, fetchedOrgId);
          if (fetchedOrgName) {
            localStorage.setItem(`org_name_${userId}`, fetchedOrgName);
          }
          return { orgId: fetchedOrgId, orgName: fetchedOrgName };
        }

        return { orgId: null, orgName: null };
      } catch (error) {
        console.error("Error fetching org data:", error);
        return { orgId: null, orgName: null };
      }
    },
    [],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      // Load org_id and org_name from localStorage when user changes
      if (user?.uid) {
        const storedOrgId = localStorage.getItem(`org_id_${user.uid}`);
        const storedOrgName = localStorage.getItem(`org_name_${user.uid}`);
        if (storedOrgId) {
          setOrgId(storedOrgId);
          if (storedOrgName) {
            setOrgName(storedOrgName);
          }
        } else {
          // Fetch org data if not in localStorage
          void fetchOrgId(user.uid);
        }
      } else {
        setOrgId(null);
        setOrgName(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [fetchOrgId]);

  const value = {
    currentUser,
    orgId,
    orgName,
    login,
    signup,
    logout,
    fetchOrgId,
    loading,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
