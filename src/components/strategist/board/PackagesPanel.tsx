import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Eye, Package as PackageIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listSEPs, subscribe } from "../sep/sepStore";
import { downloadSEPZip } from "../sep/sepZip";

const PackagesPanel = () => {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);
  const seps = listSEPs();
  void tick;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <PackageIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-[12px] font-semibold text-foreground">Packages</h3>
        <span className="text-[10px] text-muted-foreground">{seps.length} generated</span>
      </div>
      {seps.length === 0 ? (
        <div className="p-4 text-[11px] text-muted-foreground">
          No packages yet. Generate one from the board header or approve the board to auto-generate v1.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Version</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px]">Generated</TableHead>
              <TableHead className="text-[11px]">Approver</TableHead>
              <TableHead className="text-[11px]">Scope</TableHead>
              <TableHead className="text-[11px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {seps.map((s) => (
              <TableRow key={s.manifest.id}>
                <TableCell className="text-[11px] font-mono">{s.manifest.id}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${s.manifest.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground"}`}>
                    {s.manifest.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-[11px] text-muted-foreground">
                  {new Date(s.manifest.generatedAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-[11px]">
                  {s.manifest.approvedBy ? s.manifest.approvedBy.name : "—"}
                </TableCell>
                <TableCell className="text-[11px] text-muted-foreground">
                  {s.manifest.scope} · {s.manifest.cohorts.length} cohort{s.manifest.cohorts.length !== 1 ? "s" : ""}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1" onClick={() => navigate(`/your-ai-team/strategist/package/${s.manifest.id}`)}>
                      <Eye className="h-3 w-3" /> View
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1" onClick={() => downloadSEPZip(s)}>
                      <Download className="h-3 w-3" /> ZIP
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
};

export default PackagesPanel;