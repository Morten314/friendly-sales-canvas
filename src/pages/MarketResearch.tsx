
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, ArrowRight } from "lucide-react";

const MarketResearch = () => {
  return (
    <Layout>
      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Market Research (Scout)</h1>
            <p className="text-gray-500">Find the best markets before your competitors do</p>
          </div>
          <Button className="bg-sales-blue hover:bg-blue-700 flex items-center gap-2">
            <Search className="h-4 w-4" />
            New Research
          </Button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Market Research</CardTitle>
              <CardDescription>Access your previous market analyses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-md p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium">UK Fintech Market Analysis</h3>
                      <p className="text-sm text-gray-500">Completed 2 days ago</p>
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full">
                      Completed
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">Analysis of 5 fintech submarkets with TAM calculation and competitor landscape.</p>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Market Score: 87/100</span>
                    <Button variant="ghost" size="sm" className="text-sales-blue flex items-center gap-1">
                      View Results <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="border rounded-md p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium">Germany Healthtech Expansion</h3>
                      <p className="text-sm text-gray-500">Completed 1 week ago</p>
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full">
                      Completed
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">Overview of German healthtech market opportunities and regulatory landscape.</p>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Market Score: 72/100</span>
                    <Button variant="ghost" size="sm" className="text-sales-blue flex items-center gap-1">
                      View Results <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
        </div>

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
                      <Button variant="ghost" size="sm" className="text-sales-blue">
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
                      <Button variant="ghost" size="sm" className="text-sales-blue">
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
                      <Button variant="ghost" size="sm" className="text-sales-blue">
                        View Details
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default MarketResearch;
