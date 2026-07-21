import { ArrowUpRight, Database } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { useLeads } from "../../hooks/useLeads";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LEAD_SOURCE_OPTIONS,
  LeadSourceBadge,
  filterLeadsBySource,
  type LeadSourceFilter,
} from "@/features/connectors";
import { useSignalLeadMap } from "@/features/signals";
import { useAuth } from "@/shared/auth/AuthContext";
import { useTenant } from "@/shared/tenant";

interface LeadStreamPanelProps {
  orgId?: string | null;
  // Retained for call-site compatibility; ICP segmentation is no longer applied
  // to real leads (they carry no matchedICP). See specs/36 §5.7-A2.
  filterByICP?: string | null;
  onClearFilter?: () => void;
}

export function LeadStreamPanel({ orgId: orgIdProp }: LeadStreamPanelProps) {
  const { orgId: authOrgId } = useAuth();
  const { selectedTenant } = useTenant();
  // Resolve org the same way LeadsTable does (tenant-aware), so both surfaces
  // feed useSignalLeadMap the same org under an active tenant selection.
  const orgId = orgIdProp ?? selectedTenant?.id ?? authOrgId ?? null;
  const leadsQuery = useLeads(orgId);
  const { signalsForLead } = useSignalLeadMap(orgId);
  const [sourceFilter, setSourceFilter] = useState<LeadSourceFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const leads = useMemo(
    () => leadsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [leadsQuery.data],
  );
  const total = leadsQuery.data?.pages[0]?.total ?? leads.length;

  const visibleLeads = useMemo(
    () => filterLeadsBySource(leads, sourceFilter),
    [leads, sourceFilter],
  );

  if (!leadsQuery.isLoading && leads.length === 0) {
    return (
      <Card className="border-dashed border-2 border-muted">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Database className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No prospect data yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Upload a prospect list in Data Sources to generate your Lead Stream.
          </p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => window.dispatchEvent(new CustomEvent("navigateToDataSources"))}
          >
            <ArrowUpRight className="h-4 w-4" />
            Go to Data Sources
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Lead Stream</h3>
            <Badge variant="secondary" className="text-[10px]">
              {leads.length} of {total} leads
            </Badge>
          </div>
          <Select
            value={sourceFilter}
            onValueChange={(v) => setSourceFilter(v as LeadSourceFilter)}
          >
            <SelectTrigger className="h-8 text-xs w-[140px]" aria-label="Filter by lead source">
              <SelectValue placeholder="All leads" />
            </SelectTrigger>
            <SelectContent>
              {LEAD_SOURCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">Company</TableHead>
              <TableHead className="text-xs">Source</TableHead>
              <TableHead className="text-xs">Signals</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleLeads.map((lead) => {
              const signals = signalsForLead(lead.id);
              const isExpanded = expandedId === lead.id;
              return (
                <Fragment key={lead.id}>
                  <TableRow>
                    <TableCell className="text-sm font-medium">{lead.name}</TableCell>
                    <TableCell className="text-sm">{lead.company}</TableCell>
                    <TableCell>
                      <LeadSourceBadge source={lead.source} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {signals.length > 0 ? (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                          onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                        >
                          {signals.length} {signals.length === 1 ? "signal" : "signals"}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && signals.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="bg-muted/30">
                        <ul className="space-y-1 py-1">
                          {signals.map((s) => (
                            <li key={s.signal_id} className="text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">{s.headline}</span>
                              {s.why ? ` — ${s.why}` : ""}
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        {leadsQuery.hasNextPage ? (
          <div className="flex justify-center p-2">
            <Button
              variant="outline"
              size="sm"
              disabled={leadsQuery.isFetchingNextPage}
              onClick={() => leadsQuery.fetchNextPage()}
            >
              {leadsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Returns 0 — ICP-segmented mock data has been removed; real leads carry no
 * matchedICP. Kept for call-site compatibility (SuggestedICPCards). Will be
 * removed when SuggestedICPCards switches to a real per-ICP count endpoint.
 */
export function getLeadCountForICP(_icpName: string): number {
  return 0;
}
