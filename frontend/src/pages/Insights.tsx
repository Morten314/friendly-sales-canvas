
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart, LineChart, PieChart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const Insights = () => {
  return (
    <Layout>
      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Reports</h1>
            <p className="text-gray-500">Performance analytics across all agents</p>
          </div>
          <Button className="bg-sales-blue hover:bg-blue-700 flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            Export All Reports
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Market Entry Progress</span>
                <PieChart className="h-5 w-5 text-blue-500" />
              </CardTitle>
              <CardDescription>Scout agent performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <span>UK Market Research</span>
                    <span className="font-medium">87%</span>
                  </div>
                  <Progress value={87} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <span>DACH Market Research</span>
                    <span className="font-medium">63%</span>
                  </div>
                  <Progress value={63} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <span>ANZ Market Research</span>
                    <span className="font-medium">45%</span>
                  </div>
                  <Progress value={45} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-green-500">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>ICP Accuracy</span>
                <Users className="h-5 w-5 text-green-500" />
              </CardTitle>
              <CardDescription>Profiler agent performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <span>Firmographic Match</span>
                    <span className="font-medium">92%</span>
                  </div>
                  <Progress value={92} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <span>Psychographic Match</span>
                    <span className="font-medium">78%</span>
                  </div>
                  <Progress value={78} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <span>Pain Point Identification</span>
                    <span className="font-medium">85%</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Campaign Performance</span>
                <LineChart className="h-5 w-5 text-amber-500" />
              </CardTitle>
              <CardDescription>Activator agent performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <span>Email Open Rate</span>
                    <span className="font-medium">32%</span>
                  </div>
                  <Progress value={32} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <span>Reply Rate</span>
                    <span className="font-medium">18%</span>
                  </div>
                  <Progress value={18} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <span>Meeting Conversion</span>
                    <span className="font-medium">8%</span>
                  </div>
                  <Progress value={8} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Agent Output Accuracy</CardTitle>
              <CardDescription>Measured against internal benchmarks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Scout</span>
                    <span className="font-medium">87%</span>
                  </div>
                  <Progress value={87} className="h-3 bg-gray-100">
                    <div className="h-full bg-blue-500" style={{ width: '87%' }}></div>
                  </Progress>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Profiler</span>
                    <span className="font-medium">91%</span>
                  </div>
                  <Progress value={91} className="h-3 bg-gray-100">
                    <div className="h-full bg-green-500" style={{ width: '91%' }}></div>
                  </Progress>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Strategist</span>
                    <span className="font-medium">84%</span>
                  </div>
                  <Progress value={84} className="h-3 bg-gray-100">
                    <div className="h-full bg-purple-500" style={{ width: '84%' }}></div>
                  </Progress>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Activator</span>
                    <span className="font-medium">79%</span>
                  </div>
                  <Progress value={79} className="h-3 bg-gray-100">
                    <div className="h-full bg-amber-500" style={{ width: '79%' }}></div>
                  </Progress>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Presenter</span>
                    <span className="font-medium">88%</span>
                  </div>
                  <Progress value={88} className="h-3 bg-gray-100">
                    <div className="h-full bg-red-500" style={{ width: '88%' }}></div>
                  </Progress>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Time Saved Analytics</CardTitle>
              <CardDescription>Compared to manual processes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <p className="font-medium">Market Research</p>
                    <p className="text-sm text-gray-500">Using Scout</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">68%</p>
                    <p className="text-sm text-gray-500">42 hours saved</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <p className="font-medium">ICP Development</p>
                    <p className="text-sm text-gray-500">Using Profiler</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">73%</p>
                    <p className="text-sm text-gray-500">18 hours saved</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <p className="font-medium">Strategy Creation</p>
                    <p className="text-sm text-gray-500">Using Strategist</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">52%</p>
                    <p className="text-sm text-gray-500">24 hours saved</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Demo Preparation</p>
                    <p className="text-sm text-gray-500">Using Presenter</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">61%</p>
                    <p className="text-sm text-gray-500">16 hours saved</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Insights;
