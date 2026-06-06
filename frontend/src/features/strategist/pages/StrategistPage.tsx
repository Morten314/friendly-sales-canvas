import { MessageSquare, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import StrategistLeadStream from "../components/StrategistLeadStream";
import StrategistRecommendations from "../components/StrategistRecommendations";
import StrategistWorkspace from "../components/StrategistWorkspace";
import type { StrategistContext } from "../types";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layout } from "@/features/shell";
import { usePageTitle } from "@/shared/hooks/usePageTitle";

const StrategistPage = () => {
  usePageTitle("🧭 Strategist - Brewra");
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab = tab || "workspace";
  const [context, setContext] = useState<StrategistContext | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("strategistContext");
      if (stored) {
        const parsed = JSON.parse(stored) as StrategistContext;
        setContext(parsed);
        sessionStorage.removeItem("strategistContext");
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
            {context?.leads?.length ? (
              <StrategistWorkspace
                leads={context.leads}
                opportunity={context?.opportunity}
                icp={context?.icp}
                triggerPrompt={context?.triggerPrompt || ""}
                onBack={() => navigate("/your-ai-team/scout/chatwithscout")}
              />
            ) : (
              <StrategistRecommendations />
            )}
          </TabsContent>

          <TabsContent value="leadstream" className="flex-1 mt-0 overflow-auto px-4 py-4">
            <StrategistLeadStream />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default StrategistPage;
