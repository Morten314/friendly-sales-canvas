
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Send, Building, Users, MapPin, Briefcase, Search, Download, Save, Share, TrendingUp, ExternalLink, Phone, Mail, X, Eye } from "lucide-react";
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
    content: `Hi ${userName} 👋, I'm your Profiler Assistant. Let's build your perfect prospect list. Would you like to explore companies or individual contacts first?`
  }]);
  const [inputValue, setInputValue] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [currentStep, setCurrentStep] = useState("choice");
  const [searchType, setSearchType] = useState<"companies" | "people" | null>(null);
  const [selectedFilters, setSelectedFilters] = useState({
    companySize: "",
    location: "",
    industry: "",
    jobFunction: "",
    keywords: ""
  });

  const companySizes = ["10-50", "51-100", "101-200", "201-500", "501-1000", "1000+"];
  const locations = ["United States", "United Kingdom", "Canada", "Germany", "France", "Australia"];
  const industries = ["Technology", "Healthcare", "Finance", "Manufacturing", "Retail", "Education"];
  const jobFunctions = ["Sales", "Marketing", "Operations", "Engineering", "HR", "Finance"];

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    setMessages(prev => [...prev, {
      role: "user",
      content: inputValue
    }]);

    // Handle initial choice
    if (currentStep === "choice") {
      const input = inputValue.toLowerCase();
      if (input.includes("companies") || input.includes("company")) {
        setSearchType("companies");
        setCurrentStep("companySize");
        setTimeout(() => {
          setMessages(prev => [...prev, {
            role: "scout",
            content: "Great! Let's start with company size. What size companies are you targeting?"
          }]);
        }, 1000);
      } else if (input.includes("people") || input.includes("contacts") || input.includes("individual")) {
        setSearchType("people");
        setCurrentStep("jobFunction");
        setTimeout(() => {
          setMessages(prev => [...prev, {
            role: "scout",
            content: "Perfect! What job function or title are you looking for?"
          }]);
        }, 1000);
      } else {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            role: "scout",
            content: "Please choose either 'companies' or 'people' to get started!"
          }]);
        }, 1000);
      }
    } else {
      // Add filter and continue flow
      setFilters(prev => [...prev, inputValue]);
      handleNextStep();
    }

    setInputValue("");
  };

  const handleNextStep = () => {
    setTimeout(() => {
      let scoutResponse = "";
      if (searchType === "companies") {
        if (currentStep === "companySize") {
          scoutResponse = "Perfect! Now, which regions should we focus on?";
          setCurrentStep("location");
        } else if (currentStep === "location") {
          scoutResponse = "Great choice! What industry are you targeting?";
          setCurrentStep("industry");
        } else if (currentStep === "industry") {
          scoutResponse = "Excellent! Any specific keywords or technologies to focus on? (Optional - you can skip this)";
          setCurrentStep("keywords");
        } else {
          scoutResponse = "Perfect! Let me search for companies matching your criteria...";
          setTimeout(() => setShowResults(true), 2000);
        }
      } else if (searchType === "people") {
        if (currentStep === "jobFunction") {
          scoutResponse = "Great! Which locations should we target?";
          setCurrentStep("location");
        } else if (currentStep === "location") {
          scoutResponse = "Perfect! What company size are you interested in?";
          setCurrentStep("companySize");
        } else if (currentStep === "companySize") {
          scoutResponse = "Excellent! Which industry should we focus on?";
          setCurrentStep("industry");
        } else if (currentStep === "industry") {
          scoutResponse = "Great! Any specific keywords or skills to focus on? (Optional)";
          setCurrentStep("keywords");
        } else {
          scoutResponse = "Perfect! Let me find people matching your criteria...";
          setTimeout(() => setShowResults(true), 2000);
        }
      }
      
      setMessages(prev => [...prev, {
        role: "scout",
        content: scoutResponse
      }]);
    }, 1000);
  };

  const handleFilterClick = (filter: string, type: string) => {
    setSelectedFilters(prev => ({ ...prev, [type]: filter }));
    setFilters(prev => [...prev, filter]);
    setMessages(prev => [...prev, {
      role: "user",
      content: filter
    }]);
    handleNextStep();
  };

  const removeFilter = (index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  };

  const getFilterOptions = () => {
    if (currentStep === "companySize") return companySizes;
    if (currentStep === "location") return locations;
    if (currentStep === "industry") return industries;
    if (currentStep === "jobFunction") return jobFunctions;
    return [];
  };

  const getFilterType = () => {
    if (currentStep === "companySize") return "companySize";
    if (currentStep === "location") return "location";
    if (currentStep === "industry") return "industry";
    if (currentStep === "jobFunction") return "jobFunction";
    return "";
  };

  // Enhanced sample results data
  const companyResults = [{
    name: "TechFlow Solutions",
    industry: "SaaS",
    location: "🇺🇸 San Francisco, CA",
    size: "250-500",
    revenue: "$10M-50M",
    linkedinUrl: "https://linkedin.com/company/techflow-solutions",
    intentSignals: "High",
    painPoints: ["Data security", "Scalability"],
    lastActivity: "2 days ago"
  }, {
    name: "DataStream Corp",
    industry: "Analytics",
    location: "🇺🇸 Austin, TX",
    size: "100-250",
    revenue: "$5M-25M",
    linkedinUrl: "https://linkedin.com/company/datastream-corp",
    intentSignals: "Medium",
    painPoints: ["Integration", "Cost optimization"],
    lastActivity: "1 week ago"
  }, {
    name: "CloudVault Systems",
    industry: "Cybersecurity",
    location: "🇺🇸 Boston, MA",
    size: "300-500",
    revenue: "$25M-100M",
    linkedinUrl: "https://linkedin.com/company/cloudvault-systems",
    intentSignals: "High",
    painPoints: ["Compliance", "Legacy systems"],
    lastActivity: "3 days ago"
  }];

  const peopleResults = [{
    name: "Sarah Mitchell",
    title: "VP of Sales",
    company: "TechFlow Solutions",
    industry: "SaaS",
    location: "San Francisco, CA",
    companySize: "250-500",
    linkedinUrl: "https://linkedin.com/in/sarah-mitchell",
    companyLinkedinUrl: "https://linkedin.com/company/techflow-solutions",
    intentSignals: "High",
    painPoints: ["Lead generation", "Sales automation"],
    lastActivity: "Active this week"
  }, {
    name: "James Rodriguez",
    title: "Head of Data Science",
    company: "DataStream Corp",
    industry: "Analytics",
    location: "Austin, TX",
    companySize: "100-250",
    linkedinUrl: "https://linkedin.com/in/james-rodriguez",
    companyLinkedinUrl: "https://linkedin.com/company/datastream-corp",
    intentSignals: "Medium",
    painPoints: ["Data integration", "Tool consolidation"],
    lastActivity: "2 weeks ago"
  }, {
    name: "Emily Chen",
    title: "CISO",
    company: "CloudVault Systems",
    industry: "Cybersecurity",
    location: "Boston, MA",
    companySize: "300-500",
    linkedinUrl: "https://linkedin.com/in/emily-chen",
    companyLinkedinUrl: "https://linkedin.com/company/cloudvault-systems",
    intentSignals: "High",
    painPoints: ["Compliance", "Security automation"],
    lastActivity: "Active this week"
  }];

  return (
    <div className="space-y-6">
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
            <CardContent className="space-y-4 p-6">
              {/* Filter Chips */}
              {filters.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mr-2">Filters:</div>
                  {filters.map((filter, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {filter}
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-4 w-4 hover:bg-red-100" 
                        onClick={() => removeFilter(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {messages.map((message, index) => (
                  <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
                    {message.role === "scout" && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-purple-100 text-purple-600">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`rounded-lg p-3 max-w-xs ${
                      message.role === "scout" 
                        ? "bg-blue-50 text-gray-800" 
                        : "bg-purple-600 text-white ml-auto"
                    }`}>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Filter Selection Buttons */}
              {currentStep !== "choice" && currentStep !== "keywords" && getFilterOptions().length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Quick select:</p>
                  <div className="flex flex-wrap gap-2">
                    {getFilterOptions().map((option, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleFilterClick(option, getFilterType())}
                        className="hover:bg-purple-50 hover:border-purple-200"
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  placeholder={currentStep === "choice" ? "Type 'companies' or 'people'..." : "Type your response or use quick select above..."}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                />
                <Button onClick={handleSendMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {/* Skip option for optional fields */}
              {currentStep === "keywords" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMessages(prev => [...prev, {
                      role: "user",
                      content: "Skip keywords"
                    }]);
                    setTimeout(() => setShowResults(true), 1000);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Skip this step
                </Button>
              )}
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

      {/* Enhanced Results Section */}
      {showResults && (
        <Card>
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
                  Save Search
                </Button>
                <Button variant="outline" size="sm">
                  <Share className="h-4 w-4 mr-1" />
                  Share
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={searchType || "companies"} className="w-full">
              <TabsList>
                <TabsTrigger value="companies">
                  Companies ({companyResults.length})
                </TabsTrigger>
                <TabsTrigger value="people">
                  People ({peopleResults.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="companies">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Company Size</TableHead>
                      <TableHead>LinkedIn</TableHead>
                      <TableHead>Intent Signals</TableHead>
                      <TableHead>Pain Points</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyResults.map((company, index) => (
                      <TableRow key={index} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell>{company.industry}</TableCell>
                        <TableCell>{company.location}</TableCell>
                        <TableCell>{company.size}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(company.linkedinUrl, '_blank')}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Badge variant={company.intentSignals === "High" ? "default" : "secondary"}>
                            {company.intentSignals}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {company.painPoints.map((point, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {point}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {company.lastActivity}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline">
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            <Button size="sm" variant="outline">
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              
              <TabsContent value="people">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Company Size</TableHead>
                      <TableHead>LinkedIn Profile</TableHead>
                      <TableHead>Company LinkedIn</TableHead>
                      <TableHead>Intent Signals</TableHead>
                      <TableHead>Pain Points</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {peopleResults.map((person, index) => (
                      <TableRow key={index} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{person.name}</TableCell>
                        <TableCell>{person.title}</TableCell>
                        <TableCell>{person.company}</TableCell>
                        <TableCell>{person.industry}</TableCell>
                        <TableCell>{person.location}</TableCell>
                        <TableCell>{person.companySize}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(person.linkedinUrl, '_blank')}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(person.companyLinkedinUrl, '_blank')}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Badge variant={person.intentSignals === "High" ? "default" : "secondary"}>
                            {person.intentSignals}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {person.painPoints.map((point, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {point}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {person.lastActivity}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline">
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            <Button size="sm" variant="outline">
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProspectingSection;
