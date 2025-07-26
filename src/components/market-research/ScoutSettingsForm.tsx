import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CompanyProfile } from "@/components/settings/CompanyProfile";

interface ScoutSettingsFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScoutSettingsForm({ isOpen, onOpenChange }: ScoutSettingsFormProps) {
  // Function to handle company profile updates
  const handleCompanyProfileUpdate = () => {
    // Emit custom event to notify other components
    const event = new CustomEvent('companyProfileUpdated', {
      detail: { timestamp: new Date().toISOString() }
    });
    window.dispatchEvent(event);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Company Profile</h2>
            <CompanyProfile onProfileUpdate={handleCompanyProfileUpdate} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}