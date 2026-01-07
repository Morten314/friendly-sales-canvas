import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Edit,
  Globe,
  Building2,
  Users,
  X,
  Check,
  Ban,
  Target,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Types
type FitConfidence = "high" | "medium" | "low";

interface ICP {
  id: string;
  primaryRegion: string;
  secondarySubMarkets: string;
  industry: string[];
  companySize: string[];
  buyerRole: string[];
  accountsToAvoid: string[];
  fitConfidence: FitConfidence;
  status: "saved";
  createdAt: Date;
}

// Suggested values
const REGION_SUGGESTIONS = [
  "North America",
  "EMEA",
  "APAC",
  "Latin America",
  "UK & Ireland",
  "DACH",
  "Nordics",
  "ANZ",
  "Southeast Asia",
  "Middle East",
];

const INDUSTRY_SUGGESTIONS = [
  "SaaS",
  "Fintech",
  "Healthcare",
  "E-commerce",
  "Manufacturing",
  "Logistics",
  "Education",
  "Real Estate",
  "Media & Entertainment",
  "Professional Services",
];

const COMPANY_SIZE_OPTIONS = [
  "1–10",
  "11–50",
  "51–200",
  "201–500",
  "500+",
];

const BUYER_ROLE_SUGGESTIONS = [
  "VP of Sales",
  "CTO",
  "CEO",
  "Head of Marketing",
  "VP of Engineering",
  "CFO",
  "Director of Operations",
  "Product Manager",
  "Head of Growth",
  "CMO",
];

const FIT_CONFIDENCE_OPTIONS: { value: FitConfidence; label: string }[] = [
  { value: "high", label: "High - proven and repeatable" },
  { value: "medium", label: "Medium - some wins, still learning" },
  { value: "low", label: "Low - exploratory" },
];

type InlineStep = 
  | "primaryRegion" 
  | "secondarySubMarkets" 
  | "industry" 
  | "companySize" 
  | "buyerRole" 
  | "accountsToAvoid" 
  | "fitConfidence";

