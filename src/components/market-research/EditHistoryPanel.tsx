
import React from 'react';
import { Clock, X, RotateCcw, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EditRecord {
  id: string;
  timestamp: string;
  user: string;
  summary: string;
  field: string;
  oldValue: string;
  newValue: string;
}

interface EditHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  editHistory: EditRecord[];
  onRevert: (editId: string) => void;
  onViewDetails: (editId: string) => void;
  context?: string;
}

const EditHistoryPanel: React.FC<EditHistoryPanelProps> = ({
  isOpen,
  onClose,
  editHistory,
  onRevert,
  onViewDetails,
  context = 'Market Size & Opportunity'
}) => {
  if (!isOpen) return null;

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric'
    }) + ' — ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-2/5 bg-white border-l border-gray-200 shadow-2xl z-50 animate-slide-in-right">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Edit History</h3>
                <p className="text-sm text-gray-600">{context}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="hover:bg-gray-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 p-6">
            {editHistory.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No edits yet</p>
                <p className="text-sm text-gray-400">Changes will appear here as you edit the report</p>
              </div>
            ) : (
              <div className="space-y-4">
                {editHistory.map((edit, index) => (
                  <div
                    key={edit.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatTimestamp(edit.timestamp)}
                        </p>
                        <p className="text-xs text-gray-500">by {edit.user}</p>
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        Edit #{editHistory.length - index}
                      </span>
                    </div>

                    <div className="mb-3">
                      <p className="text-sm text-gray-700 mb-2">{edit.summary}</p>
                      <div className="bg-gray-50 p-3 rounded-md text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-600">{edit.field}:</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-red-600 line-through">{edit.oldValue}</span>
                            <span className="text-xs text-gray-400">→</span>
                            <span className="text-green-600 font-medium">{edit.newValue}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDetails(edit.id)}
                        className="flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRevert(edit.id)}
                        className="flex items-center gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Revert to this version
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </>
  );
};

export default EditHistoryPanel;
