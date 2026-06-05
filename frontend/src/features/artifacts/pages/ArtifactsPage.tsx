import {
  FileText,
  TrendingUp,
  Users,
  Target,
  BarChart,
  Clock,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  Bot,
  Edit,
  Trash2,
  FolderOpen,
  ChevronRight,
  Mail,
} from "lucide-react";
import React, { useState, useEffect } from "react";

import { mockArtefacts } from "../data/mockArtefacts";
import { generateAndDownloadPDF } from "../lib/artefactPdf";
import type { ArtefactItem } from "../types";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Layout } from "@/features/shell";
import { usePageTitle } from "@/hooks/usePageTitle";

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

  const getTypeIcon = (type: ArtefactItem["type"]) => {
    switch (type) {
      case "report":
        return FileText;
      case "analysis":
        return TrendingUp;
      case "insight":
        return Target;
      case "proposal":
        return BarChart;
      case "enrichment":
        return Users;
      case "playbook":
        return Target;
      default:
        return FileText;
    }
  };

  const getStatusIcon = (status: ArtefactItem["status"]) => {
    switch (status) {
      case "new":
        return <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />;
      case "viewed":
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case "updated":
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default:
        return null;
    }
  };

  // Library Card Component (Compact view)
  const LibraryCard = ({ artefact }: { artefact: ArtefactItem }) => {
    const TypeIcon = getTypeIcon(artefact.type);
    const isExpanded = expandedArtefact === artefact.id;
    const isEditing = editingArtefact === artefact.id;

    return (
      <Card
        className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${isExpanded ? "ring-2 ring-primary/20" : ""}`}
      >
        <CardContent className="p-4">
          {/* Library View - Compact */}
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className={`text-white text-sm font-medium ${artefact.agentColor}`}>
                <artefact.agentIcon className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{artefact.agentName}</span>
                <TypeIcon className="h-3 w-3 text-muted-foreground" />
                {getStatusIcon(artefact.status)}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{artefact.taskNumber}</span>
                <span>•</span>
                <Clock className="h-3 w-3" />
                <span>{artefact.timestamp}</span>
              </div>
            </div>
            {/* Edit and Delete Icons */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleEditClick(artefact, e)}
                className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleDeleteClick(artefact.id, e)}
                className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-sm font-semibold"
                placeholder="Enter report title"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleSaveEdit(artefact.id)}
                  className="h-6 px-2 text-xs"
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdit}
                  className="h-6 px-2 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start p-0 h-auto font-normal"
              onClick={() => handleArtefactClick(artefact.id)}
            >
              <span className="text-sm text-left truncate">{artefact.actionDelegated}</span>
            </Button>
          )}

          {/* Expanded View */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t space-y-4">
              {/* Context & Rationale */}
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-700 mb-1">Context & Rationale</p>
                  <p className="text-sm text-muted-foreground">{artefact.contextRationale}</p>
                </div>
              </div>

              {/* System Impact */}
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 mb-1">System Impact</p>
                  <p className="text-sm text-muted-foreground">{artefact.systemImpact}</p>
                </div>
              </div>

              {/* Action Performed - File Preview */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm">Action Performed</h4>
                </div>

                <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-sm">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-semibold text-sm mb-1 hover:text-primary transition-colors cursor-pointer truncate"
                        onClick={() => handleDownloadClick(artefact)}
                      >
                        {artefact.fullReport.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                        {artefact.outputSummary}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>PDF • 12 pages</span>
                        <span>•</span>
                        <span>{artefact.timestamp}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header - Content moved to main header */}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Artefacts</p>
                  <p className="text-2xl font-bold">{artefacts.length}</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">New</p>
                  <p className="text-2xl font-bold">
                    {artefacts.filter((a) => a.status === "new").length}
                  </p>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Viewed</p>
                  <p className="text-2xl font-bold">
                    {artefacts.filter((a) => a.status === "viewed").length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Updated</p>
                  <p className="text-2xl font-bold">
                    {artefacts.filter((a) => a.status === "updated").length}
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Folders */}
        {folders.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={activeFolder === null ? "default" : "outline"}
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => setActiveFolder(null)}
            >
              <FileText className="h-3.5 w-3.5" />
              All Artefacts
            </Button>
            {folders.map((folder) => {
              const count = artefacts.filter((a) => a.folder === folder).length;
              return (
                <Button
                  key={folder}
                  variant={activeFolder === folder ? "default" : "outline"}
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => setActiveFolder(folder)}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  {folder}
                  <Badge variant="secondary" className="text-[10px] ml-1 px-1.5 py-0">
                    {count}
                  </Badge>
                </Button>
              );
            })}
          </div>
        )}

        {/* Active folder header */}
        {activeFolder && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              onClick={() => setActiveFolder(null)}
              className="hover:text-foreground transition-colors"
            >
              Artefacts
            </button>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {activeFolder}
            </span>
          </div>
        )}

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
              <LibraryCard key={artefact.id} artefact={artefact} />
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ArtifactsPage;
