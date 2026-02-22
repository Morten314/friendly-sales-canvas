import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditDropdownMenu } from "@/components/market-research/EditDropdownMenu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Check,
  X,
  Eye,
  TrendingUp,
  Users,
  Target,
  ChevronDown,
  ChevronUp,
  Edit,
  Save,
  Download,
  Minimize2,
  Sparkles,
  RefreshCw,
  Plus,
  ArrowRight,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Undo2,
  Shield,
  Gauge,
  Lightbulb,
  Zap,
  MessageSquare,
  Pencil,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

// --- Types ---
interface ExistingICP {
  id: string;
  name: string;
  geography?: string;
  industry?: string;
  companySize?: string;
  buyerRole?: string;
  fitConfidence?: string;
  status?: "active" | "inactive";
}

interface SuggestedICP {
  id: string;
  name: string;
  type: "refined" | "new";
  sourceICPId?: string;
  sourceICPName?: string;
  industry: string;
  segment: string;
  companySize: string;
  decisionMakers: string[];
  regions: string[];
  keyAttributes: string[];
  growthIndicator?: string;
  whySuggested: string[];
  whatChanged?: string[];
  opportunityUnlocked?: string;
  confidenceScore: "High" | "Medium" | "Low";
  tag?: string;
  marketSize?: string;
  growth?: string;
  topPainPoint?: string;
  buyingTriggers?: string[];
  competitors?: string[];
}

interface ICPCardStatus {
  status: "suggested" | "accepted" | "rejected";
  acceptedAt?: Date;
  rejectedAt?: Date;
}

interface SuggestedICPCardsProps {
  onICPAccepted?: (icp: SuggestedICP) => void;
  onICPRejected?: (icp: SuggestedICP) => void;
  refreshTrigger?: number;
}

// --- ICP Chip Modal Content (Profiler's interpretation) ---
interface ICPAnalysis {
  interpretation: string;
  strengths: string[];
  weaknesses: string[];
  missing: string[];
  broadNarrow: string;
  confidence: "High" | "Medium" | "Low";
}

const analyzeICP = (icp: ExistingICP): ICPAnalysis => {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const missing: string[] = [];

  if (icp.industry) strengths.push(`Clear industry focus: ${icp.industry}`);
  else missing.push("No industry specified — targeting is too broad");

  if (icp.buyerRole) strengths.push(`Defined buyer role: ${icp.buyerRole}`);
  else missing.push("No buyer role — unclear who to engage");

  if (icp.companySize) strengths.push(`Company size defined: ${icp.companySize}`);
  else missing.push("No company size filter");

  if (icp.geography) strengths.push(`Geographic focus: ${icp.geography}`);
  else weaknesses.push("No geographic focus — could dilute outreach");

  if (icp.fitConfidence === "Low" || icp.fitConfidence === "Medium") {
    weaknesses.push(`Fit confidence is ${icp.fitConfidence} — may need tighter criteria`);
  }

  if (!icp.buyerRole?.includes(",") && !icp.buyerRole?.includes("/")) {
    weaknesses.push("Single buyer role — consider adding secondary decision-makers");
  }

  const broadNarrow =
    strengths.length >= 3 && weaknesses.length <= 1
      ? "Well-balanced targeting scope"
      : weaknesses.length > strengths.length
        ? "Too broad — consider adding more filters to tighten targeting"
        : "Slightly narrow — expanding regions or roles could increase pipeline";

  const confidence: "High" | "Medium" | "Low" =
    strengths.length >= 4 ? "High" : strengths.length >= 2 ? "Medium" : "Low";

  return {
    interpretation: `Profiler sees "${icp.name}" as targeting ${icp.industry || "unspecified industry"} companies (${icp.companySize || "any size"}) in ${icp.geography || "all regions"}, engaging ${icp.buyerRole || "unspecified roles"}.`,
    strengths,
    weaknesses,
    missing,
    broadNarrow,
    confidence,
  };
};

// --- Confidence badge color ---
const confidenceColor = (c: string) => {
  if (c === "High") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (c === "Medium") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-muted text-muted-foreground border-border";
};

