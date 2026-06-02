import {
  FileText,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Clock,
  Share,
} from "lucide-react";
import React, { useState, useEffect } from "react";

import { ComplianceAnalyticsSection } from "./ComplianceAnalyticsSection";
import { ExecutiveSummarySection } from "./ExecutiveSummarySection";
import { KeyRegulatoryUpdatesSection } from "./KeyRegulatoryUpdatesSection";
import { RegionalComplianceSection } from "./RegionalComplianceSection";
import { RegulatoryHeader } from "./RegulatoryHeader";
import { deriveKeyDataPoints } from "./regulatoryHelpers";
import { StrategicRecommendationsSection } from "./StrategicRecommendationsSection";
import type { RegulatoryComplianceSectionProps } from "./types";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
            <KeyRegulatoryUpdatesSection
              isEditing={true}
              normalizedDeletedSections={normalizedDeletedSections}
              keyDataPoints={keyDataPoints}
              onDeleteSection={onDeleteSection}
              onScoutIconClick={onScoutIconClick}
              localEuAiActDeadline={localEuAiActDeadline}
              setLocalEuAiActDeadline={setLocalEuAiActDeadline}
              onEuAiActDeadlineChange={onEuAiActDeadlineChange}
              localGdprCompliance={localGdprCompliance}
              setLocalGdprCompliance={setLocalGdprCompliance}
              onGdprComplianceChange={onGdprComplianceChange}
              localPotentialFines={localPotentialFines}
              setLocalPotentialFines={setLocalPotentialFines}
              onPotentialFinesChange={onPotentialFinesChange}
              localDataLocalization={localDataLocalization}
              setLocalDataLocalization={setLocalDataLocalization}
              onDataLocalizationChange={onDataLocalizationChange}
              localKeyDataValues={localKeyDataValues}
              setLocalKeyDataValues={setLocalKeyDataValues}
            />

            {/* Compliance Analytics */}
            <ComplianceAnalyticsSection
              isEditing={true}
              normalizedDeletedSections={normalizedDeletedSections}
              visualDataCards={visualDataCards}
              localVisualDataCards={localVisualDataCards}
              setLocalVisualDataCards={setLocalVisualDataCards}
              onDeleteSection={onDeleteSection}
              onScoutIconClick={onScoutIconClick}
            />

            {/* Regional Breakdown */}
            <RegionalComplianceSection
              isEditing={true}
              normalizedDeletedSections={normalizedDeletedSections}
              regionalData={regionalData}
              localRegionalData={localRegionalData}
              setLocalRegionalData={setLocalRegionalData}
              onDeleteSection={onDeleteSection}
              onScoutIconClick={onScoutIconClick}
            />

            {/* Strategic Recommendations */}
            <StrategicRecommendationsSection
              isEditing={true}
              normalizedDeletedSections={normalizedDeletedSections}
              localStrategicRecommendations={localStrategicRecommendations}
              setLocalStrategicRecommendations={setLocalStrategicRecommendations}
              regulatoryData={regulatoryData}
              onDeleteSection={onDeleteSection}
              onScoutIconClick={onScoutIconClick}
            />

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
            <KeyRegulatoryUpdatesSection
              isEditing={false}
              normalizedDeletedSections={normalizedDeletedSections}
              keyDataPoints={keyDataPoints}
              onDeleteSection={onDeleteSection}
              onScoutIconClick={onScoutIconClick}
              localEuAiActDeadline={localEuAiActDeadline}
              setLocalEuAiActDeadline={setLocalEuAiActDeadline}
              onEuAiActDeadlineChange={onEuAiActDeadlineChange}
              localGdprCompliance={localGdprCompliance}
              setLocalGdprCompliance={setLocalGdprCompliance}
              onGdprComplianceChange={onGdprComplianceChange}
              localPotentialFines={localPotentialFines}
              setLocalPotentialFines={setLocalPotentialFines}
              onPotentialFinesChange={onPotentialFinesChange}
              localDataLocalization={localDataLocalization}
              setLocalDataLocalization={setLocalDataLocalization}
              onDataLocalizationChange={onDataLocalizationChange}
              localKeyDataValues={localKeyDataValues}
              setLocalKeyDataValues={setLocalKeyDataValues}
            />

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
                <ComplianceAnalyticsSection
                  isEditing={false}
                  normalizedDeletedSections={normalizedDeletedSections}
                  visualDataCards={visualDataCards}
                  localVisualDataCards={localVisualDataCards}
                  setLocalVisualDataCards={setLocalVisualDataCards}
                  onDeleteSection={onDeleteSection}
                  onScoutIconClick={onScoutIconClick}
                />

                {/* Regional Breakdown */}
                <RegionalComplianceSection
                  isEditing={false}
                  normalizedDeletedSections={normalizedDeletedSections}
                  regionalData={regionalData}
                  localRegionalData={localRegionalData}
                  setLocalRegionalData={setLocalRegionalData}
                  onDeleteSection={onDeleteSection}
                  onScoutIconClick={onScoutIconClick}
                />

                {/* Strategic Recommendations */}
                <StrategicRecommendationsSection
                  isEditing={false}
                  normalizedDeletedSections={normalizedDeletedSections}
                  localStrategicRecommendations={localStrategicRecommendations}
                  setLocalStrategicRecommendations={setLocalStrategicRecommendations}
                  regulatoryData={regulatoryData}
                  onDeleteSection={onDeleteSection}
                  onScoutIconClick={onScoutIconClick}
                />

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
