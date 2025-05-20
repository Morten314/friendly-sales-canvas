import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const ScoutCapabilities = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scout Capabilities</CardTitle>
        <CardDescription>What this agent can do for you</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          <li className="flex items-start gap-2">
            <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
              1
            </div>
            <span className="text-sm">Market size estimation & TAM analysis</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
              2
            </div>
            <span className="text-sm">Competitor research & positioning</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
              3
            </div>
            <span className="text-sm">Industry trends & growth forecasts</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
              4
            </div>
            <span className="text-sm">Regulatory & compliance landscape</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
              5
            </div>
            <span className="text-sm">Market entry barriers analysis</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
};