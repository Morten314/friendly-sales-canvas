
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { 
  Bot, 
  Building, 
  Mail, 
  Phone, 
  MapPin, 
  Users, 
  DollarSign,
  TrendingUp,
  Download,
  Save,
  Share,
  ExternalLink,
  Send,
  Lightbulb
} from "lucide-react";
import { Input } from "@/components/ui/input";
import MiniLineChart from "@/components/ui/MiniLineChart";

interface DataEnrichmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName?: string;
}

const DataEnrichmentModal = ({ 
  isOpen, 
  onClose, 
  companyName = "TechFlow Solutions" 
}: DataEnrichmentModalProps) => {
  const [chatInput, setChatInput] = useState("");
  const [scoutMessages, setScoutMessages] = useState([
    {
      role: "scout",
      content: "I've enriched this company profile. Would you like to find lookalikes based on this profile? I can also help you identify key decision makers."
    }
  ]);

  // Sample enriched data
  const enrichedData = {
    company: {
      name: "TechFlow Solutions",
      industry: "SaaS - Marketing Analytics",
      website: "techflow.com",
      employees: "250-500",
      revenue: "$25M-50M",
      founded: "2018",
      location: "San Francisco, CA",
      description: "Leading provider of marketing analytics and customer intelligence solutions for B2B companies."
    },
    contacts: [
      {
        name: "Sarah Mitchell",
        title: "VP of Sales",
        email: "s.mitchell@techflow.com",
        phone: "+1 (555) 123-4567",
        linkedin: "linkedin.com/in/sarahmitchell"
      },
      {
        name: "David Chen",
        title: "CTO",
        email: "d.chen@techflow.com",
        phone: "+1 (555) 123-4568",
        linkedin: "linkedin.com/in/davidchen"
      }
    ],
    insights: {
      painPoints: [
        "Scaling customer acquisition",
        "Data integration challenges",
        "Competitive differentiation"
      ],
      recentNews: [
        "Series B funding round completed",
        "New product launch announced",
        "Expanded to European market"
      ],
      technologies: ["Salesforce", "HubSpot", "AWS", "React", "Python"]
    },
    trends: [
      { name: "Jan", value: 65 },
      { name: "Feb", value: 72 },
      { name: "Mar", value: 68 },
      { name: "Apr", value: 78 },
      { name: "May", value: 85 },
      { name: "Jun", value: 82 }
    ]
  };

  const handleSendScoutMessage = () => {
    if (!chatInput.trim()) return;
    
    setScoutMessages(prev => [...prev, 
      { role: "user", content: chatInput },
      { 
        role: "scout", 
        content: "Great question! Based on this company profile, I can help you create targeted outreach or find similar companies. What would you like to focus on?" 
      }
    ]);
    setChatInput("");
  };

  const quickSuggestions = [
    "Find similar companies",
    "Identify decision makers",
    "Create outreach sequence",
    "Export contact data"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Enrichment Results
          </DialogTitle>
          <p className="text-sm text-gray-600">
            Here's what we found about {companyName}
          </p>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(90vh-120px)] overflow-hidden">
          {/* Left Column - Enriched Data */}
          <div className="lg:col-span-2 space-y-4 overflow-y-auto">
            {/* Company Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-600" />
                  Company Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">{enrichedData.company.name}</h3>
                    <p className="text-gray-600">{enrichedData.company.industry}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <ExternalLink className="h-4 w-4 text-blue-600" />
                      <a href="#" className="text-blue-600 hover:underline">
                        {enrichedData.company.website}
                      </a>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <span>{enrichedData.company.employees} employees</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      <span>{enrichedData.company.revenue} revenue</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span>{enrichedData.company.location}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-700">{enrichedData.company.description}</p>
              </CardContent>
            </Card>

            {/* Key Contacts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  Key Contacts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {enrichedData.contacts.map((contact, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{contact.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-medium">{contact.name}</h4>
                          <p className="text-sm text-gray-600">{contact.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline">
                          <Mail className="h-3 w-3 mr-1" />
                          Email
                        </Button>
                        <Button size="sm" variant="outline">
                          <Phone className="h-3 w-3 mr-1" />
                          Call
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Insights & Trends */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-600" />
                    Key Pain Points
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {enrichedData.insights.painPoints.map((point, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {point}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    Growth Trend (6M)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MiniLineChart 
                    data={enrichedData.trends}
                    title=""
                    color="#8b5cf6"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Technology Stack */}
            <Card>
              <CardHeader>
                <CardTitle>Technology Stack</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {enrichedData.insights.technologies.map((tech, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Scout Chat */}
          <div className="space-y-4 flex flex-col h-full">
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-purple-600" />
                  Scout Assistant
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* Messages */}
                <div className="flex-1 space-y-3 overflow-y-auto mb-4">
                  {scoutMessages.map((message, index) => (
                    <div 
                      key={index}
                      className={`flex gap-2 ${message.role === "user" ? "justify-end" : ""}`}
                    >
                      {message.role === "scout" && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-purple-100 text-purple-600">
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`rounded-lg p-3 max-w-[85%] ${
                        message.role === "scout" 
                          ? "bg-blue-50 text-gray-800" 
                          : "bg-purple-600 text-white"
                      }`}>
                        <p className="text-sm">{message.content}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Suggestions */}
                <div className="space-y-2 mb-4">
                  {quickSuggestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => {
                        setChatInput(suggestion);
                        handleSendScoutMessage();
                      }}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <Input 
                    placeholder="Ask Scout anything..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendScoutMessage();
                    }}
                    className="text-sm"
                  />
                  <Button size="sm" onClick={handleSendScoutMessage}>
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex gap-2">
            <Button variant="outline">
              <Save className="h-4 w-4 mr-1" />
              Save to Workspace
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-1" />
              Export PDF
            </Button>
            <Button variant="outline">
              <Share className="h-4 w-4 mr-1" />
              Download CSV
            </Button>
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DataEnrichmentModal;
