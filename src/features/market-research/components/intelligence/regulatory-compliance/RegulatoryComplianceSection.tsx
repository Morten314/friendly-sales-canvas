import React, { useState, useEffect } from "react";

import { ComplianceAnalyticsSection } from "./ComplianceAnalyticsSection";
import { ExecutiveSummarySection } from "./ExecutiveSummarySection";
import { KeyRegulatoryUpdatesSection } from "./KeyRegulatoryUpdatesSection";
import { RegionalComplianceSection } from "./RegionalComplianceSection";
import { DEFAULT_REGIONAL_DATA, DEFAULT_VISUAL_DATA_CARDS } from "./regulatoryDefaults";
import { RegulatoryFooter } from "./RegulatoryFooter";
import { RegulatoryHeader } from "./RegulatoryHeader";
import { deriveKeyDataPoints } from "./regulatoryHelpers";
import { StrategicRecommendationsSection } from "./StrategicRecommendationsSection";
import type { RegulatoryComplianceSectionProps } from "./types";
import { useRegulatoryCompliance } from "./useRegulatoryCompliance";

import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/shared/auth";
import { getUserLocalStorage, setUserLocalStorage } from "@/shared/lib/cacheUtils";
import type {
  UntypedBackendApiResponse,
  UntypedRegulatoryUpdate,
  UntypedVisualDataCard,
  UntypedRegionData,
} from "@/shared/types/escape-hatches";

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
  companyProfile,
}) => {
  const { currentUser, orgId } = useAuth();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility
  // Section-data sourced via the dedicated hook (react-query, memory-only cache)
  const { regulatoryData, refresh } = useRegulatoryCompliance(currentUser?.uid ?? "", orgIdToUse);

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

  // Update local state when regulatoryData (from useRegulatoryCompliance) changes (for API data updates)
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
      setUserLocalStorage("regulatory_executiveSummary", localExecutiveSummary, currentUser?.uid);
    }
  }, [localExecutiveSummary, currentUser?.uid]);

  useEffect(() => {
    if (localEuAiActDeadline) {
      setUserLocalStorage("regulatory_euAiActDeadline", localEuAiActDeadline, currentUser?.uid);
    }
  }, [localEuAiActDeadline, currentUser?.uid]);

  useEffect(() => {
    if (localGdprCompliance) {
      setUserLocalStorage("regulatory_gdprCompliance", localGdprCompliance, currentUser?.uid);
    }
  }, [localGdprCompliance, currentUser?.uid]);

  useEffect(() => {
    if (localPotentialFines) {
      setUserLocalStorage("regulatory_potentialFines", localPotentialFines, currentUser?.uid);
    }
  }, [localPotentialFines, currentUser?.uid]);

  useEffect(() => {
    if (localDataLocalization) {
      setUserLocalStorage("regulatory_dataLocalization", localDataLocalization, currentUser?.uid);
    }
  }, [localDataLocalization, currentUser?.uid]);

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
    const defaultRegionalData = DEFAULT_REGIONAL_DATA;
    const regionalDataToUse = regulatoryData?.regionalData || defaultRegionalData;
    setLocalRegionalData(
      regionalDataToUse && regionalDataToUse.length > 0
        ? [...regionalDataToUse]
        : [...defaultRegionalData],
    );

    // Initialize visual data cards
    const defaultVisualDataCards = DEFAULT_VISUAL_DATA_CARDS;
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

  const handleSaveChangesClick = () => {
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
  };

  // Listen for company profile updates from settings
  useEffect(() => {
    const handleCompanyProfileUpdate = () => {
      void (async () => {
        // Wait a bit for the backend to process the profile update
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Fetch the latest company profile from backend (with org_id)
        try {
          const profileUrl = `/api/profile/company?org_id=${orgIdToUse}`;
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

        refresh(); // refresh = true for company profile changes
      })();
    };

    window.addEventListener("companyProfileUpdated", handleCompanyProfileUpdate);

    return () => {
      window.removeEventListener("companyProfileUpdated", handleCompanyProfileUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only listener subscription; handler reads currentUser?.uid + orgIdToUse at fire time intentionally
  }, []);

  // Also refresh when the companyProfile prop identity changes (the hook re-fetches via refresh()).
  // Depend only on companyProfile (not refresh) so the effect fires on profile change, not on hook re-renders.
  useEffect(() => {
    if (!companyProfile) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally watches only companyProfile; refresh is excluded to avoid re-firing on hook identity changes
  }, [companyProfile]);

  // Initialize local state for regional data and visual data cards when not editing
  // Moved above the early return below to satisfy rules-of-hooks (must run unconditionally)
  useEffect(() => {
    if (!isEditing) {
      const defaultRegionalData = DEFAULT_REGIONAL_DATA;

      const defaultVisualDataCards = DEFAULT_VISUAL_DATA_CARDS;

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

  const visualDataCards = regulatoryData?.visualDataCards || DEFAULT_VISUAL_DATA_CARDS;

  const regionalData = regulatoryData?.regionalData || DEFAULT_REGIONAL_DATA;

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

            <RegulatoryFooter
              isEditing={true}
              isExpanded={isExpanded}
              isSplitView={isSplitView}
              onSave={handleSaveChangesClick}
              onCancelEdit={onCancelEdit}
              onEditHistoryOpen={onEditHistoryOpen}
              onExportPDF={onExportPDF}
              onSaveToWorkspace={onSaveToWorkspace}
              onGenerateShareableLink={onGenerateShareableLink}
              onExpandToggle={onExpandToggle}
            />
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
              <RegulatoryFooter
                isEditing={false}
                isExpanded={false}
                isSplitView={isSplitView}
                onSave={handleSaveChangesClick}
                onCancelEdit={onCancelEdit}
                onEditHistoryOpen={onEditHistoryOpen}
                onExportPDF={onExportPDF}
                onSaveToWorkspace={onSaveToWorkspace}
                onGenerateShareableLink={onGenerateShareableLink}
                onExpandToggle={onExpandToggle}
              />
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

                <RegulatoryFooter
                  isEditing={false}
                  isExpanded={true}
                  isSplitView={isSplitView}
                  onSave={handleSaveChangesClick}
                  onCancelEdit={onCancelEdit}
                  onEditHistoryOpen={onEditHistoryOpen}
                  onExportPDF={onExportPDF}
                  onSaveToWorkspace={onSaveToWorkspace}
                  onGenerateShareableLink={onGenerateShareableLink}
                  onExpandToggle={onExpandToggle}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RegulatoryComplianceSection;
