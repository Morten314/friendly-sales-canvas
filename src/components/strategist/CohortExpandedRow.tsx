import { useEffect, useState } from "react";
import { Mail, Globe, Linkedin, Sparkles, Copy, Check, Loader2, Zap, MoreVertical, RefreshCw, Send, MessageSquare } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StrategyCohort, CohortLead, BriefSection } from "./cohortData";

interface CohortExpandedRowProps {
  cohort: StrategyCohort;
  onLaunch: () => void;
}

const BriefLine = ({ section, delay }: { section: BriefSection; delay: number }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!visible) return null;
  return (
    <div className="animate-fade-in">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        {section.label}
      </p>
      <p className="text-[11px] text-foreground mt-0.5 leading-relaxed">{section.body}</p>
    </div>
  );
};

const CopyableEmail = ({ email }: { email: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="group inline-flex items-center gap-1 text-[11px] text-foreground hover:text-primary"
    >
      <Mail className="h-3 w-3 text-muted-foreground" />
      <span className="truncate max-w-[140px]">{email}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground" />
      )}
    </button>
  );
};

const LeadRow = ({ lead, delay }: { lead: CohortLead; delay: number }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!visible) return null;
  return (
    <TableRow className="animate-fade-in">
      <TableCell className="text-[11px] py-1.5 font-medium">{lead.name}</TableCell>
      <TableCell className="text-[11px] py-1.5 text-muted-foreground">{lead.company}</TableCell>
      <TableCell className="py-1.5">
        <CopyableEmail email={lead.email} />
      </TableCell>
      <TableCell className="py-1.5">
        <a
          href={`https://${lead.website}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-foreground hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          <Globe className="h-3 w-3 text-muted-foreground" />
          <span className="truncate max-w-[120px]">{lead.website}</span>
        </a>
      </TableCell>
      <TableCell className="py-1.5">
        <a
          href={`https://${lead.linkedin}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-foreground hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          <Linkedin className="h-3 w-3 text-muted-foreground" />
          <span>Profile</span>
        </a>
      </TableCell>
      <TableCell className="py-1.5 text-right">
        {/* Actions placeholder — to be defined */}
        <span className="text-[10px] text-muted-foreground/50">—</span>
      </TableCell>
    </TableRow>
  );
};

const CohortExpandedRow = ({ cohort, onLaunch }: CohortExpandedRowProps) => {
  const [phase, setPhase] = useState<"thinking" | "brief" | "enriching" | "leads">("thinking");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("brief"), 350);
    const briefDuration = cohort.brief.length * 400 + 200;
    const t2 = setTimeout(() => setPhase("enriching"), 350 + briefDuration);
    const t3 = setTimeout(() => setPhase("leads"), 350 + briefDuration + 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [cohort.brief.length]);

  const visibleLeads = cohort.leads.slice(0, 8);
  const actionsReady = phase === "leads";

  return (
    <TableRow className="bg-muted/20 hover:bg-muted/20">
      <TableCell colSpan={6} className="py-3">
        <div className="space-y-3">
          {/* Strategist's Brief */}
          <div className="flex items-start gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <p className="text-[11px] font-semibold text-foreground">Strategist's Brief</p>
              {phase === "thinking" ? (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Synthesising cohort intelligence…</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {cohort.brief.map((section, i) => (
                    <BriefLine key={section.label} section={section} delay={i * 400} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Enriched leads */}
          {phase !== "thinking" && phase !== "brief" && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold text-foreground">
                  Enriched leads ({cohort.leads.length})
                </p>
                {phase === "enriching" && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Enriching {visibleLeads.length} leads…</span>
                  </div>
                )}
              </div>
              <div className="border rounded-md overflow-hidden bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] h-7">Name</TableHead>
                      <TableHead className="text-[10px] h-7">Company</TableHead>
                      <TableHead className="text-[10px] h-7">Email</TableHead>
                      <TableHead className="text-[10px] h-7">Website</TableHead>
                      <TableHead className="text-[10px] h-7">LinkedIn</TableHead>
                      <TableHead className="text-[10px] h-7 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {phase === "leads" &&
                      visibleLeads.map((lead, i) => (
                        <LeadRow key={lead.id} lead={lead} delay={i * 120} />
                      ))}
                  </TableBody>
                </Table>
                {phase === "leads" && cohort.leads.length > 8 && (
                  <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t bg-muted/20">
                    + {cohort.leads.length - 8} more leads
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cohort-level action bar — appears once leads are ready */}
          {actionsReady && (
            <div className="animate-fade-in flex items-center justify-end gap-1.5 pt-1 border-t border-border/50">
              <span className="text-[10px] text-muted-foreground mr-auto">
                Ready to act on this cohort?
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="text-xs gap-2 cursor-pointer">
                    <RefreshCw className="h-3.5 w-3.5" /> Refine Strategy
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs gap-2 cursor-pointer">
                    <Send className="h-3.5 w-3.5" /> Send to Artefacts
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs gap-2 cursor-pointer">
                    <MessageSquare className="h-3.5 w-3.5" /> Ask Strategist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                className="h-7 text-[11px] gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onLaunch();
                }}
              >
                <Zap className="h-3 w-3" />
                {cohort.primaryAction}
              </Button>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

export default CohortExpandedRow;