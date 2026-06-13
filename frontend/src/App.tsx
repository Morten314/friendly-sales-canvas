import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { featureRoutes } from "@/app/routes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useApolloUnlockToast } from "@/features/connectors";
import { NotFound, PWAInstallPrompt, SidebarProvider } from "@/features/shell";
import { queryClient } from "@/shared/api/queryClient";
import { AuthProvider } from "@/shared/auth";
import { TenantProvider } from "@/shared/tenant";

function ApolloUnlockWatcher() {
  useApolloUnlockToast();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TenantProvider>
        <SidebarProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Routes>
                {featureRoutes}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            <Toaster />
            <Sonner />
            <ApolloUnlockWatcher />
            {/* Show fixed install button on login/signup pages */}
            <PWAInstallPrompt variant="fixed" />
          </TooltipProvider>
        </SidebarProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
