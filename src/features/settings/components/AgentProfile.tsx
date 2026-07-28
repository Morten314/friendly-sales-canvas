import { useState, useEffect } from "react";

import { useAgentProfile } from "../hooks/useAgentProfile";

import {
  AgentConfigForm,
  type AgentConfigValues,
  type AgentConfigChecks,
} from "@/shared/agent-config";
import { useAuth } from "@/shared/auth";

interface AgentProfileProps {
  onProfileUpdate?: () => void;
  isEditMode?: boolean;
}

export function AgentProfile({ onProfileUpdate, isEditMode = false }: AgentProfileProps) {
  const { currentUser } = useAuth();
  const { data: profileData } = useAgentProfile(currentUser?.uid);
  const [formData, setFormData] = useState<AgentConfigValues>({
    agentName: "",
    assignedTasks: "",
    domain: "",
    generalInstructions: "",
    tone: "",
    autonomyLevel: "",
    frequency: "",
  });

  const [checkedItems, setCheckedItems] = useState<AgentConfigChecks>({
    leadGeneration: false,
    customerSupport: false,
    contentCreation: false,
    dataAnalysis: false,
    reporting: false,
  });

  // Update form data when profileData changes
  useEffect(() => {
    if (profileData) {
      setFormData({
        agentName: profileData.agentName || "",
        assignedTasks: profileData.assignedTasks || "",
        domain: profileData.domain || "",
        generalInstructions: profileData.generalInstructions || "",
        tone: profileData.tone || "",
        autonomyLevel: profileData.autonomyLevel || "",
        frequency: profileData.frequency || "",
      });
      setCheckedItems(
        profileData.checkedItems || {
          leadGeneration: false,
          customerSupport: false,
          contentCreation: false,
          dataAnalysis: false,
          reporting: false,
        },
      );
    }
  }, [profileData]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (item: string, checked: boolean) => {
    setCheckedItems((prev) => ({ ...prev, [item]: checked }));
  };

  const handleSave = async () => {
    const payload = {
      agentName: formData.agentName,
      assignedTasks: formData.assignedTasks,
      domain: formData.domain,
      generalInstructions: formData.generalInstructions,
      tone: formData.tone,
      autonomyLevel: formData.autonomyLevel,
      frequency: formData.frequency,
      checkedItems: checkedItems,
    };

    try {
      const response = await fetch("/api/profile/agent_name", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Agent profile saved successfully:", result);
      alert("Agent profile saved successfully!");

      // Reset form fields
      setFormData({
        agentName: "",
        assignedTasks: "",
        domain: "",
        generalInstructions: "",
        tone: "",
        autonomyLevel: "",
        frequency: "",
      });
      setCheckedItems({
        leadGeneration: false,
        customerSupport: false,
        contentCreation: false,
        dataAnalysis: false,
        reporting: false,
      });

      // Call the callback to notify parent component
      if (onProfileUpdate) {
        onProfileUpdate();
      }
    } catch (error) {
      console.error("Error saving agent profile:", error);
      alert("Failed to save agent profile. Please try again.");
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <AgentConfigForm
        title="Agent Profile Settings"
        description="Configure how AI agents should behave and operate within your organization."
        accent="purple"
        showAgentNameSelect
        readOnly={!isEditMode}
        submitLabel="Save Agent Profile"
        values={formData}
        checks={checkedItems}
        onFieldChange={(field, value) => handleInputChange(field as keyof typeof formData, value)}
        onCheckChange={(item, checked) =>
          handleCheckboxChange(item as keyof typeof checkedItems, checked)
        }
        onSubmit={handleSave}
      />
    </div>
  );
}
