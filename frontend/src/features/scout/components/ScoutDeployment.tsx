import { useState } from "react";

import {
  AgentConfigForm,
  type AgentConfigValues,
  type AgentConfigChecks,
} from "@/shared/agent-config";

export function ScoutDeployment() {
  const [formData, setFormData] = useState<AgentConfigValues>({
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

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (item: string, checked: boolean) => {
    setCheckedItems((prev) => ({ ...prev, [item]: checked }));
  };

  const handleDeploy = () => {
    console.log("Scout deployed:", { ...formData, checkedItems });
    // Implementation for deploying scout
  };

  return (
    <div className="space-y-6">
      <AgentConfigForm
        title="Deploy Scout Agent"
        description="Configure Scout for market research and lead generation activities."
        accent="blue"
        submitLabel="Deploy Scout"
        values={formData}
        checks={checkedItems}
        onFieldChange={(field, value) => handleInputChange(field as keyof typeof formData, value)}
        onCheckChange={(item, checked) =>
          handleCheckboxChange(item as keyof typeof checkedItems, checked)
        }
        onSubmit={handleDeploy}
      />
    </div>
  );
}
