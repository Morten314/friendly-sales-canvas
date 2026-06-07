import { useState } from "react";

import type { DataSource } from "./connectorTypes";

import type { useToast } from "@/components/ui/use-toast";

type ToastFn = ReturnType<typeof useToast>["toast"];

/**
 * Generic credential-auth modal hook — the shared 5-state + 3-handler
 * (Login / Approve / Deny) 2-step pattern used by the credential-based
 * connectors (Salesforce, HubSpot, Pipedrive, Zoho, LinkedIn, X).
 *
 * PARITY: this is a behaviour-preserving unification of seven per-platform
 * state-groups + handler-triplets that were byte-identical modulo the
 * per-platform values parameterised below. The only per-platform divergences
 * are: `objectsSynced` (a value or a resolver, so LinkedIn's Company-vs-Sales
 * Navigator branch is reproduced exactly), `filters`, and the success/deny
 * toast copy (`successTitle` may be a resolver for LinkedIn's dynamic title).
 *
 * NOTE: Mixpanel is intentionally NOT driven by this hook — its connected
 * mock-data uses a different numeric profile (fixed event count + different
 * random ranges), so it remains a bespoke handler-triplet in the parent.
 */
interface UseCredentialAuthModalArgs {
  onDataSourcesChange: React.Dispatch<React.SetStateAction<DataSource[]>>;
  toast: ToastFn;
  /** Per-platform object list, or a resolver for source-dependent lists. */
  objectsSynced: string[] | ((source: DataSource) => string[]);
  /** Per-platform filter list applied on connect. */
  filters: string[];
  /** Success-toast title, or a resolver for a source-dependent title. */
  successTitle: string | ((source: DataSource) => string);
  /** Success-toast description shown on approve. */
  successDescription: string;
  /** Deny-toast description shown when access is denied. */
  denyDescription: string;
}

interface UseCredentialAuthModalResult {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sourceToConnect: DataSource | null;
  setSourceToConnect: React.Dispatch<React.SetStateAction<DataSource | null>>;
  email: string;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  password: string;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  isLoggingIn: boolean;
  authStep: "login" | "permissions";
  /** Closes the modal and clears all form/auth state to its initial values. */
  reset: () => void;
  handleLogin: () => Promise<void>;
  handleApprove: () => void;
  handleDeny: () => void;
}

export function useCredentialAuthModal({
  onDataSourcesChange,
  toast,
  objectsSynced,
  filters,
  successTitle,
  successDescription,
  denyDescription,
}: UseCredentialAuthModalArgs): UseCredentialAuthModalResult {
  const [isOpen, setIsOpen] = useState(false);
  const [sourceToConnect, setSourceToConnect] = useState<DataSource | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authStep, setAuthStep] = useState<"login" | "permissions">("login");

  // Close modal and reset form — mirrors the verbatim per-platform reset blocks.
  const reset = () => {
    setIsOpen(false);
    setEmail("");
    setPassword("");
    setSourceToConnect(null);
    setAuthStep("login");
  };

  const handleLogin = async () => {
    if (!sourceToConnect) return;

    if (!email || !password) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsLoggingIn(true);

    // Simulate login process, then show permissions screen
    setTimeout(() => {
      setIsLoggingIn(false);
      setAuthStep("permissions");
    }, 1500);
  };

  const handleApprove = () => {
    if (!sourceToConnect) return;

    const resolvedObjectsSynced =
      typeof objectsSynced === "function" ? objectsSynced(sourceToConnect) : objectsSynced;
    const resolvedTitle =
      typeof successTitle === "function" ? successTitle(sourceToConnect) : successTitle;

    // Update data source to connected
    onDataSourcesChange((prev) =>
      prev.map((s) => {
        if (s.id === sourceToConnect.id) {
          const mockData = {
            status: "connected" as const,
            account: email,
            connectedDate: new Date().toISOString().split("T")[0],
            lastSyncTime: "Just now",
            lastSyncStatus: "success" as const,
            totalRecords: Math.floor(Math.random() * 5000) + 100,
            newRecordsThisWeek: Math.floor(Math.random() * 100),
            updatedRecords: Math.floor(Math.random() * 50),
            dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
            objectsSynced: resolvedObjectsSynced,
            fieldsMapped: Math.floor(Math.random() * 50) + 20,
            filters,
          };
          return { ...s, ...mockData };
        }
        return s;
      }),
    );

    // Close modal and reset form
    reset();

    toast({
      title: resolvedTitle,
      description: successDescription,
    });
  };

  const handleDeny = () => {
    // Close modal and reset form
    reset();

    toast({
      title: "Connection not authorized",
      description: denyDescription,
      variant: "default",
    });
  };

  return {
    isOpen,
    setIsOpen,
    sourceToConnect,
    setSourceToConnect,
    email,
    setEmail,
    password,
    setPassword,
    isLoggingIn,
    authStep,
    reset,
    handleLogin,
    handleApprove,
    handleDeny,
  };
}
