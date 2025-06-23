
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { History, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";

interface DataHistoryEntry {
  timestamp: Date;
  type: 'fetch' | 'refresh' | 'scout_trigger';
  status: 'success' | 'error' | 'loading';
  source: 'cache' | 'api';
  details?: string;
  dataSize?: number;
}

// Mock history data - in a real app this would come from a store or API
const mockHistory: DataHistoryEntry[] = [
  {
    timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    type: 'refresh',
    status: 'success',
    source: 'api',
    details: 'Scout triggered and market data refreshed',
    dataSize: 15
  },
  {
    timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
    type: 'fetch',
    status: 'success',
    source: 'cache',
    details: 'Loaded cached market intelligence data',
    dataSize: 15
  },
  {
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    type: 'scout_trigger',
    status: 'error',
    source: 'api',
    details: 'Scout deployment failed - network timeout'
  },
  {
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    type: 'fetch',
    status: 'success',
    source: 'api',
    details: 'Initial market data fetch completed',
    dataSize: 12
  }
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'loading':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-600" />;
  }
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    success: "default",
    error: "destructive",
    loading: "secondary"
  };
  
  return (
    <Badge variant={variants[status] || "outline"} className="text-xs">
      {status}
    </Badge>
  );
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'refresh':
      return <RefreshCw className="h-4 w-4 text-blue-600" />;
    case 'scout_trigger':
      return <RefreshCw className="h-4 w-4 text-purple-600" />;
    default:
      return <History className="h-4 w-4 text-gray-600" />;
  }
};

const formatTimeAgo = (timestamp: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins} minutes ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else {
    return `${diffDays} days ago`;
  }
};

export const DataHistoryDialog = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <History className="h-4 w-4" />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Data Load History
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {mockHistory.map((entry, index) => (
              <div key={index} className="flex items-start gap-3 p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 mt-1">
                  {getTypeIcon(entry.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm capitalize">
                        {entry.type.replace('_', ' ')}
                      </span>
                      {getStatusBadge(entry.status)}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {getStatusIcon(entry.status)}
                      <span>{formatTimeAgo(entry.timestamp)}</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">
                    {entry.details}
                  </p>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${
                        entry.source === 'api' ? 'bg-blue-500' : 'bg-green-500'
                      }`} />
                      {entry.source === 'api' ? 'Fresh data' : 'Cached data'}
                    </span>
                    
                    {entry.dataSize && (
                      <span>
                        {entry.dataSize} records loaded
                      </span>
                    )}
                    
                    <span className="text-gray-400">
                      {entry.timestamp.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="pt-4 border-t">
          <p className="text-xs text-gray-500 text-center">
            Showing data load history for the current session
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
