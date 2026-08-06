import { CalendarDays, FileDown, Inbox, Table2 } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type ArtefactItem,
  downloadArtefactCsv,
  generateAndDownloadPDF,
  loadStoredArtefacts,
} from "@/features/artifacts";

/** Folder naming produced by buildAcceptedSignalArtefact: "Accepted Signals — YYYY-MM-DD". */
const ACCEPTED_TASK = "Accepted Signal";

const dayFromFolder = (folder?: string) => folder?.split("—").pop()?.trim() ?? "Undated";

const formatDay = (day: string) => {
  const parsed = new Date(`${day}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return day;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/**
 * Read-only view of accepted signals, grouped by the day they were accepted.
 * Sources the same persisted artefacts written on accept — no duplicate store.
 */
export const AcceptedSignalsPanel = ({ refreshKey }: { refreshKey: number }) => {
  const groups = useMemo(() => {
    void refreshKey;
    const items = loadStoredArtefacts().filter((a) => a.taskNumber === ACCEPTED_TASK);
    const byDay = new Map<string, ArtefactItem[]>();
    for (const item of items) {
      const day = dayFromFolder(item.folder);
      byDay.set(day, [...(byDay.get(day) ?? []), item]);
    }
    return [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [refreshKey]);

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-1">No accepted signals yet</h3>
        <p className="text-sm text-muted-foreground">
          Accept a signal and it will be filed here by date.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(([day, items]) => (
        <section key={day} className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDay(day)}
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {items.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border bg-card p-4 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">
                        {item.agentName}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{item.timestamp}</span>
                    </div>
                    <h4 className="font-medium text-sm mb-1">{item.fullReport.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.outputSummary}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.csv && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5"
                        onClick={() => downloadArtefactCsv(item)}
                      >
                        <Table2 className="h-3.5 w-3.5" />
                        CSV
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5"
                      onClick={() => generateAndDownloadPDF(item)}
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      Summary
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};