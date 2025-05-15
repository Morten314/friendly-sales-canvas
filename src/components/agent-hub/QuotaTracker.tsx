
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function QuotaTracker() {
  // Simulated data for the quota tracker
  const currentProgress = 42;
  const lastMonthProgress = 52;
  const targetAmount = "$120,000";
  const currentAmount = "$50,400";

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Your Monthly Target</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-end justify-between mb-1">
            <div>
              <span className="text-2xl font-bold">{currentAmount}</span>
              <span className="text-sm text-gray-500 ml-2">of {targetAmount}</span>
            </div>
            <div className="text-xl font-bold text-blue-600">{currentProgress}%</div>
          </div>
          
          <div className="relative pt-1">
            <Progress value={currentProgress} className="h-3">
              <div className="h-full bg-blue-600" style={{ width: `${currentProgress}%` }}></div>
            </Progress>
            {/* Target line */}
            <div 
              className="absolute top-1 h-3 border-l-2 border-red-500"
              style={{ left: "75%"}}
            >
              <span className="absolute -top-6 -translate-x-1/2 text-xs text-red-500">Target</span>
            </div>
          </div>
          
          <p className="text-sm text-gray-700 mt-3">
            You're currently at {currentProgress}% of your monthly target. On this day last month, 
            you were at {lastMonthProgress}% — let's pick up the pace!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