const ICPManager: React.FC = () => {
  const { toast } = useToast();
  const [icps, setIcps] = useState<ICP[]>([]);
  
  // Inline editing state
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [inlineStep, setInlineStep] = useState<InlineStep>("primaryRegion");
  const [primaryRegion, setPrimaryRegion] = useState("");
  const [secondarySubMarkets, setSecondarySubMarkets] = useState("");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [customIndustry, setCustomIndustry] = useState("");
  const [selectedCompanySizes, setSelectedCompanySizes] = useState<string[]>([]);
  const [selectedBuyerRoles, setSelectedBuyerRoles] = useState<string[]>([]);
  const [customBuyerRole, setCustomBuyerRole] = useState("");
  const [accountsToAvoid, setAccountsToAvoid] = useState("");
  const [fitConfidence, setFitConfidence] = useState<FitConfidence | "">("");
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Suggestions state
  const [showRegionSuggestions, setShowRegionSuggestions] = useState(false);
  const [showIndustrySuggestions, setShowIndustrySuggestions] = useState(false);
  const [showBuyerRoleSuggestions, setShowBuyerRoleSuggestions] = useState(false);
  
  const primaryRegionRef = useRef<HTMLInputElement>(null);
  const secondarySubMarketsRef = useRef<HTMLInputElement>(null);
  const industryRef = useRef<HTMLInputElement>(null);
  const buyerRoleRef = useRef<HTMLInputElement>(null);
  const accountsToAvoidRef = useRef<HTMLInputElement>(null);

  // Focus management
  useEffect(() => {
    if (inlineStep === "primaryRegion" && primaryRegionRef.current) {
      primaryRegionRef.current.focus();
    } else if (inlineStep === "secondarySubMarkets" && secondarySubMarketsRef.current) {
      secondarySubMarketsRef.current.focus();
    } else if (inlineStep === "industry" && industryRef.current) {
      industryRef.current.focus();
    } else if (inlineStep === "buyerRole" && buyerRoleRef.current) {
      buyerRoleRef.current.focus();
    } else if (inlineStep === "accountsToAvoid" && accountsToAvoidRef.current) {
      accountsToAvoidRef.current.focus();
    }
  }, [inlineStep]);

  const resetInlineForm = () => {
    setIsAddingInline(false);
    setInlineStep("primaryRegion");
    setPrimaryRegion("");
    setSecondarySubMarkets("");
    setSelectedIndustries([]);
    setCustomIndustry("");
    setSelectedCompanySizes([]);
    setSelectedBuyerRoles([]);
    setCustomBuyerRole("");
    setAccountsToAvoid("");
    setFitConfidence("");
    setEditingId(null);
    setShowRegionSuggestions(false);
    setShowIndustrySuggestions(false);
    setShowBuyerRoleSuggestions(false);
  };

  const handleStartAdd = () => {
    resetInlineForm();
    setIsAddingInline(true);
  };

  const handleCancelInline = () => {
    resetInlineForm();
  };

  const handlePrimaryRegionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && primaryRegion.trim()) {
      e.preventDefault();
      setShowRegionSuggestions(false);
      setInlineStep("secondarySubMarkets");
    } else if (e.key === "Escape") {
      handleCancelInline();
    }
  };

  const handleSecondarySubMarketsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setInlineStep("industry");
    } else if (e.key === "Escape") {
      handleCancelInline();
    }
  };

  const handleIndustryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (customIndustry.trim() && !selectedIndustries.includes(customIndustry.trim())) {
        setSelectedIndustries(prev => [...prev, customIndustry.trim()]);
        setCustomIndustry("");
      } else if (selectedIndustries.length > 0) {
        setShowIndustrySuggestions(false);
        setInlineStep("companySize");
      }
    } else if (e.key === "Escape") {
      handleCancelInline();
    }
  };

  const handleCompanySizeNext = () => {
    if (selectedCompanySizes.length > 0) {
      setInlineStep("buyerRole");
    }
  };

  const handleBuyerRoleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (customBuyerRole.trim() && !selectedBuyerRoles.includes(customBuyerRole.trim())) {
        setSelectedBuyerRoles(prev => [...prev, customBuyerRole.trim()]);
        setCustomBuyerRole("");
      } else if (selectedBuyerRoles.length > 0) {
        setShowBuyerRoleSuggestions(false);
        setInlineStep("accountsToAvoid");
      }
    } else if (e.key === "Escape") {
      handleCancelInline();
    }
  };

  const handleAccountsToAvoidKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setInlineStep("fitConfidence");
    } else if (e.key === "Escape") {
      handleCancelInline();
    }
  };

  const handleFitConfidenceSelect = (value: FitConfidence) => {
    setFitConfidence(value);
  };

  const handleIndustryToggle = (industry: string) => {
    setSelectedIndustries(prev =>
      prev.includes(industry) ? prev.filter(i => i !== industry) : [...prev, industry]
    );
  };

  const handleCompanySizeToggle = (size: string) => {
    setSelectedCompanySizes(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  };

  const handleBuyerRoleToggle = (role: string) => {
    setSelectedBuyerRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleRegionSuggestionClick = (region: string) => {
    setPrimaryRegion(region);
    setShowRegionSuggestions(false);
    setInlineStep("secondarySubMarkets");
  };

  const handleSaveICP = () => {
    if (!primaryRegion.trim()) {
      toast({
        title: "Primary Region required",
        description: "Please enter a primary region.",
        variant: "destructive",
      });
      return;
    }

    if (selectedIndustries.length === 0) {
      toast({
        title: "Industry required",
        description: "Please select at least one industry.",
        variant: "destructive",
      });
      return;
    }

    if (selectedCompanySizes.length === 0) {
      toast({
        title: "Company Size required",
        description: "Please select at least one company size.",
        variant: "destructive",
      });
      return;
    }

    if (selectedBuyerRoles.length === 0) {
      toast({
        title: "Buyer Role required",
        description: "Please select at least one buyer role.",
        variant: "destructive",
      });
      return;
    }

    if (!fitConfidence) {
      toast({
        title: "Fit Confidence required",
        description: "Please select a fit confidence level.",
        variant: "destructive",
      });
      return;
    }

    const newICP: ICP = {
      id: editingId || `icp-${Date.now()}`,
      primaryRegion: primaryRegion.trim(),
      secondarySubMarkets: secondarySubMarkets.trim(),
      industry: selectedIndustries,
      companySize: selectedCompanySizes,
      buyerRole: selectedBuyerRoles,
      accountsToAvoid: accountsToAvoid.trim() ? accountsToAvoid.split(",").map(a => a.trim()) : [],
      fitConfidence: fitConfidence as FitConfidence,
      status: "saved",
      createdAt: new Date(),
    };

    if (editingId) {
      setIcps(prev => prev.map(icp => (icp.id === editingId ? newICP : icp)));
      toast({
        title: "ICP updated",
        description: "Your ICP has been updated successfully.",
      });
    } else {
      setIcps(prev => [...prev, newICP]);
      toast({
        title: "ICP saved",
        description: "Your ICP hypothesis has been saved.",
      });
    }

    resetInlineForm();
  };

  const handleEditICP = (icp: ICP) => {
    setEditingId(icp.id);
    setPrimaryRegion(icp.primaryRegion);
    setSecondarySubMarkets(icp.secondarySubMarkets);
    setSelectedIndustries(icp.industry);
    setSelectedCompanySizes(icp.companySize);
    setSelectedBuyerRoles(icp.buyerRole);
    setAccountsToAvoid(icp.accountsToAvoid.join(", "));
    setFitConfidence(icp.fitConfidence);
    setInlineStep("fitConfidence");
    setIsAddingInline(true);
  };

  const handleDeleteICP = (id: string) => {
    setIcps(prev => prev.filter(icp => icp.id !== id));
    toast({
      title: "ICP deleted",
      description: "The ICP has been removed.",
    });
  };

  const getFitConfidenceBadge = (confidence: FitConfidence) => {
    switch (confidence) {
      case "high":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
            High
          </Badge>
        );
      case "medium":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800">
            Medium
          </Badge>
        );
      case "low":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
            Low
          </Badge>
        );
    }
  };

  const canSave = 
    primaryRegion.trim() && 
    selectedIndustries.length > 0 && 
    selectedCompanySizes.length > 0 && 
    selectedBuyerRoles.length > 0 && 
    fitConfidence &&
    inlineStep === "fitConfidence";

  const filteredRegionSuggestions = REGION_SUGGESTIONS.filter(r =>
    r.toLowerCase().includes(primaryRegion.toLowerCase())
  );

  const filteredIndustrySuggestions = INDUSTRY_SUGGESTIONS.filter(i =>
    i.toLowerCase().includes(customIndustry.toLowerCase()) && !selectedIndustries.includes(i)
  );

  const filteredBuyerRoleSuggestions = BUYER_ROLE_SUGGESTIONS.filter(r =>
    r.toLowerCase().includes(customBuyerRole.toLowerCase()) && !selectedBuyerRoles.includes(r)
  );

  // Render the inline editing row
  const renderInlineEditRow = () => {
    if (!isAddingInline) return null;

    return (
      <div className="bg-muted/30 border-2 border-primary/20 rounded-lg p-4 mb-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">
            {editingId ? "Edit ICP" : "Add New ICP"}
          </h4>
          <Button variant="ghost" size="sm" onClick={handleCancelInline}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Geography Section */}
          <div className="space-y-3">
            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Globe className="h-3.5 w-3.5" />
              Geography
            </h5>
            
            {/* Primary Region */}
            <div className="space-y-1 relative">
              <label className="text-xs text-muted-foreground">Primary Region</label>
              <Input
                ref={primaryRegionRef}
                placeholder="e.g., North America"
                value={primaryRegion}
                onChange={(e) => {
                  setPrimaryRegion(e.target.value);
                  setShowRegionSuggestions(true);
                }}
                onKeyDown={handlePrimaryRegionKeyDown}
                onFocus={() => setShowRegionSuggestions(true)}
                className="h-9 text-sm"
                disabled={inlineStep !== "primaryRegion" && !editingId}
              />
              {inlineStep === "primaryRegion" && showRegionSuggestions && filteredRegionSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
                  {filteredRegionSuggestions.map(region => (
                    <button
                      key={region}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                      onClick={() => handleRegionSuggestionClick(region)}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              )}
              {inlineStep === "primaryRegion" && primaryRegion.trim() && (
                <p className="text-xs text-muted-foreground">Press Enter to continue</p>
              )}
            </div>

            {/* Secondary Sub-Markets */}
            {(inlineStep !== "primaryRegion" || editingId) && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Secondary Sub-Markets (Optional)</label>
                <Input
                  ref={secondarySubMarketsRef}
                  placeholder="e.g., UK, Germany"
                  value={secondarySubMarkets}
                  onChange={(e) => setSecondarySubMarkets(e.target.value)}
                  onKeyDown={handleSecondarySubMarketsKeyDown}
                  className="h-9 text-sm"
                  disabled={inlineStep !== "secondarySubMarkets" && !editingId}
                />
                {inlineStep === "secondarySubMarkets" && (
                  <p className="text-xs text-muted-foreground">Press Enter to continue</p>
                )}
              </div>
            )}
          </div>

          {/* Company Section */}
          {(["industry", "companySize", "buyerRole", "accountsToAvoid", "fitConfidence"].includes(inlineStep) || editingId) && (
            <div className="space-y-3">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5" />
                Company
              </h5>

              {/* Industry */}
              <div className="space-y-1 relative">
                <label className="text-xs text-muted-foreground">Industry</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedIndustries.map(ind => (
                    <Badge 
                      key={ind} 
                      variant="default" 
                      className="text-xs cursor-pointer"
                      onClick={() => handleIndustryToggle(ind)}
                    >
                      {ind} ×
                    </Badge>
                  ))}
                </div>
                <Input
                  ref={industryRef}
                  placeholder="Type or select..."
                  value={customIndustry}
                  onChange={(e) => {
                    setCustomIndustry(e.target.value);
                    setShowIndustrySuggestions(true);
                  }}
                  onKeyDown={handleIndustryKeyDown}
                  onFocus={() => setShowIndustrySuggestions(true)}
                  className="h-9 text-sm"
                  disabled={inlineStep !== "industry" && !editingId}
                />
                {inlineStep === "industry" && showIndustrySuggestions && filteredIndustrySuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-32 overflow-auto">
                    {filteredIndustrySuggestions.slice(0, 5).map(ind => (
                      <button
                        key={ind}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                        onClick={() => {
                          handleIndustryToggle(ind);
                          setCustomIndustry("");
                        }}
                      >
                        {ind}
                      </button>
                    ))}
                  </div>
                )}
                {inlineStep === "industry" && selectedIndustries.length > 0 && (
                  <p className="text-xs text-muted-foreground">Press Enter to continue</p>
                )}
              </div>

              {/* Company Size */}
              {(["companySize", "buyerRole", "accountsToAvoid", "fitConfidence"].includes(inlineStep) || editingId) && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Company Size</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COMPANY_SIZE_OPTIONS.map(size => (
                      <Badge
                        key={size}
                        variant={selectedCompanySizes.includes(size) ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => {
                          if (inlineStep === "companySize" || editingId) {
                            handleCompanySizeToggle(size);
                          }
                        }}
                      >
                        {size}
                      </Badge>
                    ))}
                  </div>
                  {inlineStep === "companySize" && selectedCompanySizes.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleCompanySizeNext}
                      className="mt-2 text-xs"
                    >
                      Continue →
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Buyer & Fit Section */}
          {(["buyerRole", "accountsToAvoid", "fitConfidence"].includes(inlineStep) || editingId) && (
            <div className="space-y-3">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Buyer & Fit
              </h5>

              {/* Buyer Role */}
              <div className="space-y-1 relative">
                <label className="text-xs text-muted-foreground">Buyer Role</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedBuyerRoles.map(role => (
                    <Badge 
                      key={role} 
                      variant="default" 
                      className="text-xs cursor-pointer"
                      onClick={() => handleBuyerRoleToggle(role)}
                    >
                      {role} ×
                    </Badge>
                  ))}
                </div>
                <Input
                  ref={buyerRoleRef}
                  placeholder="Type or select..."
                  value={customBuyerRole}
                  onChange={(e) => {
                    setCustomBuyerRole(e.target.value);
                    setShowBuyerRoleSuggestions(true);
                  }}
                  onKeyDown={handleBuyerRoleKeyDown}
                  onFocus={() => setShowBuyerRoleSuggestions(true)}
                  className="h-9 text-sm"
                  disabled={inlineStep !== "buyerRole" && !editingId}
                />
                {inlineStep === "buyerRole" && showBuyerRoleSuggestions && filteredBuyerRoleSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-32 overflow-auto">
                    {filteredBuyerRoleSuggestions.slice(0, 5).map(role => (
                      <button
                        key={role}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                        onClick={() => {
                          handleBuyerRoleToggle(role);
                          setCustomBuyerRole("");
                        }}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                )}
                {inlineStep === "buyerRole" && selectedBuyerRoles.length > 0 && (
                  <p className="text-xs text-muted-foreground">Press Enter to continue</p>
                )}
              </div>

              {/* Accounts to Avoid */}
              {(["accountsToAvoid", "fitConfidence"].includes(inlineStep) || editingId) && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Accounts to Avoid (Optional)</label>
                  <Input
                    ref={accountsToAvoidRef}
                    placeholder="e.g., CompanyA, CompanyB"
                    value={accountsToAvoid}
                    onChange={(e) => setAccountsToAvoid(e.target.value)}
                    onKeyDown={handleAccountsToAvoidKeyDown}
                    className="h-9 text-sm"
                    disabled={inlineStep !== "accountsToAvoid" && !editingId}
                  />
                  {inlineStep === "accountsToAvoid" && (
                    <p className="text-xs text-muted-foreground">Press Enter to continue</p>
                  )}
                </div>
              )}

              {/* ICP Fit Confidence */}
              {(inlineStep === "fitConfidence" || editingId) && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">ICP Fit Confidence</label>
                  <Select
                    value={fitConfidence}
                    onValueChange={(value) => handleFitConfidenceSelect(value as FitConfidence)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select confidence level" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {FIT_CONFIDENCE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Save Button */}
        {inlineStep === "fitConfidence" && (
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handleCancelInline}>
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={handleSaveICP}
              disabled={!canSave}
              className="gap-1"
            >
              <Check className="h-4 w-4" />
              Save
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Customer Profile</h3>
          <p className="text-sm text-muted-foreground">
            Define your Ideal Customer Profiles (ICPs) for agent targeting
          </p>
        </div>
        {icps.length > 0 && !isAddingInline && (
          <Button onClick={handleStartAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add ICP
          </Button>
        )}
      </div>

      {/* Empty State */}
      {icps.length === 0 && !isAddingInline && (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h4 className="text-lg font-medium mb-2">No ICPs defined yet</h4>
          <p className="text-muted-foreground text-sm mb-4">
            Define your Ideal Customer Profiles to help agents target the right accounts.
          </p>
          <Button onClick={handleStartAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add ICP
          </Button>
        </div>
      )}

      {/* Inline Edit Form */}
      {renderInlineEditRow()}

      {/* ICPs Table */}
      {icps.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Geography</TableHead>
                <TableHead className="font-semibold">Industry</TableHead>
                <TableHead className="font-semibold">Company Size</TableHead>
                <TableHead className="font-semibold">Buyer Role</TableHead>
                <TableHead className="font-semibold">Fit Confidence</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {icps.map((icp) => (
                <TableRow key={icp.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{icp.primaryRegion}</span>
                      {icp.secondarySubMarkets && (
                        <span className="text-sm text-muted-foreground block">
                          {icp.secondarySubMarkets}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {icp.industry.slice(0, 2).map(ind => (
                        <Badge key={ind} variant="outline" className="text-xs">
                          {ind}
                        </Badge>
                      ))}
                      {icp.industry.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{icp.industry.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {icp.companySize.map(size => (
                        <Badge key={size} variant="secondary" className="text-xs">
                          {size}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {icp.buyerRole.slice(0, 2).map(role => (
                        <Badge key={role} variant="outline" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                      {icp.buyerRole.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{icp.buyerRole.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getFitConfidenceBadge(icp.fitConfidence)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800">
                      Saved
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditICP(icp)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteICP(icp.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Another ICP */}
      {icps.length > 0 && !isAddingInline && (
        <Button variant="outline" onClick={handleStartAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add another ICP
        </Button>
      )}
    </div>
  );
};

export default ICPManager;
