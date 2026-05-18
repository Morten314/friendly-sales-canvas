import { useNavigate } from "react-router-dom";
import { Link2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { latestApproved } from "../sep/sepStore";
import { PRIORITY_META } from "../sep/sepTypes";

const NextActionsPanel = () => {
  const navigate = useNavigate();
  const sep = latestApproved();

  if (!sep) {
    return (
      <Card className="p-3 border-dashed">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Zap className="h-3.5 w-3.5" />
          <span>No approved package yet. Approve the board to generate the first Strategy Execution Package and surface next actions here.</span>
        </div>
      </Card>
    );
  }

  const top = sep.manifest.immediateActions.slice(0, 5);

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-[12px] font-semibold text-foreground">Next actions</h3>
          <Badge variant="outline" className="text-[9px]">from {sep.manifest.id}</Badge>
        </div>
        <button
          className="text-[10px] text-primary hover:underline flex items-center gap-1"
          onClick={() => navigate(`/your-ai-team/strategist/package/${sep.manifest.id}`)}
        >
          <Link2 className="h-3 w-3" /> Open package
        </button>
      </div>
      <ul className="divide-y">
        {top.map((a, i) => (
          <li key={i} className="flex items-center gap-2 py-1.5">
            <Badge variant="outline" className={`text-[10px] ${PRIORITY_META[a.priority].tone}`}>
              {PRIORITY_META[a.priority].label}
            </Badge>
            <span className="text-[11px] text-foreground flex-1 truncate">{a.action}</span>
            <button
              className="text-[10px] text-primary hover:underline"
              onClick={() => navigate(`/your-ai-team/strategist/package/${sep.manifest.id}#${a.cohortId}`)}
            >
              Open
            </button>
          </li>
        ))}
        {top.length === 0 && (
          <li className="text-[11px] text-muted-foreground py-1.5">No actions in the latest approved package.</li>
        )}
      </ul>
    </Card>
  );
};

export default NextActionsPanel;