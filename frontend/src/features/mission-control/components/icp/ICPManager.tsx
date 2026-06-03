import { Plus, Trash2, Edit, X, Check, Target, Eye, ChevronsUpDown } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type { UntypedProfilerIcpRecord } from "@/lib/types/escape-hatches";
import { cn } from "@/lib/utils";
import {
  extractIcpsDataFromFlexibleApiResponse,
  mergeProfilerAcceptedIcpDisplay,
  removeProfilerAcceptedIcpDisplayMeta,
} from "@/shared/profiler";
import {
  setUserLocalStorage,
  getUserLocalStorage,
  removeUserLocalStorage,
} from "@/utils/cacheUtils";

// Types
type FitConfidence = "high" | "medium" | "low";

interface ICP {
  id: string;
  primaryRegion: string;
  location: string[];
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

// Region options (single select)
const REGIONS_OPTIONS = [
  { value: "Europe", label: "Europe" },
  { value: "MEA", label: "MEA (Middle East & Africa)" },
  { value: "APAC", label: "APAC (Asia & Pacific)" },
  { value: "NA", label: "NA (North America)" },
  { value: "LATAM", label: "LATAM (Latin America)" },
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
  "Consulting",
];

const COMPANY_SIZE_OPTIONS = ["1–10", "11–50", "51–200", "201–500", "501–1000", "1000+"];

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
  const { currentUser, orgId } = useAuth();
  const location = useLocation();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility
  const [icps, setIcps] = useState<ICP[]>([]);
  const [_isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Inline editing state
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [_inlineStep, _setInlineStep] = useState<InlineStep>("primaryRegion");
  const [primaryRegion, setPrimaryRegion] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState("");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [industryInput, setIndustryInput] = useState("");
  const [isIndustryPopoverOpen, setIsIndustryPopoverOpen] = useState(false);
  const [selectedCompanySizes, setSelectedCompanySizes] = useState<string[]>([]);
  const [isCompanySizePopoverOpen, setIsCompanySizePopoverOpen] = useState(false);
  const [selectedBuyerRoles, setSelectedBuyerRoles] = useState<string[]>([]);
  const [buyerRoleInput, setBuyerRoleInput] = useState("");
  const [isBuyerRolePopoverOpen, setIsBuyerRolePopoverOpen] = useState(false);
  const [accountsOnWatchlist, setAccountsOnWatchlist] = useState<string[]>([]);
  const [watchlistInput, setWatchlistInput] = useState("");
  const [accountsToAvoid, setAccountsToAvoid] = useState<string[]>([]);
  const [avoidInput, setAvoidInput] = useState("");
  const [fitConfidence, setFitConfidence] = useState<FitConfidence | "">("");
  const [additionalContext, setAdditionalContext] = useState("");

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<{
    primaryRegion?: string;
    industry?: string;
    companySize?: string;
    buyerRole?: string;
    fitConfidence?: string;
  }>({});

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);

  const industryRef = useRef<HTMLInputElement>(null);
  const buyerRoleRef = useRef<HTMLInputElement>(null);

