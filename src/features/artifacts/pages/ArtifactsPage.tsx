import { ChevronLeft, FolderOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ArtefactDetail } from "../components/ArtefactDetail";
import { ArtefactRow } from "../components/ArtefactRow";
import { FolderList } from "../components/FolderList";
import { artefactName } from "../lib/artefactName";
import { generateAndDownloadPDF } from "../lib/artefactPdf";
import { drainArtefactQueue } from "../lib/artefactQueue";
import {
  deleteStoredArtefact,
  loadStoredArtefacts,
  pruneSheet,
  updateStoredArtefactSheet,
  updateStoredArtefactSequence,
} from "../lib/artefactStore";
import type { ArtefactItem } from "../types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layout } from "@/features/shell";
import { usePageTitle } from "@/shared/hooks/usePageTitle";

const ROOT = "__root__";

const ArtifactsPage = () => {
  usePageTitle("Artefacts - Brewra");
  const [artefacts, setArtefacts] = useState<ArtefactItem[]>(() => loadStoredArtefacts());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Header search bar (global CustomEvent) feeds the same query as the local box.
  useEffect(() => {
    const handleSearch = (event: CustomEvent) => setSearchQuery(event.detail.query);
    window.addEventListener("artifactsSearch", handleSearch as EventListener);
    return () => window.removeEventListener("artifactsSearch", handleSearch as EventListener);
  }, []);

  useEffect(() => {
    const handleAddArtefact = (event: CustomEvent) => {
      const incoming = pruneSheet(event.detail as ArtefactItem);
      setArtefacts((prev) => [incoming, ...prev.filter((a) => a.id !== incoming.id)]);
      setActiveFolder(incoming.folder ?? null);
    };
    window.addEventListener("addArtefact", handleAddArtefact as EventListener);
    return () => window.removeEventListener("addArtefact", handleAddArtefact as EventListener);
  }, []);

  // Drain artefacts enqueued before this page mounted (e.g. saved from /signals).
  // Once-only: drainArtefactQueue() clears the queue, so a remount sees nothing.
  useEffect(() => {
    const queued = drainArtefactQueue();
    if (queued.length === 0) return;
    setArtefacts((prev) => {
      const known = new Set(prev.map((a) => a.id));
      const fresh = queued.filter((a) => !known.has(a.id)).map(pruneSheet);
      return [...fresh.slice().reverse(), ...prev];
    });
    const mostRecent = queued[queued.length - 1];
    setActiveFolder(mostRecent.folder ?? null);
  }, []);

  const query = searchQuery.trim().toLowerCase();

  const matching = useMemo(
    () =>
      artefacts.filter((a) =>
        query
          ? [artefactName(a), a.taskNumber, a.folder ?? "", a.agentName]
              .join(" ")
              .toLowerCase()
              .includes(query)
          : true,
      ),
    [artefacts, query],
  );

  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of matching) {
      if (a.folder) counts.set(a.folder, (counts.get(a.folder) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.name.localeCompare(a.name));
  }, [matching]);

  // Searching flattens the tree so results are never hidden inside a folder.
  const visibleFiles = useMemo(() => {
    if (query) return matching;
    return matching.filter((a) => (activeFolder ? a.folder === activeFolder : !a.folder));
  }, [matching, activeFolder, query]);

  const openArtefact = openId ? artefacts.find((a) => a.id === openId) : undefined;

  const handleDelete = (id: string) => {
    deleteStoredArtefact(id);
    setArtefacts((prev) => prev.filter((a) => a.id !== id));
    setOpenId((current) => (current === id ? null : current));
  };

  const handleRenameStart = (artefact: ArtefactItem) => {
    setRenamingId(artefact.id);
    setEditName(artefactName(artefact));
  };

  const handleRenameSave = () => {
    setArtefacts((prev) =>
      prev.map((a) =>
        a.id === renamingId ? { ...a, fullReport: { ...a.fullReport, title: editName } } : a,
      ),
    );
    setRenamingId(null);
    setEditName("");
  };

  const handleSheetCellChange = (
    id: string,
    rowIndex: number,
    colIndex: number,
    value: string,
  ) => {
    setArtefacts((prev) =>
      prev.map((artefact) => {
        if (artefact.id !== id || !artefact.sheet) return artefact;
        const rows = artefact.sheet.rows.map((row, r) =>
          r === rowIndex ? row.map((cell, c) => (c === colIndex ? value : cell)) : row,
        );
        updateStoredArtefactSheet(id, rows);
        return { ...artefact, sheet: { ...artefact.sheet, rows } };
      }),
    );
  };

  const handleDownloadPdf = (artefact: ArtefactItem) => {
    if (artefact.status === "new") {
      setArtefacts((prev) =>
        prev.map((a) => (a.id === artefact.id ? { ...a, status: "viewed" as const } : a)),
      );
    }
    generateAndDownloadPDF(artefact);
  };

  const handleSequenceChange = (
    id: string,
    sequence: NonNullable<ArtefactItem["sequence"]>,
  ) => {
    updateStoredArtefactSequence(id, sequence);
    setArtefacts((prev) => prev.map((a) => (a.id === id ? { ...a, sequence } : a)));
  };

  if (openArtefact) {
    return (
      <Layout>
        <ArtefactDetail
          artefact={openArtefact}
          onBack={() => setOpenId(null)}
          onDelete={handleDelete}
          onDownloadPdf={handleDownloadPdf}
          onSheetCellChange={handleSheetCellChange}
          onSequenceChange={handleSequenceChange}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            {activeFolder && !query ? (
              <button
                type="button"
                onClick={() => setActiveFolder(null)}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Artefacts
              </button>
            ) : (
              <span className="font-medium">Artefacts</span>
            )}
            {activeFolder && !query && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="font-medium">{activeFolder}</span>
              </>
            )}
          </div>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search artefacts"
            className="h-8 w-full max-w-xs text-xs"
          />
        </div>

        {renamingId && (
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-8 text-sm"
              placeholder="File name"
            />
            <Button size="sm" className="h-8 text-xs" onClick={handleRenameSave}>
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setRenamingId(null)}
            >
              Cancel
            </Button>
          </div>
        )}

        {!activeFolder && !query && folders.length > 0 && (
          <FolderList folders={folders} onOpen={setActiveFolder} />
        )}

        {visibleFiles.length > 0 ? (
          <div className="rounded-lg border">
            {visibleFiles.map((artefact) => (
              <ArtefactRow
                key={artefact.id}
                artefact={artefact}
                onOpen={setOpenId}
                onRename={handleRenameStart}
                onDelete={handleDelete}
                onDownloadPdf={handleDownloadPdf}
              />
            ))}
          </div>
        ) : (
          folders.length === 0 && (
            <div className="rounded-lg border p-10 text-center">
              <FolderOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="mb-1 text-sm font-semibold">
                {query ? "No matches" : "Nothing stored yet"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {query
                  ? "Try a different search."
                  : "Save a matched-leads sheet from Signals and it will be filed here."}
              </p>
            </div>
          )
        )}
      </div>
    </Layout>
  );
};

export default ArtifactsPage;
