
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, PlusCircle, ArrowRight, Download } from "lucide-react";

const Deals = () => {
  return (
    <Layout>
      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">GTM Strategies (Strategist)</h1>
            <p className="text-gray-500">Launch with a plan, not a gamble</p>
          </div>
          <Button className="bg-sales-blue hover:bg-blue-700 flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Create New Strategy
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle>UK Fintech Expansion</CardTitle>
                <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full">
                  Active
                </span>
              </div>
              <CardDescription>Created 1 week ago</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Target Market:</span>
                  <span>United Kingdom</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Timeline:</span>
                  <span>Q3 2023 - Q1 2024</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status:</span>
                  <span className="font-medium text-green-600">In Progress</span>
                </div>
                <div className="pt-3 border-t flex space-x-2">
                  <Button variant="outline" className="flex-1 flex items-center justify-center gap-1">
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                  <Button className="flex-1 bg-sales-blue hover:bg-blue-700 flex items-center justify-center gap-1">
                    View <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle>German Expansion</CardTitle>
                <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full">
                  Draft
                </span>
              </div>
              <CardDescription>Created 3 days ago</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Target Market:</span>
                  <span>Germany</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Timeline:</span>
                  <span>Q4 2023 - Q2 2024</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status:</span>
                  <span className="font-medium text-amber-600">Planning</span>
                </div>
                <div className="pt-3 border-t flex space-x-2">
                  <Button variant="outline" className="flex-1 flex items-center justify-center gap-1">
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                  <Button className="flex-1 bg-sales-blue hover:bg-blue-700 flex items-center justify-center gap-1">
                    View <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow border-dashed border-2 flex flex-col justify-center items-center p-6">
            <div className="p-3 bg-blue-50 text-blue-500 rounded-full mb-3">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="font-medium text-center mb-2">Create New GTM Strategy</h3>
            <p className="text-sm text-gray-500 text-center mb-4">
              Plan your next market expansion
            </p>
            <Button variant="outline">Create Strategy</Button>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>UK Fintech GTM Plan Summary</CardTitle>
            <CardDescription>Strategy overview and key metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Channel Mix</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span>Direct Outreach</span>
                      <span className="font-medium">40%</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Content Marketing</span>
                      <span className="font-medium">25%</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Events & Webinars</span>
                      <span className="font-medium">20%</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Partnerships</span>
                      <span className="font-medium">15%</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Timeline</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span>Market Research</span>
                      <span className="font-medium">Completed</span>
                    </li>
                    <li className="flex justify-between">
                      <span>ICP Development</span>
                      <span className="font-medium">Completed</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Content Creation</span>
                      <span className="font-medium">In Progress</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Campaign Launch</span>
                      <span className="font-medium">Next Week</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Target KPIs</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span>MQLs (3 months)</span>
                      <span className="font-medium">150</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Meetings Booked</span>
                      <span className="font-medium">45</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Conversion Rate</span>
                      <span className="font-medium">25%</span>
                    </li>
                    <li className="flex justify-between">
                      <span>CAC Target</span>
                      <span className="font-medium">£1,200</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Messaging Focus</h3>
                <p className="text-sm bg-blue-50 p-3 rounded border border-blue-100">
                  "Streamline your UK fintech operations with AI-powered insights that navigate regulatory complexities while accelerating growth. Our platform reduces compliance overhead by 40% while providing real-time market intelligence."
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Deals;
