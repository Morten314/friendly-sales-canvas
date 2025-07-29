
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Building, MapPin, TrendingUp } from "lucide-react";

interface SuggestedICP {
  id: string;
  name: string;
  industry: string;
  segment: string;
  companySize: string;
  geography: string;
  leadCount: number;
  decisionMakers: string[];
  keyAttributes: string[];
  growthIndicator?: string;
}

interface ICPListViewProps {
  icps: SuggestedICP[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const ICPListView = ({ icps, selectedId, onSelect }: ICPListViewProps) => {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        {icps.length} Available ICPs
      </h3>
      
      <div className="space-y-1">
        {icps.map((icp) => (
          <Button
            key={icp.id}
            variant={selectedId === icp.id ? "secondary" : "ghost"}
            className={`w-full justify-start p-3 h-auto text-left transition-all duration-200 hover:shadow-sm ${
              selectedId === icp.id 
                ? 'bg-blue-50 border-l-4 border-blue-600 shadow-sm' 
                : 'hover:bg-gray-50 hover:border-l-4 hover:border-gray-300'
            }`}
            onClick={() => onSelect(icp.id)}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-gray-900 truncate text-sm">
                    {icp.name}
                  </h4>
                  {icp.growthIndicator && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs flex items-center gap-1">
                      <TrendingUp className="h-2.5 w-2.5" />
                      {icp.growthIndicator}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <Users className="h-2.5 w-2.5" />
                    <span className="font-medium text-blue-600">
                      {icp.leadCount} Matches
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Building className="h-2.5 w-2.5" />
                    <span className="truncate max-w-[80px]">{icp.industry}</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5" />
                    <span className="truncate max-w-[60px]">{icp.segment}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex-shrink-0 ml-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              </div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};