// ========== MAIN COMPONENT ==========
export const SuggestedICPCards = ({
  onICPAccepted,
  onICPRejected,
  refreshTrigger = 0,
}: SuggestedICPCardsProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [existingICPs, setExistingICPs] = useState<ExistingICP[]>(() => {
    try {
      const saved = localStorage.getItem("profiler_existingICPs");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [acceptedICPs, setAcceptedICPs] = useState<ExistingICP[]>(() => {
    try {
      const saved = localStorage.getItem("profiler_acceptedICPs");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [refinedICPs, setRefinedICPs] = useState<SuggestedICP[]>([]);
  const [newICPs, setNewICPs] = useState<SuggestedICP[]>([]);
  const [cardStatuses, setCardStatuses] = useState<Record<string, ICPCardStatus>>(() => {
    try {
      const saved = localStorage.getItem("profiler_cardStatuses");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [loading, setLoading] = useState(true);

  // UI states
  const [selectedExistingICP, setSelectedExistingICP] = useState<ExistingICP | null>(null);
  const [confirmAcceptICP, setConfirmAcceptICP] = useState<SuggestedICP | null>(null);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [showRecommendations, setShowRecommendations] = useState(() => {
    try {
      return localStorage.getItem("profiler_showRecommendations") === "true";
    } catch {}
    return false;
  });
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  // Persist state changes
  useEffect(() => {
    localStorage.setItem("profiler_cardStatuses", JSON.stringify(cardStatuses));
  }, [cardStatuses]);

  useEffect(() => {
    localStorage.setItem("profiler_existingICPs", JSON.stringify(existingICPs));
  }, [existingICPs]);

  useEffect(() => {
    localStorage.setItem("profiler_acceptedICPs", JSON.stringify(acceptedICPs));
  }, [acceptedICPs]);

  useEffect(() => {
    localStorage.setItem("profiler_showRecommendations", String(showRecommendations));
  }, [showRecommendations]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      let icps: ExistingICP[] = [];
      try {
        const persistedExisting = localStorage.getItem("profiler_existingICPs");
        if (persistedExisting) {
          const parsed = JSON.parse(persistedExisting);
          if (parsed.length > 0) icps = parsed;
        }
      } catch {}

      if (icps.length === 0) {
        try {
          const stored = localStorage.getItem("customerICPs") || localStorage.getItem("missionControlICPs");
          if (stored) icps = JSON.parse(stored);
        } catch {}

        if (icps.length === 0) {
          icps = [
            {
              id: "existing-1",
              name: "ICP 1",
              geography: "North America",
              industry: "Software & Technology",
              companySize: "100-500 employees",
              buyerRole: "CTO / VP Engineering",
              fitConfidence: "High",
              status: "active",
            },
            {
              id: "existing-2",
              name: "ICP 2",
              geography: "US, UK",
              industry: "Healthcare",
              companySize: "200-1000 employees",
              buyerRole: "CIO / Chief Digital Officer",
              fitConfidence: "Medium",
              status: "active",
            },
          ];
        }
      }
      setExistingICPs(icps);

      await new Promise((r) => setTimeout(r, 500));

      const refined: SuggestedICP[] = [
        {
          id: "refined-1",
          name: "Mid-Market SaaS – RevOps Teams",
          type: "refined",
          sourceICPId: icps[0]?.id,
          sourceICPName: icps[0]?.name || "ICP 1",
          industry: "Software & Technology",
          segment: "RevOps Focus",
          companySize: "100-500 employees",
          regions: ["North America", "UK"],
          decisionMakers: ["VP of RevOps", "Head of Sales Operations", "CRO"],
          keyAttributes: ["High growth stage", "Using Salesforce or HubSpot", "Series B+"],
          whySuggested: [
            "RevOps roles show 3x higher engagement with your content",
            "Faster sales cycles when RevOps is involved early",
            "Higher average deal size in this segment",
          ],
          whatChanged: [
            "Added RevOps focus to buyer roles",
            "Included UK in target regions",
            "Added tech stack qualification criteria",
          ],
          confidenceScore: "High",
          marketSize: "$45B",
          growth: "+18% YoY",
          topPainPoint: "Sales & marketing alignment",
          buyingTriggers: ["New CRO hire", "Revenue target increase", "Tech stack consolidation"],
          competitors: ["Clari", "Gong", "Outreach"],
        },
      ];

      const newSuggestions: SuggestedICP[] = [
        {
          id: "new-1",
          name: "Enterprise FinTech Decision Makers",
          type: "new",
          tag: "New ICP",
          industry: "Financial Services",
          segment: "FinTech",
          companySize: "500-2000 employees",
          regions: ["US", "EU"],
          decisionMakers: ["Chief Digital Officer", "VP of Innovation", "Head of Partnerships"],
          keyAttributes: ["Digital transformation focus", "API-first strategy", "Regulatory compliance needs"],
          whySuggested: [
            "High overlap with your current product capabilities",
            "Growing market with 24% YoY expansion",
            "Lower competition in this segment",
          ],
          opportunityUnlocked: "Access to $2.4B addressable market with strong product-market fit signals",
          confidenceScore: "Medium",
          marketSize: "$28B",
          growth: "+24% YoY",
          topPainPoint: "Legacy system modernization",
          buyingTriggers: ["Regulatory changes", "Digital transformation initiative", "Competitor pressure"],
          competitors: ["Stripe", "Plaid", "Marqeta"],
        },
        {
          id: "new-2",
          name: "Growth-Stage E-commerce Leaders",
          type: "new",
          sourceICPName: icps[0]?.name || "ICP 1",
          tag: `Lookalike of ${icps[0]?.name || "ICP 1"}`,
          industry: "E-commerce & Retail",
          segment: "D2C Brands",
          companySize: "50-200 employees",
          regions: ["North America"],
          decisionMakers: ["Head of Growth", "VP of Marketing", "COO"],
          keyAttributes: ["Shopify Plus users", "High ad spend", "Scaling operations"],
          whySuggested: [
            "Similar buying patterns to your best customers",
            "Strong intent signals detected in this segment",
            "Complementary to existing ICP focus",
          ],
          opportunityUnlocked: "Expand into adjacent market with proven playbook from ICP 1",
          confidenceScore: "High",
          marketSize: "$18B",
          growth: "+22% YoY",
          topPainPoint: "Scaling customer acquisition",
          buyingTriggers: ["Series A+ funding", "New market expansion", "Holiday season prep"],
          competitors: ["Shopify", "Klaviyo", "Attentive"],
        },
      ];

      setRefinedICPs(refined);
      setNewICPs(newSuggestions);

      const persistedStatuses = localStorage.getItem("profiler_cardStatuses");
      if (!persistedStatuses || Object.keys(JSON.parse(persistedStatuses)).length === 0) {
        const initialStatuses: Record<string, ICPCardStatus> = {};
        [...refined, ...newSuggestions].forEach((icp) => {
          initialStatuses[icp.id] = { status: "suggested" };
        });
        setCardStatuses(initialStatuses);
      }
      setLoading(false);
    };
    loadData();
  }, [refreshTrigger]);

  // --- Accept flow ---
  const handleAcceptClick = (icp: SuggestedICP) => {
    setConfirmAcceptICP(icp);
  };

  const handleConfirmAccept = () => {
    if (!confirmAcceptICP) return;
    const icp = confirmAcceptICP;
    setCardStatuses((prev) => ({
      ...prev,
      [icp.id]: { status: "accepted", acceptedAt: new Date() },
    }));

    const newAcceptedICP: ExistingICP = {
      id: `accepted-${icp.id}`,
      name: icp.name,
      geography: icp.regions?.join(", ") || "—",
      industry: icp.industry,
      companySize: icp.companySize,
      buyerRole: icp.decisionMakers?.join(", ") || "—",
      fitConfidence: icp.confidenceScore,
      status: "active",
    };

    // Save to Accepted ICPs table
    setAcceptedICPs((prev) => [...prev, newAcceptedICP]);

    onICPAccepted?.(icp);
    toast({
      title: "Customer Profile updated.",
      description: `"${icp.name}" has been saved to your Customer Profile and Accepted ICPs.`,
    });
    setConfirmAcceptICP(null);
    // Auto-expand the report
    setExpandedReportId(icp.id);
  };

  const handleRejectICP = (icp: SuggestedICP) => {
    setCardStatuses((prev) => ({
      ...prev,
      [icp.id]: { status: "rejected", rejectedAt: new Date() },
    }));
    onICPRejected?.(icp);
    toast({
      title: "ICP Dismissed",
      description: `"${icp.name}" has been rejected.`,
      variant: "destructive",
    });
  };

  const handleUndoAction = (icpId: string) => {
    setCardStatuses((prev) => ({
      ...prev,
      [icpId]: { status: "suggested" },
    }));
    // Remove from Accepted ICPs table
    setAcceptedICPs((prev) => prev.filter((icp) => icp.id !== `accepted-${icpId}`));
    if (expandedReportId === icpId) setExpandedReportId(null);
    toast({ title: "Action undone", description: "ICP returned to suggestions and removed from Accepted ICPs." });
  };

  const handleViewProspects = (icpName: string) => {
    window.dispatchEvent(
      new CustomEvent("navigateToLeadStream", { detail: { filterICP: icpName } })
    );
  };

  // --- Render ---
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 bg-muted rounded-lg" />
        <div className="h-24 bg-muted rounded-lg" />
        <div className="h-48 bg-muted rounded-lg" />
      </div>
    );
  }

  const allSuggestions = [...refinedICPs, ...newICPs];
  const pendingCount = allSuggestions.filter((s) => cardStatuses[s.id]?.status === "suggested").length;

  return (
    <div className="space-y-8">
      {/* ═══ Section 1: Current ICPs (table) ═══ */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Current ICPs
        </h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Company Size</TableHead>
                <TableHead>Buyer Role</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Report</TableHead>
                <TableHead className="text-right">Delete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {existingICPs.map((icp) => (
                <TableRow key={icp.id}>
                  <TableCell className="font-medium">{icp.name}</TableCell>
                  <TableCell>{icp.industry || "—"}</TableCell>
                  <TableCell>{icp.geography || "—"}</TableCell>
                  <TableCell>{icp.companySize || "—"}</TableCell>
                  <TableCell>{icp.buyerRole || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${confidenceColor(icp.fitConfidence || "Medium")}`}>
                      {icp.fitConfidence || "Medium"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleViewProspects(icp.name)} className="text-primary hover:text-primary/80">
                      <Zap className="h-3.5 w-3.5 mr-1" />
                      View Leads
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedExistingICP(icp)} className="text-primary hover:text-primary/80">
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      View Report
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setExistingICPs((prev) => prev.filter((e) => e.id !== icp.id));
                        toast({ title: "ICP deleted", description: `"${icp.name}" removed from Current ICPs.` });
                      }}
                      className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* ═══ Accepted ICPs Table ═══ */}
      {acceptedICPs.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            Accepted ICPs
          </h3>
          <Card className="border-emerald-200/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Company Size</TableHead>
                  <TableHead>Buyer Role</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acceptedICPs.map((icp) => (
                  <TableRow key={icp.id} className="bg-emerald-50/20">
                    <TableCell className="font-medium">{icp.name}</TableCell>
                    <TableCell>{icp.industry || "—"}</TableCell>
                    <TableCell>{icp.geography || "—"}</TableCell>
                    <TableCell>{icp.companySize || "—"}</TableCell>
                    <TableCell>{icp.buyerRole || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${confidenceColor(icp.fitConfidence || "Medium")}`}>
                        {icp.fitConfidence || "Medium"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleViewProspects(icp.name)} className="text-primary hover:text-primary/80">
                        <Zap className="h-3.5 w-3.5 mr-1" />
                        View Leads
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Find the original suggestion to expand its report
                            const originalId = icp.id.replace("accepted-", "");
                            setExpandedReportId(expandedReportId === originalId ? null : originalId);
                          }}
                          className="text-primary hover:text-primary/80"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View Report
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUndoAction(icp.id.replace("accepted-", ""))}
                          className="text-xs text-muted-foreground"
                        >
                          <Undo2 className="h-3 w-3 mr-1" />
                          Undo
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* ═══ Current ICP Report Sheet ═══ */}
      <Sheet open={!!selectedExistingICP} onOpenChange={(open) => !open && setSelectedExistingICP(null)}>
        {selectedExistingICP && (() => {
          const analysis = analyzeICP(selectedExistingICP);
          return (
            <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
              <SheetHeader className="mb-4">
                <div className="flex items-center justify-between">
                  <SheetTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Profiler's Analysis: {selectedExistingICP.name}
                  </SheetTitle>
                  <div className="flex items-center gap-1">
                    <EditDropdownMenu onModify={() => toast({ title: "Edit mode", description: "You can now modify this report." })} />
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 gap-1.5" onClick={() => toast({ title: "Chat with Profiler", description: "Profiler agent chat opening..." })}>
                      <MessageSquare className="h-4 w-4" />
                      Agentic
                    </Button>
                  </div>
                </div>
                <SheetDescription>Here's how Profiler interprets this ICP targeting.</SheetDescription>
              </SheetHeader>
              <div className="space-y-5">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium text-foreground mb-1">Profiler's Interpretation</p>
                  <p className="text-sm text-muted-foreground">{analysis.interpretation}</p>
                </div>
                {analysis.strengths.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" /> What's Good
                    </p>
                    <ul className="space-y-1.5">
                      {analysis.strengths.map((s, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.weaknesses.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Weak Points
                    </p>
                    <ul className="space-y-1.5">
                      {analysis.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.missing.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-2 flex items-center gap-1">
                      <X className="h-3 w-3" /> Missing
                    </p>
                    <ul className="space-y-1.5">
                      {analysis.missing.map((m, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <X className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{analysis.broadNarrow}</span>
                  </div>
                  <Badge variant="outline" className={`text-xs ${confidenceColor(analysis.confidence)}`}>
                    Confidence: {analysis.confidence}
                  </Badge>
                </div>
                <Card className="border-primary/20 bg-primary/[0.03]">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <Zap className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">View prospects for this ICP</p>
                          <p className="text-xs text-muted-foreground">See leads in Lead Stream filtered by "{selectedExistingICP.name}"</p>
                        </div>
                      </div>
                      <Button size="sm" className="gap-1.5" onClick={() => handleViewProspects(selectedExistingICP.name)}>
                        Go to Lead Stream
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </SheetContent>
          );
        })()}
      </Sheet>

      {/* ═══ Section 2: Profiler Work Announcement ═══ */}
      {showAnnouncement && (
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  I reviewed your ICPs and found opportunities to tighten targeting.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {refinedICPs.length} refinement{refinedICPs.length !== 1 ? "s" : ""} to existing ICPs and{" "}
                  {newICPs.length} new segment{newICPs.length !== 1 ? "s" : ""} identified.
                </p>
                {!showRecommendations ? (
                  <Button size="sm" className="mt-3 gap-1.5" onClick={() => setShowRecommendations(true)}>
                    <Sparkles className="h-3.5 w-3.5" />
                    Show me the recommended ICPs
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-600" />
                    Recommended ICPs shown below
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Section 3: Recommended ICPs — Single Scrollable Row ═══ */}
      {showRecommendations && (
        <div className="space-y-3 animate-fade-in">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Recommended ICPs
          </h3>
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4">
              {allSuggestions.filter((s) => cardStatuses[s.id]?.status !== "accepted").map((icp) => (
                <RecommendedICPCard
                  key={icp.id}
                  icp={icp}
                  status={cardStatuses[icp.id] || { status: "suggested" }}
                  isExpanded={expandedReportId === icp.id}
                  onAccept={() => handleAcceptClick(icp)}
                  onReject={() => handleRejectICP(icp)}
                  onUndo={() => handleUndoAction(icp.id)}
                  onToggleReport={() => setExpandedReportId(expandedReportId === icp.id ? null : icp.id)}
                  onViewProspects={() => handleViewProspects(icp.type === "refined" ? "Refined ICP" : "New ICP")}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* ═══ Accept Confirmation Dialog ═══ */}
      <AlertDialog open={!!confirmAcceptICP} onOpenChange={(open) => !open && setConfirmAcceptICP(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save to Customer Profile?</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want me to save "{confirmAcceptICP?.name}" to your Customer Profile? This will make it available for Lead Stream scoring and agent routing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAccept}>Okay</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ========== RECOMMENDED ICP CARD (with inline expand/collapse report) ==========
interface RecommendedICPCardProps {
  icp: SuggestedICP;
  status: ICPCardStatus;
  isExpanded: boolean;
  onAccept: () => void;
  onReject: () => void;
  onUndo: () => void;
  onToggleReport: () => void;
  onViewProspects: () => void;
}

const RecommendedICPCard = ({
  icp,
  status,
  isExpanded,
  onAccept,
  onReject,
  onUndo,
  onToggleReport,
  onViewProspects,
}: RecommendedICPCardProps) => {
  const { toast } = useToast();
  const isAccepted = status.status === "accepted";
  const isRejected = status.status === "rejected";
  const isSuggested = status.status === "suggested";

  return (
    <div
      className={`transition-all duration-500 ease-in-out flex-shrink-0 ${
        isExpanded ? "min-w-[620px] max-w-[680px]" : "min-w-[340px] max-w-[360px]"
      }`}
    >
      <Card
        className={`h-full transition-all duration-300 ${
          isAccepted
            ? "border-emerald-200 bg-emerald-50/30"
            : isRejected
              ? "opacity-50 border-muted"
              : ""
        }`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <Badge
                variant="secondary"
                className={`text-xs mb-2 ${
                  icp.type === "refined"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {icp.type === "refined" ? (
                  <><RefreshCw className="h-3 w-3 mr-1" />Refined ICP</>
                ) : (
                  <><Plus className="h-3 w-3 mr-1" />New ICP</>
                )}
              </Badge>
              <CardTitle className="text-base font-semibold truncate">{icp.name}</CardTitle>
              {icp.type === "refined" && icp.sourceICPName && (
                <p className="text-xs text-muted-foreground mt-1">Refined from: {icp.sourceICPName}</p>
              )}
              {icp.tag && icp.type === "new" && (
                <Badge variant="outline" className="mt-1 text-xs">{icp.tag}</Badge>
              )}
            </div>
            <Badge variant="outline" className={`text-xs shrink-0 ${confidenceColor(icp.confidenceScore)}`}>
              {icp.confidenceScore}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pb-3">
          {/* ICP Details */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Industry:</span>
              <p className="font-medium">{icp.industry}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Size:</span>
              <p className="font-medium">{icp.companySize}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Regions:</span>
              <p className="font-medium">{icp.regions.join(", ")}</p>
            </div>
            {icp.marketSize && (
              <div>
                <span className="text-muted-foreground">Market:</span>
                <p className="font-medium">{icp.marketSize} {icp.growth && `(${icp.growth})`}</p>
              </div>
            )}
          </div>

          {/* Why Suggested */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Why Suggested</p>
            <ul className="space-y-1">
              {icp.whySuggested.slice(0, 3).map((reason, idx) => (
                <li key={idx} className="text-xs flex items-start gap-1.5">
                  <Check className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* What Changed */}
          {icp.type === "refined" && icp.whatChanged && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">What Changed</p>
              <ul className="space-y-1">
                {icp.whatChanged.map((c, idx) => (
                  <li key={idx} className="text-xs flex items-start gap-1.5">
                    <RefreshCw className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {icp.type === "new" && icp.opportunityUnlocked && (
            <div className="bg-primary/5 rounded-md p-2">
              <p className="text-xs font-medium text-primary mb-0.5">Opportunity Unlocked</p>
              <p className="text-xs">{icp.opportunityUnlocked}</p>
            </div>
          )}

          {/* Status badges */}
          {isAccepted && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-100 rounded-md p-2">
              <Check className="h-3 w-3" />
              <span>Added to Customer Profile</span>
            </div>
          )}
          {isRejected && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-md p-2">
              <X className="h-3 w-3" />
              <span>Dismissed</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-3 border-t flex flex-col gap-2">
          {/* Accept / Reject */}
          {isSuggested && (
            <div className="flex items-center gap-2 w-full">
              <Button size="sm" onClick={onAccept} className="flex-1">
                <Check className="h-3 w-3 mr-1" />
                Accept
              </Button>
              <Button size="sm" variant="outline" onClick={onReject} className="flex-1">
                <X className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </div>
          )}
          {(isAccepted || isRejected) && (
            <Button size="sm" variant="ghost" onClick={onUndo} className="w-full text-xs text-muted-foreground">
              <Undo2 className="h-3 w-3 mr-1" />
              Undo
            </Button>
          )}
          {/* View Full Report — expand/collapse */}
          <Button
            size="sm"
            variant={isExpanded ? "secondary" : "outline"}
            onClick={onToggleReport}
            className="w-full"
          >
            {isExpanded ? (
              <>
                <X className="h-3 w-3 mr-1" />
                Close Report
              </>
            ) : (
              <>
                <Eye className="h-3 w-3 mr-1" />
                View Full Report
              </>
            )}
          </Button>
        </CardFooter>

        {/* ═══ Inline Expanded Report ═══ */}
        <div
          className={`overflow-hidden transition-all duration-500 ease-in-out ${
            isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {isExpanded && (
            <div className="border-t px-6 py-5 space-y-5">
              {/* Report Header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">Full Report</h4>
                </div>
                <div className="flex items-center gap-1">
                  <EditDropdownMenu onModify={() => toast({ title: "Edit mode", description: "You can now modify this report." })} />
                  <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 gap-1 h-7 text-xs" onClick={() => toast({ title: "Chat with Profiler", description: "Profiler agent chat opening..." })}>
                    <MessageSquare className="h-3.5 w-3.5" />
                    Agentic
                  </Button>
                </div>
              </div>

              {/* Why Suggested (Full) */}
              <div className="bg-primary/[0.03] rounded-lg p-3 border border-primary/10">
                <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-primary" />
                  Why This ICP Was Suggested
                </p>
                <ul className="space-y-1.5">
                  {icp.whySuggested.map((reason, idx) => (
                    <li key={idx} className="text-xs flex items-start gap-2">
                      <Check className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
                {icp.opportunityUnlocked && (
                  <div className="mt-2 bg-primary/5 rounded p-2">
                    <p className="text-[11px] font-medium text-primary">Opportunity: {icp.opportunityUnlocked}</p>
                  </div>
                )}
              </div>

              {/* What Changed / Differs */}
              <div className={`rounded-lg p-3 border ${icp.type === "refined" ? "border-amber-100 bg-amber-50/20" : "border-primary/10 bg-primary/[0.02]"}`}>
                <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-amber-600" />
                  {icp.type === "refined" ? "What Changed" : "How This Differs"}
                </p>
                {icp.type === "refined" && icp.whatChanged ? (
                  <ul className="space-y-1.5">
                    {icp.whatChanged.map((change, idx) => (
                      <li key={idx} className="text-xs flex items-start gap-2">
                        <RefreshCw className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-xs flex items-start gap-2">
                      <Plus className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      <span>New segment: {icp.industry} — {icp.segment}</span>
                    </p>
                    <p className="text-xs flex items-start gap-2">
                      <Users className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      <span>Buyers: {icp.decisionMakers.join(", ")}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Profile Overview */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Industry</p>
                  <p className="font-medium">{icp.industry}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Segment</p>
                  <p className="font-medium">{icp.segment}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Company Size</p>
                  <p className="font-medium">{icp.companySize}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Market Size</p>
                  <p className="font-medium">{icp.marketSize || "N/A"}</p>
                </div>
              </div>

              {/* Decision Makers */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Key Decision Makers
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {icp.decisionMakers.map((dm, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{dm}</Badge>
                  ))}
                </div>
              </div>

              {/* Pain Points & Triggers */}
              {(icp.topPainPoint || (icp.buyingTriggers && icp.buyingTriggers.length > 0)) && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Target className="h-3 w-3" /> Pain Points & Triggers
                  </p>
                  {icp.topPainPoint && (
                    <p className="text-xs font-medium bg-destructive/10 text-destructive p-2 rounded-md mb-2">{icp.topPainPoint}</p>
                  )}
                  {icp.buyingTriggers && (
                    <div className="flex flex-wrap gap-1.5">
                      {icp.buyingTriggers.map((t, i) => (
                        <Badge key={i} variant="outline" className="text-[11px]">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Competitors */}
              {icp.competitors && icp.competitors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Competitors
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {icp.competitors.map((c, i) => (
                      <Badge key={i} variant="outline" className="text-[11px]">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Accept/Reject in report */}
              {isSuggested && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button size="sm" onClick={onAccept} className="flex-1">
                    <Check className="h-3 w-3 mr-1" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={onReject} className="flex-1">
                    <X className="h-3 w-3 mr-1" /> Reject
                  </Button>
                </div>
              )}
              {(isAccepted || isRejected) && (
                <div className="pt-2 border-t">
                  <Button size="sm" variant="ghost" onClick={onUndo} className="w-full text-xs text-muted-foreground">
                    <Undo2 className="h-3 w-3 mr-1" /> Undo
                  </Button>
                </div>
              )}

              {/* View Leads CTA */}
              <div className="bg-primary/[0.03] rounded-lg p-3 border border-primary/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">View prospects</p>
                    <p className="text-[11px] text-muted-foreground">See leads for "{icp.name}"</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={onViewProspects}>
                  Lead Stream <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SuggestedICPCards;
