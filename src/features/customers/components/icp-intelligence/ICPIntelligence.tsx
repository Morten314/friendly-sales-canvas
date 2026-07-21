import { useState, useEffect } from "react";

import { SuggestedICPCards } from "./SuggestedICPCards";

import { useAuth } from "@/shared/auth";

// Structural subset of the full SuggestedICP shape defined in `SuggestedICPCards.tsx`.
// Only the fields this passthrough handler reads are listed; the full shape (extra
// fields like industry/segment/companySize) flows through opaquely via CustomEvent detail.
interface SuggestedICP {
  id: string;
  name: string;
  type: "refined" | "new";
}

export const ICPIntelligence = () => {
  const { currentUser } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Listen for Refresh button click from header - triggers recommended ICP generation
  useEffect(() => {
    const handleProfilerRefresh = () => {
      // Clear dedupe marker so each explicit Refresh can call GET /icp again. Without this,
      // sessionStorage keeps the last processed counter while React state resets on navigation,
      // so 0→1 after reload becomes "1 > 1" and the backend fetch + toast are skipped.
      const uid = currentUser?.uid;
      if (uid) {
        sessionStorage.removeItem(`profiler_icp_refresh_${uid}`);
        if (import.meta.env.DEV) {
          console.log(
            "[Profiler ICP] Header Refresh → cleared session dedupe key → bump refreshTrigger",
          );
        }
      } else if (import.meta.env.DEV) {
        console.warn(
          "[Profiler ICP] Refresh clicked but no user id yet — wait for auth; GET /icp will be skipped",
        );
      }
      setRefreshTrigger((prev) => prev + 1);
    };
    window.addEventListener("profilerRefresh", handleProfilerRefresh);
    return () => window.removeEventListener("profilerRefresh", handleProfilerRefresh);
  }, [currentUser?.uid]);

  const handleICPAccepted = (icp: SuggestedICP) => {
    window.dispatchEvent(new CustomEvent("icpAccepted", { detail: icp }));
  };

  const handleICPRejected = (_icp: SuggestedICP) => {
    // No system impact on rejection
  };

  return (
    <div className="space-y-6">
      <SuggestedICPCards
        onICPAccepted={handleICPAccepted}
        onICPRejected={handleICPRejected}
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
};
