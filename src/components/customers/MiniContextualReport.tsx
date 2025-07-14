
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, Users, Target, TrendingUp } from "lucide-react";

const MiniContextualReport = () => {
  return (
    <Card className="w-full bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
              <Target className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <p className="text-sm text-gray-700 leading-relaxed">
              Based on your saved ICP settings: <strong>48%</strong> of your target companies are in Healthcare & Tech sectors. 
              Mid-market firms (50-500 employees) show rising purchase intent signals, especially in the US and UK. 
              Top decision-maker roles include VP of Sales, CIO, and Marketing Heads.
            </p>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <Building className="h-3 w-3 text-blue-600" />
                <Badge variant="secondary" className="text-xs">Healthcare & Tech</Badge>
                <span className="text-gray-500">48%</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 text-green-600" />
                <Badge variant="outline" className="text-xs">50-500 employees</Badge>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-purple-600" />
                <span className="text-gray-600">Rising intent signals</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MiniContextualReport;
