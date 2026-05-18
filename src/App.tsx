
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { TenantProvider } from "./contexts/TenantContext";
import { SidebarProvider } from "./contexts/SidebarContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import TenantSelection from "./pages/TenantSelection";
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
import Signals from "./pages/Signals";
import MissionControl from "./pages/MissionControl";
import Artifacts from "./pages/Artifacts";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TenantProvider>
        <SidebarProvider>
          <TooltipProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              
              {/* Protected routes that require authentication only */}
              <Route path="/tenant-selection" element={
                <ProtectedRoute>
                  <TenantSelection />
                </ProtectedRoute>
              } />
              
              {/* Protected routes that require both authentication and tenant selection */}
              <Route path="/mission-control" element={
                <ProtectedRoute requireTenant>
                  <MissionControl />
                </ProtectedRoute>
              } />
              <Route path="/signals" element={
                <ProtectedRoute requireTenant>
                  <Signals />
                </ProtectedRoute>
              } />
              <Route path="/agent-hub" element={
                <ProtectedRoute requireTenant>
                  <Signals />
                </ProtectedRoute>
              } />
              <Route path="/customers" element={
                <ProtectedRoute requireTenant>
                  <Customers />
                </ProtectedRoute>
              } />
              <Route path="/deals" element={<Navigate to="/your-ai-team/strategist/board" replace />} />
              <Route path="/your-ai-team/strategist" element={<Navigate to="/your-ai-team/strategist/board" replace />} />
              <Route path="/your-ai-team/strategist/board" element={
                <ProtectedRoute requireTenant>
                  <Deals view="board" />
                </ProtectedRoute>
              } />
              <Route path="/your-ai-team/strategist/cohort/:cohortId" element={
                <ProtectedRoute requireTenant>
                  <Deals view="cohort" />
                </ProtectedRoute>
              } />
              <Route path="/your-ai-team/strategist/package/:packageId" element={
                <ProtectedRoute requireTenant>
                  <Deals view="package" />
                </ProtectedRoute>
              } />
              <Route path="/your-ai-team/strategist/:tab" element={<Navigate to="/your-ai-team/strategist/board" replace />} />
              <Route path="/calendar" element={
                <ProtectedRoute requireTenant>
                  <Calendar />
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute requireTenant>
                  <Reports />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute requireTenant>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/market-research" element={<Navigate to="/your-ai-team/scout/marketintelligence" replace />} />
              <Route path="/your-lead-stream" element={<Navigate to="/your-ai-team/scout/leadstream" replace />} />
              <Route path="/your-ai-team/scout/:tab" element={
                <ProtectedRoute requireTenant>
                  <MarketResearch />
                </ProtectedRoute>
              } />
              <Route path="/your-ai-team/scout" element={<Navigate to="/your-ai-team/scout/marketintelligence" replace />} />
              <Route path="/insights" element={
                <ProtectedRoute requireTenant>
                  <Insights />
                </ProtectedRoute>
              } />
              <Route path="/artifacts" element={
                <ProtectedRoute requireTenant>
                  <Artifacts />
                </ProtectedRoute>
              } />
              <Route path="/scout-deployment" element={
                <ProtectedRoute requireTenant>
                  <ScoutDeploymentPage />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <Toaster />
          <Sonner />
          {/* Show fixed install button on login/signup pages */}
          <PWAInstallPrompt variant="fixed" />
        </TooltipProvider>
        </SidebarProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
