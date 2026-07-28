import { useEffect, useState } from "react";

import { useAuth as useFirebaseAuth } from "./AuthContext";
import jwtManager from "./jwt";
import { useOrgId } from "./useOrgId";

export const useAuthToken = () => {
  const firebaseAuth = useFirebaseAuth();
  const orgId = useOrgId();
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  // Mint the JWT when the user + resolved org are present, and RE-MINT whenever
  // orgId changes — on the stale→fresh org flip this spec fixes (spec 46 WS1),
  // the token must not keep carrying the stale org. Clear it on logout / no org.
  // The token is not backend-validated (see CLAUDE.md "Auth reality check"); this
  // only keeps it consistent with the resolved org, never a persisted/stale
  // tenant. Keyed on [currentUser, orgId] with a cancel flag so an out-of-order
  // resolve can't set a stale token.
  useEffect(() => {
    if (!firebaseAuth.currentUser || !orgId) {
      jwtManager.clearTokens();
      setJwtToken(null);
      return;
    }

    let cancelled = false;
    setIsGeneratingToken(true);
    void jwtManager
      .generateToken(firebaseAuth.currentUser, orgId)
      .then((token) => {
        if (cancelled) return;
        // Token generation is optional - null is acceptable
        if (token) {
          setJwtToken(token);
        } else {
          console.log("JWT token generation skipped (endpoint not available). This is optional.");
        }
      })
      .catch((error) => {
        // JWT is optional - don't log as error, just warn
        if (!cancelled) console.warn("JWT token generation failed (optional):", error);
      })
      .finally(() => {
        if (!cancelled) setIsGeneratingToken(false);
      });

    return () => {
      cancelled = true;
    };
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
