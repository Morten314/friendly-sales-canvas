import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import StrategistWorkspace from "@/components/market-research/StrategistWorkspace";

interface StrategistContext {
  leads: { name: string; company: string; jobTitle: string; email?: string; tenure?: string; source?: string; signals?: string[] }[];
  opportunity?: string;
  icp?: string;
  triggerPrompt: string;
}

const Deals = () => {
  usePageTitle("🧭 Strategist - Brewra");
  const navigate = useNavigate();
  const [context, setContext] = useState<StrategistContext | null>(null);

  // Pick up context from Scout handoff
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('strategistContext');
      if (stored) {
        const parsed = JSON.parse(stored) as StrategistContext;
        setContext(parsed);
        sessionStorage.removeItem('strategistContext');
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  return (
    <Layout>
      <div className="animate-fade-in h-[calc(100vh-4rem)] flex flex-col">
        <StrategistWorkspace
          leads={context?.leads || []}
          opportunity={context?.opportunity}
          icp={context?.icp}
          triggerPrompt={context?.triggerPrompt || ""}
          onBack={() => navigate('/your-ai-team/scout/chatwithscout')}
        />
      </div>
    </Layout>
  );
};

export default Deals;
