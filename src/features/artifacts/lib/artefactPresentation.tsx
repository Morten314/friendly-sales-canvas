import {
  AlertCircle,
  BarChart,
  CheckCircle,
  FileText,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import type { ArtefactItem } from "../types";

export const getTypeIcon = (type: ArtefactItem["type"]) => {
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

export const getStatusIcon = (status: ArtefactItem["status"]) => {
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
