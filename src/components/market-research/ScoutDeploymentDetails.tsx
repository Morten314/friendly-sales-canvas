
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from "lucide-react";

interface DeploymentDetailsProps {
  deploymentData: {
    targetMarket: string;
    industryFocus: string;
    companySize: string;
    geographicRegion: string;
    leadPriority: string;
    additionalContext?: string;
    deployedAt: string;
  } | null;
}

export function ScoutDeploymentDetails({ deploymentData }: DeploymentDetailsProps) {
  if (!deploymentData) return null;

  return (
    <Card className="border-blue-200 shadow-sm">
      <CardHeader className="bg-blue-50 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-blue-100">
            <Search className="h-4 w-4 text-blue-600" />
          </div>
          <CardTitle className="text-base">Scout Deployment Details</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="font-medium text-gray-700">Deployed on:</div>
            <div>{deploymentData.deployedAt}</div>

            <div className="font-medium text-gray-700">Target Market:</div>
            <div>{deploymentData.targetMarket}</div>

            <div className="font-medium text-gray-700">Industry Focus:</div>
            <div>{deploymentData.industryFocus}</div>

            <div className="font-medium text-gray-700">Company Size:</div>
            <div>{deploymentData.companySize}</div>

            <div className="font-medium text-gray-700">Geographic Region:</div>
            <div>{deploymentData.geographicRegion}</div>

            <div className="font-medium text-gray-700">Lead Priority:</div>
            <div>{deploymentData.leadPriority}</div>

            {deploymentData.additionalContext && (
              <>
                <div className="font-medium text-gray-700">Additional Context:</div>
                <div>{deploymentData.additionalContext}</div>
              </>
            )}
          </div>
          
          <div className="pt-2 text-xs">
            <span className="text-blue-600 font-medium">Scout is running</span> - Finding leads based on your criteria
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
