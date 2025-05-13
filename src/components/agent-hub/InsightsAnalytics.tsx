
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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

const demoCallsEmailData = [
  { day: 'Mon', count: 4 },
  { day: 'Tue', count: 5 },
  { day: 'Wed', count: 7 },
  { day: 'Thu', count: 3 },
  { day: 'Fri', count: 6 },
  { day: 'Sat', count: 2 },
  { day: 'Sun', count: 1 },
];

const demoCallsLinkedInData = [
  { day: 'Mon', count: 3 },
  { day: 'Tue', count: 6 },
  { day: 'Wed', count: 4 },
  { day: 'Thu', count: 7 },
  { day: 'Fri', count: 5 },
  { day: 'Sat', count: 1 },
  { day: 'Sun', count: 2 },
];

const meetingsData = [
  { day: 'Mon', count: 8 },
  { day: 'Tue', count: 10 },
  { day: 'Wed', count: 12 },
  { day: 'Thu', count: 9 },
  { day: 'Fri', count: 11 },
  { day: 'Sat', count: 4 },
  { day: 'Sun', count: 3 },
];

const dealsClosedData = [
  { day: 'Mon', count: 1 },
  { day: 'Tue', count: 0 },
  { day: 'Wed', count: 2 },
  { day: 'Thu', count: 1 },
  { day: 'Fri', count: 3 },
  { day: 'Sat', count: 0 },
  { day: 'Sun', count: 0 },
];

export function InsightsAnalytics() {
  const [metric, setMetric] = useState('demoCallsEmail');
  const [timeframe, setTimeframe] = useState('7');
  const [date, setDate] = React.useState<Date>();

  const getDataForMetric = () => {
    switch(metric) {
      case 'demoCallsEmail':
        return demoCallsEmailData;
      case 'demoCallsLinkedIn':
        return demoCallsLinkedInData;
      case 'meetings':
        return meetingsData;
      case 'dealsClosedData':
        return dealsClosedData;
      default:
        return demoCallsEmailData;
    }
  };

  const getChartTitle = () => {
    switch(metric) {
      case 'demoCallsEmail':
        return 'Demo Calls via Email';
      case 'demoCallsLinkedIn':
        return 'Demo Calls via LinkedIn';
      case 'meetings':
        return 'Meetings Done';
      case 'dealsClosedData':
        return 'Deals Closed';
      default:
        return 'Demo Calls via Email';
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle>Insights & Analytics</CardTitle>
          
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
            
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Time period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="15">Last 15 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[150px] flex justify-between items-center">
                  {date ? format(date, "PPP") : "Pick a date"}
                  <Calendar className="h-4 w-4 ml-2" />
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
        <CardDescription>Performance metrics for selected period</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] pt-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={getDataForMetric()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" name={getChartTitle()} fill="#1EAEDB" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
