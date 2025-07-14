import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { User, Users, Filter, UserPlus, Download, MessageSquare, Send, Eye, Edit, ArrowRight, BarChart3, Building, MapPin, Clock, Plus, Grid3X3, List, Sparkles, TrendingUp, Upload, Search } from "lucide-react";
import { ICPProfilesList } from "@/components/customers/ICPProfilesList";
import { ICPBuilder } from "@/components/customers/ICPBuilder";
import { ICPInsights } from "@/components/customers/ICPInsights";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import FloatingProfilerAgent from "@/components/agent-hub/FloatingProfilerAgent";
import ProfilerEmptyState from "@/components/customers/ProfilerEmptyState";
import AgentLevelInfo from "@/components/customers/AgentLevelInfo";
import ProspectingSection from "@/components/customers/ProspectingSection";
import DataEnrichmentModal from "@/components/customers/DataEnrichmentModal";
import LookalikeModal from "@/components/customers/LookalikeModal";
import MiniContextualReport from "@/components/customers/MiniContextualReport";
const Customers = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isEnrichmentOpen, setIsEnrichmentOpen] = useState(false);
  const [isLookalikeOpen, setIsLookalikeOpen] = useState(false);
  const [messages, setMessages] = useState([{
    role: "ai",
    content: "Based on the UK market research, I've identified 3 potential ICP segments. Would you like me to create detailed profiles for each?"
  }]);
  const [inputValue, setInputValue] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Sample data for the new sections - set to populated for demonstration
  const recentICPs = [{
    id: 1,
    name: "UK Fintech Operations Director",
    industry: "Fintech",
    region: "United Kingdom",
    keyTraits: ["Budget authority", "Technical background", "Growth-focused"],
    updatedAgo: "2 days ago",
    matchedAccounts: 47,
    matchStrength: 85
  }, {
    id: 2,
    name: "UK Healthcare IT Manager",
    industry: "Healthcare",
    region: "United Kingdom",
    keyTraits: ["IT decision maker", "Risk-averse", "Process-oriented"],
    updatedAgo: "1 week ago",
    matchedAccounts: 32,
    matchStrength: 72
  }, {
    id: 3,
    name: "UK SaaS Startup Founder",
    industry: "SaaS",
    region: "United Kingdom",
    keyTraits: ["Visionary", "Fast decision-making", "Tech-savvy"],
    updatedAgo: "2 weeks ago",
    matchedAccounts: 23,
    matchStrength: 68
  }];
  const suggestedICPs = [{
    id: 1,
    name: "UK E-commerce Growth Manager",
    industry: "E-commerce",
    reason: "Growing segment in your market",
    confidence: "High"
  }, {
    id: 2,
    name: "European Cybersecurity CISO",
    industry: "Cybersecurity",
    reason: "Emerging opportunity detected",
    confidence: "Medium"
  }, {
    id: 3,
    name: "UK PropTech Decision Maker",
    industry: "PropTech",
    reason: "Based on recent market trends",
    confidence: "High"
  }];
  const recentCompanies = [{
    id: 1,
    name: "TechFlow Solutions",
    industry: "Fintech",
    matchScore: 85,
    location: "London, UK"
  }, {
    id: 2,
    name: "HealthStream Ltd",
    industry: "Healthcare",
    matchScore: 72,
    location: "Manchester, UK"
  }, {
    id: 3,
    name: "DataVault Systems",
    industry: "SaaS",
    matchScore: 68,
    location: "Edinburgh, UK"
  }];
  const recentPeople = [{
    id: 1,
    name: "Sarah Mitchell",
    title: "Operations Director",
    company: "TechFlow Solutions",
    matchScore: 85
  }, {
    id: 2,
    name: "James Wilson",
    title: "IT Manager",
    company: "HealthStream Ltd",
    matchScore: 72
  }, {
    id: 3,
    name: "Emma Thompson",
    title: "Founder & CEO",
    company: "DataVault Systems",
    matchScore: 68
  }];
  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    setMessages([...messages, {
      role: "user",
      content: inputValue
    }]);
    setTimeout(() => {
      setMessages(current => [...current, {
        role: "ai",
        content: "I can analyze your ideal customer profile. Would you like me to focus on industry segmentation, role targeting, or pain point analysis?"
      }]);
    }, 1000);
    setInputValue("");
  };
  const MatchScoreBar = ({
    score
  }: {
    score: number;
  }) => <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full transition-all ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{
        width: `${score}%`
      }} />
      </div>
      <span className="text-sm font-medium">{score}%</span>
    </div>;
  const handleCreateFirstICP = () => {
    console.log("Creating first ICP");
  };
  const handleSearchCompanies = () => {
    console.log("Opening company search");
  };
  const handleScoutClick = () => {
    setIsChatOpen(!isChatOpen);
  };
  const handleEnrichClick = (companyName?: string) => {
    setIsEnrichmentOpen(true);
  };
  const handleLookalikeClick = () => {
    setIsLookalikeOpen(true);
  };
  const hasData = recentICPs.length > 0 || recentCompanies.length > 0 || recentPeople.length > 0;
  return <Layout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profiler</h1>
            <p className="text-gray-600 mt-1">Discover and manage your ideal customer profiles with AI-powered insights</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex items-center gap-2" onClick={() => handleEnrichClick()}>
              <Upload className="h-4 w-4" />
              Upload Data
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Create New ICP
            </Button>
          </div>
        </div>

        {/* Mini Contextual Report */}
        {hasData && <MiniContextualReport />}

        {/* Agent-Level Default Info */}
        <AgentLevelInfo onScoutClick={handleScoutClick} />

        {/* Show empty state if no data */}
        {!hasData ? <ProfilerEmptyState onCreateICP={handleCreateFirstICP} onSearchCompanies={handleSearchCompanies} /> : <>
            {/* Chat Window */}
            {isChatOpen && <Card className="border-blue-200 bg-blue-50/40">
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
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {messages.map((message, index) => <div key={index} className={`${message.role === "ai" ? "bg-blue-50 rounded-lg p-3 self-start max-w-[80%]" : "bg-gray-100 rounded-lg p-3 self-end max-w-[80%] ml-auto"}`}>
                          <p className="text-sm font-medium">
                            {message.role === "ai" ? "Profiler" : "You"}
                          </p>
                          <p className="text-sm">{message.content}</p>
                        </div>)}
                    </div>
                    
                    <div className="flex gap-2">
                      <Input type="text" placeholder="Ask Profiler a question..." className="flex-1" value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => {
                  if (e.key === 'Enter') handleSendMessage();
                }} />
                      <Button className="bg-sales-blue hover:bg-blue-700 flex items-center gap-2" onClick={handleSendMessage}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>}

            {/* Prospecting Section */}
            <ProspectingSection userName="Alex" />

            {/* Recent ICP Activity - Horizontally Scrollable */}
            

            {/* Smart Suggestions */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Suggested ICPs for You</h2>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {suggestedICPs.map(suggestion => <Card key={suggestion.id} className="hover:shadow-md transition-shadow border-dashed border-purple-200">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg text-purple-700">{suggestion.name}</CardTitle>
                        <Badge variant={suggestion.confidence === "High" ? "default" : "secondary"}>
                          {suggestion.confidence}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Building className="h-3 w-3" />
                        {suggestion.industry}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-gray-600">{suggestion.reason}</p>
                      <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                        <Plus className="mr-1 h-4 w-4" />
                        Adopt this ICP
                      </Button>
                    </CardContent>
                  </Card>)}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Companies */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">Recent Companies Viewed</h2>
                  <div className="flex gap-2">
                    <Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" onClick={() => setViewMode("grid")} className="h-8 w-8">
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button variant={viewMode === "table" ? "default" : "ghost"} size="icon" onClick={() => setViewMode("table")} className="h-8 w-8">
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {recentCompanies.map(company => <Card key={company.id} className="p-4">
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <h3 className="font-medium">{company.name}</h3>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span>{company.industry}</span>
                            <span>{company.location}</span>
                          </div>
                          <MatchScoreBar score={company.matchScore} />
                        </div>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleEnrichClick(company.name)}>
                          Enrich
                        </Button>
                      </div>
                    </Card>)}
                </div>
              </div>

              {/* Recent People */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">Recent People Viewed</h2>
                  <div className="flex gap-2">
                    <Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" onClick={() => setViewMode("grid")} className="h-8 w-8">
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button variant={viewMode === "table" ? "default" : "ghost"} size="icon" onClick={() => setViewMode("table")} className="h-8 w-8">
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {recentPeople.map(person => <Card key={person.id} className="p-4">
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <h3 className="font-medium">{person.name}</h3>
                          <div className="text-sm text-gray-600">
                            <div>{person.title}</div>
                            <div>{person.company}</div>
                          </div>
                          <MatchScoreBar score={person.matchScore} />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            Enrich
                          </Button>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                            Personalize
                          </Button>
                        </div>
                      </div>
                    </Card>)}
                </div>
              </div>
            </div>
          </>}

        {/* Original Tabs for Advanced Features */}
        
      </div>

      {/* Modals */}
      <DataEnrichmentModal isOpen={isEnrichmentOpen} onClose={() => setIsEnrichmentOpen(false)} />
      
      <LookalikeModal isOpen={isLookalikeOpen} onClose={() => setIsLookalikeOpen(false)} />

      {/* Floating Profiler Agent */}
      <FloatingProfilerAgent userName="Alex" hasICPs={hasData} currentContext={hasData ? "Viewing Profiler Dashboard" : "First-time Setup"} />
    </Layout>;
};
export default Customers;