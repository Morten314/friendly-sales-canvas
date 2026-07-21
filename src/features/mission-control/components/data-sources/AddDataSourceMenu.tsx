import { Plus, Link as LinkIcon, Upload, ChevronDown, Plug, Users } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AddDataSourceMenuProps {
  align?: "end" | "center";
  onAddUrl: () => void;
  onAddFile: () => void;
  onConnectCRM: (crmSystem: string) => void;
  onShowLeadUpload: () => void;
}

const AddDataSourceMenu: React.FC<AddDataSourceMenuProps> = ({
  align = "end",
  onAddUrl,
  onAddFile,
  onConnectCRM,
  onShowLeadUpload,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Data Source
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel>Add Data Source</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAddUrl}>
          <LinkIcon className="mr-2 h-4 w-4" />
          Add URL
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddFile}>
          <Upload className="mr-2 h-4 w-4" />
          Upload File
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Plug className="mr-2 h-4 w-4" />
            Connect to Systems
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuLabel>Connect a system</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onConnectCRM("Salesforce")}>
              <Plug className="mr-2 h-4 w-4" />
              Salesforce
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onConnectCRM("HubSpot")}>
              <Plug className="mr-2 h-4 w-4" />
              HubSpot
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onConnectCRM("Pipedrive")}>
              <Plug className="mr-2 h-4 w-4" />
              Pipedrive
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowLeadUpload}>
              <Users className="mr-2 h-4 w-4" />
              Lead stream
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AddDataSourceMenu;
