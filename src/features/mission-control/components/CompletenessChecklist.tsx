import { Check, ChevronDown } from "lucide-react";

import type { CompletenessItem, CompletenessSection } from "../lib/completeness";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";

const SECTION_LABEL: Record<CompletenessSection, string> = {
  profile: "Company Profile",
  "customer-profile": "Customer Profile",
  sources: "Data Sources",
};

interface Props {
  score: number;
  items: CompletenessItem[];
  onGoTo: (section: CompletenessSection) => void;
}

export function CompletenessChecklist({ score, items, onGoTo }: Props) {
  const sections = Object.keys(SECTION_LABEL) as CompletenessSection[];
  const missing = items.filter((i) => !i.done).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
          aria-label="Show completeness breakdown"
        >
          <span className="text-xs text-muted-foreground">Completeness:</span>
          <Progress value={score} className="w-32 h-1.5" />
          <span className="text-xs font-medium min-w-[2rem] text-right">{score}%</span>
          {missing > 0 && (
            <span className="text-[10px] text-muted-foreground">{missing} to do</span>
          )}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-[11px] font-semibold">Profile completeness · {score}%</p>
          <p className="text-[10px] text-muted-foreground">
            Your agents work from this information. Keeping it current is your team's
            responsibility — each item shows how much it adds.
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {sections.map((s) => {
            const list = items.filter((i) => i.section === s);
            const got = list.reduce((a, i) => a + (i.done ? i.weight : 0), 0);
            const total = list.reduce((a, i) => a + i.weight, 0);
            return (
              <div key={s} className="px-3 py-2 border-b last:border-b-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium">{SECTION_LABEL[s]}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {got}/{total}%
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {list.map((i) => (
                    <li key={i.key} className="flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1.5">
                        {i.done ? (
                          <Check className="h-3 w-3 text-primary" />
                        ) : (
                          <span className="h-3 w-3 rounded-full border border-muted-foreground/40" />
                        )}
                        <span className={i.done ? "text-muted-foreground" : ""}>{i.label}</span>
                      </span>
                      {i.done ? (
                        <span className="text-muted-foreground">+{i.weight}%</span>
                      ) : (
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => onGoTo(s)}
                        >
                          Add · +{i.weight}%
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
