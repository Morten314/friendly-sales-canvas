import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Target,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { setUserLocalStorage, getUserLocalStorage, removeUserLocalStorage } from "@/utils/cacheUtils";

// Types
type FitConfidence = "high" | "medium" | "low";

interface ICP {
  id: string;
  primaryRegion: string;
  industry: string[];
  companySize: string[];
  buyerRole: string[];
  accountsOnWatchlist: string[];
  accountsToAvoid: string[];
  fitConfidence: FitConfidence;
  additionalContext: string;
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
  | "industry" 
  | "companySize" 
  | "buyerRole" 
  | "accountsOnWatchlist"
  | "accountsToAvoid" 
  | "fitConfidence"
  | "additionalContext";

const ICPManager: React.FC = () => {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [icps, setIcps] = useState<ICP[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Inline editing state
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [inlineStep, setInlineStep] = useState<InlineStep>("primaryRegion");
  const [primaryRegion, setPrimaryRegion] = useState("");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [customIndustry, setCustomIndustry] = useState("");
  const [selectedCompanySizes, setSelectedCompanySizes] = useState<string[]>([]);
  const [selectedBuyerRoles, setSelectedBuyerRoles] = useState<string[]>([]);
  const [customBuyerRole, setCustomBuyerRole] = useState("");
  const [accountsOnWatchlist, setAccountsOnWatchlist] = useState("");
  const [accountsToAvoid, setAccountsToAvoid] = useState("");
  const [fitConfidence, setFitConfidence] = useState<FitConfidence | "">("");
  const [additionalContext, setAdditionalContext] = useState("");
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Suggestions state
  const [showRegionSuggestions, setShowRegionSuggestions] = useState(false);
  const [showIndustrySuggestions, setShowIndustrySuggestions] = useState(false);
  const [showBuyerRoleSuggestions, setShowBuyerRoleSuggestions] = useState(false);
  
  const primaryRegionRef = useRef<HTMLInputElement>(null);
  const industryRef = useRef<HTMLInputElement>(null);
  const buyerRoleRef = useRef<HTMLInputElement>(null);
  const accountsOnWatchlistRef = useRef<HTMLInputElement>(null);
  const accountsToAvoidRef = useRef<HTMLInputElement>(null);
  const additionalContextRef = useRef<HTMLTextAreaElement>(null);

  // Save customer profile (ICPs) to backend with retry logic
  const saveCustomerProfileToBackend = async (icpsToSave: ICP[], retryCount = 0) => {
    if (!currentUser?.uid) {
      console.warn("Cannot save customer profile: User not authenticated");
      // Save to localStorage as fallback
      try {
        localStorage.setItem(`customerProfile_${currentUser?.uid || 'anonymous'}`, JSON.stringify(icpsToSave));
      } catch (e) {
        console.error("Failed to save to localStorage:", e);
      }
      return;
    }

    setIsSaving(true);
    try {
      // Prepare payload with customer profile data
      // Since API is open-ended, we'll include all ICP data
      const payload = {
        profile_type: "company",
        customer_profile: {
          icps: icpsToSave.map(icp => ({
            id: icp.id,
            primary_region: icp.primaryRegion,
            industry: icp.industry,
            company_size: icp.companySize,
            buyer_role: icp.buyerRole,
            accounts_on_watchlist: icp.accountsOnWatchlist,
            accounts_to_avoid: icp.accountsToAvoid,
            fit_confidence: icp.fitConfidence,
            additional_context: icp.additionalContext,
            status: icp.status,
            created_at: icp.createdAt instanceof Date ? icp.createdAt.toISOString() : icp.createdAt,
          })),
        },
      };

      console.log("=== ICP MANAGER: Saving customer profile to backend ===");
      console.log("Payload:", payload);

      // Always save to localStorage first as backup
      try {
        setUserLocalStorage('customerProfile', JSON.stringify(icpsToSave), currentUser.uid);
        setUserLocalStorage('customerProfile_pending', JSON.stringify(payload), currentUser.uid);
      } catch (e) {
        console.warn("Failed to save to localStorage:", e);
      }

      const apiUrl = `/api/profile/company?user_id=${currentUser.uid}`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        
        // Retry for 500 errors (server/database issues) up to 2 times
        if (response.status === 500 && retryCount < 2) {
          console.log(`Retrying save (attempt ${retryCount + 1}/2)...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
          return saveCustomerProfileToBackend(icpsToSave, retryCount + 1);
        }
        
        throw new Error(`Failed to save customer profile: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("Customer profile saved successfully:", data);
      
      // Clear pending flag on success
      try {
        removeUserLocalStorage('customerProfile_pending', currentUser.uid);
      } catch (e) {
        console.warn("Failed to clear pending flag:", e);
      }
    } catch (error) {
      console.error("Error saving customer profile:", error);
      
      // Determine error message based on error type
      const isNetworkError = error instanceof TypeError && error.message.includes('fetch');
      const isServerError = error instanceof Error && error.message.includes('500');
      
      if (isServerError || isNetworkError) {
        toast({
          title: "Backend temporarily unavailable",
          description: "Your customer profile has been saved locally and will sync automatically when the backend is available.",
          variant: "default",
        });
      } else {
        toast({
          title: "Save warning",
          description: "Customer profile saved locally but failed to sync with backend. Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Load customer profile (ICPs) from backend
  const loadCustomerProfileFromBackend = async () => {
    if (!currentUser?.uid) {
      return;
    }

    setIsLoading(true);
    try {
      const apiUrl = `/api/profile/company?user_id=${currentUser.uid}`;
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.log("No existing customer profile found in API");
        return;
      }

      const data = await response.json();
      
      // Check if customer_profile exists in the response
      if (data.customer_profile && data.customer_profile.icps && Array.isArray(data.customer_profile.icps)) {
        const loadedICPs: ICP[] = data.customer_profile.icps.map((icp: any) => ({
          id: icp.id || `icp-${Date.now()}-${Math.random()}`,
          primaryRegion: icp.primary_region || icp.primaryRegion || "",
          industry: Array.isArray(icp.industry) ? icp.industry : [],
          companySize: Array.isArray(icp.company_size) ? icp.company_size : Array.isArray(icp.companySize) ? icp.companySize : [],
          buyerRole: Array.isArray(icp.buyer_role) ? icp.buyer_role : Array.isArray(icp.buyerRole) ? icp.buyerRole : [],
          accountsOnWatchlist: Array.isArray(icp.accounts_on_watchlist) ? icp.accounts_on_watchlist : Array.isArray(icp.accountsOnWatchlist) ? icp.accountsOnWatchlist : [],
          accountsToAvoid: Array.isArray(icp.accounts_to_avoid) ? icp.accounts_to_avoid : Array.isArray(icp.accountsToAvoid) ? icp.accountsToAvoid : [],
          fitConfidence: (icp.fit_confidence || icp.fitConfidence || "medium") as FitConfidence,
          additionalContext: icp.additional_context || icp.additionalContext || "",
          status: icp.status || "saved",
          createdAt: icp.created_at ? new Date(icp.created_at) : (icp.createdAt ? new Date(icp.createdAt) : new Date()),
        }));

        setIcps(loadedICPs);
        console.log("Customer profile loaded from backend:", loadedICPs);
        
        // Dispatch event to notify MissionControl that customer profile is loaded
        if (loadedICPs.length > 0) {
          window.dispatchEvent(new CustomEvent('customerProfileSaved'));
        }
      }
    } catch (error) {
      console.error("Error loading customer profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load customer profile on mount
  useEffect(() => {
    if (currentUser?.uid) {
      loadCustomerProfileFromBackend();
      
      // Check for pending saves and retry them
      const retryPendingSave = async () => {
        try {
          const pendingData = getUserLocalStorage('customerProfile_pending', currentUser.uid);
          if (pendingData) {
            const pendingPayload = JSON.parse(pendingData);
            console.log("Found pending customer profile save, retrying...");
            // Extract ICPs from the pending payload to retry
            const icpsFromPending = pendingPayload.customer_profile?.icps || [];
            if (icpsFromPending.length > 0) {
              // Convert back to ICP format
              const icpsToRetry: ICP[] = icpsFromPending.map((icp: any) => ({
                id: icp.id,
                primaryRegion: icp.primary_region || icp.primaryRegion || "",
                industry: Array.isArray(icp.industry) ? icp.industry : [],
                companySize: Array.isArray(icp.company_size) ? icp.company_size : [],
                buyerRole: Array.isArray(icp.buyer_role) ? icp.buyer_role : [],
                accountsOnWatchlist: Array.isArray(icp.accounts_on_watchlist) ? icp.accounts_on_watchlist : [],
                accountsToAvoid: Array.isArray(icp.accounts_to_avoid) ? icp.accounts_to_avoid : [],
                fitConfidence: (icp.fit_confidence || icp.fitConfidence || "medium") as FitConfidence,
                additionalContext: icp.additional_context || icp.additionalContext || "",
                status: icp.status || "saved",
                createdAt: icp.created_at ? new Date(icp.created_at) : new Date(),
              }));
              await saveCustomerProfileToBackend(icpsToRetry, 0);
            }
          }
        } catch (error) {
          console.error("Error retrying pending save:", error);
        }
      };
      
      // Retry after a short delay to allow backend to recover
      const retryTimer = setTimeout(retryPendingSave, 5000);
      return () => clearTimeout(retryTimer);
    }
  }, [currentUser?.uid]);

  // Focus management
  useEffect(() => {
    if (inlineStep === "primaryRegion" && primaryRegionRef.current) {
      primaryRegionRef.current.focus();
    } else if (inlineStep === "industry" && industryRef.current) {
      industryRef.current.focus();
    } else if (inlineStep === "buyerRole" && buyerRoleRef.current) {
      buyerRoleRef.current.focus();
    } else if (inlineStep === "accountsOnWatchlist" && accountsOnWatchlistRef.current) {
      accountsOnWatchlistRef.current.focus();
    } else if (inlineStep === "accountsToAvoid" && accountsToAvoidRef.current) {
      accountsToAvoidRef.current.focus();
    } else if (inlineStep === "additionalContext" && additionalContextRef.current) {
      additionalContextRef.current.focus();
    }
  }, [inlineStep]);

  const resetInlineForm = () => {
    setIsAddingInline(false);
    setInlineStep("primaryRegion");
    setPrimaryRegion("");
    setSelectedIndustries([]);
    setCustomIndustry("");
    setSelectedCompanySizes([]);
    setSelectedBuyerRoles([]);
    setCustomBuyerRole("");
    setAccountsOnWatchlist("");
    setAccountsToAvoid("");
    setFitConfidence("");
    setAdditionalContext("");
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
        setInlineStep("accountsOnWatchlist");
      }
    } else if (e.key === "Escape") {
      handleCancelInline();
    }
  };

  const handleAccountsOnWatchlistKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setInlineStep("accountsToAvoid");
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

  const handleFitConfidenceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && fitConfidence) {
      e.preventDefault();
      setInlineStep("additionalContext");
    } else if (e.key === "Escape") {
      handleCancelInline();
    }
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
    setInlineStep("industry");
  };

  const handleSaveICP = async () => {
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
      industry: selectedIndustries,
      companySize: selectedCompanySizes,
      buyerRole: selectedBuyerRoles,
      accountsOnWatchlist: accountsOnWatchlist.trim() ? accountsOnWatchlist.split(",").map(a => a.trim()) : [],
      accountsToAvoid: accountsToAvoid.trim() ? accountsToAvoid.split(",").map(a => a.trim()) : [],
      fitConfidence: fitConfidence as FitConfidence,
      additionalContext: additionalContext.trim(),
      status: "saved",
      createdAt: new Date(),
    };

    let updatedICPs: ICP[];
    if (editingId) {
      updatedICPs = icps.map(icp => (icp.id === editingId ? newICP : icp));
      setIcps(updatedICPs);
      toast({
        title: "ICP updated",
        description: "Your ICP has been updated successfully.",
      });
    } else {
      updatedICPs = [...icps, newICP];
      setIcps(updatedICPs);
      toast({
        title: "ICP saved",
        description: "Your ICP hypothesis has been saved.",
      });
    }

    // Save to backend
    await saveCustomerProfileToBackend(updatedICPs);

    // Dispatch event to notify MissionControl that customer profile is saved
    window.dispatchEvent(new CustomEvent('customerProfileSaved'));

    resetInlineForm();
  };

  const handleEditICP = (icp: ICP) => {
    setEditingId(icp.id);
    setPrimaryRegion(icp.primaryRegion);
    setSelectedIndustries(icp.industry);
    setSelectedCompanySizes(icp.companySize);
    setSelectedBuyerRoles(icp.buyerRole);
    setAccountsOnWatchlist(icp.accountsOnWatchlist.join(", "));
    setAccountsToAvoid(icp.accountsToAvoid.join(", "));
    setFitConfidence(icp.fitConfidence);
    setAdditionalContext(icp.additionalContext);
    setInlineStep("additionalContext");
    setIsAddingInline(true);
  };

  const handleDeleteICP = async (id: string) => {
    const updatedICPs = icps.filter(icp => icp.id !== id);
    setIcps(updatedICPs);
    
    // Save to backend
    await saveCustomerProfileToBackend(updatedICPs);
    
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
    inlineStep === "additionalContext";

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
          </div>

          {/* Company Section */}
          {(["industry", "companySize", "buyerRole", "accountsOnWatchlist", "accountsToAvoid", "fitConfidence", "additionalContext"].includes(inlineStep) || editingId) && (
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
              {(["companySize", "buyerRole", "accountsOnWatchlist", "accountsToAvoid", "fitConfidence", "additionalContext"].includes(inlineStep) || editingId) && (
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
          {(["buyerRole", "accountsOnWatchlist", "accountsToAvoid", "fitConfidence", "additionalContext"].includes(inlineStep) || editingId) && (
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

              {/* Accounts on Watchlist */}
              {(["accountsOnWatchlist", "accountsToAvoid", "fitConfidence", "additionalContext"].includes(inlineStep) || editingId) && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Eye className="h-3 w-3" />
                    Accounts on Watchlist (Optional)
                  </label>
                  <Input
                    ref={accountsOnWatchlistRef}
                    placeholder="e.g., CompanyA, CompanyB"
                    value={accountsOnWatchlist}
                    onChange={(e) => setAccountsOnWatchlist(e.target.value)}
                    onKeyDown={handleAccountsOnWatchlistKeyDown}
                    className="h-9 text-sm"
                    disabled={inlineStep !== "accountsOnWatchlist" && !editingId}
                  />
                  <p className="text-xs text-muted-foreground/70">
                    Companies you want to closely monitor or track for opportunities.
                  </p>
                  {inlineStep === "accountsOnWatchlist" && (
                    <p className="text-xs text-muted-foreground">Press Enter to continue</p>
                  )}
                </div>
              )}

              {/* Accounts to Avoid */}
              {(["accountsToAvoid", "fitConfidence", "additionalContext"].includes(inlineStep) || editingId) && (
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
              {(["fitConfidence", "additionalContext"].includes(inlineStep) || editingId) && (
                <div className="space-y-1" onKeyDown={handleFitConfidenceKeyDown}>
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
                  {inlineStep === "fitConfidence" && fitConfidence && (
                    <p className="text-xs text-muted-foreground">Press Enter to continue</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Additional Context - Full Width */}
        {(inlineStep === "additionalContext" || editingId) && (
          <div className="space-y-2 pt-2 border-t">
            <label className="text-xs text-muted-foreground">Additional Context (Optional)</label>
            <Textarea
              ref={additionalContextRef}
              placeholder="Add any additional details that could help the system better understand this ICP (e.g. buying behavior, maturity level, internal assumptions, exclusions, nuances)."
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              className="min-h-[80px] text-sm resize-none"
              disabled={inlineStep !== "additionalContext" && !editingId}
            />
          </div>
        )}

        {/* Save Button */}
        {inlineStep === "additionalContext" && (
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
                    <span className="font-medium">{icp.primaryRegion}</span>
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
