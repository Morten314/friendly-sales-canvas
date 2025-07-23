import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart, PlusCircle, ArrowRight, Download, MessageSquare, Send } from "lucide-react";

const Reports = () => {
  usePageTitle("📊 Presenter - Brewra");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "ai", content: "Hello! I'm Presenter. How can I help with your demo preparation today?" }
  ]);
  const [inputValue, setInputValue] = useState("");

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    // Add user message
    setMessages([...messages, { role: "user", content: inputValue }]);
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(current => [...current, { 
        role: "ai", 
        content: "I can help prepare your demo. Would you like me to focus on slide content, talking points, or presentation structure?"
      }]);
    }, 1000);
    
    setInputValue("");
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        <div className="flex justify-end items-center mb-6">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => setIsChatOpen(!isChatOpen)}
            >
              <MessageSquare className="h-4 w-4" />
              Chat with Presenter
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Create New Demo
            </Button>
          </div>
        </div>
        
        {isChatOpen && (
          <Card className="border-blue-200 bg-blue-50/40 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-sales-blue" />
                Presenter Agent Chat
              </CardTitle>
              <CardDescription>
                Ask Presenter about demo preparation, slide content, or presentation strategies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-white rounded-md border border-gray-200 p-4 flex flex-col gap-3">
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {messages.map((message, index) => (
                    <div 
                      key={index}
                      className={`${
                        message.role === "ai" 
                          ? "bg-blue-50 rounded-lg p-3 self-start max-w-[80%]" 
                          : "bg-gray-100 rounded-lg p-3 self-end max-w-[80%] ml-auto"
                      }`}
                    >
                      <p className="text-sm font-medium">
                        {message.role === "ai" ? "Presenter" : "You"}
                      </p>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2 mt-2">
                  <Input
                    type="text" 
                    placeholder="Ask Presenter about demo preparation..."
                    className="flex-1"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendMessage();
                    }}
                  />
                  <Button 
                    className="bg-sales-blue hover:bg-blue-700 flex items-center gap-2"
                    onClick={handleSendMessage}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle>UK Fintech Ops Demo</CardTitle>
                <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full">
                  Ready
                </span>
              </div>
              <CardDescription>Created 2 days ago</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Target ICP:</span>
                  <span>UK Fintech Ops Director</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Duration:</span>
                  <span>25 minutes</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Focus:</span>
                  <span>Operational Efficiency</span>
                </div>
                <div className="pt-3 border-t flex space-x-2">
                  <Button variant="outline" className="flex-1 flex items-center justify-center gap-1">
                    <Download className="h-4 w-4" /> Slides
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
                <CardTitle>UK Fintech CTO Demo</CardTitle>
                <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full">
                  Draft
                </span>
              </div>
              <CardDescription>Created 1 day ago</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Target ICP:</span>
                  <span>UK Fintech CTO</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Duration:</span>
                  <span>30 minutes</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Focus:</span>
                  <span>Technical Integration</span>
                </div>
                <div className="pt-3 border-t flex space-x-2">
                  <Button variant="outline" className="flex-1 flex items-center justify-center gap-1">
                    <Download className="h-4 w-4" /> Slides
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
              <BarChart className="h-6 w-6" />
            </div>
            <h3 className="font-medium text-center mb-2">Create New Demo</h3>
            <p className="text-sm text-gray-500 text-center mb-4">
              Prepare for your next presentation
            </p>
            <Button variant="outline">Create Demo</Button>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>UK Fintech Ops Demo</CardTitle>
            <CardDescription>Demo script and talking points</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Demo Structure</h3>
                <ol className="space-y-4 pl-5 list-decimal">
                  <li>
                    <p className="font-medium">Introduction (3 min)</p>
                    <p className="text-sm text-gray-600">
                      "Thank you for joining today. We'll show you how Brewra can help fintech operations leaders like yourself enter new markets faster and with greater precision."
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">Market Research Capabilities (5 min)</p>
                    <p className="text-sm text-gray-600">
                      Focus on Scout's ability to analyze UK financial regulations and identify growth opportunities specific to their fintech vertical.
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">ICP Development (5 min)</p>
                    <p className="text-sm text-gray-600">
                      Demonstrate how Profiler builds accurate customer profiles for the UK market, highlighting the regulatory compliance pain points.
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">Operational Workflow (7 min)</p>
                    <p className="text-sm text-gray-600">
                      Show how Activator can automate lead generation while maintaining compliance with UK financial regulations.
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">Q&A and Next Steps (5 min)</p>
                    <p className="text-sm text-gray-600">
                      Address specific questions about implementation timeline and ROI for UK market entry.
                    </p>
                  </li>
                </ol>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Key Talking Points</h3>
                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="font-medium mb-1">Regulatory Compliance</p>
                    <p className="text-sm">
                      "Our platform reduces compliance overhead by 40% through automated market research and regulatory tracking specific to UK fintech operations."
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="font-medium mb-1">Operational Efficiency</p>
                    <p className="text-sm">
                      "Clients like yours have seen a 30% reduction in time-to-market when expanding to the UK, with 65% less resources required for market analysis."
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="font-medium mb-1">ROI Metrics</p>
                    <p className="text-sm">
                      "On average, our fintech clients see positive ROI within 3 months of UK market entry, with customer acquisition costs reduced by 35%."
                    </p>
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

export default Reports;
