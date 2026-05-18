import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronRight, Users } from "lucide-react";
import { boardCohorts } from "../sep/boardData";
import { PRIORITY_META, TREATMENT_META } from "../sep/sepTypes";

const reviewTone: Record<string, string> = {
  reviewed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overridden: "bg-blue-50 text-blue-700 border-blue-200",
  edited: "bg-amber-50 text-amber-700 border-amber-200",
  awaiting: "bg-muted text-muted-foreground border-border",
};

const PriorityTable = () => {
  const navigate = useNavigate();
  return (
    <Card className="overflow-hidden">
      <div className="px-3 py-2 border-b bg-muted/30">
        <h3 className="text-[12px] font-semibold text-foreground">Cohort priority</h3>
        <p className="text-[10px] text-muted-foreground">Treatment and priority drive what enters the next package.</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[11px]">Cohort</TableHead>
            <TableHead className="text-[11px]">Treatment</TableHead>
            <TableHead className="text-[11px]">Priority</TableHead>
            <TableHead className="text-[11px]">Review</TableHead>
            <TableHead className="text-[11px] text-center">Accounts</TableHead>
            <TableHead className="text-[11px] text-center">Composite</TableHead>
            <TableHead className="text-[11px] text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {boardCohorts.map((c) => (
            <TableRow
              key={c.id}
              className="cursor-pointer hover:bg-muted/30"
              onClick={() => navigate(`/your-ai-team/strategist/cohort/${c.id}`)}
            >
              <TableCell className="py-2">
                <div className="text-[12px] font-semibold text-foreground">{c.name}</div>
                <div className="text-[10px] text-muted-foreground line-clamp-1">{c.definition}</div>
              </TableCell>
              <TableCell><Badge variant="outline" className={`text-[10px] ${TREATMENT_META[c.treatment].tone}`}>{TREATMENT_META[c.treatment].label}</Badge></TableCell>
              <TableCell><Badge variant="outline" className={`text-[10px] ${PRIORITY_META[c.priority].tone}`}>{PRIORITY_META[c.priority].label}</Badge></TableCell>
              <TableCell><Badge variant="outline" className={`text-[10px] ${reviewTone[c.reviewState]}`}>{c.reviewState}</Badge></TableCell>
              <TableCell className="text-center">
                <div className="inline-flex items-center gap-1 text-[11px] text-foreground"><Users className="h-3 w-3 text-muted-foreground" />{c.accounts.length}</div>
              </TableCell>
              <TableCell className="text-center text-[11px] font-semibold">{c.scoring.composite}</TableCell>
              <TableCell className="text-right">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground inline" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default PriorityTable;