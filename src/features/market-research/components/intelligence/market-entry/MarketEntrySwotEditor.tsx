import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Concrete shape of the container's `editSwotAnalysis` edit state: every
 * quadrant is a REQUIRED `string[]` (unlike `MarketEntrySwot` from ./types,
 * whose arrays are `.nullish()`). Kept local so this editor stays a pure
 * controlled component over the exact edit-state shape.
 */
export interface MarketEntrySwotEdit {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface MarketEntrySwotEditorProps {
  value: MarketEntrySwotEdit;
  onChange: (next: MarketEntrySwotEdit) => void;
}

/**
 * Editable 2×2 SWOT grid for the Market Entry edit form.
 *
 * Pure controlled component: renders each quadrant's items as editable inputs
 * (value in, `onChange` out) with per-item remove buttons and a per-quadrant
 * "Add" button. Quadrant order matches the live UI (Strengths, Opportunities,
 * Weaknesses, Threats). Contains no save/toast/Scout/delete logic — those
 * affordances stay in the container.
 */
export default function MarketEntrySwotEditor({ value, onChange }: MarketEntrySwotEditorProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Strengths */}
      <div className="bg-green-50 p-3 rounded border border-green-200">
        <Label className="text-sm font-semibold text-green-700 mb-2 block">Strengths</Label>
        <div className="space-y-2">
          {value.strengths.map((strength, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={strength}
                onChange={(e) => {
                  const updated = [...value.strengths];
                  updated[index] = e.target.value;
                  onChange({ ...value, strengths: updated });
                }}
                className="flex-1 text-sm text-green-700"
                placeholder="Strength"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const updated = value.strengths.filter((_, i) => i !== index);
                  onChange({ ...value, strengths: updated });
                }}
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                strengths: [...value.strengths, ""],
              })
            }
          >
            Add Strength
          </Button>
        </div>
      </div>

      {/* Opportunities */}
      <div className="bg-blue-50 p-3 rounded border border-blue-200">
        <Label className="text-sm font-semibold text-blue-700 mb-2 block">Opportunities</Label>
        <div className="space-y-2">
          {value.opportunities.map((opportunity, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={opportunity}
                onChange={(e) => {
                  const updated = [...value.opportunities];
                  updated[index] = e.target.value;
                  onChange({ ...value, opportunities: updated });
                }}
                className="flex-1 text-sm text-blue-700"
                placeholder="Opportunity"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const updated = value.opportunities.filter((_, i) => i !== index);
                  onChange({ ...value, opportunities: updated });
                }}
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                opportunities: [...value.opportunities, ""],
              })
            }
          >
            Add Opportunity
          </Button>
        </div>
      </div>

      {/* Weaknesses */}
      <div className="bg-orange-50 p-3 rounded border border-orange-200">
        <Label className="text-sm font-semibold text-orange-700 mb-2 block">Weaknesses</Label>
        <div className="space-y-2">
          {value.weaknesses.map((weakness, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={weakness}
                onChange={(e) => {
                  const updated = [...value.weaknesses];
                  updated[index] = e.target.value;
                  onChange({ ...value, weaknesses: updated });
                }}
                className="flex-1 text-sm text-orange-700"
                placeholder="Weakness"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const updated = value.weaknesses.filter((_, i) => i !== index);
                  onChange({ ...value, weaknesses: updated });
                }}
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                weaknesses: [...value.weaknesses, ""],
              })
            }
          >
            Add Weakness
          </Button>
        </div>
      </div>

      {/* Threats */}
      <div className="bg-red-50 p-3 rounded border border-red-200">
        <Label className="text-sm font-semibold text-red-700 mb-2 block">Threats</Label>
        <div className="space-y-2">
          {value.threats.map((threat, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={threat}
                onChange={(e) => {
                  const updated = [...value.threats];
                  updated[index] = e.target.value;
                  onChange({ ...value, threats: updated });
                }}
                className="flex-1 text-sm text-red-700"
                placeholder="Threat"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const updated = value.threats.filter((_, i) => i !== index);
                  onChange({ ...value, threats: updated });
                }}
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                threats: [...value.threats, ""],
              })
            }
          >
            Add Threat
          </Button>
        </div>
      </div>
    </div>
  );
}