  // Save customer profile (ICPs) to backend with retry logic
  const saveCustomerProfileToBackend = async (icpsToSave: ICP[], retryCount = 0) => {
    if (!currentUser?.uid) {
      console.warn("Cannot save customer profile: User not authenticated");
      // Save to localStorage as fallback
      try {
        setUserLocalStorage("customerProfile", JSON.stringify(icpsToSave), currentUser?.uid);
      } catch (e) {
        console.error("Failed to save to localStorage:", e);
      }
      return;
    }

    setIsSaving(true);
    try {
      // Prepare payload with customer profile data
      const payload = {
        org_id: orgIdToUse,
        icps: icpsToSave.map((icp) => ({
          id: icp.id,
          primary_region: icp.primaryRegion,
          location: Array.isArray(icp.location) ? icp.location : [],
          industry: Array.isArray(icp.industry) ? icp.industry : [],
          company_size: Array.isArray(icp.companySize) ? icp.companySize : [],
          buyer_role: Array.isArray(icp.buyerRole) ? icp.buyerRole : [],
          accounts_on_watchlist: Array.isArray(icp.accountsOnWatchlist)
            ? icp.accountsOnWatchlist
            : [],
          accounts_to_avoid: Array.isArray(icp.accountsToAvoid) ? icp.accountsToAvoid : [],
          fit_confidence: icp.fitConfidence || "medium",
          additional_context: icp.additionalContext || "",
          status: icp.status || "saved",
          created_at: icp.createdAt instanceof Date ? icp.createdAt.toISOString() : icp.createdAt,
        })),
      };

      console.log("=== ICP MANAGER: Saving customer profile to backend ===");
      console.log("User ID:", currentUser.uid);
      console.log("ICPs to save:", icpsToSave);
      console.log("Payload:", JSON.stringify(payload, null, 2));
      // Debug: Check location field specifically
      payload.icps.forEach((icp, index) => {
        console.log(
          `ICP ${index} location field:`,
          icp.location,
          "Type:",
          typeof icp.location,
          "IsArray:",
          Array.isArray(icp.location),
        );
      });

      // Always save to localStorage first as backup
      try {
        setUserLocalStorage("customerProfile", JSON.stringify(icpsToSave), currentUser.uid);
        setUserLocalStorage("customerProfile_pending", JSON.stringify(payload), currentUser.uid);
      } catch (e) {
        console.warn("Failed to save to localStorage:", e);
      }

      const apiUrl = `/api/customer_profile?org_id=${orgIdToUse}`;
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
          await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
          return saveCustomerProfileToBackend(icpsToSave, retryCount + 1);
        }

        throw new Error(`Failed to save customer profile: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("✅ Customer profile saved successfully to backend");
      console.log("Response data:", JSON.stringify(data, null, 2));

      // Save to localStorage for offline access and refresh persistence
      try {
        setUserLocalStorage("customerProfile", JSON.stringify(icpsToSave), currentUser.uid);
        console.log("ICPManager: Saved customer profile to localStorage");
      } catch (e) {
        console.warn("Failed to save to localStorage:", e);
      }

      // Clear pending flag on success
      try {
        removeUserLocalStorage("customerProfile_pending", currentUser.uid);
      } catch (e) {
        console.warn("Failed to clear pending flag:", e);
      }
    } catch (error) {
      console.error("Error saving customer profile:", error);

      // Determine error message based on error type
      const isNetworkError = error instanceof TypeError && error.message.includes("fetch");
      const isServerError = error instanceof Error && error.message.includes("500");

      if (isServerError || isNetworkError) {
        toast({
          title: "Backend temporarily unavailable",
          description:
            "Your customer profile has been saved locally and will sync automatically when the backend is available.",
          variant: "default",
        });
      } else {
        toast({
          title: "Save warning",
          description:
            "Customer profile saved locally but failed to sync with backend. Please try again later.",
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
      console.warn("ICPManager: Cannot load customer profile - user not authenticated");
      window.dispatchEvent(new CustomEvent("icpManagerCustomerProfileLoadFinished"));
      return;
    }

    console.log("ICPManager: Starting to load customer profile from backend");
    console.log("User ID:", currentUser.uid);
    setIsLoading(true);
    try {
      // Backend embeds ICPs on GET /profile/company (org_id + user_id) per Swagger; /customer_profile may omit them.
      const companyUrl = `/api/profile/company?user_id=${encodeURIComponent(currentUser.uid)}&org_id=${encodeURIComponent(orgIdToUse)}`;
      const legacyUrl = `/api/customer_profile?org_id=${encodeURIComponent(orgIdToUse)}`;
      console.log("ICPManager: Fetching company profile (ICPs):", companyUrl);

      const companyRes = await fetch(companyUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      let legacyRes: Response | null = null;
      let responseData: Record<string, unknown> | null = null;
      if (companyRes.ok) {
        responseData = (await companyRes.json()) as Record<string, unknown>;
      }

      let icpsData = responseData ? extractIcpsDataFromFlexibleApiResponse(responseData) : [];

      if (icpsData.length === 0) {
        console.log(
          "ICPManager: No ICPs on company profile (or request failed); trying GET customer_profile:",
          legacyUrl,
        );
        legacyRes = await fetch(legacyUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        if (legacyRes.ok) {
          responseData = (await legacyRes.json()) as Record<string, unknown>;
          icpsData = extractIcpsDataFromFlexibleApiResponse(responseData);
        }
      }

      const anyOk = companyRes.ok || (legacyRes?.ok ?? false);
      console.log(
        "ICPManager: GET profile/company",
        companyRes.status,
        "GET customer_profile",
        legacyRes ? legacyRes.status : "skipped",
      );

      if (!anyOk) {
        console.log("No existing customer profile found in API, trying localStorage fallback");
        // Try loading from localStorage as fallback
        try {
          const localData = getUserLocalStorage("customerProfile", currentUser.uid);
          if (localData) {
            const localICPs = JSON.parse(localData);
            if (Array.isArray(localICPs) && localICPs.length > 0) {
              console.log("Loading customer profile from localStorage fallback");
              setIcps(localICPs);
              window.dispatchEvent(new CustomEvent("customerProfileSaved"));
            }
          }
        } catch (e) {
          console.error("Error loading from localStorage:", e);
        }
        return;
      }

      // Avoid replaying a stale full-list POST from customerProfile_pending (can resurrect deleted ICPs).
      try {
        removeUserLocalStorage("customerProfile_pending", currentUser.uid);
      } catch (e) {
        console.warn("Failed to clear customerProfile_pending:", e);
      }

      if (!responseData) {
        console.warn("ICPManager: No response body after successful GET");
        return;
      }

      console.log("ICPManager: Full API response:", JSON.stringify(responseData, null, 2));
      console.log("ICPManager: Response structure:", {
        hasSuccess: "success" in responseData,
        hasData: "data" in responseData,
        responseDataKeys: Object.keys(responseData || {}),
        dataKeys: responseData?.data ? Object.keys(responseData.data) : [],
        "data.icps": (responseData?.data as Record<string, unknown>)?.icps,
        "data.customer_profiles": (responseData?.data as Record<string, unknown>)
          ?.customer_profiles,
        "data.customer_profiles.icps": (
          responseData?.data as Record<string, Record<string, unknown>>
        )?.customer_profiles?.icps,
        directIcps: responseData?.icps,
      });

      const data =
        typeof responseData.data === "object" && responseData.data !== null
          ? (responseData.data as Record<string, unknown>)
          : responseData;

      // Verify user_id matches (multi-tenancy safety)
      const responseUserId = data.user_id ?? responseData.user_id;
      if (responseUserId && responseUserId !== currentUser.uid) {
        console.warn(
          "ICPManager: API returned customer profile for different user! Ignoring data.",
          {
            apiUserId: responseUserId,
            currentUserId: currentUser.uid,
          },
        );
        // Try loading from localStorage as fallback
        try {
          const localData = getUserLocalStorage("customerProfile", currentUser.uid);
          if (localData) {
            const localICPs = JSON.parse(localData);
            if (Array.isArray(localICPs) && localICPs.length > 0) {
              console.log("ICPManager: Loading from localStorage fallback (user mismatch)");
              setIcps(localICPs);
              window.dispatchEvent(new CustomEvent("customerProfileSaved"));
            }
          }
        } catch (e) {
          console.error("Error loading from localStorage:", e);
        }
        return;
      }

      console.log("ICPManager: Extracted icpsData:", {
        icpsData: icpsData,
        isArray: Array.isArray(icpsData),
        length: Array.isArray(icpsData) ? icpsData.length : 0,
        firstItem: Array.isArray(icpsData) && icpsData.length > 0 ? icpsData[0] : null,
        allItems: Array.isArray(icpsData)
          ? icpsData.map((icp: UntypedProfilerIcpRecord) => ({
              id: icp.id,
              primary_region: icp.primary_region || icp.primaryRegion,
              industry: icp.industry,
            }))
          : [],
      });

      if (Array.isArray(icpsData) && icpsData.length > 0) {
        const loadedICPs: ICP[] = icpsData.map((icp: UntypedProfilerIcpRecord) => {
          const merged = mergeProfilerAcceptedIcpDisplay(icp);
          return {
            id: String(merged.icp_id || merged.id || `icp-${Date.now()}-${Math.random()}`),
            primaryRegion: merged.primary_region || merged.primaryRegion || "",
            location: Array.isArray(merged.location) ? merged.location : [],
            industry: Array.isArray(merged.industry) ? merged.industry : [],
            companySize: Array.isArray(merged.company_size)
              ? merged.company_size
              : Array.isArray(merged.companySize)
                ? merged.companySize
                : [],
            buyerRole: Array.isArray(merged.buyer_role)
              ? merged.buyer_role
              : Array.isArray(merged.buyerRole)
                ? merged.buyerRole
                : [],
            accountsOnWatchlist: Array.isArray(merged.accounts_on_watchlist)
              ? merged.accounts_on_watchlist
              : Array.isArray(merged.accountsOnWatchlist)
                ? merged.accountsOnWatchlist
                : [],
            accountsToAvoid: Array.isArray(merged.accounts_to_avoid)
              ? merged.accounts_to_avoid
              : Array.isArray(merged.accountsToAvoid)
                ? merged.accountsToAvoid
                : [],
            fitConfidence: (merged.fit_confidence ||
              merged.fitConfidence ||
              "medium") as FitConfidence,
            additionalContext: merged.additional_context || merged.additionalContext || "",
            status: merged.status || "saved",
            createdAt: merged.created_at
              ? new Date(merged.created_at)
              : merged.createdAt
                ? new Date(merged.createdAt)
                : new Date(),
          };
        });

        const uniqueById = new Map<string, ICP>();
        for (const icp of loadedICPs) {
          if (!uniqueById.has(icp.id)) uniqueById.set(icp.id, icp);
        }
        const dedupedICPs = Array.from(uniqueById.values());
        if (dedupedICPs.length !== loadedICPs.length) {
          console.warn("ICPManager: Dropped duplicate ICP rows (same id) from API response.", {
            before: loadedICPs.length,
            after: dedupedICPs.length,
          });
        }

        setIcps(dedupedICPs);
        console.log("✅ Customer profile loaded from backend successfully");
        console.log("Loaded ICPs count:", dedupedICPs.length);
        console.log("Loaded ICPs data:", JSON.stringify(dedupedICPs, null, 2));

        // Save to localStorage for offline access
        try {
          setUserLocalStorage("customerProfile", JSON.stringify(dedupedICPs), currentUser.uid);
        } catch (e) {
          console.warn("Failed to save to localStorage:", e);
        }

        // Dispatch event to notify MissionControl that customer profile is loaded
        if (dedupedICPs.length > 0) {
          window.dispatchEvent(new CustomEvent("customerProfileSaved"));
        }
      } else {
        console.log("ICPManager: No icps found in API response, checking localStorage");
        // Try loading from localStorage as fallback
        try {
          const localData = getUserLocalStorage("customerProfile", currentUser.uid);
          if (localData) {
            const localICPs = JSON.parse(localData);
            // Verify localStorage data belongs to current user
            if (Array.isArray(localICPs) && localICPs.length > 0) {
              // Check if any ICP has a user_id that doesn't match
              const hasMismatch = localICPs.some(
                (icp: UntypedProfilerIcpRecord) => icp.user_id && icp.user_id !== currentUser.uid,
              );

              if (hasMismatch) {
                console.warn(
                  "⚠️ ICPManager: localStorage contains ICPs from different user! Clearing localStorage.",
                );
                // Clear localStorage for this user
                try {
                  const { removeUserLocalStorage } = await import("@/utils/cacheUtils");
                  removeUserLocalStorage("customerProfile", currentUser.uid);
                  console.log("✅ ICPManager: Cleared mismatched localStorage data");
                } catch (e) {
                  console.error("Error clearing localStorage:", e);
                }
                // Don't load mismatched data
                setIcps([]);
              } else {
                console.log("Loading customer profile from localStorage fallback");
                setIcps(localICPs);
                window.dispatchEvent(new CustomEvent("customerProfileSaved"));
              }
            }
          }
        } catch (e) {
          console.error("Error loading from localStorage:", e);
        }
      }
    } catch (error) {
      console.error("Error loading customer profile:", error);
      // Try loading from localStorage as fallback on error
      try {
        const localData = getUserLocalStorage("customerProfile", currentUser.uid);
        if (localData) {
          const localICPs = JSON.parse(localData);
          if (Array.isArray(localICPs) && localICPs.length > 0) {
            console.log("Loading customer profile from localStorage fallback (error case)");
            setIcps(localICPs);
            window.dispatchEvent(new CustomEvent("customerProfileSaved"));
          }
        }
      } catch (e) {
        console.error("Error loading from localStorage:", e);
      }
    } finally {
      setIsLoading(false);
      window.dispatchEvent(new CustomEvent("icpManagerCustomerProfileLoadFinished"));
    }
  };

  useEffect(() => {
    if (!currentUser?.uid) return;
    console.log("ICPManager: loading customer profile from backend for user:", currentUser.uid);
    void loadCustomerProfileFromBackend();
    // loadCustomerProfileFromBackend intentionally omitted: it is an inline
    // closure that re-creates every render, but the load is keyed on the
    // identity/org/path values listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, orgIdToUse, location.pathname]);

  // Focus management - combobox stays closed by default

  const resetInlineForm = () => {
    setIsAddingInline(false);
    setPrimaryRegion("");
    setLocations([]);
    setLocationInput("");
    setSelectedIndustries([]);
    setIndustryInput("");
    setIsIndustryPopoverOpen(false);
    setSelectedCompanySizes([]);
    setIsCompanySizePopoverOpen(false);
    setSelectedBuyerRoles([]);
    setBuyerRoleInput("");
    setIsBuyerRolePopoverOpen(false);
    setValidationErrors({});
    setAccountsOnWatchlist([]);
    setWatchlistInput("");
    setAccountsToAvoid([]);
    setAvoidInput("");
    setFitConfidence("");
    setAdditionalContext("");
    setEditingId(null);
  };

  const handleStartAdd = () => {
    resetInlineForm();
    setIsAddingInline(true);
  };

  const handleCancelInline = () => {
    resetInlineForm();
  };

  const handleFitConfidenceSelect = (value: FitConfidence) => {
    setFitConfidence(value);
    if (validationErrors.fitConfidence) {
      setValidationErrors((prev) => ({ ...prev, fitConfidence: undefined }));
    }
  };

  const handleIndustryToggle = (industry: string) => {
    if (!selectedIndustries.includes(industry)) {
      setSelectedIndustries((prev) => {
        const updated = [...prev, industry];
        if (validationErrors.industry && updated.length > 0) {
          setValidationErrors((prev) => ({ ...prev, industry: undefined }));
        }
        return updated;
      });
    }
    setIndustryInput("");
    setIsIndustryPopoverOpen(false);
  };

  const handleIndustryInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && industryInput.trim()) {
      e.preventDefault();
      const trimmedInput = industryInput.trim();
      if (!selectedIndustries.includes(trimmedInput)) {
        setSelectedIndustries((prev) => {
          const updated = [...prev, trimmedInput];
          if (validationErrors.industry && updated.length > 0) {
            setValidationErrors((prev) => ({ ...prev, industry: undefined }));
          }
          return updated;
        });
      }
      setIndustryInput("");
      setIsIndustryPopoverOpen(false);
    }
  };

  const handleCompanySizeToggle = (size: string) => {
    if (!selectedCompanySizes.includes(size)) {
      setSelectedCompanySizes((prev) => {
        const updated = [...prev, size];
        if (validationErrors.companySize && updated.length > 0) {
          setValidationErrors((prev) => ({ ...prev, companySize: undefined }));
        }
        return updated;
      });
    }
    setIsCompanySizePopoverOpen(false);
  };

  const handleBuyerRoleToggle = (role: string) => {
    if (!selectedBuyerRoles.includes(role)) {
      setSelectedBuyerRoles((prev) => {
        const updated = [...prev, role];
        if (validationErrors.buyerRole && updated.length > 0) {
          setValidationErrors((prev) => ({ ...prev, buyerRole: undefined }));
        }
        return updated;
      });
    }
    setBuyerRoleInput("");
    setIsBuyerRolePopoverOpen(false);
  };

  const handleBuyerRoleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && buyerRoleInput.trim()) {
      e.preventDefault();
      const trimmedInput = buyerRoleInput.trim();
      if (!selectedBuyerRoles.includes(trimmedInput)) {
        setSelectedBuyerRoles((prev) => {
          const updated = [...prev, trimmedInput];
          if (validationErrors.buyerRole && updated.length > 0) {
            setValidationErrors((prev) => ({ ...prev, buyerRole: undefined }));
          }
          return updated;
        });
      }
      setBuyerRoleInput("");
      setIsBuyerRolePopoverOpen(false);
    }
  };

  const handleAddLocation = () => {
    if (locationInput.trim()) {
      const trimmedLocation = locationInput.trim();
      if (!locations.includes(trimmedLocation)) {
        setLocations((prev) => [...prev, trimmedLocation]);
      }
      setLocationInput("");
    }
  };

  const handleLocationInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && locationInput.trim()) {
      e.preventDefault();
      handleAddLocation();
    }
  };

  const handleRemoveLocation = (locationToRemove: string) => {
    setLocations((prev) => prev.filter((loc) => loc !== locationToRemove));
  };

  const handleAddWatchlist = () => {
    if (watchlistInput.trim()) {
      const trimmedCompany = watchlistInput.trim();
      if (!accountsOnWatchlist.includes(trimmedCompany)) {
        setAccountsOnWatchlist((prev) => [...prev, trimmedCompany]);
      }
      setWatchlistInput("");
    }
  };

  const handleWatchlistInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && watchlistInput.trim()) {
      e.preventDefault();
      handleAddWatchlist();
    }
  };

  const handleRemoveWatchlist = (companyToRemove: string) => {
    setAccountsOnWatchlist((prev) => prev.filter((company) => company !== companyToRemove));
  };

  const handleAddAvoid = () => {
    if (avoidInput.trim()) {
      const trimmedCompany = avoidInput.trim();
      if (!accountsToAvoid.includes(trimmedCompany)) {
        setAccountsToAvoid((prev) => [...prev, trimmedCompany]);
      }
      setAvoidInput("");
    }
  };

  const handleAvoidInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && avoidInput.trim()) {
      e.preventDefault();
      handleAddAvoid();
    }
  };

  const handleRemoveAvoid = (companyToRemove: string) => {
    setAccountsToAvoid((prev) => prev.filter((company) => company !== companyToRemove));
  };

  const handleSaveICP = async () => {
    const errors: typeof validationErrors = {};
    let hasErrors = false;

    if (!primaryRegion.trim()) {
      errors.primaryRegion = "Please select a region";
      hasErrors = true;
    }

    if (selectedIndustries.length === 0) {
      errors.industry = "Please select at least one industry";
      hasErrors = true;
    }

    if (selectedCompanySizes.length === 0) {
      errors.companySize = "Please select at least one company size";
      hasErrors = true;
    }

    if (selectedBuyerRoles.length === 0) {
      errors.buyerRole = "Please select at least one job title";
      hasErrors = true;
    }

    if (!fitConfidence) {
      errors.fitConfidence = "Please select an ICP fit level";
      hasErrors = true;
    }

    if (hasErrors) {
      setValidationErrors(errors);
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Clear errors if validation passes
    setValidationErrors({});

    // Commit typed location that is not yet added as a tag (same as Enter / Add button)
    const pendingLocation = locationInput.trim();
    const locationCommitted = [...locations];
    if (pendingLocation && !locationCommitted.includes(pendingLocation)) {
      locationCommitted.push(pendingLocation);
    }

    const newICP: ICP = {
      id: editingId || `icp-${Date.now()}`,
      primaryRegion: primaryRegion.trim(),
      location: locationCommitted.filter((loc) => loc.trim() !== ""),
      industry: selectedIndustries,
      companySize: selectedCompanySizes,
      buyerRole: selectedBuyerRoles,
      accountsOnWatchlist: accountsOnWatchlist,
      accountsToAvoid: accountsToAvoid,
      fitConfidence: fitConfidence as FitConfidence,
      additionalContext: additionalContext.trim(),
      status: "saved",
      createdAt: new Date(),
    };

    let updatedICPs: ICP[];
    if (editingId) {
      updatedICPs = icps.map((icp) => (icp.id === editingId ? newICP : icp));
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
    window.dispatchEvent(new CustomEvent("customerProfileSaved"));

    resetInlineForm();
  };

  const handleEditICP = (icp: ICP) => {
    setEditingId(icp.id);
    setPrimaryRegion(icp.primaryRegion);
    setLocations(icp.location || []);
    setLocationInput("");
    setSelectedIndustries(icp.industry);
    setSelectedCompanySizes(icp.companySize);
    setSelectedBuyerRoles(icp.buyerRole);
    setBuyerRoleInput("");
    setAccountsOnWatchlist(icp.accountsOnWatchlist || []);
    setWatchlistInput("");
    setAccountsToAvoid(icp.accountsToAvoid || []);
    setAvoidInput("");
    setFitConfidence(icp.fitConfidence);
    setAdditionalContext(icp.additionalContext);
    setIsAddingInline(true);
  };

  const handleDeleteICP = async (id: string) => {
    console.log("[ICPManager] DELETE customer_profile/icp: request", {
      icp_id: id,
      org_id: orgIdToUse,
    });
    const updatedICPs = icps.filter((icp) => icp.id !== id);
    setIcps(updatedICPs);
    removeProfilerAcceptedIcpDisplayMeta(id);

    try {
      const deleteRes = await apiFetch(
        `customer_profile/icp/${encodeURIComponent(id)}?org_id=${encodeURIComponent(orgIdToUse)}`,
        { method: "DELETE" },
      );
      const deleteBody = await deleteRes.json();
      console.log("[ICPManager] DELETE customer_profile/icp: response body", deleteBody);
      if (deleteBody?.success && deleteBody?.data) {
        console.log(
          "[ICPManager] DELETE customer_profile/icp: deleted_icp_id=",
          deleteBody.data.deleted_icp_id,
          "remaining_count=",
          deleteBody.data.remaining_count,
        );
      }
    } catch (e) {
      console.warn(
        "[ICPManager] DELETE customer_profile/icp: failed (local state already updated)",
        e,
      );
    }

    await saveCustomerProfileToBackend(updatedICPs);

    window.dispatchEvent(new CustomEvent("customerProfileSaved"));

    toast({
      title: "ICP deleted",
      description: "The ICP has been removed.",
    });
  };

  const getFitConfidenceBadge = (confidence: FitConfidence) => {
    switch (confidence) {
      case "high":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
          >
            High
          </Badge>
        );
      case "medium":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800"
          >
            Medium
          </Badge>
        );
      case "low":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
          >
            Low
          </Badge>
        );
    }
  };

  // Render the inline editing row
  const renderInlineEditRow = () => {
    if (!isAddingInline) return null;

    return (
      <div className="bg-white border border-black rounded-lg p-4 mb-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-semibold text-foreground">
            {editingId ? "Edit ICP" : "Add New ICP"}
          </h4>
          <Button variant="ghost" size="sm" onClick={handleCancelInline}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Compact Form Layout - No Category Headers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Regions - Single Select Dropdown */}
          <div className="space-y-1.5">
            <Label>Regions</Label>
            <Select
              value={primaryRegion}
              onValueChange={(value) => {
                setPrimaryRegion(value);
                if (validationErrors.primaryRegion) {
                  setValidationErrors((prev) => ({ ...prev, primaryRegion: undefined }));
                }
              }}
            >
              <SelectTrigger
                className={cn(
                  "h-9 text-sm font-normal",
                  validationErrors.primaryRegion && "border-destructive",
                )}
              >
                <SelectValue placeholder="Select region..." />
              </SelectTrigger>
              <SelectContent>
                {REGIONS_OPTIONS.map((region) => (
                  <SelectItem key={region.value} value={region.value}>
                    {region.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {validationErrors.primaryRegion && (
              <p className="text-xs text-destructive">{validationErrors.primaryRegion}</p>
            )}
          </div>

          {/* Location - Input with Tags */}
          <div className="space-y-1.5">
            <Label>Location</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter location..."
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={handleLocationInputKeyDown}
                className="h-9 text-sm w-32"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddLocation}
                      disabled={!locationInput.trim()}
                      className="h-9 px-3"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Click to add location</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {locations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {locations.map((location) => (
                  <Badge
                    key={location}
                    variant="default"
                    className="text-xs cursor-pointer"
                    onClick={() => handleRemoveLocation(location)}
                  >
                    {location} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Popover
              open={isIndustryPopoverOpen}
              onOpenChange={setIsIndustryPopoverOpen}
              modal={false}
            >
              <div className="relative">
                <Input
                  ref={industryRef}
                  placeholder="Type or Select"
                  value={industryInput}
                  onChange={(e) => {
                    setIndustryInput(e.target.value);
                    setIsIndustryPopoverOpen(true);
                  }}
                  onClick={() => {
                    setIsIndustryPopoverOpen(true);
                  }}
                  onBlur={(_e) => {
                    // Delay to allow click events in popover
                    setTimeout(() => {
                      const activeElement = document.activeElement;
                      const popoverContent = document.querySelector('[role="dialog"]');
                      if (
                        !popoverContent?.contains(activeElement) &&
                        activeElement !== industryRef.current
                      ) {
                        setIsIndustryPopoverOpen(false);
                      }
                    }, 200);
                  }}
                  onKeyDown={handleIndustryInputKeyDown}
                  className={cn(
                    "h-9 text-sm pr-8",
                    validationErrors.industry && "border-destructive",
                  )}
                />
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="absolute inset-0 h-9 w-full opacity-0"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsIndustryPopoverOpen(true);
                      industryRef.current?.focus();
                    }}
                    type="button"
                    tabIndex={-1}
                  />
                </PopoverTrigger>
                <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 pointer-events-none z-10" />
              </div>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0 z-[100]"
                side="bottom"
                align="start"
                sideOffset={4}
                avoidCollisions={false}
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                  industryRef.current?.focus();
                }}
              >
                <Command shouldFilter={false}>
                  <CommandList>
                    <CommandEmpty>
                      {industryInput.trim() ? (
                        <div className="py-2 text-sm text-muted-foreground">
                          Press Enter to add "{industryInput.trim()}"
                        </div>
                      ) : (
                        "No industry found."
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {INDUSTRY_SUGGESTIONS.filter(
                        (industry) =>
                          !selectedIndustries.includes(industry) &&
                          industry.toLowerCase().includes(industryInput.toLowerCase()),
                      ).map((industry) => (
                        <CommandItem
                          key={industry}
                          value={industry}
                          onSelect={(currentValue) => {
                            handleIndustryToggle(currentValue);
                            setIsIndustryPopoverOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                          {industry}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedIndustries.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedIndustries.map((ind) => (
                  <Badge
                    key={ind}
                    variant="default"
                    className="text-xs cursor-pointer"
                    onClick={() => {
                      setSelectedIndustries((prev) => {
                        const updated = prev.filter((i) => i !== ind);
                        if (updated.length === 0 && !validationErrors.industry) {
                          setValidationErrors((prev) => ({
                            ...prev,
                            industry: "Please select at least one industry",
                          }));
                        }
                        return updated;
                      });
                    }}
                  >
                    {ind} ×
                  </Badge>
                ))}
              </div>
            )}
            {validationErrors.industry && (
              <p className="text-xs text-destructive">{validationErrors.industry}</p>
            )}
          </div>

          {/* Company Size - Multiselect Dropdown */}
          <div className="space-y-1.5">
            <Label>Company Size</Label>
            <Popover open={isCompanySizePopoverOpen} onOpenChange={setIsCompanySizePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between h-9 text-sm font-normal",
                    validationErrors.companySize && "border-destructive",
                  )}
                  onClick={() => setIsCompanySizePopoverOpen(!isCompanySizePopoverOpen)}
                >
                  {selectedCompanySizes.length > 0
                    ? `${selectedCompanySizes.length} selected`
                    : "Select company size..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0 z-[100]"
                side="bottom"
                align="start"
                sideOffset={4}
              >
                <Command>
                  <CommandList>
                    <CommandEmpty>No company size found.</CommandEmpty>
                    <CommandGroup>
                      {COMPANY_SIZE_OPTIONS.filter(
                        (size) => !selectedCompanySizes.includes(size),
                      ).map((size) => (
                        <CommandItem
                          key={size}
                          value={size}
                          onSelect={() => {
                            handleCompanySizeToggle(size);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                          {size}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedCompanySizes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedCompanySizes.map((size) => (
                  <Badge
                    key={size}
                    variant="default"
                    className="text-xs cursor-pointer"
                    onClick={() => {
                      setSelectedCompanySizes((prev) => {
                        const updated = prev.filter((s) => s !== size);
                        if (updated.length === 0 && !validationErrors.companySize) {
                          setValidationErrors((prev) => ({
                            ...prev,
                            companySize: "Please select at least one company size",
                          }));
                        }
                        return updated;
                      });
                    }}
                  >
                    {size} ×
                  </Badge>
                ))}
              </div>
            )}
            {validationErrors.companySize && (
              <p className="text-xs text-destructive">{validationErrors.companySize}</p>
            )}
          </div>

          {/* Job Title - Input with Tags */}
          <div className="space-y-1.5">
            <Label>Job Title</Label>
            <Popover
              open={isBuyerRolePopoverOpen}
              onOpenChange={setIsBuyerRolePopoverOpen}
              modal={false}
            >
              <div className="relative">
                <Input
                  ref={buyerRoleRef}
                  placeholder="Type or Select"
                  value={buyerRoleInput}
                  onChange={(e) => {
                    setBuyerRoleInput(e.target.value);
                    setIsBuyerRolePopoverOpen(true);
                  }}
                  onClick={() => {
                    setIsBuyerRolePopoverOpen(true);
                  }}
                  onBlur={(_e) => {
                    // Delay to allow click events in popover
                    setTimeout(() => {
                      const activeElement = document.activeElement;
                      const popoverContent = document.querySelector('[role="dialog"]');
                      if (
                        !popoverContent?.contains(activeElement) &&
                        activeElement !== buyerRoleRef.current
                      ) {
                        setIsBuyerRolePopoverOpen(false);
                      }
                    }, 200);
                  }}
                  onKeyDown={handleBuyerRoleInputKeyDown}
                  className={cn(
                    "h-9 text-sm pr-8",
                    validationErrors.buyerRole && "border-destructive",
                  )}
                />
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="absolute inset-0 h-9 w-full opacity-0"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsBuyerRolePopoverOpen(true);
                      buyerRoleRef.current?.focus();
                    }}
                    type="button"
                    tabIndex={-1}
                  />
                </PopoverTrigger>
                <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 pointer-events-none z-10" />
              </div>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0 z-[100]"
                side="bottom"
                align="start"
                sideOffset={4}
                avoidCollisions={false}
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                  buyerRoleRef.current?.focus();
                }}
              >
                <Command shouldFilter={false}>
                  <CommandList>
                    <CommandEmpty>
                      {buyerRoleInput.trim() ? (
                        <div className="py-2 text-sm text-muted-foreground">
                          Press Enter to add "{buyerRoleInput.trim()}"
                        </div>
                      ) : (
                        "No job title found."
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {BUYER_ROLE_SUGGESTIONS.filter(
                        (role) =>
                          !selectedBuyerRoles.includes(role) &&
                          role.toLowerCase().includes(buyerRoleInput.toLowerCase()),
                      ).map((role) => (
                        <CommandItem
                          key={role}
                          value={role}
                          onSelect={(currentValue) => {
                            handleBuyerRoleToggle(currentValue);
                            setIsBuyerRolePopoverOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                          {role}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedBuyerRoles.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedBuyerRoles.map((role) => (
                  <Badge
                    key={role}
                    variant="default"
                    className="text-xs cursor-pointer"
                    onClick={() => {
                      setSelectedBuyerRoles((prev) => {
                        const updated = prev.filter((r) => r !== role);
                        if (updated.length === 0 && !validationErrors.buyerRole) {
                          setValidationErrors((prev) => ({
                            ...prev,
                            buyerRole: "Please select at least one job title",
                          }));
                        }
                        return updated;
                      });
                    }}
                  >
                    {role} ×
                  </Badge>
                ))}
              </div>
            )}
            {validationErrors.buyerRole && (
              <p className="text-xs text-destructive">{validationErrors.buyerRole}</p>
            )}
          </div>

          {/* ICP Fit - Simple Dropdown */}
          <div className="space-y-1.5">
            <Label>ICP Fit</Label>
            <Select
              value={fitConfidence}
              onValueChange={(value) => handleFitConfidenceSelect(value as FitConfidence)}
            >
              <SelectTrigger
                className={cn(
                  "h-9 text-sm font-normal",
                  validationErrors.fitConfidence && "border-destructive",
                )}
              >
                <SelectValue placeholder="Select ICP fit..." />
              </SelectTrigger>
              <SelectContent>
                {FIT_CONFIDENCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {validationErrors.fitConfidence && (
              <p className="text-xs text-destructive">{validationErrors.fitConfidence}</p>
            )}
          </div>
        </div>

        {/* Companies on Watchlist and Companies to Exclude - Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Eye className="h-3 w-3" />
              Companies on Watchlist (Optional)
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter company name..."
                value={watchlistInput}
                onChange={(e) => setWatchlistInput(e.target.value)}
                onKeyDown={handleWatchlistInputKeyDown}
                className="h-9 text-sm flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddWatchlist}
                disabled={!watchlistInput.trim()}
                className="h-9 px-3"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {accountsOnWatchlist.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {accountsOnWatchlist.map((company) => (
                  <Badge
                    key={company}
                    variant="default"
                    className="text-xs cursor-pointer"
                    onClick={() => handleRemoveWatchlist(company)}
                  >
                    {company} ×
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground/70">
              Companies you want to closely monitor or track for opportunities.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Companies to Exclude (Optional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter company name..."
                value={avoidInput}
                onChange={(e) => setAvoidInput(e.target.value)}
                onKeyDown={handleAvoidInputKeyDown}
                className="h-9 text-sm flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddAvoid}
                disabled={!avoidInput.trim()}
                className="h-9 px-3"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {accountsToAvoid.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {accountsToAvoid.map((company) => (
                  <Badge
                    key={company}
                    variant="default"
                    className="text-xs cursor-pointer"
                    onClick={() => handleRemoveAvoid(company)}
                  >
                    {company} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Additional Criteria - Full Width */}
        <div className="space-y-2 pt-2 border-t">
          <Label className="font-semibold">Additional Criteria</Label>
          <Input
            placeholder="Any additional criteria or specific requirements for your ICP..."
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={handleCancelInline}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSaveICP} className="gap-1">
            <Check className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex gap-2">
            <div
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "0ms", animationDuration: "1.4s" }}
            ></div>
            <div
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "200ms", animationDuration: "1.4s" }}
            ></div>
            <div
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "400ms", animationDuration: "1.4s" }}
            ></div>
          </div>
        </div>
      )}

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
                <TableHead className="font-semibold">Location</TableHead>
                <TableHead className="font-semibold">Industry</TableHead>
                <TableHead className="font-semibold">Company Size</TableHead>
                <TableHead className="font-semibold">Job Title</TableHead>
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
                    {icp.location && icp.location.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {icp.location.map((loc, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {loc}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {icp.industry.slice(0, 2).map((ind) => (
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
                      {icp.companySize.map((size) => (
                        <Badge key={size} variant="secondary" className="text-xs">
                          {size}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {icp.buyerRole.slice(0, 2).map((role) => (
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
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800"
                    >
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
    </div>
  );
};

export default ICPManager;
