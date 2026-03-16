import React from 'react';
import { Users, Building2, Upload, ArrowRight, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface OpportunityMatchCardProps {
  sectionName: string;
  opportunityPattern: string;
  crmAccountsCount: number;
  uploadedAccountsCount: number;
  totalLeadsCount: number;
  onViewLeads: () => void;
}

const OpportunityMatchCard: React.FC<OpportunityMatchCardProps> = ({
  sectionName,
  opportunityPattern,
  crmAccountsCount,
  uploadedAccountsCount,
  totalLeadsCount,
  onViewLeads,
}) => {
  if (totalLeadsCount === 0) return null;

  return (
    <div className="mt-3 mb-1">
      <button
        onClick={onViewLeads}
        className="w-full group border border-dashed border-primary/30 bg-primary/[0.03] hover:bg-primary/[0.06] hover:border-primary/50 rounded-lg px-4 py-3 flex items-center justify-between transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-xs font-medium text-foreground">
              {totalLeadsCount} matching lead{totalLeadsCount !== 1 ? 's' : ''} found
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {opportunityPattern}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {crmAccountsCount > 0 && (
              <Badge variant="outline" className="text-[10px] font-medium gap-1 bg-background">
                <Building2 className="h-3 w-3" />
                {crmAccountsCount} CRM
              </Badge>
            )}
            {uploadedAccountsCount > 0 && (
              <Badge variant="outline" className="text-[10px] font-medium gap-1 bg-background">
                <Upload className="h-3 w-3" />
                {uploadedAccountsCount} Uploaded
              </Badge>
            )}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </button>
    </div>
  );
};

export default OpportunityMatchCard;
