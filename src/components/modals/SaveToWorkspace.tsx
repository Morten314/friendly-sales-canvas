
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SaveToWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SaveToWorkspace = ({ isOpen, onClose }: SaveToWorkspaceProps) => {
  const handleSave = () => {
    // Save logic would go here
    console.log('Saving to workspace...');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save to Workspace</DialogTitle>
          <DialogDescription>
            Save your market research report to your workspace for future reference.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Report name..." />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
