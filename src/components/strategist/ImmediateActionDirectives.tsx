import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mail, Linkedin, Phone, Clock, Zap, Users, List, AlertCircle,
} from "lucide-react";
import { actionDirectives, type ActionDirective, type DirectiveButton } from "./directiveData";

const typeColors: Record<string, string> = {
  "act-now": "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  "change-entry-point": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  "change-narrative": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  "build-warmth": "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800",
  "wait": "bg-muted text-muted-foreground border-border",
  "trigger-based-play": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  "internal-routing": "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800",
  "sequence-selection": "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800",
};

const iconMap: Record<DirectiveButton["icon"], React.ElementType> = {
  mail: Mail,
  linkedin: Linkedin,
  phone: Phone,
  clock: Clock,
  zap: Zap,
  users: Users,
  list: List,
};

const DirectiveCard = ({ directive, index }: { directive: ActionDirective; index: number }) => {
  return (
    <Card className="p-3 space-y-2">
      {/* Header: number, name, company, action badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-[10px] font-bold text-muted-foreground mt-0.5 shrink-0">
            {index + 1}.
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{directive.leadName}</span>
              <span className="text-[11px] text-muted-foreground">— {directive.company}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
              <span>{directive.email}</span>
              <span>·</span>
              <a
                href={`https://${directive.linkedinUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary"
              >
                {directive.linkedinUrl}
              </a>
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`text-[9px] font-semibold shrink-0 ${typeColors[directive.actionType] || ""}`}
        >
          {directive.actionLabel}
        </Badge>
      </div>

      {/* Instruction */}
      <p className="text-[11px] text-foreground leading-relaxed">
        {directive.instruction}
      </p>

      {/* Why today */}
      <div className="flex items-start gap-1.5 bg-muted/40 rounded px-2 py-1.5">
        <AlertCircle className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <span className="font-semibold">Why today:</span> {directive.whyToday}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 pt-0.5">
        {directive.buttons.map((btn) => {
          const Icon = iconMap[btn.icon];
          return (
            <Button
              key={btn.label}
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Icon className="h-3 w-3" />
              {btn.label}
            </Button>
          );
        })}
      </div>
    </Card>
  );
};

const ImmediateActionDirectives = () => {
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Today's Directives
        </h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Lead-specific actions that require attention today.
        </p>
      </div>
      <div className="space-y-2">
        {actionDirectives.map((d, i) => (
          <DirectiveCard key={d.id} directive={d} index={i} />
        ))}
      </div>
    </div>
  );
};

export default ImmediateActionDirectives;