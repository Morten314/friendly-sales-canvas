
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    { name: 'Leads prospected', count: 85, conversionRate: 0, color: 'bg-blue-500' },
    { name: 'Leads qualified', count: 42, conversionRate: 49, color: 'bg-cyan-500' },
    { name: 'Soft connect', count: 28, conversionRate: 67, color: 'bg-teal-400' },
    { name: 'POC connected', count: 18, conversionRate: 64, color: 'bg-green-400' },
    { name: 'Discovery call', count: 12, conversionRate: 67, color: 'bg-green-500' },
    { name: 'Demo call', count: 8, conversionRate: 67, color: 'bg-lime-500' },
  ],
  '15': [
    { name: 'Leads prospected', count: 162, conversionRate: 0, color: 'bg-blue-500' },
    { name: 'Leads qualified', count: 78, conversionRate: 48, color: 'bg-cyan-500' },
    { name: 'Soft connect', count: 51, conversionRate: 65, color: 'bg-teal-400' },
    { name: 'POC connected', count: 34, conversionRate: 67, color: 'bg-green-400' },
    { name: 'Discovery call', count: 24, conversionRate: 71, color: 'bg-green-500' },
    { name: 'Demo call', count: 18, conversionRate: 75, color: 'bg-lime-500' },
  ],
  '30': [
    { name: 'Leads prospected', count: 320, conversionRate: 0, color: 'bg-blue-500' },
    { name: 'Leads qualified', count: 155, conversionRate: 48, color: 'bg-cyan-500' },
    { name: 'Soft connect', count: 98, conversionRate: 63, color: 'bg-teal-400' },
    { name: 'POC connected', count: 64, conversionRate: 65, color: 'bg-green-400' },
    { name: 'Discovery call', count: 43, conversionRate: 67, color: 'bg-green-500' },
    { name: 'Demo call', count: 31, conversionRate: 72, color: 'bg-lime-500' },
  ],
  '60': [
    { name: 'Leads prospected', count: 560, conversionRate: 0, color: 'bg-blue-500' },
    { name: 'Leads qualified', count: 265, conversionRate: 47, color: 'bg-cyan-500' },
    { name: 'Soft connect', count: 175, conversionRate: 66, color: 'bg-teal-400' },
    { name: 'POC connected', count: 110, conversionRate: 63, color: 'bg-green-400' },
    { name: 'Discovery call', count: 78, conversionRate: 71, color: 'bg-green-500' },
    { name: 'Demo call', count: 52, conversionRate: 67, color: 'bg-lime-500' },
  ],
};

export function PipelineSnapshot() {
  const [timeframe, setTimeframe] = useState('7');
  
  const handleTimeframeChange = (value: string) => {
    setTimeframe(value);
  };

  const currentData = pipelineData[timeframe as keyof typeof pipelineData];

  return (
    <Card className="mb-6">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Pipeline at a Glance</CardTitle>
          <Select value={timeframe} onValueChange={handleTimeframeChange}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="7 days" />
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
      <CardContent className="pt-4">
        <div className="flex items-end h-[180px] gap-2 mb-4">
          {currentData.map((stage, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div 
                className={`w-full ${stage.color} rounded-t-md`} 
                style={{ height: `${(stage.count / currentData[0].count) * 150}px` }}
              ></div>
              <div className="text-xs mt-1 text-center">{stage.count}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-between">
          {currentData.map((stage, index) => (
            <div key={index} className="flex-1">
              <div className="text-[10px] text-center font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                {stage.name}
                {stage.conversionRate > 0 && (
                  <div className="text-[9px] text-blue-600">
                    {stage.conversionRate}%
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
