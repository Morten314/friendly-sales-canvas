import {
  Database,
  Upload as UploadIcon,
  FileText,
  Users,
  MessageSquare,
  BarChart3,
  Linkedin,
  Twitter,
  XCircle,
  Plus,
  Slack,
} from "lucide-react";
import { useEffect, useState } from "react";

import ConfigurationDialog from "./ConfigurationDialog";
import {
  buildAnalyticsConnector,
  buildCompetitorConnector,
  buildCrmConnector,
  buildLinkedInConnector,
  buildOtherFileConnector,
  buildProductDocConnector,
  buildSlackConnector,
  buildTwitterConnector,
} from "./connectorFactory";
import type { Connector, DataSource } from "./connectorTypes";
import CredentialAuthModal from "./CredentialAuthModal";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import GoogleAnalyticsAuthModal from "./GoogleAnalyticsAuthModal";
import { useCredentialAuthModal } from "./useCredentialAuthModal";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

/**
 * Connector-approval cluster — the WRITE/OAuth flows for connecting external
 * data-source platforms (CRM, social, analytics, Slack, file uploads), plus the
 * delete + per-source config dialogs.
 *
 * PARITY MOVE: relocated verbatim out of MissionControlPage. The only change to
 * the moved handlers/JSX is `setDataSources(...)` -> `onDataSourcesChange(...)`
 * and reading the `dataSources` prop for the duplicate check.
 *
 * KNOWN DEAD CODE (TD): the catalog/auth/config/delete dialogs have NO live
 * open-triggers in the current app — the buttons that opened them were orphaned
 * in an earlier refactor. They are preserved here AS-IS (closed -> render
 * nothing visible). Do NOT "fix"/re-wire the missing triggers here (out of
 * scope, deferred). The Slack OAuth callback effect DOES still run on mount.
 */
interface ConnectorApprovalsProps {
  dataSources: DataSource[];
  onDataSourcesChange: React.Dispatch<React.SetStateAction<DataSource[]>>;
}

