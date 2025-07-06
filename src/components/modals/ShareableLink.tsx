
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

interface ShareableLinkProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareableLink = ({ isOpen, onClose }: ShareableLinkProps) => {
  const shareableUrl = "https://example.com/shared-report/abc123";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    console.log('Link copied to clipboard');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Shareable Link</DialogTitle>
          <DialogDescription>
            Share your market research report with others using this link.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input value={shareableUrl} readOnly />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handleCopyLink}>
              Copy Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
