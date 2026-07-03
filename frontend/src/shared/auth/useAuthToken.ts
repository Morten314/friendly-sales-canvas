import { useEffect, useState } from "react";

import { useAuth as useFirebaseAuth } from "./AuthContext";
import jwtManager from "./jwt";
import { useOrgId } from "./useOrgId";

export const useAuthToken = () => {
  const firebaseAuth = useFirebaseAuth();
  const orgId = useOrgId();
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  // Generate JWT token when user is authenticated and org is resolved. The
  // token is not backend-validated (see CLAUDE.md "Auth reality check"); this
  // just keeps it consistent with the resolved org (spec 46 WS1 — never a
  // persisted/stale tenant).
  useEffect(() => {
    const generateToken = async () => {
      if (firebaseAuth.currentUser && orgId && !jwtToken) {
        setIsGeneratingToken(true);
        try {
          const token = await jwtManager.generateToken(firebaseAuth.currentUser, orgId ?? "");
          // Token generation is optional - null is acceptable
          if (token) {
            setJwtToken(token);
          } else {
            console.log("JWT token generation skipped (endpoint not available). This is optional.");
          }
        } catch (error) {
          // JWT is optional - don't log as error, just warn
          console.warn("JWT token generation failed (optional):", error);
        } finally {
          setIsGeneratingToken(false);
        }
      }
    };

    void generateToken();
  }, [firebaseAuth.currentUser, orgId, jwtToken]);

  // Clear JWT token when user logs out or org changes
  useEffect(() => {
    if (!firebaseAuth.currentUser || !orgId) {
      jwtManager.clearTokens();
      setJwtToken(null);
    }
  }, [firebaseAuth.currentUser, orgId]);

  const logout = async () => {
    jwtManager.clearTokens();
    setJwtToken(null);
    await firebaseAuth.logout();
  };

  return {
    ...firebaseAuth,
    orgId: firebaseAuth.orgId,
    orgName: firebaseAuth.orgName,
    jwtToken,
    isGeneratingToken,
    logout,
  };
};
