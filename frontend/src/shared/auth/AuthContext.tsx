import type { User } from "firebase/auth";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import type { ReactNode } from "react";
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

import { auth } from "./firebase";

import { buildApiUrl } from "@/shared/api/transport";

/**
 * Org-resolution outcome (spec 48 WS1a). `pending` is the pre-resolution state;
 * `resolved` = has an org (real GET /org success OR a warm cache surviving a
 * transient blip); `no-org` = authoritative 404 / 2xx-without-org (onboarding
 * gap); `transient` = timeout/5xx/network with NO usable cache (reconnecting).
 * The route gate (ProtectedRoute requireOrg) mounts org-scoped UI ONLY on the
 * has-org predicate `orgResolved && orgId` — never on `orgResolved` alone.
 */
export type OrgStatus = "pending" | "resolved" | "no-org" | "transient";

const GET_ORG_TIMEOUT_MS = 9000; // per-attempt hard ceiling (a cold Render free instance can exceed 8s)
const GET_ORG_MAX_ATTEMPTS = 3; // bounded auto-retry; after this, sit in `transient` with a manual retry
const GET_ORG_RETRY_BASE_MS = 400; // linear backoff base: 400ms, 800ms between attempts

interface AuthContextType {
  currentUser: User | null;
  orgId: string | null;
  orgName: string | null;
  orgStatus: OrgStatus;
  orgResolved: boolean;
  retryOrgResolution: () => void;
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

type OrgOutcome =
  | { kind: "org"; orgId: string; orgName: string | null }
  | { kind: "no-org" }
  | { kind: "transient" };

/** One GET /org attempt, bounded by an AbortController timeout. Never throws. */
async function attemptGetOrg(userId: string): Promise<OrgOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GET_ORG_TIMEOUT_MS);
  try {
    const response = await fetch(`${buildApiUrl("org")}?user_id=${userId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    if (response.status === 404) return { kind: "no-org" };
    if (!response.ok) return { kind: "transient" }; // 5xx / other non-2xx
    const data = await response.json();
    if (data.status === "success" && data.org_id) {
      return { kind: "org", orgId: data.org_id, orgName: data.org_name || null };
    }
    return { kind: "no-org" }; // 2xx but no usable org → authoritative onboarding gap
  } catch {
    return { kind: "transient" }; // network error or timeout (abort)
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgStatus, setOrgStatus] = useState<OrgStatus>("pending");
  const [loading, setLoading] = useState(true);
  // Bumped on every user change / logout so a late-arriving resolution for a
  // superseded user is discarded instead of mutating state for the wrong user
  // (spec 48 WS1a stale-async guard).
  const orgGenerationRef = useRef(0);

  const signup = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    orgGenerationRef.current += 1; // invalidate any in-flight resolution
    await signOut(auth);
    setOrgId(null);
    setOrgName(null);
    setOrgStatus("pending");
    if (currentUser?.uid) {
      localStorage.removeItem(`org_id_${currentUser.uid}`);
      localStorage.removeItem(`org_name_${currentUser.uid}`);
    }
  };

  const resolveOrg = useCallback(
    async (userId: string): Promise<{ orgId: string | null; orgName: string | null }> => {
      const generation = orgGenerationRef.current;
      const isStale = () => orgGenerationRef.current !== generation;

      // Optimistic cache: a warm cached org paints instantly AND survives a
      // transient confirm-failure (spec 48 WS1a round-3 F1).
      const cachedOrgId = localStorage.getItem(`org_id_${userId}`);
      const cachedOrgName = localStorage.getItem(`org_name_${userId}`);
      const haveCache = Boolean(cachedOrgId);
      if (haveCache) {
        setOrgId(cachedOrgId);
        setOrgName(cachedOrgName);
        setOrgStatus("resolved"); // provisional resolved on the cached org
      } else {
        setOrgStatus("pending");
      }

      for (let attempt = 1; attempt <= GET_ORG_MAX_ATTEMPTS; attempt++) {
        const outcome = await attemptGetOrg(userId);
        if (isStale()) return { orgId: cachedOrgId, orgName: cachedOrgName };

        if (outcome.kind === "org") {
          setOrgId(outcome.orgId);
          setOrgName(outcome.orgName);
          setOrgStatus("resolved");
          localStorage.setItem(`org_id_${userId}`, outcome.orgId);
          if (outcome.orgName) localStorage.setItem(`org_name_${userId}`, outcome.orgName);
          else localStorage.removeItem(`org_name_${userId}`);
          return { orgId: outcome.orgId, orgName: outcome.orgName };
        }

        if (outcome.kind === "no-org") {
          // Authoritative: a real 404 / 2xx-without-org overrides any cache.
          setOrgId(null);
          setOrgName(null);
          setOrgStatus("no-org");
          localStorage.removeItem(`org_id_${userId}`);
          localStorage.removeItem(`org_name_${userId}`);
          return { orgId: null, orgName: null };
        }

        // transient: keep a warm cache mounted (no teardown); otherwise show
        // the reconnecting state while we retry.
        if (!haveCache) setOrgStatus("transient");
        if (attempt < GET_ORG_MAX_ATTEMPTS) {
          await sleep(GET_ORG_RETRY_BASE_MS * attempt);
          if (isStale()) return { orgId: cachedOrgId, orgName: cachedOrgName };
        }
      }

      // Auto-retry ceiling reached, still transient.
      if (haveCache) {
        setOrgStatus("resolved"); // warm cache survives; do not tear down
        return { orgId: cachedOrgId, orgName: cachedOrgName };
      }
      setOrgStatus("transient"); // reconnecting / manual retry
      return { orgId: null, orgName: null };
    },
    [],
  );

  // Back-compat alias: useLogin awaits this after form login.
  const fetchOrgId = resolveOrg;

  const retryOrgResolution = useCallback(() => {
    const user = auth.currentUser;
    if (user?.uid) void resolveOrg(user.uid);
  }, [resolveOrg]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      orgGenerationRef.current += 1; // supersede any in-flight resolution
      setCurrentUser(user);
      if (user?.uid) {
        setOrgStatus("pending");
        void resolveOrg(user.uid);
      } else {
        setOrgId(null);
        setOrgName(null);
        setOrgStatus("pending");
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [resolveOrg]);

  const orgResolved = orgStatus === "resolved" || orgStatus === "no-org";

  const value = {
    currentUser,
    orgId,
    orgName,
    orgStatus,
    orgResolved,
    retryOrgResolution,
    login,
    signup,
    logout,
    fetchOrgId,
    loading,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
