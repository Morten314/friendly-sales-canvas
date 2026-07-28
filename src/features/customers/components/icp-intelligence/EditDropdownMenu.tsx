// Lives in features/customers — its only consumers are the customers
// icp-intelligence tables. Relocated here (TD-FE-63).

import { Edit, Pencil } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface EditDropdownMenuProps {
  onModify: () => void;
  className?: string;
}

export const EditDropdownMenu: React.FC<EditDropdownMenuProps> = ({ onModify, className = "" }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`text-blue-800 hover:text-blue-900 pointer-events-auto ${className}`}
          disabled={false}
        >
          <Edit className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-white border shadow-lg z-50">
        <DropdownMenuItem
          onClick={onModify}
          className="flex items-center gap-2 cursor-pointer hover:bg-gray-50"
        >
          <Pencil className="h-4 w-4" />
          Modify
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
