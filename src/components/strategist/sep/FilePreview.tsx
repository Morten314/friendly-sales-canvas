import { useState } from "react";
import { ChevronDown, ChevronRight, Download, FileJson, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SEPFile } from "./sepTypes";

const downloadFile = (file: SEPFile) => {
  const blob = new Blob([file.content], { type: file.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Minimal markdown → html (headings, bold, lists, paragraphs)
const renderMd = (md: string): string => {
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#\s/.test(line)) { closeList(); html += `<h3 class="text-[12px] font-semibold text-foreground mt-2">${line.replace(/^#\s+/, "")}</h3>`; continue; }
    if (/^##\s/.test(line)) { closeList(); html += `<h4 class="text-[11px] font-semibold text-foreground mt-2">${line.replace(/^##\s+/, "")}</h4>`; continue; }
    if (/^-\s/.test(line)) {
      if (!inList) { html += `<ul class="list-disc pl-4 space-y-0.5 text-[11px] text-foreground">`; inList = true; }
      html += `<li>${line.replace(/^-\s+/, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</li>`;
      continue;
    }
    if (!line) { closeList(); continue; }
    closeList();
    html += `<p class="text-[11px] text-foreground leading-relaxed">${line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`;
  }
  closeList();
  return html;
};

const FilePreview = ({ file }: { file: SEPFile }) => {
  const [open, setOpen] = useState(false);
  const Icon = file.mime === "application/json" ? FileJson : FileText;
  return (
    <div className="border rounded-md bg-background">
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-[11px] font-medium text-foreground hover:text-primary">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Icon className="h-3 w-3 text-muted-foreground" />
          <span>{file.name}</span>
        </button>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => downloadFile(file)}>
          <Download className="h-3 w-3" /> Download
        </Button>
      </div>
      {open && (
        <div className="border-t px-3 py-2 max-h-72 overflow-auto bg-muted/20">
          {file.mime === "application/json" ? (
            <pre className="text-[10.5px] leading-snug font-mono text-foreground whitespace-pre-wrap">{file.content}</pre>
          ) : (
            <div className="space-y-1" dangerouslySetInnerHTML={{ __html: renderMd(file.content) }} />
          )}
        </div>
      )}
    </div>
  );
};

export default FilePreview;