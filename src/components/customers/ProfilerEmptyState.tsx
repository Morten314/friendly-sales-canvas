
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Plus, Search, ArrowRight } from "lucide-react";

interface ProfilerEmptyStateProps {
  onCreateICP: () => void;
  onSearchCompanies: () => void;
}

const ProfilerEmptyState = ({ onCreateICP, onSearchCompanies }: ProfilerEmptyStateProps) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full text-center p-8">
        <CardContent className="space-y-6">
          {/* Friendly Robot Illustration */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Bot className="h-12 w-12 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-400 rounded-full border-3 border-white animate-pulse"></div>
            </div>
          </div>

          {/* Welcome Message */}
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-900">
              Start building your Profiler!
            </h3>
            <p className="text-gray-600">
              Create an ICP or search for companies and people to enrich.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={onCreateICP}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Your First ICP
              <ArrowRight className="h-4 w-4 ml-auto" />
            </Button>
            
            <Button 
              onClick={onSearchCompanies}
              variant="outline" 
              className="w-full flex items-center gap-2 hover:bg-purple-50 hover:border-purple-200"
            >
              <Search className="h-4 w-4" />
              Search Companies to Enrich
            </Button>
          </div>

          {/* Additional Help */}
          <div className="pt-4 border-t">
            <p className="text-sm text-gray-500">
              Need help? Click the floating assistant for guidance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilerEmptyState;
