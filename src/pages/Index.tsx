
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { agentPersonas, AgentPersonaCard } from "@/components/agents/AgentPersonas";

const Index = () => {
  return (
    <Layout>
      <div className="animate-fade-in">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Welcome back, Alex!</h1>
          <p className="text-gray-500 mt-2">Which agent do you want to deploy today?</p>
        </div>

        {/* Agent Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {agentPersonas.map((agent) => (
            <Card key={agent.name} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-md ${agent.color}`}>
                      {agent.icon}
                    </div>
                    <CardTitle className="text-xl">{agent.name}</CardTitle>
                  </div>
                </div>
                <CardDescription className="text-sm font-medium">
                  {agent.description} - <span className="font-normal italic">{agent.role}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-gray-600 italic">"{agent.tagline}"</p>
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1">Key Strengths:</p>
                  <div className="flex flex-wrap gap-1">
                    {agent.strengths.map((strength, idx) => (
                      <Badge key={idx} variant="outline" className={agent.color.replace('bg-', 'border-').replace(' text-', ' ')}>
                        {strength}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button 
                  className={`w-full ${agent.color.replace('bg-', 'bg-').replace('50 text-', '600 hover:bg-').replace('600', '700')} text-white`}
                  onClick={() => window.location.href = agent.path}
                >
                  {agent.action}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Agent Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Activity Feed</CardTitle>
            <CardDescription>Latest outputs and actions from your agents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-md border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <p className="font-medium">Scout</p>
                  <p className="text-gray-500 text-sm ml-auto">2 hours ago</p>
                </div>
                <p className="text-sm">Completed UK fintech market analysis. Found 3 high-potential submarkets.</p>
              </div>
              
              <div className="p-3 bg-gray-50 rounded-md border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                  <p className="font-medium">Profiler</p>
                  <p className="text-gray-500 text-sm ml-auto">Yesterday</p>
                </div>
                <p className="text-sm">Created 2 ICP profiles for UK fintech segment targeting.</p>
              </div>
              
              <div className="p-3 bg-gray-50 rounded-md border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                  <p className="font-medium">Strategist</p>
                  <p className="text-gray-500 text-sm ml-auto">2 days ago</p>
                </div>
                <p className="text-sm">Generated GTM strategy for UK market entry. Ready for review.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Index;
