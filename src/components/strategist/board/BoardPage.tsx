import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, FilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import NextActionsPanel from "./NextActionsPanel";
import PackagesPanel from "./PackagesPanel";
import PriorityTable from "./PriorityTable";
import ChannelSelectorModal from "../sep/ChannelSelectorModal";
import { boardCohorts, BOARD_NAME } from "../sep/boardData";
import { generateSEP } from "../sep/sepGenerator";
import { nextVersion, saveSEP } from "../sep/sepStore";
import type { ChannelId } from "../sep/sepTypes";

const BoardPage = () => {
  const navigate = useNavigate();
  const [genOpen, setGenOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);

  const eligibleCohortIds = boardCohorts
    .filter((c) => c.treatment !== "EXCLUDE")
    .map((c) => c.id);

  const handleGenerate = (
    channelsByCohort: Record<string, ChannelId[]>,
    status: "draft" | "approved",
  ) => {
    const sep = generateSEP({
      cohortIds: eligibleCohortIds,
      channelsByCohort,
      scope: "board",
      status,
      version: nextVersion(),
    });
    saveSEP(sep);
    toast({
      title: status === "approved" ? "Board approved" : "Package generated",
      description: `${sep.manifest.id} · ${sep.cohorts.length} cohort${sep.cohorts.length !== 1 ? "s" : ""}`,
    });
    setGenOpen(false);
    setApproveOpen(false);
    navigate(`/your-ai-team/strategist/package/${sep.manifest.id}`);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Strategist board</h2>
          <p className="text-[11px] text-muted-foreground">{BOARD_NAME}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-[11px] gap-1.5" onClick={() => setGenOpen(true)}>
            <FilePlus className="h-3.5 w-3.5" /> Generate package
          </Button>
          <Button size="sm" className="h-8 text-[11px] gap-1.5" onClick={() => setApproveOpen(true)}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Approve board
          </Button>
        </div>
      </div>

      <NextActionsPanel />
      <PriorityTable />
      <PackagesPanel />

      <ChannelSelectorModal
        open={genOpen}
        onOpenChange={setGenOpen}
        cohortIds={eligibleCohortIds}
        title="Generate Strategy Execution Package"
        description="Pick which channels to include for each cohort. The package will be saved as a draft."
        onConfirm={(sel) => handleGenerate(sel, "draft")}
      />
      <ChannelSelectorModal
        open={approveOpen}
        onOpenChange={setApproveOpen}
        cohortIds={eligibleCohortIds}
        title="Approve board & generate v-next"
        description="Approving the board creates an immutable, approved package. Pick channels for each cohort."
        onConfirm={(sel) => handleGenerate(sel, "approved")}
      />
    </div>
  );
};

export default BoardPage;