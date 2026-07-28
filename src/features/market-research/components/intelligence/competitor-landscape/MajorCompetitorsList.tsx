import { BarChart3, Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface MajorCompetitorsListProps {
  isEditing: boolean;
  localCompetitors: string[];
  setLocalCompetitors: (competitors: string[]) => void;
  handleSaveMajorCompetitors: () => void;
}

export function MajorCompetitorsList({
  isEditing,
  localCompetitors,
  setLocalCompetitors,
  handleSaveMajorCompetitors,
}: MajorCompetitorsListProps) {
  const tags = localCompetitors;

  if (!tags || tags.length === 0) return null;

  return (
    <div className="relative group">
      {isEditing && (
        <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveMajorCompetitors}
                className="text-gray-400 hover:text-green-600 hover:bg-green-50"
                title="Commit changes"
              >
                <Check className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Commit changes</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-blue-600" />
        Major Competitors
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {tags.map((competitor, index) => (
          <div
            key={index}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            {isEditing ? (
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <Input
                    value={competitor}
                    onChange={(e) => {
                      const updated = [...localCompetitors];
                      updated[index] = e.target.value;
                      setLocalCompetitors(updated);
                    }}
                    className="font-semibold text-gray-900 bg-white"
                    placeholder="Competitor name"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-700 border-green-200"
                  >
                    Competitor
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLocalCompetitors(localCompetitors.filter((_, i) => i !== index));
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">{competitor}</h4>
                  <p className="text-sm text-blue-600 font-medium">Market Player</p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                  Competitor
                </Badge>
              </div>
            )}
          </div>
        ))}
      </div>
      {isEditing && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocalCompetitors([...localCompetitors, ""])}
          className="mb-8"
        >
          Add Competitor
        </Button>
      )}
    </div>
  );
}