export default function ConnectorApprovals({
  dataSources,
  onDataSourcesChange,
}: ConnectorApprovalsProps) {
  const { toast } = useToast();

  const [isConnectorDialogOpen, setIsConnectorDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<DataSource | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [sourceToConfigure, setSourceToConfigure] = useState<DataSource | null>(null);
  const [configSyncFrequency, setConfigSyncFrequency] = useState<
    "realtime" | "hourly" | "4hours" | "daily" | "weekly" | "manual"
  >("daily");
  const [configObjects, setConfigObjects] = useState<string[]>([]);
  const [configFilters, setConfigFilters] = useState<string[]>([]);

  // Salesforce Auth Modal — generic credential-auth hook instance.
  // NOTE: the modal open-trigger + sourceToConnect setter are orphaned (the
  // buttons that opened this modal were removed in an earlier refactor), so the
  // open flag / source setter are intentionally not destructured here.
  const {
    isOpen: isSalesforceAuthModalOpen,
    email: salesforceEmail,
    setEmail: setSalesforceEmail,
    password: salesforcePassword,
    setPassword: setSalesforcePassword,
    isLoggingIn: isSalesforceLoggingIn,
    authStep: salesforceAuthStep,
    reset: resetSalesforceAuthModal,
    handleLogin: handleSalesforceLogin,
    handleApprove: handleSalesforceApprove,
    handleDeny: handleSalesforceDeny,
  } = useCredentialAuthModal({
    platformName: "Salesforce",
    onDataSourcesChange,
    toast,
    objectsSynced: ["Contacts", "Accounts", "Opportunities"],
    filters: ["Active records only"],
    successTitle: "Salesforce connected successfully",
    successDescription: "Your Salesforce account is now connected and syncing.",
    denyDescription: "You denied access to your Salesforce account.",
  });

  // HubSpot Auth Modal — generic credential-auth hook instance (open-trigger
  // orphaned; open flag / source setter intentionally not destructured)
  const {
    isOpen: isHubSpotAuthModalOpen,
    email: hubSpotEmail,
    setEmail: setHubSpotEmail,
    password: hubSpotPassword,
    setPassword: setHubSpotPassword,
    isLoggingIn: isHubSpotLoggingIn,
    authStep: hubSpotAuthStep,
    reset: resetHubSpotAuthModal,
    handleLogin: handleHubSpotLogin,
    handleApprove: handleHubSpotApprove,
    handleDeny: handleHubSpotDeny,
  } = useCredentialAuthModal({
    platformName: "HubSpot",
    onDataSourcesChange,
    toast,
    objectsSynced: ["Contacts", "Companies", "Deals", "Tickets"],
    filters: ["Active records only"],
    successTitle: "HubSpot connected successfully",
    successDescription:
      "Your HubSpot account is now connected and syncing. Records and sync options are now available.",
    denyDescription: "You denied access to your HubSpot account.",
  });

  // Pipedrive Auth Modal — generic credential-auth hook instance (open-trigger
  // orphaned; open flag / source setter intentionally not destructured)
  const {
    isOpen: isPipedriveAuthModalOpen,
    email: pipedriveEmail,
    setEmail: setPipedriveEmail,
    password: pipedrivePassword,
    setPassword: setPipedrivePassword,
    isLoggingIn: isPipedriveLoggingIn,
    authStep: pipedriveAuthStep,
    reset: resetPipedriveAuthModal,
    handleLogin: handlePipedriveLogin,
    handleApprove: handlePipedriveApprove,
    handleDeny: handlePipedriveDeny,
  } = useCredentialAuthModal({
    platformName: "Pipedrive",
    onDataSourcesChange,
    toast,
    objectsSynced: ["Deals", "Persons", "Organizations", "Activities"],
    filters: ["Active records only"],
    successTitle: "Pipedrive connected successfully",
    successDescription:
      "Your Pipedrive account is now connected and syncing. Records and sync options are now available.",
    denyDescription: "You denied access to your Pipedrive account.",
  });

  // Zoho Auth Modal — generic credential-auth hook instance (open-trigger
  // orphaned; open flag / source setter intentionally not destructured)
  const {
    isOpen: isZohoAuthModalOpen,
    email: zohoEmail,
    setEmail: setZohoEmail,
    password: zohoPassword,
    setPassword: setZohoPassword,
    isLoggingIn: isZohoLoggingIn,
    authStep: zohoAuthStep,
    reset: resetZohoAuthModal,
    handleLogin: handleZohoLogin,
    handleApprove: handleZohoApprove,
    handleDeny: handleZohoDeny,
  } = useCredentialAuthModal({
    platformName: "Zoho CRM",
    onDataSourcesChange,
    toast,
    objectsSynced: ["Contacts", "Accounts", "Deals", "Leads"],
    filters: ["Active records only"],
    successTitle: "Zoho CRM connected successfully",
    successDescription:
      "Your Zoho CRM account is now connected and syncing. Records and sync options are now available.",
    denyDescription: "You denied access to your Zoho CRM account.",
  });

  // LinkedIn Auth Modal — generic credential-auth hook instance.
  // `objectsSynced` is a resolver so the Company-vs-Sales-Navigator branch and
  // the dynamic success-toast title are reproduced exactly.
  const {
    isOpen: isLinkedInAuthModalOpen,
    sourceToConnect: linkedInSourceToConnect,
    email: linkedInEmail,
    setEmail: setLinkedInEmail,
    password: linkedInPassword,
    setPassword: setLinkedInPassword,
    isLoggingIn: isLinkedInLoggingIn,
    authStep: linkedInAuthStep,
    reset: resetLinkedInAuthModal,
    handleLogin: handleLinkedInLogin,
    handleApprove: handleLinkedInApprove,
    handleDeny: handleLinkedInDeny,
  } = useCredentialAuthModal({
    platformName: "LinkedIn",
    onDataSourcesChange,
    toast,
    objectsSynced: (source) =>
      source.name === "LinkedIn Company"
        ? ["Company Page", "Posts", "Followers"]
        : ["Company Pages", "Profiles", "Messages"],
    filters: ["Active profiles only"],
    successTitle: (source) => `${source.name} connected successfully`,
    successDescription:
      "Your LinkedIn account is now connected and syncing. Records and sync options are now available.",
    denyDescription: "You denied access to your LinkedIn account.",
  });

  // X (Twitter) Auth Modal — generic credential-auth hook instance (open-trigger
  // orphaned; open flag / source setter intentionally not destructured)
  const {
    isOpen: isXAuthModalOpen,
    email: xEmail,
    setEmail: setXEmail,
    password: xPassword,
    setPassword: setXPassword,
    isLoggingIn: isXLoggingIn,
    authStep: xAuthStep,
    reset: resetXAuthModal,
    handleLogin: handleXLogin,
    handleApprove: handleXApprove,
    handleDeny: handleXDeny,
  } = useCredentialAuthModal({
    platformName: "X",
    onDataSourcesChange,
    toast,
    objectsSynced: ["Profiles", "Tweets", "Engagements"],
    filters: ["Active profiles only"],
    successTitle: "X connected successfully",
    successDescription:
      "Your X account is now connected and syncing. Records and sync options are now available.",
    denyDescription: "You denied access to your X account.",
  });

  // Google Analytics Auth Modal state (open flag + source owned here; the
  // 3-step internal flow now lives in GoogleAnalyticsAuthModal)
  const [isGoogleAnalyticsAuthModalOpen, setIsGoogleAnalyticsAuthModalOpen] = useState(false);
  const [googleAnalyticsSourceToConnect, setGoogleAnalyticsSourceToConnect] =
    useState<DataSource | null>(null);

  // Mixpanel Auth Modal state
  const [isMixpanelAuthModalOpen, setIsMixpanelAuthModalOpen] = useState(false);
  const [mixpanelSourceToConnect, setMixpanelSourceToConnect] = useState<DataSource | null>(null);
  const [mixpanelEmail, setMixpanelEmail] = useState("");
  const [mixpanelPassword, setMixpanelPassword] = useState("");
  const [isMixpanelLoggingIn, setIsMixpanelLoggingIn] = useState(false);
  const [mixpanelAuthStep, setMixpanelAuthStep] = useState<"login" | "permissions">("login");

  // Form states for connector inputs
  const [selectedCrm, setSelectedCrm] = useState<string>("");
  const [linkedInUrls, setLinkedInUrls] = useState<string[]>([""]);
  const [selectedAnalytics, setSelectedAnalytics] = useState<string>("");
  const [competitors, setCompetitors] = useState<Array<{ name: string; url: string }>>([
    { name: "", url: "" },
  ]);
  const [slackConfigs, setSlackConfigs] = useState<Array<{ workspace: string; channel: string }>>([
    { workspace: "", channel: "" },
  ]);

  // File Sources state
  const [fileSources, setFileSources] = useState<
    Record<string, { file: File | null; destinationUrl: string }>
  >({
    "Call Transcripts": { file: null, destinationUrl: "" },
    "Meeting Notes": { file: null, destinationUrl: "" },
    "Case Studies": { file: null, destinationUrl: "" },
    "Support Tickets": { file: null, destinationUrl: "" },
    "Sales Presentations": { file: null, destinationUrl: "" },
  });

  // Product Documentation supports multiple files/destinations
  const [productDocFiles, setProductDocFiles] = useState<
    Array<{ file: File | null; destinationUrl: string }>
  >([{ file: null, destinationUrl: "" }]);

  const handleSaveConfiguration = () => {
    if (!sourceToConfigure) return;

    onDataSourcesChange((prev) =>
      prev.map((s) => {
        if (s.id === sourceToConfigure.id) {
          return {
            ...s,
            syncFrequency: configSyncFrequency,
            objectsSynced: configObjects,
            filters: configFilters,
          };
        }
        return s;
      }),
    );

    toast({
      title: "Configuration saved",
      description: `${sourceToConfigure.name} configuration has been updated successfully.`,
    });

    setConfigDialogOpen(false);
    setSourceToConfigure(null);
  };

  const handleGoogleAnalyticsConnected = (source: DataSource, account: string) => {
    // Update data source to connected
    onDataSourcesChange((prev) =>
      prev.map((s) => {
        if (s.id === source.id) {
          const mockData = {
            status: "connected" as const,
            account,
            connectedDate: new Date().toISOString().split("T")[0],
            lastSyncTime: "Just now",
            lastSyncStatus: "success" as const,
            totalRecords: Math.floor(Math.random() * 10000) + 500,
            newRecordsThisWeek: Math.floor(Math.random() * 500),
            updatedRecords: Math.floor(Math.random() * 200),
            dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
            objectsSynced: ["Page Views", "Events", "User Sessions", "Conversions"],
            fieldsMapped: Math.floor(Math.random() * 50) + 30,
            filters: ["Active properties only"],
          };
          return { ...s, ...mockData };
        }
        return s;
      }),
    );
  };

  const handleMixpanelLogin = async () => {
    if (!mixpanelSourceToConnect) return;

    if (!mixpanelEmail || !mixpanelPassword) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsMixpanelLoggingIn(true);

    // Simulate login process, then show permissions screen
    setTimeout(() => {
      setIsMixpanelLoggingIn(false);
      setMixpanelAuthStep("permissions");
    }, 1500);
  };

  const handleMixpanelApprove = () => {
    if (!mixpanelSourceToConnect) return;

    // Generate fake events count (124 as per requirement)
    const fakeEventsCount = 124;

    // Update data source to connected
    onDataSourcesChange((prev) =>
      prev.map((s) => {
        if (s.id === mixpanelSourceToConnect.id) {
          const mockData = {
            status: "connected" as const,
            account: mixpanelEmail,
            connectedDate: new Date().toISOString().split("T")[0],
            lastSyncTime: "Just now",
            lastSyncStatus: "success" as const,
            totalRecords: fakeEventsCount,
            newRecordsThisWeek: Math.floor(Math.random() * 500) + 100,
            updatedRecords: Math.floor(Math.random() * 200) + 50,
            dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
            objectsSynced: ["Page Viewed", "Sign Up", "Button Clicked", "Form Submitted"],
            fieldsMapped: Math.floor(Math.random() * 50) + 30,
            filters: ["Active projects only"],
          };
          return { ...s, ...mockData };
        }
        return s;
      }),
    );

    // Close modal and reset form
    setIsMixpanelAuthModalOpen(false);
    setMixpanelEmail("");
    setMixpanelPassword("");
    setMixpanelSourceToConnect(null);
    setMixpanelAuthStep("login");

    toast({
      title: "Mixpanel connected successfully",
      description:
        "Your Mixpanel account is now connected and syncing. Events and analytics are now available.",
    });
  };

  const handleMixpanelDeny = () => {
    // Close modal and reset form
    setIsMixpanelAuthModalOpen(false);
    setMixpanelEmail("");
    setMixpanelPassword("");
    setMixpanelSourceToConnect(null);
    setMixpanelAuthStep("login");

    toast({
      title: "Connection not authorized",
      description: "You denied access to your Mixpanel account.",
      variant: "default",
    });
  };

  // Handle Slack OAuth callback (check for code/state in URL params)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");

    if (error) {
      // User denied access
      toast({
        title: "Slack connection cancelled",
        description: "You cancelled the Slack authorization.",
        variant: "default",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      sessionStorage.removeItem("slackSourceToConnect");
      return;
    }

    if (code && state) {
      // OAuth callback received from Slack
      try {
        const storedSource = sessionStorage.getItem("slackSourceToConnect");

        if (storedSource) {
          const sourceData = JSON.parse(storedSource);

          // Update data source to connected
          onDataSourcesChange((prev) =>
            prev.map((s) => {
              if (
                s.id === sourceData.id ||
                s.name === sourceData.name ||
                s.name.startsWith("Slack")
              ) {
                const mockData = {
                  status: "connected" as const,
                  account: "slack@company.com",
                  connectedDate: new Date().toISOString().split("T")[0],
                  lastSyncTime: "Just now",
                  lastSyncStatus: "success" as const,
                  totalRecords: Math.floor(Math.random() * 5000) + 100,
                  newRecordsThisWeek: Math.floor(Math.random() * 500) + 50,
                  updatedRecords: Math.floor(Math.random() * 200) + 20,
                  dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
                  objectsSynced: ["Messages", "Channels", "Conversations"],
                  fieldsMapped: Math.floor(Math.random() * 50) + 20,
                  filters: ["Active channels only"],
                };
                return { ...s, ...mockData };
              }
              return s;
            }),
          );

          // Clean up
          sessionStorage.removeItem("slackSourceToConnect");

          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);

          toast({
            title: "Slack connected successfully",
            description:
              "Your Slack workspace is now connected and syncing. Messages and channels are now available.",
          });
        }
      } catch (err) {
        console.error("Error processing Slack callback:", err);
        toast({
          title: "Error processing Slack callback",
          description: "There was an error processing the Slack authorization. Please try again.",
          variant: "destructive",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only OAuth callback handler; toast is stable
  }, []);

  // Helper function to upload file to backend
  // Helper function to check document status
  // Helper function to load data sources from backend
  // New handlers for Add Source
  const handleConnectSource = (connector: Connector) => {
    // Check if source already exists (regardless of status)
    const existingSource = dataSources.find((s) => s.name === connector.name);
    if (existingSource) {
      if (existingSource.status === "connected" || existingSource.status === "uploaded") {
        toast({
          title: "Already connected",
          description: `${connector.name} is already connected.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Already added",
          description: `${connector.name} is already in your sources. Click "Connect" to set it up.`,
          variant: "default",
        });
      }
      setIsConnectorDialogOpen(false);
      return;
    }

    // Create new data source
    const newSource: DataSource = {
      id: connector.id,
      name: connector.name,
      type: connector.type,
      icon: connector.icon,
      platform: connector.platform,
      status: "disconnected",
      syncFrequency: "daily",
      totalRecords: 0,
      newRecordsThisWeek: 0,
      updatedRecords: 0,
      dataQualityScore: 0,
      objectsSynced: [],
      fieldsMapped: 0,
      filters: [],
      description: connector.description,
    };

    // Add to data sources
    onDataSourcesChange((prev) => {
      // Double-check to prevent duplicates
      const alreadyExists = prev.find((s) => s.id === newSource.id || s.name === newSource.name);
      if (alreadyExists) {
        return prev;
      }
      return [...prev, newSource];
    });

    // Close dialog
    setIsConnectorDialogOpen(false);

    toast({
      title: `${connector.name} added`,
      description: `Click "Connect" to set up the integration.`,
    });
  };

  return (
    <>
      {/* Connector Catalog Dialog */}
      <Dialog open={isConnectorDialogOpen} onOpenChange={setIsConnectorDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Data Source</DialogTitle>
            <DialogDescription>Configure and connect your data sources</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Accordion type="single" collapsible className="w-full">
              {/* CRM Section */}
              <AccordionItem value="crm">
                <AccordionTrigger className="font-semibold">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    CRM
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Select CRM Platform</Label>
                      <Select value={selectedCrm} onValueChange={setSelectedCrm}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a CRM platform" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="salesforce">Salesforce</SelectItem>
                          <SelectItem value="hubspot">HubSpot</SelectItem>
                          <SelectItem value="pipedrive">Pipedrive</SelectItem>
                          <SelectItem value="zoho">Zoho CRM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedCrm && (
                      <Button
                        onClick={() => {
                          const connector = buildCrmConnector(selectedCrm);
                          handleConnectSource(connector);
                          toast({
                            title: `${connector.name} added`,
                            description: "Click 'Connect' in the table to set up the integration.",
                          });
                          setIsConnectorDialogOpen(false);
                          setSelectedCrm("");
                        }}
                        className="w-full"
                      >
                        Add Source
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Social Section */}
              <AccordionItem value="social">
                <AccordionTrigger className="font-semibold">
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4" />
                    Social
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {/* LinkedIn */}
                    <div className="space-y-3">
                      <Label>LinkedIn</Label>
                      {linkedInUrls.map((url, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder="Enter LinkedIn URL"
                            value={url}
                            onChange={(e) => {
                              const newUrls = [...linkedInUrls];
                              newUrls[index] = e.target.value;
                              setLinkedInUrls(newUrls);
                            }}
                          />
                          {index === linkedInUrls.length - 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => setLinkedInUrls([...linkedInUrls, ""])}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                          {linkedInUrls.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                const newUrls = linkedInUrls.filter((_, i) => i !== index);
                                setLinkedInUrls(newUrls);
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {linkedInUrls.some((url) => url.trim() !== "") && (
                        <Button
                          onClick={() => {
                            const connector = buildLinkedInConnector(linkedInUrls);
                            handleConnectSource(connector);
                            toast({
                              title: "LinkedIn Sales Navigator added",
                              description:
                                "Click 'Connect' in the table to set up the integration.",
                            });
                            setIsConnectorDialogOpen(false);
                            setLinkedInUrls([""]);
                          }}
                          className="w-full"
                        >
                          Add Source
                        </Button>
                      )}
                    </div>

                    {/* Twitter */}
                    <div className="space-y-3 pt-4 border-t">
                      <Label>X</Label>
                      <Button
                        onClick={() => {
                          const connector = buildTwitterConnector();
                          handleConnectSource(connector);
                          toast({
                            title: "X added",
                            description: "Click 'Connect' in the table to set up the integration.",
                          });
                          setIsConnectorDialogOpen(false);
                        }}
                        className="w-full"
                      >
                        Add Source
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Analytics Section */}
              <AccordionItem value="analytics">
                <AccordionTrigger className="font-semibold">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Analytics
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Select Analytics Platform</Label>
                      <Select value={selectedAnalytics} onValueChange={setSelectedAnalytics}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an analytics platform" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="google-analytics">Google Analytics</SelectItem>
                          <SelectItem value="mixpanel">Mixpanel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedAnalytics && (
                      <Button
                        onClick={() => {
                          const connector = buildAnalyticsConnector(selectedAnalytics);
                          handleConnectSource(connector);
                          toast({
                            title: `${connector.name} added`,
                            description: "Click 'Connect' in the table to set up the integration.",
                          });
                          setIsConnectorDialogOpen(false);
                          setSelectedAnalytics("");
                        }}
                        className="w-full"
                      >
                        Add Source
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Competitors Section */}
              <AccordionItem value="competitors">
                <AccordionTrigger className="font-semibold">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Competitors
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {competitors.map((competitor, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="Company Name"
                          value={competitor.name}
                          onChange={(e) => {
                            const newCompetitors = [...competitors];
                            newCompetitors[index].name = e.target.value;
                            setCompetitors(newCompetitors);
                          }}
                          className="flex-1"
                        />
                        <Input
                          placeholder="Company URL"
                          value={competitor.url}
                          onChange={(e) => {
                            const newCompetitors = [...competitors];
                            newCompetitors[index].url = e.target.value;
                            setCompetitors(newCompetitors);
                          }}
                          className="flex-1"
                        />
                        {index === competitors.length - 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setCompetitors([...competitors, { name: "", url: "" }])}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                        {competitors.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              const newCompetitors = competitors.filter((_, i) => i !== index);
                              setCompetitors(newCompetitors);
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {competitors.some((c) => c.name.trim() !== "" || c.url.trim() !== "") && (
                      <Button
                        onClick={() => {
                          const validCompetitors = competitors.filter(
                            (c) => c.name.trim() !== "" && c.url.trim() !== "",
                          );
                          validCompetitors.forEach((competitor, index) => {
                            handleConnectSource(buildCompetitorConnector(competitor, index));
                          });
                          toast({
                            title: `${validCompetitors.length} competitor(s) added`,
                            description: "Click 'Connect' in the table to set up the integration.",
                          });
                          setIsConnectorDialogOpen(false);
                          setCompetitors([{ name: "", url: "" }]);
                        }}
                        className="w-full"
                      >
                        Add Source
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Slack Section */}
              <AccordionItem value="slack">
                <AccordionTrigger className="font-semibold">
                  <div className="flex items-center gap-2">
                    <Slack className="h-4 w-4" />
                    Slack
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {slackConfigs.map((config, index) => (
                      <div key={index} className="space-y-3 p-4 border rounded-lg">
                        <div className="space-y-2">
                          <Label>Workspace</Label>
                          <Input
                            placeholder="Enter workspace name"
                            value={config.workspace}
                            onChange={(e) => {
                              const newConfigs = [...slackConfigs];
                              newConfigs[index].workspace = e.target.value;
                              setSlackConfigs(newConfigs);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Channel</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter channel name"
                              value={config.channel}
                              onChange={(e) => {
                                const newConfigs = [...slackConfigs];
                                newConfigs[index].channel = e.target.value;
                                setSlackConfigs(newConfigs);
                              }}
                              className="flex-1"
                            />
                            {index === slackConfigs.length - 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  setSlackConfigs([...slackConfigs, { workspace: "", channel: "" }])
                                }
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                            {slackConfigs.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  const newConfigs = slackConfigs.filter((_, i) => i !== index);
                                  setSlackConfigs(newConfigs);
                                }}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {slackConfigs.some((c) => c.workspace.trim() !== "") && (
                      <Button
                        onClick={() => {
                          const validConfigs = slackConfigs.filter(
                            (c) => c.workspace.trim() !== "",
                          );
                          validConfigs.forEach((config, index) => {
                            handleConnectSource(buildSlackConnector(config, index));
                          });
                          toast({
                            title: `${validConfigs.length} Slack workspace(s) added`,
                            description: "Click 'Connect' in the table to set up the integration.",
                          });
                          setIsConnectorDialogOpen(false);
                          setSlackConfigs([{ workspace: "", channel: "" }]);
                        }}
                        className="w-full"
                      >
                        Add Source
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* File Sources Section */}
              <AccordionItem value="file-sources">
                <AccordionTrigger className="font-semibold">
                  <div className="flex items-center gap-2">
                    <UploadIcon className="h-4 w-4" />
                    File Sources
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6 pt-2">
                    {/* Product Documentation - Special handling with multiple files */}
                    <div className="space-y-3 p-4 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium">Product Documentation</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Docs, API guides, release notes, and specs
                      </p>

                      {productDocFiles.map((fileData, index) => (
                        <div key={index} className="space-y-3 p-3 border rounded-md bg-muted/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Upload File</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="file"
                                  className="flex-1"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const newFiles = [...productDocFiles];
                                      newFiles[index].file = file;
                                      setProductDocFiles(newFiles);
                                    }
                                  }}
                                />
                                {index === productDocFiles.length - 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() =>
                                      setProductDocFiles([
                                        ...productDocFiles,
                                        { file: null, destinationUrl: "" },
                                      ])
                                    }
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}
                                {productDocFiles.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                      const newFiles = productDocFiles.filter(
                                        (_, i) => i !== index,
                                      );
                                      setProductDocFiles(newFiles);
                                    }}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              {fileData.file && (
                                <p className="text-xs text-muted-foreground">
                                  Selected: {fileData.file.name}
                                </p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label>Destination URL</Label>
                              <Input
                                type="url"
                                placeholder="https://example.com/destination"
                                value={fileData.destinationUrl}
                                onChange={(e) => {
                                  const newFiles = [...productDocFiles];
                                  newFiles[index].destinationUrl = e.target.value;
                                  setProductDocFiles(newFiles);
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      {productDocFiles.some((f) => f.file || f.destinationUrl.trim() !== "") && (
                        <Button
                          onClick={() => {
                            const validFiles = productDocFiles.filter(
                              (f) => f.file || f.destinationUrl.trim() !== "",
                            );
                            validFiles.forEach((fileData, index) => {
                              handleConnectSource(
                                buildProductDocConnector(fileData, index, validFiles.length),
                              );
                            });
                            toast({
                              title: `${validFiles.length} Product Documentation file(s) added`,
                              description:
                                "Click 'Connect' in the table to upload files and configure.",
                            });
                            setIsConnectorDialogOpen(false);
                            setProductDocFiles([{ file: null, destinationUrl: "" }]);
                          }}
                          className="w-full"
                        >
                          Connect
                        </Button>
                      )}
                    </div>

                    {/* Other File Sources */}
                    {[
                      {
                        name: "Call Transcripts",
                        icon: MessageSquare,
                        description: "Conversation transcripts from discovery and sales calls",
                      },
                      {
                        name: "Meeting Notes",
                        icon: FileText,
                        description: "Structured or freeform notes from meetings",
                      },
                      {
                        name: "Case Studies",
                        icon: Users,
                        description: "Customer stories, wins, and proof points",
                      },
                      {
                        name: "Support Tickets",
                        icon: MessageSquare,
                        description: "Support conversations and resolutions",
                      },
                      {
                        name: "Sales Presentations",
                        icon: BarChart3,
                        description: "Decks and one-pagers used in the sales cycle",
                      },
                    ].map((fileSource) => {
                      const FileIcon = fileSource.icon;
                      const fileData = fileSources[fileSource.name];

                      return (
                        <div key={fileSource.name} className="space-y-3 p-4 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileIcon className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-medium">{fileSource.name}</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">{fileSource.description}</p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Upload File</Label>
                              <Input
                                type="file"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setFileSources((prev) => ({
                                      ...prev,
                                      [fileSource.name]: { ...prev[fileSource.name], file },
                                    }));
                                  }
                                }}
                              />
                              {fileData.file && (
                                <p className="text-xs text-muted-foreground">
                                  Selected: {fileData.file.name}
                                </p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label>Destination URL</Label>
                              <Input
                                type="url"
                                placeholder="https://example.com/destination"
                                value={fileData.destinationUrl}
                                onChange={(e) => {
                                  setFileSources((prev) => ({
                                    ...prev,
                                    [fileSource.name]: {
                                      ...prev[fileSource.name],
                                      destinationUrl: e.target.value,
                                    },
                                  }));
                                }}
                              />
                            </div>
                          </div>

                          {(fileData.file || fileData.destinationUrl.trim() !== "") && (
                            <Button
                              onClick={() => {
                                handleConnectSource(buildOtherFileConnector(fileSource));
                                toast({
                                  title: `${fileSource.name} added`,
                                  description:
                                    "Click 'Connect' in the table to upload files and configure.",
                                });
                                setIsConnectorDialogOpen(false);
                              }}
                              className="w-full"
                            >
                              Connect
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        sourceToDelete={sourceToDelete}
        onConfirm={() => {
          if (sourceToDelete) {
            onDataSourcesChange((prev) => prev.filter((s) => s.id !== sourceToDelete.id));
            toast({
              title: "Data source deleted",
              description: `${sourceToDelete.name} has been removed.`,
            });
            setDeleteDialogOpen(false);
            setSourceToDelete(null);
          }
        }}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setSourceToDelete(null);
        }}
      />

      {/* Configuration Dialog */}
      <ConfigurationDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        source={sourceToConfigure}
        syncFrequency={configSyncFrequency}
        objects={configObjects}
        filters={configFilters}
        onSyncFrequencyChange={setConfigSyncFrequency}
        onObjectsChange={setConfigObjects}
        onFiltersChange={setConfigFilters}
        onSave={handleSaveConfiguration}
      />

      {/* Salesforce Auth Modal */}
      <CredentialAuthModal
        open={isSalesforceAuthModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetSalesforceAuthModal();
          }
        }}
        platformName="Salesforce"
        platformIcon={Database}
        idPrefix="salesforce"
        email={salesforceEmail}
        password={salesforcePassword}
        isLoggingIn={isSalesforceLoggingIn}
        authStep={salesforceAuthStep}
        permissions={[
          { label: "Contacts", description: "Read contact information and details" },
          { label: "Accounts", description: "Read account information and company data" },
          { label: "Opportunities", description: "Read sales opportunities and pipeline data" },
        ]}
        accountDisplay={salesforceEmail}
        onEmailChange={setSalesforceEmail}
        onPasswordChange={setSalesforcePassword}
        onLogin={() => void handleSalesforceLogin()}
        onCancel={resetSalesforceAuthModal}
        onApprove={handleSalesforceApprove}
        onDeny={handleSalesforceDeny}
      />

      {/* HubSpot Auth Modal */}
      <CredentialAuthModal
        open={isHubSpotAuthModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetHubSpotAuthModal();
          }
        }}
        platformName="HubSpot"
        platformIcon={BarChart3}
        idPrefix="hubspot"
        email={hubSpotEmail}
        password={hubSpotPassword}
        isLoggingIn={isHubSpotLoggingIn}
        authStep={hubSpotAuthStep}
        permissions={[
          { label: "Contacts", description: "Read contact information and details" },
          { label: "Companies", description: "Read company information and organization data" },
          { label: "Deals", description: "Read deal information and pipeline data" },
          { label: "Tickets", description: "Read support ticket information" },
        ]}
        accountDisplay={hubSpotEmail}
        onEmailChange={setHubSpotEmail}
        onPasswordChange={setHubSpotPassword}
        onLogin={() => void handleHubSpotLogin()}
        onCancel={resetHubSpotAuthModal}
        onApprove={handleHubSpotApprove}
        onDeny={handleHubSpotDeny}
      />

      {/* Pipedrive Auth Modal */}
      <CredentialAuthModal
        open={isPipedriveAuthModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetPipedriveAuthModal();
          }
        }}
        platformName="Pipedrive"
        platformIcon={Database}
        idPrefix="pipedrive"
        email={pipedriveEmail}
        password={pipedrivePassword}
        isLoggingIn={isPipedriveLoggingIn}
        authStep={pipedriveAuthStep}
        permissions={[
          { label: "Deals", description: "Read deal information and pipeline data" },
          { label: "Persons", description: "Read contact information and details" },
          {
            label: "Organizations",
            description: "Read company information and organization data",
          },
          { label: "Activities", description: "Read activity information and timeline data" },
        ]}
        accountDisplay={pipedriveEmail}
        onEmailChange={setPipedriveEmail}
        onPasswordChange={setPipedrivePassword}
        onLogin={() => void handlePipedriveLogin()}
        onCancel={resetPipedriveAuthModal}
        onApprove={handlePipedriveApprove}
        onDeny={handlePipedriveDeny}
      />

      {/* Zoho Auth Modal */}
      <CredentialAuthModal
        open={isZohoAuthModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetZohoAuthModal();
          }
        }}
        platformName="Zoho CRM"
        platformIcon={Database}
        idPrefix="zoho"
        email={zohoEmail}
        password={zohoPassword}
        isLoggingIn={isZohoLoggingIn}
        authStep={zohoAuthStep}
        permissions={[
          { label: "Contacts", description: "Read contact information and details" },
          { label: "Accounts", description: "Read account information and company data" },
          { label: "Deals", description: "Read deal information and pipeline data" },
          { label: "Leads", description: "Read lead information and conversion data" },
        ]}
        accountDisplay={zohoEmail}
        onEmailChange={setZohoEmail}
        onPasswordChange={setZohoPassword}
        onLogin={() => void handleZohoLogin()}
        onCancel={resetZohoAuthModal}
        onApprove={handleZohoApprove}
        onDeny={handleZohoDeny}
      />

      {/* LinkedIn Auth Modal */}
      <CredentialAuthModal
        open={isLinkedInAuthModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetLinkedInAuthModal();
          }
        }}
        platformName="LinkedIn"
        platformIcon={Linkedin}
        idPrefix="linkedin"
        email={linkedInEmail}
        password={linkedInPassword}
        isLoggingIn={isLinkedInLoggingIn}
        authStep={linkedInAuthStep}
        permissions={
          linkedInSourceToConnect?.name === "LinkedIn Company"
            ? [
                {
                  label: "Company Page",
                  description: "Read company page information and details",
                },
                { label: "Posts", description: "Read company posts and engagement data" },
                { label: "Followers", description: "Read follower information and analytics" },
              ]
            : [
                {
                  label: "Company Pages",
                  description: "Read company page information and details",
                },
                { label: "Profiles", description: "Read profile information and contact details" },
                { label: "Messages", description: "Read messages and conversation data" },
              ]
        }
        accountDisplay={linkedInEmail}
        onEmailChange={setLinkedInEmail}
        onPasswordChange={setLinkedInPassword}
        onLogin={() => void handleLinkedInLogin()}
        onCancel={resetLinkedInAuthModal}
        onApprove={handleLinkedInApprove}
        onDeny={handleLinkedInDeny}
      />

      {/* X (Twitter) Auth Modal */}
      <CredentialAuthModal
        open={isXAuthModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetXAuthModal();
          }
        }}
        platformName="X"
        platformIcon={Twitter}
        idPrefix="x"
        email={xEmail}
        password={xPassword}
        isLoggingIn={isXLoggingIn}
        authStep={xAuthStep}
        permissions={[
          { label: "Profiles", description: "Read profile information and user data" },
          { label: "Tweets", description: "Read tweets and post information" },
          { label: "Engagements", description: "Read likes, retweets, and engagement metrics" },
        ]}
        accountDisplay={xEmail}
        onEmailChange={setXEmail}
        onPasswordChange={setXPassword}
        onLogin={() => void handleXLogin()}
        onCancel={resetXAuthModal}
        onApprove={handleXApprove}
        onDeny={handleXDeny}
      />

      {/* Google Analytics Auth Modal */}
      <GoogleAnalyticsAuthModal
        open={isGoogleAnalyticsAuthModalOpen}
        source={googleAnalyticsSourceToConnect}
        onConnected={handleGoogleAnalyticsConnected}
        onClose={() => {
          setIsGoogleAnalyticsAuthModalOpen(false);
          setGoogleAnalyticsSourceToConnect(null);
        }}
      />

      {/* Mixpanel Auth Modal */}
      <CredentialAuthModal
        open={isMixpanelAuthModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsMixpanelAuthModalOpen(false);
            setMixpanelEmail("");
            setMixpanelPassword("");
            setMixpanelSourceToConnect(null);
            setMixpanelAuthStep("login");
          }
        }}
        platformName="Mixpanel"
        platformIcon={BarChart3}
        idPrefix="mixpanel"
        email={mixpanelEmail}
        password={mixpanelPassword}
        isLoggingIn={isMixpanelLoggingIn}
        authStep={mixpanelAuthStep}
        permissions={[
          {
            label: "Track user events",
            description: "Record and track user interactions and events",
          },
          {
            label: "Analyze funnels & retention",
            description: "Access funnel analysis and user retention metrics",
          },
          {
            label: "View engagement metrics",
            description: "Read engagement data and analytics reports",
          },
        ]}
        accountDisplay={mixpanelEmail}
        onEmailChange={setMixpanelEmail}
        onPasswordChange={setMixpanelPassword}
        onLogin={() => void handleMixpanelLogin()}
        onCancel={() => {
          setIsMixpanelAuthModalOpen(false);
          setMixpanelEmail("");
          setMixpanelPassword("");
          setMixpanelSourceToConnect(null);
          setMixpanelAuthStep("login");
        }}
        onApprove={handleMixpanelApprove}
        onDeny={handleMixpanelDeny}
        loginLabel="Continue"
        permissionsTitle="Authorize Mixpanel Access"
        permissionsDescription="This app will be able to:"
        showRequestedPermissionsHeader={false}
        denyLabel="Cancel"
        approveLabel="Allow Access"
      />
    </>
  );
}
