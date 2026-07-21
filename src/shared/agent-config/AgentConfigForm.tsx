import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface AgentConfigValues {
  agentName?: string;
  assignedTasks: string;
  domain: string;
  generalInstructions: string;
  tone: string;
  autonomyLevel: string;
  frequency: string;
}
export interface AgentConfigChecks {
  leadGeneration: boolean;
  customerSupport: boolean;
  contentCreation: boolean;
  dataAnalysis: boolean;
  reporting: boolean;
}
export interface AgentConfigFormProps {
  title: string;
  description?: string;
  accent: "purple" | "blue";
  showAgentNameSelect?: boolean;
  readOnly?: boolean;
  submitLabel: string;
  values: AgentConfigValues;
  checks: AgentConfigChecks;
  onFieldChange: (field: keyof AgentConfigValues, value: string) => void;
  onCheckChange: (item: keyof AgentConfigChecks, checked: boolean) => void;
  onSubmit?: () => void;
}

const TASK_CATEGORIES: { key: keyof AgentConfigChecks; label: string }[] = [
  { key: "leadGeneration", label: "Lead Generation" },
  { key: "customerSupport", label: "Customer Support" },
  { key: "contentCreation", label: "Content Creation" },
  { key: "dataAnalysis", label: "Data Analysis" },
  { key: "reporting", label: "Reporting" },
];

const ACCENT = {
  purple: {
    container: "bg-purple-50 border-l-4 border-purple-500",
    title: "text-purple-900",
    description: "text-purple-700",
    divider: "border-t border-purple-200",
    button: "bg-purple-600 hover:bg-purple-700",
  },
  blue: {
    container: "bg-blue-50 border-l-4 border-blue-500",
    title: "text-blue-900",
    description: "text-blue-700",
    divider: "border-t border-blue-200",
    button: "bg-blue-600 hover:bg-blue-700",
  },
} as const;

export function AgentConfigForm({
  title,
  description,
  accent,
  showAgentNameSelect = false,
  readOnly = false,
  submitLabel,
  values,
  checks,
  onFieldChange,
  onCheckChange,
  onSubmit,
}: AgentConfigFormProps) {
  const c = ACCENT[accent];
  return (
    <div className={`p-6 rounded-lg ${c.container}`}>
      <h3 className={`text-lg font-semibold ${c.title} mb-2`}>{title}</h3>
      {description ? <p className={`text-sm ${c.description} mb-4`}>{description}</p> : null}

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {showAgentNameSelect ? (
            <div className="space-y-2">
              <Label htmlFor="agentName">Agent Name</Label>
              <Select
                value={values.agentName}
                onValueChange={(value) => onFieldChange("agentName", value)}
                disabled={readOnly}
              >
                <SelectTrigger id="agentName">
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scout">Scout</SelectItem>
                  <SelectItem value="profiler">Profiler</SelectItem>
                  <SelectItem value="strategist">Strategist</SelectItem>
                  <SelectItem value="activator">Activator</SelectItem>
                  <SelectItem value="presenter">Presenter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              value={values.domain}
              onChange={(e) => onFieldChange("domain", e.target.value)}
              placeholder="e.g., Lead generation agent, Customer support"
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone">Communication Tone</Label>
            <Select
              value={values.tone}
              onValueChange={(value) => onFieldChange("tone", value)}
              disabled={readOnly}
            >
              <SelectTrigger id="tone">
                <SelectValue placeholder="Select tone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="consultative">Consultative</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="autonomyLevel">Autonomy Level</Label>
            <Select
              value={values.autonomyLevel}
              onValueChange={(value) => onFieldChange("autonomyLevel", value)}
              disabled={readOnly}
            >
              <SelectTrigger id="autonomyLevel">
                <SelectValue placeholder="Select autonomy level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low - Always ask for approval</SelectItem>
                <SelectItem value="medium">Medium - Ask for complex decisions</SelectItem>
                <SelectItem value="high">High - Operate independently</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Check-in Frequency</Label>
            <Select
              value={values.frequency}
              onValueChange={(value) => onFieldChange("frequency", value)}
              disabled={readOnly}
            >
              <SelectTrigger id="frequency">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="ondemand">On-demand only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assignedTasks">Assigned Tasks &amp; Domain</Label>
          <Textarea
            id="assignedTasks"
            value={values.assignedTasks}
            onChange={(e) => onFieldChange("assignedTasks", e.target.value)}
            placeholder="Describe the specific tasks and responsibilities for this agent"
            rows={3}
            disabled={readOnly}
          />
        </div>

        <div className="space-y-2">
          <Label>Task Categories</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {TASK_CATEGORIES.map(({ key, label }) => (
              <div key={key} className="flex items-center space-x-2">
                <Checkbox
                  id={key}
                  checked={checks[key]}
                  onCheckedChange={(checked) => onCheckChange(key, checked === true)}
                  disabled={readOnly}
                />
                <Label htmlFor={key} className="text-sm">
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="generalInstructions">General Instructions</Label>
          <Textarea
            id="generalInstructions"
            value={values.generalInstructions}
            onChange={(e) => onFieldChange("generalInstructions", e.target.value)}
            placeholder="Specific guidelines and instructions for how the agent should operate"
            rows={4}
            disabled={readOnly}
          />
        </div>
      </div>

      {!readOnly ? (
        <div className={`mt-6 pt-4 ${c.divider}`}>
          <div className="flex justify-between items-center">
            <Button onClick={onSubmit} className={c.button}>
              {submitLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
