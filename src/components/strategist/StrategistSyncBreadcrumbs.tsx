import { Activity } from "lucide-react";
import { syncMetadata } from "./cohortData";

const StrategistSyncBreadcrumbs = () => {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <Activity className="h-3 w-3 text-emerald-500" />
      <span className="font-medium text-foreground/80">
        Last synced {syncMetadata.lastSyncedMinutesAgo}m ago
      </span>
    </div>
  );
};

export default StrategistSyncBreadcrumbs;
