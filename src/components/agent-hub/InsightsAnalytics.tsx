
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";

// Sample data for different metrics
const demoCallsEmailData = [
  { month: 'Jan', count: 15 },
  { month: 'Feb', count: 18 },
  { month: 'Mar', count: 22 },
  { month: 'Apr', count: 19 },
  { month: 'May', count: 25 },
  { month: 'Jun', count: 28 },
  { month: 'Jul', count: 30 },
];

const demoCallsLinkedInData = [
  { month: 'Jan', count: 10 },
  { month: 'Feb', count: 12 },
  { month: 'Mar', count: 18 },
  { month: 'Apr', count: 15 },
  { month: 'May', count: 22 },
  { month: 'Jun', count: 24 },
  { month: 'Jul', count: 26 },
];

const meetingsDoneData = [
  { month: 'Jan', count: 20 },
  { month: 'Feb', count: 15 },
  { month: 'Mar', count: 25 },
  { month: 'Apr', count: 22 },
  { month: 'May', count: 30 },
  { month: 'Jun', count: 27 },
  { month: 'Jul', count: 32 },
];

const dealsClosedData = [
  { month: 'Jan', count: 5 },
  { month: 'Feb', count: 3 },
  { month: 'Mar', count: 7 },
  { month: 'Apr', count: 6 },
  { month: 'May', count: 9 },
  { month: 'Jun', count: 8 },
  { month: 'Jul', count: 11 },
];

export function InsightsAnalytics() {
  const [metric, setMetric] = useState('meetingsDone');
  const [date, setDate] = React.useState<Date>();
  const [timeRange, setTimeRange] = useState('7');

  const getChartTitle = () => {
    switch(metric) {
      case 'demoCallsEmail':
        return 'Demo Calls via Email';
      case 'demoCallsLinkedIn':
        return 'Demo Calls via LinkedIn';
      case 'meetingsDone':
        return 'Meetings Done';
      case 'dealsClosed':
        return 'Deals Closed';
      default:
        return 'Meetings Done';
    }
  };

  const getChartData = () => {
    switch(metric) {
      case 'demoCallsEmail':
        return demoCallsEmailData;
      case 'demoCallsLinkedIn':
        return demoCallsLinkedInData;
      case 'meetingsDone':
        return meetingsDoneData;
      case 'dealsClosed':
        return dealsClosedData;
      default:
        return meetingsDoneData;
    }
  };

  const getTimeRangeLabel = () => {
    switch(timeRange) {
      case '7':
        return 'Last 7 Days';
      case '15':
        return 'Last 15 Days';
      case '30':
        return 'Last 30 Days';
      case '60':
        return 'Last 60 Days';
      default:
        return 'Last 7 Days';
    }
  };

  return (
    <Card className="h-full">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Select value={metric} onValueChange={setMetric}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="demoCallsEmail">Demo Calls via Email</SelectItem>
                <SelectItem value="demoCallsLinkedIn">Demo Calls via LinkedIn</SelectItem>
                <SelectItem value="meetingsDone">Meetings Done</SelectItem>
                <SelectItem value="dealsClosed">Deals Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="15">Last 15 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="60">Last 60 Days</SelectItem>
              </SelectContent>
            </Select>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs flex gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{date ? format(date, "MMM yyyy") : "May 2023"}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={getChartData()} 
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#4F46E5" 
                strokeWidth={2} 
                dot={{ r: 4, fill: "#4F46E5" }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
