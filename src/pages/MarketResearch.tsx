
import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, MessageSquare, Send } from "lucide-react";

const MarketResearch = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "ai", content: "Hello! I'm Scout. How can I help with your market research today?" }
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
        content: "I can analyze this market for you. Would you like me to focus on market size, competitor landscape, or growth potential?"
      }]);
    }, 1000);
    
    setInputValue("");
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
              <Search className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Market Research (Scout)</h1>
              <p className="text-gray-500">Find the best markets before your competitors do</p>
              <div className="flex gap-2 mt-2">
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">
                  Market Intelligence
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  Market analysis
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  Trend spotting
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => setIsChatOpen(!isChatOpen)}
            >
              <MessageSquare className="h-4 w-4" />
              Chat with Scout
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
              <Search className="h-4 w-4" />
              New Research
            </Button>
          </div>
        </div>

        {isChatOpen && (
          <Card className="border-blue-200 bg-blue-50/40 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-sales-blue" />
                Scout Agent Chat
              </CardTitle>
              <CardDescription>
                Ask Scout about markets, competitor analysis or request new research
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
                        {message.role === "ai" ? "Scout" : "You"}
                      </p>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2 mt-2">
                  <Input
                    type="text" 
                    placeholder="Ask Scout about market opportunities..."
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
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Market Research</CardTitle>
              <CardDescription>Access your previous market analyses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-md p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium">UK Fintech Market Analysis</h3>
                      <p className="text-sm text-gray-500">Completed 2 days ago</p>
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full">
                      Completed
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">Analysis of 5 fintech submarkets with TAM calculation and competitor landscape.</p>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Market Score: 87/100</span>
                    <Button variant="ghost" size="sm" className="text-sales-blue flex items-center gap-1">
                      View Results <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="border rounded-md p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium">Germany Healthtech Expansion</h3>
                      <p className="text-sm text-gray-500">Completed 1 week ago</p>
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full">
                      Completed
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">Overview of German healthtech market opportunities and regulatory landscape.</p>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Market Score: 72/100</span>
                    <Button variant="ghost" size="sm" className="text-sales-blue flex items-center gap-1">
                      View Results <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scout Capabilities</CardTitle>
              <CardDescription>What this agent can do for you</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <span className="text-sm">Market size estimation & TAM analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <span className="text-sm">Competitor research & positioning</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <span className="text-sm">Industry trends & growth forecasts</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                    4
                  </div>
                  <span className="text-sm">Regulatory & compliance landscape</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                    5
                  </div>
                  <span className="text-sm">Market entry barriers analysis</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Market Rankings</CardTitle>
            <CardDescription>Comparative analysis of potential markets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">Market</th>
                    <th className="px-4 py-2 text-left">Score</th>
                    <th className="px-4 py-2 text-left">Size (TAM)</th>
                    <th className="px-4 py-2 text-left">Competition</th>
                    <th className="px-4 py-2 text-left">Barriers</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="px-4 py-3">UK Fintech</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">87/100</span>
                    </td>
                    <td className="px-4 py-3">$24.5B</td>
                    <td className="px-4 py-3">Medium</td>
                    <td className="px-4 py-3">Low</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" className="text-sales-blue">
                        View Details
                      </Button>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Germany Healthtech</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">72/100</span>
                    </td>
                    <td className="px-4 py-3">$18.2B</td>
                    <td className="px-4 py-3">High</td>
                    <td className="px-4 py-3">Medium</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" className="text-sales-blue">
                        View Details
                      </Button>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">France SaaS</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">65/100</span>
                    </td>
                    <td className="px-4 py-3">$12.8B</td>
                    <td className="px-4 py-3">Medium</td>
                    <td className="px-4 py-3">Medium</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" className="text-sales-blue">
                        View Details
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default MarketResearch;
