import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface CompetitorNewsFeedProps {
  isEditing: boolean;
  localHeadlines: string[];
  setLocalHeadlines: (headlines: string[]) => void;
}

export function CompetitorNewsFeed({
  isEditing,
  localHeadlines,
  setLocalHeadlines,
}: CompetitorNewsFeedProps) {
  const displayHeadlines = localHeadlines;

  if (!displayHeadlines || displayHeadlines.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Latest News</h3>
      <div className="space-y-3">
        {displayHeadlines.map((headline, index) => (
          <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            {isEditing ? (
              <div className="flex gap-2">
                <Textarea
                  value={headline}
                  onChange={(e) => {
                    const updated = [...localHeadlines];
                    updated[index] = e.target.value;
                    setLocalHeadlines(updated);
                  }}
                  className="flex-1 text-gray-900 bg-white"
                  placeholder="News headline"
                  rows={2}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLocalHeadlines(localHeadlines.filter((_, i) => i !== index));
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-gray-900">{headline}</p>
            )}
          </div>
        ))}
      </div>
      {isEditing && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocalHeadlines([...localHeadlines, ""])}
          className="mt-2"
        >
          Add News Headline
        </Button>
      )}
    </div>
  );
}
