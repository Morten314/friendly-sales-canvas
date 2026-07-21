import { Loader2, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// LoadingState
// ---------------------------------------------------------------------------

export function LoadingState() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Zap className="h-5 w-5 text-purple-600" />
          Industry Trends
        </h2>
      </div>
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading industry trends data...</p>
        </div>
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
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Zap className="h-5 w-5 text-purple-600" />
          Industry Trends
        </h2>
      </div>
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">Error loading industry trends data: {message}</p>
        <Button onClick={onRetry} variant="outline">
          Retry
        </Button>
      </div>
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Zap className="h-5 w-5 text-purple-600" />
          Industry Trends
        </h2>
      </div>
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No industry trends data available</p>
        <Button onClick={onGenerate} variant="outline">
          Generate Report
        </Button>
      </div>
    </div>
  );
}
