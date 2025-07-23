
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Clock, User } from "lucide-react";

interface EditHistoryEntry {
  id: string;
  timestamp: Date;
  user: string;
  changes: string[];
  previous: any;
  current: any;
}

interface ICPEditHistoryProps {
  icpId: string;
  history?: EditHistoryEntry[];
}

export const ICPEditHistory = ({ icpId, history = [] }: ICPEditHistoryProps) => {
  // Mock history data
  const mockHistory: EditHistoryEntry[] = [
    {
      id: "1",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      user: "Alex Thompson",
      changes: ["Industry changed from 'Fintech' to 'Banking'", "Company size updated"],
      previous: { industry: "Fintech" },
      current: { industry: "Banking" }
    },
    {
      id: "2", 
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      user: "Sarah Chen",
      changes: ["Decision makers updated", "Regions expanded"],
      previous: { regions: ["North America"] },
      current: { regions: ["North America", "EU"] }
    }
  ];

  const editHistory = history.length > 0 ? history : mockHistory;

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">
          <History className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Edit History
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {editHistory.map((entry) => (
            <div key={entry.id} className="border-l-2 border-blue-200 pl-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3 w-3" />
                  <span className="font-medium">{entry.user}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  {formatTime(entry.timestamp)}
                </div>
              </div>
              
              <div className="space-y-1">
                {entry.changes.map((change, index) => (
                  <Badge key={index} variant="outline" className="text-xs mr-1 mb-1">
                    {change}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
          
          {editHistory.length === 0 && (
            <p className="text-center text-gray-500 py-8">No edit history available</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
