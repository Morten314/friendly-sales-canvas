import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Users } from "lucide-react";
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
  const { tab } = useParams<{ tab?: string }>();
  const activeTab = tab || "workspace";
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

  const handleTabChange = (value: string) => {
    navigate(`/your-ai-team/strategist/${value}`, { replace: true });
  };

  return (
    <Layout>
      <div className="animate-fade-in h-[calc(100vh-4rem)] flex flex-col">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
          <div className="px-4 pt-3 pb-0">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="workspace" className="gap-1.5 text-xs">
                <MessageSquare className="h-3.5 w-3.5" />
                Workspace
              </TabsTrigger>
              <TabsTrigger value="leadstream" className="gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5" />
                Your Lead Stream
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="workspace" className="flex-1 mt-0 overflow-hidden">
            <StrategistWorkspace
              leads={context?.leads || []}
              opportunity={context?.opportunity}
              icp={context?.icp}
              triggerPrompt={context?.triggerPrompt || ""}
              onBack={() => navigate('/your-ai-team/scout/chatwithscout')}
            />
          </TabsContent>

          <TabsContent value="leadstream" className="flex-1 mt-0 overflow-auto px-4 py-4">
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Users className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Your Lead Stream</p>
              <p className="text-xs mt-1 opacity-70">Coming soon — leads sent to Strategist will appear here.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Deals;
