import { Globe, CheckCircle, RefreshCw } from "lucide-react";
import { useState } from "react";

import type { DataSource } from "./connectorTypes";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

/**
 * Google Analytics auth modal — a DISTINCT 3-step OAuth flow
 * (signin -> permissions -> success), unlike the credential-based 2-step
 * connectors. Self-contained: owns its email / signing-in / step state.
 *
 * PARITY: relocated verbatim from ConnectorApprovals. The only change is that
 * the `onDataSourcesChange`-based connect mutation is supplied by the parent as
 * `onConnected(source, account)`; the success-step transition, toast, and the
 * setTimeout-delayed close remain here exactly as before. The mock account
 * email (owned here) is forwarded so the parent's mutation stays byte-identical.
 */
interface GoogleAnalyticsAuthModalProps {
  open: boolean;
  source: DataSource | null;
  onConnected: (source: DataSource, account: string) => void;
  onClose: () => void;
}

export default function GoogleAnalyticsAuthModal({
  open,
  source,
  onConnected,
  onClose,
}: GoogleAnalyticsAuthModalProps) {
  const { toast } = useToast();

  const [googleAnalyticsEmail, setGoogleAnalyticsEmail] = useState("");
  const [isGoogleAnalyticsSigningIn, setIsGoogleAnalyticsSigningIn] = useState(false);
  const [googleAnalyticsAuthStep, setGoogleAnalyticsAuthStep] = useState<
    "signin" | "permissions" | "success"
  >("signin");

  const resetGoogleAnalyticsAuthModal = () => {
    setGoogleAnalyticsEmail("");
    setGoogleAnalyticsAuthStep("signin");
    onClose();
  };

  const handleGoogleAnalyticsSignIn = async () => {
    if (!source) return;

    setIsGoogleAnalyticsSigningIn(true);

    // Simulate Google OAuth sign-in process, then show consent screen
    setTimeout(() => {
      setIsGoogleAnalyticsSigningIn(false);
      setGoogleAnalyticsAuthStep("permissions");
      // Set a mock email from Google account
      setGoogleAnalyticsEmail("user@gmail.com");
    }, 1500);
  };

  const handleGoogleAnalyticsApprove = () => {
    if (!source) return;

    // Update data source to connected
    onConnected(source, googleAnalyticsEmail);

    // Show success state, then close modal after a brief delay
    setGoogleAnalyticsAuthStep("success");

    toast({
      title: "Google Analytics connected successfully",
      description:
        "Your Google Analytics account is now connected and syncing. Records and sync options are now available.",
    });

    // Close modal after showing success message
    setTimeout(() => {
      resetGoogleAnalyticsAuthModal();
    }, 1500);
  };

  const handleGoogleAnalyticsDeny = () => {
    // Close modal and reset form
    resetGoogleAnalyticsAuthModal();

    toast({
      title: "Connection not authorized",
      description: "You denied access to your Google Analytics account.",
      variant: "default",
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          resetGoogleAnalyticsAuthModal();
        }
      }}
    >
      <DialogContent className="max-w-md">
        {googleAnalyticsAuthStep === "signin" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-600" />
                Connect Google Analytics
              </DialogTitle>
              <DialogDescription>
                Sign in with your Google account to connect Google Analytics
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-6">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg w-full">
                  <p className="text-sm text-center text-muted-foreground mb-4">
                    This will open Google's sign-in page in a new window
                  </p>
                  <Button
                    onClick={handleGoogleAnalyticsSignIn}
                    disabled={isGoogleAnalyticsSigningIn}
                    className="w-full h-12 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm font-medium flex items-center justify-center gap-3"
                  >
                    {isGoogleAnalyticsSigningIn ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        Sign in with Google
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <span>This is a demo. Clicking will simulate Google sign-in.</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={resetGoogleAnalyticsAuthModal}
                disabled={isGoogleAnalyticsSigningIn}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : googleAnalyticsAuthStep === "permissions" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-600" />
                Google Account
              </DialogTitle>
              <DialogDescription>
                This app wants to access your Google Analytics data
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="border rounded-lg p-4 space-y-3 bg-white">
                <div className="flex items-center gap-3 pb-3 border-b">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">
                      {googleAnalyticsEmail.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{googleAnalyticsEmail}</p>
                    <p className="text-xs text-muted-foreground">Google Account</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-3">This will allow:</p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>View your Google Analytics data</strong> - Read analytics reports
                        and metrics
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>View your Analytics properties</strong> - Access property
                        information and settings
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>View your Analytics reports</strong> - Read page views, events, and
                        user data
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="pt-3 border-t text-xs text-muted-foreground">
                  <p>
                    By continuing, you allow this app to access your Google Analytics data. You can
                    revoke access at any time in your Google Account settings.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleGoogleAnalyticsDeny}>
                Cancel
              </Button>
              <Button
                onClick={handleGoogleAnalyticsApprove}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Allow
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Connected Successfully
              </DialogTitle>
              <DialogDescription>Google Analytics has been connected</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-6">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-lg">Google Analytics Connected</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your Google Analytics account is now connected and syncing.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={resetGoogleAnalyticsAuthModal}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
