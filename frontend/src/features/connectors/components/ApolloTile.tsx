import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useApolloStatus } from "../hooks/useApolloStatus";
import { useApolloWarmup } from "../hooks/useApolloWarmup";
import { useDisconnectApollo } from "../hooks/useDisconnectApollo";
import { useDiscover } from "../hooks/useDiscover";
import { useDiscoverStatus } from "../hooks/useDiscoverStatus";
import { useExportApolloLeads } from "../hooks/useExportApolloLeads";
import { selectDiscoveryPrompt } from "../lib/discoveryPrompt";
import { deriveApolloTileState } from "../lib/tileState";
import { ApolloDiscoverError } from "../services/apollo";
import type { DiscoverMode } from "../types";

import { ApolloConnectModal } from "./ApolloConnectModal";
import { ApolloManageMenu } from "./ApolloManageMenu";
import { DisconnectApolloDialog } from "./DisconnectApolloDialog";
import { ReDiscoveryGuard, KeepReplaceDownloadPrompt } from "./DiscoveryDialogs";
import { LowCreditWarning } from "./LowCreditWarning";
import { WarmupProgress } from "./WarmupProgress";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/shared/auth";

const MC_PATH = "/mission-control";

export function ApolloTile() {
  const { orgId: rawOrgId, currentUser } = useAuth();
  const orgId = rawOrgId ?? "";
  const userId = currentUser?.uid ?? "";
  const navigate = useNavigate();
  const { toast } = useToast();

  const statusQ = useApolloStatus(orgId);
  const status = statusQ.data;
  const connected = !!status?.connected;

  const warmupQ = useApolloWarmup(orgId, userId, { connected });
  const warmup = warmupQ.data;

  const [runId, setRunId] = useState<string | null>(null);
  const discoverStatusQ = useDiscoverStatus(orgId, runId);
  const run = discoverStatusQ.data;

  const discover = useDiscover(orgId);
  const exportLeads = useExportApolloLeads(orgId);

  const [modal, setModal] = useState<"none" | "connect" | "update">("none");
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [prompt, setPrompt] = useState<"none" | "guard" | "keep_replace">("none");

  const disconnect = useDisconnectApollo(orgId);

  function onConfirmDisconnect() {
    disconnect.mutate(undefined, {
      onSuccess: () => {
        setDisconnectOpen(false);
        // Clear discovery-local state so useDiscoverStatus stops polling the now-disconnected org
        // (spec §5.3; mirrors the launch() clear). Status invalidation in the hook flips the tile.
        setRunId(null);
        setPrompt("none");
        toast({ title: "Apollo disconnected." });
      },
      onError: () => {
        setDisconnectOpen(false);
        toast({
          title: "Couldn't disconnect Apollo — please try again.",
          variant: "destructive",
        });
      },
    });
  }

  const tileState = deriveApolloTileState(
    { connected, credentialError: status?.status === "error" },
    warmup,
    run,
  );

  function goDeepLink(hint: string) {
    navigate(`${MC_PATH}?section=${encodeURIComponent(hint)}`);
  }

  function launch(mode: DiscoverMode) {
    setPrompt("none");
    setRunId(null); // clear any prior run so a failed re-launch doesn't show stale "complete"
    discover.mutate(
      { orgId, userId, mode },
      {
        onSuccess: (r) => setRunId(r.run_id),
        onError: (err) => {
          const code = err instanceof ApolloDiscoverError ? err.code : undefined;
          if (code === "icp_underspecified") {
            toast({
              title: "Your ICP is too narrow",
              description: "Widen your ICP to discover leads.",
              variant: "destructive",
            });
          } else if (code === "discovery_in_progress") {
            toast({
              title: "Discovery already running",
              description: "A discovery run is already in progress for your team.",
            });
          } else {
            toast({
              title: "Couldn't start discovery",
              description: "Something went wrong. Please try again.",
              variant: "destructive",
            });
          }
        },
      },
    );
  }

  function onDiscoverClick() {
    const kind = selectDiscoveryPrompt({
      icpChanged: !!status?.icp_changed_since_last_discovery,
      hasPriorDiscovery: !!status?.last_discovery_at,
    });
    if (kind === "rediscovery_guard") setPrompt("guard");
    else if (kind === "keep_replace_download") setPrompt("keep_replace");
    else if (kind === "none") launch("keep");
    else {
      kind satisfies never; // a new DiscoveryPromptKind must be handled above
      launch("keep");
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3" data-testid="apollo-tile">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Apollo</h3>
        <div className="flex items-center gap-2">
          {status?.icp_changed_since_last_discovery && tileState !== "locked" && (
            <span className="text-xs text-muted-foreground">ICP updated since last discovery</span>
          )}
          {connected && (
            <ApolloManageMenu
              onUpdateKey={() => setModal("update")}
              onDisconnect={() => setDisconnectOpen(true)}
            />
          )}
        </div>
      </div>

      {tileState === "disconnected" && (
        <Button onClick={() => setModal("connect")}>Connect Apollo</Button>
      )}

      {tileState === "locked" && warmup && (
        <>
          <p className="text-sm text-muted-foreground">
            Lead discovery will unlock once your agents are ready.
          </p>
          <WarmupProgress warmup={warmup} onDeepLink={goDeepLink} />
        </>
      )}

      {(tileState === "unlocked" ||
        tileState === "complete" ||
        tileState === "complete_empty" ||
        tileState === "complete_partial") && (
        <div className="space-y-2">
          {status?.low_credit && <LowCreditWarning />}
          {tileState === "complete" && run?.finished_at && (
            <div className="space-y-1">
              <p className="text-sm">
                Discovery complete · {new Date(run.finished_at).toLocaleString()}
                {run.counts.created > 0
                  ? ` · ${run.counts.created} new lead${run.counts.created === 1 ? "" : "s"}`
                  : ""}
              </p>
              {/* The tile never lists leads; point the user to where they actually surface. */}
              <Button
                variant="link"
                className="h-auto p-0 text-sm"
                onClick={() => navigate("/customers", { state: { tab: "lead-stream" } })}
              >
                View leads in Customers → Lead Stream
              </Button>
            </div>
          )}
          {tileState === "complete_empty" &&
            ((run?.counts.searched ?? 0) === 0 ? (
              // No one in Apollo matched the ICP — widening it is the right advice (spec §5.3 / UC8).
              <p className="text-sm">
                No leads found — no one in Apollo matches your current ICP.{" "}
                <Button variant="link" className="h-auto p-0" onClick={() => goDeepLink("icp")}>
                  Widen your ICP
                </Button>
              </p>
            ) : (
              // Candidates matched but none cleared the reveal/quality gate — widening won't help.
              <p className="text-sm">
                Candidates were found, but none were contactable. Widening your ICP won&apos;t help
                — try again later.
              </p>
            ))}
          {tileState === "complete_partial" && (
            <p role="status" className="text-sm text-amber-600">
              Discovery was interrupted — some leads may be missing.
            </p>
          )}
          <Button onClick={onDiscoverClick} disabled={discover.isPending}>
            Discover Leads
          </Button>
        </div>
      )}

      {tileState === "running" && (
        <p className="text-sm text-muted-foreground" role="status">
          Discovering leads… {run?.progress_percent ? `(${Math.round(run.progress_percent)}%)` : ""}
        </p>
      )}

      {tileState === "error" && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            {status?.status === "error"
              ? "Apollo key error — reconnect to resume discovery."
              : "Discovery failed — check your Apollo credits."}
          </p>
          {status?.status === "error" ? (
            // Credential error: the fix is a new key, not a discovery retry.
            <Button onClick={() => setModal("update")}>Update API key</Button>
          ) : (
            // Discovery failure: retry re-runs directly (keep), bypassing the keep/replace prompt.
            <Button onClick={() => launch("keep")}>Retry</Button>
          )}
        </div>
      )}

      <ApolloConnectModal
        open={modal !== "none"}
        mode={modal === "update" ? "update" : "connect"}
        orgId={orgId}
        userId={userId}
        onClose={() => setModal("none")}
        onConnected={() => {
          const wasUpdate = modal === "update";
          setModal("none");
          void statusQ.refetch();
          if (wasUpdate) toast({ title: "Apollo key updated." });
        }}
        onDeepLink={(section) => {
          setModal("none");
          goDeepLink(section);
        }}
      />
      <DisconnectApolloDialog
        open={disconnectOpen}
        isPending={disconnect.isPending}
        onConfirm={onConfirmDisconnect}
        onCancel={() => setDisconnectOpen(false)}
      />
      <ReDiscoveryGuard
        open={prompt === "guard"}
        lastDiscoveryAt={status?.last_discovery_at}
        onConfirm={() => launch("keep")}
        onCancel={() => setPrompt("none")}
      />
      <KeepReplaceDownloadPrompt
        open={prompt === "keep_replace"}
        onContinue={launch}
        onDownload={() => exportLeads("csv")}
        onCancel={() => setPrompt("none")}
      />
    </div>
  );
}
