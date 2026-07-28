// Pure render helpers, lifted from DataSourcesManager so the split children and
// the container can share them. These read only their argument — no component
// state/prop closure — so lifting them is behavior-neutral.

import { Globe, FileText, Settings } from "lucide-react";

import type { DataSourceStatus, DataSourceType } from "../../types";

import { Badge } from "@/components/ui/badge";

/** Status badge for a data source / lead-stream row. */
export const getStatusBadge = (status: DataSourceStatus) => {
  switch (status) {
    case "active":
    case "completed":
      return (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
        >
          🟢 {status === "completed" ? "Completed" : "Active"}
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
        >
          🔴 Failed
        </Badge>
      );
    case "processing":
      return (
        <Badge
          variant="outline"
          className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800"
        >
          🟡 Processing
        </Badge>
      );
  }
};

/** Type icon for a data source row. */
export const getTypeIcon = (type: DataSourceType) => {
  switch (type) {
    case "url":
      return <Globe className="h-4 w-4 text-muted-foreground" />;
    case "file":
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    case "system":
      return <Settings className="h-4 w-4 text-muted-foreground" />;
  }
};
