import { Activity } from "lucide-react";
import { syncMetadata } from "./cohortData";

const StrategistSyncBreadcrumbs = () => {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <Activity className="h-3 w-3 text-emerald-500" />
      <span className="font-medium text-foreground/80">
        Last synced {syncMetadata.lastSyncedMinutesAgo}m ago
      </span>
      <span className="text-muted-foreground/40">·</span>
      <span>Drawing from</span>
      <span className="px-1.5 py-0.5 rounded bg-muted/60 font-medium text-foreground/70">
        Scout · {syncMetadata.scoutLeads} leads
      </span>
      <span className="px-1.5 py-0.5 rounded bg-muted/60 font-medium text-foreground/70">
        Profiler · {syncMetadata.profilerICPs} ICPs
      </span>
      <span className="px-1.5 py-0.5 rounded bg-muted/60 font-medium text-foreground/70">
        Mission Control · {syncMetadata.missionControlSources} sources
      </span>
    </div>
  );
};

export default StrategistSyncBreadcrumbs;
