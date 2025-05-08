
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCircle, Users, Filter, UserPlus, Download, MessageSquare } from "lucide-react";
import { ICPProfilesList } from "@/components/customers/ICPProfilesList";
import { ICPBuilder } from "@/components/customers/ICPBuilder";
import { ICPInsights } from "@/components/customers/ICPInsights";

const Customers = () => {
  return (
    <Layout>
      <div className="animate-fade-in space-y-6">
        {/* Header with Agent Introduction */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">ICP Profiles (Profiler)</h1>
            <p className="text-gray-600 mt-1">
              "Sharpen your targeting with laser precision."
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Profiles
            </Button>
            <Button className="bg-sales-blue hover:bg-blue-700 flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Create New ICP
            </Button>
          </div>
        </div>

        {/* Tabs for Different Profile Views */}
        <Tabs defaultValue="profiles" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="profiles" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              ICP Profiles
            </TabsTrigger>
            <TabsTrigger value="builder" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              ICP Builder
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Insights & Analysis
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="profiles" className="space-y-6">
            <ICPProfilesList />
          </TabsContent>
          
          <TabsContent value="builder" className="space-y-6">
            <ICPBuilder />
          </TabsContent>
          
          <TabsContent value="insights" className="space-y-6">
            <ICPInsights />
          </TabsContent>
        </Tabs>

        {/* AI Interaction Panel */}
        <Card className="border-blue-200 bg-blue-50/40 mt-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-sales-blue" />
              Profiler Agent Chat
            </CardTitle>
            <CardDescription>
              Ask Profiler to help refine your ICPs or generate new insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-white rounded-md border border-gray-200 p-4 flex flex-col gap-3">
              <div className="bg-blue-50 rounded-lg p-3 self-start max-w-[80%]">
                <p className="text-sm font-medium">Profiler</p>
                <p className="text-sm">Based on the UK market research, I've identified 3 potential ICP segments. Would you like me to create detailed profiles for each?</p>
              </div>
              
              <div className="bg-gray-100 rounded-lg p-3 self-end max-w-[80%]">
                <p className="text-sm font-medium">You</p>
                <p className="text-sm">Yes, focus on the fintech segment first.</p>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Ask Profiler a question..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button className="bg-sales-blue hover:bg-blue-700">Send</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Customers;
