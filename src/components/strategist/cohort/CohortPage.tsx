import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, FilePlus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { getCohort } from "../sep/boardData";
import { PRIORITY_META, TREATMENT_META, type ChannelId } from "../sep/sepTypes";
import ChannelSelectorModal from "../sep/ChannelSelectorModal";
import { generateSEP } from "../sep/sepGenerator";
import { nextVersion, saveSEP } from "../sep/sepStore";

const CohortPage = () => {
  const { cohortId } = useParams<{ cohortId: string }>();
  const navigate = useNavigate();
  const [genOpen, setGenOpen] = useState(false);
  const cohort = cohortId ? getCohort(cohortId) : undefined;

  if (!cohort) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Cohort not found.</p>
        <Button variant="link" onClick={() => navigate("/your-ai-team/strategist/board")}>Back to board</Button>
      </div>
    );
  }

  const handleGenerate = (channelsByCohort: Record<string, ChannelId[]>) => {
    const sep = generateSEP({
      cohortIds: [cohort.id],
      channelsByCohort,
      scope: "cohort",
      status: "draft",
      version: nextVersion(),
    });
    saveSEP(sep);
    toast({ title: "Cohort package generated", description: sep.manifest.id });
    setGenOpen(false);
    navigate(`/your-ai-team/strategist/package/${sep.manifest.id}`);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1" onClick={() => navigate("/your-ai-team/strategist/board")}>
          <ArrowLeft className="h-3 w-3" /> Board
        </Button>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{cohort.name}</h2>
            <Badge variant="outline" className={`text-[10px] ${TREATMENT_META[cohort.treatment].tone}`}>{TREATMENT_META[cohort.treatment].label}</Badge>
            <Badge variant="outline" className={`text-[10px] ${PRIORITY_META[cohort.priority].tone}`}>{PRIORITY_META[cohort.priority].label}</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-2xl">{cohort.definition}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-[11px] gap-1.5"><Pencil className="h-3.5 w-3.5" /> Override</Button>
          <Button variant="outline" size="sm" className="h-8 text-[11px] gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Escalate</Button>
          <Button size="sm" className="h-8 text-[11px] gap-1.5" onClick={() => setGenOpen(true)}>
            <FilePlus className="h-3.5 w-3.5" /> Generate package
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-3 lg:col-span-2 space-y-3">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rationale</h3>
            <p className="text-[12px] text-foreground mt-1 leading-relaxed">{cohort.rationale}</p>
          </section>
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Kill criterion</h3>
            <p className="text-[12px] text-foreground mt-1 leading-relaxed">{cohort.killCriterion}</p>
          </section>
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Override history</h3>
            {cohort.overrideHistory.length === 0 ? (
              <p className="text-[11px] text-muted-foreground mt-1">No overrides.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {cohort.overrideHistory.map((o, i) => (
                  <li key={i} className="text-[11px] text-foreground">
                    <span className="text-muted-foreground">{new Date(o.at).toLocaleString()} · {o.by} —</span> {o.note}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Card>

        <Card className="p-3 space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Scoring</h3>
          <div className="grid grid-cols-2 gap-2">
            {(["fit", "intent", "confidence", "composite"] as const).map((k) => (
              <div key={k} className="rounded-md border p-2">
                <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
                <div className={`text-base font-bold ${k === "composite" ? "text-primary" : "text-foreground"}`}>
                  {cohort.scoring[k]}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Accounts</h3>
          <span className="text-[10px] text-muted-foreground">{cohort.accounts.length} total</span>
        </div>
        {cohort.accounts.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No accounts in this cohort.</p>
        ) : (
          <ul className="divide-y">
            {cohort.accounts.map((a) => (
              <li key={a.id} className="py-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12px] font-semibold text-foreground">{a.name}</span>
                  <span className="text-[10px] text-muted-foreground">{a.domain}</span>
                </div>
                {a.contacts.map((ct, i) => (
                  <div key={i} className="ml-2 mt-1 text-[11px]">
                    <span className="font-medium text-foreground">{ct.name}</span>
                    <span className="text-muted-foreground"> · {ct.role}</span>
                    {ct.recentActivities.length > 0 && (
                      <div className="text-[10.5px] text-muted-foreground">
                        Recent: {ct.recentActivities.join(" · ")}
                      </div>
                    )}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ChannelSelectorModal
        open={genOpen}
        onOpenChange={setGenOpen}
        cohortIds={[cohort.id]}
        title={`Generate package — ${cohort.name}`}
        description="Pick the channels you want execution files for in this single-cohort package."
        onConfirm={handleGenerate}
      />
    </div>
  );
};

export default CohortPage;