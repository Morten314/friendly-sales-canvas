import { X, Bot, Send } from "lucide-react";

import type { ContextualSuggestion, SignalCard as SignalCardType } from "../types";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

interface SignalChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSignal: SignalCardType | null;
  chatMessage: string;
  onChatMessageChange: (value: string) => void;
  /** Greeting line for the selected signal (page-held user context). */
  getContextualGreeting: (signal: SignalCardType) => string;
  /** Quick-action suggestions for a signal when it has none of its own. */
  getContextualSuggestions: (signal: SignalCardType) => ContextualSuggestion[];
  /** Delegate a quick-action suggestion to the agent (page toasts + closes). */
  onDelegateSuggestion: (suggestion: ContextualSuggestion) => void;
  /** Save the typed notes (page reads chatMessage, toasts, clears + closes). */
  onSaveNotes: () => void;
}

export const SignalChatPanel = ({
  open,
  onOpenChange,
  selectedSignal,
  chatMessage,
  onChatMessageChange,
  getContextualGreeting,
  getContextualSuggestions,
  onDelegateSuggestion,
  onSaveNotes,
}: SignalChatPanelProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <DrawerTitle className="text-base font-semibold">Agent Discussion</DrawerTitle>
                <p className="text-xs text-gray-600">
                  {selectedSignal
                    ? getContextualGreeting(selectedSignal)
                    : "Let's analyze this signal together"}
                </p>
              </div>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="px-4 pb-4 flex-1 overflow-y-auto">
          {selectedSignal && (
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-1">{selectedSignal.headline}</h3>
                <p className="text-xs text-gray-600">{selectedSignal.snippet}</p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900">Quick Actions:</h4>
                <div className="grid grid-cols-1 gap-1.5">
                  {(selectedSignal.contextualSuggestions &&
                  selectedSignal.contextualSuggestions.length > 0
                    ? selectedSignal.contextualSuggestions
                    : getContextualSuggestions(selectedSignal)
                  ).map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="justify-start text-left h-auto p-2 bg-white hover:bg-blue-50 border-gray-200 hover:border-blue-300"
                      onClick={() => {
                        onDelegateSuggestion(suggestion);
                      }}
                    >
                      <span className="mr-2 text-sm">{suggestion.icon}</span>
                      <span className="text-xs">{suggestion.text}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700">
                  Add specific notes or comments for this insight:
                </label>
                <div className="flex gap-2">
                  <Input
                    value={chatMessage}
                    onChange={(e) => onChatMessageChange(e.target.value)}
                    placeholder="Type your thoughts, questions, or specific instructions..."
                    className="flex-1 text-sm"
                  />
                  <Button
                    onClick={() => {
                      onSaveNotes();
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
