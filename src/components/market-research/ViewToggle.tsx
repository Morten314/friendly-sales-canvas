import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { User, Bot } from "lucide-react";

interface ViewToggleProps {
  onViewChange: (isAIView: boolean) => void;
}

export const ViewToggle = ({ onViewChange }: ViewToggleProps) => {
  const [isAIView, setIsAIView] = useState(false);

  const handleToggleChange = (checked: boolean) => {
    setIsAIView(checked);
    onViewChange(checked);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-white rounded-full shadow-lg p-2 flex items-center gap-3 border border-gray-200">
      <div className="flex items-center gap-2 px-2">
        <User className="h-4 w-4 text-blue-600" />
        <Label htmlFor="view-mode" className="text-sm font-medium">User</Label>
      </div>
      
      <Switch
        id="view-mode"
        checked={isAIView}
        onCheckedChange={handleToggleChange}
      />
      
      <div className="flex items-center gap-2 px-2">
        <Bot className="h-4 w-4 text-purple-600" />
        <Label htmlFor="view-mode" className="text-sm font-medium">AI</Label>
      </div>
    </div>
  );
};
