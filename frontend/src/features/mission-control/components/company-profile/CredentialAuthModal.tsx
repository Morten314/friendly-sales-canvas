import { CheckCircle, RefreshCw, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Shared 2-step (login -> permissions) credential-auth modal for the
 * platform connectors that authenticate with email/password: Salesforce,
 * HubSpot, Pipedrive, Zoho CRM, LinkedIn, X, and Mixpanel.
 *
 * PARITY: collapses up to 7 near-identical inline `<Dialog>` blocks that
 * previously lived in ConnectorApprovals. The rendered markup is preserved
 * byte-for-byte per platform via props:
 *   - platform name (title / description / demo note),
 *   - demo-note `platformIcon`,
 *   - input `idPrefix` (e.g. "salesforce" -> id="salesforce-email"),
 *   - the resolved `permissions` list (LinkedIn's Company-vs-Sales-Navigator
 *     branch is resolved by the caller and passed in),
 *   - and the handful of copy overrides that Mixpanel needs (login/deny/approve
 *     button labels, the permissions title + description, and whether the
 *     "Requested Permissions:" sub-header is shown).
 *
 * The defaults reproduce the six standard connectors with no extra props; only
 * Mixpanel supplies the override props.
 *
 * These modals currently have NO live open-trigger (known dead UI, see
 * ConnectorApprovals) — preserved AS-IS.
 */
export interface CredentialAuthModalPermission {
  label: string;
  description: string;
}

interface CredentialAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platformName: string;
  platformIcon: LucideIcon;
  idPrefix: string;
  email: string;
  password: string;
  isLoggingIn: boolean;
  authStep: "login" | "permissions";
  permissions: CredentialAuthModalPermission[];
  accountDisplay: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLogin: () => void;
  onCancel: () => void;
  onApprove: () => void;
  onDeny: () => void;
  /** Login-step submit label. Default "Sign In" (Mixpanel: "Continue"). */
  loginLabel?: string;
  /** Permissions-step title. Default "Authorize Access". */
  permissionsTitle?: string;
  /**
   * Permissions-step description. Default reproduces the standard
   * "This application would like to access ... from your {platform} account:".
   */
  permissionsDescription?: string;
  /** Whether to render the "Requested Permissions:" sub-header. Default true. */
  showRequestedPermissionsHeader?: boolean;
  /** Deny-button label. Default "Deny" (Mixpanel: "Cancel"). */
  denyLabel?: string;
  /** Approve-button label. Default "Approve" (Mixpanel: "Allow Access"). */
  approveLabel?: string;
}

export default function CredentialAuthModal({
  open,
  onOpenChange,
  platformName,
  platformIcon: PlatformIcon,
  idPrefix,
  email,
  password,
  isLoggingIn,
  authStep,
  permissions,
  accountDisplay,
  onEmailChange,
  onPasswordChange,
  onLogin,
  onCancel,
  onApprove,
  onDeny,
  loginLabel = "Sign In",
  permissionsTitle = "Authorize Access",
  permissionsDescription = `This application would like to access the following data from your ${platformName} account:`,
  showRequestedPermissionsHeader = true,
  denyLabel = "Deny",
  approveLabel = "Approve",
}: CredentialAuthModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {authStep === "login" ? (
          <>
            <DialogHeader>
              <DialogTitle>Sign in to {platformName}</DialogTitle>
              <DialogDescription>
                Enter your {platformName} credentials to continue.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-email`}>Email</Label>
                <Input
                  id={`${idPrefix}-email`}
                  type="email"
                  placeholder="your.email@company.com"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  disabled={isLoggingIn}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-password`}>Password</Label>
                <Input
                  id={`${idPrefix}-password`}
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  disabled={isLoggingIn}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLoggingIn) {
                      onLogin();
                    }
                  }}
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PlatformIcon className="h-4 w-4" />
                <span>This is a demo. Any credentials will work.</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onCancel} disabled={isLoggingIn}>
                Cancel
              </Button>
              <Button onClick={onLogin} disabled={isLoggingIn || !email || !password}>
                {isLoggingIn ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  loginLabel
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{permissionsTitle}</DialogTitle>
              <DialogDescription>{permissionsDescription}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="border rounded-lg p-4 space-y-3">
                {showRequestedPermissionsHeader && (
                  <p className="text-sm font-semibold">Requested Permissions:</p>
                )}
                <ul className="space-y-2 text-sm">
                  {permissions.map((permission) => (
                    <li key={permission.label} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>{permission.label}</strong> - {permission.description}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                <p className="font-medium mb-1">Account:</p>
                <p>{accountDisplay}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onDeny}>
                {denyLabel}
              </Button>
              <Button onClick={onApprove} className="bg-green-600 hover:bg-green-700">
                {approveLabel}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
