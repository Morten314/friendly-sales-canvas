
import React, { useState } from 'react';
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, CalendarIcon, BarChart, LineChart, MessageSquare, Send } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  BarChart as ReBarChart, 
  Bar, 
  LineChart as ReLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

const AgentHub = () => {
  const [timeframe, setTimeframe] = useState('7');
  const [metric, setMetric] = useState('demoCallsEmail');
  const [date, setDate] = useState<Date>();
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Data for Today's Focus cards
  const taskItems = [
    { 
      title: "Leads to follow-up", 
      count: 12, 
      color: "bg-blue-100 border-blue-500 text-blue-700",
      icon: "📞"
    },
    { 
      title: "Discovery calls", 
      count: 5, 
      color: "bg-purple-100 border-purple-500 text-purple-700",
      icon: "🔍"
    },
    { 
      title: "Demo calls", 
      count: 3, 
      color: "bg-green-100 border-green-500 text-green-700",
      icon: "💻"
    },
    { 
      title: "Negotiation calls", 
      count: 2, 
      color: "bg-amber-100 border-amber-500 text-amber-700",
      icon: "🤝"
    }
  ];

  // Pipeline data
  const pipelineData = {
    '7': [
      { name: 'Leads prospected', count: 85, conversionRate: 0, color: 'bg-blue-500' },
      { name: 'Leads qualified', count: 42, conversionRate: 49, color: 'bg-blue-400' },
      { name: 'Soft connect', count: 28, conversionRate: 67, color: 'bg-cyan-400' },
      { name: 'POC connected', count: 18, conversionRate: 64, color: 'bg-teal-400' },
      { name: 'Discovery call', count: 12, conversionRate: 67, color: 'bg-green-400' },
      { name: 'Demo call', count: 8, conversionRate: 67, color: 'bg-green-500' },
    ],
    '15': [
      { name: 'Leads prospected', count: 162, conversionRate: 0, color: 'bg-blue-500' },
      { name: 'Leads qualified', count: 78, conversionRate: 48, color: 'bg-blue-400' },
      { name: 'Soft connect', count: 51, conversionRate: 65, color: 'bg-cyan-400' },
      { name: 'POC connected', count: 34, conversionRate: 67, color: 'bg-teal-400' },
      { name: 'Discovery call', count: 24, conversionRate: 71, color: 'bg-green-400' },
      { name: 'Demo call', count: 18, conversionRate: 75, color: 'bg-green-500' },
    ],
    '30': [
      { name: 'Leads prospected', count: 320, conversionRate: 0, color: 'bg-blue-500' },
      { name: 'Leads qualified', count: 155, conversionRate: 48, color: 'bg-blue-400' },
      { name: 'Soft connect', count: 98, conversionRate: 63, color: 'bg-cyan-400' },
      { name: 'POC connected', count: 64, conversionRate: 65, color: 'bg-teal-400' },
      { name: 'Discovery call', count: 43, conversionRate: 67, color: 'bg-green-400' },
      { name: 'Demo call', count: 31, conversionRate: 72, color: 'bg-green-500' },
    ],
    '60': [
      { name: 'Leads prospected', count: 560, conversionRate: 0, color: 'bg-blue-500' },
      { name: 'Leads qualified', count: 265, conversionRate: 47, color: 'bg-blue-400' },
      { name: 'Soft connect', count: 175, conversionRate: 66, color: 'bg-cyan-400' },
      { name: 'POC connected', count: 110, conversionRate: 63, color: 'bg-teal-400' },
      { name: 'Discovery call', count: 78, conversionRate: 71, color: 'bg-green-400' },
      { name: 'Demo call', count: 52, conversionRate: 67, color: 'bg-green-500' },
    ],
  };

  // Analytics data
  const analyticsData = [
    { month: 'Jan', value: 10 },
    { month: 'Feb', value: 15 },
    { month: 'Mar', value: 12 },
    { month: 'Apr', value: 18 },
    { month: 'May', value: 25 },
    { month: 'Jun', value: 22 },
    { month: 'Jul', value: 28 },
  ];

  const agents = [
    {
      name: "Scout",
      tagline: "I sniff signals before anyone else does.",
      icon: "🔍",
      color: "bg-blue-100 text-blue-600",
    },
    {
      name: "Profiler",
      tagline: "I study people, so you know who to chase.",
      icon: "👤",
      color: "bg-purple-100 text-purple-600",
    },
    {
      name: "Strategist",
      tagline: "I craft the perfect GTM game plan.",
      icon: "🧠",
      color: "bg-green-100 text-green-600",
    },
    {
      name: "Playmaker",
      tagline: "I design plays that sellers can win with.",
      icon: "🎮",
      color: "bg-amber-100 text-amber-600",
    },
    {
      name: "Activator",
      tagline: "I set things in motion—campaigns, cadences, and connections.",
      icon: "⚡",
      color: "bg-red-100 text-red-600",
    },
    {
      name: "Presenter",
      tagline: "I turn insights into killer decks and talking points.",
      icon: "📊",
      color: "bg-teal-100 text-teal-600",
    },
  ];

  const quickPrompts = [
    "Show me deals that are stuck in negotiation",
    "Summarize yesterday's demo with Acme Corp"
  ];

  const handleSubmit = () => {
    if (!query.trim()) return;
    
    setIsProcessing(true);
    
    setTimeout(() => {
      setIsProcessing(false);
      toast({
        title: "Brewra AI Response",
        description: "Check your notifications for the response to your query.",
      });
      setQuery('');
    }, 1500);
  };
  
  const handleQuickPrompt = (prompt: string) => {
    setQuery(prompt);
  };

  const currentPipelineData = pipelineData[timeframe as keyof typeof pipelineData];

  return (
    <Layout>
      <div className="animate-fade-in space-y-6">
        {/* Section 1: Today's Focus */}
        <div>
          <h2 className="text-xl font-bold mb-3">Today's Focus</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {taskItems.map((item, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-transparent hover:scale-[1.01] transition-transform">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl p-2 rounded-lg ${item.color}`}>
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="font-medium">{item.title}</h3>
                      <Badge className={item.color}>{item.count}</Badge>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        
        {/* Section 2: Pipeline Snapshot */}
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Pipeline Snapshot</h2>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Time period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="15">15 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={currentPipelineData} layout="vertical" barCategoryGap={8}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip 
                    formatter={(value, name) => [`${value} deals`, '']}
                    labelFormatter={(value) => `Stage: ${value}`}
                  />
                  <Bar 
                    dataKey="count" 
                    name="Deals" 
                    fill="#4299E1" 
                    radius={[0, 4, 4, 0]}
                    label={{ position: 'insideRight', fill: '#fff', fontSize: 12 }}
                  >
                    {currentPipelineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color.replace('bg-', 'var(--color-')} />
                    ))}
                  </Bar>
                </ReBarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4">
              {currentPipelineData.map((stage, index) => (
                <div key={index} className="text-center">
                  <div className={`h-2 w-full ${stage.color} rounded-sm mb-1`}></div>
                  <div className="text-xs font-medium">{stage.name}</div>
                  {stage.conversionRate > 0 && (
                    <div className="text-xs text-gray-500">{stage.conversionRate}% conv.</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Section 3: Insights / Analytics */}
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xl font-bold">Sales Analytics</h2>
              
              <div className="flex items-center gap-2">
                <Select value={metric} onValueChange={setMetric}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select metric" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="demoCallsEmail">Demo Calls via Email</SelectItem>
                    <SelectItem value="demoCallsLinkedIn">Demo Calls via LinkedIn</SelectItem>
                    <SelectItem value="meetings">Meetings Done</SelectItem>
                    <SelectItem value="dealsClosedData">Deals Closed</SelectItem>
                  </SelectContent>
                </Select>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      {date ? format(date, "MMM yyyy") : "Select date"}
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={analyticsData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#4299E1" 
                    strokeWidth={2} 
                    dot={{ r: 4 }} 
                    activeDot={{ r: 6, stroke: "#3182CE", strokeWidth: 2, fill: "#FFFFFF" }}
                  />
                </ReLineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        {/* Section 4: Agentic AI Assist - Meet Your Agents */}
        <div>
          <h2 className="text-xl font-bold mb-3">Agentic AI Assist</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent, index) => (
              <Card key={index} className="hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-3 rounded-lg ${agent.color} text-xl`}>
                      {agent.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{agent.name}</h3>
                      <p className="text-sm text-gray-600 italic mt-1">"{agent.tagline}"</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        
        {/* Section 5: Ask Brewra Agentic AI */}
        <Card className="bg-slate-900 text-white overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-400" />
              <CardTitle>Ask Brewra AI</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="flex items-center justify-center mb-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <p className="text-sm">How can I help you today?</p>
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Ask me anything about your sales data..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-slate-800 border-slate-700 text-white"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <Button onClick={handleSubmit} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700">
                {isProcessing ? (
                  <div className="flex items-center">
                    <div className="animate-spin h-4 w-4 border-2 border-b-transparent border-white rounded-full mr-2"></div>
                    <span>Thinking...</span>
                  </div>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt, index) => (
                <Button 
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                  onClick={() => handleQuickPrompt(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </CardContent>
          <CardFooter className="bg-slate-800 text-xs text-slate-400 p-2 text-center border-t border-slate-700">
            Brewra AI uses your historical data to provide insights and assistance
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
};

export default AgentHub;
