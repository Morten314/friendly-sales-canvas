import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { boardCohorts } from "./boardData";
import { CHANNEL_META, type ChannelId, type Cohort } from "./sepTypes";

const ALL_CHANNELS: ChannelId[] = [
  "meta", "tiktok", "linkedin", "email", "crm", "figma", "personalized",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cohortIds: string[];
  title: string;
  description?: string;
  onConfirm: (channelsByCohort: Record<string, ChannelId[]>) => void;
}

const ChannelGrid = ({
  cohort,
  selected,
  onToggle,
}: {
  cohort: Cohort;
  selected: ChannelId[];
  onToggle: (ch: ChannelId) => void;
}) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <span>Suggested:</span>
      {cohort.suggestedChannels.length === 0 && <span>none</span>}
      {cohort.suggestedChannels.map((ch) => (
        <Badge key={ch} variant="outline" className="text-[10px]">{CHANNEL_META[ch].label}</Badge>
      ))}
    </div>
    <div className="grid grid-cols-2 gap-2">
      {ALL_CHANNELS.map((ch) => {
        const meta = CHANNEL_META[ch];
        const isSel = selected.includes(ch);
        return (
          <label
            key={ch}
            className={`flex items-start gap-2 rounded-md border p-2 cursor-pointer text-left transition-colors ${isSel ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
          >
            <Checkbox checked={isSel} onCheckedChange={() => onToggle(ch)} className="mt-0.5" />
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-foreground">{meta.label}</div>
              <div className="text-[10px] text-muted-foreground leading-snug">{meta.description}</div>
            </div>
          </label>
        );
      })}
    </div>
  </div>
);

const ChannelSelectorModal = ({
  open, onOpenChange, cohortIds, title, description, onConfirm,
}: Props) => {
  const cohorts = useMemo(
    () => cohortIds.map((id) => boardCohorts.find((c) => c.id === id)!).filter(Boolean),
    [cohortIds],
  );
  const [selection, setSelection] = useState<Record<string, ChannelId[]>>({});

  useEffect(() => {
    if (!open) return;
    const init: Record<string, ChannelId[]> = {};
    cohorts.forEach((c) => { init[c.id] = [...c.suggestedChannels]; });
    setSelection(init);
  }, [open, cohorts]);

  const toggle = (cohortId: string, ch: ChannelId) => {
    setSelection((prev) => {
      const cur = prev[cohortId] ?? [];
      return { ...prev, [cohortId]: cur.includes(ch) ? cur.filter((x) => x !== ch) : [...cur, ch] };
    });
  };

  const totalSelected = Object.values(selection).reduce((n, arr) => n + arr.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {cohorts.length === 1 ? (
          <ChannelGrid
            cohort={cohorts[0]}
            selected={selection[cohorts[0].id] ?? []}
            onToggle={(ch) => toggle(cohorts[0].id, ch)}
          />
        ) : (
          <Tabs defaultValue={cohorts[0]?.id}>
            <TabsList className="flex flex-wrap h-auto">
              {cohorts.map((c) => (
                <TabsTrigger key={c.id} value={c.id} className="text-[11px]">
                  {c.name} <span className="ml-1 text-muted-foreground">({(selection[c.id] ?? []).length})</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {cohorts.map((c) => (
              <TabsContent key={c.id} value={c.id} className="mt-3">
                <ChannelGrid
                  cohort={c}
                  selected={selection[c.id] ?? []}
                  onToggle={(ch) => toggle(c.id, ch)}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onConfirm(selection)} disabled={totalSelected === 0}>
            Generate package ({totalSelected} {totalSelected === 1 ? "file set" : "file sets"})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChannelSelectorModal;