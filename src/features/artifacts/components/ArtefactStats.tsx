import { AlertCircle, CheckCircle, FileText } from "lucide-react";

import type { ArtefactItem } from "../types";

import { Card, CardContent } from "@/components/ui/card";

interface ArtefactStatsProps {
  artefacts: ArtefactItem[];
}

export const ArtefactStats = ({ artefacts }: ArtefactStatsProps) => {
  return (
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
  );
};
