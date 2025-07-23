
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Customers from "./pages/Customers";
import Deals from "./pages/Deals";
import Calendar from "./pages/Calendar";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import MarketResearch from "./pages/MarketResearch";
import Insights from "./pages/Insights";
import AgentHub from "./pages/AgentHub";
import ScoutDeploymentPage from "./pages/ScoutDeployment";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/agent-hub" replace />} />
          <Route path="/agent-hub" element={<AgentHub />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/market-research" element={<Navigate to="/your-ai-team/scout/marketintelligence" replace />} />
          <Route path="/your-lead-stream" element={<Navigate to="/your-ai-team/scout/leadstream" replace />} />
          <Route path="/your-ai-team/scout/:tab" element={<MarketResearch />} />
          <Route path="/your-ai-team/scout" element={<Navigate to="/your-ai-team/scout/marketintelligence" replace />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/scout-deployment" element={<ScoutDeploymentPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
      <Sonner />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
