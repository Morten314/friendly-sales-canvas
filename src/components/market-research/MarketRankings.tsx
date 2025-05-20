
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MarketRankingsProps {
  onViewResults: (marketName: string) => void;
}

export const MarketRankings = ({ onViewResults }: MarketRankingsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Rankings</CardTitle>
        <CardDescription>Comparative analysis of potential markets</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">Market</th>
                <th className="px-4 py-2 text-left">Score</th>
                <th className="px-4 py-2 text-left">Size (TAM)</th>
                <th className="px-4 py-2 text-left">Competition</th>
                <th className="px-4 py-2 text-left">Barriers</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-3">UK Fintech</td>
                <td className="px-4 py-3">
                  <span className="font-medium">87/100</span>
                </td>
                <td className="px-4 py-3">$24.5B</td>
                <td className="px-4 py-3">Medium</td>
                <td className="px-4 py-3">Low</td>
                <td className="px-4 py-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-sales-blue"
                    onClick={() => onViewResults("UK Fintech")}
                  >
                    View Details
                  </Button>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">Germany Healthtech</td>
                <td className="px-4 py-3">
                  <span className="font-medium">72/100</span>
                </td>
                <td className="px-4 py-3">$18.2B</td>
                <td className="px-4 py-3">High</td>
                <td className="px-4 py-3">Medium</td>
                <td className="px-4 py-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-sales-blue"
                    onClick={() => onViewResults("Germany Healthtech")}
                  >
                    View Details
                  </Button>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">France SaaS</td>
                <td className="px-4 py-3">
                  <span className="font-medium">65/100</span>
                </td>
                <td className="px-4 py-3">$12.8B</td>
                <td className="px-4 py-3">Medium</td>
                <td className="px-4 py-3">Medium</td>
                <td className="px-4 py-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-sales-blue"
                    onClick={() => onViewResults("France SaaS")}
                  >
                    View Details
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};