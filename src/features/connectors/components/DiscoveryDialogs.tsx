import { useState } from "react";

import type { DiscoverMode } from "../types";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

function formatDate(iso?: string | null) {
  if (!iso) return "your last run";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "your last run" : d.toLocaleDateString();
}

export function ReDiscoveryGuard({
  open,
  lastDiscoveryAt,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  lastDiscoveryAt?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your ICP hasn't changed</DialogTitle>
          <DialogDescription>
            Your ICP hasn't changed since your last discovery on {formatDate(lastDiscoveryAt)}.
            Running again may return the same leads.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Continue anyway</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function KeepReplaceDownloadPrompt({
  open,
  onContinue,
  onDownload,
  onCancel,
}: {
  open: boolean;
  onContinue: (mode: DiscoverMode) => void;
  onDownload: () => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<DiscoverMode>("keep");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You have Apollo-sourced leads from a previous discovery</DialogTitle>
          <DialogDescription>What would you like to do?</DialogDescription>
        </DialogHeader>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as DiscoverMode)}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="keep" id="mode-keep" />
            <Label htmlFor="mode-keep">Keep existing leads + add new ones</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="replace" id="mode-replace" />
            <Label htmlFor="mode-replace">Replace — remove old and start fresh</Label>
          </div>
        </RadioGroup>
        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={onDownload}>
            Download existing leads
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => onContinue(mode)}>Continue</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
