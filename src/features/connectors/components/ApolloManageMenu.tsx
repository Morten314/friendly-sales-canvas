import { Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  onUpdateKey: () => void;
  onDisconnect: () => void;
}

/** Gear menu on a connected Apollo tile: Update API key / Disconnect Apollo (spec 40 §5.1). */
export function ApolloManageMenu({ onUpdateKey, onDisconnect }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Apollo settings">
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onUpdateKey}>Update API key</DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDisconnect}
          className="text-destructive focus:text-destructive"
        >
          Disconnect Apollo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
