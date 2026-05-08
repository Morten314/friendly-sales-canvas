import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function QuotaTracker() {
  // Progress values
  const currentProgress = 42;
  const lastMonthProgress = 52;

  const targetAmount = "$120,000";
  const currentAmount = "$50,400";

  const difference = currentProgress - lastMonthProgress;
  const comparisonText =
  difference > 0
    ? `Great job! You're ${Math.abs(difference)}% ahead of last month's progress.`
    : difference < 0
    ? `You're currently ${Math.abs(difference)}% behind last month. Stay focused!!`
    : `You're right on par with last month. Keep up the steady performance!`;


  // Team progress data
  const teamProgress = [
    { name: "Rohan", progress: 58 },
    { name: "Priya", progress: 66 }
  ];

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="space-y-5">
          {/* Current progress section */}
          <div className="flex items-end justify-between mb-1">
            <div>
              <span className="text-2xl font-bold">{currentAmount}</span>
              <span className="text-sm text-gray-500 ml-2">of {targetAmount}</span>
            </div>
            <div className="text-xl font-bold text-blue-600">{currentProgress}%</div>
          </div>

          {/* Current month progress bar */}
          <div className="relative pt-1">
            <div className="flex justify-between text-sm mb-1">
              <span>This Month</span>
              <span>{currentProgress}%</span>
            </div>
            <Progress value={currentProgress} className="h-3 bg-gray-200">
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

          {/* Last month progress bar */}
          <div className="pt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Last Month</span>
              <span>{lastMonthProgress}%</span>
            </div>
            <Progress value={lastMonthProgress} className="h-3 bg-gray-200">
              <div className="h-full bg-green-500" style={{ width: `${lastMonthProgress}%` }}></div>
            </Progress>
          </div>

          {/* Comparison text */}
          <div className="text-sm text-gray-700 pt-2 italic">
            {comparisonText}
          </div>

          {/* Team comparison section */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-3">How others are tracking</h3>
            <div className="space-y-3">
              {teamProgress.map((member, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{member.name}</span>
                    <span>{member.progress}% of quota</span>
                  </div>
                  <Progress value={member.progress} className="h-2 bg-gray-200">
                    <div className="h-full bg-indigo-500" style={{ width: `${member.progress}%` }}></div>
                  </Progress>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
