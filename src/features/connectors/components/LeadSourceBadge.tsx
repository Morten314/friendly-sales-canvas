import { normalizeLeadSource } from "../lib/leadSource";

import { Badge } from "@/components/ui/badge";

const LABELS: Record<string, string> = {
  apollo: "Apollo",
  csv: "CSV",
  manual: "Manual",
  unknown: "Unknown",
};

const CLASSES: Record<string, string> = {
  apollo: "text-violet-600 border-violet-300",
  csv: "text-sky-600 border-sky-300",
  manual: "text-emerald-600 border-emerald-300",
  unknown: "text-muted-foreground border-muted",
};

/** Per-row badge driven by the real (normalized) lead `source`. */
export function LeadSourceBadge({ source }: { source?: string | null }) {
  const s = normalizeLeadSource(source);
  return (
    <Badge variant="outline" className={`text-[10px] ${CLASSES[s]}`}>
      {LABELS[s]}
    </Badge>
  );
}
