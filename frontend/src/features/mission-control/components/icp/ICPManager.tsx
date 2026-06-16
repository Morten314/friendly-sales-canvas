import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import React, { useState, useEffect, useMemo, useRef } from "react";

import { useICPs } from "../../hooks/useICPs";
import type { ICP, FitConfidence } from "../../types";

import IcpList from "./IcpList";
import IcpWizard from "./IcpWizard";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { qk } from "@/shared/api/queryKeys";
import { apiFetch } from "@/shared/api/transport";
import { useAuthToken } from "@/shared/auth";
import { setUserLocalStorage, removeUserLocalStorage } from "@/shared/lib/cacheUtils";
import {
  buildCustomerProfileSavePayload,
  invalidateMissionControlCache,
  invalidateProfilerCache,
  mergeProfilerAcceptedIcpDisplay,
  removeProfilerAcceptedIcpDisplayMeta,
} from "@/shared/profiler";
import type { UntypedProfilerIcpRecord } from "@/shared/types/escape-hatches";

/** Map the local ICP view-model into the shared POST payload builder input. */
function icpsToApiRows(icps: ICP[]) {
  return icps.map((icp) => ({
    id: icp.id,
    primaryRegion: icp.primaryRegion,
    location: icp.location,
    industry: icp.industry,
    companySize: icp.companySize,
    buyerRole: icp.buyerRole,
    accountsOnWatchlist: icp.accountsOnWatchlist,
    accountsToAvoid: icp.accountsToAvoid,
    fitConfidence: icp.fitConfidence,
    additionalContext: icp.additionalContext,
    status: icp.status,
    createdAt: icp.createdAt,
  }));
}

const ICPManager: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser, orgId } = useAuthToken();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility
  const [icps, setIcps] = useState<ICP[]>([]);
  // While a local add/edit/delete is in flight, skip syncing from stale TanStack rows.
  const skipServerSyncRef = useRef(false);

  // ICP read: org's ICP rows via TanStack Query (raw rows; mapped below). The
  // query cache replaces the legacy imperative localStorage-fallback-on-error
  // and the cached-profile user_id-mismatch guard (see TD-FE-33). Writes (CRUD)
  // stay raw `fetch` + optimistic this phase — deferred.
  const {
    data: icpRows,
    isLoading,
    isFetching,
    isError,
    isSuccess,
  } = useICPs(currentUser?.uid ?? "", orgIdToUse);

  // Inline editing state — gates the wizard. `editingId` selects which saved ICP
  // seeds the wizard (edit mode); null = add mode.
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refreshIcpsFromServer = async () => {
    if (!currentUser?.uid) return;
    invalidateMissionControlCache(currentUser.uid, orgIdToUse);
    invalidateProfilerCache(currentUser.uid, orgIdToUse);
    await queryClient.refetchQueries({ queryKey: qk.icps(orgIdToUse) });
  };

  // Save customer profile (ICPs) to backend with retry logic
  const saveCustomerProfileToBackend = async (icpsToSave: ICP[], retryCount = 0) => {
    if (!currentUser?.uid) {
      return false;
    }

    if (icpsToSave.length === 0) {
      return true;
    }

    try {
      const payload = buildCustomerProfileSavePayload(icpsToApiRows(icpsToSave), orgIdToUse);

      try {
        setUserLocalStorage("customerProfile", JSON.stringify(icpsToSave), currentUser.uid);
        setUserLocalStorage("customerProfile_pending", JSON.stringify(payload), currentUser.uid);
      } catch {
        /* ignore */
      }

      const response = await apiFetch(`customer_profile?org_id=${encodeURIComponent(orgIdToUse)}`, {
        method: "POST",
        body: payload,
      });

      await response.json();

      try {
        setUserLocalStorage("customerProfile", JSON.stringify(icpsToSave), currentUser.uid);
        removeUserLocalStorage("customerProfile_pending", currentUser.uid);
      } catch {
        /* ignore */
      }

      await refreshIcpsFromServer();
      return true;
    } catch (error) {
      const isServerError =
        error instanceof Error && (error.message.includes("500") || error.message.includes("502"));
      if (isServerError && retryCount < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
        return saveCustomerProfileToBackend(icpsToSave, retryCount + 1);
      }

      const isNetworkError = error instanceof TypeError && error.message.includes("fetch");

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
      return false;
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
    if (skipServerSyncRef.current) return;
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
    // Silently drop duplicate ICP rows (same id) from API response.

    setIcps(dedupedICPs);
  }, [icpRows]);

  // Signal MissionControl that the ICP read has settled (backup for flows that
  // do not await refetchQueries in the page shell). Wait for an in-flight fetch
  // to finish — not merely cached isSuccess — so the loading dialog stays up.
  useEffect(() => {
    if (isFetching) return;
    if (isSuccess || isError || !currentUser?.uid) {
      window.dispatchEvent(new CustomEvent("icpManagerCustomerProfileLoadFinished"));
    }
  }, [isFetching, isSuccess, isError, currentUser?.uid]);

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
      toast({
        title: "ICP updated",
        description: "Your ICP has been updated successfully.",
      });
    } else {
      updatedICPs = [...icps, newICP];
      toast({
        title: "ICP saved",
        description: "Your ICP hypothesis has been saved.",
      });
    }

    skipServerSyncRef.current = true;
    setIcps(updatedICPs);
    try {
      const ok = await saveCustomerProfileToBackend(updatedICPs);
      if (!ok) {
        toast({
          title: "Save failed",
          description: "Could not persist your ICP to the server. Please try again.",
          variant: "destructive",
        });
        return;
      }
      window.dispatchEvent(new CustomEvent("customerProfileSaved"));
      handleCloseWizard();
    } finally {
      skipServerSyncRef.current = false;
    }
  };

  const handleEditICP = (icp: ICP) => {
    setEditingId(icp.id);
    setIsAddingInline(true);
  };

  const handleDeleteICP = async (id: string) => {
    const updatedICPs = icps.filter((icp) => icp.id !== id);

    skipServerSyncRef.current = true;
    setIcps(updatedICPs);
    removeProfilerAcceptedIcpDisplayMeta(id);

    try {
      const deleteRes = await apiFetch(
        `customer_profile/icp/${encodeURIComponent(id)}?org_id=${encodeURIComponent(orgIdToUse)}`,
        { method: "DELETE" },
      );
      await deleteRes.json();

      if (updatedICPs.length > 0) {
        await saveCustomerProfileToBackend(updatedICPs);
      } else {
        await refreshIcpsFromServer();
      }

      window.dispatchEvent(new CustomEvent("customerProfileSaved"));
      toast({
        title: "ICP deleted",
        description: "The ICP has been removed.",
      });
    } catch {
      toast({
        title: "Delete failed",
        description: "Could not remove the ICP on the server. Refresh and try again.",
        variant: "destructive",
      });
      await refreshIcpsFromServer();
    } finally {
      skipServerSyncRef.current = false;
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Loading Overlay */}
      {(isLoading || isFetching) && (
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
