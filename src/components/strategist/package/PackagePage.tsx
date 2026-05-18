import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Folder, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { getSEP } from "../sep/sepStore";
import { downloadCohortFolderZip, downloadSEPZip } from "../sep/sepZip";
import FilePreview from "../sep/FilePreview";
import { PRIORITY_META, TREATMENT_META } from "../sep/sepTypes";

const PackagePage = () => {
  const { packageId } = useParams<{ packageId: string }>();
  const navigate = useNavigate();
  const sep = packageId ? getSEP(packageId) : undefined;

  useEffect(() => {
    if (!sep) return;
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      const el = document.getElementById(`cohort-${id}`);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [sep]);

  if (!sep) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Package not found.</p>
        <Button variant="link" onClick={() => navigate("/your-ai-team/strategist/board")}>Back to board</Button>
      </div>
    );
  }

  const handoff = (folderName: string) => {
    const folder = sep.cohorts.find((c) => c.folderName === folderName);
    if (!folder) return;
    const payload = { manifestCohort: sep.manifest.cohorts.find((c) => c.folderName === folderName), files: folder.files };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast({ title: "Copied to clipboard", description: `${folderName} payload ready to paste into an executor.` });
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
            <h2 className="text-lg font-semibold text-foreground font-mono">{sep.manifest.id}</h2>
            <Badge variant="outline" className={`text-[10px] ${sep.manifest.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground"}`}>
              {sep.manifest.status}
            </Badge>
            <Badge variant="outline" className="text-[10px]">{sep.manifest.scope}</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Generated {new Date(sep.manifest.generatedAt).toLocaleString()}
            {sep.manifest.approvedBy && <> · approved by {sep.manifest.approvedBy.name}</>}
          </p>
        </div>
        <Button size="sm" className="h-8 text-[11px] gap-1.5" onClick={() => downloadSEPZip(sep)}>
          <Download className="h-3.5 w-3.5" /> Download ZIP
        </Button>
      </div>

      <Card className="p-3">
        <h3 className="text-[12px] font-semibold text-foreground mb-2">Action queue</h3>
        {sep.manifest.immediateActions.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No immediate actions. Add channels to a cohort to populate this queue.</p>
        ) : (
          <ul className="divide-y">
            {sep.manifest.immediateActions.map((a, i) => (
              <li key={i} className="flex items-center gap-2 py-1.5">
                <span className="text-[10px] text-muted-foreground w-5 text-right">{i + 1}.</span>
                <Badge variant="outline" className={`text-[10px] ${PRIORITY_META[a.priority].tone}`}>{PRIORITY_META[a.priority].label}</Badge>
                <span className="text-[11px] text-foreground flex-1">{a.action}</span>
                <a href={`#cohort-${a.cohortId}`} className="text-[10px] text-primary hover:underline">Open folder</a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="space-y-3">
        {sep.cohorts.map((folder) => (
          <Card key={folder.cohortId} id={`cohort-${folder.cohortId}`} className="p-3 scroll-mt-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                  <h4 className="text-[13px] font-semibold text-foreground">{folder.name}</h4>
                  <Badge variant="outline" className={`text-[10px] ${TREATMENT_META[folder.treatment].tone}`}>{TREATMENT_META[folder.treatment].label}</Badge>
                  <Badge variant="outline" className={`text-[10px] ${PRIORITY_META[folder.priority].tone}`}>{PRIORITY_META[folder.priority].label}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{folder.folderName}/ · {folder.accountCount} accounts · {folder.files.length} files</p>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => handoff(folder.folderName)}>
                  <Send className="h-3 w-3" /> Hand off
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => downloadCohortFolderZip(sep, folder)}>
                  <Download className="h-3 w-3" /> ZIP
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              {folder.files.map((f) => (
                <FilePreview key={f.name} file={f} />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PackagePage;