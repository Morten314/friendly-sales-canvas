import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import PWAInstallPrompt from "./components/PWAInstallPrompt";
import Artifacts from "./pages/Artifacts";
import Calendar from "./pages/Calendar";
import Deals from "./pages/Deals";
import Insights from "./pages/Insights";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Reports from "./pages/Reports";
import ScoutDeploymentPage from "./pages/ScoutDeployment";
import Settings from "./pages/Settings";
import TenantSelection from "./pages/TenantSelection";

import { featureRoutes } from "@/app/routes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute, SidebarProvider } from "@/features/shell";
import { queryClient } from "@/shared/api/queryClient";
import { AuthProvider } from "@/shared/auth";
import { TenantProvider } from "@/shared/tenant";

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
                <Route
                  path="/tenant-selection"
                  element={
                    <ProtectedRoute>
                      <TenantSelection />
                    </ProtectedRoute>
                  }
                />

                {/* Protected routes that require both authentication and tenant selection */}
                <Route
                  path="/deals"
                  element={<Navigate to="/your-ai-team/strategist/workspace" replace />}
                />
                <Route
                  path="/your-ai-team/strategist/:tab"
                  element={
                    <ProtectedRoute requireTenant>
                      <Deals />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/your-ai-team/strategist"
                  element={<Navigate to="/your-ai-team/strategist/workspace" replace />}
                />
                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute requireTenant>
                      <Calendar />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute requireTenant>
                      <Reports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute requireTenant>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/insights"
                  element={
                    <ProtectedRoute requireTenant>
                      <Insights />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/artifacts"
                  element={
                    <ProtectedRoute requireTenant>
                      <Artifacts />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/scout-deployment"
                  element={
                    <ProtectedRoute requireTenant>
                      <ScoutDeploymentPage />
                    </ProtectedRoute>
                  }
                />
                {featureRoutes}
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
