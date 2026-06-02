import {
  Shield,
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  Check,
  Save,
  X,
  Clock,
  Target,
  Building,
  Share,
} from "lucide-react";
import React, { useState, useEffect } from "react";

import { ComplianceVisualCard } from "./ComplianceVisualCard";
import { ExecutiveSummarySection } from "./ExecutiveSummarySection";
import { RegulatoryHeader } from "./RegulatoryHeader";
import { deriveKeyDataPoints } from "./regulatoryHelpers";
import type { RegulatoryComplianceSectionProps } from "./types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiFetchJson } from "@/lib/api";
import { executeWithRateLimit } from "@/lib/rateLimitManager";
import type {
  UntypedBackendApiResponse,
  UntypedRegulatoryUpdate,
  UntypedVisualDataCard,
  UntypedRegionData,
} from "@/lib/types/escape-hatches";
import { useAuth } from "@/shared/auth";
import { getUserLocalStorage, setUserLocalStorage } from "@/utils/cacheUtils";


const RegulatoryComplianceSection: React.FC<RegulatoryComplianceSectionProps> = ({
  isEditing,
  isSplitView,
  isExpanded,
  hasEdits,
  deletedSections,
  editHistory: _editHistory,
  executiveSummary,
  euAiActDeadline,
  gdprCompliance,
  potentialFines,
  dataLocalization,
  onToggleEdit,
  onScoutIconClick,
  onEditHistoryOpen,
  onDeleteSection,
  onSaveChanges,
  onCancelEdit,
  onExpandToggle,
  onExecutiveSummaryChange,
  onEuAiActDeadlineChange,
  onGdprComplianceChange,
  onPotentialFinesChange,
  onDataLocalizationChange,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink,
  isRefreshing = false,
  companyProfile,
  regulatoryData: propRegulatoryData,
}) => {
  const { currentUser, orgId } = useAuth();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility
  const { toast } = useToast();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  // Use centralized data from parent instead of local state
  const regulatoryData = propRegulatoryData;
  const [_isLoading, setIsLoading] = useState(false);
  const [_error, setError] = useState<string | null>(null);

  // Normalize deletedSections to ensure it's always a Set
  const normalizedDeletedSections = React.useMemo(() => {
    if (!deletedSections) {
      return new Set<string>();
    }
    if (deletedSections instanceof Set) {
      return deletedSections;
    }
    // If it's an array, convert to Set
    if (Array.isArray(deletedSections)) {
      return new Set<string>(deletedSections);
    }
    // If it's an object, convert keys to Set
    if (typeof deletedSections === "object") {
      return new Set(Object.keys(deletedSections));
    }
    // Fallback to empty Set
    return new Set<string>();
  }, [deletedSections]);

  // Local state for editing - prioritize API data over localStorage for fresh updates (user-specific)
  const [localExecutiveSummary, setLocalExecutiveSummary] = useState(() => {
    return (
      regulatoryData?.executiveSummary ||
      executiveSummary ||
      getUserLocalStorage("regulatory_executiveSummary", currentUser?.uid) ||
      ""
    );
  });
  const [localEuAiActDeadline, setLocalEuAiActDeadline] = useState(() => {
    return (
      regulatoryData?.euAiActDeadline ||
      euAiActDeadline ||
      getUserLocalStorage("regulatory_euAiActDeadline", currentUser?.uid) ||
      ""
    );
  });
  const [localGdprCompliance, setLocalGdprCompliance] = useState(() => {
    return (
      regulatoryData?.gdprCompliance ||
      gdprCompliance ||
      getUserLocalStorage("regulatory_gdprCompliance", currentUser?.uid) ||
      ""
    );
  });
  const [localPotentialFines, setLocalPotentialFines] = useState(() => {
    return (
      regulatoryData?.potentialFines ||
      potentialFines ||
      getUserLocalStorage("regulatory_potentialFines", currentUser?.uid) ||
      ""
    );
  });
  const [localDataLocalization, setLocalDataLocalization] = useState(() => {
    return (
      regulatoryData?.dataLocalization ||
      dataLocalization ||
      getUserLocalStorage("regulatory_dataLocalization", currentUser?.uid) ||
      ""
    );
  });

  // Update local state when regulatoryData prop changes (for API data updates)
  useEffect(() => {
    if (regulatoryData && !isEditing) {
      // Update local state with new API data
      if (regulatoryData.executiveSummary) {
        setLocalExecutiveSummary(regulatoryData.executiveSummary);
      }
      if (regulatoryData.euAiActDeadline) {
        setLocalEuAiActDeadline(regulatoryData.euAiActDeadline);
      }
      if (regulatoryData.gdprCompliance) {
        setLocalGdprCompliance(regulatoryData.gdprCompliance);
      }
      if (regulatoryData.potentialFines) {
        setLocalPotentialFines(regulatoryData.potentialFines);
      }
      if (regulatoryData.dataLocalization) {
        setLocalDataLocalization(regulatoryData.dataLocalization);
      }
    }
  }, [regulatoryData, isEditing]);

  // Dynamic local state for all key data points
  const [localKeyDataValues, setLocalKeyDataValues] = useState<Record<string, string>>({});

  // Local state for regional data (table)
  const [localRegionalData, setLocalRegionalData] = useState<UntypedRegionData[]>([]);

  // Local state for visual data cards
  const [localVisualDataCards, setLocalVisualDataCards] = useState<UntypedVisualDataCard[]>([]);

  // Local state for strategic recommendations
  const [localStrategicRecommendations, setLocalStrategicRecommendations] =
    useState<UntypedBackendApiResponse>({
      mitigateRegulatoryRisks: [],
      competitivePositioning: [],
      goToMarketStrategy: [],
    });

  // Save local state to localStorage whenever it changes
  useEffect(() => {
    if (localExecutiveSummary) {
      localStorage.setItem("regulatory_executiveSummary", localExecutiveSummary);
    }
  }, [localExecutiveSummary]);

  useEffect(() => {
    if (localEuAiActDeadline) {
      localStorage.setItem("regulatory_euAiActDeadline", localEuAiActDeadline);
    }
  }, [localEuAiActDeadline]);

  useEffect(() => {
    if (localGdprCompliance) {
      localStorage.setItem("regulatory_gdprCompliance", localGdprCompliance);
    }
  }, [localGdprCompliance]);

  useEffect(() => {
    if (localPotentialFines) {
      localStorage.setItem("regulatory_potentialFines", localPotentialFines);
    }
  }, [localPotentialFines]);

  useEffect(() => {
    if (localDataLocalization) {
      localStorage.setItem("regulatory_dataLocalization", localDataLocalization);
    }
  }, [localDataLocalization]);

  // Sync local state with centralized regulatoryData and props (only on initial load)
  useEffect(() => {
    if (!isEditing) {
      // Only update if we have new data and current local state is empty (initial load only)
      if (executiveSummary && !localExecutiveSummary) {
        setLocalExecutiveSummary(executiveSummary);
      }
      if (regulatoryData?.executiveSummary && !localExecutiveSummary) {
        setLocalExecutiveSummary(regulatoryData.executiveSummary);
      }

      if (euAiActDeadline && !localEuAiActDeadline) {
        setLocalEuAiActDeadline(euAiActDeadline);
      }
      if (regulatoryData?.euAiActDeadline && !localEuAiActDeadline) {
        setLocalEuAiActDeadline(regulatoryData.euAiActDeadline);
      }

      if (gdprCompliance && !localGdprCompliance) {
        setLocalGdprCompliance(gdprCompliance);
      }
      if (regulatoryData?.gdprCompliance && !localGdprCompliance) {
        setLocalGdprCompliance(regulatoryData.gdprCompliance);
      }

      if (potentialFines && !localPotentialFines) {
        setLocalPotentialFines(potentialFines);
      }
      if (regulatoryData?.potentialFines && !localPotentialFines) {
        setLocalPotentialFines(regulatoryData.potentialFines);
      }

      if (dataLocalization && !localDataLocalization) {
        setLocalDataLocalization(dataLocalization);
      }
      if (regulatoryData?.dataLocalization && !localDataLocalization) {
        setLocalDataLocalization(regulatoryData.dataLocalization);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot effect: reads props/locals as one-shot initializer when entering edit mode; adding all deps would cause constant re-syncing
  }, [isEditing]); // Removed dependencies that cause constant re-syncing

  // Disabled: Also sync when regulatoryData changes (causes local state to be overwritten)
  // useEffect(() => {
  //   if (!isEditing && regulatoryData) {
  //     console.log('🔄 Regulatory Compliance - regulatoryData updated:', regulatoryData);
  //     // This useEffect was causing local state to be overwritten with original values
  //     // Disabled to preserve user edits
  //   }
  // }, [regulatoryData, isEditing, localExecutiveSummary, localEuAiActDeadline, localGdprCompliance, localPotentialFines, localDataLocalization]);

  // Initialize dynamic key data values after keyDataPoints is available
  useEffect(() => {
    if (!isEditing && regulatoryData?.keyUpdates && Array.isArray(regulatoryData.keyUpdates)) {
      const initialValues: Record<string, string> = {};
      regulatoryData.keyUpdates.forEach((update: UntypedRegulatoryUpdate, index: number) => {
        if (update) {
          // Parse if update is a JSON string
          let parsedUpdate = update;
          if (typeof update === "string") {
            try {
              parsedUpdate = JSON.parse(update);
            } catch (_e) {
              parsedUpdate = update;
            }
          }

          // Try multiple possible field names for title and value/description
          const title =
            parsedUpdate.title ||
            parsedUpdate.name ||
            parsedUpdate.label ||
            parsedUpdate.heading ||
            `Update ${index + 1}`;
          const value =
            parsedUpdate.description ||
            parsedUpdate.value ||
            parsedUpdate.content ||
            parsedUpdate.text ||
            parsedUpdate.details ||
            "";

          if (title && title !== `Update ${index + 1}`) {
            const id = title.toLowerCase().replace(/\s+/g, "-");
            initialValues[id] = value;
          }
        }
      });
      setLocalKeyDataValues(initialValues);
    }
  }, [regulatoryData?.keyUpdates, isEditing]);

  // Handle modify button click - initialize edit fields with current data
  const handleModify = () => {
    // Initialize all edit fields with current data
    setLocalExecutiveSummary(regulatoryData?.executiveSummary || executiveSummary || "");
    setLocalEuAiActDeadline(regulatoryData?.euAiActDeadline || euAiActDeadline || "");
    setLocalGdprCompliance(regulatoryData?.gdprCompliance || gdprCompliance || "");
    setLocalPotentialFines(regulatoryData?.potentialFines || potentialFines || "");
    setLocalDataLocalization(regulatoryData?.dataLocalization || dataLocalization || "");

    // Initialize dynamic key data values
    if (regulatoryData?.keyUpdates && Array.isArray(regulatoryData.keyUpdates)) {
      const initialValues: Record<string, string> = {};
      regulatoryData.keyUpdates.forEach((update: UntypedRegulatoryUpdate, index: number) => {
        if (update) {
          // Parse if update is a JSON string
          let parsedUpdate = update;
          if (typeof update === "string") {
            try {
              parsedUpdate = JSON.parse(update);
            } catch (_e) {
              parsedUpdate = update;
            }
          }

          // Try multiple possible field names for title and value/description
          const title =
            parsedUpdate.title ||
            parsedUpdate.name ||
            parsedUpdate.label ||
            parsedUpdate.heading ||
            `Update ${index + 1}`;
          const value =
            parsedUpdate.description ||
            parsedUpdate.value ||
            parsedUpdate.content ||
            parsedUpdate.text ||
            parsedUpdate.details ||
            "";

          if (title && title !== `Update ${index + 1}`) {
            const id = title.toLowerCase().replace(/\s+/g, "-");
            initialValues[id] = value;
          }
        }
      });
      setLocalKeyDataValues(initialValues);
    }

    // Initialize regional data
    const defaultRegionalData = [
      {
        region: "European Union",
        framework: "GDPR + AI Act",
        deadline: "Q1 2026",
        impact: "High",
        status: "Active",
        requirements: "Data protection, AI governance",
      },
      {
        region: "United States",
        framework: "CCPA + State Laws",
        deadline: "Ongoing",
        impact: "Medium",
        status: "Evolving",
        requirements: "Privacy rights, data handling",
      },
      {
        region: "China",
        framework: "PIPL + Cybersecurity Law",
        deadline: "Active",
        impact: "High",
        status: "Mandatory",
        requirements: "Data localization, security",
      },
      {
        region: "United Kingdom",
        framework: "UK GDPR + DPA",
        deadline: "Active",
        impact: "Medium",
        status: "Active",
        requirements: "Data protection, transfers",
      },
    ];
    const regionalDataToUse = regulatoryData?.regionalData || defaultRegionalData;
    setLocalRegionalData(
      regionalDataToUse && regionalDataToUse.length > 0
        ? [...regionalDataToUse]
        : [...defaultRegionalData],
    );

    // Initialize visual data cards
    const defaultVisualDataCards = [
      {
        title: "Compliance Adoption Rates",
        type: "bar-chart",
        data: [
          { name: "GDPR", value: 68, color: "#10b981" },
          { name: "CCPA", value: 45, color: "#3b82f6" },
          { name: "SOC 2", value: 72, color: "#8b5cf6" },
          { name: "ISO 27001", value: 38, color: "#f59e0b" },
        ],
      },
      {
        title: "Regulatory Timeline",
        type: "timeline",
        data: [
          { date: "Q1 2025", event: "EU AI Act Phase 1", status: "upcoming" },
          { date: "Q3 2025", event: "GDPR Updates", status: "upcoming" },
          { date: "Q1 2026", event: "EU AI Act Full Enforcement", status: "critical" },
        ],
      },
      {
        title: "Risk Indicators",
        type: "percentage",
        data: [
          { metric: "Data Breach Risk", value: 23, trend: "down" },
          { metric: "Non-compliance Penalties", value: 15, trend: "up" },
          { metric: "Audit Readiness", value: 67, trend: "up" },
        ],
      },
    ];
    const visualDataCardsToUse = regulatoryData?.visualDataCards || defaultVisualDataCards;
    setLocalVisualDataCards(
      visualDataCardsToUse && visualDataCardsToUse.length > 0
        ? [...visualDataCardsToUse]
        : [...defaultVisualDataCards],
    );

    // Initialize strategic recommendations
    if (regulatoryData?.strategicRecommendations) {
      setLocalStrategicRecommendations({
        mitigateRegulatoryRisks:
          regulatoryData.strategicRecommendations.mitigateRegulatoryRisks || [],
        competitivePositioning:
          regulatoryData.strategicRecommendations.competitivePositioning || [],
        goToMarketStrategy: regulatoryData.strategicRecommendations.goToMarketStrategy || [],
      });
    } else {
      setLocalStrategicRecommendations({
        mitigateRegulatoryRisks: [
          "Implement privacy by design principles",
          "Establish automated compliance monitoring",
          "Regular risk assessments and audits",
          "Cross-functional compliance team",
        ],
        competitivePositioning: [
          "Market compliance as differentiator",
          "Showcase security certifications",
          "Transparent data handling practices",
          "Industry-leading privacy standards",
        ],
        goToMarketStrategy: [
          "Regional deployment capabilities",
          "Compliance-ready product offerings",
          "Legal-friendly contract templates",
          "Enterprise-grade data residency",
        ],
      });
    }

    onToggleEdit();
  };

  // Disabled: Update local state when regulatoryData prop changes (causes local state to be overwritten)
  // useEffect(() => {
  //   if (regulatoryData && !isEditing) {
  //     console.log('🔄 RegulatoryComplianceSection: regulatoryData prop changed, updating local state:', regulatoryData);
  //     // This useEffect was causing local state to be overwritten with original values
  //     // Disabled to preserve user edits
  //   }
  // }, [regulatoryData, isEditing, localExecutiveSummary, localEuAiActDeadline, localGdprCompliance, localPotentialFines, localDataLocalization]);

  // Handle save changes
  const handleRegulatoryComplianceSaveChanges = async () => {
    try {
      // Apply local edits to props
      onExecutiveSummaryChange(localExecutiveSummary);
      onEuAiActDeadlineChange(localEuAiActDeadline);
      onGdprComplianceChange(localGdprCompliance);
      onPotentialFinesChange(localPotentialFines);
      onDataLocalizationChange(localDataLocalization);

      // Prepare original data
      const originalData = {
        section: "regulatory-compliance",
        executiveSummary: executiveSummary,
        euAiActDeadline: euAiActDeadline,
        gdprCompliance: gdprCompliance,
        potentialFines: potentialFines,
        dataLocalization: dataLocalization,
      };

      // Prepare modified data
      const modifiedData = {
        section: "regulatory-compliance",
        executiveSummary: localExecutiveSummary,
        euAiActDeadline: localEuAiActDeadline,
        gdprCompliance: localGdprCompliance,
        potentialFines: localPotentialFines,
        dataLocalization: localDataLocalization,
      };

      // Prepare data for API according to schema

      // Store data for /ask API
      localStorage.setItem("regulatory-compliance_original_json", JSON.stringify(originalData));
      localStorage.setItem("regulatory-compliance_modified_json", JSON.stringify(modifiedData));

      // Skip the /ask endpoint for now and focus on updating the UI
      // The local state variables are already updated with the edited values
      // Call the original save function to trigger chat panel
      onSaveChanges();
    } catch (error) {
      console.error("❌ Regulatory Compliance - Error saving changes:", error);
      // Still call the original save function even if API fails
      onSaveChanges();
    }
  };

  // Fetch Regulatory Compliance data from API (like working components do)
  const fetchRegulatoryComplianceData = async (refresh = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const currentTime = Date.now();
      const randomId = Math.random().toString(36).substring(7);

      if (!currentUser?.uid) {
        console.error("User not authenticated");
        setError("User not authenticated");
        setIsLoading(false);
        return;
      }

      const payload = {
        org_id: orgIdToUse,
        user_id: currentUser.uid,
        component_name: "regulatory & compliance highlights", // Exact match for regulatory compliance
        refresh: refresh,
        force_refresh: refresh,
        cache_bypass: refresh,
        bypass_all_cache: refresh,
        request_timestamp: currentTime,
        request_id: randomId,
        data: {},
      };

      const result = await executeWithRateLimit(
        () =>
          apiFetchJson("market-research", {
            method: "POST",
            body: payload,
          }),
        "Regulatory Compliance",
      );

      if (result.status === "success" && result.data) {
        const apiData = result.data;

        // Extract data from API response like working components do
        const executiveSummary = apiData.executiveSummary || "";
        const euAiActDeadline = apiData.euAiActDeadline || "";
        const gdprCompliance = apiData.gdprCompliance || "";
        const potentialFines = apiData.potentialFines || "";
        const dataLocalization = apiData.dataLocalization || "";

        // Update local state with API data
        setLocalExecutiveSummary(executiveSummary);
        setLocalEuAiActDeadline(euAiActDeadline);
        setLocalGdprCompliance(gdprCompliance);
        setLocalPotentialFines(potentialFines);
        setLocalDataLocalization(dataLocalization);

        // Update parent state with API data
        onExecutiveSummaryChange(executiveSummary);
        onEuAiActDeadlineChange(euAiActDeadline);
        onGdprComplianceChange(gdprCompliance);
        onPotentialFinesChange(potentialFines);
        onDataLocalizationChange(dataLocalization);

        // Update dynamic key data values if available
        if (apiData.keyUpdates) {
          const initialValues: Record<string, string> = {};
          apiData.keyUpdates.forEach((update: UntypedRegulatoryUpdate) => {
            if (!update || !update.title) return;
            const id = update.title.toLowerCase().replace(/\s+/g, "-");
            initialValues[id] = update.description || "";
          });
          setLocalKeyDataValues(initialValues);
        }
      } else {
        // intentional: no payload to seed initial values from
      }
    } catch (error) {
      console.error("❌ RegulatoryComplianceSection: Error fetching data:", error);

      // Handle errors with fallback logic
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load regulatory data";
      const isTimeout = errorMessage.includes("timeout");
      const isApiError = errorMessage.includes("API error");

      if (isTimeout || isApiError) {
        // Set fallback data to prevent empty state
        const fallbackData = {
          executiveSummary:
            "Regulatory compliance analysis is being prepared. Please try refreshing in a few moments.",
          euAiActDeadline: "Loading...",
          gdprCompliance: "Loading...",
          potentialFines: "Loading...",
          dataLocalization: "Loading...",
        };

        setLocalExecutiveSummary(fallbackData.executiveSummary);
        setLocalEuAiActDeadline(fallbackData.euAiActDeadline);
        setLocalGdprCompliance(fallbackData.gdprCompliance);
        setLocalPotentialFines(fallbackData.potentialFines);
        setLocalDataLocalization(fallbackData.dataLocalization);

        onExecutiveSummaryChange(fallbackData.executiveSummary);
        onEuAiActDeadlineChange(fallbackData.euAiActDeadline);
        onGdprComplianceChange(fallbackData.gdprCompliance);
        onPotentialFinesChange(fallbackData.potentialFines);
        onDataLocalizationChange(fallbackData.dataLocalization);

        setError("Data is being prepared. Please refresh in a few moments.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Clear previous data and fetch fresh data on component mount (only when parent is not doing a cascade refresh)
  useEffect(() => {
    if (isRefreshing) return; // Parent is fetching; don't duplicate
    setIsLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      if (!isRefreshing) void fetchRegulatoryComplianceData(false);
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only initial fetch; intentionally empty deps to prevent re-fetch loops (cascade refresh handled by separate effect)
  }, []);

  // When parent runs cascade refresh, only show loading; parent will pass data via props (do NOT fetch here – avoids duplicate requests and multiple responses)
  useEffect(() => {
    if (isRefreshing) {
      setError(null);
      setIsLoading(true);
      // Do not call fetchRegulatoryComplianceData – parent MarketResearch cascade already calls the API for this component
    }
  }, [isRefreshing]);

  // Listen for company profile updates from settings
  useEffect(() => {
    const handleCompanyProfileUpdate = () => {
      void (async () => {
        setError(null);
        setIsLoading(true);

        // Wait a bit for the backend to process the profile update
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Fetch the latest company profile from backend (with org_id)
        try {
          const profileUrl = `https://backend-11kr.onrender.com/profile/company?org_id=${orgIdToUse}`;
          const profileResponse = await fetch(profileUrl, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });
          if (profileResponse.ok) {
            const latestProfile = await profileResponse.json();
            // Verify profile belongs to current user before storing
            if (latestProfile.user_id === currentUser?.uid || !latestProfile.user_id) {
              // Store in user-specific localStorage so the API call can use it
              setUserLocalStorage(
                "companyProfile",
                JSON.stringify(latestProfile),
                currentUser?.uid,
              );
              setUserLocalStorage(
                "companyProfileForRefresh",
                JSON.stringify(latestProfile),
                currentUser?.uid,
              );
            } else {
              // intentional: skip refresh-cache write when latestProfile is missing
            }
          }
        } catch (_error) {
          // intentional: ignore cache-write failures and proceed to refetch
        }

        await fetchRegulatoryComplianceData(true); // refresh = true for company profile changes
      })();
    };

    window.addEventListener("companyProfileUpdated", handleCompanyProfileUpdate);

    return () => {
      window.removeEventListener("companyProfileUpdated", handleCompanyProfileUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only listener subscription; handler reads currentUser?.uid + orgIdToUse at fire time intentionally
  }, []);

  // Also listen for companyProfile prop changes (skip if parent is refreshing – parent cascade will provide data).
  // Only depend on companyProfile so we don't refetch when isRefreshing flips to false (cascade just finished), which would overwrite fresh data and cause flicker.
  useEffect(() => {
    if (isRefreshing || !companyProfile) return;
    setError(null);
    setIsLoading(true);
    void fetchRegulatoryComplianceData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally watches only companyProfile to avoid overwriting fresh cascade data when isRefreshing flips to false
  }, [companyProfile]);

  // Initialize local state for regional data and visual data cards when not editing
  // Moved above the early return below to satisfy rules-of-hooks (must run unconditionally)
  useEffect(() => {
    if (!isEditing) {
      const defaultRegionalData = [
        {
          region: "European Union",
          framework: "GDPR + AI Act",
          deadline: "Q1 2026",
          impact: "High",
          status: "Active",
          requirements: "Data protection, AI governance",
        },
        {
          region: "United States",
          framework: "CCPA + State Laws",
          deadline: "Ongoing",
          impact: "Medium",
          status: "Evolving",
          requirements: "Privacy rights, data handling",
        },
        {
          region: "China",
          framework: "PIPL + Cybersecurity Law",
          deadline: "Active",
          impact: "High",
          status: "Mandatory",
          requirements: "Data localization, security",
        },
        {
          region: "United Kingdom",
          framework: "UK GDPR + DPA",
          deadline: "Active",
          impact: "Medium",
          status: "Active",
          requirements: "Data protection, transfers",
        },
      ];

      const defaultVisualDataCards = [
        {
          title: "Compliance Adoption Rates",
          type: "bar-chart",
          data: [
            { name: "GDPR", value: 68, color: "#10b981" },
            { name: "CCPA", value: 45, color: "#3b82f6" },
            { name: "SOC 2", value: 72, color: "#8b5cf6" },
            { name: "ISO 27001", value: 38, color: "#f59e0b" },
          ],
        },
        {
          title: "Regulatory Timeline",
          type: "timeline",
          data: [
            { date: "Q1 2025", event: "EU AI Act Phase 1", status: "upcoming" },
            { date: "Q3 2025", event: "GDPR Updates", status: "upcoming" },
            { date: "Q1 2026", event: "EU AI Act Full Enforcement", status: "critical" },
          ],
        },
        {
          title: "Risk Indicators",
          type: "percentage",
          data: [
            { metric: "Data Breach Risk", value: 23, trend: "down" },
            { metric: "Non-compliance Penalties", value: 15, trend: "up" },
            { metric: "Audit Readiness", value: 67, trend: "up" },
          ],
        },
      ];

      const regionalDataToUse = regulatoryData?.regionalData || defaultRegionalData;
      if (regionalDataToUse && regionalDataToUse.length > 0) {
        setLocalRegionalData([...regionalDataToUse]);
      }

      const visualDataCardsToUse = regulatoryData?.visualDataCards || defaultVisualDataCards;
      if (visualDataCardsToUse && visualDataCardsToUse.length > 0) {
        setLocalVisualDataCards([...visualDataCardsToUse]);
      }
    }
  }, [regulatoryData, isEditing]);

  if (normalizedDeletedSections.has("regulatory-compliance")) {
    return null;
  }

  // Always use regulatoryData when available

  // Create fallback key data points using local state values first, then regulatoryData properties
  const keyDataPoints = deriveKeyDataPoints(regulatoryData?.keyUpdates, {
    euAiActDeadline,
    gdprCompliance,
    potentialFines,
    dataLocalization,
  });

  const visualDataCards = regulatoryData?.visualDataCards || [
    {
      title: "Compliance Adoption Rates",
      type: "bar-chart",
      data: [
        { name: "GDPR", value: 68, color: "#10b981" },
        { name: "CCPA", value: 45, color: "#3b82f6" },
        { name: "SOC 2", value: 72, color: "#8b5cf6" },
        { name: "ISO 27001", value: 38, color: "#f59e0b" },
      ],
    },
    {
      title: "Regulatory Timeline",
      type: "timeline",
      data: [
        { date: "Q1 2025", event: "EU AI Act Phase 1", status: "upcoming" },
        { date: "Q3 2025", event: "GDPR Updates", status: "upcoming" },
        { date: "Q1 2026", event: "EU AI Act Full Enforcement", status: "critical" },
      ],
    },
    {
      title: "Risk Indicators",
      type: "percentage",
      data: [
        { metric: "Data Breach Risk", value: 23, trend: "down" },
        { metric: "Non-compliance Penalties", value: 15, trend: "up" },
        { metric: "Audit Readiness", value: 67, trend: "up" },
      ],
    },
  ];

  const regionalData = regulatoryData?.regionalData || [
    {
      region: "European Union",
      framework: "GDPR + AI Act",
      deadline: "Q1 2026",
      impact: "High",
      status: "Active",
      requirements: "Data protection, AI governance",
    },
    {
      region: "United States",
      framework: "CCPA + State Laws",
      deadline: "Ongoing",
      impact: "Medium",
      status: "Evolving",
      requirements: "Privacy rights, data handling",
    },
    {
      region: "China",
      framework: "PIPL + Cybersecurity Law",
      deadline: "Active",
      impact: "High",
      status: "Mandatory",
      requirements: "Data localization, security",
    },
    {
      region: "United Kingdom",
      framework: "UK GDPR + DPA",
      deadline: "Active",
      impact: "Medium",
      status: "Active",
      requirements: "Data protection, transfers",
    },
  ];

  const currentExecutiveSummary =
    localExecutiveSummary || regulatoryData?.executiveSummary || executiveSummary;

  return (
    <Card className="border border-gray-200 shadow-sm">
      <RegulatoryHeader
        hasEdits={hasEdits}
        onToggleEdit={handleModify}
        onScoutIconClick={onScoutIconClick}
      />

      <CardContent className="space-y-6">
        {isEditing ? (
          /* Full Editable Report Mode */
          <div className="space-y-8">
            <ExecutiveSummarySection
              isEditing={true}
              normalizedDeletedSections={normalizedDeletedSections}
              localExecutiveSummary={localExecutiveSummary}
              setLocalExecutiveSummary={setLocalExecutiveSummary}
              onExecutiveSummaryChange={onExecutiveSummaryChange}
              onDeleteSection={onDeleteSection}
              onScoutIconClick={onScoutIconClick}
              currentExecutiveSummary={currentExecutiveSummary}
            />

            {/* Key Regulatory Updates */}
            {!normalizedDeletedSections.has("key-updates") && (
              <div className="relative group border border-gray-200 rounded-lg p-4">
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  <button
                    onClick={() => {
                      toast({
                        title: "Saved",
                        description: "Key Regulatory Updates changes committed.",
                      });
                    }}
                    className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                    title="Commit changes"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      onDeleteSection("key-updates");
                      onScoutIconClick(
                        "regulatory-compliance",
                        true,
                        "I noticed you removed the Key Regulatory Updates. Want me to help refine or replace it?",
                      );
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </button>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Regulatory Updates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {keyDataPoints.map((point: UntypedRegulatoryUpdate) => {
                    const IconComponent = point.icon;
                    return (
                      <div key={point.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <IconComponent className="h-4 w-4 text-gray-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <h5 className="text-sm font-medium text-gray-900 leading-tight">
                                {point.title}
                              </h5>
                              <Badge className={`${point.badgeColor} text-xs`}>{point.badge}</Badge>
                            </div>
                            <input
                              type="text"
                              value={
                                point.id === "eu-ai-act"
                                  ? localEuAiActDeadline
                                  : point.id === "gdpr-compliance"
                                    ? localGdprCompliance
                                    : point.id === "potential-fines"
                                      ? localPotentialFines
                                      : point.id === "data-localization"
                                        ? localDataLocalization
                                        : localKeyDataValues[point.id] || point.value
                              }
                              onKeyDown={(_e) => {}}
                              onInput={(_e) => {}}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                if (point.id === "eu-ai-act") {
                                  setLocalEuAiActDeadline(newValue);
                                  onEuAiActDeadlineChange(newValue);
                                } else if (point.id === "gdpr-compliance") {
                                  setLocalGdprCompliance(newValue);
                                  onGdprComplianceChange(newValue);
                                } else if (point.id === "potential-fines") {
                                  setLocalPotentialFines(newValue);
                                  onPotentialFinesChange(newValue);
                                } else if (point.id === "data-localization") {
                                  setLocalDataLocalization(newValue);
                                  onDataLocalizationChange(newValue);
                                } else {
                                  // Handle dynamic fields
                                  setLocalKeyDataValues((prev) => ({
                                    ...prev,
                                    [point.id]: newValue,
                                  }));
                                }
                              }}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Compliance Analytics */}
            {!normalizedDeletedSections.has("compliance-analytics") && (
              <div className="relative group border border-gray-200 rounded-lg p-4">
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  <button
                    onClick={() => {
                      toast({
                        title: "Saved",
                        description: "Compliance Analytics changes committed.",
                      });
                    }}
                    className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                    title="Commit changes"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      onDeleteSection("compliance-analytics");
                      onScoutIconClick(
                        "regulatory-compliance",
                        true,
                        "I noticed you removed the Compliance Analytics. Want me to help refine or replace it?",
                      );
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </button>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Analytics</h3>
                {(isEditing ? localVisualDataCards : visualDataCards) &&
                (isEditing ? localVisualDataCards : visualDataCards).length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {(isEditing ? localVisualDataCards : visualDataCards).map(
                      (card: UntypedVisualDataCard, cardIndex: number) => (
                        <ComplianceVisualCard
                          key={cardIndex}
                          card={card}
                          cardIndex={cardIndex}
                          isEditing={isEditing}
                          isExpanded={false}
                          localVisualDataCards={localVisualDataCards}
                          onVisualDataCardsChange={setLocalVisualDataCards}
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No compliance analytics data available</p>
                )}
              </div>
            )}

            {/* Regional Breakdown */}
            {!normalizedDeletedSections.has("regional-breakdown") && (
              <div className="relative group border border-gray-200 rounded-lg p-4">
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  <button
                    onClick={() => {
                      toast({
                        title: "Saved",
                        description: "Regional Breakdown changes committed.",
                      });
                    }}
                    className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                    title="Commit changes"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      onDeleteSection("regional-breakdown");
                      onScoutIconClick(
                        "regulatory-compliance",
                        true,
                        "I noticed you removed the Regional Compliance Overview. Want me to help refine or replace it?",
                      );
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </button>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Regional Compliance Overview
                </h3>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-medium">Region</TableHead>
                        <TableHead className="font-medium">Framework</TableHead>
                        <TableHead className="font-medium">Deadline</TableHead>
                        <TableHead className="font-medium">Impact</TableHead>
                        <TableHead className="font-medium">Status</TableHead>
                        <TableHead className="font-medium">Key Requirements</TableHead>
                        {isEditing && <TableHead className="font-medium">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(isEditing ? localRegionalData : regionalData).map(
                        (region: UntypedRegionData, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {isEditing ? (
                                <Input
                                  value={region.region || ""}
                                  onChange={(e) => {
                                    const updated = [...localRegionalData];
                                    updated[index] = { ...updated[index], region: e.target.value };
                                    setLocalRegionalData(updated);
                                  }}
                                  className="w-full text-sm"
                                />
                              ) : (
                                region.region
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  value={region.framework || ""}
                                  onChange={(e) => {
                                    const updated = [...localRegionalData];
                                    updated[index] = {
                                      ...updated[index],
                                      framework: e.target.value,
                                    };
                                    setLocalRegionalData(updated);
                                  }}
                                  className="w-full text-sm"
                                />
                              ) : (
                                region.framework
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  value={region.deadline || ""}
                                  onChange={(e) => {
                                    const updated = [...localRegionalData];
                                    updated[index] = {
                                      ...updated[index],
                                      deadline: e.target.value,
                                    };
                                    setLocalRegionalData(updated);
                                  }}
                                  className="w-full text-sm"
                                />
                              ) : (
                                region.deadline
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  value={region.impact || ""}
                                  onChange={(e) => {
                                    const updated = [...localRegionalData];
                                    updated[index] = { ...updated[index], impact: e.target.value };
                                    setLocalRegionalData(updated);
                                  }}
                                  className="w-full text-sm"
                                />
                              ) : (
                                <Badge
                                  className={`${
                                    region.impact === "High"
                                      ? "bg-red-100 text-red-800"
                                      : region.impact === "Medium"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-green-100 text-green-800"
                                  }`}
                                >
                                  {region.impact}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  value={region.status || ""}
                                  onChange={(e) => {
                                    const updated = [...localRegionalData];
                                    updated[index] = { ...updated[index], status: e.target.value };
                                    setLocalRegionalData(updated);
                                  }}
                                  className="w-full text-sm"
                                />
                              ) : (
                                <Badge
                                  className={`${
                                    region.status === "Active" || region.status === "Mandatory"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {region.status}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {isEditing ? (
                                <Input
                                  value={region.requirements || ""}
                                  onChange={(e) => {
                                    const updated = [...localRegionalData];
                                    updated[index] = {
                                      ...updated[index],
                                      requirements: e.target.value,
                                    };
                                    setLocalRegionalData(updated);
                                  }}
                                  className="w-full text-sm"
                                />
                              ) : (
                                region.requirements
                              )}
                            </TableCell>
                            {isEditing && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setLocalRegionalData(
                                      localRegionalData.filter((_, i) => i !== index),
                                    );
                                  }}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                  {isEditing && (
                    <div className="p-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setLocalRegionalData([
                            ...localRegionalData,
                            {
                              region: "",
                              framework: "",
                              deadline: "",
                              impact: "Medium",
                              status: "Active",
                              requirements: "",
                            },
                          ]);
                        }}
                      >
                        Add Region
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Strategic Recommendations */}
            {!normalizedDeletedSections.has("strategic-recommendations") && (
              <div className="relative group border border-gray-200 rounded-lg p-4">
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  <button
                    onClick={() => {
                      toast({
                        title: "Saved",
                        description: "Strategic Recommendations changes committed.",
                      });
                    }}
                    className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                    title="Commit changes"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      onDeleteSection("strategic-recommendations");
                      onScoutIconClick(
                        "regulatory-compliance",
                        true,
                        "I noticed you removed the Strategic Recommendations. Want me to help refine or replace it?",
                      );
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </button>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Strategic Recommendations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        {isEditing ? (
                          <Input
                            value="Mitigate Regulatory Risks"
                            className="font-medium text-blue-900 mb-2"
                            readOnly
                          />
                        ) : (
                          <h5 className="text-sm font-medium text-blue-900 mb-2">
                            Mitigate Regulatory Risks
                          </h5>
                        )}
                        <div className="space-y-2">
                          {(isEditing
                            ? localStrategicRecommendations.mitigateRegulatoryRisks
                            : [
                                "Implement privacy by design principles",
                                "Establish automated compliance monitoring",
                                "Regular risk assessments and audits",
                                "Cross-functional compliance team",
                              ]
                          ).map((item: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              {isEditing ? (
                                <>
                                  <Input
                                    value={item}
                                    onChange={(e) => {
                                      const updated = [
                                        ...localStrategicRecommendations.mitigateRegulatoryRisks,
                                      ];
                                      updated[idx] = e.target.value;
                                      setLocalStrategicRecommendations({
                                        ...localStrategicRecommendations,
                                        mitigateRegulatoryRisks: updated,
                                      });
                                    }}
                                    className="flex-1 text-sm text-blue-700"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updated =
                                        localStrategicRecommendations.mitigateRegulatoryRisks.filter(
                                          (_: string, i: number) => i !== idx,
                                        );
                                      setLocalStrategicRecommendations({
                                        ...localStrategicRecommendations,
                                        mitigateRegulatoryRisks: updated,
                                      });
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <li className="text-sm text-blue-700">• {item}</li>
                              )}
                            </div>
                          ))}
                          {isEditing && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLocalStrategicRecommendations({
                                  ...localStrategicRecommendations,
                                  mitigateRegulatoryRisks: [
                                    ...localStrategicRecommendations.mitigateRegulatoryRisks,
                                    "",
                                  ],
                                });
                              }}
                            >
                              Add Item
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Target className="h-5 w-5 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        {isEditing ? (
                          <Input
                            value="Competitive Positioning"
                            className="font-medium text-green-900 mb-2"
                            readOnly
                          />
                        ) : (
                          <h5 className="text-sm font-medium text-green-900 mb-2">
                            Competitive Positioning
                          </h5>
                        )}
                        <div className="space-y-2">
                          {(isEditing
                            ? localStrategicRecommendations.competitivePositioning
                            : [
                                "Market compliance as differentiator",
                                "Showcase security certifications",
                                "Transparent data handling practices",
                                "Industry-leading privacy standards",
                              ]
                          ).map((item: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              {isEditing ? (
                                <>
                                  <Input
                                    value={item}
                                    onChange={(e) => {
                                      const updated = [
                                        ...localStrategicRecommendations.competitivePositioning,
                                      ];
                                      updated[idx] = e.target.value;
                                      setLocalStrategicRecommendations({
                                        ...localStrategicRecommendations,
                                        competitivePositioning: updated,
                                      });
                                    }}
                                    className="flex-1 text-sm text-green-700"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updated =
                                        localStrategicRecommendations.competitivePositioning.filter(
                                          (_: string, i: number) => i !== idx,
                                        );
                                      setLocalStrategicRecommendations({
                                        ...localStrategicRecommendations,
                                        competitivePositioning: updated,
                                      });
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <li className="text-sm text-green-700">• {item}</li>
                              )}
                            </div>
                          ))}
                          {isEditing && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLocalStrategicRecommendations({
                                  ...localStrategicRecommendations,
                                  competitivePositioning: [
                                    ...localStrategicRecommendations.competitivePositioning,
                                    "",
                                  ],
                                });
                              }}
                            >
                              Add Item
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Building className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div className="flex-1">
                        {isEditing ? (
                          <Input
                            value="Go-to-Market Strategy"
                            className="font-medium text-purple-900 mb-2"
                            readOnly
                          />
                        ) : (
                          <h5 className="text-sm font-medium text-purple-900 mb-2">
                            Go-to-Market Strategy
                          </h5>
                        )}
                        <div className="space-y-2">
                          {(isEditing
                            ? localStrategicRecommendations.goToMarketStrategy
                            : [
                                "Regional deployment capabilities",
                                "Compliance-ready product offerings",
                                "Legal-friendly contract templates",
                                "Enterprise-grade data residency",
                              ]
                          ).map((item: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              {isEditing ? (
                                <>
                                  <Input
                                    value={item}
                                    onChange={(e) => {
                                      const updated = [
                                        ...localStrategicRecommendations.goToMarketStrategy,
                                      ];
                                      updated[idx] = e.target.value;
                                      setLocalStrategicRecommendations({
                                        ...localStrategicRecommendations,
                                        goToMarketStrategy: updated,
                                      });
                                    }}
                                    className="flex-1 text-sm text-purple-700"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updated =
                                        localStrategicRecommendations.goToMarketStrategy.filter(
                                          (_: string, i: number) => i !== idx,
                                        );
                                      setLocalStrategicRecommendations({
                                        ...localStrategicRecommendations,
                                        goToMarketStrategy: updated,
                                      });
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <li className="text-sm text-purple-700">• {item}</li>
                              )}
                            </div>
                          ))}
                          {isEditing && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLocalStrategicRecommendations({
                                  ...localStrategicRecommendations,
                                  goToMarketStrategy: [
                                    ...localStrategicRecommendations.goToMarketStrategy,
                                    "",
                                  ],
                                });
                              }}
                            >
                              Add Item
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save/Cancel buttons and Edit History - positioned at bottom */}
            <div className="flex justify-between items-center pt-6 border-t border-gray-200">
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    // Log original and modified JSON for debugging
                    const originalJson = {
                      executiveSummary: executiveSummary || "",
                      euAiActDeadline: euAiActDeadline || "",
                      gdprCompliance: gdprCompliance || "",
                      potentialFines: potentialFines || "",
                      dataLocalization: dataLocalization || "",
                      keyUpdates: regulatoryData?.keyUpdates || [],
                    };

                    const modifiedJson = {
                      executiveSummary: localExecutiveSummary,
                      euAiActDeadline: localEuAiActDeadline,
                      gdprCompliance: localGdprCompliance,
                      potentialFines: localPotentialFines,
                      dataLocalization: localDataLocalization,
                      keyUpdates:
                        (regulatoryData?.keyUpdates || [])
                          .filter(
                            (update: UntypedRegulatoryUpdate) =>
                              update && update?.title && typeof update.title === "string",
                          )
                          .map((update: UntypedRegulatoryUpdate) => {
                            const id = update.title.toLowerCase().replace(/\s+/g, "-");
                            let localValue = localKeyDataValues[id];

                            // Check for specific fixed fields that have their own local state
                            if (id === "eu-ai-act-deadline" || id === "eu-ai-act") {
                              localValue = localEuAiActDeadline;
                            } else if (id === "gdpr-compliance") {
                              localValue = localGdprCompliance;
                            } else if (id === "potential-fines") {
                              localValue = localPotentialFines;
                            } else if (id === "data-localization") {
                              localValue = localDataLocalization;
                            }

                            if (localValue !== undefined) {
                              return { ...update, description: localValue };
                            }
                            return update;
                          }) || [],
                    };

                    // Store JSON data in localStorage for Scout API (user-specific)
                    setUserLocalStorage(
                      "regulatory-compliance_original_json",
                      JSON.stringify(originalJson),
                      currentUser?.uid,
                    );
                    setUserLocalStorage(
                      "regulatory-compliance_modified_json",
                      JSON.stringify(modifiedJson),
                      currentUser?.uid,
                    );

                    // First, call all the change handlers to update parent state with local values
                    onExecutiveSummaryChange(localExecutiveSummary);
                    onEuAiActDeadlineChange(localEuAiActDeadline);
                    onGdprComplianceChange(localGdprCompliance);
                    onPotentialFinesChange(localPotentialFines);
                    onDataLocalizationChange(localDataLocalization);

                    // Update key data points if regulatoryData exists
                    if (regulatoryData?.keyUpdates && Array.isArray(regulatoryData.keyUpdates)) {
                      // Update the regulatory data with new key updates
                      // Update regulatory data would be handled by parent component
                    }

                    // Then call the API save function
                    void handleRegulatoryComplianceSaveChanges();
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
                <Button variant="outline" onClick={onCancelEdit}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>

              {/* Edit History Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={onEditHistoryOpen}
                className="flex items-center gap-2 hover:bg-gray-50"
                title="View changes made to this report"
              >
                <Clock className="h-4 w-4" />
                Edit History
              </Button>
            </div>
          </div>
        ) : (
          /* Normal View Mode */
          <>
            <ExecutiveSummarySection
              isEditing={false}
              normalizedDeletedSections={normalizedDeletedSections}
              localExecutiveSummary={localExecutiveSummary}
              setLocalExecutiveSummary={setLocalExecutiveSummary}
              onExecutiveSummaryChange={onExecutiveSummaryChange}
              onDeleteSection={onDeleteSection}
              onScoutIconClick={onScoutIconClick}
              currentExecutiveSummary={currentExecutiveSummary}
            />

            {/* Key Data Points */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Regulatory Updates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {keyDataPoints.map((point: UntypedRegulatoryUpdate) => {
                  const IconComponent = point.icon;
                  return (
                    <div
                      key={point.id}
                      className="relative p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-pointer"
                      onMouseEnter={() => setHoveredCard(point.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <IconComponent className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="text-sm font-medium text-gray-900 leading-tight">
                              {point.title}
                            </h5>
                            <Badge className={`${point.badgeColor} text-xs`}>{point.badge}</Badge>
                          </div>
                          <p className="text-sm text-gray-600">{point.value}</p>
                        </div>
                      </div>

                      {/* Tooltip */}
                      {hoveredCard === point.id && (
                        <div className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg max-w-xs">
                          <p>{point.tooltip}</p>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Read More Button - Only when not expanded */}
            {!isExpanded && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => onExpandToggle(true)}
                  variant="outline"
                  className="flex items-center space-x-2 text-sm hover:bg-gray-50"
                >
                  <span>Read More</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Enhanced Expanded Content */}
            {isExpanded && (
              <div className="space-y-8 pt-6 border-t border-gray-200">
                {/* Visual Data Cards */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Analytics</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {visualDataCards.map((card: UntypedVisualDataCard, cardIndex: number) => (
                      <ComplianceVisualCard
                        key={cardIndex}
                        card={card}
                        cardIndex={cardIndex}
                        isEditing={false}
                        isExpanded={true}
                        localVisualDataCards={localVisualDataCards}
                        onVisualDataCardsChange={setLocalVisualDataCards}
                      />
                    ))}
                  </div>
                </div>

                {/* Regional Breakdown */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Regional Compliance Overview
                  </h3>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-medium">Region</TableHead>
                          <TableHead className="font-medium">Framework</TableHead>
                          <TableHead className="font-medium">Deadline</TableHead>
                          <TableHead className="font-medium">Impact</TableHead>
                          <TableHead className="font-medium">Status</TableHead>
                          <TableHead className="font-medium">Key Requirements</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {regionalData.map((region: UntypedRegionData, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{region.region}</TableCell>
                            <TableCell>{region.framework}</TableCell>
                            <TableCell>{region.deadline}</TableCell>
                            <TableCell>
                              <Badge
                                className={`${
                                  region.impact === "High"
                                    ? "bg-red-100 text-red-800"
                                    : region.impact === "Medium"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-green-100 text-green-800"
                                }`}
                              >
                                {region.impact}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`${
                                  region.status === "Active" || region.status === "Mandatory"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {region.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {region.requirements}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Strategic Recommendations */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Strategic Recommendations
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <h5 className="text-sm font-medium text-blue-900 mb-2">
                            {regulatoryData?.strategicRecommendations
                              ? "Mitigate Regulatory Risks"
                              : "Mitigate Regulatory Risks"}
                          </h5>
                          <ul className="text-sm text-blue-700 space-y-1">
                            {regulatoryData?.strategicRecommendations?.mitigateRegulatoryRisks ? (
                              regulatoryData.strategicRecommendations.mitigateRegulatoryRisks.map(
                                (item: string, index: number) => <li key={index}>• {item}</li>,
                              )
                            ) : (
                              <>
                                <li>• Implement privacy by design principles</li>
                                <li>• Establish automated compliance monitoring</li>
                                <li>• Regular risk assessments and audits</li>
                                <li>• Cross-functional compliance team</li>
                              </>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Target className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <h5 className="text-sm font-medium text-green-900 mb-2">
                            {regulatoryData?.strategicRecommendations
                              ? "Competitive Positioning"
                              : "Competitive Positioning"}
                          </h5>
                          <ul className="text-sm text-green-700 space-y-1">
                            {regulatoryData?.strategicRecommendations?.competitivePositioning ? (
                              regulatoryData.strategicRecommendations.competitivePositioning.map(
                                (item: string, index: number) => <li key={index}>• {item}</li>,
                              )
                            ) : (
                              <>
                                <li>• Market compliance as differentiator</li>
                                <li>• Showcase security certifications</li>
                                <li>• Transparent data handling practices</li>
                                <li>• Industry-leading privacy standards</li>
                              </>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Building className="h-5 w-5 text-purple-600 mt-0.5" />
                        <div>
                          <h5 className="text-sm font-medium text-purple-900 mb-2">
                            {regulatoryData?.strategicRecommendations
                              ? "Go-to-Market Strategy"
                              : "Go-to-Market Strategy"}
                          </h5>
                          <ul className="text-sm text-purple-700 space-y-1">
                            {regulatoryData?.strategicRecommendations?.goToMarketStrategy ? (
                              regulatoryData.strategicRecommendations.goToMarketStrategy.map(
                                (item: string, index: number) => <li key={index}>• {item}</li>,
                              )
                            ) : (
                              <>
                                <li>• Regional deployment capabilities</li>
                                <li>• Compliance-ready product offerings</li>
                                <li>• Legal-friendly contract templates</li>
                                <li>• Enterprise-grade data residency</li>
                              </>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Export Options */}
                <div className="border-t pt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Export Options</h4>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onExportPDF}
                      className="flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Save PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onSaveToWorkspace}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Save to Workspace
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onGenerateShareableLink}
                      className="flex items-center gap-2"
                    >
                      <Share className="h-4 w-4" />
                      Shareable Link
                    </Button>
                  </div>
                </div>

                {/* Show Less Button - Only when not in split view */}
                {!isSplitView && (
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={() => onExpandToggle(false)}
                      variant="outline"
                      className="flex items-center space-x-2 text-sm"
                    >
                      <span>Show Less</span>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RegulatoryComplianceSection;
