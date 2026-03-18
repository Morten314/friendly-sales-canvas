import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface OpportunitySignalBadgeProps {
  matchingLeads: number;
  totalLeads: number;
  onViewLeads: () => void;
}

const OpportunitySignalBadge: React.FC<OpportunitySignalBadgeProps> = ({
  matchingLeads,
  totalLeads,
  onViewLeads,
}) => {
  if (matchingLeads === 0) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onViewLeads();
      }}
      className="group flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all duration-200"
    >
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs font-semibold text-primary">
        {matchingLeads}
        <span className="text-muted-foreground font-normal">/{totalLeads}</span>
      </span>
      <span className="text-[11px] text-muted-foreground hidden sm:inline">Matching Leads</span>
      <span className="text-[11px] font-medium text-primary flex items-center gap-0.5 group-hover:underline">
        View Leads <ArrowRight className="h-3 w-3" />
      </span>
    </button>
  );
};

export default OpportunitySignalBadge;
