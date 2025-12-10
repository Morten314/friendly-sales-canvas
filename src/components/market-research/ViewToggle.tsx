
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { User, Bot } from "lucide-react";

interface ViewToggleProps {
  onViewChange: (isAIView: boolean) => void;
}

export const ViewToggle = ({ onViewChange }: ViewToggleProps) => {
  const [isAIView, setIsAIView] = useState(true);

  const handleToggleChange = (checked: boolean) => {
    // Always keep AI mode enabled
    setIsAIView(true);
    onViewChange(true);
  };

  return (
    <div className="bg-gray-50 rounded-full shadow-sm p-2 flex items-center gap-3 border border-gray-200">
      <div className="flex items-center gap-2 px-2">
        <User className="h-4 w-4 text-blue-600" />
        <Label htmlFor="view-mode" className="text-sm font-medium">User</Label>
      </div>
      
      <Switch
        id="view-mode"
        checked={true}
        disabled={true}
      />
      
      <div className="flex items-center gap-2 px-2">
        <Bot className="h-4 w-4 text-purple-600" />
        <Label htmlFor="view-mode" className="text-sm font-medium">AI</Label>
      </div>
    </div>
  );
};
