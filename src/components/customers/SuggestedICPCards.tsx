import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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

  const [existingICPs, setExistingICPs] = useState<ExistingICP[]>([]);
  const [refinedICPs, setRefinedICPs] = useState<SuggestedICP[]>([]);
  const [newICPs, setNewICPs] = useState<SuggestedICP[]>([]);
  const [cardStatuses, setCardStatuses] = useState<Record<string, ICPCardStatus>>({});
  
  const [loading, setLoading] = useState(true);

  // Modal states
  const [selectedExistingICP, setSelectedExistingICP] = useState<ExistingICP | null>(null);
  const [confirmAcceptICP, setConfirmAcceptICP] = useState<SuggestedICP | null>(null);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [reportSheetICP, setReportSheetICP] = useState<SuggestedICP | null>(null);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      let icps: ExistingICP[] = [];
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

      const initialStatuses: Record<string, ICPCardStatus> = {};
      [...refined, ...newSuggestions].forEach((icp) => {
        initialStatuses[icp.id] = { status: "suggested" };
      });
      setCardStatuses(initialStatuses);
      setLoading(false);
    };
    loadData();
  }, [refreshTrigger]);

  // --- Accept flow with confirmation dialog ---
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

    // Add accepted ICP to Current ICPs table
    const newExistingICP: ExistingICP = {
      id: `accepted-${icp.id}`,
      name: icp.name,
      geography: icp.regions?.join(", ") || "—",
      industry: icp.industry,
      companySize: icp.companySize,
      buyerRole: icp.decisionMakers?.join(", ") || "—",
      fitConfidence: icp.confidenceScore,
      status: "active",
    };
    setExistingICPs((prev) => [...prev, newExistingICP]);

    onICPAccepted?.(icp);
    toast({
      title: "Customer Profile updated.",
      description: `"${icp.name}" has been saved to your Customer Profile and Current ICPs.`,
    });
    setConfirmAcceptICP(null);
    // Auto-open report Sheet after accepting
    setReportSheetICP(icp);
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
    if (reportSheetICP?.id === icpId) setReportSheetICP(null);
    toast({ title: "Action undone", description: "ICP returned to suggestions." });
  };

  const handleViewProspects = (icpName: string) => {
    // Navigate to Lead Stream tab (the parent Customers page handles tabs)
    // Dispatch event so the parent can switch tab + filter
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
      {/* ═══ Section 1: Current ICPs (table format) ═══ */}
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
                <TableHead className="text-right">Report</TableHead>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewProspects(icp.name)}
                      className="text-primary hover:text-primary/80"
                    >
                      <Zap className="h-3.5 w-3.5 mr-1" />
                      View Leads
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedExistingICP(icp)}
                      className="text-primary hover:text-primary/80"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      View Report
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* ═══ ICP Report Sheet (partial screen) ═══ */}
      <Sheet
        open={!!selectedExistingICP}
        onOpenChange={(open) => !open && setSelectedExistingICP(null)}
      >
        {selectedExistingICP && (() => {
          const analysis = analyzeICP(selectedExistingICP);
          return (
            <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Profiler's Analysis: {selectedExistingICP.name}
                </SheetTitle>
                <SheetDescription>
                  Here's how Profiler interprets this ICP targeting.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-5">
                {/* Interpretation */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium text-foreground mb-1">Profiler's Interpretation</p>
                  <p className="text-sm text-muted-foreground">{analysis.interpretation}</p>
                </div>

                {/* Strengths */}
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

                {/* Weaknesses */}
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

                {/* Missing */}
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

                {/* Broad/Narrow + Confidence */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{analysis.broadNarrow}</span>
                  </div>
                  <Badge variant="outline" className={`text-xs ${confidenceColor(analysis.confidence)}`}>
                    Confidence: {analysis.confidence}
                  </Badge>
                </div>
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
                  <Button
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={() => {
                      setShowRecommendations(true);
                    }}
                  >
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

      {/* ═══ Section 3: Recommended ICPs (table format) ═══ */}
      {showRecommendations && (
        <div className="space-y-6 animate-fade-in">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Recommended ICPs
            </h3>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Company Size</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSuggestions.map((icp) => {
                    const st = cardStatuses[icp.id] || { status: "suggested" };
                    const isAccepted = st.status === "accepted";
                    const isRejected = st.status === "rejected";
                    const isSuggested = st.status === "suggested";
                    return (
                      <TableRow
                        key={icp.id}
                        className={isRejected ? "opacity-50" : isAccepted ? "bg-emerald-50/30" : ""}
                      >
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              icp.type === "refined"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {icp.type === "refined" ? (
                              <><RefreshCw className="h-3 w-3 mr-1" />Refined</>
                            ) : (
                              <><Plus className="h-3 w-3 mr-1" />New</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{icp.name}</span>
                            {icp.type === "refined" && icp.sourceICPName && (
                              <p className="text-xs text-muted-foreground">From: {icp.sourceICPName}</p>
                            )}
                            {icp.tag && icp.type === "new" && (
                              <Badge variant="outline" className="text-[10px] mt-0.5">{icp.tag}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{icp.industry}</TableCell>
                        <TableCell>{icp.companySize}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${confidenceColor(icp.confidenceScore)}`}>
                            {icp.confidenceScore}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isAccepted && (
                            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                              <Check className="h-3 w-3 mr-1" />Accepted
                            </Badge>
                          )}
                          {isRejected && (
                            <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                              <X className="h-3 w-3 mr-1" />Dismissed
                            </Badge>
                          )}
                          {isSuggested && (
                            <Badge variant="outline" className="text-xs">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewProspects(icp.type === "refined" ? "Refined ICP" : "New ICP")}
                            className="text-primary hover:text-primary/80"
                          >
                            <Zap className="h-3.5 w-3.5 mr-1" />
                            View Leads
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isSuggested && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => handleAcceptClick(icp)} className="h-7 px-2 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50">
                                  <Check className="h-3 w-3 mr-1" />Accept
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleRejectICP(icp)} className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10">
                                  <X className="h-3 w-3 mr-1" />Reject
                                </Button>
                              </>
                            )}
                            {(isAccepted || isRejected) && (
                              <Button size="sm" variant="ghost" onClick={() => handleUndoAction(icp.id)} className="h-7 px-2 text-xs">
                                <Undo2 className="h-3 w-3 mr-1" />Undo
                              </Button>
                            )}
                            {isAccepted && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const foundICP = allSuggestions.find(s => s.id === icp.id);
                                  if (foundICP) setReportSheetICP(foundICP);
                                }}
                                className="h-7 px-2 text-xs text-primary"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />Report
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* ICP Report Sheet (side panel) */}
          <Sheet open={!!reportSheetICP} onOpenChange={(open) => !open && setReportSheetICP(null)}>
            {reportSheetICP && (
              <SheetContent side="right" className="sm:max-w-2xl w-[90vw] overflow-y-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    ICP Report: {reportSheetICP.name}
                  </SheetTitle>
                  <SheetDescription>
                    Full report for the accepted {reportSheetICP.type === "refined" ? "refined" : "new"} ICP
                  </SheetDescription>
                </SheetHeader>
                <ICPReportPanel
                  icp={reportSheetICP}
                  onClose={() => setReportSheetICP(null)}
                  onViewProspects={() => handleViewProspects(reportSheetICP.type === "refined" ? "Refined ICP" : "New ICP")}
                />
              </SheetContent>
            )}
          </Sheet>
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

// ========== ICP CARD COMPONENT ==========
interface ICPCardProps {
  icp: SuggestedICP;
  status: ICPCardStatus;
  onAccept: () => void;
  onReject: () => void;
  onUndo: () => void;
  onViewDetails: () => void;
  isExpanded: boolean;
}

const ICPCard = ({ icp, status, onAccept, onReject, onUndo, onViewDetails, isExpanded }: ICPCardProps) => {
  const isAccepted = status.status === "accepted";
  const isRejected = status.status === "rejected";
  const isSuggested = status.status === "suggested";

  return (
    <Card
      className={`min-w-[340px] max-w-[360px] flex-shrink-0 transition-all duration-300 ${
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
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refined ICP
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3 mr-1" />
                  New ICP
                </>
              )}
            </Badge>
            <CardTitle className="text-base font-semibold truncate">{icp.name}</CardTitle>
            {icp.type === "refined" && icp.sourceICPName && (
              <p className="text-xs text-muted-foreground mt-1">Refined from: {icp.sourceICPName}</p>
            )}
            {icp.tag && icp.type === "new" && (
              <Badge variant="outline" className="mt-1 text-xs">
                {icp.tag}
              </Badge>
            )}
          </div>
          <Badge variant="outline" className={`text-xs shrink-0 ${confidenceColor(icp.confidenceScore)}`}>
            {icp.confidenceScore}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
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

        {icp.type === "refined" && icp.whatChanged && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">What Changed</p>
            <ul className="space-y-1">
              {icp.whatChanged.slice(0, 2).map((c, idx) => (
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

        {isAccepted && (
          <Button size="sm" variant="outline" onClick={onViewDetails} className="w-full">
            <Eye className="h-3 w-3 mr-1" />
            View ICP Report
            {isExpanded ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

// ========== ICP REPORT PANEL ==========
interface ICPReportPanelProps {
  icp: SuggestedICP;
  onClose: () => void;
  onViewProspects: () => void;
}

const ICPReportPanel = ({ icp, onClose, onViewProspects }: ICPReportPanelProps) => {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-lg font-semibold truncate">ICP Report: {icp.name}</h4>
            <Badge
              variant="secondary"
              className={`text-xs ${
                icp.type === "refined"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {icp.type === "refined" ? "Refined ICP" : "New ICP"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Full report generated from accepted ICP context
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
          <Button variant="ghost" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Why Suggested & What Changed */}
      <div className="grid grid-cols-1 gap-4">
        {/* Why This ICP Was Suggested */}
        <Card className="border-primary/10 bg-primary/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              Why This ICP Was Suggested
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {icp.whySuggested.map((reason, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
            {icp.opportunityUnlocked && (
              <div className="mt-3 bg-primary/5 rounded-md p-2.5">
                <p className="text-xs font-medium text-primary mb-0.5">Opportunity Unlocked</p>
                <p className="text-xs">{icp.opportunityUnlocked}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* What Changed From Current ICPs */}
        <Card className={`${icp.type === "refined" ? "border-amber-100 bg-amber-50/20" : "border-primary/10 bg-primary/[0.02]"}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-amber-600" />
              {icp.type === "refined" ? "What Changed From Current ICPs" : "How This Differs From Current ICPs"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {icp.type === "refined" && icp.whatChanged && icp.whatChanged.length > 0 ? (
              <ul className="space-y-2">
                {icp.whatChanged.map((change, idx) => (
                  <li key={idx} className="text-sm flex items-start gap-2">
                    <RefreshCw className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-2">
                <p className="text-sm flex items-start gap-2">
                  <Plus className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span>Entirely new segment not covered by current ICPs</span>
                </p>
                <p className="text-sm flex items-start gap-2">
                  <Target className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span>Targets {icp.industry} — {icp.segment}</span>
                </p>
                <p className="text-sm flex items-start gap-2">
                  <Users className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span>New buyer roles: {icp.decisionMakers.join(", ")}</span>
                </p>
              </div>
            )}
            {icp.sourceICPName && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  {icp.type === "refined" ? "Refined from" : "Related to"}: <span className="font-medium text-foreground">{icp.sourceICPName}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Report grid */}
      <div className="grid grid-cols-1 gap-4">
        {/* Profile Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Profile Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Industry</p>
                <p className="font-medium">{icp.industry}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Segment</p>
                <p className="font-medium">{icp.segment}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Company Size</p>
                <p className="font-medium">{icp.companySize}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Market Size</p>
                <p className="font-medium">{icp.marketSize || "N/A"}</p>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-1">Regions</p>
              <div className="flex flex-wrap gap-1">
                {icp.regions.map((r, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-1">Key Attributes</p>
              <div className="flex flex-wrap gap-1">
                {icp.keyAttributes.map((a, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {a}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Decision Makers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Key Decision Makers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {icp.decisionMakers.map((dm, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                  <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{dm}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pain Points & Triggers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Pain Points & Buying Triggers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {icp.topPainPoint && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Top Pain Point</p>
                <p className="text-sm font-medium bg-destructive/10 text-destructive p-2 rounded-md">
                  {icp.topPainPoint}
                </p>
              </div>
            )}
            {icp.buyingTriggers && icp.buyingTriggers.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Buying Triggers</p>
                <ul className="space-y-1">
                  {icp.buyingTriggers.map((t, i) => (
                    <li key={i} className="text-sm flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Competitive Landscape */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Competitive Landscape
            </CardTitle>
          </CardHeader>
          <CardContent>
            {icp.competitors && icp.competitors.length > 0 ? (
              <div className="space-y-2">
                {icp.competitors.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                    <span className="text-sm font-medium">{c}</span>
                    <Badge variant="outline" className="text-xs">
                      Competitor
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No competitor data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ View Prospects CTA ═══ */}
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">View prospects for this ICP</p>
                <p className="text-xs text-muted-foreground">
                  See high-intent leads in Lead Stream filtered by "{icp.name}"
                </p>
              </div>
            </div>
            <Button size="sm" className="gap-1.5" onClick={onViewProspects}>
              Go to Lead Stream
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuggestedICPCards;
