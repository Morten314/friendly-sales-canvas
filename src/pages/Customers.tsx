
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, PlusCircle } from "lucide-react";

const Customers = () => {
  return (
    <Layout>
      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">ICP Profiles (Profiler)</h1>
            <p className="text-gray-500">Sharpen your targeting with laser precision</p>
          </div>
          <Button className="bg-sales-blue hover:bg-blue-700 flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Create New ICP
          </Button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start mb-2">
                <CardTitle>UK Fintech Ops Director</CardTitle>
                <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full">
                  Primary ICP
                </span>
              </div>
              <CardDescription>Operations leader in mid-size fintech</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-500">Company Size:</div>
                  <div>50-200 employees</div>
                  
                  <div className="text-gray-500">Industry:</div>
                  <div>Fintech</div>
                  
                  <div className="text-gray-500">Location:</div>
                  <div>United Kingdom</div>
                  
                  <div className="text-gray-500">Pain Points:</div>
                  <div>Scaling operations, Regulatory compliance</div>
                </div>
                
                <div className="pt-3 border-t">
                  <Button variant="outline" className="w-full">View Full Profile</Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start mb-2">
                <CardTitle>UK Fintech CTO</CardTitle>
                <span className="bg-gray-100 text-gray-800 text-xs px-2.5 py-0.5 rounded-full">
                  Secondary ICP
                </span>
              </div>
              <CardDescription>Technical decision maker</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-500">Company Size:</div>
                  <div>50-200 employees</div>
                  
                  <div className="text-gray-500">Industry:</div>
                  <div>Fintech</div>
                  
                  <div className="text-gray-500">Location:</div>
                  <div>United Kingdom</div>
                  
                  <div className="text-gray-500">Pain Points:</div>
                  <div>Integration complexity, Technical debt</div>
                </div>
                
                <div className="pt-3 border-t">
                  <Button variant="outline" className="w-full">View Full Profile</Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow border-dashed border-2 flex flex-col justify-center items-center p-6">
            <div className="p-3 bg-blue-50 text-blue-500 rounded-full mb-3">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="font-medium text-center mb-2">Create New ICP Profile</h3>
            <p className="text-sm text-gray-500 text-center mb-4">
              Define a new target customer segment
            </p>
            <Button variant="outline">Create ICP</Button>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Messaging Insights</CardTitle>
            <CardDescription>Tailored communication for each ICP</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-md">
                <h3 className="font-medium mb-2">UK Fintech Ops Director</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Value Proposition</p>
                    <p className="text-sm">
                      "Streamline your market expansion with AI-powered insights that cut research time by 70% and improve targeting accuracy."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Key Pain Points to Address</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      <li>Navigating complex regulatory environments</li>
                      <li>Efficient resource allocation for new markets</li>
                      <li>Reducing time-to-market for expansion</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border rounded-md">
                <h3 className="font-medium mb-2">UK Fintech CTO</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Value Proposition</p>
                    <p className="text-sm">
                      "Leverage AI-powered insights to make data-driven expansion decisions with minimal technical integration and immediate ROI."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Key Pain Points to Address</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      <li>Integration with existing tech stack</li>
                      <li>Data security and compliance</li>
                      <li>Technical scalability during expansion</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Customers;
