
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

const salesData = [
  { month: 'Jan', count: 20 },
  { month: 'Feb', count: 15 },
  { month: 'Mar', count: 25 },
  { month: 'Apr', count: 22 },
  { month: 'May', count: 30 },
  { month: 'Jun', count: 27 },
  { month: 'Jul', count: 32 },
];

export function InsightsAnalytics() {
  const [metric, setMetric] = useState('salesCalls');
  const [date, setDate] = React.useState<Date>();

  const getChartTitle = () => {
    switch(metric) {
      case 'salesCalls':
        return 'Sales Calls (Q2)';
      default:
        return 'Sales Calls (Q2)';
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{getChartTitle()}</CardTitle>
          
          <div className="flex items-center gap-2">
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
      </CardHeader>
      <CardContent className="h-[200px] pt-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={salesData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
      </CardContent>
    </Card>
  );
}
