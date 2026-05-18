import JSZip from "jszip";
import type { SEP, SEPCohortFolder } from "./sepTypes";
import { manifestFile } from "./sepGenerator";

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const downloadSEPZip = async (sep: SEP) => {
  const zip = new JSZip();
  const root = zip.folder(sep.manifest.id.toUpperCase())!;
  root.file("manifest.json", manifestFile(sep));
  for (const folder of sep.cohorts) {
    const dir = root.folder(folder.folderName)!;
    for (const f of folder.files) dir.file(f.name, f.content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `${sep.manifest.id}.zip`);
};

export const downloadCohortFolderZip = async (
  sep: SEP,
  folder: SEPCohortFolder,
) => {
  const zip = new JSZip();
  const dir = zip.folder(folder.folderName)!;
  for (const f of folder.files) dir.file(f.name, f.content);
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `${sep.manifest.id}__${folder.folderName}.zip`);
};