import {
  Database,
  Upload as UploadIcon,
  FileText,
  Users,
  MessageSquare,
  BarChart3,
  Linkedin,
  XCircle,
  Plus,
  Slack,
} from "lucide-react";
import { useState } from "react";

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
import type { Connector } from "./connectorTypes";

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

interface ConnectorCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (connector: Connector) => void;
}

export default function ConnectorCatalogDialog({
  open,
  onOpenChange,
  onConnect,
}: ConnectorCatalogDialogProps) {
  const { toast } = useToast();

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                        onConnect(connector);
                        toast({
                          title: `${connector.name} added`,
                          description: "Click 'Connect' in the table to set up the integration.",
                        });
                        onOpenChange(false);
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
                          onConnect(connector);
                          toast({
                            title: "LinkedIn Sales Navigator added",
                            description: "Click 'Connect' in the table to set up the integration.",
                          });
                          onOpenChange(false);
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
                        onConnect(connector);
                        toast({
                          title: "X added",
                          description: "Click 'Connect' in the table to set up the integration.",
                        });
                        onOpenChange(false);
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
                        onConnect(connector);
                        toast({
                          title: `${connector.name} added`,
                          description: "Click 'Connect' in the table to set up the integration.",
                        });
                        onOpenChange(false);
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
                          onConnect(buildCompetitorConnector(competitor, index));
                        });
                        toast({
                          title: `${validCompetitors.length} competitor(s) added`,
                          description: "Click 'Connect' in the table to set up the integration.",
                        });
                        onOpenChange(false);
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
                        const validConfigs = slackConfigs.filter((c) => c.workspace.trim() !== "");
                        validConfigs.forEach((config, index) => {
                          onConnect(buildSlackConnector(config, index));
                        });
                        toast({
                          title: `${validConfigs.length} Slack workspace(s) added`,
                          description: "Click 'Connect' in the table to set up the integration.",
                        });
                        onOpenChange(false);
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
                                    const newFiles = productDocFiles.filter((_, i) => i !== index);
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
                            onConnect(buildProductDocConnector(fileData, index, validFiles.length));
                          });
                          toast({
                            title: `${validFiles.length} Product Documentation file(s) added`,
                            description:
                              "Click 'Connect' in the table to upload files and configure.",
                          });
                          onOpenChange(false);
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
                              onConnect(buildOtherFileConnector(fileSource));
                              toast({
                                title: `${fileSource.name} added`,
                                description:
                                  "Click 'Connect' in the table to upload files and configure.",
                              });
                              onOpenChange(false);
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
  );
}
