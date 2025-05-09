import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartLegend, 
  ChartLegendContent 
} from "@/components/ui/chart";
import { BarChart3, Download, RefreshCw } from "lucide-react";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts";

const marketFitData = [
  { segment: "UK Fintech", score: 87, potential: 95 },
  { segment: "UK Healthcare", score: 72, potential: 80 },
  { segment: "UK SaaS", score: 68, potential: 76 },
  { segment: "UK E-commerce", score: 62, potential: 70 },
  { segment: "UK Manufacturing", score: 45, potential: 58 },
];

const keywordData = [
  { name: "Payment Processing", value: 78 },
  { name: "Digital Transformation", value: 72 },
  { name: "Compliance", value: 65 },
  { name: "API Integration", value: 61 },
  { name: "Real-time Analytics", value: 59 },
  { name: "Cost Reduction", value: 54 },
  { name: "Legacy System", value: 52 },
  { name: "Customer Experience", value: 48 },
];

export function ICPInsights() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">ICP Analysis & Insights</h3>
          <p className="text-sm text-gray-600">
            AI-generated insights to improve your customer targeting
          </p>
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh Analysis
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Market Fit Analysis</CardTitle>
              <Button variant="ghost" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              Alignment between your solution and target markets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={marketFitData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="segment" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="score" fill="#2563eb" name="Current Fit Score" />
                  <Bar dataKey="potential" fill="#93c5fd" name="Potential Score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Key Messaging Topics</CardTitle>
            <CardDescription>
              Topics that resonate with your ICPs based on research
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {keywordData.map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-sm text-gray-500">{item.value}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-sales-blue h-2.5 rounded-full" 
                      style={{ width: `${item.value}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>ICP Refinement Recommendations</CardTitle>
          <CardDescription>
            AI-generated suggestions to improve your customer profiles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border border-blue-100 bg-blue-50 rounded-md">
              <h4 className="font-medium text-blue-800 mb-1">Expand UK Fintech ICP</h4>
              <p className="text-sm text-blue-700 mb-3">
                Your UK Fintech ICP shows strong market fit. Consider subdividing this profile into:
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Banking Tech Decision Makers</Badge>
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Payments Operations Leaders</Badge>
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Regtech Compliance Officers</Badge>
              </div>
            </div>
            
            <div className="p-4 border border-amber-100 bg-amber-50 rounded-md">
              <h4 className="font-medium text-amber-800 mb-1">Refine UK Healthcare ICP</h4>
              <p className="text-sm text-amber-700 mb-1">
                Add more specificity to pain points - current profile is too broad.
              </p>
              <p className="text-sm text-amber-700">
                Focus on NHS procurement processes and compliance requirements.
              </p>
            </div>
            
            <div className="p-4 border border-green-100 bg-green-50 rounded-md">
              <h4 className="font-medium text-green-800 mb-1">New Opportunity: UK Financial Services</h4>
              <p className="text-sm text-green-700">
                Analysis of market trends suggests potential in non-bank financial services. 
                Consider creating a new ICP targeting wealth management and insurance tech decision-makers.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
