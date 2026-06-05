import { Bot } from "lucide-react";

/** Loading spinner shown while signals are being fetched. */
export const SignalsLoadingState = () => {
  return (
    <div className="text-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading signals...</p>
    </div>
  );
};

/** Empty state shown when there are no signals to display. */
export const SignalsEmptyState = () => {
  return (
    <div className="text-center py-12">
      <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No signals available</h3>
      <p className="text-gray-500 mb-4">Click refresh in the header to generate new signals</p>
    </div>
  );
};
