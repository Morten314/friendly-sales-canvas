
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PipelineStage = {
  name: string;
  count: number;
  conversionRate: number;
  color: string;
}

const pipelineData = {
  '7': [
    { name: 'Leads prospected', count: 85, conversionRate: 0, color: 'bg-blue-400' },
    { name: 'Leads qualified', count: 42, conversionRate: 49, color: 'bg-blue-500' },
    { name: 'Soft connect', count: 28, conversionRate: 67, color: 'bg-blue-600' },
    { name: 'POC connected', count: 18, conversionRate: 64, color: 'bg-blue-700' },
    { name: 'Discovery call', count: 12, conversionRate: 67, color: 'bg-blue-800' },
    { name: 'Demo call', count: 8, conversionRate: 67, color: 'bg-blue-900' },
  ],
  '15': [
    { name: 'Leads prospected', count: 162, conversionRate: 0, color: 'bg-blue-400' },
    { name: 'Leads qualified', count: 78, conversionRate: 48, color: 'bg-blue-500' },
    { name: 'Soft connect', count: 51, conversionRate: 65, color: 'bg-blue-600' },
    { name: 'POC connected', count: 34, conversionRate: 67, color: 'bg-blue-700' },
    { name: 'Discovery call', count: 24, conversionRate: 71, color: 'bg-blue-800' },
    { name: 'Demo call', count: 18, conversionRate: 75, color: 'bg-blue-900' },
  ],
  '30': [
    { name: 'Leads prospected', count: 320, conversionRate: 0, color: 'bg-blue-400' },
    { name: 'Leads qualified', count: 155, conversionRate: 48, color: 'bg-blue-500' },
    { name: 'Soft connect', count: 98, conversionRate: 63, color: 'bg-blue-600' },
    { name: 'POC connected', count: 64, conversionRate: 65, color: 'bg-blue-700' },
    { name: 'Discovery call', count: 43, conversionRate: 67, color: 'bg-blue-800' },
    { name: 'Demo call', count: 31, conversionRate: 72, color: 'bg-blue-900' },
  ],
  '60': [
    { name: 'Leads prospected', count: 560, conversionRate: 0, color: 'bg-blue-400' },
    { name: 'Leads qualified', count: 265, conversionRate: 47, color: 'bg-blue-500' },
    { name: 'Soft connect', count: 175, conversionRate: 66, color: 'bg-blue-600' },
    { name: 'POC connected', count: 110, conversionRate: 63, color: 'bg-blue-700' },
    { name: 'Discovery call', count: 78, conversionRate: 71, color: 'bg-blue-800' },
    { name: 'Demo call', count: 52, conversionRate: 67, color: 'bg-blue-900' },
  ],
};

export function PipelineSnapshot() {
  const [timeframe, setTimeframe] = useState('7');
  
  const handleTimeframeChange = (value: string) => {
    setTimeframe(value);
  };

  const currentData = pipelineData[timeframe as keyof typeof pipelineData];

  return (
    <Card className="mb-8">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle>Pipeline Snapshot</CardTitle>
          <Select value={timeframe} onValueChange={handleTimeframeChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="15">Last 15 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardDescription>Stage-by-stage progress for the last {timeframe} days</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-2">
          {currentData.map((stage, index) => (
            <div key={index} className="flex-1">
              <div className={`h-32 ${stage.color} text-white rounded-t-md flex flex-col items-center justify-center px-2 text-center`}>
                <div className="text-3xl font-bold">{stage.count}</div>
                <div className="text-xs">deals</div>
              </div>
              <div className="p-2 border border-t-0 rounded-b-md bg-gray-50 flex flex-col items-center">
                <div className="text-sm font-medium mb-1 text-center">{stage.name}</div>
                {stage.conversionRate > 0 && (
                  <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {stage.conversionRate}% conv.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
