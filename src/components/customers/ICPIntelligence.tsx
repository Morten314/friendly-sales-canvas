import { useState, useEffect } from "react";
import { SuggestedICPCards } from "./SuggestedICPCards";

interface SuggestedICP {
  id: string;
  name: string;
  type: 'refined' | 'new';
  [key: string]: any;
}

export const ICPIntelligence = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [acceptedICPs, setAcceptedICPs] = useState<SuggestedICP[]>([]);

  // Listen for Refresh button click from header - triggers recommended ICP generation
  useEffect(() => {
    const handleProfilerRefresh = () => {
      setRefreshTrigger((prev) => prev + 1);
    };
    window.addEventListener("profilerRefresh", handleProfilerRefresh);
    return () => window.removeEventListener("profilerRefresh", handleProfilerRefresh);
  }, []);

  const handleICPAccepted = (icp: SuggestedICP) => {
    setAcceptedICPs(prev => [...prev, icp]);
    window.dispatchEvent(new CustomEvent('icpAccepted', { detail: icp }));
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
