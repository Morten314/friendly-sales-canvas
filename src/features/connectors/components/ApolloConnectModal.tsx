import { useEffect, useState } from "react";

import { ApolloConnectError, connectApollo } from "../services/apollo";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  /** "connect" (default) for first connect; "update" to replace an existing key. */
  mode?: "connect" | "update";
  orgId: string;
  userId: string;
  onClose: () => void;
  onConnected: () => void;
  /** Navigate the user to the incomplete profile section (UC6 deep-link). */
  onDeepLink: (section: string) => void;
}

const APOLLO_KEY_HELP = "https://docs.apollo.io/docs/create-api-key";

export function ApolloConnectModal({
  open,
  mode = "connect",
  orgId,
  userId,
  onClose,
  onConnected,
  onDeepLink,
}: Props) {
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApolloConnectError | null>(null);

  // Reset transient state each time the modal opens (Radix keeps it mounted).
  useEffect(() => {
    if (open) {
      setApiKey("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const isUpdate = mode === "update";

  async function handleConnect() {
    setSubmitting(true);
    setError(null);
    try {
      await connectApollo({ orgId, userId, apiKey });
      onConnected();
    } catch (e) {
      setError(
        e instanceof ApolloConnectError
          ? e
          : new ApolloConnectError({ httpStatus: 0, detail: "Connection failed" }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isUpdate ? "Update Apollo API key" : "Connect Apollo"}</DialogTitle>
          <DialogDescription>
            {isUpdate ? (
              <>
                Enter a new Apollo <strong>master API key</strong>. It replaces the current key and
                is validated before saving.{" "}
              </>
            ) : (
              <>
                Discover net-new leads from Apollo based on your ICP. Requires a{" "}
                <strong>master API key</strong> with search access.{" "}
              </>
            )}
            <a href={APOLLO_KEY_HELP} target="_blank" rel="noreferrer" className="underline">
              Where do I find it?
            </a>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="apollo-api-key">API key</Label>
          <Input
            id="apollo-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={isUpdate ? "Enter new Apollo master key" : "Apollo master API key"}
          />
          {isUpdate && <p className="text-xs text-muted-foreground">A key is already connected.</p>}
        </div>

        {error?.code === "profile_incomplete" && (
          <div role="alert" className="text-sm text-destructive">
            Your customer profile is incomplete. Complete the{" "}
            <strong>{error.missing_section}</strong> section first.
            <div className="mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDeepLink(error.missing_section ?? "icp")}
              >
                Complete your profile
              </Button>
            </div>
          </div>
        )}
        {error?.code === "master_key_required" && (
          <p role="alert" className="text-sm text-destructive">
            This key works, but discovery needs a <strong>master API key</strong> with search
            access.
          </p>
        )}
        {error && !error.code && (
          <p role="alert" className="text-sm text-destructive">
            {error.httpStatus === 0
              ? "Couldn't reach Apollo — check your connection and try again."
              : "Invalid key — please check your Apollo account."}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={submitting || !apiKey}>
            {submitting
              ? isUpdate
                ? "Updating…"
                : "Connecting…"
              : isUpdate
                ? "Update"
                : "Connect"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
