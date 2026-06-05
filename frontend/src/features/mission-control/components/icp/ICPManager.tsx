import { Plus } from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";

import { useICPs } from "../../hooks/useICPs";
import type { ICP, FitConfidence } from "../../types";

import IcpList from "./IcpList";
import IcpWizard from "./IcpWizard";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type { UntypedProfilerIcpRecord } from "@/lib/types/escape-hatches";
import { setUserLocalStorage, removeUserLocalStorage } from "@/shared/lib/cacheUtils";
import {
  mergeProfilerAcceptedIcpDisplay,
  removeProfilerAcceptedIcpDisplayMeta,
} from "@/shared/profiler";

const ICPManager: React.FC = () => {
  const { toast } = useToast();
  const { currentUser, orgId } = useAuth();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility
  const [icps, setIcps] = useState<ICP[]>([]);

  // ICP read: org's ICP rows via TanStack Query (raw rows; mapped below). The
  // query cache replaces the legacy imperative localStorage-fallback-on-error
  // and the cached-profile user_id-mismatch guard (see TD-FE-33). Writes (CRUD)
  // stay raw `fetch` + optimistic this phase — deferred.
  const {
    data: icpRows,
    isLoading,
    isError,
    isSuccess,
  } = useICPs(currentUser?.uid ?? "", orgIdToUse);

  // Inline editing state — gates the wizard. `editingId` selects which saved ICP
  // seeds the wizard (edit mode); null = add mode.
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Save customer profile (ICPs) to backend with retry logic
  const saveCustomerProfileToBackend = async (icpsToSave: ICP[], retryCount = 0) => {
    if (!currentUser?.uid) {
      console.warn("Cannot save customer profile: User not authenticated");
      // Save to localStorage as fallback
      try {
        setUserLocalStorage("customerProfile", JSON.stringify(icpsToSave), currentUser?.uid);
      } catch (e) {
        console.error("Failed to save to localStorage:", e);
      }
      return;
    }

    try {
      // Prepare payload with customer profile data
      const payload = {
        org_id: orgIdToUse,
        icps: icpsToSave.map((icp) => ({
          id: icp.id,
          primary_region: icp.primaryRegion,
          location: Array.isArray(icp.location) ? icp.location : [],
          industry: Array.isArray(icp.industry) ? icp.industry : [],
          company_size: Array.isArray(icp.companySize) ? icp.companySize : [],
          buyer_role: Array.isArray(icp.buyerRole) ? icp.buyerRole : [],
          accounts_on_watchlist: Array.isArray(icp.accountsOnWatchlist)
            ? icp.accountsOnWatchlist
            : [],
          accounts_to_avoid: Array.isArray(icp.accountsToAvoid) ? icp.accountsToAvoid : [],
          fit_confidence: icp.fitConfidence || "medium",
          additional_context: icp.additionalContext || "",
          status: icp.status || "saved",
          created_at: icp.createdAt instanceof Date ? icp.createdAt.toISOString() : icp.createdAt,
        })),
      };

      console.log("=== ICP MANAGER: Saving customer profile to backend ===");
      console.log("User ID:", currentUser.uid);
      console.log("ICPs to save:", icpsToSave);
      console.log("Payload:", JSON.stringify(payload, null, 2));
      // Debug: Check location field specifically
      payload.icps.forEach((icp, index) => {
        console.log(
          `ICP ${index} location field:`,
          icp.location,
          "Type:",
          typeof icp.location,
          "IsArray:",
          Array.isArray(icp.location),
        );
      });

      // Always save to localStorage first as backup
      try {
        setUserLocalStorage("customerProfile", JSON.stringify(icpsToSave), currentUser.uid);
        setUserLocalStorage("customerProfile_pending", JSON.stringify(payload), currentUser.uid);
      } catch (e) {
        console.warn("Failed to save to localStorage:", e);
      }

      const apiUrl = `/api/customer_profile?org_id=${orgIdToUse}`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);

        // Retry for 500 errors (server/database issues) up to 2 times
        if (response.status === 500 && retryCount < 2) {
          console.log(`Retrying save (attempt ${retryCount + 1}/2)...`);
          await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
          return saveCustomerProfileToBackend(icpsToSave, retryCount + 1);
        }

        throw new Error(`Failed to save customer profile: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("✅ Customer profile saved successfully to backend");
      console.log("Response data:", JSON.stringify(data, null, 2));

      // Save to localStorage for offline access and refresh persistence
      try {
        setUserLocalStorage("customerProfile", JSON.stringify(icpsToSave), currentUser.uid);
        console.log("ICPManager: Saved customer profile to localStorage");
      } catch (e) {
        console.warn("Failed to save to localStorage:", e);
      }

      // Clear pending flag on success
      try {
        removeUserLocalStorage("customerProfile_pending", currentUser.uid);
      } catch (e) {
        console.warn("Failed to clear pending flag:", e);
      }
    } catch (error) {
      console.error("Error saving customer profile:", error);

      // Determine error message based on error type
      const isNetworkError = error instanceof TypeError && error.message.includes("fetch");
      const isServerError = error instanceof Error && error.message.includes("500");

      if (isServerError || isNetworkError) {
        toast({
          title: "Backend temporarily unavailable",
          description:
            "Your customer profile has been saved locally and will sync automatically when the backend is available.",
          variant: "default",
        });
      } else {
        toast({
          title: "Save warning",
          description:
            "Customer profile saved locally but failed to sync with backend. Please try again later.",
          variant: "destructive",
        });
      }
    }
  };

  // Map the raw ICP rows from `useICPs` into the local `ICP[]` view-model
  // whenever the query data changes. The mapping + dedup-by-id are preserved
  // byte-for-byte from the legacy imperative loader; only the source of the rows
  // changed (raw `fetch` → TanStack Query). Keeping `icps` in local state lets
  // the optimistic write handlers (`setIcps`) keep working.
  //
  // The profiler-merge (`mergeProfilerAcceptedIcpDisplay`) lives here by design.
  // Plan-25 T21 named a `ProfilerMergeView` component for this; it was
  // intentionally NOT created — the merge is a container data-transform with no
  // extractable render region (it shapes rows, it does not render UI). See the
  // mission-control feature README.
  useEffect(() => {
    if (!Array.isArray(icpRows)) return;
    if (icpRows.length === 0) {
      setIcps([]);
      return;
    }

    const loadedICPs: ICP[] = icpRows.map((icp: UntypedProfilerIcpRecord) => {
      const merged = mergeProfilerAcceptedIcpDisplay(icp);
      return {
        id: String(merged.icp_id || merged.id || `icp-${Date.now()}-${Math.random()}`),
        primaryRegion: merged.primary_region || merged.primaryRegion || "",
        location: Array.isArray(merged.location) ? merged.location : [],
        industry: Array.isArray(merged.industry) ? merged.industry : [],
        companySize: Array.isArray(merged.company_size)
          ? merged.company_size
          : Array.isArray(merged.companySize)
            ? merged.companySize
            : [],
        buyerRole: Array.isArray(merged.buyer_role)
          ? merged.buyer_role
          : Array.isArray(merged.buyerRole)
            ? merged.buyerRole
            : [],
        accountsOnWatchlist: Array.isArray(merged.accounts_on_watchlist)
          ? merged.accounts_on_watchlist
          : Array.isArray(merged.accountsOnWatchlist)
            ? merged.accountsOnWatchlist
            : [],
        accountsToAvoid: Array.isArray(merged.accounts_to_avoid)
          ? merged.accounts_to_avoid
          : Array.isArray(merged.accountsToAvoid)
            ? merged.accountsToAvoid
            : [],
        fitConfidence: (merged.fit_confidence || merged.fitConfidence || "medium") as FitConfidence,
        additionalContext: merged.additional_context || merged.additionalContext || "",
        status: merged.status || "saved",
        createdAt: merged.created_at
          ? new Date(merged.created_at)
          : merged.createdAt
            ? new Date(merged.createdAt)
            : new Date(),
      };
    });

    const uniqueById = new Map<string, ICP>();
    for (const icp of loadedICPs) {
      if (!uniqueById.has(icp.id)) uniqueById.set(icp.id, icp);
    }
    const dedupedICPs = Array.from(uniqueById.values());
    if (dedupedICPs.length !== loadedICPs.length) {
      console.warn("ICPManager: Dropped duplicate ICP rows (same id) from API response.", {
        before: loadedICPs.length,
        after: dedupedICPs.length,
      });
    }

    setIcps(dedupedICPs);
  }, [icpRows]);

  // Signal MissionControl that the ICP read has settled so it can clear its
  // "syncing customer profile" spinner. The legacy loader fired this in its
  // `finally` (and on the no-user early return); the query's settled state is
  // the replacement. Fires once the query resolves (success or error) or when
  // it is disabled (no authenticated user / org).
  useEffect(() => {
    if (isSuccess || isError || !currentUser?.uid) {
      window.dispatchEvent(new CustomEvent("icpManagerCustomerProfileLoadFinished"));
    }
  }, [isSuccess, isError, currentUser?.uid]);

  // Stable `initial` reference for the wizard: only changes identity when the
  // selected ICP (or the underlying row set) changes, so the wizard's
  // `useEffect([initial])` does not re-seed on every container render.
  const editingIcp = useMemo(() => icps.find((i) => i.id === editingId) ?? null, [editingId, icps]);

  const handleStartAdd = () => {
    setEditingId(null);
    setIsAddingInline(true);
  };

  const handleCloseWizard = () => {
    setEditingId(null);
    setIsAddingInline(false);
  };

  // Persistence callback: the wizard assembles + validates and emits the ICP;
  // the container owns the optimistic list update, backend save, toast, and the
  // `customerProfileSaved` dispatch — byte-faithful to the legacy handleSaveICP.
  const handleWizardSaved = async (newICP: ICP, isEdit: boolean) => {
    let updatedICPs: ICP[];
    if (isEdit) {
      updatedICPs = icps.map((icp) => (icp.id === newICP.id ? newICP : icp));
      setIcps(updatedICPs);
      toast({
        title: "ICP updated",
        description: "Your ICP has been updated successfully.",
      });
    } else {
      updatedICPs = [...icps, newICP];
      setIcps(updatedICPs);
      toast({
        title: "ICP saved",
        description: "Your ICP hypothesis has been saved.",
      });
    }

    // Save to backend
    await saveCustomerProfileToBackend(updatedICPs);

    // Dispatch event to notify MissionControl that customer profile is saved
    window.dispatchEvent(new CustomEvent("customerProfileSaved"));

    handleCloseWizard();
  };

  const handleEditICP = (icp: ICP) => {
    setEditingId(icp.id);
    setIsAddingInline(true);
  };

  const handleDeleteICP = async (id: string) => {
    console.log("[ICPManager] DELETE customer_profile/icp: request", {
      icp_id: id,
      org_id: orgIdToUse,
    });
    const updatedICPs = icps.filter((icp) => icp.id !== id);
    setIcps(updatedICPs);
    removeProfilerAcceptedIcpDisplayMeta(id);

    try {
      const deleteRes = await apiFetch(
        `customer_profile/icp/${encodeURIComponent(id)}?org_id=${encodeURIComponent(orgIdToUse)}`,
        { method: "DELETE" },
      );
      const deleteBody = await deleteRes.json();
      console.log("[ICPManager] DELETE customer_profile/icp: response body", deleteBody);
      if (deleteBody?.success && deleteBody?.data) {
        console.log(
          "[ICPManager] DELETE customer_profile/icp: deleted_icp_id=",
          deleteBody.data.deleted_icp_id,
          "remaining_count=",
          deleteBody.data.remaining_count,
        );
      }
    } catch (e) {
      console.warn(
        "[ICPManager] DELETE customer_profile/icp: failed (local state already updated)",
        e,
      );
    }

    await saveCustomerProfileToBackend(updatedICPs);

    window.dispatchEvent(new CustomEvent("customerProfileSaved"));

    toast({
      title: "ICP deleted",
      description: "The ICP has been removed.",
    });
  };

  return (
    <div className="space-y-6 relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex gap-2">
            <div
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "0ms", animationDuration: "1.4s" }}
            ></div>
            <div
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "200ms", animationDuration: "1.4s" }}
            ></div>
            <div
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "400ms", animationDuration: "1.4s" }}
            ></div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Customer Profile</h3>
          <p className="text-sm text-muted-foreground">
            Define your Ideal Customer Profiles (ICPs) for agent targeting
          </p>
        </div>
        {icps.length > 0 && !isAddingInline && (
          <Button onClick={handleStartAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add ICP
          </Button>
        )}
      </div>

      {/* Inline Edit Form */}
      {isAddingInline && (
        <IcpWizard
          initial={editingIcp ?? undefined}
          onSaved={handleWizardSaved}
          onCancel={handleCloseWizard}
        />
      )}

      {/* Empty state (no ICPs, wizard closed) and the saved-ICP table */}
      <IcpList
        icps={icps}
        onEdit={handleEditICP}
        onDelete={handleDeleteICP}
        isAddingInline={isAddingInline}
        onStartAdd={handleStartAdd}
      />

      {/* Add Another ICP */}
    </div>
  );
};

export default ICPManager;
