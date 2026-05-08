import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import {
  Popover,
  PopoverContent,
} from "@/components/ui/popover";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullName: string;
  children: React.ReactNode;
}

export function ProfileDialog({ open, onOpenChange, fullName, children }: ProfileDialogProps) {
  const { currentUser } = useAuth();
  const { currentTenant } = useTenant();

  // Get user's email
  const userEmail = currentUser?.email || '';
  
  // Get organization domain or default to Brewra.com
  const organizationDomain = currentTenant?.domain || 'brewra.com';

  // Get initials for profile picture
  const getInitials = (name: string): string => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal={false}>
      {children}
      <PopoverContent 
        side="top" 
        align="start" 
        sideOffset={8}
        className="w-80 p-4 bg-white border border-gray-200 shadow-lg"
      >
        <div className="space-y-5">
          {/* Email and Managed by section */}
          <div className="space-y-2">
            <div>
              <a
                href={`mailto:${userEmail}`}
                className="text-blue-600 underline hover:text-blue-800 text-sm font-medium"
              >
                {userEmail}
              </a>
            </div>
            <div className="text-sm text-gray-700">
              Managed by{' '}
              <a
                href={`https://${organizationDomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                {organizationDomain}
              </a>
            </div>
          </div>

          {/* Profile Picture */}
          <div className="flex justify-center">
            <div className="w-32 h-32 rounded-full bg-gray-200 border border-gray-400 flex items-center justify-center">
              <div className="w-28 h-28 rounded-full bg-gray-100 border border-gray-400 flex items-center justify-center">
                <span className="text-3xl font-semibold text-gray-700">
                  {getInitials(fullName)}
                </span>
              </div>
            </div>
          </div>

          {/* Greeting */}
          <div className="text-center">
            <h3 className="text-xl font-medium text-gray-900">
              Hi {fullName || 'User'}!
            </h3>
          </div>

          {/* Manage Profile Text */}
          <div className="flex justify-center pt-2">
            <p className="text-sm text-gray-700">
              Manage your Profile
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

