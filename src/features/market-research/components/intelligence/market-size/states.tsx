import { Bot } from "lucide-react";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// LoadingState
// ---------------------------------------------------------------------------

export function LoadingState() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading market size data...</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorState
// ---------------------------------------------------------------------------

export interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <span className="text-red-700 text-sm font-medium">Error loading data</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          Retry
        </Button>
      </div>
      <p className="text-red-600 text-sm mt-2">{message ?? "Failed to load market size data"}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NoDataState
// ---------------------------------------------------------------------------

export interface NoDataStateProps {
  onGenerate: () => void;
}

export function NoDataState({ onGenerate }: NoDataStateProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No market size data available</p>
        <Button onClick={onGenerate} variant="outline" className="opacity-50">
          <Bot className="h-4 w-4 mr-2 text-gray-400" />
          Generate Report with Scout
        </Button>
      </div>
    </div>
  );
}
