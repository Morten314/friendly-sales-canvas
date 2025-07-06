
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';

interface ExportPDFProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportPDF = ({ isOpen, onClose }: ExportPDFProps) => {
  const handleExport = () => {
    // Export logic would go here
    console.log('Exporting PDF...');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export to PDF</DialogTitle>
          <DialogDescription>
            Export your market research report as a PDF document.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport}>
            Export PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
