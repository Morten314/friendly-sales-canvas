import { Bot } from "lucide-react";
import React, { useState, useEffect } from "react";

import { ArtefactStats } from "../components/ArtefactStats";
import { FolderGrid } from "../components/FolderGrid";
import { LibraryCard } from "../components/LibraryCard";
import { mockArtefacts } from "../data/mockArtefacts";
import { generateAndDownloadPDF } from "../lib/artefactPdf";
import { drainArtefactQueue } from "../lib/artefactQueue";
import type { ArtefactItem } from "../types";

import { Card, CardContent } from "@/components/ui/card";
import { Layout } from "@/features/shell";
import { usePageTitle } from "@/shared/hooks/usePageTitle";

const ArtifactsPage = () => {
  usePageTitle("Artefacts - Brewra");
  const [artefacts, setArtefacts] = useState<ArtefactItem[]>(mockArtefacts);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedArtefact, setExpandedArtefact] = useState<string | null>(null);
  const [editingArtefact, setEditingArtefact] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  // Listen for search events from header
  useEffect(() => {
    const handleSearch = (event: CustomEvent) => {
      setSearchQuery(event.detail.query);
    };

    window.addEventListener("artifactsSearch", handleSearch as EventListener);
    return () => {
      window.removeEventListener("artifactsSearch", handleSearch as EventListener);
    };
  }, []);

  // Listen for new artefacts from Strategist or other agents
  useEffect(() => {
    const handleAddArtefact = (event: CustomEvent) => {
      const newArtefact = event.detail as ArtefactItem;
      setArtefacts((prev) => [newArtefact, ...prev]);
      // If it has a folder, open that folder view
      if (newArtefact.folder) {
        setActiveFolder(newArtefact.folder);
      }
      setExpandedArtefact(newArtefact.id);
    };

    window.addEventListener("addArtefact", handleAddArtefact as EventListener);
    return () => {
      window.removeEventListener("addArtefact", handleAddArtefact as EventListener);
    };
  }, []);

  // Drain any artefacts enqueued before this page mounted (e.g. a Signal
  // Briefing saved from /signals). Mirrors the live addArtefact listener:
  // prepend, open the item's folder, and expand it — the folder step is
  // load-bearing because filteredArtefacts hides foldered items at the root.
  // Once-only: drainArtefactQueue() clears the queue, so a remount sees nothing.
  useEffect(() => {
    const queued = drainArtefactQueue();
    if (queued.length === 0) return;
    // Reverse so the most-recently-enqueued item ends up first, matching the
    // per-event prepend semantics of the live listener.
    setArtefacts((prev) => [...queued.slice().reverse(), ...prev]);
    const mostRecent = queued[queued.length - 1];
    if (mostRecent.folder) {
      setActiveFolder(mostRecent.folder);
    }
    setExpandedArtefact(mostRecent.id);
  }, []);

  // Get unique folders
  const folders = [...new Set(artefacts.filter((a) => a.folder).map((a) => a.folder!))];

  const filteredArtefacts = artefacts.filter((artefact) => {
    const matchesSearch =
      artefact.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      artefact.taskNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      artefact.actionDelegated.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeFolder) {
      return matchesSearch && artefact.folder === activeFolder;
    }
    return matchesSearch && !artefact.folder;
  });

  const handleArtefactClick = (id: string) => {
    setExpandedArtefact(expandedArtefact === id ? null : id);
  };

  const handleEditClick = (artefact: ArtefactItem, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setEditingArtefact(artefact.id);
    setEditName(artefact.fullReport.title);
  };

  const handleDeleteClick = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setArtefacts((prev) => prev.filter((artefact) => artefact.id !== id));
  };

  const handleSaveEdit = (id: string) => {
    setArtefacts((prev) =>
      prev.map((artefact) =>
        artefact.id === id
          ? { ...artefact, fullReport: { ...artefact.fullReport, title: editName } }
          : artefact,
      ),
    );
    setEditingArtefact(null);
    setEditName("");
  };

  const handleCancelEdit = () => {
    setEditingArtefact(null);
    setEditName("");
  };

  const handleDownloadClick = (artefact: ArtefactItem) => {
    // Mark as viewed if it was new
    if (artefact.status === "new") {
      setArtefacts((prev) =>
        prev.map((a) => (a.id === artefact.id ? { ...a, status: "viewed" as const } : a)),
      );
    }

    // Generate and download PDF
    generateAndDownloadPDF(artefact);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header - Content moved to main header */}

        {/* Stats */}
        <ArtefactStats artefacts={artefacts} />

        {/* Folders */}
        <FolderGrid
          folders={folders}
          activeFolder={activeFolder}
          onFolderSelect={setActiveFolder}
          artefacts={artefacts}
        />

        {/* Artefacts Library */}
        <div className="space-y-4">
          {filteredArtefacts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {activeFolder ? `No items in "${activeFolder}"` : "No artefacts found"}
                </h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search query"
                    : activeFolder
                      ? "Emails saved from Strategist will appear here"
                      : "Your agents will generate artefacts as they complete tasks"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredArtefacts.map((artefact) => (
              <LibraryCard
                key={artefact.id}
                artefact={artefact}
                expandedArtefact={expandedArtefact}
                editingArtefact={editingArtefact}
                editName={editName}
                onArtefactClick={handleArtefactClick}
                onEditClick={handleEditClick}
                onDeleteClick={handleDeleteClick}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                onDownloadClick={handleDownloadClick}
                onEditNameChange={setEditName}
              />
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ArtifactsPage;
