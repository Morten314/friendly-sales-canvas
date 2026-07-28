import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

interface SidebarContextType {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <SidebarContext.Provider value={{ mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useAppSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useAppSidebar must be used within a SidebarProvider");
  }
  return context;
}
