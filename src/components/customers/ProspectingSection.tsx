import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Send, Building, Users, MapPin, Briefcase, Search, Download, Save, Share, TrendingUp, ExternalLink, Phone, Mail, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
interface ProspectingSectionProps {
  userName?: string;
}
const ProspectingSection = ({
  userName = "Alex"
}: ProspectingSectionProps) => {
  const [messages, setMessages] = useState([{
    role: "scout",
    content: `Hi ${userName}, ready to find your next best-fit prospects? Let's define your filters.`
  }]);
  const [inputValue, setInputValue] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [currentStep, setCurrentStep] = useState("industry");
  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    setMessages(prev => [...prev, {
      role: "user",
      content: inputValue
    }]);

    // Add filter chip
    setFilters(prev => [...prev, inputValue]);

    // Scout response based on current step
    setTimeout(() => {
      let scoutResponse = "";
      if (currentStep === "industry") {
        scoutResponse = "Great! Now, what company size are you targeting?";
        setCurrentStep("size");
      } else if (currentStep === "size") {
        scoutResponse = "Perfect! Which regions should we focus on?";
        setCurrentStep("location");
      } else if (currentStep === "location") {
        scoutResponse = "Excellent! What job titles are you interested in?";
        setCurrentStep("titles");
      } else if (currentStep === "titles") {
        scoutResponse = "Any specific search keywords or technologies?";
        setCurrentStep("keywords");
      } else {
        scoutResponse = "Perfect! Let me find prospects matching your criteria...";
        setTimeout(() => setShowResults(true), 2000);
      }
      setMessages(prev => [...prev, {
        role: "scout",
        content: scoutResponse
      }]);
    }, 1000);
    setInputValue("");
  };
  const removeFilter = (index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  };
  const quickActions = ["Technology companies", "100-500 employees", "North America", "VP of Sales"];

  // Sample results data
  const companyResults = [{
    name: "TechFlow Solutions",
    industry: "SaaS",
    location: "🇺🇸 San Francisco, CA",
    size: "250-500",
    revenue: "$10M-50M",
    keyRoles: ["CTO", "VP Sales"],
    intentTrend: "↗️ High",
    lastSignal: "2 days ago"
  }, {
    name: "DataStream Corp",
    industry: "Analytics",
    location: "🇺🇸 Austin, TX",
    size: "100-250",
    revenue: "$5M-25M",
    keyRoles: ["Head of Data", "VP Marketing"],
    intentTrend: "↗️ Medium",
    lastSignal: "1 week ago"
  }, {
    name: "CloudVault Systems",
    industry: "Cybersecurity",
    location: "🇺🇸 Boston, MA",
    size: "300-500",
    revenue: "$25M-100M",
    keyRoles: ["CISO", "Director IT"],
    intentTrend: "↗️ High",
    lastSignal: "3 days ago"
  }];
  const peopleResults = [{
    name: "Sarah Mitchell",
    title: "VP of Sales",
    company: "TechFlow Solutions",
    email: "✅ Verified",
    phone: "✅ Available",
    intentSignals: "High",
    lastActivity: "Active this week"
  }, {
    name: "James Rodriguez",
    title: "Head of Data Science",
    company: "DataStream Corp",
    email: "✅ Verified",
    phone: "⚠️ Partial",
    intentSignals: "Medium",
    lastActivity: "2 weeks ago"
  }, {
    name: "Emily Chen",
    title: "CISO",
    company: "CloudVault Systems",
    email: "✅ Verified",
    phone: "✅ Available",
    intentSignals: "High",
    lastActivity: "Active this week"
  }];
  return <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
          <Bot className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Prospecting</h2>
          <p className="text-gray-600">Agent-led conversation to find your ideal prospects</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Interface */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filter Chips */}
              {filters.length > 0 && <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                  {filters.map((filter, index) => <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {filter}
                      <Button size="icon" variant="ghost" className="h-4 w-4 hover:bg-red-100" onClick={() => removeFilter(index)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>)}
                </div>}

              {/* Messages */}
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {messages.map((message, index) => <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
                    {message.role === "scout" && <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-purple-100 text-purple-600">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>}
                    <div className={`rounded-lg p-3 max-w-xs ${message.role === "scout" ? "bg-blue-50 text-gray-800" : "bg-purple-600 text-white ml-auto"}`}>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>)}
              </div>

              {/* Quick Action Chips */}
              {filters.length < 4 && <div className="flex flex-wrap gap-2">
                  {quickActions.slice(filters.length, filters.length + 2).map((action, index) => <Button key={index} variant="outline" size="sm" onClick={() => {
                setFilters(prev => [...prev, action]);
                setMessages(prev => [...prev, {
                  role: "user",
                  content: action
                }, {
                  role: "scout",
                  content: "Great choice! What's next?"
                }]);
              }}>
                      {action}
                    </Button>)}
                </div>}

              {/* Input */}
              <div className="flex gap-2">
                <Input placeholder="Type your response..." value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => {
                if (e.key === 'Enter') handleSendMessage();
              }} />
                <Button onClick={handleSendMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Saved Searches */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Saved Searches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start text-sm">
                <Search className="h-4 w-4 mr-2" />
                SaaS Companies (US)
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm">
                <Search className="h-4 w-4 mr-2" />
                Healthcare IT Directors
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm">
                <Search className="h-4 w-4 mr-2" />
                Fintech Growth Stage
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Results Section */}
      {showResults && <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Prospect Results</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm">
                  <Save className="h-4 w-4 mr-1" />
                  Save to Workspace
                </Button>
                <Button variant="outline" size="sm">
                  <Share className="h-4 w-4 mr-1" />
                  Share
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="companies" className="w-full">
              <TabsList>
                <TabsTrigger value="companies">Companies ({companyResults.length})</TabsTrigger>
                <TabsTrigger value="people">People ({peopleResults.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="companies">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Key Roles</TableHead>
                      <TableHead>Intent Signals</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyResults.map((company, index) => <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="p-0 h-auto">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <span className="font-medium">{company.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{company.industry}</TableCell>
                        <TableCell>{company.location}</TableCell>
                        <TableCell>{company.size}</TableCell>
                        <TableCell>{company.revenue}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {company.keyRoles.map((role, i) => <Badge key={i} variant="outline" className="text-xs">
                                {role}
                              </Badge>)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="text-sm">{company.intentTrend}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline">
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                        </TableCell>
                      </TableRow>)}
                  </TableBody>
                </Table>
              </TabsContent>
              
              <TabsContent value="people">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Intent Signals</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {peopleResults.map((person, index) => <TableRow key={index}>
                        <TableCell className="font-medium">{person.name}</TableCell>
                        <TableCell>{person.title}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="p-0 h-auto">
                            {person.company}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-xs flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {person.email}
                            </span>
                            <span className="text-xs flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {person.phone}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={person.intentSignals === "High" ? "default" : "secondary"}>
                            {person.intentSignals}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {person.lastActivity}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline">
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                        </TableCell>
                      </TableRow>)}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>}
    </div>;
};
export default ProspectingSection;