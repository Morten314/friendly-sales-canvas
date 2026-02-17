import { useState } from "react";
import { SuggestedICPCards } from "./SuggestedICPCards";
import { useToast } from "@/hooks/use-toast";

interface SuggestedICP {
  id: string;
  name: string;
  type: 'refined' | 'new';
  [key: string]: any;
}

export const ICPIntelligence = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [acceptedICPs, setAcceptedICPs] = useState<SuggestedICP[]>([]);
  const { toast } = useToast();

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
